import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, confirm, input } from "@inquirer/prompts";
import { loadBaselineConfig, selectAgents } from "../../../.baseline/src/config.js";
import type { InitAnswers } from "../../../.baseline/src/types.js";
import { parseCreatorArguments } from "./arguments.js";
import { CreatorInterruptedError, createProject } from "./create.js";

const defaultDescription = "A project initialized from Agent Development Baseline.";

function packageNameFromTarget(target: string): string {
  return path
    .basename(path.resolve(target))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectNameFromPackage(packageName: string): string {
  return packageName
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function assertNodeVersion(): void {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  if (major !== 24) throw new Error("Project Creator requires Node.js 24.");
}

async function collectAnswers(
  payloadRoot: string,
  argv: readonly string[],
): Promise<
  { target: string; answers: InitAnswers; install: boolean; verbose: boolean } | undefined
> {
  const parsed = parseCreatorArguments(argv);
  const config = await loadBaselineConfig(payloadRoot);
  const target =
    parsed.target ??
    (parsed.yes
      ? (() => {
          throw new Error("A target directory is required with --yes.");
        })()
      : await input({ message: "Target directory", default: "my-project" }));
  const inferredPackageName = packageNameFromTarget(target);
  const packageName =
    parsed.values["package-name"] ??
    (parsed.yes
      ? inferredPackageName
      : await input({ message: "Package name", default: inferredPackageName }));
  const inferredProjectName = projectNameFromPackage(packageName);
  const projectName =
    parsed.values.name ??
    (parsed.yes
      ? inferredProjectName
      : await input({ message: "Project name", default: inferredProjectName }));
  const description =
    parsed.values.description ??
    (parsed.yes
      ? defaultDescription
      : await input({ message: "Project description", default: defaultDescription }));

  let selectedAgentIds: string[];
  if (parsed.allAgents) selectedAgentIds = config.agents.map((agent) => agent.id);
  else if (parsed.agents.length > 0) selectedAgentIds = parsed.agents;
  else if (parsed.yes) {
    selectedAgentIds = config.agents
      .filter((agent) => agent.defaultSelected)
      .map((agent) => agent.id);
  } else {
    selectedAgentIds = await checkbox({
      message: "Coding agents",
      required: true,
      choices: config.agents.map((agent) => ({
        name: agent.displayName,
        value: agent.id,
        checked: agent.defaultSelected,
      })),
    });
  }
  const selectedAgents = selectAgents(config, selectedAgentIds);
  const answers: InitAnswers = {
    projectName,
    packageName,
    description,
    profile: parsed.values.profile ?? config.defaultProfile,
    agents: selectedAgents.map((agent) => agent.id),
  };

  if (!parsed.yes) {
    process.stdout.write(
      `\nCreate ${projectName} in ${path.resolve(target)}\nAgents: ${selectedAgents
        .map((agent) => agent.displayName)
        .join(", ")}\n\n`,
    );
    if (!(await confirm({ message: "Continue?", default: true }))) {
      process.stdout.write("Cancelled.\n");
      return undefined;
    }
  }
  return { target, answers, install: parsed.install, verbose: parsed.verbose };
}

export async function runCreator(argv: readonly string[]): Promise<void> {
  assertNodeVersion();
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const payloadRoot = path.join(packageRoot, "payload");
  const request = await collectAnswers(payloadRoot, argv);
  if (!request) return;
  const cancellation = new AbortController();
  const interrupt = () => cancellation.abort();
  process.once("SIGINT", interrupt);
  const result = await createProject({
    payloadRoot,
    targetDirectory: request.target,
    answers: request.answers,
    install: request.install,
    verbose: request.verbose,
    signal: cancellation.signal,
  }).finally(() => process.removeListener("SIGINT", interrupt));
  process.stdout.write(`Created ${request.answers.projectName} at ${result.targetDirectory}.\n`);
  if (!result.installed) {
    process.stdout.write("Next: corepack pnpm install && corepack pnpm check\n");
  }
}

runCreator(process.argv.slice(2)).catch((error: unknown) => {
  if (
    error instanceof CreatorInterruptedError ||
    (error instanceof Error && error.name === "ExitPromptError")
  ) {
    process.exitCode = 130;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
