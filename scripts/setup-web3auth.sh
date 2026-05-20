#!/usr/bin/env bash
# Add or update VITE_WEB3AUTH_CLIENT_ID in Oscorp/frontend/.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/frontend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/frontend/.env.example" "$ENV_FILE"
fi

CLIENT_ID="${1:-}"
if [[ -z "$CLIENT_ID" ]]; then
  echo "Paste your MetaMask Embedded Wallets Client ID"
  echo "(developer.metamask.io → Project → General → Client ID)"
  read -r CLIENT_ID
fi

if [[ -z "$CLIENT_ID" ]]; then
  echo "No Client ID provided." >&2
  exit 1
fi

if grep -q '^VITE_WEB3AUTH_CLIENT_ID=' "$ENV_FILE"; then
  if [[ "$(uname)" == Darwin ]]; then
    sed -i '' "s|^VITE_WEB3AUTH_CLIENT_ID=.*|VITE_WEB3AUTH_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  else
    sed -i "s|^VITE_WEB3AUTH_CLIENT_ID=.*|VITE_WEB3AUTH_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  fi
else
  printf '\nVITE_WEB3AUTH_CLIENT_ID=%s\n' "$CLIENT_ID" >>"$ENV_FILE"
fi

echo "Updated $ENV_FILE"
echo "Restart the frontend: cd frontend && npm run dev"
