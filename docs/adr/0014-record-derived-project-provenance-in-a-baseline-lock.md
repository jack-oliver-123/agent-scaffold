# Record derived project provenance in a baseline lock

Each Derived Project will commit a `baseline.lock.json` containing the baseline schema and version, source repository and commit, selected Stack Profile, and Default Skill Set identity. The file will omit timestamps, machine paths, and user identity so equivalent initialization inputs remain reproducible.
