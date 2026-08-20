import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadBaselineConfig } from "./config.js";
import { initializeProject } from "./init.js";
import { checkReleaseReadiness } from "./release.js";
import { checkSkills, pruneSkillsLock, syncSkills } from "./skills.js";
import type { InitAnswers } from "./types.js";

interface ParsedArguments {
  command: string;
  values: Map<string, string>;
  flags: Set<string>;
}

function parseArguments(argv: string[]): ParsedArguments {
  const [command = "", ...rest] = argv;
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument?.startsWith("--")) throw new Error(`Unexpected argument: ${argument ?? ""}`);
    const key = argument.slice(2);
    if (key === "dry-run") {
      flags.add(key);
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    values.set(key, value);
    index += 1;
  }
  return { command, values, flags };
}

async function collectAnswers(root: string, parsed: ParsedArguments): Promise<InitAnswers> {
  const config = await loadBaselineConfig(root);
  const terminal = createInterface({ input, output });
  try {
    const ask = async (key: string, prompt: string): Promise<string> =>
      parsed.values.get(key) ?? (await terminal.question(prompt));
    return {
      projectName: await ask("name", "Project name: "),
      packageName: await ask("package-name", "Package name: "),
      description: await ask("description", "One-line purpose: "),
      profile: parsed.values.get("profile") ?? config.defaultProfile,
    };
  } finally {
    terminal.close();
  }
}

function printLines(lines: string[]): void {
  for (const [index, line] of lines.entries()) output.write(`${index + 1}. ${line}\n`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const parsed = parseArguments(process.argv.slice(2));

  switch (parsed.command) {
    case "init": {
      const answers = await collectAnswers(root, parsed);
      const plan = await initializeProject(root, answers, {
        dryRun: parsed.flags.has("dry-run"),
      });
      output.write(
        parsed.flags.has("dry-run") ? "Initialization plan:\n" : "Initialized project:\n",
      );
      printLines(plan);
      break;
    }
    case "skills-sync":
      await syncSkills(root, true);
      await pruneSkillsLock(root);
      output.write("Skill projections synchronized.\n");
      break;
    case "skills-check":
      await checkSkills(root);
      output.write("Skill projections and provenance are valid.\n");
      break;
    case "release-check":
      await checkReleaseReadiness(root);
      output.write("Baseline release metadata and projections are valid.\n");
      break;
    default:
      throw new Error("Usage: baseline <init|skills-sync|skills-check|release-check> [options]");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
