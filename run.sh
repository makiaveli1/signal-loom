#!/usr/bin/env bash
set -euo pipefail

# Signal Loom — production-ish local launcher
#
# Usage:
#   HERMES_API_KEY=... ./run.sh [port]
#   API_SERVER_KEY=... ./run.sh [port]
#   OPENCLAW_GATEWAY_TOKEN=... ./run.sh [port]
#
# Defaults:
#   port: 3098
#   Hermes API URL: http://127.0.0.1:8642
#
# No secrets are stored in this script. Put local credentials in your shell,
# ~/.hermes/.env, systemd environment, or another private secret store.

PORT="${1:-3098}"
HERMES_API_URL="${HERMES_API_URL:-${NEXT_PUBLIC_HERMES_API_URL:-http://127.0.0.1:8642}}"
AUTH_TOKEN="${HERMES_API_KEY:-${API_SERVER_KEY:-${OPENCLAW_GATEWAY_TOKEN:-}}}"

if [[ -z "$AUTH_TOKEN" ]]; then
  cat >&2 <<'EOF'
Signal Loom needs a server-side Hermes/OpenClaw token.
Set one of these before launching:
  HERMES_API_KEY
  API_SERVER_KEY
  OPENCLAW_GATEWAY_TOKEN
EOF
  exit 1
fi

cd "$(dirname "$0")"

echo "Starting Signal Loom on http://localhost:${PORT}"
echo "Hermes API: ${HERMES_API_URL}"

# Kill any existing instance on this port.
fuser -k "${PORT}/tcp" 2>/dev/null || true

NEXT_PUBLIC_HERMES_API_URL="$HERMES_API_URL" \
HERMES_API_KEY="$AUTH_TOKEN" \
API_SERVER_KEY="${API_SERVER_KEY:-}" \
OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}" \
npm run start -- --port "$PORT" &>/tmp/signal-loom.log &

PID=$!
echo "Signal Loom PID: ${PID}"
echo "Logs: tail -f /tmp/signal-loom.log"
echo "Stop: kill ${PID}"
