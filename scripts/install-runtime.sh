#!/usr/bin/env bash
# Explicit WEB deployment from existing configuration; no setup wizard.
set -euo pipefail
installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
case "${1:-}" in
    --help|-h)
        printf '%s\n' 'Usage: ./scripts/install-runtime.sh' \
            'Deploys this WEB checkout using an existing .env.docker.' \
            'Guided installation: ./install.sh opens the universal Launcher.'
        exit 0 ;;
    '') [[ $# -eq 0 ]] || { printf 'Unexpected arguments.\n' >&2; exit 2; } ;;
    *) printf 'Unknown option: %s. Run ./scripts/install-runtime.sh --help.\n' "$1" >&2; exit 2 ;;
esac

cd "$installer_dir"
if [[ ! -f .env.docker ]]; then
    printf '%s\n' 'Standalone configuration is missing.' \
        'Copy .env.example to .env.docker and set POSTGRES_PASSWORD first.' \
        'Use ./install.sh for guided setup and automatic dependencies.' >&2
    exit 1
fi
command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || {
    printf 'Standalone setup requires Docker Compose v2. Use ./install.sh for guided setup.\n' >&2
    exit 1
}
command -v curl >/dev/null 2>&1 || { printf 'curl is required for the frontend health check.\n' >&2; exit 1; }
docker info >/dev/null 2>&1 || { printf 'Docker is unavailable; start your Docker runtime and retry.\n' >&2; exit 1; }

compose=(docker compose --env-file .env.docker -f docker-compose.yml)
"${compose[@]}" config --quiet
"${compose[@]}" up --build -d --wait --wait-timeout 240 postgres backend frontend api-routes
listener="$("${compose[@]}" port frontend 80 | head -n 1)"
port="${listener##*:}"
[[ "$port" =~ ^[0-9]+$ ]] || { printf 'Could not determine the frontend port.\n' >&2; exit 1; }
curl -fsS --retry 12 --retry-connrefused --retry-delay 2 --max-time 5 \
    "http://127.0.0.1:$port/health" >/dev/null
printf 'Standalone WEB is ready at http://localhost:%s\n' "$port"
printf 'Configuration: %s/.env.docker; existing data volumes were preserved.\n' "$installer_dir"
printf 'Configure your provider in the application. Connect scanning engines separately.\n'
