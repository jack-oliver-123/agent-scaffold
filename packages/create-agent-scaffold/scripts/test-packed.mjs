import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tarballArgument = process.argv[2];
if (!tarballArgument) throw new Error("Usage: test-packed.mjs <creator.tgz>");
const tarball = path.resolve(tarballArgument);
await stat(tarball);

function runPackedCreator(args, expectSuccess = true) {
  const npxArguments = ["--yes", "--package", tarball, "create-agent-scaffold", ...args];
  const result =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npx.cmd", ...npxArguments],
          { encoding: "utf8", windowsHide: true },
        )
      : spawnSync("npx", npxArguments, { encoding: "utf8" });

  if (expectSuccess && result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n"),
    );
  }
  if (!expectSuccess && result.status === 0) throw new Error("Creator unexpectedly succeeded.");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertProject(target, expectedAgents) {
  const lock = JSON.parse(await readFile(path.join(target, "baseline.lock.json"), "utf8"));
  assert.deepEqual(lock.agents, expectedAgents);
  assert.deepEqual(lock.creator, {
    package: "create-agent-scaffold",
    version: lock.baselineVersion,
  });
  assert.equal(await exists(path.join(target, ".gitignore")), true);
  assert.equal(await exists(path.join(target, ".agents")), expectedAgents.includes("codex"));
  assert.equal(await exists(path.join(target, ".codex")), expectedAgents.includes("codex"));
  assert.equal(await exists(path.join(target, ".claude")), expectedAgents.includes("claude"));
  assert.equal(await exists(path.join(target, "CLAUDE.md")), expectedAgents.includes("claude"));

  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: target, windowsHide: true });
  assert.notEqual(git.status, 0);
}

const workspace = await mkdtemp(path.join(os.tmpdir(), "packed-creator-"));
try {
  const codex = path.join(workspace, "codex-project");
  runPackedCreator([codex, "--agent", "codex", "--yes", "--verbose"]);
  await assertProject(codex, ["codex"]);

  const claude = path.join(workspace, "claude-project");
  runPackedCreator([claude, "--agent", "claude", "--yes", "--no-install"]);
  await assertProject(claude, ["claude"]);

  const both = path.join(workspace, "both-project");
  runPackedCreator([both, "--agent", "codex", "--agent", "claude", "--yes", "--no-install"]);
  await assertProject(both, ["codex", "claude"]);

  const occupied = path.join(workspace, "occupied-project");
  await mkdir(occupied);
  const marker = path.join(occupied, "keep.txt");
  await writeFile(marker, "keep\n", "utf8");
  runPackedCreator([occupied, "--agent", "codex", "--yes", "--no-install"], false);
  assert.equal(await readFile(marker, "utf8"), "keep\n");

  process.stdout.write("Packed Creator passed Agent matrix and rollback verification.\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
