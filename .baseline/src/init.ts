import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBaselineConfig, loadProfile, selectAgents } from "./config.js";
import {
  copyRepositoryToStage,
  pathExists,
  replaceWorkingTree,
  resolveInside,
  writeJson,
} from "./files.js";
import { hashText } from "./hash.js";
import { pruneSkillsLock, syncSkills } from "./skills.js";
import type {
  AgentDefinition,
  BaselineConfig,
  CreatorProvenance,
  InitAnswers,
  SkillIntegrityLock,
} from "./types.js";

export interface InitializeOptions {
  dryRun?: boolean;
  validateCommands?: boolean;
  offlineInstall?: boolean;
  retainDependencies?: boolean;
  creator?: CreatorProvenance;
}

const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const sourceOnlyPaths = [
  ".baseline",
  ".baseline-tmp",
  "baseline.config.json",
  "CHANGELOG.md",
  "CONTEXT.md",
  "docs",
  "migrations",
  "packages",
  "profiles",
];
const requiredDerivedPaths = [
  ".github/workflows/ci.yml",
  "AGENTS.md",
  "README.md",
  "baseline.lock.json",
  "skills-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "src/index.ts",
  "test/index.test.ts",
];

function run(root: string, command: string, args: string[]): string {
  const usesCommandShim = command === "corepack" || command === "pnpm";
  const useWindowsCommandShell = process.platform === "win32" && usesCommandShim;
  const executable = useWindowsCommandShell ? (process.env.ComSpec ?? "cmd.exe") : command;
  const commandArgs = useWindowsCommandShell
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`${command} ${args.join(" ")} failed.${details ? `\n${details}` : ""}`);
  }
  return result.stdout.trim();
}

export function validateInitAnswers(answers: InitAnswers): void {
  if (answers.projectName.trim().length === 0) throw new Error("Project name is required.");
  if (!packageNamePattern.test(answers.packageName)) {
    throw new Error("Package name must be a valid lowercase npm package name.");
  }
  if (answers.description.trim().length === 0) throw new Error("Project description is required.");
  if (!/^[a-z0-9-]+$/.test(answers.profile)) throw new Error("Profile name is invalid.");
  if (answers.agents && new Set(answers.agents).size !== answers.agents.length) {
    throw new Error("Selected Agent ids must be unique.");
  }
}

export function getInitializationPlan(answers: InitAnswers): string[] {
  return [
    `Apply Stack Profile: ${answers.profile}`,
    `Set project name: ${answers.projectName}`,
    `Set package name: ${answers.packageName}`,
    `Select Agents: ${answers.agents?.join(", ") ?? "all Supported Agents"}`,
    "Project the Default Skill Set into Codex and Claude directories",
    "Write baseline.lock.json and prune skills-lock.json",
    "Remove baseline-authoring docs, profiles, migrations, and tooling",
    "Validate the complete Derived Project before replacing the working tree",
  ];
}

function assertCleanGitRepository(root: string): void {
  const topLevel = run(root, "git", ["rev-parse", "--show-toplevel"]);
  if (path.resolve(topLevel) !== path.resolve(root)) {
    throw new Error("Run Baseline Initialization from the Git repository root.");
  }
  if (run(root, "git", ["status", "--porcelain"]).length > 0) {
    throw new Error("Baseline Initialization requires a clean Git working tree.");
  }
}

async function renderTemplateDirectory(
  source: string,
  destination: string,
  replacements: Record<string, string>,
): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationName = entry.name === "gitignore.template" ? ".gitignore" : entry.name;
    const destinationPath = path.join(destination, destinationName);
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await renderTemplateDirectory(sourcePath, destinationPath, replacements);
      continue;
    }
    if (!entry.isFile()) continue;

    let content = await readFile(sourcePath, "utf8");
    for (const [token, value] of Object.entries(replacements)) {
      content = content.replaceAll(`{{${token}}}`, value);
    }
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, content, "utf8");
  }
}

async function writeBaselineLock(
  root: string,
  answers: InitAnswers,
  agents: readonly AgentDefinition[],
  integrity: SkillIntegrityLock,
  creator?: CreatorProvenance,
): Promise<void> {
  const config = await loadBaselineConfig(root);
  const skills = config.skills
    .filter((skill) => integrity.skills[skill.name] !== undefined)
    .map((skill) => ({
      name: skill.name,
      contentHash: integrity.skills[skill.name]?.contentHash ?? "",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (skills.some((skill) => !/^[a-f0-9]{64}$/.test(skill.contentHash))) {
    throw new Error("Cannot record Baseline Provenance with an incomplete Skill projection.");
  }

  await writeJson(path.join(root, "baseline.lock.json"), {
    $schema: "https://example.invalid/codex-scaffold/baseline-lock.schema.json",
    schemaVersion: 1,
    baselineVersion: config.baselineVersion,
    source: {
      repository: config.sourceRepository,
      commit: config.sourceCommit,
    },
    profile: answers.profile,
    agents: agents.map((agent) => agent.id),
    ...(creator ? { creator } : {}),
    defaultSkillSetHash: hashText(JSON.stringify(skills)),
    skills,
  });
}

async function removeSourceOnlyFiles(root: string): Promise<void> {
  for (const relativePath of sourceOnlyPaths) {
    await rm(resolveInside(root, relativePath), { recursive: true, force: true });
  }
}

async function removeUnselectedAdapters(
  root: string,
  config: BaselineConfig,
  selectedAgents: readonly AgentDefinition[],
): Promise<void> {
  const selectedIds = new Set(selectedAgents.map((agent) => agent.id));
  for (const agent of config.agents) {
    if (selectedIds.has(agent.id)) continue;
    for (const ownedPath of agent.ownedPaths) {
      await rm(resolveInside(root, ownedPath), { recursive: true, force: true });
    }
  }
}

async function validateDerivedStructure(
  root: string,
  config: BaselineConfig,
  selectedAgents: readonly AgentDefinition[],
): Promise<void> {
  for (const relativePath of requiredDerivedPaths) {
    if (!(await pathExists(resolveInside(root, relativePath)))) {
      throw new Error(`Derived Project is missing ${relativePath}.`);
    }
  }
  const selectedIds = new Set(selectedAgents.map((agent) => agent.id));
  for (const agent of config.agents) {
    for (const ownedPath of agent.ownedPaths) {
      const exists = await pathExists(resolveInside(root, ownedPath));
      if (selectedIds.has(agent.id) && !exists) {
        throw new Error(`Derived Project is missing ${agent.id} path ${ownedPath}.`);
      }
      if (!selectedIds.has(agent.id) && exists) {
        throw new Error(`Derived Project retained unselected ${agent.id} path ${ownedPath}.`);
      }
    }
  }
  for (const relativePath of sourceOnlyPaths) {
    if (await pathExists(resolveInside(root, relativePath))) {
      throw new Error(`Derived Project retained source-only path ${relativePath}.`);
    }
  }

  const renderedFiles = ["README.md", "AGENTS.md", "package.json"];
  for (const relativePath of renderedFiles) {
    const content = await readFile(resolveInside(root, relativePath), "utf8");
    if (/\{\{[A-Z_]+\}\}/.test(content)) {
      throw new Error(`Derived Project retained a template token in ${relativePath}.`);
    }
  }
}

async function validateDerivedCommands(
  root: string,
  offline: boolean,
  retainDependencies: boolean,
): Promise<void> {
  const installArguments = ["pnpm", "install", "--frozen-lockfile"];
  if (offline) installArguments.push("--offline");
  run(root, "corepack", installArguments);
  run(root, "corepack", ["pnpm", "check"]);
  if (!retainDependencies) {
    await rm(path.join(root, "node_modules"), { recursive: true, force: true });
  }
  await rm(path.join(root, "dist"), { recursive: true, force: true });
}

export async function initializeProject(
  root: string,
  answers: InitAnswers,
  options: InitializeOptions = {},
): Promise<string[]> {
  const resolvedRoot = path.resolve(root);
  validateInitAnswers(answers);
  assertCleanGitRepository(resolvedRoot);
  if (await pathExists(path.join(resolvedRoot, "baseline.lock.json"))) {
    throw new Error("This repository is already a Derived Project.");
  }

  const config = await loadBaselineConfig(resolvedRoot);
  const selectedAgents = selectAgents(config, answers.agents);
  const selectedAgentIds = selectedAgents.map((agent) => agent.id);
  const profile = await loadProfile(resolvedRoot, answers.profile || config.defaultProfile);
  const plan = getInitializationPlan(answers);
  if (options.dryRun) return plan;

  const stage = await mkdtemp(path.join(os.tmpdir(), "baseline-init-"));
  try {
    await copyRepositoryToStage(resolvedRoot, stage);
    const template = resolveInside(
      stage,
      path.join("profiles", profile.name, profile.templateDirectory),
    );
    await renderTemplateDirectory(template, stage, {
      PROJECT_NAME: answers.projectName.trim(),
      PACKAGE_NAME: answers.packageName,
      DESCRIPTION: answers.description.trim(),
    });

    const integrity = await syncSkills(stage, true, selectedAgentIds);
    await writeBaselineLock(stage, answers, selectedAgents, integrity, options.creator);
    await pruneSkillsLock(stage, selectedAgentIds);
    await removeSourceOnlyFiles(stage);
    await removeUnselectedAdapters(stage, config, selectedAgents);
    await validateDerivedStructure(stage, config, selectedAgents);
    if (options.validateCommands !== false) {
      await validateDerivedCommands(
        stage,
        options.offlineInstall === true,
        options.retainDependencies === true,
      );
    }
    await replaceWorkingTree(resolvedRoot, stage);
    return plan;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
