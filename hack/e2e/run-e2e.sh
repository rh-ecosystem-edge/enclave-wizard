#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

usage() {
    echo "Run enclave wizard e2e tests."
    echo ""
    echo "Usage: $0 --host <user@host> [--test <test-name>] [--skip-deploy]"
    echo ""
    echo "Options:"
    echo "  --host USER@HOST    Target host (required)"
    echo "  --test NAME         Run a specific test (default: all)"
    echo "  --skip-deploy       Skip VM deployment (use existing)"
    echo "  --skip-teardown     Don't tear down after tests"
    echo ""
    echo "Tests:"
    for t in "${SCRIPT_DIR}"/test_*.sh; do
        [ -f "$t" ] || continue
        name=$(basename "$t" .sh | sed 's/^test_//')
        desc=$(head -3 "$t" | grep '^# ' | head -1 | sed 's/^# //')
        echo "  ${name}  — ${desc}"
    done
    exit 1
}

TARGET=""
TEST_FILTER=""
SKIP_DEPLOY=false
SKIP_TEARDOWN=false
LZ_IP=""

while [ $# -gt 0 ]; do
    case "$1" in
        --host)         TARGET="$2"; shift 2;;
        --test)         TEST_FILTER="$2"; shift 2;;
        --lz-ip)        LZ_IP="$2"; shift 2;;
        --skip-deploy)  SKIP_DEPLOY=true; shift;;
        --skip-teardown) SKIP_TEARDOWN=true; shift;;
        -h|--help)      usage;;
        *)              echo "Unknown: $1"; usage;;
    esac
done

[ -z "${TARGET}" ] && usage

SSH="ssh -o StrictHostKeyChecking=no"
LZ_IP_ARGS=""
[ -n "${LZ_IP}" ] && LZ_IP_ARGS="--lz-ip ${LZ_IP}"

# --- Helpers available to test scripts ---
export TARGET SSH REPO_DIR SCRIPT_DIR

PASS=0
FAIL=0
ERRORS=()

run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .sh | sed 's/^test_//')
    echo ""
    echo "━━━ TEST: ${test_name} ━━━"
    if bash -e "$test_file"; then
        echo "  ✓ PASS: ${test_name}"
        PASS=$((PASS + 1))
    else
        echo "  ✗ FAIL: ${test_name}"
        FAIL=$((FAIL + 1))
        ERRORS+=("${test_name}")
    fi
}

# --- Get VM IP ---
get_vm_ip() {
    ${SSH} "${TARGET}" "grep '^LZ_IP=' /tmp/enclave-wizard-env 2>/dev/null | cut -d= -f2"
}

export -f get_vm_ip

# --- Deploy if needed ---
if ! $SKIP_DEPLOY; then
    echo "=== Deploying wizard stack ==="
    "${REPO_DIR}/hack/deploy-wizard" "${TARGET}" ${LZ_IP_ARGS}
fi

VM_IP=$(get_vm_ip)
export VM_IP

if [ -z "${VM_IP}" ]; then
    echo "ERROR: Could not get VM IP"
    exit 1
fi
echo ""
echo "=== Running e2e tests ==="
echo "  Target: ${TARGET}"
echo "  VM IP:  ${VM_IP}"

# --- Run tests ---
if [ -n "${TEST_FILTER}" ]; then
    test_file="${SCRIPT_DIR}/test_${TEST_FILTER}.sh"
    if [ ! -f "${test_file}" ]; then
        echo "ERROR: Test not found: ${test_file}"
        exit 1
    fi
    run_test "${test_file}"
else
    for test_file in "${SCRIPT_DIR}"/test_*.sh; do
        [ -f "${test_file}" ] || continue
        run_test "${test_file}"
    done
fi

# --- Summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ${PASS} passed, ${FAIL} failed"
if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "  Failed:  ${ERRORS[*]}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Teardown ---
if ! $SKIP_TEARDOWN && ! $SKIP_DEPLOY; then
    echo ""
    echo "=== Tearing down ==="
    "${REPO_DIR}/hack/teardown-wizard" "${TARGET}"
fi

[ ${FAIL} -eq 0 ]
