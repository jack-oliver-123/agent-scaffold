# Project Instructions

## Completion

- Keep changes scoped to the requested behavior.
- Run `corepack pnpm check` after changing code, tests, dependencies, or project configuration.
- Report checks that could not run and the reason.

## Project Knowledge

- Put human setup and usage in `README.md`.
- Create `CONTEXT.md` only when the first project-specific term is resolved; keep it a glossary without implementation details.
- Create `docs/adr/` only for decisions that are costly to reverse, surprising without context, and based on a real trade-off.
- Keep tasks, plans, and acceptance criteria in GitHub Issues or Pull Requests rather than parallel repository archives.

## Safety

- Preserve user changes and a dirty worktree.
- Read or edit secret-bearing `.env` files only after explicit user authorization; `.env.example` is documentation.
- Require explicit authorization for commits, pushes, Pull Requests, releases, deployments, credentials, and destructive external actions.
- Use declared project dependencies and keep generated artifacts reproducible from checked-in configuration.
