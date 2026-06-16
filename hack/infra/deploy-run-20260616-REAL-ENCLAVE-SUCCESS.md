# Successful Deployment Run (Real Enclave Main) — 2026-06-16

## Result: SUCCESS (rc=0)

**ok=604, changed=162, failed=0, skipped=181**
**Total time: 1h24m31s**

## Key Difference vs Mock
This run uses the **real enclave from `main`** branch (post-PR #482 merge),
including the OSAC plugin with chart-managed AAP. Previous runs used enclave-mock.

## Environment
- **Host**: rdu-infra-edge-03.infra-edge.lab.eng.rdu2.redhat.com
- **Wizard VM**: 192.168.122.219 (CentOS Stream 9, 4GB/2CPU)
- **BM VMs**: 3x enclave-cp (32GB RAM, 16 CPU, 2x120GB disks, PXE boot)
- **Sushy-tools**: SUSHY_EMULATOR_IGNORE_BOOT_DEVICE=True
- **OCP version**: 4.20.21
- **Enclave**: rh-ecosystem-edge/enclave main (post-PR #482)
- **Branch**: feat/osac-services-and-deployment-fixes
- **Wizard flags**: --no-auth --record

## Timeline
| Time (EDT) | Duration | Event |
|---|---|---|
| 10:13 | 0:00 | Deploy triggered |
| 10:22 | 0:09 | VMs booted, 3-min pause |
| 10:25 | 0:12 | Bootstrap wait started |
| 10:35 | 0:22 | All nodes rebooted to disk (boot order OK) |
| 10:46 | 0:33 | Bootstrap complete |
| 11:03 | 0:50 | **OCP Install complete** |
| 11:05 | 0:52 | MCH wait started |
| 11:10 | 0:57 | MCH reached Running (~5 min) |
| 11:16 | 1:03 | QuayRegistry wait started |
| 11:25 | 1:12 | Quay user created (DNS fix OK) |
| 11:37 | 1:24 | Discovery/Day2 phase |
| 11:38 | 1:24 | **FULL SUCCESS** |

## Recordings
Saved to `fixtures/recordings-real-enclave/` and `fixtures/recordings/`:
- `playbooks-main.yaml.json` (12MB) — full deploy recording
- `playbooks-validate-plugins.yaml.json` (344KB)
- `playbooks-validation-validate-schema.yaml--validate-config.json` (184KB)

## Credentials
- **Wizard**: https://rdu-infra-edge-03:3443/wizard (no auth)
- **OCP Console**: kubeadmin / TBNQw-TnewM-z5bip-wfUZ8
- **VM SSH**: ssh -J root@rdu-infra-edge-03 wizard@192.168.122.219

## Top Tasks by Duration
| Task | Duration |
|---|---|
| Wait for bootstrap | 1266s |
| Wait for installation | 1026s |
| MCH ready | 312s |
| QuayRegistry available | 247s |
| ClusterImageSet cleanup | 231s |
| Baremetal reboot pause | 180s |
| TektonConfig ready | 161s |
| Quay rolling update | 89s |
| Hosts ready | 87s |
