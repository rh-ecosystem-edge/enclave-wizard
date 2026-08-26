---
name: e2e-testing
description: Run end-to-end tests for enclave-wizard against a remote host. Use when the user asks to run e2e tests, deploy the wizard for testing, rerun tests, run a specific test, or tear down a test environment.
---

# E2E Testing for Enclave Wizard

## Overview

E2E tests deploy the wizard as RPMs into a libvirt VM on a remote host, then run API-level tests over SSH. The flow is: **build RPMs -> deploy VM -> run tests -> teardown**.

## Prerequisites on Target Host

- libvirt + virsh + qemu-img + virt-install + virt-customize
- iptables, sysctl
- SSH key access configured (no password prompts)
- Internet access (to download CentOS Stream 9 cloud image on first run)
- ~20GB disk space for VM images

## IMPORTANT: Always confirm before tearing down

**Default to leaving the VM running** (`--skip-teardown` or `make e2e-rerun`). Always ask the user before running with teardown — they often want to inspect the VM manually after tests.

## Commands

All commands require `TARGET=user@host` (e.g., `TARGET=root@myserver.example.com`).

### Full run (build + deploy + test, NO teardown) — preferred default

```bash
hack/e2e/run-e2e.sh --host root@host --skip-teardown
```

Builds RPMs, deploys a CentOS 9 VM, runs all tests, and **leaves the VM running** so the user can inspect it. Use `make rpm` first if the RPMs aren't built yet, or use `make e2e` with the caveat below.

**Timeout**: The full run takes 5-10 minutes. The RPM build alone takes ~2 minutes (container-based Go and UI builds). VM boot + cloud-init takes ~1-2 minutes.

### Full run WITH teardown (ask user first!)

```bash
make e2e TARGET=root@host
```

Same as above but **destroys the VM after tests**. Only use this if the user explicitly confirms they don't need the VM afterward.

### Rerun tests without redeploying

```bash
make e2e-rerun TARGET=root@host
```

Equivalent to `--skip-deploy --skip-teardown`. Use this for rapid iteration on test logic or code changes after the initial deployment.

### Run a specific test

```bash
hack/e2e/run-e2e.sh --host root@host --test config_download --skip-deploy --skip-teardown
```

The `--test` flag takes the test name without the `test_` prefix or `.sh` suffix.

### Available tests

| Test name              | What it covers                                                    |
|------------------------|-------------------------------------------------------------------|
| `auth`                 | Login, password change, token validation, token revocation        |
| `config_download`      | Write config via API, verify YAML files on disk, schema validation|
| `config_preview`       | Config preview endpoint, section-level endpoints                  |
| `connected_lvms`       | Connected deployment with LVMS storage                            |
| `connected_rhoai`      | Connected deployment with LVMS + NVIDIA GPU + OpenShift AI        |
| `disconnected_odf_gpu` | Disconnected deployment with ODF + GPU + Quay                     |
| `invalid_combinations` | Plugin validation endpoint (valid/invalid/missing plugins)        |
| `provision`            | Provision endpoint (currently returns 404 - not yet implemented)  |
| `provision_config`     | Write config, verify on disk, validate schema                     |
| `round_trip`           | Comprehensive field-by-field config write/read round trip          |

### Teardown only

```bash
make teardown TARGET=root@host
```

Manually destroys the VM and cleans up iptables rules. Useful if a previous run was interrupted.

### Browser-based UI tests

```bash
make e2e-browser WIZARD_URL=https://host:3443
```

Runs Playwright-based UI tests (separate from the API e2e tests above).

## Architecture

```
Developer Machine
    |
    | ssh
    v
Target Host (e.g., root@rdu-infra-edge-03...)
    |
    | virsh / libvirt
    v
VM: enclave-wizard-lz (CentOS Stream 9)
    - /usr/local/bin/enclave-wizard (systemd service)
    - /opt/enclave/ (schemas, playbooks, config)
    - Ports 3001 (HTTP->HTTPS redirect), 3443 (HTTPS)
    - User: wizard (sudo NOPASSWD)
    - TLS: self-signed cert generated at RPM install
```

Port forwarding via iptables DNAT on the target host makes the VM ports accessible externally.

## Test Infrastructure

Tests are bash scripts under `hack/e2e/`. They source `hack/e2e/helpers.sh` which provides:

- `vm_exec "command"` - Run a command inside the VM (SSH jump through target host)
- `host_exec "command"` - Run a command on the target host
- `api_get/api_put/api_post/api_call` - Authenticated API calls via curl inside the VM
- `api_login` - Auto-login handling initial password change
- `assert_ok`, `assert_contains`, `assert_not_contains` - Output assertions
- `assert_field` - JSON field assertions (uses jq)
- `assert_http_code`, `assert_http_code_no_auth`, `assert_http_code_with_token` - HTTP status assertions
- `validate_enclave_schema` - Python jsonschema validation of config against enclave schemas
- `validate_enclave_config` - Runs enclave's own validations.sh

### Password management

1. Initial password is generated at RPM install and stored in `/etc/enclave-wizard/password` on the VM
2. `api_login()` reads it, logs in, and handles the mandatory first-login password change
3. New password is persisted to `/tmp/enclave-wizard-current-pass` inside the VM
4. Subsequent tests auto-login via `helpers.sh` sourcing

### Writing a new test

Create `hack/e2e/test_yourname.sh`:

```bash
#!/usr/bin/env bash
# Short description of what this test covers
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

# helpers.sh auto-logs-in unless SKIP_AUTH=true is set before sourcing
# TOKEN is now set, use api_get/api_put/api_post for API calls

assert_http_code "GET config returns 200" 200 GET /api/v1/config

config=$(api_get /api/v1/config)
assert_field "baseDomain set" '.global.baseDomain' "expected-value" "${config}"
```

Set `SKIP_AUTH=true` before sourcing helpers.sh if your test needs to handle authentication itself (like the auth test does).

## Debugging

- **Check VM status**: `ssh root@host "virsh list --all"`
- **SSH into VM directly**: `ssh -J root@host wizard@VM_IP` (get VM_IP from `virsh domifaddr enclave-wizard-lz`)
- **Check wizard service**: `vm_exec "sudo systemctl status enclave-wizard"`
- **Check wizard logs**: `vm_exec "sudo journalctl -u enclave-wizard --no-pager -n 100"`
- **Check config files**: `vm_exec "cat /opt/enclave/config/global.yaml"`

## Build Details

`make deploy` runs two independent build steps before provisioning:

1. **`make rpm`** (`hack/rpm/build-rpm.sh`) - Builds only the `enclave-wizard` RPM (binary + systemd service). No longer builds an enclave RPM.
2. **`make enclave-tarball`** (`hack/fetch-enclave.sh`) - Clones enclave at `ENCLAVE_VERSION` on the local machine (not the VM), applies overrides from `hack/enclave/`, and packages it as `out/enclave-repo.tar.gz`.

On the VM, `hack/deploy-wizard` extracts that tarball to `/opt/enclave` and runs enclave's own `setup_env.sh` (system packages, as root) and `setup_ansible.sh` (uv/ansible/collections, as the `wizard` user) — the same install path documented in enclave's own README, instead of an RPM. It then adds `ansible-runner` into that same uv tool env (required by the wizard, not by enclave itself) and points the wizard at it via `/etc/enclave-wizard/environment`.

Environment variables:
- `ENCLAVE_REPO` - Git URL for enclave repo (default: upstream GitHub)
- `ENCLAVE_VERSION` - Git ref to clone: branch, tag, or commit SHA (default: `main`, or the local `../enclave` checkout's SHA if present)

Output goes to `out/` directory.
