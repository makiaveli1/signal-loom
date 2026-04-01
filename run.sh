#!/bin/bash
# Signal Loom — Start script
# Usage: ./run.sh [port]
#
# Defaults: port 3000

PORT="${1:-3000}"

echo "Starting Signal Loom on port $PORT..."

# Kill any existing instance on this port
fuser -k ${PORT}/tcp 2>/dev/null || true

# Start Signal Loom
cd "$(dirname "$0")"
npm run start -- --port "$PORT" &>/tmp/signal-loom.log &

echo "Signal Loom: http://localhost:$PORT (PID $!)"
echo ""
echo "To stop: kill \$(pgrep -f 'next start.*${PORT}')"
