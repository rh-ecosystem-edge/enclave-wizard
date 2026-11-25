# ADR-007: Client-owned wizard UI over a thin API

## Status

Accepted

## Date

2026-11-25

## Context

Operators need a guided UI to produce Enclave config and trigger deploy. The
API already exposes config, validation, defaults, plugins, experiences, and
tasks (see ADRs 002–006). The UI must stay aligned with OpenAPI/Go models
without becoming a second backend.

Source material for this ADR includes the historical Superpowers UI design
spec (removed after this ADR was written) and the current `ui/` tree. Step
lists and field catalogs are not repeated here; the code and OpenAPI schema
are the live detail.

## Decision

### State ownership

**Option A (as-built):** The browser UI owns wizard session state (step,
draft form data, errors). The API is a thin layer for config
read/write/validate/preview, catalogs (defaults, plugins, experiences), and
task/deploy execution. There is no server-side wizard session store.

### Semi-dynamic forms

- Wizard **steps and groupings** are defined in the UI (hardcoded flow).
- **Fields within steps** are driven from API/OpenAPI (JSON Schema) metadata
  where applicable, so new API fields can appear without a full UI redesign.
- Client-side checks run per step; server validate runs before commit/review
  paths that require Enclave-backed validation.

### Flavors and experiences

- The UI presents **flavor** cards as the product-level choice.
- Flavors map to **experiences** (plugin sets) discovered from the Enclave
  tree via the API ([ADR-003](ADR-003-wizard-fronts-enclave-tree.md)).
- The UI keeps **fallback** experience/flavor lists when the API catalog is
  empty so local/mock flows still work.
- The wizard only exposes fields that produce real Enclave config YAML (no
  parallel “policy theater” flows that do not write config).

### API client and app structure

- Generate a TypeScript client from the wizard OpenAPI spec (containerized
  generator workflow under `ui/`).
- Use a small IoC-style injection package for API and services in the React
  app.
- Load defaults from `GET /api/v1/defaults` during wizard init.
- Persist config with `PUT /api/v1/config` (and section APIs as needed) when
  the operator generates/writes config.

### Auth in the UI

Follow [ADR-006](ADR-006-auth-and-tls.md): bearer token in UI memory, login
gate, forced password change in the UI when required.

## Alternatives Considered

### Server-owned wizard state (session on the API)

- Pros: Resume across devices; stronger server validation of step order
- Cons: Session store, multi-tab complexity; duplicates what YAML-on-disk
  already provides for durable state
- Rejected (as-built): Client-owned state; durable truth is YAML
  ([ADR-004](ADR-004-config-yaml-on-disk.md))

### Fully static forms (hand-written fields only)

- Pros: Maximum UX control per field
- Cons: Every API/model change needs a matching UI edit
- Rejected (as-built): Semi-dynamic rendering from schema metadata

### Fully dynamic wizard (steps generated from schema alone)

- Pros: Zero UI step maintenance
- Cons: Weak product narrative; hard to encode flavor/experience UX
- Rejected (as-built): Hardcoded steps + schema-driven fields

### Hand-written TypeScript API types (no generator)

- Pros: Less codegen tooling
- Cons: Drift from OpenAPI/Go models
- Rejected (as-built): Generated client from OpenAPI

## Consequences

- Refactors that move wizard draft state to the server challenge this ADR.
- API model changes should flow OpenAPI → generated client → schema-driven UI
  with minimal hand mapping; step map updates remain a deliberate UI change.
- Experience/plugin product changes start in Enclave; UI fallbacks must be
  updated when mock/offline flows matter.
- UI unit tests (Vitest / Testing Library) guard components; they do not
  replace Enclave validation or e2e against a deployed stack.
