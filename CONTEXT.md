# Agent Development Baseline

This context defines the shared language for a reusable foundation that helps coding agents start and develop greenfield software projects consistently.

## Language

**Agent Development Baseline**:
A reusable project foundation that gives coding agents consistent context, constraints, workflows, and completion criteria.
_Avoid_: Coding Agent scaffold, starter kit, boilerplate

**Core Baseline**:
The agent-neutral and technology-neutral part of the Agent Development Baseline shared by every Derived Project.
_Avoid_: Common template, base layer

**Agent Adapter**:
An agent-specific expression of the Core Baseline that lets a supported coding agent discover and follow the shared rules.
_Avoid_: Agent configuration, provider rules

**Stack Profile**:
An optional set of conventions and quality expectations for a particular technology stack.
_Avoid_: Project template, preset

**Derived Project**:
A greenfield software project created from the Agent Development Baseline.
_Avoid_: Generated project, child project, scaffolded project

**Default Skill Set**:
The curated set of stable, broadly useful Agent Skills included in every Derived Project.
_Avoid_: Skill bundle, all skills, built-in skills

**Quality Contract**:
The minimum set of checks that every Stack Profile must expose through one consistent project command.
_Avoid_: Quality gate, CI checks, validation script

**Baseline Upgrade**:
An explicit, versioned migration that applies selected changes from a newer Agent Development Baseline to an existing Derived Project.
_Avoid_: Template sync, automatic update, refresh

**Shared Agent Instructions**:
The canonical project guidance that applies to every supported coding agent regardless of vendor.
_Avoid_: System prompt, Claude instructions, Codex rules

**Baseline Initialization**:
The one-time customization of a newly created Derived Project's identity, metadata, and recorded baseline version.
_Avoid_: Code generation, scaffolding, installation

**Skill Manifest**:
The canonical declaration of selected Agent Skills and the Agent Adapters to which each skill applies.
_Avoid_: Skill list, skills lockfile, plugin registry

**Skill Projection**:
A generated, agent-discoverable copy of a Skill Manifest entry placed in an Agent Adapter's native directory.
_Avoid_: Skill source, duplicated skill, vendored skill

**Baseline Provenance**:
The retained identity and version of the Agent Development Baseline from which a Derived Project was initialized.
_Avoid_: Template version, generator version, origin

**Upstream Skill**:
An Agent Skill imported unchanged from an external source and pinned by content hash.
_Avoid_: Third-party workflow, vendored skill

**Baseline-owned Skill**:
An Agent Skill authored and maintained as part of the Agent Development Baseline, including portable replacements for incompatible upstream workflows.
_Avoid_: Custom skill, patched upstream skill

**Baseline Toolchain**:
The development tools used to initialize, synchronize, validate, and release the Agent Development Baseline independently of a Derived Project's application technology.
_Avoid_: Stack Profile, project toolchain, generator CLI

**Baseline Release**:
An immutable, versioned publication of the Agent Development Baseline with enough provenance and migration guidance for a Derived Project to evaluate an upgrade.
_Avoid_: Template update, latest baseline, release branch

**Agent Canary**:
A credential-isolated verification that a real supported coding agent discovers the intended instructions, configuration, and Skills.
_Avoid_: Integration test, prompt eval, smoke test

**Baseline Lock**:
The checked-in, machine-readable Baseline Provenance of a Derived Project, including its selected Stack Profile and Default Skill Set identity.
_Avoid_: Skills lockfile, version file, initialization record

**Migration Guide**:
A version-specific, reviewable procedure for applying a Baseline Upgrade, with optional mechanical scripts when they reduce repeat work without hiding changes.
_Avoid_: Upgrade command, release notes, template diff
