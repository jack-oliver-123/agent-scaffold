import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { loadBaselineConfig, loadSkillsLock } from "./config.js";
import { copyDirectory, pathExists, resolveInside, writeJson } from "./files.js";
import { hashDirectory } from "./hash.js";
import type {
  AgentName,
  SkillDefinition,
  SkillIntegrityLock,
  SkillLockEntry,
  SkillsLock,
} from "./types.js";

const integrityPath = path.join(".baseline", "skill-integrity.json");

function destinationFor(root: string, agent: AgentName, skillName: string): string {
  const adapterDirectory = agent === "codex" ? ".agents" : ".claude";
  return resolveInside(root, path.join(adapterDirectory, "skills", skillName));
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

export async function syncSkills(root: string, pruneCodex = false): Promise<SkillIntegrityLock> {
  const config = await loadBaselineConfig(root);
  const lock = await loadSkillsLock(root);
  const integrity: SkillIntegrityLock = { schemaVersion: 1, skills: {} };
  const stagedSources = new Map<string, string>();
  const sourceHashes = new Map<string, string>();

  for (const skill of config.skills) {
    sourceHashes.set(skill.name, await validateSkillEntry(root, skill));
  }

  if (pruneCodex) {
    const cacheRoot = resolveInside(root, path.join(".baseline-tmp", "skill-sources"));
    await rm(cacheRoot, { recursive: true, force: true });
    for (const skill of config.skills) {
      const cachedSource = path.join(cacheRoot, skill.name);
      await copyDirectory(resolveInside(root, skill.source.path), cachedSource);
      stagedSources.set(skill.name, cachedSource);
    }
    await rm(resolveInside(root, path.join(".agents", "skills")), { recursive: true, force: true });
  }
  await rm(resolveInside(root, path.join(".claude", "skills")), { recursive: true, force: true });

  for (const skill of config.skills) {
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

    for (const agent of skill.agents) {
      const destination = destinationFor(root, agent, skill.name);
      if (path.resolve(source) === path.resolve(destination)) continue;
      await copyDirectory(source, destination);
    }
  }

  await writeJson(resolveInside(root, integrityPath), integrity);
  if (pruneCodex) {
    await rm(resolveInside(root, ".baseline-tmp"), { recursive: true, force: true });
  }
  return integrity;
}

export async function checkSkills(root: string): Promise<SkillIntegrityLock> {
  const config = await loadBaselineConfig(root);
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

    for (const agent of skill.agents) {
      const destination = destinationFor(root, agent, skill.name);
      if (!(await pathExists(destination))) {
        throw new Error(`Skill ${skill.name} is missing from the ${agent} adapter.`);
      }
      if ((await hashDirectory(destination)) !== sourceHash) {
        throw new Error(`Skill ${skill.name} has a stale ${agent} projection.`);
      }
    }
  }

  return stored;
}

export async function pruneSkillsLock(root: string): Promise<void> {
  const config = await loadBaselineConfig(root);
  const lock = await loadSkillsLock(root);
  const selected = config.skills.filter((skill) => skill.source.kind === "upstream");
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
  await mkdir(path.join(root, ".agents", "skills"), { recursive: true });
  await mkdir(path.join(root, ".claude", "skills"), { recursive: true });
}
