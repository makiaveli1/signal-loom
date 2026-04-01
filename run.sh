#!/bin/bash
# Signal Loom — Start script
# Usage: ./run.sh [port]
#
# Defaults:
#   Port: 3099
#   Preview server: localhost:4312 (Brian McGarry concept)

PORT="${1:-3099}"
PREVIEW_PORT="${PREVIEW_PORT:-4312}"
PREVIEW_DIR="${PREVIEW_DIR:-/home/likwid/.openclaw/workspace/LEADS/brian-mcgarry-plumber}"

echo "Starting Signal Loom on port $PORT..."
echo "Brian concept preview: http://localhost:$PREVIEW_PORT/"

# Kill any existing instances on these ports
fuser -k ${PORT}/tcp 2>/dev/null || true
fuser -k ${PREVIEW_PORT}/tcp 2>/dev/null || true

# Start Brian's concept preview server
(cd "$PREVIEW_DIR" && python3 -m http.server "$PREVIEW_PORT" --bind 127.0.0.1 &>/dev/null &) &
PREVIEW_PID=$!

# Start Signal Loom
cd "$(dirname "$0")"
npm run start -- --port "$PORT" &>/tmp/signal-loom.log &
APP_PID=$!

echo "Signal Loom: http://localhost:$PORT (PID $APP_PID)"
echo "Brian preview: http://localhost:$PREVIEW_PORT/ (PID $PREVIEW_PID)"
echo ""
echo "To stop:"
echo "  kill $APP_PID $PREVIEW_PID"
