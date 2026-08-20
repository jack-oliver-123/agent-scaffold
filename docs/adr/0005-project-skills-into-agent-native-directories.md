# Project skills into agent-native directories

The Skill Manifest and `skills-lock.json` will be the sources of truth for selected and resolved Agent Skills, while a synchronization command materializes checked-in Skill Projections under each Agent Adapter's native discovery directory. CI will reject stale projections, avoiding both Windows-dependent symlinks and manually maintained copies.
