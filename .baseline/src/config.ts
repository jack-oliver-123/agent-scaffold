import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AgentName,
  BaselineConfig,
  ProfileConfig,
  SkillDefinition,
  SkillsLock,
} from "./types.js";

const skillNamePattern = /^[a-z0-9-]+$/;

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function validateSkill(skill: SkillDefinition, index: number): void {
  if (!skillNamePattern.test(skill.name)) {
    throw new Error(`skills[${index}].name must use lowercase letters, digits, and hyphens.`);
  }

  assertString(skill.source.path, `skills[${index}].source.path`);
  if (!(["upstream", "baseline-owned", "agent-specific"] as const).includes(skill.source.kind)) {
    throw new Error(`skills[${index}].source.kind is unsupported.`);
  }

  if (skill.source.kind === "upstream") {
    assertString(skill.source.license, `skills[${index}].source.license`);
    assertString(skill.source.licenseUrl, `skills[${index}].source.licenseUrl`);
  }

  const supportedAgents = new Set<AgentName>(["codex", "claude"]);
  if (
    !Array.isArray(skill.agents) ||
    skill.agents.length === 0 ||
    skill.agents.some((agent) => !supportedAgents.has(agent))
  ) {
    throw new Error(`skills[${index}].agents must contain supported agents.`);
  }
}

export async function loadBaselineConfig(root: string): Promise<BaselineConfig> {
  const config = await readJson<BaselineConfig>(path.join(root, "baseline.config.json"));
  if (config.schemaVersion !== 1) {
    throw new Error("Unsupported baseline configuration schema version.");
  }

  assertString(config.baselineVersion, "baselineVersion");
  assertString(config.defaultProfile, "defaultProfile");
  assertString(config.sourceRepository, "sourceRepository");
  assertString(config.sourceCommit, "sourceCommit");
  if (!Array.isArray(config.skills) || config.skills.length === 0) {
    throw new Error("The Default Skill Set must contain at least one skill.");
  }

  config.skills.forEach(validateSkill);
  const names = config.skills.map((skill) => skill.name);
  if (new Set(names).size !== names.length) {
    throw new Error("The Default Skill Set contains duplicate names.");
  }
  return config;
}

export async function loadProfile(root: string, name: string): Promise<ProfileConfig> {
  if (!skillNamePattern.test(name)) {
    throw new Error("Profile names must use lowercase letters, digits, and hyphens.");
  }

  const profile = await readJson<ProfileConfig>(path.join(root, "profiles", name, "profile.json"));
  if (profile.schemaVersion !== 1 || profile.name !== name) {
    throw new Error(`Profile ${name} has invalid metadata.`);
  }
  assertString(profile.description, "profile.description");
  assertString(profile.templateDirectory, "profile.templateDirectory");
  return profile;
}

export async function loadSkillsLock(root: string): Promise<SkillsLock> {
  const lock = await readJson<SkillsLock>(path.join(root, "skills-lock.json"));
  if (lock.version !== 1 || typeof lock.skills !== "object" || lock.skills === null) {
    throw new Error("Unsupported skills lock format.");
  }
  return lock;
}
