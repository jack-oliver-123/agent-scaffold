import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkReleaseReadiness } from "../src/release.js";
import { createTemplateFixture } from "./helpers.js";

const fixtures: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Baseline release readiness", () => {
  it("rejects unreleased provenance placeholders", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    const configPath = path.join(fixture, "baseline.config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.sourceCommit = "unreleased";
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    await expect(checkReleaseReadiness(fixture)).rejects.toThrow("sourceCommit");
  });

  it("accepts pinned provenance, changelog, and Skill projections", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    const configPath = path.join(fixture, "baseline.config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.sourceRepository = "ssh://git@github.example/acme/codex-scaffold.git";
    config.sourceCommit = "0123456789abcdef0123456789abcdef01234567";
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    await expect(checkReleaseReadiness(fixture)).resolves.toBeUndefined();
  });
});
