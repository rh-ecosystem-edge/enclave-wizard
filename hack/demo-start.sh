#!/usr/bin/env bash
set -euo pipefail

readonly PROGNAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PID_FILE="/tmp/enclave-wizard-demo.pid"
readonly LOG_FILE="/tmp/enclave-wizard-demo.log"

die() { printf '%s: error: %s\n' "$PROGNAME" "$*" >&2; exit 1; }

stop_existing() {
    if [[ -f "$PID_FILE" ]]; then
        local old_pid
        old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            printf 'Stopping existing demo (PID %s)...\n' "$old_pid"
            kill "$old_pid" 2>/dev/null || true
            sleep 1
        fi
        rm -f "$PID_FILE"
    fi
    pkill -f "enclave-wizard.*--demo-deploy" 2>/dev/null || true
    sleep 0.5
}

wait_for_ready() {
    local port="$1"
    local i
    for i in $(seq 1 10); do
        if curl -sk "https://localhost:${port}/api/v1/auth/mode" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        printf "."
    done
    return 1
}

main() {
    local binary="$ROOT_DIR/bin/enclave-wizard"
    local enclave_dir="${ENCLAVE_DIR:-$ROOT_DIR/hack/enclave}"
    local tls_cert="$ROOT_DIR/hack/tls/server.crt"
    local tls_key="$ROOT_DIR/hack/tls/server.key"
    local password_file="/tmp/enclave-wizard-demo-pass"
    local speed="${SPEED:-10}"
    local port="${PORT:-3443}"

    [[ -x "$binary" ]] || die "binary not found at $binary — run 'make demo-build' first"

    stop_existing

    printf 'Starting demo environment...\n'
    printf '  Enclave dir: %s\n' "$enclave_dir"
    printf '  Speed:       %sx\n' "$speed"
    printf '  Port:        %s\n' "$port"

    "$binary" \
        --enclave-dir "$enclave_dir" \
        --tls-cert "$tls_cert" \
        --tls-key "$tls_key" \
        --password-file "$password_file" \
        --no-auth \
        --demo-deploy \
        --demo-validation \
        --speed "$speed" \
        --https-port "$port" \
        > "$LOG_FILE" 2>&1 &

    printf '%s' "$!" > "$PID_FILE"

    if wait_for_ready "$port"; then
        printf '\n\nDemo running at https://localhost:%s (no auth)\n' "$port"
        printf '  PID: %s\n' "$(cat "$PID_FILE")"
        printf '  Log: %s\n' "$LOG_FILE"
    else
        printf '\n'
        die "failed to start — check $LOG_FILE"
    fi
}

main "$@"
