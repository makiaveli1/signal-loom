#!/bin/bash
# Signal Loom — Start script
# Usage: ./run.sh [port]
#
# Defaults: port 3098
#
# Requires:
#   - OpenClaw gateway running at http://127.0.0.1:18789
#   - Token: ccca40c6fd27f7f8be0d2bf638012200e38f48491f82d715

PORT="${1:-3098}"

GATEWAY_URL="http://127.0.0.1:18789"
GATEWAY_TOKEN="ccca40c6fd27f7f8be0d2bf638012200e38f48491f82d715"

echo "Starting Signal Loom on port $PORT..."
echo "Gateway: $GATEWAY_URL"

# Kill any existing instance on this port
fuser -k ${PORT}/tcp 2>/dev/null || true

# Start Signal Loom with gateway credentials
cd "$(dirname "$0")"
NEXT_PUBLIC_OPENCLAW_GATEWAY_URL="$GATEWAY_URL" \
NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
npm run start -- --port "$PORT" &>/tmp/signal-loom.log &

PID=$!
echo "Signal Loom: http://localhost:$PORT (PID $PID)"
echo ""
echo "Logs: tail -f /tmp/signal-loom.log"
echo "To stop: kill $PID"
