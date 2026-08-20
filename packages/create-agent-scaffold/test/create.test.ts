import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sourceRoot } from "../../../.baseline/test/helpers.js";
import { createProject } from "../src/create.js";

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true })),
  );
});

describe("Project Creator", () => {
  it("creates a new uncommitted Codex project from a Creator Payload", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-test-"));
    workspaces.push(workspace);
    const target = path.join(workspace, "example-service");

    await createProject({
      payloadRoot: sourceRoot,
      targetDirectory: target,
      answers: {
        projectName: "Example Service",
        packageName: "example-service",
        description: "Processes example requests.",
        profile: "typescript-node",
        agents: ["codex"],
      },
      install: false,
    });

    expect(JSON.parse(await readFile(path.join(target, "package.json"), "utf8"))).toMatchObject({
      name: "example-service",
    });
    expect(
      JSON.parse(await readFile(path.join(target, "baseline.lock.json"), "utf8")),
    ).toMatchObject({
      creator: {
        package: "create-agent-scaffold",
        version: "0.2.0",
      },
    });
    expect(await readdir(path.join(target, ".agents", "skills"))).toHaveLength(10);
    await expect(readdir(path.join(target, ".claude"))).rejects.toThrow();
    const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: target,
      encoding: "utf8",
      windowsHide: true,
    });
    expect(git.status).toBe(0);
    expect(git.stdout.trim()).toBe("true");
    expect(
      spawnSync("git", ["rev-parse", "HEAD"], { cwd: target, windowsHide: true }).status,
    ).not.toBe(0);
  });

  it("fills an existing empty target directory", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-test-"));
    workspaces.push(workspace);
    const target = path.join(workspace, "existing-project");
    await mkdir(target);

    await createProject({
      payloadRoot: sourceRoot,
      targetDirectory: target,
      answers: {
        projectName: "Existing Project",
        packageName: "existing-project",
        description: "Uses an existing empty directory.",
        profile: "typescript-node",
        agents: ["claude"],
      },
      install: false,
    });

    expect(await readdir(path.join(target, ".claude", "skills"))).toHaveLength(10);
    await expect(readdir(path.join(target, ".agents"))).rejects.toThrow();
  });

  it("leaves the target unchanged when initialization fails", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-test-"));
    workspaces.push(workspace);
    const target = path.join(workspace, "failed-project");

    await expect(
      createProject({
        payloadRoot: sourceRoot,
        targetDirectory: target,
        answers: {
          projectName: "Failed Project",
          packageName: "failed-project",
          description: "Exercises rollback.",
          profile: "typescript-node",
          agents: ["unknown-agent"],
        },
        install: false,
      }),
    ).rejects.toThrow("Unknown Agent");
    await expect(readdir(target)).rejects.toThrow();
  });

  it("refuses a non-empty target without changing its files", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-test-"));
    workspaces.push(workspace);
    const target = path.join(workspace, "occupied-project");
    await mkdir(target);
    const marker = path.join(target, "keep.txt");
    await writeFile(marker, "keep\n", "utf8");

    await expect(
      createProject({
        payloadRoot: sourceRoot,
        targetDirectory: target,
        answers: {
          projectName: "Occupied Project",
          packageName: "occupied-project",
          description: "Must not be overwritten.",
          profile: "typescript-node",
          agents: ["codex"],
        },
        install: false,
      }),
    ).rejects.toThrow("must be empty");
    expect(await readFile(marker, "utf8")).toBe("keep\n");
  });

  it("leaves no target when creation is interrupted", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "creator-test-"));
    workspaces.push(workspace);
    const target = path.join(workspace, "interrupted-project");
    const cancellation = new AbortController();
    cancellation.abort();

    await expect(
      createProject({
        payloadRoot: sourceRoot,
        targetDirectory: target,
        answers: {
          projectName: "Interrupted Project",
          packageName: "interrupted-project",
          description: "Exercises cancellation cleanup.",
          profile: "typescript-node",
          agents: ["codex"],
        },
        install: false,
        signal: cancellation.signal,
      }),
    ).rejects.toThrow("interrupted");
    await expect(readdir(target)).rejects.toThrow();
  });
});
