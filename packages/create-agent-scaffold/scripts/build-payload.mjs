import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const payloadRoot = path.join(packageRoot, "payload");
const payloadEntries = [
  ".agents/skills",
  ".baseline/skills",
  ".gitattributes",
  "baseline.config.json",
  "profiles",
  "skills-lock.json",
];

const baselineConfig = JSON.parse(
  await readFile(path.join(repositoryRoot, "baseline.config.json"), "utf8"),
);
const packageConfig = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
if (baselineConfig.baselineVersion !== packageConfig.version) {
  throw new Error("Creator package version must equal the Baseline Release version.");
}

await rm(payloadRoot, { recursive: true, force: true });
await mkdir(payloadRoot, { recursive: true });
for (const relativePath of payloadEntries) {
  await cp(path.join(repositoryRoot, relativePath), path.join(payloadRoot, relativePath), {
    recursive: true,
    force: true,
  });
}

await rename(
  path.join(payloadRoot, "profiles", "typescript-node", "template", ".gitignore"),
  path.join(payloadRoot, "profiles", "typescript-node", "template", "gitignore.template"),
);
