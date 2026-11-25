# ADR-008: Packaging and delivery on the Landing Zone

## Status

Accepted

## Date

2026-11-25

## Context

Operators need a repeatable way to install the wizard next to an Enclave tree
on a Landing Zone (LZ) host (often inside a provisioned VM). The product
includes a Go API and a React UI. Local `go run` / Vite flows are not enough
for that install path.

Operator steps live in [deployment.md](../../deployment.md). This ADR records
the delivery bets.

## Decision

1. **RPM as the install unit** — Ship `enclave-wizard` as an RPM built via
   `make rpm` (containerized cross-compile and packaging). The RPM installs
   the API, UI image/assets, and service units, and participates in pulling or
   laying down Enclave content as documented in the deploy scripts.
2. **API as a native systemd service** — `wizard-api` runs as a host systemd
   unit with access to the Enclave directory and host tools (ansible, oc,
   make, and related LZ utilities).
3. **UI via nginx in a container (podman quadlet)** — In the deploy/RPM path,
   the UI is served by an nginx container that also proxies `/api/v1/*` to the
   API. Ports and TLS termination follow the deployment guide (HTTPS primary).
4. **Embedded UI assets in the Go binary** — The API binary can
   `//go:embed` `ui/apps/wizard/dist` so a single binary can serve UI bits for
   build/CI and simpler run paths. Embed and the containerized UI path
   coexist; production LZ deploy uses the RPM/systemd/quadlet layout above.
5. **Remote deploy helper** — `make deploy TARGET=…` (and teardown) automate
   VM provisioning on a libvirt host, RPM install, and host port forwarding.
   That automation is the supported integration path for e2e-style installs;
   it is not a second product architecture.

## Alternatives Considered

### UI only embedded in the API process (no UI container)

- Pros: One process; simpler networking
- Cons: TLS/static serving and API lifecycle coupled; current RPM path
  separates nginx UI and native API for LZ ops
- Not exclusive (as-built): Embed exists for binary/CI; deploy path still uses
  UI container + systemd API

### All-in-one container for API + UI

- Pros: Familiar cloud-native packaging
- Cons: API needs privileged-style access to Enclave tree and host ansible
  tooling; LZ model favors a native API service
- Rejected (as-built): Native API systemd + UI container

### Distribute only source / `go install` for operators

- Pros: No RPM pipeline
- Cons: Operators need Go/Node toolchains on LZ; weak fit for air-gapped or
  standardized installs
- Rejected (as-built): RPM + make deploy

## Consequences

- CI and local Go builds must account for embedded `ui/apps/wizard/dist`
  (stub or real build) per [ADR-001](ADR-001-github-actions-ci.md).
- Packaging changes (quadlet vs embed-only, RPM layout, enclave tarball
  coupling) affect deploy scripts and e2e assumptions.
- Refactors that replace RPM/systemd/quadlet with another delivery model must
  update this ADR and the deployment guide together.
- Demo/replay and mock Enclave trees are development aids; they do not replace
  this delivery decision (out of scope for the first ADR baseline).
