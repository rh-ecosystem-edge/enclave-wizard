#!/usr/bin/env bash
# Shared helpers for e2e tests

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
API="https://localhost:3443"
TOKEN=""
E2E_PASSWORD="e2e-test-password-$(date +%s)"

# Run a command inside the VM (via target host, base64-encoded to avoid quoting issues)
vm_exec() {
    local encoded
    encoded=$(echo "$*" | base64 -w0)
    ssh ${SSH_OPTS} "${TARGET}" "ssh ${SSH_OPTS} cloud-user@${VM_IP} 'echo ${encoded} | base64 -d | bash'"
}

# Run a command on the target host
host_exec() {
    ssh -o StrictHostKeyChecking=no "${TARGET}" "$@"
}

# Authenticate with the wizard API.
# Tries /tmp/enclave-wizard-current-pass first (set by a previous test run
# that changed the password), then falls back to the RPM-installed initial
# password in /tmp/enclave-wizard-init-pass.
# Sets TOKEN and changes the password if mustChangePassword is true,
# persisting the new password for subsequent tests.
api_login() {
    local password=""
    password=$(vm_exec "cat /tmp/enclave-wizard-current-pass 2>/dev/null | tr -d '[:space:]'" || true)
    if [ -z "${password}" ]; then
        password=$(vm_exec "cat /tmp/enclave-wizard-init-pass 2>/dev/null | tr -d '[:space:]'" || true)
    fi
    if [ -z "${password}" ]; then
        echo "ERROR: Could not read any password from the VM"
        return 1
    fi
    local result
    result=$(vm_exec "curl -sk -X POST https://localhost:3443/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"${password}\"}'" || true)
    TOKEN=$(echo "${result}" | jq -r '.token // empty')
    if [ -z "${TOKEN}" ]; then
        echo "ERROR: Login failed. Response: ${result}"
        return 1
    fi
    local must_change
    must_change=$(echo "${result}" | jq -r '.mustChangePassword')
    if [ "${must_change}" = "true" ]; then
        result=$(vm_exec "curl -sk -X POST https://localhost:3443/api/v1/auth/password -H 'Content-Type: application/json' -H 'Authorization: Bearer ${TOKEN}' -d '{\"currentPassword\":\"${password}\",\"newPassword\":\"${E2E_PASSWORD}\"}'" || true)
        TOKEN=$(echo "${result}" | jq -r '.token // empty')
        if [ -z "${TOKEN}" ]; then
            echo "ERROR: Password change failed. Response: ${result}"
            return 1
        fi
        vm_exec "echo -n '${E2E_PASSWORD}' > /tmp/enclave-wizard-current-pass"
    fi
}

# Call the wizard API (via SSH tunnel through target → VM)
api_call() {
    local method="$1"
    local path="$2"
    shift 2
    vm_exec "curl -sfk -X ${method} https://localhost:3443${path} -H 'Content-Type: application/json' -H 'Authorization: Bearer ${TOKEN}' $*"
}

api_get() {
    api_call GET "$1"
}

api_put() {
    local path="$1"
    local data="$2"
    vm_exec "curl -sfk -X PUT https://localhost:3443${path} -H 'Content-Type: application/json' -H 'Authorization: Bearer ${TOKEN}' -d '${data}'"
}

api_post() {
    local path="$1"
    local data="$2"
    vm_exec "curl -sfk -X POST https://localhost:3443${path} -H 'Content-Type: application/json' -H 'Authorization: Bearer ${TOKEN}' -d '${data}'"
}

# Assert a command succeeds
assert_ok() {
    local desc="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        echo "    ✓ ${desc}"
    else
        echo "    ✗ ${desc}"
        return 1
    fi
}

# Assert a command output contains a string
assert_contains() {
    local desc="$1"
    local expected="$2"
    shift 2
    local output
    output=$("$@" 2>&1)
    if echo "${output}" | grep -q "${expected}"; then
        echo "    ✓ ${desc}"
    else
        echo "    ✗ ${desc} (expected '${expected}' in output)"
        echo "      got: ${output:0:200}"
        return 1
    fi
}

# Assert HTTP status code
assert_http_status() {
    local desc="$1"
    local expected="$2"
    local url="$3"
    local status
    status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' '${url}'" 2>/dev/null || true)
    if [ "${status}" = "${expected}" ]; then
        echo "    ✓ ${desc} (${status})"
    else
        echo "    ✗ ${desc} (expected ${expected}, got ${status})"
        return 1
    fi
}

# Assert a command output does NOT contain a string
assert_not_contains() {
    local desc="$1"
    local unexpected="$2"
    shift 2
    local output
    output=$("$@" 2>&1)
    if echo "${output}" | grep -q "${unexpected}"; then
        echo "    ✗ ${desc} (found unexpected '${unexpected}' in output)"
        return 1
    else
        echo "    ✓ ${desc}"
    fi
}

# Assert a JSON field has an exact value (requires jq on the VM)
assert_field() {
    local desc="$1"
    local jq_expr="$2"
    local expected="$3"
    local json="$4"
    local actual
    actual=$(echo "${json}" | jq -r "${jq_expr}")
    if [ "${actual}" = "${expected}" ]; then
        echo "    ✓ ${desc}"
    else
        echo "    ✗ ${desc} (expected '${expected}', got '${actual}')"
        return 1
    fi
}

# Assert HTTP status code (without -f, so we can inspect 4xx/5xx).
# Includes Authorization header when TOKEN is set.
assert_http_code() {
    local desc="$1"
    local expected="$2"
    local method="$3"
    local path="$4"
    local body="${5:-}"
    local auth_header=""
    if [ -n "${TOKEN}" ]; then
        auth_header="-H 'Authorization: Bearer ${TOKEN}'"
    fi
    local status
    if [ -n "${body}" ]; then
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path} -H 'Content-Type: application/json' ${auth_header} -d '${body}'")
    else
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path} ${auth_header}")
    fi
    if [ "${status}" = "${expected}" ]; then
        echo "    ✓ ${desc} (${status})"
    else
        echo "    ✗ ${desc} (expected ${expected}, got ${status})"
        return 1
    fi
}

# Assert HTTP status code WITHOUT any auth header (for testing unauthenticated access)
assert_http_code_no_auth() {
    local desc="$1"
    local expected="$2"
    local method="$3"
    local path="$4"
    local body="${5:-}"
    local status
    if [ -n "${body}" ]; then
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path} -H 'Content-Type: application/json' -d '${body}'")
    else
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path}")
    fi
    if [ "${status}" = "${expected}" ]; then
        echo "    ✓ ${desc} (${status})"
    else
        echo "    ✗ ${desc} (expected ${expected}, got ${status})"
        return 1
    fi
}

# Assert HTTP status code with a specific Authorization header (or none)
assert_http_code_with_token() {
    local desc="$1"
    local expected="$2"
    local method="$3"
    local path="$4"
    local token="${5:-}"
    local body="${6:-}"
    local auth_header=""
    if [ -n "${token}" ]; then
        auth_header="-H 'Authorization: Bearer ${token}'"
    fi
    local status
    if [ -n "${body}" ]; then
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path} -H 'Content-Type: application/json' ${auth_header} -d '${body}'")
    else
        status=$(vm_exec "curl -sk -o /dev/null -w '%{http_code}' -X ${method} https://localhost:3443${path} ${auth_header}")
    fi
    if [ "${status}" = "${expected}" ]; then
        echo "    ✓ ${desc} (${status})"
    else
        echo "    ✗ ${desc} (expected ${expected}, got ${status})"
        return 1
    fi
}

# Run enclave's validate-schema against the config written by the wizard
validate_enclave_schema() {
    vm_exec "
        cd /opt/enclave
        sudo python3 -c '
import yaml, sys
try:
    from jsonschema import validate, ValidationError
except ImportError:
    print(\"SKIP: jsonschema not installed\")
    sys.exit(0)

with open(\"schemas/variables.yaml\") as f:
    schema = yaml.safe_load(f)
with open(\"schemas/definitions.yaml\") as f:
    defs = yaml.safe_load(f)
with open(\"config/global.yaml\") as f:
    config = yaml.safe_load(f)

schema[\"definitions\"] = defs.get(\"definitions\", {})

try:
    validate(instance=config, schema=schema)
    print(\"Schema validation: PASS\")
except ValidationError as e:
    print(f\"Schema validation: FAIL - {e.message}\")
    sys.exit(1)
except Exception as e:
    print(f\"Schema validation: SKIP - {e}\")
    sys.exit(0)
'
    "
}

# Run enclave's validations.sh
validate_enclave_config() {
    vm_exec "cd /opt/enclave && bash validations.sh 2>&1"
}

# Auto-login when sourced (unless SKIP_AUTH is set, e.g. for auth tests)
if [ "${SKIP_AUTH:-}" != "true" ]; then
    api_login
fi
