# API Routes MCP Server
# Lightweight image: Debian slim + kr binary + Assetnote wordlists + Python MCP server
#
# Build:  docker build -t api-routes-mcp .
# Run:    docker run -p 8003:8003 api-routes-mcp mcp --sse

FROM debian:bookworm-slim

LABEL maintainer="BugTraceAI Team"
LABEL description="Kiterunner API discovery with MCP server for AI assistant integration"
LABEL version="1.0.0"

# ── System deps ────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ── Kiterunner binary ──────────────────────────────────────────────────────
# Download latest kr release for linux/amd64
ARG KR_VERSION=1.0.2
RUN wget -q \
    "https://github.com/assetnote/kiterunner/releases/download/v${KR_VERSION}/kiterunner_${KR_VERSION}_linux_amd64.tar.gz" \
    -O /tmp/kr.tar.gz \
    && tar -xzf /tmp/kr.tar.gz -C /tmp \
    && mv /tmp/kr /usr/local/bin/kr \
    && chmod +x /usr/local/bin/kr \
    && rm /tmp/kr.tar.gz

# ── Wordlists ──────────────────────────────────────────────────────────────
RUN mkdir -p /opt/kiterunner/wordlists

# routes-small.kite (~5 MB) — always bundled
RUN wget -q \
    "https://wordlists-cdn.assetnote.io/data/kiterunner/routes-small.kite.tar.gz" \
    -O /tmp/routes-small.tar.gz \
    && tar -xzf /tmp/routes-small.tar.gz -C /opt/kiterunner/wordlists \
    && rm /tmp/routes-small.tar.gz

# routes-large.kite (~90 MB) — optional, set DOWNLOAD_LARGE_WORDLIST=true at build time
ARG DOWNLOAD_LARGE_WORDLIST=false
RUN if [ "$DOWNLOAD_LARGE_WORDLIST" = "true" ]; then \
    wget -q \
    "https://wordlists-cdn.assetnote.io/data/kiterunner/routes-large.kite.tar.gz" \
    -O /tmp/routes-large.tar.gz \
    && tar -xzf /tmp/routes-large.tar.gz -C /opt/kiterunner/wordlists \
    && rm /tmp/routes-large.tar.gz; \
fi

# ── ffuf binary ────────────────────────────────────────────────────────────
ARG FFUF_VERSION=2.1.0
RUN wget -q \
    "https://github.com/ffuf/ffuf/releases/download/v${FFUF_VERSION}/ffuf_${FFUF_VERSION}_linux_amd64.tar.gz" \
    -O /tmp/ffuf.tar.gz \
    && tar -xzf /tmp/ffuf.tar.gz -C /tmp \
    && mv /tmp/ffuf /usr/local/bin/ffuf \
    && chmod +x /usr/local/bin/ffuf \
    && rm /tmp/ffuf.tar.gz

# ── API wordlists (SecLists /Discovery/Web-Content/api/) ─────────────────
RUN mkdir -p /opt/wordlists

# api-endpoints.txt — ~160 curated multi-level API paths (api/auth/login, api/v1/users…)
# This is the primary wordlist. Multi-level entries enable depth scanning in kr brute.
RUN wget -q \
    "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/api/api-endpoints.txt" \
    -O /opt/wordlists/api-endpoints.txt

# actions.txt — API action verbs (create, delete, update, search…) for manual combination
RUN wget -q \
    "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/api/actions.txt" \
    -O /opt/wordlists/actions.txt

# raft-medium-directories.txt — ~30k generic web paths, fallback for non-API targets (CMS, legacy)
RUN wget -q \
    "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/raft-medium-directories.txt" \
    -O /opt/wordlists/raft-medium-directories.txt

# ── Python MCP server ──────────────────────────────────────────────────────
RUN python3 -m venv /opt/mcp-venv
ENV PATH="/opt/mcp-venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ── Application files ──────────────────────────────────────────────────────
WORKDIR /opt/api-routes-mcp
COPY mcp_server.py .
COPY tools.py .
COPY api_server.py .
COPY main.py .

# ── Entrypoint ─────────────────────────────────────────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Environment ────────────────────────────────────────────────────────────
ENV KR_BIN=/usr/local/bin/kr
ENV FFUF_BIN=/usr/local/bin/ffuf
ENV WORDLISTS_DIR=/opt/kiterunner/wordlists
ENV TEXT_WORDLISTS_DIR=/opt/wordlists
ENV MCP_PORT=8003

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -sS -m 2 http://localhost:8003/sse >/dev/null; \
    res=$?; [ $res -eq 0 ] || [ $res -eq 28 ] || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["mcp", "--sse"]
