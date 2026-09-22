#!/bin/bash
# API Routes MCP Server Entrypoint

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

KR_BIN="${KR_BIN:-/usr/local/bin/kr}"
WORDLISTS_DIR="${WORDLISTS_DIR:-/opt/kiterunner/wordlists}"
MCP_PORT="${MCP_PORT:-8003}"
API_PORT="${API_PORT:-8004}"

# Verify kr binary
if [ ! -x "$KR_BIN" ]; then
    log_error "Kiterunner binary not found or not executable at $KR_BIN"
    exit 1
fi

log_info "Kiterunner: $(${KR_BIN} version 2>/dev/null || echo 'version unknown')"
log_info "Wordlists : $(ls ${WORDLISTS_DIR}/*.kite 2>/dev/null | wc -l) file(s) in ${WORDLISTS_DIR}"

case "$1" in
    mcp|mcp-server|--mcp)
        shift
        MODE="stdio"
        HOST="0.0.0.0"
        PORT="$MCP_PORT"

        while [[ $# -gt 0 ]]; do
            case "$1" in
                --sse)      MODE="sse" ;;
                --host)     HOST="$2"; shift ;;
                --port)     PORT="$2"; shift ;;
            esac
            shift
        done

        if [ "$MODE" = "sse" ]; then
            log_info "Starting API Routes MCP Server (SSE) on ${HOST}:${PORT}"
            exec python3 /opt/api-routes-mcp/main.py --sse --host "$HOST" --port "$PORT" --api-port "$API_PORT"
        else
            log_info "Starting API Routes MCP Server (STDIO)"
            exec python3 /opt/api-routes-mcp/main.py
        fi
        ;;
    kr|kiterunner)
        shift
        log_info "Running kr $*"
        exec "$KR_BIN" "$@"
        ;;
    *)
        exec "$@"
        ;;
esac
