# ADR-003: Wizard fronts an Enclave directory tree

## Status

Accepted

## Date

2026-11-25

## Context

Enclave Wizard runs on a Landing Zone (LZ) host and helps operators produce a
valid Enclave deployment. Enclave already owns schemas, playbooks, plugin
definitions, experience profiles, and example config. The wizard must not
become a second source of truth for Enclave product semantics.

This ADR records the as-built boundary between the wizard and the Enclave
repository tree. Alternatives considered at the original design time are not
fully recorded; the text below documents current practice.

## Decision

Treat a filesystem path to an Enclave repository root (`--enclave-dir`) as the
wizard’s integration surface.

1. **Config I/O** — Read and write Enclave config YAML under that tree
   (see [ADR-004](ADR-004-config-yaml-on-disk.md)).
2. **Plugins** — Discover plugins (and related schemas) from the Enclave tree
   at process start; expose them through the API registry.
3. **Experiences** — Load experience definitions from the Enclave tree at
   start; expose them for the UI flavor/experience model
   (see [ADR-007](ADR-007-ui-client-owned-wizard.md)).
4. **Execution** — Run Enclave playbooks via ansible-runner against that tree
   (see [ADR-005](ADR-005-ansible-runner-tasks.md)).
5. **Failure mode** — If plugin or experience discovery fails, log a warning
   and continue with an empty or partial registry rather than refusing to
   start the API process.

Local development may point `--enclave-dir` at `enclave-mock/` or another
fixture tree. That does not change the boundary: the wizard still consumes an
Enclave-shaped directory.

## Alternatives Considered

### Embed Enclave semantics inside the wizard repo

- Pros: Single repo; no path dependency at runtime
- Cons: Duplicates Enclave schemas/playbooks; drifts from the product Enclave
  ships
- Rejected (as-built): Wizard stays a front-end over Enclave artifacts

### Call a remote Enclave control-plane API instead of a local tree

- Pros: Clear service boundary; no shared filesystem
- Cons: No such API is the deployment model today; LZ workflow is file- and
  ansible-based
- Rejected (as-built): Local tree + ansible-runner matches how Enclave is
  operated on the LZ

### Alternatives unknown

Original trade-off discussions are not fully preserved. Gaps above are filled
from current code and operator docs.

## Consequences

- Wizard releases must stay compatible with the Enclave layout they target
  (config paths, plugin/experience discovery, playbooks).
- Contributors extend product behavior in Enclave (plugins, experiences,
  schemas) and wire thin adapters in the wizard (models, API, UI mapping).
- Dev and CI use mock or pinned Enclave trees; production deploy provisions a
  real Enclave tree beside the wizard (see packaging ADR).
- Changing discovery to be mandatory-at-startup would be a behavior change that
  challenges this ADR’s failure-mode choice.
