import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");

function run(command, args, cwd) {
  const usesCommandShim = command === "corepack";
  const useWindowsCommandShell = process.platform === "win32" && usesCommandShim;
  const executable = useWindowsCommandShell ? (process.env.ComSpec ?? "cmd.exe") : command;
  const commandArgs = useWindowsCommandShell ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed.`);
}

const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-pack-"));
try {
  run(
    "corepack",
    ["pnpm", "--filter", "create-agent-scaffold", "pack", "--pack-destination", workspace],
    repositoryRoot,
  );
  const tarballs = (await readdir(workspace))
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => path.join(workspace, entry));
  if (tarballs.length !== 1 || !tarballs[0])
    throw new Error("Expected exactly one Creator tarball.");
  run(
    process.execPath,
    [path.join(packageRoot, "scripts", "test-packed.mjs"), tarballs[0]],
    repositoryRoot,
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
