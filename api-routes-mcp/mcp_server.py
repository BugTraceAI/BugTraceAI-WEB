#!/usr/bin/env python3
"""MCP Server for API Routes - API Discovery Integration.

Exposes Kiterunner's API route discovery capabilities via the
Model Context Protocol (MCP), allowing AI assistants and the
BugTraceAI-WEB frontend to discover API endpoints.

Supports two transports:
- STDIO (default): For local AI assistant integration (Claude Code, Cursor, etc.)
- SSE (--sse flag): For remote/network access (BugTraceAI-WEB, remote MCP clients)

Usage:
    python mcp_server.py              # STDIO transport (default)
    python mcp_server.py --sse        # SSE transport on default port 8003
    python mcp_server.py --sse --port 9000  # Custom port

Author: BugTraceAI Team
Version: 1.0.0
"""

import sys
import os
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

mcp_server = FastMCP(
    "api-routes-mcp",
    dependencies=["mcp", "pydantic"]
)

KR_BIN = Path(os.environ.get("KR_BIN", "/usr/local/bin/kr"))
WORDLISTS_DIR = Path(os.environ.get("WORDLISTS_DIR", "/opt/kiterunner/wordlists"))
TEXT_WORDLISTS_DIR = Path(os.environ.get("TEXT_WORDLISTS_DIR", "/opt/wordlists"))

_LAN_TRANSPORT_SECURITY = TransportSecuritySettings(
    enable_dns_rebinding_protection=False,
)


def run_mcp_server(
    transport: str = "stdio",
    host: str = "0.0.0.0",
    port: int = 8003,
) -> None:
    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger("api-routes-mcp")

    if transport == "sse":
        mcp_server.settings.host = host
        mcp_server.settings.port = port
        mcp_server.settings.transport_security = _LAN_TRANSPORT_SECURITY
        logger.info(f"Starting API Routes MCP Server (SSE) on {host}:{port}")

        # Wrap with CORS so the browser can connect directly (bypassing nginx proxy)
        from starlette.middleware.cors import CORSMiddleware
        import uvicorn

        app = mcp_server.sse_app()
        app = CORSMiddleware(
            app,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["*"],
        )
        uvicorn.run(app, host=host, port=port)
    else:
        logger.info("Starting API Routes MCP Server (STDIO)")
        mcp_server.run(transport="stdio")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="API Routes MCP Server")
    parser.add_argument("--sse", action="store_true", help="Use SSE transport")
    parser.add_argument("--host", default="0.0.0.0", help="Host for SSE server")
    parser.add_argument("--port", type=int, default=8003, help="Port for SSE server")
    args = parser.parse_args()

    transport = "sse" if args.sse else "stdio"
    run_mcp_server(transport=transport, host=args.host, port=args.port)
