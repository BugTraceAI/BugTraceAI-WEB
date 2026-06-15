# 🚀 Installation Guide — BugTraceAI-WEB

> **TL;DR**: The fastest way to deploy BugTraceAI-WEB is via the [BugTraceAI Launcher](https://github.com/BugTraceAI/BugTraceAI-Launcher), which handles everything automatically. See [Option 1](#option-1-bugtraceai-launcher-recommended) below.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option 1: BugTraceAI Launcher (Recommended)](#option-1-bugtraceai-launcher-recommended)
- [Option 2: Standalone Docker (install.sh wizard)](#option-2-standalone-docker-installsh-wizard)
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
| **Docker** 24.0+ | ✅ Required | ❌ Not needed |
| **Docker Compose** | ✅ Required | ❌ Not needed |
| **Node.js** 18+ | ❌ Not needed | ✅ Required |
| **npm** | ❌ Not needed | ✅ Required |
| **Git** | ✅ Required | ✅ Required |
| **OpenRouter API key** | ✅ Required | ✅ Required |
| **RAM** | 2 GB minimum | 1 GB minimum |
| **Disk** | 3 GB free | 500 MB free |

Get an OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys) — it starts with `sk-or-`.

---

## Option 1: BugTraceAI Launcher (Recommended)

The Launcher deploys both **BugTraceAI-WEB and BugTraceAI-CLI** together, fully configured and auto-connected. This is the recommended approach for most users.

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

The wizard will:

1. Check and install missing dependencies (Git, Docker, Compose) on Ubuntu/Debian
2. Ask you to choose a deployment mode (Full, Standalone WEB, or Standalone CLI)
3. Ask for your OpenRouter API key
4. Auto-detect free ports (default: WEB on `6869`, CLI on `8000`)
5. Clone repos, build Docker images, and start all services
6. Run health checks and confirm everything is working

After installation, access the dashboard at **http://localhost:6869**

> See [BugTraceAI-Launcher](https://github.com/BugTraceAI/BugTraceAI-Launcher) for full Launcher documentation including macOS (Apple Silicon) support.

---

## Option 2: Standalone Docker (install.sh wizard)

Use this if you only want to deploy BugTraceAI-WEB without the CLI.

```bash
git clone https://github.com/BugTraceAI/BugTraceAI-WEB.git
cd BugTraceAI-WEB
chmod +x install.sh
./install.sh
```

The wizard will prompt you for:
- Frontend port (default: `6869`)
- Backend port (default: `3001`)
- PostgreSQL password (auto-generated if you press Enter)
- CLI backend URL (optional — leave empty for standalone WEB mode)

After the wizard completes:

```bash
# Check services are running
docker compose ps

# Access the dashboard
open http://localhost:6869
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
VITE_CLI_API_URL=http://localhost:8000
```

### Step 3: Start services

```bash
docker compose --env-file .env.docker up -d
```

### Step 4: Verify

```bash
# All 3 containers should be running: postgres, backend, frontend
docker compose ps

# Health check
curl http://localhost:6869
```

### Managing the stack

```bash
docker compose down              # Stop
docker compose up -d             # Start
docker compose logs -f           # Tail logs
docker compose logs frontend     # Frontend (nginx) logs only
docker compose logs backend      # Backend (Express) logs only
docker compose restart backend   # Restart a specific service
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

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL to your local PostgreSQL instance

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

---

## Authenticated Scanning (YAML + TOTP)

BugTraceAI-WEB supports **authenticated CLI scans** for login-protected targets. You configure the authentication once in a YAML file, and the scanner handles the rest — including TOTP token generation for 2FA-protected apps.

### Create your auth config

```yaml
# auth_config.yaml
login_url: https://target.com/login
username: pentester@example.com
password: your_password_here
totp_secret: BASE32TOTPSECRETHERE   # optional — for 2FA/TOTP apps
success_condition: "dashboard"       # string to confirm successful login
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

> The `auth_config.yaml` is included in the report ZIP automatically for audit traceability.

---

## CLI Integration

Connecting BugTraceAI-WEB to a running [BugTraceAI-CLI](https://github.com/BugTraceAI/BugTraceAI-CLI) instance unlocks the full dashboard: scan launcher, real-time progress, report viewer, configuration editor, and API Discovery.

### If you used the Launcher (Option 1)
The WEB is already connected to the CLI automatically. Nothing to do.

### If you deployed WEB standalone (Options 2–4)

1. Start BugTraceAI-CLI separately:
   ```bash
   cd BugTraceAI-CLI
   docker compose up -d
   # CLI API will be at http://localhost:8000
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
docker compose ps

# View all logs
docker compose logs

# View specific service logs
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

### Port already in use

The `install.sh` wizard auto-detects and resolves port conflicts. For manual Docker deployments:

```bash
# Find what's using port 6869
sudo lsof -i :6869
# Change the port in your .env.docker and restart
```

### Database connection errors

```bash
# Check PostgreSQL container is running
docker compose ps postgres

# Check connection from backend container
docker compose exec backend sh -c "npx prisma db pull"

# Reset database (warning: deletes all data)
docker compose down -v
docker compose up -d
```

### Prisma migration errors

```bash
# Apply pending migrations
docker compose exec backend npx prisma migrate deploy

# Reset and re-apply all migrations (dev only)
docker compose exec backend npx prisma migrate reset
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
docker compose down -v

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
