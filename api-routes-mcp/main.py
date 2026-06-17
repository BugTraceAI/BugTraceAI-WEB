#!/usr/bin/env python3
"""Entry point — starts both the MCP SSE server and the FastAPI REST API
in the same asyncio event loop.

Ports are **not hardcoded**.  Each server tries the requested port first;
if it's already in use it scans upward (up to MAX_PORT_RETRIES attempts)
until it finds a free one.  The actually-bound ports are exposed via the
REST ``/health`` endpoint so nginx / healthchecks always know where to
reach the services.

Usage:
    python main.py              # STDIO transport (MCP only)
    python main.py --sse        # SSE + REST API (default ports 8003 / 8004)
    python main.py --sse --port 9003 --api-port 9004
"""

import sys
import os
import socket
import asyncio
import logging
import argparse

# Import order matters: mcp_server creates the FastMCP instance,
# tools registers @tool() decorators on it, api_server creates the FastAPI app.
import mcp_server   # noqa: F401
import tools        # noqa: F401
import api_server   # noqa: F401

from mcp_server import run_mcp_server

MAX_PORT_RETRIES = 10          # how many consecutive ports to try


def _find_free_port(host: str, preferred: int, retries: int = MAX_PORT_RETRIES) -> int:
    """Return *preferred* if it's available, otherwise the next free port
    within *preferred … preferred+retries-1*.  Raises ``RuntimeError`` if
    none of them are free."""
    for offset in range(retries):
        port = preferred + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    raise RuntimeError(
        f"No free port found in range {preferred}–{preferred + retries - 1}"
    )


async def _run_both(host: str, mcp_port: int, api_port: int) -> None:
    """Run MCP SSE and FastAPI REST in the same asyncio event loop so that
    asyncio.create_task() calls from both servers share the same loop and
    ScanState is safely shared without locks."""
    import uvicorn
    from starlette.middleware.cors import CORSMiddleware

    logger = logging.getLogger("main")

    # --- resolve free ports ------------------------------------------------
    actual_mcp = _find_free_port(host, mcp_port)
    if actual_mcp != mcp_port:
        logger.warning(f"MCP port {mcp_port} busy → using {actual_mcp}")

    actual_api = _find_free_port(host, api_port)
    if actual_api != api_port:
        logger.warning(f"API port {api_port} busy → using {actual_api}")

    # Make the actual API port visible to the health endpoint
    api_server.ACTUAL_API_PORT = actual_api
    api_server.ACTUAL_MCP_PORT = actual_mcp

    # Preserve prior LAN behavior: allow IP-based clients (e.g. browser on VM IP)
    # and keep FastMCP aware of actual host/port.
    mcp_server.mcp_server.settings.host = host
    mcp_server.mcp_server.settings.port = actual_mcp
    mcp_server.mcp_server.settings.transport_security = mcp_server._LAN_TRANSPORT_SECURITY

    mcp_app = mcp_server.mcp_server.sse_app()
    mcp_app = CORSMiddleware(
        mcp_app,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    cfg_mcp = uvicorn.Config(mcp_app, host=host, port=actual_mcp, log_level="info")
    cfg_api = uvicorn.Config(api_server.app, host=host, port=actual_api, log_level="info")

    srv_mcp = uvicorn.Server(cfg_mcp)
    srv_api = uvicorn.Server(cfg_api)
    srv_mcp.install_signal_handlers = lambda: None  # srv_api owns OS signals

    logger.info(f"MCP SSE  → {host}:{actual_mcp}")
    logger.info(f"REST API → {host}:{actual_api}")

    await asyncio.gather(srv_mcp.serve(), srv_api.serve())


if __name__ == "__main__":
    logging.basicConfig(
        stream=sys.stderr, level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    parser = argparse.ArgumentParser(description="Kiterunner MCP + REST API Server")
    parser.add_argument("--sse", action="store_true", help="Use SSE transport (also starts REST API)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8003)
    parser.add_argument(
        "--api-port", type=int,
        default=int(os.environ.get("API_PORT", 8004)),
        help="Port for FastAPI REST server (default: 8004)",
    )
    args = parser.parse_args()

    if args.sse:
        asyncio.run(_run_both(args.host, args.port, args.api_port))
    else:
        run_mcp_server("stdio", args.host, args.port)
