#!/usr/bin/env bash
# Compatibility alias for the maintained installation entry point.
set -euo pipefail
installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$installer_dir/install.sh" "$@"
