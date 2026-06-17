"""Kiterunner MCP Tools.

Registers tools on the shared mcp_server instance:
  - kiterunner_scan      Start an API discovery job (kite wordlists)
  - get_scan_status      Poll job status
  - get_results          Retrieve discovered routes
  - list_wordlists       List all available wordlists (kite + text)
  - stop_scan            Cancel a running job
  - directory_scan       Directory brute-force using kr brute + text wordlists
"""

import asyncio
import os
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp_server import mcp_server, KR_BIN, WORDLISTS_DIR, TEXT_WORDLISTS_DIR

logger = logging.getLogger("api-routes-mcp.tools")

# ---------------------------------------------------------------------------
# In-memory scan state
# ---------------------------------------------------------------------------

class ScanState:
    _counter: int = 0
    active_scans: Dict[int, Dict[str, Any]] = {}

    @classmethod
    def create_scan(cls, target: str, wordlist: str) -> int:
        cls._counter += 1
        scan_id = cls._counter
        cls.active_scans[scan_id] = {
            "scan_id": scan_id,
            "target": target,
            "wordlist": wordlist,
            "status": "pending",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
            "routes": [],
            "total": 0,
            "process": None,
            "error": None,
            "warning": None,
            "warning_detail": None,
        }
        return scan_id

    @classmethod
    def get_scan(cls, scan_id: int) -> Optional[Dict[str, Any]]:
        return cls.active_scans.get(scan_id)

    @classmethod
    def update_scan(cls, scan_id: int, **kwargs) -> None:
        if scan_id in cls.active_scans:
            cls.active_scans[scan_id].update(kwargs)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_wordlist(wordlist: str) -> Optional[Path]:
    """Return absolute path for a wordlist name or path."""
    aliases = {
        "small": "routes-small.kite",
        "large": "routes-large.kite",
    }
    resolved = aliases.get(wordlist.lower(), wordlist)
    candidate = Path(resolved)
    if candidate.is_absolute() and candidate.exists():
        return candidate
    bundled = WORDLISTS_DIR / resolved
    if bundled.exists():
        return bundled
    return None


def _parse_kr_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse one line of kiterunner text output.

    Expected format (text mode):
      GET     200 [    489,    9,   3] https://example.com/api/v1/users 0c8e2b1...
    """
    line = line.strip()
    if not line:
        return None
    pattern = (
        r"^(?P<method>\w+)\s+"
        r"(?P<status>\d+)\s+"
        r"\[\s*(?P<words>\d+),\s*(?P<lines>\d+),\s*(?P<chars>\d+)\]\s+"
        r"(?P<url>https?://\S+)"
    )
    m = re.match(pattern, line)
    if not m:
        return None
    return {
        "method": m.group("method"),
        "status": int(m.group("status")),
        "words": int(m.group("words")),
        "lines": int(m.group("lines")),
        "chars": int(m.group("chars")),
        "url": m.group("url"),
    }


async def _detect_baseline(target: str) -> tuple[int, Optional[int]]:
    """Probe target with a random path to detect baseline HTTP behaviour.

    Returns (http_status, content_length).
    - http_status == 0  → probe failed (network error / timeout)
    - http_status == 200 → SPA catch-all: server returns 200 for *everything*
    - http_status == 4xx → normal server with proper 404 handling

    content_length is the Content-Length header value, or None if not present.
    """
    probe_path = "/kiterunner_baseline_probe_a7f3k9x2"
    try:
        proc = await asyncio.create_subprocess_exec(
            "curl", "-sk", "--max-time", "8", "--head",
            f"{target.rstrip('/')}{probe_path}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate()
        headers = stdout.decode(errors="replace")
        status = 0
        length: Optional[int] = None
        for line in headers.splitlines():
            # HTTP/1.1 200 OK  or  HTTP/2 404
            if line.upper().startswith("HTTP/"):
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        status = int(parts[1])
                    except ValueError:
                        pass
            elif line.lower().startswith("content-length:"):
                try:
                    length = int(line.split(":", 1)[1].strip())
                except ValueError:
                    pass
        logger.info(f"Baseline probe → HTTP {status}, Content-Length: {length}")
        return status, length
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Baseline detection failed: {exc}")
    return 0, None


# Backwards-compat shim used by MCP tools layer
async def _detect_baseline_length(target: str) -> Optional[int]:
    _, length = await _detect_baseline(target)
    return length


def _build_speed_flags(speed: str, max_connections: int) -> List[str]:
    if speed == "slow":
        return ["-x", "1", "--delay", "250ms"]
    elif speed == "medium":
        return ["-x", "3"]
    elif speed == "fast":
        return ["-x", "10"]
    elif speed == "manual":
        return ["-x", str(max(1, max_connections))]
    return ["-x", "3"]


async def _run_scan(scan_id: int, target: str, wordlist_path: Path, speed: str = "medium", workers: int = 20, max_connections: int = 3) -> None:
    """Background task: run kr and collect results."""
    ScanState.update_scan(scan_id, status="running")

    # Detect baseline — filter out SPA catch-all 200 responses
    baseline_status, baseline_len = await _detect_baseline(target)
    if baseline_status == 200:
        ScanState.update_scan(
            scan_id,
            warning="spa_catchall",
            warning_detail=(
                f"SPA/Catch-all detected! Target returns HTTP 200 for missing paths.\n"
                f"Filtering out baseline size ({baseline_len} bytes) to isolate real endpoints."
            ),
        )
        logger.warning(f"[scan:{scan_id}] SPA catch-all detected — applying filter")

    ignore_lengths = ["0"]
    if baseline_len and baseline_len > 0:
        ignore_lengths.append(str(baseline_len))

    cmd = [
        str(KR_BIN),
        "scan", target,
        "-w", str(wordlist_path),
        "-o", "text",                        # output format
        "-q",                                # quiet — suppress banner/progress
    ] + _build_speed_flags(speed, max_connections)

    # --ignore-length: skip responses matching baseline size (exact value or range)
    # kiterunner accepts comma-separated values like "1213" or "100-105"
    valid_lengths = [l for l in ignore_lengths if l != "0"]
    if valid_lengths:
        cmd += ["--ignore-length", ",".join(valid_lengths)]

    logger.info(f"[scan:{scan_id}] Running: {' '.join(cmd)}")

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,  # discard — avoids pipe buffer deadlock
        )
        ScanState.update_scan(scan_id, process=process)

        routes: List[Dict[str, Any]] = []
        assert process.stdout is not None

        async for raw_line in process.stdout:
            line = raw_line.decode(errors="replace")
            parsed = _parse_kr_line(line)
            if parsed:
                routes.append(parsed)
                ScanState.update_scan(scan_id, routes=routes, total=len(routes))

        await process.wait()
        finished = datetime.now(timezone.utc).isoformat()

        if process.returncode == 0:
            ScanState.update_scan(
                scan_id,
                status="completed",
                finished_at=finished,
                routes=routes,
                total=len(routes),
                process=None,
            )
            logger.info(f"[scan:{scan_id}] Completed — {len(routes)} routes found")
        else:
            ScanState.update_scan(
                scan_id,
                status="failed",
                finished_at=finished,
                error=f"kr exited with code {process.returncode}",
                process=None,
            )
            logger.warning(f"[scan:{scan_id}] Failed (rc={process.returncode})")

    except Exception as exc:  # noqa: BLE001
        logger.exception(f"[scan:{scan_id}] Unexpected error: {exc}")
        ScanState.update_scan(
            scan_id,
            status="failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            error=str(exc),
            process=None,
        )


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp_server.tool()
async def kiterunner_scan(
    target: str,
    wordlist: str = "small",
) -> Dict[str, Any]:
    """Start an API route discovery scan against a target using Kiterunner.

    Args:
        target:   Base URL of the API to scan (e.g. https://api.example.com)
        wordlist: Wordlist to use — "small" (default), "large", or absolute path
                  to a custom .kite file.

    Returns:
        scan_id, status, and wordlist used. Poll get_scan_status for progress.
    """
    if not target.startswith(("http://", "https://")):
        return {"error": "target must start with http:// or https://"}

    wordlist_path = _resolve_wordlist(wordlist)
    if wordlist_path is None:
        available = [p.name for p in WORDLISTS_DIR.glob("*.kite")] if WORDLISTS_DIR.exists() else []
        return {
            "error": f"Wordlist '{wordlist}' not found.",
            "available_wordlists": available,
        }

    if not KR_BIN.exists():
        return {"error": f"Kiterunner binary not found at {KR_BIN}"}

    # Enforce single active scan
    running = [s for s in ScanState.active_scans.values() if s["status"] == "running"]
    if running:
        active = running[0]
        return {
            "error": "A scan is already running. Wait for it to finish or stop it first.",
            "active_scan_id": active["scan_id"],
            "active_target": active["target"],
            "status": active["status"],
        }

    scan_id = ScanState.create_scan(target, wordlist)
    asyncio.create_task(_run_scan(scan_id, target, wordlist_path))

    return {
        "scan_id": scan_id,
        "status": "started",
        "target": target,
        "wordlist": wordlist_path.name,
        "message": "Scan started. Use get_scan_status(scan_id) to poll progress.",
    }


@mcp_server.tool()
async def get_scan_status(scan_id: int) -> Dict[str, Any]:
    """Return the current status and progress of a scan.

    Args:
        scan_id: ID returned by kiterunner_scan.
    """
    scan = ScanState.get_scan(scan_id)
    if scan is None:
        return {"error": f"Scan {scan_id} not found."}

    return {
        "scan_id": scan_id,
        "target": scan["target"],
        "wordlist": scan["wordlist"],
        "status": scan["status"],
        "started_at": scan["started_at"],
        "finished_at": scan["finished_at"],
        "routes_found_so_far": scan["total"],
        "error": scan.get("error"),
    }


@mcp_server.tool()
async def get_results(
    scan_id: int,
    filter_status: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve the discovered routes from a completed (or running) scan.

    Args:
        scan_id:       ID returned by kiterunner_scan.
        filter_status: Optional comma-separated HTTP status codes to include,
                       e.g. "200,201" or "403".  Omit to return all routes.

    Returns:
        Full result set including target, wordlist, timestamp, and routes list.
        Each route has: method, status, url, words, lines, chars.
        Also returns a url_list suitable for loading into BugTraceAI scan config.
    """
    scan = ScanState.get_scan(scan_id)
    if scan is None:
        return {"error": f"Scan {scan_id} not found."}

    routes = scan["routes"]

    if filter_status:
        allowed = {int(s.strip()) for s in filter_status.split(",") if s.strip().isdigit()}
        routes = [r for r in routes if r["status"] in allowed]

    # Deduplicate by (method, url) — kr phase scans can yield the same route twice
    seen: set = set()
    deduped: List[Dict[str, Any]] = []
    for route in routes:
        key = (route["method"], route["url"])
        if key not in seen:
            seen.add(key)
            deduped.append(route)
    routes = deduped

    url_list = [r["url"] for r in routes]

    return {
        "scan_id": scan_id,
        "target": scan["target"],
        "wordlist": scan["wordlist"],
        "scanned_at": scan["started_at"],
        "finished_at": scan["finished_at"],
        "status": scan["status"],
        "total": len(routes),
        "routes": routes,
        "url_list": url_list,
    }


@mcp_server.tool()
async def list_wordlists() -> Dict[str, Any]:
    """List all wordlists available in the container.

    Returns two categories:
    - kite: Kiterunner .kite wordlists (API-aware, for kiterunner_scan)
    - text: API wordlists from SecLists /Discovery/Web-Content/api/ (for directory_scan with kr brute)
    """
    kite_lists = []
    if WORDLISTS_DIR.exists():
        for p in sorted(WORDLISTS_DIR.glob("*.kite")):
            size_mb = round(p.stat().st_size / (1024 * 1024), 1)
            kite_lists.append({
                "name": p.name,
                "alias": p.stem.replace("routes-", ""),
                "size_mb": size_mb,
                "tool": "kiterunner_scan",
            })

    text_lists = []
    if TEXT_WORDLISTS_DIR.exists():
        for p in sorted(TEXT_WORDLISTS_DIR.glob("*.txt")):
            size_mb = round(p.stat().st_size / (1024 * 1024), 1)
            lines = 0
            try:
                with open(p) as f:
                    lines = sum(1 for _ in f)
            except Exception:
                pass
            text_lists.append({
                "name": p.name,
                "alias": p.stem,
                "size_mb": size_mb,
                "lines": lines,
                "tool": "directory_scan",
            })

    return {
        "kite_wordlists": kite_lists,
        "text_wordlists": text_lists,
    }


@mcp_server.tool()
async def stop_scan(scan_id: int) -> Dict[str, Any]:
    """Cancel a running scan.

    Args:
        scan_id: ID returned by kiterunner_scan.
    """
    scan = ScanState.get_scan(scan_id)
    if scan is None:
        return {"error": f"Scan {scan_id} not found."}

    if scan["status"] != "running":
        return {"message": f"Scan {scan_id} is not running (status: {scan['status']})."}

    process = scan.get("process")
    if process and process.returncode is None:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            process.kill()

    ScanState.update_scan(
        scan_id,
        status="stopped",
        finished_at=datetime.now(timezone.utc).isoformat(),
        process=None,
    )

    return {
        "scan_id": scan_id,
        "status": "stopped",
        "routes_collected": scan["total"],
    }


# ---------------------------------------------------------------------------
# directory_scan — kr brute-based brute-force with text wordlists
# ---------------------------------------------------------------------------

async def _run_brute_scan(scan_id: int, target: str, wordlist_path: Path, extensions: str, speed: str = "medium", workers: int = 20, max_connections: int = 3) -> None:
    """Background task: run kr brute and collect results."""
    ScanState.update_scan(scan_id, status="running")

    # Detect baseline — filter out SPA catch-all 200 responses
    baseline_status, baseline_len = await _detect_baseline(target)
    if baseline_status == 200:
        ScanState.update_scan(
            scan_id,
            warning="spa_catchall",
            warning_detail=(
                f"SPA/Catch-all detected! Target returns HTTP 200 for missing paths.\n"
                f"Filtering out baseline size ({baseline_len} bytes) to isolate real endpoints."
            ),
        )
        logger.warning(f"[scan:{scan_id}] SPA catch-all detected — applying filter")

    valid_lengths = [str(baseline_len)] if baseline_len and baseline_len > 0 else []

    cmd = [
        str(KR_BIN),
        "brute", target,
        "-w", str(wordlist_path),
        "-o", "text",
        "-q",
        "--disable-precheck",   # skip 2-phase preflight — prevents SPA catch-all from aborting scan
        "--max-redirects", "0", # don't follow redirects — preserves real status codes and lengths
        "--fail-status-codes", "404",  # filter 404s at kr level — avoids Express reflected-path false positives
    ] + _build_speed_flags(speed, max_connections)

    if valid_lengths:
        cmd += ["--ignore-length", ",".join(valid_lengths)]

    if extensions:
        # kr brute accepts -e ext1,ext2 (with or without leading dot)
        cmd += ["-e", extensions]

    logger.info(f"[scan:{scan_id}] Running kr brute: {' '.join(cmd)}")

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        ScanState.update_scan(scan_id, process=process)

        routes: List[Dict[str, Any]] = []
        assert process.stdout is not None

        async for raw_line in process.stdout:
            line = raw_line.decode(errors="replace")
            parsed = _parse_kr_line(line)
            if parsed:
                routes.append(parsed)
                ScanState.update_scan(scan_id, routes=routes, total=len(routes))

        await process.wait()
        finished = datetime.now(timezone.utc).isoformat()

        if process.returncode == 0:
            ScanState.update_scan(
                scan_id,
                status="completed",
                finished_at=finished,
                routes=routes,
                total=len(routes),
                process=None,
            )
            logger.info(f"[scan:{scan_id}] kr brute completed — {len(routes)} paths found")
        else:
            ScanState.update_scan(
                scan_id,
                status="failed",
                finished_at=finished,
                error=f"kr brute exited with code {process.returncode}",
                process=None,
            )

    except Exception as exc:
        logger.exception(f"[scan:{scan_id}] Unexpected error: {exc}")
        ScanState.update_scan(
            scan_id,
            status="failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            error=str(exc),
            process=None,
        )


@mcp_server.tool()
async def directory_scan(
    target: str,
    wordlist: str = "api",
    extensions: str = "",
) -> Dict[str, Any]:
    """Brute-force API endpoints using kiterunner brute mode with SecLists API wordlists.

    Multi-level paths in the wordlist (e.g. api/v1/users) enable depth scanning
    by kr brute natively. 404s filtered at scanner level to avoid false positives.
    For deeper structured coverage use kiterunner_scan (.kite wordlists).

    Args:
        target:     Base URL to scan (e.g. https://example.com)
        wordlist:   Wordlist alias or filename:
                    - "api"     → api-endpoints.txt (~160 multi-level API paths, fast)
                    - "raft"    → raft-medium-directories.txt (~30k, fallback for CMS/legacy)
                    - "actions" → actions.txt (action verbs: create, delete, search…)
                    - Or a filename like "api-endpoints.txt"
        extensions: Comma-separated extensions (e.g. ".json,.xml"). Usually empty for APIs.

    Returns:
        scan_id, status. Use get_scan_status(scan_id) and get_results(scan_id).
    """
    if not target.startswith(("http://", "https://")):
        return {"error": "target must start with http:// or https://"}

    if not KR_BIN.exists():
        return {"error": f"Kiterunner binary not found at {KR_BIN}"}

    # Resolve wordlist
    aliases = {
        "api": "api-endpoints.txt",           # ~160 multi-level API paths, fast and clean (default)
        "actions": "actions.txt",             # action verbs (create, delete, search…)
        "raft": "raft-medium-directories.txt", # ~30k generic paths, fallback for CMS/legacy targets
    }
    resolved_name = aliases.get(wordlist.lower(), wordlist)
    if not resolved_name.endswith(".txt"):
        resolved_name += ".txt"

    wordlist_path = TEXT_WORDLISTS_DIR / resolved_name
    if not wordlist_path.exists():
        available = [p.name for p in TEXT_WORDLISTS_DIR.glob("*.txt")] if TEXT_WORDLISTS_DIR.exists() else []
        return {
            "error": f"Wordlist '{resolved_name}' not found in {TEXT_WORDLISTS_DIR}.",
            "available": available,
        }

    # Enforce single active scan
    running = [s for s in ScanState.active_scans.values() if s["status"] == "running"]
    if running:
        active = running[0]
        return {
            "error": "A scan is already running.",
            "active_scan_id": active["scan_id"],
            "status": active["status"],
        }

    scan_id = ScanState.create_scan(target, resolved_name)
    asyncio.create_task(_run_brute_scan(scan_id, target, wordlist_path, extensions))

    return {
        "scan_id": scan_id,
        "status": "started",
        "target": target,
        "wordlist": resolved_name,
        "extensions": extensions or None,
        "message": "Scan started. Use get_scan_status(scan_id) to poll progress.",
    }


# ---------------------------------------------------------------------------
# OpenAPI export
# ---------------------------------------------------------------------------

def _routes_to_openapi(target: str, routes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert a list of kiterunner route dicts into a valid OpenAPI 3.0 spec.

    Each route has: method, url, status, words, lines, chars.
    Paths with query strings are split: the path goes into the path key,
    query params become parameter objects with ``in: query``.
    """
    from urllib.parse import urlparse, parse_qs

    try:
        parsed_target = urlparse(target)
        server_url = f"{parsed_target.scheme}://{parsed_target.netloc}"
        title = parsed_target.netloc
    except Exception:
        server_url = target.rstrip("/")
        title = target

    paths: Dict[str, Any] = {}

    for route in routes:
        method = route["method"].lower()
        if method not in ("get", "post", "put", "patch", "delete", "head", "options"):
            continue

        url = route["url"]
        status = route.get("status", 200)

        # Strip server prefix to get the path
        try:
            parsed_url = urlparse(url)
            path = parsed_url.path or "/"
            query_string = parsed_url.query
        except Exception:
            continue

        # Normalise path: remove trailing slash unless root
        if path != "/" and path.endswith("/"):
            path = path.rstrip("/")

        # Build parameters from query string
        parameters = []
        if query_string:
            for name, values in parse_qs(query_string, keep_blank_values=True).items():
                parameters.append({
                    "name": name,
                    "in": "query",
                    "required": False,
                    "schema": {"type": "string"},
                    "example": values[0] if values else "",
                })

        if path not in paths:
            paths[path] = {}

        operation: Dict[str, Any] = {
            "responses": {
                str(status): {"description": f"HTTP {status}"}
            },
            "tags": ["discovered"],
            "x-scan-words": route.get("words"),
            "x-scan-lines": route.get("lines"),
        }
        if parameters:
            operation["parameters"] = parameters

        paths[path][method] = operation

    return {
        "openapi": "3.0.0",
        "info": {
            "title": f"API Scan — {title}",
            "description": "Endpoints discovered by api-routes-mcp (kiterunner). Import into Bruno, Postman, or BugTraceAI.",
            "version": "1.0.0",
        },
        "servers": [{"url": server_url}],
        "paths": paths,
    }


@mcp_server.tool()
async def get_openapi_spec(scan_id: int) -> Dict[str, Any]:
    """Export discovered routes as an OpenAPI 3.0 spec.

    The resulting spec can be imported directly into Bruno, Postman, Insomnia,
    or the BugTraceAI WEB scanner (drag & drop the JSON file).

    Args:
        scan_id: ID returned by kiterunner_scan or directory_scan.

    Returns:
        A valid OpenAPI 3.0 document with one path/method entry per discovered route.
    """
    scan = ScanState.get_scan(scan_id)
    if scan is None:
        return {"error": f"Scan {scan_id} not found."}

    routes = scan["routes"]

    # Deduplicate by (method, url)
    seen: set = set()
    deduped: List[Dict[str, Any]] = []
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
    return spec
