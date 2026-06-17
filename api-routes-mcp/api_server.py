#!/usr/bin/env python3
"""FastAPI REST API — web-friendly interface for the kiterunner scanner.

Runs on port 8004 alongside the MCP SSE server (port 8003).
Exposes synchronous-friendly endpoints so the browser frontend can
drive scans without dealing with MCP SSE protocol complexity.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Imported for side effects: mcp_server must be imported before tools (handled in main.py)
from tools import ScanState, _resolve_wordlist, _run_scan, _run_brute_scan
from mcp_server import KR_BIN, WORDLISTS_DIR, TEXT_WORDLISTS_DIR

logger = logging.getLogger("kr-api")

# Set by main.py at startup with the actually-bound ports.
# Defaults mirror the preferred ports so standalone testing still works.
ACTUAL_API_PORT: int = int(os.environ.get("API_PORT", 8004))
ACTUAL_MCP_PORT: int = int(os.environ.get("MCP_PORT", 8003))

app = FastAPI(
    title="API Routes Scanner",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_BRUTE_ALIASES = {
    "api": "api-endpoints.txt",
    "actions": "actions.txt",
    "raft": "raft-medium-directories.txt",
}


class ScanRequest(BaseModel):
    target: str
    wordlist: str = "api"
    extensions: str = ""
    speed: str = "medium"
    workers: int = 20
    maxConnections: int = 3


MAX_SCAN_SECONDS = int(os.environ.get("MAX_SCAN_SECONDS", 1800))  # 30 min default


async def _refresh_scan_terminal_state(scan: dict[str, Any] | None) -> dict[str, Any] | None:
    """Synchronize in-memory scan status with the underlying subprocess state."""
    if scan is None or scan.get("status") != "running":
        return scan

    process = scan.get("process")
    if process is None:
        return scan

    # Kill scan if it has been running longer than MAX_SCAN_SECONDS
    started_raw = scan.get("started_at")
    if started_raw:
        try:
            started = datetime.fromisoformat(started_raw)
            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed > MAX_SCAN_SECONDS:
                if process.returncode is None:
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=3.0)
                    except asyncio.TimeoutError:
                        process.kill()
                ScanState.update_scan(
                    scan["scan_id"],
                    status="failed",
                    error=f"Scan timed out after {int(elapsed)}s",
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    process=None,
                )
                return ScanState.get_scan(scan["scan_id"])
        except (ValueError, TypeError):
            pass

    if process.returncode is None:
        pid = getattr(process, "pid", None)
        if pid is not None:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                try:
                    await asyncio.wait_for(process.wait(), timeout=0.2)
                except asyncio.TimeoutError:
                    pass
            except PermissionError:
                pass

    if process.returncode is None:
        return scan

    update: dict[str, Any] = {
        "status": "completed" if process.returncode == 0 else "failed",
        "finished_at": scan.get("finished_at") or datetime.now(timezone.utc).isoformat(),
        "process": None,
    }
    if process.returncode != 0 and not scan.get("error"):
        update["error"] = f"kr exited with code {process.returncode}"

    ScanState.update_scan(scan["scan_id"], **update)
    return ScanState.get_scan(scan["scan_id"])


async def _get_running_scans() -> list[dict[str, Any]]:
    running: list[dict[str, Any]] = []
    for scan in list(ScanState.active_scans.values()):
        refreshed = await _refresh_scan_terminal_state(scan)
        if refreshed and refreshed.get("status") == "running":
            running.append(refreshed)
    return running


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "kr_available": KR_BIN.exists(),
        "api_port": ACTUAL_API_PORT,
        "mcp_port": ACTUAL_MCP_PORT,
    }


@app.get("/api/scans/active")
async def get_active_scan():
    """Return the currently running scan if any, to allow UI to resume tracking."""
    running = await _get_running_scans()
    if running:
        scan = running[0]
        return {
            "scan_id": scan["scan_id"],
            "target": scan["target"],
            "wordlist": scan["wordlist"],
            "status": scan["status"],
            "routes_found": scan["total"],
            "started_at": scan.get("started_at"),
            "finished_at": scan.get("finished_at"),
        }
    return None


# ---------------------------------------------------------------------------
# Scan lifecycle
# ---------------------------------------------------------------------------

@app.post("/api/scan", status_code=202)
async def start_scan(req: ScanRequest):
    """Start a new scan. Returns immediately with scan_id."""
    if not req.target.startswith(("http://", "https://")):
        raise HTTPException(400, "target must start with http:// or https://")
    if not KR_BIN.exists():
        raise HTTPException(503, f"Kiterunner not found at {KR_BIN}")

    running = await _get_running_scans()
    if running:
        raise HTTPException(409, detail={
            "error": "A scan is already running",
            "active_scan_id": running[0]["scan_id"],
        })

    wl = req.wordlist.lower()
    if wl in _BRUTE_ALIASES:
        wl_path = TEXT_WORDLISTS_DIR / _BRUTE_ALIASES[wl]
        if not wl_path.exists():
            raise HTTPException(400, f"Wordlist not found: {_BRUTE_ALIASES[wl]}")
        scan_id = ScanState.create_scan(req.target, _BRUTE_ALIASES[wl])
        asyncio.create_task(_run_brute_scan(scan_id, req.target, wl_path, req.extensions, req.speed, req.workers, req.maxConnections))
    else:
        wl_path = _resolve_wordlist(req.wordlist)
        if wl_path is None:
            available = [p.name for p in WORDLISTS_DIR.glob("*.kite")] if WORDLISTS_DIR.exists() else []
            raise HTTPException(400, f"Wordlist '{req.wordlist}' not found. Available: {available}")
        scan_id = ScanState.create_scan(req.target, req.wordlist)
        asyncio.create_task(_run_scan(scan_id, req.target, wl_path, req.speed, req.workers, req.maxConnections))

    return {"scan_id": scan_id, "status": "started", "target": req.target}


@app.get("/api/scan/{scan_id}/status")
async def get_scan_status(scan_id: int):
    """Poll scan progress."""
    scan = await _refresh_scan_terminal_state(ScanState.get_scan(scan_id))
    if scan is None:
        raise HTTPException(404, f"Scan {scan_id} not found")
    status = scan["status"]
    return {
        "scan_id": scan["scan_id"],
        "target": scan["target"],
        "wordlist": scan["wordlist"],
        "status": status,
        "routes_found": scan["total"],
        "progress": 100 if status in ("completed", "stopped") else 0,
        "error": scan.get("error"),
        "warning": scan.get("warning"),
        "warning_detail": scan.get("warning_detail"),
        "started_at": scan.get("started_at"),
        "finished_at": scan.get("finished_at"),
    }


@app.get("/api/scan/{scan_id}/results")
async def get_scan_results(scan_id: int):
    """Return discovered routes (deduped)."""
    scan = await _refresh_scan_terminal_state(ScanState.get_scan(scan_id))
    if scan is None:
        raise HTTPException(404, f"Scan {scan_id} not found")
    routes = scan["routes"]
    seen: set = set()
    deduped = []
    for r in routes:
        key = (r["method"], r["url"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    return {"routes": deduped, "url_list": [r["url"] for r in deduped]}


@app.delete("/api/scan/{scan_id}")
async def stop_scan(scan_id: int):
    """Stop a running scan."""
    scan = await _refresh_scan_terminal_state(ScanState.get_scan(scan_id))
    if scan is None:
        raise HTTPException(404, f"Scan {scan_id} not found")
    if scan["status"] != "running":
        return {"scan_id": scan_id, "status": scan["status"]}
    process = scan.get("process")
    if process and process.returncode is None:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            process.kill()
    ScanState.update_scan(scan_id, status="stopped", process=None)
    return {"scan_id": scan_id, "status": "stopped"}


# ---------------------------------------------------------------------------
# Wordlists
# ---------------------------------------------------------------------------

@app.get("/api/wordlists")
async def list_wordlists():
    kite = [p.name for p in sorted(WORDLISTS_DIR.glob("*.kite"))] if WORDLISTS_DIR.exists() else []
    text = [p.stem for p in sorted(TEXT_WORDLISTS_DIR.glob("*.txt"))] if TEXT_WORDLISTS_DIR.exists() else []
    return {"kite": kite, "text": text}


# ---------------------------------------------------------------------------
# OpenAPI export
# ---------------------------------------------------------------------------

@app.get("/api/scan/{scan_id}/openapi")
async def export_openapi(scan_id: int):
    """Export discovered routes as an OpenAPI 3.0 spec (downloadable JSON).

    Compatible with Bruno, Postman, Insomnia, and BugTraceAI WEB importer.
    """
    from fastapi.responses import JSONResponse
    from tools import _routes_to_openapi

    scan = ScanState.get_scan(scan_id)
    if scan is None:
        raise HTTPException(404, f"Scan {scan_id} not found")

    routes = scan["routes"]
    seen: set = set()
    deduped = []
    for r in routes:
        key = (r["method"], r["url"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    spec = _routes_to_openapi(scan["target"], deduped)
    spec["x-scan-meta"] = {
        "scan_id": scan_id,
        "target": scan["target"],
        "wordlist": scan["wordlist"],
        "scanned_at": scan["started_at"],
        "finished_at": scan["finished_at"],
        "total_routes": len(deduped),
    }

    filename = f"scan_{scan_id}_openapi.json"
    return JSONResponse(
        content=spec,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
