# Third-party notices for `api-routes-mcp`

The Python wrapper and configuration in this directory are BugTraceAI-owned
code and are licensed under the Apache License, Version 2.0, subject to the
third-party components listed below.

## Kiterunner

The Dockerfile downloads Kiterunner (`kr`) version 1.0.2 from the Assetnote
release archive at build time. Kiterunner is a separate upstream project and
is distributed under AGPL-3.0. Its source, license text and corresponding
source obligations are governed by the upstream release, not by this file.
When distributing an image that contains `kr`, retain the upstream notices and
provide the corresponding source as required by AGPL-3.0.

## ffuf and wordlists

The Dockerfile also downloads ffuf and API wordlists from their upstream
projects. The exact release, digest and license text must be recorded in the
release SBOM before publishing an image. These downloads are not relicensed by
the Apache-2.0 license of the BugTraceAI wrapper.
