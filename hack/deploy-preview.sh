#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARY="$ROOT_DIR/bin/enclave-wizard"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <user@host> [PORT]"
  echo "Example: $0 root@myserver.example.com 3443"
  exit 1
fi

TARGET="$1"
PORT="${2:-3443}"
HTTP_PORT=$((PORT - 442))
TARGET_HOST="${TARGET#*@}"

REMOTE_DIR="/opt/enclave-wizard-preview-${PORT}"
SSH="ssh -o StrictHostKeyChecking=no"
SCP="scp -o StrictHostKeyChecking=no -q"

if [ ! -f "$BINARY" ]; then
  echo "Binary not found. Building..."
  make -C "$ROOT_DIR" build-ui
  mkdir -p "$ROOT_DIR/bin"
  podman run --rm -v "$ROOT_DIR:/app:z" -w /app golang:latest \
    sh -c "CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags='-w -s' -tags dev -o bin/enclave-wizard ."
fi

echo "=== Deploying preview to ${TARGET} on port ${PORT} ==="

echo "[1/3] Transferring binary..."
${SCP} "$BINARY" "${TARGET}:/tmp/enclave-wizard-${PORT}"

echo "[2/3] Setting up remote..."
${SSH} "${TARGET}" "
set -e
mkdir -p ${REMOTE_DIR}/config ${REMOTE_DIR}/tls

# Stop existing instance on this port
pkill -f 'enclave-wizard.*--https-port ${PORT}' 2>/dev/null || true
sleep 1

mv /tmp/enclave-wizard-${PORT} ${REMOTE_DIR}/enclave-wizard
chmod +x ${REMOTE_DIR}/enclave-wizard

# Generate TLS certs using the wizard binary
${REMOTE_DIR}/enclave-wizard generate-cert \
  --cert ${REMOTE_DIR}/tls/server.crt \
  --key ${REMOTE_DIR}/tls/server.key

# Open firewall ports
if command -v firewall-cmd &>/dev/null; then
  firewall-cmd --add-port=${PORT}/tcp 2>/dev/null || true
  firewall-cmd --add-port=${HTTP_PORT}/tcp 2>/dev/null || true
fi
"

echo "[3/3] Starting wizard..."
${SSH} "${TARGET}" "
nohup ${REMOTE_DIR}/enclave-wizard \
  --no-auth \
  --https-port ${PORT} \
  --http-port ${HTTP_PORT} \
  --enclave-dir ${REMOTE_DIR} \
  --password-file ${REMOTE_DIR}/password \
  --tls-cert ${REMOTE_DIR}/tls/server.crt \
  --tls-key ${REMOTE_DIR}/tls/server.key \
  </dev/null >${REMOTE_DIR}/output.log 2>&1 &
sleep 2
head -5 ${REMOTE_DIR}/output.log
"

echo ""
echo "Preview deployed: https://${TARGET_HOST}:${PORT}"
echo "  (Self-signed cert — accept the browser warning)"
echo ""
echo "To stop:  ssh ${TARGET} 'pkill -f \"enclave-wizard.*--https-port ${PORT}\"'"
echo "To logs:  ssh ${TARGET} 'tail -f ${REMOTE_DIR}/output.log'"
