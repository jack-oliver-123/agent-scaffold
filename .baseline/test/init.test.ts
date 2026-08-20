import { appendFile, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashDirectory } from "../src/hash.js";
import { initializeProject, validateInitAnswers } from "../src/init.js";
import type { InitAnswers } from "../src/types.js";
import { createTemplateFixture, git } from "./helpers.js";

const fixtures: string[] = [];
const answers: InitAnswers = {
  projectName: "Example Service",
  packageName: "example-service",
  description: "Processes example requests.",
  profile: "typescript-node",
};

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Baseline Initialization", () => {
  it("rejects invalid package names before touching a repository", () => {
    expect(() => validateInitAnswers({ ...answers, packageName: "Example Service" })).toThrow(
      "valid lowercase npm package name",
    );
  });

  it("returns a dry-run plan without modifying the working tree", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    const before = await hashDirectory(fixture);

    const plan = await initializeProject(fixture, answers, { dryRun: true });

    expect(plan).toContain("Apply Stack Profile: typescript-node");
    expect(await hashDirectory(fixture)).toBe(before);
    expect(git(fixture, "status", "--porcelain")).toBe("");
  });

  it("converts a clean template and refuses a second initialization", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);

    await initializeProject(fixture, answers, { validateCommands: false });

    expect(JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8"))).toMatchObject({
      name: "example-service",
      description: "Processes example requests.",
      private: true,
    });
    expect(
      JSON.parse(await readFile(path.join(fixture, "baseline.lock.json"), "utf8")),
    ).toMatchObject({
      baselineVersion: "0.1.0",
      profile: "typescript-node",
    });
    await expect(readFile(path.join(fixture, "baseline.config.json"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(fixture, "CONTEXT.md"), "utf8")).rejects.toThrow();
    expect(await readdir(path.join(fixture, ".agents", "skills"))).toHaveLength(10);
    expect(await readdir(path.join(fixture, ".claude", "skills"))).toHaveLength(10);
    const upstreamSkills = JSON.parse(
      await readFile(path.join(fixture, "skills-lock.json"), "utf8"),
    ).skills;
    expect(Object.keys(upstreamSkills)).toHaveLength(9);
    expect(upstreamSkills).not.toHaveProperty("grill-with-docs");

    git(fixture, "add", ".");
    git(fixture, "commit", "-m", "initialize project");
    await expect(initializeProject(fixture, answers, { validateCommands: false })).rejects.toThrow(
      "already a Derived Project",
    );
  });

  it("installs and checks the generated project before replacing the working tree", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);

    await initializeProject(fixture, answers);

    expect(git(fixture, "status", "--porcelain")).not.toBe("");
    expect(JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8"))).toMatchObject({
      name: "example-service",
    });
  }, 120_000);

  it("rejects a dirty template", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    await appendFile(path.join(fixture, "README.md"), "\nlocal change\n", "utf8");

    await expect(initializeProject(fixture, answers, { validateCommands: false })).rejects.toThrow(
      "clean Git working tree",
    );
  });

  it("leaves the template unchanged when staged validation fails", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    await rm(path.join(fixture, "profiles", "typescript-node", "template", "src", "index.ts"));
    git(fixture, "add", ".");
    git(fixture, "commit", "-m", "break profile fixture");
    const before = await hashDirectory(fixture);

    await expect(initializeProject(fixture, answers, { validateCommands: false })).rejects.toThrow(
      "missing src/index.ts",
    );
    expect(await hashDirectory(fixture)).toBe(before);
    expect(git(fixture, "status", "--porcelain")).toBe("");
  });
});
