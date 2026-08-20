import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashDirectory } from "../src/hash.js";

const fixtures: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Directory hashing", () => {
  it("produces the same hash for LF and CRLF text files", async () => {
    const fixture = await mkdtemp(path.join(os.tmpdir(), "baseline-hash-"));
    fixtures.push(fixture);
    const lf = path.join(fixture, "lf");
    const crlf = path.join(fixture, "crlf");
    await mkdir(lf);
    await mkdir(crlf);
    await writeFile(path.join(lf, "SKILL.md"), "name: example\nline: value\n", "utf8");
    await writeFile(path.join(crlf, "SKILL.md"), "name: example\r\nline: value\r\n", "utf8");

    expect(await hashDirectory(crlf)).toBe(await hashDirectory(lf));
  });

  it("does not normalize binary content", async () => {
    const fixture = await mkdtemp(path.join(os.tmpdir(), "baseline-hash-"));
    fixtures.push(fixture);
    const left = path.join(fixture, "left");
    const right = path.join(fixture, "right");
    await mkdir(left);
    await mkdir(right);
    await writeFile(path.join(left, "asset.bin"), Buffer.from([0, 13, 10]));
    await writeFile(path.join(right, "asset.bin"), Buffer.from([0, 10]));

    expect(await hashDirectory(left)).not.toBe(await hashDirectory(right));
  });
});
