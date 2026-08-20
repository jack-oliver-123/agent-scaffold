# Publish npm releases from reviewed tags

Only a reviewed `v*` Git tag may publish `create-agent-scaffold`, using npm Trusted Publishing from GitHub Actions rather than a long-lived npm token. The workflow must test the actual package tarball on Ubuntu and Windows across supported Agent selections and rollback paths before publishing.
