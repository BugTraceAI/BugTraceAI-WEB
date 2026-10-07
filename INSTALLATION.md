# 🚀 Installation Guide — BugTraceAI-WEB

> **TL;DR**: The fastest way to deploy BugTraceAI-WEB is via the [BugTraceAI Launcher](https://github.com/BugTraceAI/BugTraceAI-Launcher), which handles everything automatically. See [Option 1](#option-1-bugtraceai-launcher-recommended) below.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option 1: BugTraceAI Launcher (Recommended)](#option-1-bugtraceai-launcher-recommended)
- [Option 2: Standalone Docker](#option-2-standalone-docker)
- [Option 3: Manual Docker Compose](#option-3-manual-docker-compose)
- [Option 4: Local Development Setup](#option-4-local-development-setup)
- [Post-Installation](#post-installation)
- [Authenticated Scanning (YAML + TOTP)](#authenticated-scanning-yaml--totp)
- [CLI Integration](#cli-integration)
- [Troubleshooting](#troubleshooting)
- [Uninstalling](#uninstalling)

---

## Prerequisites

| Requirement | Option 1–3 (Docker) | Option 4 (Local Dev) |
|---|---|---|
| **Docker** | Launcher prepares it; direct setup requires it | ❌ Not needed for WEB itself |
| **Docker Compose v2** | Launcher prepares it; direct setup requires it | ❌ Not needed for WEB itself |
| **Node.js** 18+ | ❌ Not needed | ✅ Required |
| **npm** | ❌ Not needed | ✅ Required |
| **Git** | ✅ Required | ✅ Required |
| **Provider key** | Configure locally for AI analysis | Configure locally for AI analysis |
| **RAM** | 2 GB minimum | 1 GB minimum |
| **Disk** | 3 GB free | 500 MB free |

Get an OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys) — it starts with `sk-or-`.

> **LLM provider choice (1.5.33+):** OpenRouter is the default, but the scanner/chat LLM provider can also be **Anthropic** (an `sk-ant-...` key using the Claude Messages API via `x-api-key`) or **Z.ai** (GLM family) — you only need a key for the provider you pick. The separate **Model Lab** benchmark module uses its **own** OpenRouter key, entered inside the module and independent of the scanner provider.

---

## Option 1: BugTraceAI Launcher (Recommended)

The universal Launcher lets you select **WEB**, **CLI**, and **BugTraceAI-API**
independently. The `web` suggestion starts with WEB only; add either scanning
engine when needed. The `full` suggestion preselects all three modules and the
CLI terminal TUI. For WEB-only installation, use Wizard. See the
[Launcher guide](https://github.com/BugTraceAI/BugTraceAI-Launcher#quick-start)
for module choices, runtimes, and AI-assisted installation.

### One-liner install

```bash
curl -fsSL https://raw.githubusercontent.com/BugTraceAI/BugTraceAI-Launcher/main/install.sh | bash
```

Or clone and run manually:

```bash
git clone https://github.com/BugTraceAI/BugTraceAI-Launcher.git ~/bugtraceai-launcher
cd ~/bugtraceai-launcher
./launcher.sh
```

The Launcher TUI will:

1. Collect and verify provider credentials in the local terminal
2. Offer Wizard or the built-in AI-assisted setup
3. Review module selection and runtime (WEB and BugTraceAI-API require Docker)
4. Configure ports and optional reconFTW/Kali toolboxes before confirming the plan
5. Deploy the selected services and run health checks

After installation, use the dashboard URL printed by the Launcher (normally
**http://localhost:6869**).

Enter provider credentials through the Launcher's local setup flow. The WEB
application's provider settings can be configured or updated after deployment;
installation itself does not run a scan.

> See [BugTraceAI-Launcher](https://github.com/BugTraceAI/BugTraceAI-Launcher) for supported runtimes and platform-specific requirements.

### Install with your AI coding agent

Give this prompt to an agent with terminal access. It installs standalone WEB
only. For guided deployment with connected scanning engines, use the universal
Launcher and review the module selection instead.

```text
Install BugTraceAI-WEB as a standalone Docker deployment from this checkout.

Read INSTALLATION.md, README.md and the Compose configuration first. Preserve
existing files and local configuration. Configure .env.docker from .env.example
and use ./scripts/install-runtime.sh after verifying its documented requirements;
do not silently add BugTraceAI-CLI or BugTraceAI-API. Keep the generated
database password in local configuration and enter provider keys only through
the documented local setup flow or application settings, never in chat output
or command logs. If a port is occupied, select an available port and record it.

Build and start WEB, then verify the frontend and backend health checks and
open the local dashboard. Do not launch a scan or send traffic to a target as
part of installation. If Docker, Compose or provider configuration is missing,
report the precise blocker and next step without installing unrelated tools.

Finish with the installation directory, local dashboard URL and checks run.
Do not print secret values.
```

---

## Option 2: Standalone Docker

Bare `./install.sh` opens the universal Launcher with `web` suggested. The
explicit runtime backend below deploys only this WEB checkout. It requires
Docker Compose v2 and curl, and does not install scanning engines or toolboxes.

```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB.git
cd BugTraceAI-WEB
cp .env.example .env.docker
chmod 600 .env.docker
# Edit .env.docker: set a unique POSTGRES_PASSWORD and available ports.
./scripts/install-runtime.sh
```

The installer keeps the existing file and database volumes, validates Compose,
waits for the selected services and checks the frontend health route before
reporting readiness. It never prints the database password. The backend listens
on port 3001 inside Docker; the frontend exposes it through `/api` and `/health`.
Standalone WEB starts without CLI or API-target backends; their scan routes
require connecting the corresponding services separately.

After the wizard completes:

```bash
# Check services are running
docker compose --env-file .env.docker ps

# Open the dashboard URL printed by the installer (default localhost:6869).
```

---

## Option 3: Manual Docker Compose

For environments where you want full control over the configuration.

### Step 1: Clone and configure

```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB.git
cd BugTraceAI-WEB
cp .env.example .env.docker
```

### Step 2: Edit `.env.docker`

```bash
# Required
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_USER=bugtraceai
POSTGRES_DB=bugtraceai_web

# Ports
FRONTEND_PORT=6869
BACKEND_PORT=3001

# Optional: connect to BugTraceAI-CLI
VITE_CLI_API_URL=/cli-api
VITE_BTAI_API_URL=/btai-api
CLI_API_PORT=8000
BTAI_API_PORT=8005
```

### Step 3: Start services

```bash
docker compose --env-file .env.docker up --build -d --wait
```

### Step 4: Verify

```bash
# Core services: postgres, backend, frontend and api-routes
docker compose --env-file .env.docker ps

# Health check
curl -fsS http://localhost:6869/health
```

### Managing the stack

```bash
docker compose --env-file .env.docker down              # Stop; keep volumes
docker compose --env-file .env.docker up -d             # Start
docker compose --env-file .env.docker logs -f           # Tail logs
docker compose --env-file .env.docker logs frontend     # Frontend logs
docker compose --env-file .env.docker logs backend      # Backend logs
docker compose --env-file .env.docker restart backend   # Restart a service
```

---

## Option 4: Local Development Setup

For contributors and developers who want to work on the source code.

### Backend

```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB.git
cd BugTraceAI-WEB/backend

# Install dependencies
npm install

# Create backend/.env with DATABASE_URL pointing to your local PostgreSQL.
# Preserve an existing file and credentials.

# Run database migrations
npx prisma migrate dev

# Start backend dev server (auto-reload)
npm run dev
```

Backend runs on **http://localhost:3001**

You need a PostgreSQL instance running locally. Quick setup with Docker:

```bash
docker run -d --name bugtraceai-db \
  -e POSTGRES_USER=bugtraceai \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=bugtraceai_web \
  -p 5432:5432 \
  postgres:16
```

Then in `backend/.env`:
```bash
DATABASE_URL="postgresql://bugtraceai:devpassword@localhost:5432/bugtraceai_web?schema=public"
```

### Frontend

```bash
# From the project root
npm install

# Configure environment (defaults work if backend is on port 3001)
cp .env.example .env

# Start Vite dev server
npm run dev
```

Frontend runs on **http://localhost:5173** — Vite proxies `/api` → backend on `3001`.

### Environment Variables

**Frontend** (`.env`):
```bash
VITE_API_URL=/api              # Backend proxy
VITE_CLI_API_URL=              # BugTraceAI-CLI URL (optional)
```

**Backend** (`backend/.env`):
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/bugtraceai_web?schema=public"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

---

## Post-Installation

After any installation method:

1. Open the dashboard (default: **http://localhost:6869**)
2. Click the **Settings** icon (gear ⚙️ in the header)
3. Enter your **OpenRouter API key** (`sk-or-...`)
4. Select your preferred **AI model** (the app fetches available models automatically)
5. Click **Save** — you're ready to start analyzing

> **Provider selection:** the **AI Provider** dropdown in Settings supports OpenRouter (`sk-or-...`), Anthropic (`sk-ant-...`, Claude Messages API), and Z.ai (GLM family). Pick one and enter that provider's key. **Model Lab** (`/modellab`) has its own separate OpenRouter key entered inside the module, independent of the provider you configure here.

---

## Authenticated Scanning (YAML + TOTP)

BugTraceAI-WEB supports **authenticated CLI scans** for login-protected targets. You configure the authentication once in a YAML file, and the scanner handles the rest — including TOTP token generation for 2FA-protected apps.

### Create your auth config

```yaml
authentication:
  login_url: "/login"
  login_type: form
  credentials:
    username: "user@example.com"
    password: "your-password"
    # totp_secret: "YOUR_BASE32_SECRET"
  login_flow:
    - "Type $username into the email field"
    - "Type $password into the password field"
    - "Click the 'Sign In' button"
    # - "Enter $totp in the code field"
  success_condition:
    type: url_contains
    value: "/dashboard"
```

### Use it from the WEB dashboard

1. Go to the **CLI Dashboard** tab → **Scan Launcher**
2. Open the **Auth Config** section
3. Upload your `auth_config.yaml`
4. Launch the scan as usual

The scanner will:
- Navigate to `login_url`
- Fill credentials automatically
- Generate a real-time TOTP token (if `totp_secret` is set)
- Confirm login via `success_condition`
- Reuse the authenticated session across all 6 scan phases

Use the [CLI authentication reference](https://github.com/BugTraceAI/BugTraceAI-CLI/blob/main/INSTALLATION.md#target-authentication)
for the shared YAML format and optional TOTP setup.

---

## CLI Integration

Connecting BugTraceAI-WEB to a running [BugTraceAI-CLI](https://github.com/BugTraceAI/BugTraceAI-CLI) instance unlocks the full dashboard: scan launcher, real-time progress, report viewer, configuration editor, and API Discovery.

### If you used the Launcher (Option 1)
The WEB is already connected to the CLI automatically. Nothing to do.

### If you deployed WEB standalone (Options 2–4)

1. Start BugTraceAI-CLI separately:
   ```bash
   cd BugTraceAI-CLI
   ./scripts/install-runtime.sh --interface api --runtime docker --global no --launch no
   # Use the API URL printed by the CLI installer.
   ```

2. In BugTraceAI-WEB, go to **Settings** → **CLI Connector**
3. Enter the CLI API URL: `http://localhost:8000`
4. Toggle **Enable CLI Connector**
5. The **CLI Dashboard** tab will appear automatically

> Multiple WEB instances can connect to the same CLI API over the network.

---

## Troubleshooting

### Services not starting

```bash
# Check container status
docker compose --env-file .env.docker ps

# View all logs
docker compose --env-file .env.docker logs

# View specific service logs
docker compose --env-file .env.docker logs backend
docker compose --env-file .env.docker logs frontend
docker compose --env-file .env.docker logs postgres
```

### Port already in use

The universal Launcher detects available ports. For manual Docker deployments,
edit `.env.docker` before starting; the direct backend uses those configured values:

```bash
# Find what's using port 6869
sudo lsof -i :6869
# Change the port in your .env.docker and restart
```

### Database connection errors

```bash
# Check PostgreSQL container is running
docker compose --env-file .env.docker ps postgres

# Check connection from backend container
docker compose --env-file .env.docker exec backend sh -c "npx prisma db pull"
```

Check that `.env.docker` contains the credentials used when the database volume
was created. Changing environment variables does not change an existing
PostgreSQL user's password. Restore the matching configuration or update that
user deliberately; reinstalling does not require deleting the database volume.

### Prisma migration errors

```bash
# Apply pending migrations
docker compose --env-file .env.docker exec backend npx prisma migrate deploy
```

### API key not working

- Verify the key starts with `sk-or-` at [openrouter.ai/keys](https://openrouter.ai/keys)
- Check Settings → API Key is saved (the field should show `sk-or-***...`)
- Try a different model — some models require billing credits

### CLI not connecting

- Confirm the CLI API is running: `curl http://localhost:8000/health`
- Check CORS: the CLI must have `BUGTRACE_CORS_ORIGINS` set to include the WEB URL
- If using the Launcher, both were auto-configured — run `./launcher.sh status` to verify

### Permission errors (Linux)

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

---

## Uninstalling

### If installed via Launcher

```bash
~/bugtraceai-launcher/launcher.sh uninstall
```

This stops all containers, removes Docker volumes (including the database), and deletes the `~/bugtraceai/` directory.

### If installed standalone (Options 2–3)

```bash
cd BugTraceAI-WEB

# Stop and remove containers + volumes (deletes database)
docker compose --env-file .env.docker down -v

# Remove cloned repo
cd ..
rm -rf BugTraceAI-WEB
```

### If installed via local dev (Option 4)

```bash
# Stop dev servers (Ctrl+C in each terminal)

# Drop the local database
docker rm -f bugtraceai-db  # if you used the Docker PostgreSQL above
# Or connect to your PostgreSQL and: DROP DATABASE bugtraceai_web;

# Remove the repo
rm -rf BugTraceAI-WEB
```

---

## Need Help?

| Resource | Link |
|---|---|
| 📖 **Wiki** | [deepwiki.com/BugTraceAI/BugTraceAI-WEB](https://deepwiki.com/BugTraceAI/BugTraceAI-WEB) |
| 🌐 **Website** | [bugtraceai.com](https://bugtraceai.com) |
| 🐛 **Issues** | [GitHub Issues](https://github.com/BugTraceAI/BugTraceAI-WEB/issues) |
| 💬 **Contact** | [@yz9yt](https://x.com/yz9yt) |

---

<p align="center">Made with ❤️ by Albert C. — <a href="https://x.com/yz9yt">@yz9yt</a></p>

## Updates and compatible versions

For Launcher-managed installations, use Launcher 3.3.14+ and review
`./launcher.sh update --plan` before `./launcher.sh update`. The visual menu also
has **Update installation**. Source tags come from one compatible release
manifest; preparation finishes before activation, and saved settings/data remain
in place. Use `./launcher.sh update --recover` for an interrupted activation.

See the [release and recovery guide](https://github.com/BugTraceAI/BugTraceAI-Launcher/blob/main/RELEASES.md).
Direct component checkouts keep their explicit runtime backend. Choose tagged
versions deliberately, retain local configuration and data, and rerun that
backend; a development checkout is not silently moved to a public release.
