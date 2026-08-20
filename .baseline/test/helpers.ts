import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyRepositoryToStage } from "../src/files.js";

export const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));

export function git(root: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout.trim();
}

export async function createTemplateFixture(): Promise<string> {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "baseline-fixture-"));
  await copyRepositoryToStage(sourceRoot, fixture);
  git(fixture, "init", "-b", "main");
  git(fixture, "config", "user.name", "Baseline Test");
  git(fixture, "config", "user.email", "baseline-test@example.invalid");
  git(fixture, "add", ".");
  git(fixture, "commit", "-m", "template fixture");
  return fixture;
}
