import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tag = process.argv[2];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageConfig = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const expected = `v${packageConfig.version}`;
if (tag !== expected) throw new Error(`Release tag ${tag ?? "<missing>"} must equal ${expected}.`);
