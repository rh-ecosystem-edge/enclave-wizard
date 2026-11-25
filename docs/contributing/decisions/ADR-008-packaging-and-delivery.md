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

Operator-oriented steps also appear in [deployment.md](../../deployment.md);
where that guide and this ADR disagree, prefer the RPM/spec and
`hack/deploy-wizard` behavior described here until the guide is updated.

## Decision

1. **RPM as the install unit** — Ship `enclave-wizard` as an RPM built via
   `make rpm` (containerized cross-compile and packaging). The RPM installs a
   single binary at `/usr/local/bin/enclave-wizard` and
   `enclave-wizard.service`. It does **not** ship a separate UI container
   image or nginx quadlet.
2. **One native systemd service** — `enclave-wizard.service` runs the binary
   with access to the Enclave directory and host tools (ansible, oc, make,
   and related LZ utilities). The process serves the HTTP API and the UI.
3. **Embedded UI in the binary** — Production RPM installs use
   `//go:embed` of `ui/apps/wizard/dist`. The binary serves the embedded UI
   and terminates TLS (HTTPS primary; HTTP redirects). This is the supported
   `make deploy` / RPM path, not only a CI convenience.
4. **Alternate nginx/quadlet layout** — `hack/provision.sh` can install an
   nginx config and an `enclave-wizard-ui` podman quadlet that proxies to the
   API. That path is separate from the RPM package contents and is **not**
   what `make deploy` installs today.
5. **Remote deploy helper** — `make deploy TARGET=…` (and teardown) automate
   VM provisioning on a libvirt host, RPM install, and host port forwarding.
   That automation is the supported integration path for e2e-style installs;
   it is not a second product architecture.

## Alternatives Considered

### UI always via nginx container (podman quadlet) on the RPM path

- Pros: Split static UI from API process; matches some older docs/diagrams
- Cons: RPM and `enclave-wizard.service` do not install that layout;
  `hack/provision.sh` is a separate path
- Rejected (as-built for RPM/deploy): Embedded UI in the single binary

### All-in-one container for API + UI

- Pros: Familiar cloud-native packaging
- Cons: API needs host access to the Enclave tree and ansible tooling; LZ
  model favors a native systemd service
- Rejected (as-built): Native `enclave-wizard` systemd unit

### Distribute only source / `go install` for operators

- Pros: No RPM pipeline
- Cons: Operators need Go/Node toolchains on LZ; weak fit for air-gapped or
  standardized installs
- Rejected (as-built): RPM + make deploy

## Consequences

- CI and local Go builds must account for embedded `ui/apps/wizard/dist`
  (stub or real build) per [ADR-001](ADR-001-github-actions-ci.md).
- Packaging changes (embed-only RPM vs reintroducing quadlet on the deploy
  path, RPM layout, enclave tarball coupling) affect deploy scripts and e2e
  assumptions.
- Refactors that replace the embedded-UI RPM model must update this ADR and
  align [deployment.md](../../deployment.md) (which may still describe the
  nginx/quadlet layout).
- Demo/replay and mock Enclave trees are development aids; they do not replace
  this delivery decision (out of scope for the first ADR baseline).
