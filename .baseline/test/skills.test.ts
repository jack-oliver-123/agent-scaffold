import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkSkills, syncSkills } from "../src/skills.js";
import { createTemplateFixture } from "./helpers.js";

const fixtures: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Skill projections", () => {
  it("synchronizes and validates both Agent Adapters", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);

    const integrity = await syncSkills(fixture);

    expect(Object.keys(integrity.skills)).toHaveLength(10);
    await expect(checkSkills(fixture)).resolves.toEqual(integrity);
  });

  it("detects a changed projection", async () => {
    const fixture = await createTemplateFixture();
    fixtures.push(fixture);
    await syncSkills(fixture);
    const projectedSkill = path.join(fixture, ".claude", "skills", "grill-with-docs", "SKILL.md");
    const original = await readFile(projectedSkill, "utf8");
    await writeFile(projectedSkill, `${original}\nchanged\n`, "utf8");

    await expect(checkSkills(fixture)).rejects.toThrow("stale claude projection");
  });
});
