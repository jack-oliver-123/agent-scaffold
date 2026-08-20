import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const protectedEntries = new Set([".git", "node_modules"]);

export function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }
  return resolved;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

export async function copyRepositoryToStage(root: string, stage: string): Promise<void> {
  await cp(root, stage, {
    recursive: true,
    force: true,
    filter: (source) => {
      const relative = path.relative(root, source);
      if (relative.length === 0) return true;
      const segments = relative.split(path.sep);
      return !segments.some((segment) => protectedEntries.has(segment) || segment === "dist");
    },
  });
}

export async function removeWorkingTreeEntries(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (protectedEntries.has(entry.name)) continue;
    await rm(path.join(root, entry.name), { recursive: true, force: true });
  }
}

export async function replaceWorkingTree(root: string, stage: string): Promise<void> {
  const backup = await mkdtemp(path.join(os.tmpdir(), "baseline-backup-"));

  try {
    await copyRepositoryToStage(root, backup);
    await removeWorkingTreeEntries(root);
    await cp(stage, root, { recursive: true, force: true });
  } catch (error) {
    await removeWorkingTreeEntries(root);
    await cp(backup, root, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(backup, { recursive: true, force: true });
  }
}
