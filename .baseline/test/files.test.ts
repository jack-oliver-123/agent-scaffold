import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pathsReferToSameLocation } from "../src/files.js";

const fixtures: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Filesystem paths", () => {
  it("recognizes canonical aliases of the same directory", async () => {
    const fixture = await mkdtemp(path.join(os.tmpdir(), "baseline-path-"));
    fixtures.push(fixture);
    const alias = process.platform === "win32" ? fixture.toLowerCase() : path.join(fixture, ".");

    expect(pathsReferToSameLocation(fixture, alias)).toBe(true);
  });

  it("distinguishes different directories", async () => {
    const fixture = await mkdtemp(path.join(os.tmpdir(), "baseline-path-"));
    fixtures.push(fixture);
    const other = path.join(fixture, "other");
    await mkdir(other);

    expect(pathsReferToSameLocation(fixture, other)).toBe(false);
  });
});
