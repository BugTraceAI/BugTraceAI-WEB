# Bedrock in the CLI Provider panel

The WEB/CLI Provider panel supports the CLI's Bedrock beta provider. It loads
the configured source region, allows region-only changes and supports connection
testing with an AWS role/profile when no Bedrock API key is entered. Changing
the key or region invalidates the previous connection-test result.

Credentials and calls belong to the CLI runtime. A blank region clears its
BugTraceAI region override. AWS roles/profiles must be available to that runtime,
including its container when applicable.

See the [CLI Bedrock setup and account-validation guide](https://github.com/BugTraceAI/BugTraceAI-CLI/blob/main/BEDROCK.md).
Real AWS validation remains pending. This panel does not add Bedrock to the
separate API-target engine, WEB assistant or ModelLab.

Thanks to [@sjimnar](https://github.com/sjimnar) for
[WEB #2](https://github.com/BugTraceAI/BugTraceAI-WEB/pull/2) and the coordinated
CLI contribution.
