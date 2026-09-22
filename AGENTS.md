# BugTraceAI Web Development Guidance

## Source of truth and deployment

- The local `BugTraceAI-WEB` working tree is the source of truth.
- Make and test every change locally first. Never edit files inside a running Docker container or pod; container files are disposable build output.
- Keep the local tree and `/home/lubuntu/btai-deploy/BugTraceAI-WEB` synchronized before rebuilding the deployment.
- After local verification, rebuild and recreate the frontend container, then verify the live UI at `http://192.168.2.190:6869`.
- If a pod is replaced or crashes, recover by redeploying from the local tree, not by reconstructing changes from the container.

## Versioning and project references

- Every web change increments the web version and keeps the release in beta (`VERSION`, `package.json`, and the root package-lock metadata must agree).
- Use `BugTraceAI-CLI-refactor` as the CLI reference implementation when matching behavior or presentation.
- Keep user-facing documentation and UI copy in English.

## Standard change flow

1. Edit the local source.
2. Run the relevant tests and `npm run build`.
3. Increment the beta version.
4. Synchronize the changed files to the deployment checkout.
5. Run `docker compose build frontend` and recreate the frontend container.
6. Verify the live behavior after a reload and report the local/deployed result.
