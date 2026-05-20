#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT/.dev-logs"

if [[ ! -d "$PID_DIR" ]]; then
  echo "No .dev-logs — nothing to stop."
  exit 0
fi

for f in "$PID_DIR"/*.pid; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f" .pid)
  pid=$(cat "$f")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "Stopped $name (pid $pid)"
  fi
  rm -f "$f"
done

echo "Done."
