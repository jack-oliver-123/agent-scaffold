# Use AGENTS.md as the shared instruction source

The repository-root `AGENTS.md` will contain the Shared Agent Instructions, while vendor-specific entry points remain thin Agent Adapters. In particular, `CLAUDE.md` will import `AGENTS.md` and add only Claude-specific guidance, preventing shared rules from drifting across duplicated instruction files.
