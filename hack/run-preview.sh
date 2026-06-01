#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT="${1:-3443}"
HTTP_PORT=$((PORT - 442))
ENCLAVE_DIR="${ENCLAVE_DIR:-$ROOT_DIR/../enclave}"
TLS_DIR="$ROOT_DIR/hack/tls"
PASSWORD_FILE="/tmp/enclave-wizard-preview-${PORT}.pass"

# Generate self-signed TLS certs if missing
if [[ ! -f "$TLS_DIR/server.crt" || ! -f "$TLS_DIR/server.key" ]]; then
  mkdir -p "$TLS_DIR"
  echo "Generating self-signed TLS certificate..."
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$TLS_DIR/server.key" \
    -out "$TLS_DIR/server.crt" \
    -days 365 -nodes -subj '/CN=localhost' 2>/dev/null
fi

# Kill any existing instance on this port
existing_pid=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [[ -n "$existing_pid" ]]; then
  echo "Stopping existing instance on port $PORT (pid $existing_pid)..."
  kill "$existing_pid" 2>/dev/null || true
  sleep 1
fi

echo "Starting preview on https://localhost:${PORT}"
echo "  No auth, demo deploy mode"
echo "  Enclave dir: $ENCLAVE_DIR"
echo ""

exec "$ROOT_DIR/enclave-wizard" \
  --no-auth \
  --demo-deploy \
  --https-port "$PORT" \
  --http-port "$HTTP_PORT" \
  --enclave-dir "$ENCLAVE_DIR" \
  --password-file "$PASSWORD_FILE" \
  --tls-cert "$TLS_DIR/server.crt" \
  --tls-key "$TLS_DIR/server.key"
