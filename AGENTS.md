# Baseline Source Instructions

This repository authors the Agent Development Baseline. Run `corepack pnpm check` after changing baseline tooling, profiles, Agent Adapters, or Skills.

## Ownership

- Shared vocabulary belongs in `CONTEXT.md`; keep it free of implementation details.
- Durable trade-offs belong in `docs/adr/` only when changing the decision later would be costly.
- Derived-project files belong under `profiles/<profile>/template/`; source-only tooling belongs under `.baseline/`.
- `baseline.config.json` selects Skills. Treat `.claude/skills/` and selected `.agents/skills/` entries as generated projections.
- Before a release, pin real source provenance, update `CHANGELOG.md`, and run `corepack pnpm baseline:release:check`.

## Safety

- Preserve a dirty worktree and changes you did not make.
- Run initialization tests in temporary Git repositories.
- Require explicit user authorization for commits, pushes, releases, deployments, credentials, or destructive external actions.
- Keep credentials and machine-specific paths out of checked-in files.
