# Testing

End-to-end tests for the Enclave Configuration Wizard run against a
CentOS Stream 9 VM deployed on a remote libvirt host. The VM runs the
full wizard stack (Go API + nginx/UI container) installed via RPM, with
iptables DNAT forwarding traffic from the host to the VM.

## Quick start

```bash
# Full pipeline: build RPM → deploy VM → run tests → teardown
make e2e TARGET=root@myserver.example.com

# Re-run tests on an existing deployment (no deploy/teardown)
make e2e-rerun TARGET=root@myserver.example.com

# Run a single test
hack/e2e/run-e2e.sh --host root@myserver --test round_trip --skip-deploy --skip-teardown

# Browser tests (Playwright) against a running wizard
make e2e-browser WIZARD_URL=https://myserver.example.com:3443

# Full pipeline including browser tests
make e2e-full TARGET=root@myserver.example.com
```

## Prerequisites

**On the target host (root access required):**

- libvirt + qemu-kvm (`virsh`, `virt-install`, `qemu-img`)
- iptables (for DNAT port forwarding to the VM)
- Internet access (to download the CentOS cloud image on first run)

**On your local machine:**

- SSH key-based access to the target host
- `jq` (used by the round-trip test via `vm_exec`)
- Node.js + Yarn (for Playwright browser tests only)

## Test environment architecture

```
┌─────────────────────────────────────────────────────────┐
│  Target host (e.g. root@myserver.example.com)           │
│                                                         │
│  iptables DNAT:                                         │
│    :3443 ──→ VM:3443 (HTTPS, nginx)                     │
│    :3001 ──→ VM:3001 (HTTP, redirects to HTTPS)         │
│                                                         │
│  ┌───────────────────────────────────────────────┐      │
│  │  VM: enclave-wizard-lz (CentOS Stream 9)      │      │
│  │  4 GB RAM, 2 vCPUs, 20 GB disk                │      │
│  │  User: wizard (sudo, SSH key auth)            │      │
│  │                                               │      │
│  │  ┌─────────────────────────────────────────┐  │      │
│  │  │ enclave-wizard-api (systemd)            │  │      │
│  │  │   Go binary on :8080                    │  │      │
│  │  │   --enclave-dir /opt/enclave            │  │      │
│  │  └─────────────────────────────────────────┘  │      │
│  │  ┌─────────────────────────────────────────┐  │      │
│  │  │ enclave-wizard-ui (podman quadlet)      │  │      │
│  │  │   nginx container, host networking      │  │      │
│  │  │   :3443 HTTPS → proxy /api/v1 → :8080   │  │      │
│  │  │   :3001 HTTP  → 301 redirect to :3443   │  │      │
│  │  │   Self-signed TLS cert                  │  │      │
│  │  └─────────────────────────────────────────┘  │      │
│  │                                               │      │
│  │  /opt/enclave/                                │      │
│  │    config/global.yaml                         │      │
│  │    config/certificates.yaml                   │      │
│  │    config/cloud_infra.yaml                    │      │
│  │    schemas/variables.yaml                     │      │
│  │    schemas/definitions.yaml                   │      │
│  └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Your laptop                         │
│                                      │
│  Bash tests:                         │
│    ssh -J root@host wizard@VM_IP     │
│    → curl inside VM                  │
│                                      │
│  Playwright tests:                   │
│    https://host:3443/wizard          │
│    → iptables DNAT → VM nginx        │
└──────────────────────────────────────┘
```

## Deployment lifecycle

### Deploy (`hack/deploy-wizard TARGET`)

1. Transfers the RPM to the target host
2. Downloads CentOS Stream 9 cloud image (cached after first run)
3. Creates a VM via `virt-install` with cloud-init (installs podman, creates `wizard` user with SSH key)
4. Waits for VM IP and SSH access (up to 2 minutes)
5. Waits for cloud-init to finish, installs the RPM inside the VM
6. Sets up iptables DNAT forwarding from the host to the VM
7. Verifies services: API health, HTTPS, HTTP→HTTPS redirect, external access

### Teardown (`hack/teardown-wizard TARGET`)

1. Removes all iptables NAT/FORWARD rules for ports 3001 and 3443
2. Destroys and undefines the VM (including storage)
3. Cleans up temp files

### Port forwarding (iptables DNAT)

The deploy script uses iptables NAT rules instead of socat or SSH tunnels.
This is necessary because iptables PREROUTING rules operate in the kernel
before firewalld zone rules, allowing external traffic to reach the VM
even when the firewalld zone doesn't explicitly allow the port.

Rules created:

| Chain | Rule | Purpose |
|-------|------|---------|
| `nat PREROUTING` | `--dport 3443 -j DNAT --to VM:3443` | External traffic → VM |
| `nat PREROUTING` | `--dport 3001 -j DNAT --to VM:3001` | External HTTP → VM |
| `nat OUTPUT` | `--dport 3443 -j DNAT --to VM:3443` | Host-local traffic → VM |
| `nat OUTPUT` | `--dport 3001 -j DNAT --to VM:3001` | Host-local HTTP → VM |
| `nat POSTROUTING` | `-d VM_IP -j MASQUERADE` | Return traffic routing |
| `FORWARD` | `-d VM_IP --dports 3001,3443 -j ACCEPT` | Allow forwarded packets |

The FORWARD rule is inserted at position 1 (`iptables -I FORWARD 1`) to
ensure it is evaluated before libvirt's LIBVIRT_FWI chain, which rejects
unsolicited traffic to VM subnets.

Teardown cleans rules by port number (not VM IP) to handle stale rules
from previous deployments with different VM IPs.

## Bash API tests

Tests in `hack/e2e/test_*.sh` exercise the wizard API directly via curl
inside the VM. They are auto-discovered by `run-e2e.sh`.

### Test suite

| Test | Scenario | Key assertions |
|------|----------|----------------|
| `provision_config` | Disconnected + LVMS (original) | Write, read back, YAML files on disk, API + enclave schema validation |
| `connected_lvms` | Connected + LVMS | No Quay config needed, disconnected=false, schema validation |
| `disconnected_odf_gpu` | Disconnected + ODF + GPU | ODF external Ceph config, nvidia-gpu plugin, Quay config |
| `connected_rhoai` | Connected + LVMS + RHOAI | openshift-ai + nvidia-gpu plugins, no Quay |
| `round_trip` | Full-fidelity write/read | Every field verified via jq: scalars, nested objects, arrays, PEM certs, discovery hosts |
| `invalid_combinations` | Plugin validation | Unknown plugins rejected, valid accepted, empty array → 422 |
| `config_preview` | Preview + section endpoints | POST /api/v1/config/preview, GET per-section endpoints |
| `provision` | Provisioning (future API) | Expects 404 — documents expected contract |

### Test structure

Each test follows the same pattern:

```bash
# Description comment (used by run-e2e.sh for --help output)
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: ..."
# ... assertions using helpers
echo "  All checks passed"
```

### Helper functions (`helpers.sh`)

**Execution:**

| Function | Purpose |
|----------|---------|
| `vm_exec CMD` | Run command in VM via SSH jump host |
| `host_exec CMD` | Run command on target host |
| `api_get PATH` | GET request to wizard API (inside VM) |
| `api_put PATH DATA` | PUT with JSON body |
| `api_post PATH DATA` | POST with JSON body |

**Assertions:**

| Function | Purpose |
|----------|---------|
| `assert_ok DESC CMD` | Assert command exits 0 |
| `assert_contains DESC EXPECTED CMD` | Assert stdout contains string |
| `assert_not_contains DESC UNEXPECTED CMD` | Assert stdout does NOT contain string |
| `assert_http_status DESC CODE URL` | Assert HTTP response status |
| `assert_http_code DESC CODE METHOD PATH [BODY]` | Assert status without `-f` (for 4xx/5xx) |
| `assert_field DESC JQ_EXPR EXPECTED JSON` | Assert JSON field value via jq |

**Validation:**

| Function | Purpose |
|----------|---------|
| `validate_enclave_schema` | Validate config against `schemas/variables.yaml` (Python jsonschema) |
| `validate_enclave_config` | Run `validations.sh` from the enclave repo |

### API requirements for test payloads

The API schema enforces these constraints that tests must satisfy:

- `quayUser`, `quayPassword`, `quayBackend` are **always required** (even in connected mode — use placeholder values like `"unused"`)
- `agent_hosts` requires **exactly 3 entries** (minItems: 3)
- `quayUser` and `quayPassword` require **minLength: 1** (empty strings rejected)

## Playwright browser tests

Tests in `ui/apps/wizard/e2e/tests/` drive the wizard UI with a headless
Chromium browser via Playwright.

### Setup

```bash
cd ui/apps/wizard
yarn install
npx playwright install chromium
```

### Running

```bash
# Headless
WIZARD_URL=https://myserver:3443 yarn e2e

# With browser visible
WIZARD_URL=https://myserver:3443 yarn e2e:headed

# Via Makefile
make e2e-browser WIZARD_URL=https://myserver:3443
```

### Test specs

| Spec | Scenario |
|------|----------|
| `connected-lvms.spec.ts` | Full wizard flow: connected + LVMS |
| `disconnected-odf-gpu.spec.ts` | Disconnected + ODF + GPU flavor |
| `connected-rhoai.spec.ts` | Connected + GPU & AI with RHOAI plugin |
| `provision.spec.ts` | Provision trigger + status polling (fake responses) |

### Architecture

**Page Object Model** (`helpers/wizard-page.ts`):

Encapsulates all UI interactions — step navigation, form filling, YAML
review, config generation. Tests never use raw Playwright selectors.

| Method | Purpose |
|--------|---------|
| `goto()` | Navigate to `/wizard` |
| `clickGetStarted()` | Welcome step → next |
| `selectFlavor(title)` | Click a flavor card by title |
| `fillLandingZone(config)` | Fill LZ step: disconnected toggle, Quay, RGW |
| `fillHubCluster(config)` | Fill cluster step: identity, network, storage, auth, hosts, certs |
| `selectGpuPlugin(id)` | Check a GPU/AI plugin checkbox |
| `getYamlContent(tab)` | Read YAML from a Review step tab |
| `clickValidate()` | Validate config in Review step |
| `clickDownloadFiles()` | Download config files from Review step |
| `clickWriteConfiguration()` | Write config in Generate step |
| `waitForWriteSuccess()` | Wait for success confirmation |

**API Helper** (`helpers/wizard-api.ts`):

Wraps wizard API calls with typed responses. Provisioning methods return
fake responses until the API is implemented — only `triggerProvision()`
and `getProvisionStatus()` need to change when the real API lands.

| Method | Status |
|--------|--------|
| `writeConfig(config)` | Working — PUT /api/v1/config |
| `getConfig()` | Working — GET /api/v1/config |
| `validateConfig(config)` | Working — POST /api/v1/config/validate |
| `getDefaults()` | Working — GET /api/v1/defaults |
| `triggerProvision(config)` | **Fake** — returns `{state: "accepted"}` |
| `getProvisionStatus(id)` | **Fake** — returns `{state: "completed"}` |

## BMC emulation with `hack/ew`

The `ew` CLI manages sushy-tools (Redfish BMC emulator) and DNS for
testing with virtual bare-metal hosts.

### Setup BMC VMs

```bash
# Create 3 VMs with Redfish emulation
hack/ew vm create --host root@myserver -n mgmt -c 3

# Output: out/hosts/mgmt-01.yaml, mgmt-02.yaml, mgmt-03.yaml, mgmt-all.yaml
# Each YAML contains: name, MAC, UUID, redfish URL, BMC credentials
```

**Network:** `enclave-bmc` (`192.168.223.0/24`)
**Sushy-tools:** Container `enclave-sushy-tools` on `192.168.223.1:8100`
**VM defaults:** 16 GB RAM, 4 vCPUs, 100 GB disk

### DNS management

```bash
hack/ew dns create --host root@myserver
hack/ew dns add --host root@myserver --name api.mgmt.example.com --ip 192.168.223.200
hack/ew dns add --host root@myserver --name "*.apps.mgmt.example.com" --ip 192.168.223.201
hack/ew dns list --host root@myserver
hack/ew dns destroy --host root@myserver
```

**dnsmasq:** Container `enclave-dnsmasq` on `192.168.223.1:5353`

### Cleanup

```bash
hack/ew vm destroy --host root@myserver -n mgmt -c 3
hack/ew vm destroy --host root@myserver -n mgmt --all  # also removes sushy-tools and network
```

## Troubleshooting

**Deploy fails at RPM install with "podman is needed":**
Cloud-init hasn't finished installing packages. The deploy script waits
for `cloud-init status --wait` but this can take a minute on slow networks.

**External access fails (HTTPS external: FAIL):**
Check iptables rules on the target: `iptables -t nat -L PREROUTING -n | grep 3443`.
Stale rules from old VMs (different IPs) can shadow new rules. Teardown
and redeploy to clean them.

**Tests fail at "Write config via API":**
The API requires all fields including `quayUser`/`quayPassword` even in
connected mode (use `"unused"` as placeholder). Also requires exactly 3
entries in `agent_hosts`.

**VM SSH access:**
```bash
ssh -J root@myserver wizard@VM_IP
# Find VM IP:
ssh root@myserver "virsh domifaddr enclave-wizard-lz"
```

**Service logs inside VM:**
```bash
ssh -J root@myserver wizard@VM_IP \
  "sudo journalctl -u enclave-wizard-api -u enclave-wizard-ui --no-pager -n 50"
```
