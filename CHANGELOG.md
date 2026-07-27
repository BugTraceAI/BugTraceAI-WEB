# Changelog

All notable changes to BugTraceAI-WEB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.40-beta] - 2026-07-24

### Added
- **Model Lab: calibrated suites, per-slot leaderboard and MUTATION diversity.** The benchmark UI now exposes the recalibrated `quick-v3` / `advanced-v2` suites (default `quick-v3`), a **"Best per slot"** panel that recommends a model per scanner slot (MUTATION / SKEPTICAL / ANALYSIS / REPORTING) instead of one global winner, and an opt-in **MUTATION probe** toggle that scores payload diversity at scan temperature and blends it into the MUTATION pick. The composite explainer now reflects the quality-dominant weights (correctness 40 / skepticism 30 / compliance 15 / performance 15) and the 6/10 correctness gate; default runs raised to 2.

## [1.5.39-beta] - 2026-07-24

### Fixed
- **SwarmGraph: specialist escalation ladders now climb live** - the per-agent L1→L6 ladder previously lit rungs only on confirmation, so an agent still working (e.g. XSS grinding many browser validations) sat frozen on a static "escalating" label while confirmed agents appeared to advance. The CLI already emits `exploit.<type>.level.started/completed` events (bridged to the WS) but the WEB ignored them. `useScanSocket` now tracks a live per-vuln-type escalation level (`agentLevels`), threaded through ScanDashboard → ScanConsole → SwarmGraph, which lights the ladder rungs up to the level the agent is currently on — so an in-progress agent visibly advances instead of looking hung. No CLI change.

## [1.5.38-beta] - 2026-07-23

### Fixed
- **Settings — reopening the modal could persist a wrong-provider model** - the model store is shared across providers, and on open the modal copied the stored model verbatim. If it belonged to a different provider (e.g. an OpenRouter `vendor/model` id while Anthropic is active), the picker showed the first option while state kept the stale id, so a blind Save persisted a model the provider can't serve. The model is now snapped to the active provider on open.

### Added
- **AIrepeater — "test" button for the auto-auth macro** - the login/forge macro was only exercised lazily on a real 401, so a wrong login body / token field / forge secret failed silently. A dry-run button now runs it immediately and reports ✓ (token acquired) or ✗ with a reason, before you rely on it to heal a 401.

---

## [1.5.37-beta] - 2026-07-23

### Fixed
- **Anthropic provider — output truncated at 4096 tokens** - the Anthropic wire adapter injected a hard `max_tokens: 4096` (the OpenAI path sends no cap), so large analysis/JSON replies were silently cut off. Raised the default to 8192 (supported across the modern Claude models this app targets); callers can still pass a larger value.
- **Anthropic provider — 400 on resume after an empty reply** - a model turn that returned no text and no tool calls was stored as an assistant message with empty content; Anthropic rejects empty text blocks, so the next request 400'd. Empty assistant turns are now dropped during the OpenAI→Anthropic history conversion (OpenAI tolerated them).
- **Anthropic provider — JSON mode was a no-op** - `jsonMode` only set `response_format` on the OpenAI path (Anthropic has no such field), making Anthropic materially more prone to prose-wrapped/fenced JSON. It now appends a strict "JSON only" system directive on the Anthropic path (client-side extraction still runs as a safety net).
- **Settings — switching the provider dropdown blocked Save for an already-validated key** - toggling the LLM Provider select unconditionally cleared the validated flag, so Save demanded a re-test even for a key that was already saved and working. It now keeps the validated state when the newly selected provider already has a stored key (both SettingsModal and ApiSettingsTab).

---

## [1.5.36-beta] - 2026-07-23

### Fixed
- **AIrepeater broken by default on non-OpenRouter providers** - the Repeater adopted the scanner's `MUTATION_MODEL` (an OpenRouter slug) as its default exploit model with no provider check, and reused a per-tab model across provider switches. With Anthropic/Z.ai active (and the CLI connected — the normal case) that slug was sent as the request `model` → 404. The exploit model is now provider-guarded at call time (kept only when servable by the active provider, else falls back to the provider-correct chat model), the `MUTATION_MODEL` default is only adopted on OpenRouter, and the dropdown no longer shows an unservable slug as selected.
- **Live findings feed showed "Unknown"** - specialists emit the vuln either flat or wrapped (`{ finding: {...} }` / `{ vulnerability: {...} }`); the WebSocket handler only read top-level fields, so wrapped findings logged as "Unknown" with blank type/param/url. It now reads the nested object when present and dedups by type+parameter+url so the vuln count stays honest.

### Added
- **Model Lab — "Test key" button** - validates the pasted OpenRouter key (via the CLI's new authenticated `/model-eval/test-key` proxy) before committing a full benchmark, with clear ✓/✗ feedback. Previously a typo'd/expired key passed the public catalog load and only failed per-model at generation time.

---

## [1.5.35-beta] - 2026-07-23

### Fixed
- **AIrepeater model list now matches the active provider** - the Repeater's exploit-model dropdown listed the OpenRouter curated pack regardless of provider, so with Anthropic (or Z.ai) selected you could pick a model that provider can't serve. It now offers the active provider's own models (OpenRouter → curated pack; Anthropic/Z.ai → that provider's models), matching how the chat model picker already behaves.
- **Swarm Graph — AuthDiscovery node stuck on "scanning"** - the graph looked for the log text `Auth discovery completed` but the CLI emits `Auth discovery complete` (one-word drift), so the auth node never reached its completed state (`N JWT · N cookie`). The matcher now accepts both.

---

## [1.5.34-beta] - 2026-07-23

### Fixed
- **Anthropic tool-calling (AIrepeater & chat)** - fixed `Unexpected role "tool"` from the Anthropic Messages API. The request-side history converter now rewrites OpenAI-shaped tool turns into Anthropic blocks (assistant `tool_calls` → `tool_use`, `role:'tool'` results → `tool_result` folded into a user turn, parallel results coalesced), so multi-step tool loops work on Claude. The OpenRouter/Z.ai path is unchanged.

### Added
- **Curated model pack** - the OpenRouter model picker now loads a hand-picked, verified set from `lib/curatedModels.ts` instead of the full ~340-model live catalog. Edit that one file to change the list.
- **Thinking control** - "Thinking/High/xHigh" entries send the same model with OpenRouter's `reasoning` parameter enabled. Chat honours it; the AIrepeater has its own independent, thinking-free model selector (now a curated dropdown) for a fast tool loop.
- **Model Lab as a sidebar module** - Model Lab moved out of the BugTraceAI tab into its own sidebar entry at `/modellab`. It runs with its **own** OpenRouter API key entered in the module (not the scanner provider config); the key is passed to the CLI per request.

---

## [1.5.33-beta] - 2026-07-23

### Added
- **Anthropic provider** - Anthropic (Claude Messages API) is now selectable as an LLM provider for the WEB, alongside OpenRouter and Z.ai. Enter an Anthropic API key (`sk-ant-...`), pick a Claude model, and Test/Save from Settings. Requests use the native Messages API wire format (`x-api-key`, system prompt, content blocks) with tool-calling normalized to the shared shape, so chat, analysis and the Repeater all work on Claude. Existing OpenRouter/Z.ai behaviour is unchanged.

---

## [1.5.27-beta] - 2026-07-21

### Fixed
- **AuthDiscovery visibility** - Events now show start, per-URL progress and result totals, while the Swarm Graph displays the live AuthDiscovery status.

---

## [1.5.26-beta] - 2026-07-21

### Changed
- **ModelLab controls** - replaced the difficulty dropdown with a Quick/Advanced switch and removed preset quick-add controls and technical header badges.

---

## [1.5.25-beta] - 2026-07-21

### Added
- **ModelLab history deletion** - each completed run has a trash action with an irreversible-action confirmation dialog.

---

## [1.5.24-beta] - 2026-07-21

### Changed
- **ModelLab navigation** - benchmark configuration/results and run history now use separate internal tabs.
- **ModelLab cleanup** - removed the misleading preset comparison card, preset badges, and redundant local-beta notice.

---

## [1.5.23-beta] - 2026-07-21

### Added
- **ModelLab beta** - integrated OpenRouter model comparison with quick and advanced suites, live WebSocket progress, cancellation, cost visibility, and local history through BugTraceAI-CLI.
- **AIrepeater** - multi-tab request workbench with manual and agent-driven modes, response search, per-vulnerability playbooks, and report handoff.
- **Live Swarm Graph** - real-time visualization of reconnaissance, strategy, specialist, validation, and reporting stages.

### Fixed
- **Reports and chat reliability** - report re-enrichment, structured detection rendering, first-message session creation, request timeout handling, and Repeater tab isolation.
- **ModelLab lifecycle** - terminal states, cancellation, polling fallback, partial results, and history rendering are handled explicitly.

### Security
- **Local beta deployment boundary** - WEB and CLI are intended for a local machine or trusted LAN. The CLI API must not be exposed directly to the Internet, and ModelLab provider calls may incur costs.

---

## [1.5.12-beta] - 2026-07-07

### Added
- **Settings → Chat tab** — the WebSec Agent chat is now configurable from the UI (no rebuild needed)
  - **Circuit Breaker (Max Tool Hops)**: numeric setting (default 15, range 1–50) controlling how many consecutive tool-call rounds the agent may chain before stopping. Persisted in `localStorage` (`chatMaxToolHops`) via `SettingsProvider` and wired into `useWebSecAgent`, replacing the previously hardcoded value

---

## [1.5.11-beta] - 2026-07-07

### Changed
- **WebSec Agent chat — circuit breaker raised 5 → 15 tool-hop rounds**, giving the agent room to chain more curl/tool iterations before the "Max tool execution depth reached" cut-off (`maxToolHops` default in `useWebSecAgent`)
- Version bumped to 1.5.11-beta

---

## [1.5.10-beta] - 2026-07-07

### Fixed
- **WebSec Agent chat — code interpretation & cURL launching**
  - Auto web-browsing no longer fetches URLs that live inside code blocks / inline code, so pasting a PoC, a curl command, or an endpoint no longer buries the actual code with the fetched page text (`extractUrls` now strips code spans first)
  - The agent now sees the REAL reason a cURL tool call failed (e.g. "Invalid URL format", "Only http/https URLs are allowed") instead of an opaque `HTTP 400`, so it can self-correct instead of retrying blindly
  - cURL bodies now use `--data-raw` (not `-d`): a body starting with `@` or `<` is sent verbatim instead of curl reading it as a local file
  - Tool-execution narration ("> Executing …") no longer breaks an unclosed markdown code fence, so code stays rendered as code (fence-safe append)
  - Circuit-breaker message no longer appears after a normal final answer
  - Chat history dedup compares only the last persisted message, so a legitimately repeated answer is no longer silently dropped

### Changed
- Version bumped to 1.5.10-beta

---

## [1.0.2-beta] - 2026-06-18

### Fixed
- **API Discovery — uniform non-2xx response noise**
  - Rate-limit (HTTP 429) storms and blanket 401/403 auth walls that only appear under load (and so are missed by the pre-scan baseline) are now detected and filtered from results, with a clear warning ("Rate-limited" / "Authentication required") instead of thousands of false positives
  - Per-(status, length) sample cap during collection bounds memory under a flood while still counting every response for the warning
  - Results table warning banner now surfaces rate-limit and auth-required cases, not just SPA catch-alls

### Changed
- Version bumped to 1.0.2-beta

---

## [1.0.1-beta] - 2026-06-18

### Fixed
- **API Discovery (Kiterunner) scanner accuracy**
  - Baseline probe now uses GET instead of HEAD so status/length match what `kr` actually requests — fixes SPA catch-all detection and `--ignore-length` calibration
  - Normalize the target's trailing slash so wordlist paths no longer produce double slashes (`host/base//path`)
  - Per-prefix catch-all detection: probe a random path under each busy wordlist prefix (and common API prefixes for kite scans) so APIs that answer a uniform 200 for every `/api/*` path no longer flood results with false positives
  - Relabel `kr` output columns to `[length, words, lines]` — the first value is the response size in BYTES; the results "Size" column now shows the real byte size
- **API Discovery concurrency & resilience**
  - `start_scan` serializes check-and-create with a lock and counts `pending` scans as active, preventing two concurrent requests from spawning two scans
  - Frontend `startScan` guards rapid double-clicks synchronously; `stopScan` always persists the stopped scan; polling surfaces an error after sustained failures instead of hanging on "Scanning…"
  - Cap the in-memory scan store to avoid unbounded growth
  - Backend validates each persisted route (string method/url, numeric status)
  - Catch-all warning no longer claims "0 routes found" when real routes were kept

### Changed
- Version bumped to 1.0.1-beta

---

## [0.8.6.1-beta] - 2026-06-15

### Added
- **Improved CLI Configuration Tab** - Better organization and usability for CLI settings
  - Enhanced layout for managing specialist agent configuration
  - Real-time validation of configuration values

### Changed
- Version bumped to 0.8.6.1-beta to match latest improvements
- Updated package dependencies for improved stability

### Fixed
- CLI integration stability improvements
- Configuration tab rendering and state management

---

## [0.8.6-beta] - 2026-06-08

### Added
- **Web Browsing Toggle** - WebSec Agent can now toggle web browsing capability
  - Allows agents to browse web content for context when investigating web-based vulnerabilities
  - Togglable per-scan configuration
- **YAML-based Authentication** - Support for YAML-formatted auth configurations
  - Cleaner syntax for managing authentication credentials
  - Environment variable substitution support
- **TOTP Support** - Time-based One-Time Password integration
  - Full TOTP support for 2FA-protected applications
  - Seamless integration with authentication flows
- **Aggressive System Prompt Profile** - Optional aggressive vulnerability detection profile
  - More thorough exploitation attempts
  - Ideal for comprehensive security audits
- **Installation Documentation** - Complete INSTALLATION.md with 4 installation methods
  - Docker Compose deployment
  - Kubernetes deployment
  - Manual setup
  - Development environment setup

### Changed
- **Version Badge Updated** - Now shows v0.8.6.1-beta in all UI references
- System prompt architecture improved with configurable profiles
- README updated with new authentication and web browsing features

### Removed
- Aggressive system prompt profile removed from public release (kept in DEV)
- Internal development documentation files

### Fixed
- Web browsing toggle now correctly persists across sessions
- Authentication flow improved for YAML-based configs
- System prompt selection now properly applies to running agents

---

## [0.8.5-beta] - 2026-05-28

### Added
- **Download Scan Results** - New zip download functionality for scan reports
  - Summary modal with glowing animation on first load
  - "Don't show again" checkbox to skip modal on subsequent downloads
  - Heartbeat animation on download button for user attention
  - Support for exporting multiple formats in single zip

### Changed
- Report download modal redesigned as minimalist summary
- Download button moved to header for better visibility
- Download button now features pulsing animation on mount when modal is disabled

### Fixed
- Modal properly closes and dismisses based on user preferences
- Animation performance optimized for better UX
- Zip file generation improved for large reports

---

## [0.8.3-beta] - 2026-05-15

### Added
- **Concurrent Scan Prevention** - Block new scans if a session is already running
  - Prevents resource conflicts and improves reliability
  - Clear user messaging when scan is in progress

### Changed
- Version bumped to 0.8.3-beta for stability improvements

### Fixed
- Session management improved to prevent concurrent scan conflicts

---

## [0.8.2-beta] - 2026-05-10

### Added
- **API Discovery v0.2** - Enhanced API endpoint discovery and analysis
  - Multi-filter support for endpoint categorization
  - Sorting capabilities by vulnerability type, endpoint, discovery method
  - Scan history breakdown showing API distribution over time
  - Tag-based organization of discovered APIs

### Changed
- API Discovery component UI redesigned for better usability
- Backend now persists API discovery data to PostgreSQL

### Fixed
- Kiterunner hook integration improved
- Nginx configuration updated for proper API routing

---

## [0.8.0-beta] - 2026-04-20

### Added
- **API Discovery Initial Release** - Kiterunner-powered API endpoint discovery
  - Automatic API detection using pattern matching
  - Speed selector for discovery operations (fast, balanced, thorough)
  - Manual control over discovery scope and methods
  - Backend persistence of discovered APIs
  - Real-time discovery progress tracking

### Changed
- Application architecture extended to support API discovery as first-class feature
- Backend database schema extended for API metadata storage

### Fixed
- Prisma schema compatibility fixed (pinned to v5, avoiding v7 breaking changes)
- DATABASE_URL handling in Docker builds improved
- Docker build process now includes dummy DATABASE_URL for schema generation

---

## [0.7.0-beta] - 2026-03-15

### Added
- **Report Export Formats** - Multiple report export options
  - JSON (structured data)
  - Markdown (human-readable)
  - CSV (compatibility with analysis tools)
- **Report Markdown Viewer** - Beautiful markdown rendering for scan reports
  - Syntax highlighting for code snippets
  - Responsive layout for all screen sizes

### Changed
- Report generation pipeline improved for consistency
- Report viewer component architecture refactored

### Fixed
- Markdown rendering now properly handles code blocks and special characters
- Import statements corrected in ReportMarkdownViewer component

---

## [0.6.0-beta] - 2026-02-20

### Added
- **Real-time Scan Progress** - WebSocket-based live updates during scans
  - Phase progression tracking (Reconnaissance → Discovery → Strategy → Exploitation → Validation → Reporting)
  - Real-time vulnerability finding notifications
- **Scan Configuration UI** - User interface for customizing scan parameters
  - Target URL configuration
  - Specialist agent selection
  - Timeout and concurrency settings
  - False positive threshold adjustment
- **System Prompt Management** - Support for different analysis profiles
  - Standard profile for general vulnerability detection
  - Performance profile for faster scans
  - Comprehensive profile for thorough analysis

### Changed
- Frontend architecture refactored for WebSocket integration
- API client improved for real-time communication

### Fixed
- WebSocket connection stability improved
- Scan progress tracking race conditions resolved

---

## [0.5.0-beta] - 2026-02-01

### Added
- **Initial BugTraceAI-WEB Release** - Web UI for BugTraceAI platform
  - Dashboard with scan history and statistics
  - Scan creation and management interface
  - Real-time scan monitoring
  - Report generation and viewing
  - Integration with BugTraceAI-CLI backend
