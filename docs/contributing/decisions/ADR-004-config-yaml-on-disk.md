# ADR-004: Config persistence is YAML on disk

## Status

Accepted

## Date

2026-11-25

## Context

The wizard’s job is to help operators produce Enclave deployment configuration
that existing Enclave tooling already consumes as YAML files under the Enclave
tree. Introducing a separate database or proprietary store would split the
source of truth from what ansible and Enclave playbooks read.

This ADR records the as-built persistence model. Some alternatives are inferred
from current practice.

## Decision

Persist configuration as YAML files in the Enclave `config/` directory (and
related plugin config files) on the local filesystem.

1. **Full document API** — `GET`/`PUT /api/v1/config` loads or replaces the
   aggregated config model and writes YAML to disk.
2. **Section APIs** — `GET`/`PUT /api/v1/config/<section>` read or merge one
   section into the existing on-disk config; other sections stay untouched.
3. **Preview** — `POST /api/v1/config/preview` renders YAML without writing.
4. **Validate** — `POST /api/v1/config/validate` checks config using Enclave
   validation paths (see [ADR-005](ADR-005-ansible-runner-tasks.md)); it is not
   a substitute for a second schema store inside the wizard.
5. **No wizard-owned database** — Process memory holds request/task state only;
   durable config is always the YAML tree
   (see [ADR-003](ADR-003-wizard-fronts-enclave-tree.md)).

Go structs in `internal/models` are the in-process representation and the
OpenAPI schema source (see [ADR-002](ADR-002-huma-openapi-from-go-types.md)).

## Alternatives Considered

### Store config in a relational or document database

- Pros: Transactions, querying, multi-writer patterns
- Cons: Enclave playbooks and operators expect YAML files; dual write or export
  step required
- Rejected (as-built): Files remain the contract with Enclave

### Keep config only in browser/localStorage until deploy

- Pros: Simpler server
- Cons: No shared LZ truth; lose work on another machine; cannot validate with
  server-side Enclave tools reliably
- Rejected (as-built): Server writes YAML; UI may hold draft state in memory
  (see [ADR-007](ADR-007-ui-client-owned-wizard.md))

### Replace-only full-document API (no section merge)

- Pros: Simpler merge semantics
- Cons: UI and API clients often update one area; full replace raises overwrite
  risk
- Rejected (as-built): Section PUTs merge into existing on-disk config

## Consequences

- Backup, review, and gitops-style workflows can treat Enclave `config/` as
  normal files.
- Concurrent writers (two browsers, or manual edits plus API) can still race;
  the product assumes a single operator workflow on the LZ.
- OpenAPI models must stay aligned with YAML shape and Enclave schemas.
- Moving durable config off the filesystem would supersede this ADR and
  [ADR-003](ADR-003-wizard-fronts-enclave-tree.md).
