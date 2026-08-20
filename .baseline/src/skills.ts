import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { loadBaselineConfig, loadSkillsLock, selectAgents } from "./config.js";
import { copyDirectory, pathExists, resolveInside, writeJson } from "./files.js";
import { hashDirectory } from "./hash.js";
import type {
  AgentDefinition,
  SkillDefinition,
  SkillIntegrityLock,
  SkillLockEntry,
  SkillsLock,
} from "./types.js";

const integrityPath = path.join(".baseline", "skill-integrity.json");

function destinationFor(root: string, agent: AgentDefinition, skillName: string): string {
  return resolveInside(root, path.join(agent.skillsDirectory, skillName));
}

function lockEntryFor(skill: SkillDefinition, lock: SkillsLock): SkillLockEntry | undefined {
  return skill.source.kind === "upstream" ? lock.skills[skill.name] : undefined;
}

async function validateSkillEntry(root: string, skill: SkillDefinition): Promise<string> {
  const source = resolveInside(root, skill.source.path);
  if (!(await pathExists(path.join(source, "SKILL.md")))) {
    throw new Error(`Skill ${skill.name} is missing SKILL.md at ${skill.source.path}.`);
  }
  const skillDocument = await readFile(path.join(source, "SKILL.md"), "utf8");
  if (!skillDocument.includes(`name: ${skill.name}`)) {
    throw new Error(`Skill ${skill.name} has mismatched frontmatter.`);
  }
  return hashDirectory(source);
}

export async function syncSkills(
  root: string,
  pruneAdapters = false,
  requestedAgents?: readonly string[],
): Promise<SkillIntegrityLock> {
  const config = await loadBaselineConfig(root);
  const selectedAgents = selectAgents(config, requestedAgents);
  const selectedIds = new Set(selectedAgents.map((agent) => agent.id));
  const activeSkills = config.skills.filter((skill) =>
    skill.agents.some((agent) => selectedIds.has(agent)),
  );
  const lock = await loadSkillsLock(root);
  const integrity: SkillIntegrityLock = { schemaVersion: 1, skills: {} };
  const stagedSources = new Map<string, string>();
  const sourceHashes = new Map<string, string>();

  for (const skill of activeSkills) {
    sourceHashes.set(skill.name, await validateSkillEntry(root, skill));
  }

  if (pruneAdapters) {
    const cacheRoot = resolveInside(root, path.join(".baseline-tmp", "skill-sources"));
    await rm(cacheRoot, { recursive: true, force: true });
    for (const skill of activeSkills) {
      const cachedSource = path.join(cacheRoot, skill.name);
      await copyDirectory(resolveInside(root, skill.source.path), cachedSource);
      stagedSources.set(skill.name, cachedSource);
    }
    for (const agent of config.agents) {
      await rm(resolveInside(root, agent.skillsDirectory), { recursive: true, force: true });
    }
  }

  for (const skill of activeSkills) {
    const originalSource = resolveInside(root, skill.source.path);
    const source = stagedSources.get(skill.name) ?? originalSource;
    const contentHash = sourceHashes.get(skill.name);
    if (!contentHash) throw new Error(`Skill ${skill.name} was not staged.`);
    const upstreamEntry = lockEntryFor(skill, lock);
    if (skill.source.kind === "upstream") {
      if (!upstreamEntry || !/^[a-f0-9]{64}$/.test(upstreamEntry.computedHash)) {
        throw new Error(`Skill ${skill.name} lacks a valid upstream lock entry.`);
      }
    }

    integrity.skills[skill.name] = {
      contentHash,
      sourceKind: skill.source.kind,
      ...(upstreamEntry ? { upstreamComputedHash: upstreamEntry.computedHash } : {}),
    };

    for (const agent of selectedAgents.filter((candidate) => skill.agents.includes(candidate.id))) {
      const destination = destinationFor(root, agent, skill.name);
      if (path.resolve(source) === path.resolve(destination)) continue;
      await copyDirectory(source, destination);
    }
  }

  await writeJson(resolveInside(root, integrityPath), integrity);
  if (pruneAdapters) {
    await rm(resolveInside(root, ".baseline-tmp"), { recursive: true, force: true });
  }
  return integrity;
}

export async function checkSkills(root: string): Promise<SkillIntegrityLock> {
  const config = await loadBaselineConfig(root);
  const selectedAgents = selectAgents(config);
  const lock = await loadSkillsLock(root);
  const stored = JSON.parse(
    await readFile(resolveInside(root, integrityPath), "utf8"),
  ) as SkillIntegrityLock;

  for (const skill of config.skills) {
    const sourceHash = await validateSkillEntry(root, skill);
    const storedEntry = stored.skills[skill.name];
    if (!storedEntry || storedEntry.contentHash !== sourceHash) {
      throw new Error(`Skill ${skill.name} differs from .baseline/skill-integrity.json.`);
    }

    if (skill.source.kind === "upstream") {
      const upstreamEntry = lock.skills[skill.name];
      if (!upstreamEntry || upstreamEntry.computedHash !== storedEntry.upstreamComputedHash) {
        throw new Error(`Skill ${skill.name} differs from skills-lock.json provenance.`);
      }
      if (!skill.source.license || !skill.source.licenseUrl) {
        throw new Error(`Skill ${skill.name} is missing license provenance.`);
      }
    }

    for (const agent of selectedAgents.filter((candidate) => skill.agents.includes(candidate.id))) {
      const destination = destinationFor(root, agent, skill.name);
      if (!(await pathExists(destination))) {
        throw new Error(`Skill ${skill.name} is missing from the ${agent.id} adapter.`);
      }
      if ((await hashDirectory(destination)) !== sourceHash) {
        throw new Error(`Skill ${skill.name} has a stale ${agent.id} projection.`);
      }
    }
  }

  return stored;
}

export async function pruneSkillsLock(
  root: string,
  requestedAgents?: readonly string[],
): Promise<void> {
  const config = await loadBaselineConfig(root);
  const lock = await loadSkillsLock(root);
  const selectedIds = new Set(selectAgents(config, requestedAgents).map((agent) => agent.id));
  const selected = config.skills.filter(
    (skill) =>
      skill.source.kind === "upstream" && skill.agents.some((agent) => selectedIds.has(agent)),
  );
  const skills = Object.fromEntries(
    selected.map((skill) => {
      const entry = lock.skills[skill.name];
      if (!entry) throw new Error(`Missing upstream lock for ${skill.name}.`);
      return [skill.name, entry];
    }),
  );
  await writeJson(path.join(root, "skills-lock.json"), { version: lock.version, skills });
}

export async function ensureAdapterDirectories(root: string): Promise<void> {
  const config = await loadBaselineConfig(root);
  for (const agent of config.agents) {
    await mkdir(resolveInside(root, agent.skillsDirectory), { recursive: true });
  }
}
