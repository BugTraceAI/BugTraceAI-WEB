# Changelog

All notable changes to BugTraceAI-WEB will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

