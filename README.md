<p align="center">
  <img src="logo.png" alt="BugTraceAI" width="200"/>
</p>

<h1 align="center">BugTraceAI-WEB</h1>

<p align="center">
  AI-powered web vulnerability analysis suite & CLI control center
</p>

<p align="center">
  <a href="https://bugtraceai.com"><img src="https://img.shields.io/badge/Website-bugtraceai.com-blue?logo=google-chrome&logoColor=white" alt="Website"/></a>
  <a href="https://deepwiki.com/BugTraceAI/BugTraceAI-WEB"><img src="https://img.shields.io/badge/Wiki-Documentation-000?logo=wikipedia&logoColor=white" alt="Wiki"/></a>
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License"/>
  <img src="https://img.shields.io/badge/Version-0.3.3_Beta-orange" alt="Version"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Express_5-000?logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker"/>
</p>

---

| Product Demo (English) | Demostración del producto (Español) |
| :---: | :---: |
| [![English Demo](https://img.youtube.com/vi/exrqesNWp1M/0.jpg)](https://youtu.be/exrqesNWp1M) | [![Spanish Demo](https://img.youtube.com/vi/CwT66Uqe6to/0.jpg)](https://youtu.be/CwT66Uqe6to) |

---

## Table of Contents

- [Disclaimer](#disclaimer)
- [What is BugTraceAI-WEB?](#what-is-bugtraceai-web)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [CLI Integration](#cli-integration)
- [Tech Stack](#tech-stack)
- [License](#license)

## Disclaimer

This application is provided for **educational and authorized security testing purposes only**.

- AI output may contain inaccuracies, false positives, or false negatives
- It is **not** a substitute for professional security auditing
- Only test applications for which you have **explicit, written authorization**
- The creators assume no liability for misuse or damage

**Always verify findings manually.**

## What is BugTraceAI-WEB?

BugTraceAI-WEB is part of the [BugTraceAI](https://github.com/BugTraceAI/BugTraceAI) ecosystem. It serves two purposes:

1. **Standalone analysis toolkit** — 20+ AI-powered security tools for manual pentesting (SAST, DAST, recon, payload generation, exploitation assistants).
2. **CLI control center** — Real-time dashboard to launch, monitor, and review [BugTraceAI-CLI](https://github.com/BugTraceAI/BugTraceAI-CLI) autonomous scans from the browser.

Each role works independently. You can use the web tools without the CLI, or connect to a CLI instance for full scan management.

## Features

### CLI Control Center

When connected to BugTraceAI-CLI (optional):

- **Live Dashboard** — Real-time metrics, findings count, scan progress
- **Scan Launcher** — Configure and launch CLI scans from the browser
- **Report Viewer** — Browse, search, and view past scan reports (Markdown rendering)
- **Configuration Editor** — Modify CLI settings remotely
- **Severity Charts** — Visual breakdown of findings by severity
- **Report Comparison** — Side-by-side diff of two scan reports

### AI Assistants

- **WebSec Agent** — Expert chat for web security questions, techniques, mitigations
- **XSS Exploitation Assistant** — Given a confirmed XSS: cookie theft, keyloggers, phishing overlays, session hijacking
- **SQL Exploitation Assistant** — Given a confirmed SQLi: data extraction, auth bypass, privilege escalation, DB enumeration

### Analysis Tools

- **URL Analyzer (DAST)** — Recon scan, active scan, grey-box scan with live JS analysis
- **Code Analyzer (SAST)** — SQLi patterns, XSS sinks, insecure functions, logic flaws
- **Security Headers Analyzer** — CSP, HSTS, X-Frame-Options grading with actionable recommendations
- **DOM XSS Pathfinder** — Source-to-sink data flow analysis (location.hash → innerHTML, eval, document.write)
- **JWT Decompiler & Auditor** — Blue team (weak algorithms, data exposure) + Red team (confusion attacks, claim manipulation)
- **PrivEsc Pathfinder** — CVE and Exploit-DB search by technology/version, privilege escalation vectors
- **File Upload Auditor** — Automatic form detection, malicious file generation (SVG XSS, polyglots, web shells)

### Reconnaissance

- **JS Reconnaissance** — Hardcoded API endpoints, internal URLs, API keys, cloud credentials (AWS, GCP)
- **URL List Finder** — Wayback Machine historical URL discovery
- **Subdomain Finder** — Certificate Transparency search via crt.sh

### Payload Generation

- **Payload Forge** — WAF bypass payloads (encoding, case manipulation, null bytes, comment injection)
- **SSTI Forge** — Template injection for Jinja2, Twig, Freemarker, Velocity
- **OOB Interaction Helper** — Blind XSS callbacks, Log4Shell, DNS exfiltration, interact.sh integration

### Analysis Management

- Persistent storage of all analyses (PostgreSQL)
- Side-by-side report comparison with diff engine
- Export to JSON, CSV, and PDF
- Tagging and search across analyses

### AI Analysis Methodology

Each analysis runs through multiple AI passes with different perspectives (Bug Hunter, Code Auditor, Pentester, Security Researcher), then consolidates and de-duplicates findings into a single report. An optional deep analysis pass refines each finding with better PoCs, impact scenarios, and remediation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BugTraceAI-WEB                                             │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  React Frontend   │───▶│  Express Backend  │              │
│  │  (Vite + TS)      │    │  (Prisma ORM)     │              │
│  │  Port 5173 / 6869 │    │  Port 3001        │              │
│  └──────────────────┘    └────────┬─────────┘              │
│                                    │                        │
│                            ┌───────▼────────┐              │
│                            │  PostgreSQL 16  │              │
│                            │  Chats, Settings│              │
│                            │  Analyses       │              │
│                            └────────────────┘              │
└──────────────────────────────┬──────────────────────────────┘
                               │ Optional
                    ┌──────────▼──────────┐
                    │  BugTraceAI-CLI API  │
                    │  (FastAPI)           │
                    │  Port 8000           │
                    │  SQLite (scans)      │
                    └─────────────────────┘
```

**Dual database design:**
- **PostgreSQL** (WEB) — Local to each WEB instance. Stores chat sessions, analysis reports, and app settings.
- **SQLite** (CLI) — Source of truth for all scan data. Accessed via CLI API on port 8000.

They work **autonomously or together** — the WEB app doesn't need the CLI to function, and vice versa.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- An [OpenRouter](https://openrouter.ai/) API key (for AI-powered analysis tools)

### Installation (Docker)

**Interactive wizard (recommended):**
```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB
cd BugTraceAI-WEB
chmod +x install.sh
./install.sh
```

The wizard guides you through port selection, database configuration, and CLI backend URL.

**Quick start:**
```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB
cd BugTraceAI-WEB
chmod +x dockerizer.sh
./dockerizer.sh
```

Access at **http://localhost:6869**

### Post-install

1. Open **Settings** (gear icon in the header)
2. Enter your OpenRouter API key
3. Select a model (the app fetches available models from OpenRouter automatically)
4. Start analyzing

### Stop / Restart

```bash
docker-compose down          # Stop
docker-compose up -d         # Start again
docker-compose logs -f       # View logs
```

## Development Setup

For local development without Docker:

### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# Run database migrations
npx prisma migrate dev

# Start dev server (auto-reload)
npm run dev
```

Backend runs on **http://localhost:3001**.

### Frontend

```bash
# From the project root
npm install

# Configure environment
cp .env.example .env
# Default values work if backend is on port 3001

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:5173** with Vite proxy forwarding `/api` to the backend.

### Environment Variables

**Frontend** (`.env`):
```bash
VITE_API_URL=http://localhost:3001/api      # Backend API
VITE_CLI_API_URL=http://localhost:8000      # BugTraceAI-CLI API (optional)
```

**Backend** (`.env`):
```bash
DATABASE_URL="postgresql://bugtraceai:your_password@localhost:5432/bugtraceai_web?schema=public"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

## CLI Integration

Connecting to BugTraceAI-CLI unlocks the dashboard features (scan launcher, report viewer, config editor, etc.).

1. Start the CLI API server:
   ```bash
   cd BugTraceAI-CLI
   python3 -m uvicorn bugtrace.api.main:app --host 0.0.0.0 --port 8000
   ```

2. In BugTraceAI-WEB **Settings** → **CLI Connector**:
   - Enter CLI API URL (default: `http://localhost:8000`)
   - Enable the CLI Connector toggle

3. The CLI Dashboard tab becomes available automatically.

Multiple WEB instances can connect to the same CLI API server over the network.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 4 |
| Styling | Tailwind CSS |
| State | React Context + Custom Hooks |
| Charts | Recharts |
| Code Editor | Monaco Editor |
| Backend | Express 5, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Real-time | Socket.IO |
| Validation | Zod |
| AI Provider | OpenRouter (Gemini, Claude, GPT, DeepSeek, Mistral) |
| Testing | Vitest + Supertest |
| Deployment | Docker Compose, Nginx reverse proxy |

## Project Structure

```
BugTraceAI-WEB/
├── components/           # React components (70+)
│   ├── cli/              #   CLI dashboard (scan launcher, reports, config editor)
│   ├── analysis/         #   Analysis history, report viewer, comparison, export
│   └── ...               #   Tools: UrlAnalyzer, CodeAnalyzer, JwtAnalyzer, etc.
├── contexts/             # React Context providers (Chat, Analysis, Settings)
├── hooks/                # Custom hooks (13 files)
├── services/             # AI analysis service, CLI connector, system prompts
│   └── prompts/          #   Analysis-specific prompt templates
├── payloads/             # XSS payload wordlists
├── styles/               # Global CSS
├── utils/                # Utility functions
├── backend/              # Express + Prisma backend
│   ├── prisma/           #   Database schema & migrations
│   ├── src/
│   │   ├── controllers/  #   Chat, Analysis, Settings controllers
│   │   ├── routes/       #   API route definitions
│   │   ├── middleware/   #   Error handling, rate limiting, validation
│   │   └── utils/        #   Prisma client, exporters, comparison engine
│   └── tests/            #   Integration tests
├── App.tsx               # Main app (routing, providers)
├── docker-compose.yml    # 3-service stack (PostgreSQL, backend, frontend/nginx)
├── install.sh            # Interactive installation wizard
└── dockerizer.sh         # Quick Docker deploy script
```

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Made by Albert C. — <a href="https://x.com/yz9yt">@yz9yt</a>
  <br/>
  <a href="https://bugtraceai.com">bugtraceai.com</a>
</p>
