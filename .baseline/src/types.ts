export type AgentName = "codex" | "claude";

export interface UpstreamSkillSource {
  kind: "upstream";
  path: string;
  license: string;
  licenseUrl: string;
}

export interface LocalSkillSource {
  kind: "baseline-owned" | "agent-specific";
  path: string;
}

export interface SkillDefinition {
  name: string;
  source: UpstreamSkillSource | LocalSkillSource;
  agents: AgentName[];
}

export interface BaselineConfig {
  schemaVersion: 1;
  baselineVersion: string;
  defaultProfile: string;
  sourceRepository: string;
  sourceCommit: string;
  skills: SkillDefinition[];
}

export interface ProfileConfig {
  schemaVersion: 1;
  name: string;
  description: string;
  templateDirectory: string;
}

export interface SkillLockEntry {
  source: string;
  sourceType: string;
  skillPath?: string;
  computedHash: string;
}

export interface SkillsLock {
  version: number;
  skills: Record<string, SkillLockEntry>;
}

export interface SkillIntegrityEntry {
  contentHash: string;
  sourceKind: SkillDefinition["source"]["kind"];
  upstreamComputedHash?: string;
}

export interface SkillIntegrityLock {
  schemaVersion: 1;
  skills: Record<string, SkillIntegrityEntry>;
}

export interface InitAnswers {
  projectName: string;
  packageName: string;
  description: string;
  profile: string;
}
