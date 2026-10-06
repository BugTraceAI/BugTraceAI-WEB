#!/usr/bin/env bash
# Thin entry for the universal Launcher; compatibility for direct automation.
set -euo pipefail
installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
    '') exec bash "$installer_dir/scripts/launcher-bootstrap.sh" web ;;
    --help|-h)
        printf '%s\n' 'Usage: ./install.sh' \
            'Opens the universal Launcher with WEB and its scanning engines suggested.' \
            'Direct automation: configure .env.docker, then ./scripts/install-runtime.sh.' \
            'Legacy --standalone delegates to that backend. See INSTALLATION.md.' ;;
    --standalone)
        shift
        exec bash "$installer_dir/scripts/install-runtime.sh" "$@" ;;
    *) printf 'Unknown option: %s. Run ./install.sh --help.\n' "$1" >&2; exit 2 ;;
esac
