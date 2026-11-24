# Recording Enclave Deployments

Record real ansible-runner output from a live enclave deployment for use with the wizard's replay mode.

## Prerequisites

- SSH key access to a hypervisor host (e.g., `rdu-infra-edge-03.infra-edge.lab.eng.rdu2.redhat.com`)
- Host has: libvirt, podman, virt-install, 48GB+ RAM, 200GB+ disk
- An OpenShift pull secret from [console.redhat.com](https://console.redhat.com/openshift/downloads#tool-pull-secret)

## Quick start

```bash
hack/infra/deploy-with-recording.sh \
  --host root@rdu-infra-edge-03.infra-edge.lab.eng.rdu2.redhat.com \
  --pull-secret ~/pull-secret.json
```

This will:
1. Build RPMs with dev tags (`--record` flag enabled)
2. Deploy the wizard VM via the e2e infrastructure
3. Set up bare metal emulation (sushy-tools + 3 UEFI VMs)
4. Update `demo-params.json` with infra parameters and wizard credentials
5. Fill the wizard via Playwright (using `fill-demo-params.spec.ts`)
6. Trigger deployment and record all ansible output
7. Download recordings to `fixtures/recordings/`

Takes 60-90 minutes for a full run.

## Interactive mode

Use `--interactive` to open a headed browser and pause at the Review step,
so you can inspect the config and click Deploy manually:

```bash
hack/infra/deploy-with-recording.sh \
  --host root@rdu-infra-edge-03.infra-edge.lab.eng.rdu2.redhat.com \
  --pull-secret ~/pull-secret.json \
  --interactive
```

## Skip flags

Re-run faster by skipping completed steps:

```bash
# Skip RPM build (reuse existing)
--skip-build

# Skip wizard VM deploy (reuse running VM)
--skip-deploy

# Skip BM emulation setup (VMs + sushy-tools already running)
--skip-infra
```

## Manual setup

### 1. Set up bare metal emulation on the host

```bash
scp hack/infra/setup-bm-emulation.sh root@host:/tmp/
ssh root@host bash /tmp/setup-bm-emulation.sh
```

This creates:
- `enclave-bmc` libvirt network (192.168.223.0/24) with DNS
- sushy-tools container with SSL on port 8100
- 3 UEFI VMs (`enclave-cp-{0,1,2}`) — shut off, ready for Ironic

### 2. Tear down

```bash
scp hack/infra/teardown-bm-emulation.sh root@host:/tmp/
ssh root@host bash /tmp/teardown-bm-emulation.sh
```

## Recordings

After a deployment, recordings are saved as single JSON files:

| File | Scenario |
|------|----------|
| `playbooks-validation-validate-schema.yaml--validate-config.json` | Schema validation |
| `playbooks-validate-plugins.yaml.json` | Plugin validation |
| `playbooks-main.yaml.json` | Full deployment |

## Replaying recordings

Build the wizard in dev mode and run with `--replay`:

```bash
go build -tags dev -o enclave-wizard .
./enclave-wizard --replay --enclave-dir ../enclave
```

Speed control: `--speed 0` (instant), `--speed 1` (real-time), `--speed 10` (10x faster).

## Architecture

```
Developer Machine
    |
    | ssh
    v
Hypervisor Host (rdu-infra-edge-03)
    |
    ├── enclave-bmc network (192.168.223.0/24)
    │   ├── sushy-tools :8100 (Redfish BMC emulator, SSL)
    │   ├── enclave-cp-0 VM (16GB, 8 vCPU, UEFI)
    │   ├── enclave-cp-1 VM
    │   └── enclave-cp-2 VM
    |
    └── default network (192.168.122.0/24)
        └── enclave-wizard-lz VM
            ├── enclave-wizard service (:3443, --record mode)
            ├── Ironic container (manages VMs via Redfish)
            └── /opt/enclave/ (playbooks, config, artifacts)
```
