# Publish self-contained Project Creator releases

The private baseline-authoring root will contain a separate public `create-agent-scaffold` workspace package whose version exactly matches its embedded Creator Payload. Creation will not clone or download the private source repository; the resulting Baseline Lock will record the creator package, version, source commit, and Selected Agent Set so each Derived Project has reproducible provenance.
