import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadBaselineConfig } from "./config.js";
import { checkSkills } from "./skills.js";

const releaseVersionPattern = /^0\.[0-9]+\.[0-9]+$/;
const gitCommitPattern = /^[a-f0-9]{40}$/;

export async function checkReleaseReadiness(root: string): Promise<void> {
  const config = await loadBaselineConfig(root);
  if (!releaseVersionPattern.test(config.baselineVersion)) {
    throw new Error("baselineVersion must be a 0.x semantic version.");
  }
  if (config.sourceRepository.startsWith("local:") || config.sourceRepository === "unreleased") {
    throw new Error("sourceRepository must identify the released private Git repository.");
  }
  if (!gitCommitPattern.test(config.sourceCommit)) {
    throw new Error("sourceCommit must be the full 40-character release commit SHA.");
  }

  const creatorPackage = JSON.parse(
    await readFile(path.join(root, "packages", "create-agent-scaffold", "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  if (
    creatorPackage.name !== "create-agent-scaffold" ||
    creatorPackage.version !== config.baselineVersion
  ) {
    throw new Error("Creator package version must equal the Baseline Release version.");
  }

  const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
  if (!changelog.includes(`## ${config.baselineVersion}`)) {
    throw new Error(`CHANGELOG.md must contain a ${config.baselineVersion} release section.`);
  }
  await checkSkills(root);
}
