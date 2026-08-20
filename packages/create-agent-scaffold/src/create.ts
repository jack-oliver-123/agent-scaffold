import { spawn } from "node:child_process";
import { cp, lstat, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBaselineConfig } from "../../../.baseline/src/config.js";
import { copyRepositoryToStage, pathExists } from "../../../.baseline/src/files.js";
import { initializeProject } from "../../../.baseline/src/init.js";
import type { InitAnswers } from "../../../.baseline/src/types.js";

export interface CreateProjectOptions {
  payloadRoot: string;
  targetDirectory: string;
  answers: InitAnswers;
  install: boolean;
  verbose?: boolean;
  signal?: AbortSignal;
}

export interface CreateProjectResult {
  targetDirectory: string;
  installed: boolean;
}

export const creatorPackage = "create-agent-scaffold";

export class CreatorInterruptedError extends Error {
  constructor() {
    super("Project creation was interrupted.");
    this.name = "CreatorInterruptedError";
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CreatorInterruptedError();
}

async function runCommand(
  root: string,
  command: string,
  args: string[],
  verbose = false,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const usesCommandShim = command === "corepack" || command === "pnpm";
  const useWindowsCommandShell = process.platform === "win32" && usesCommandShim;
  const executable = useWindowsCommandShell ? (process.env.ComSpec ?? "cmd.exe") : command;
  const commandArgs = useWindowsCommandShell
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd: root,
      stdio: verbose ? "inherit" : "pipe",
      windowsHide: true,
      ...(signal ? { signal } : {}),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const details = [stdout, stderr].filter(Boolean).join("\n").trim();
      reject(new Error(`${command} ${args.join(" ")} failed.${details ? `\n${details}` : ""}`));
    });
  });
}

async function runGit(root: string, args: string[], signal?: AbortSignal): Promise<void> {
  await runCommand(root, "git", args, false, signal);
}

async function inspectTarget(target: string): Promise<"missing" | "empty"> {
  const parsed = path.parse(target);
  if (target === parsed.root || target === path.resolve(os.homedir())) {
    throw new Error("Target directory must be a dedicated project path.");
  }

  try {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink()) {
      throw new Error("Target directory cannot be a symbolic link or junction.");
    }
    if (!targetStat.isDirectory()) throw new Error("Target path must be a directory.");
    if ((await readdir(target)).length > 0) throw new Error("Target directory must be empty.");
    return "empty";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

async function assertParentDirectory(target: string): Promise<void> {
  const parent = path.dirname(target);
  const parentStat = await stat(parent);
  if (!parentStat.isDirectory()) throw new Error("Target parent must be a directory.");
}

async function removeDirectoryContents(root: string): Promise<void> {
  for (const entry of await readdir(root)) {
    await rm(path.join(root, entry), { recursive: true, force: true });
  }
}

async function copyDirectoryContents(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    await cp(path.join(source, entry.name), path.join(destination, entry.name), {
      recursive: entry.isDirectory(),
      force: false,
      errorOnExist: true,
    });
  }
}

async function prepareTemplateRepository(
  payloadRoot: string,
  stage: string,
  signal?: AbortSignal,
): Promise<void> {
  await copyRepositoryToStage(payloadRoot, stage);
  throwIfAborted(signal);
  await runGit(stage, ["init", "-b", "main"], signal);
  await runGit(stage, ["add", "."], signal);
  await runGit(
    stage,
    [
      "-c",
      "user.name=Project Creator",
      "-c",
      "user.email=creator@example.invalid",
      "commit",
      "-m",
      "creator payload",
    ],
    signal,
  );
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  throwIfAborted(options.signal);
  const payloadRoot = path.resolve(options.payloadRoot);
  const target = path.resolve(options.targetDirectory);
  if (!(await pathExists(payloadRoot))) throw new Error("Creator Payload is missing.");
  const baselineConfig = await loadBaselineConfig(payloadRoot);
  throwIfAborted(options.signal);
  await assertParentDirectory(target);
  const targetState = await inspectTarget(target);
  await runGit(payloadRoot, ["--version"], options.signal);
  if (options.install) {
    await runCommand(payloadRoot, "corepack", ["--version"], false, options.signal);
  }
  throwIfAborted(options.signal);

  const stage = await mkdtemp(
    path.join(path.dirname(target), `.${path.basename(target)}-creator-`),
  );
  let stageExists = true;
  let targetPopulated = false;
  try {
    await prepareTemplateRepository(payloadRoot, stage, options.signal);
    await initializeProject(stage, options.answers, {
      validateCommands: false,
      creator: { package: creatorPackage, version: baselineConfig.baselineVersion },
    });
    throwIfAborted(options.signal);
    await rm(path.join(stage, ".git"), { recursive: true, force: true });
    await runGit(stage, ["init", "-b", "main"], options.signal);
    throwIfAborted(options.signal);

    if (targetState === "missing") {
      await rename(stage, target);
      stageExists = false;
    } else {
      try {
        await copyDirectoryContents(stage, target);
      } catch (error) {
        await removeDirectoryContents(target);
        throw error;
      }
    }
    targetPopulated = true;

    if (options.install) {
      await runCommand(
        target,
        "corepack",
        ["pnpm", "install", "--frozen-lockfile"],
        options.verbose,
        options.signal,
      );
      await runCommand(target, "corepack", ["pnpm", "check"], options.verbose, options.signal);
      await rm(path.join(target, "dist"), { recursive: true, force: true });
    }
    throwIfAborted(options.signal);

    return { targetDirectory: target, installed: options.install };
  } catch (error) {
    if (targetPopulated) {
      if (targetState === "missing") await rm(target, { recursive: true, force: true });
      else await removeDirectoryContents(target);
    }
    if (options.signal?.aborted) throw new CreatorInterruptedError();
    throw error;
  } finally {
    if (stageExists) await rm(stage, { recursive: true, force: true });
  }
}
