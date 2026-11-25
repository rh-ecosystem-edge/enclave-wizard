# ADR-002: Huma on the Go stdlib router; OpenAPI from Go types

## Status

Accepted

## Date

2026-11-25

## Context

The wizard needs a versioned HTTP API for the UI and for other clients. The
team wants typed request/response models in Go, interactive docs, and a
machine-readable OpenAPI document that can generate a TypeScript client
([ADR-007](ADR-007-ui-client-owned-wizard.md)).

This ADR records the as-built API framework choice.

## Decision

1. Build the HTTP API with **[Huma](https://huma.rocks/)** on the **Go
   standard library** router (`humago` adapter), not a separate web framework
   as the primary stack.
2. Define API shapes as **Go types** registered with Huma so the server
   publishes **OpenAPI 3.1** (`/openapi.yaml`, `/openapi.json`) and serves
   interactive docs (e.g. `/docs`).
3. Keep domain models in `internal/models` (and related packages) as the shared
   source that feeds handlers and OpenAPI.
4. Protect `/api/v1/*` with bearer security schemes declared in the OpenAPI
   components where applicable ([ADR-006](ADR-006-auth-and-tls.md)).

## Alternatives Considered

### Hand-written OpenAPI plus a thin router

- Pros: Spec-first for external consumers
- Cons: Dual maintenance of YAML spec and Go structs; drift risk
- Rejected (as-built): Types first; OpenAPI generated from registrations

### Heavier Go web frameworks (e.g. full featured mux ecosystems as the core)

- Pros: Batteries included
- Cons: Extra surface area; Huma already targets OpenAPI-from-types on stdlib
- Rejected (as-built): Huma + stdlib router

### GraphQL or non-HTTP RPC for the UI

- Pros: Flexible queries
- Cons: Poor fit for file/config and long-running task semantics; weaker
  alignment with simple OpenAPI client generation
- Rejected (as-built): REST-style HTTP + OpenAPI

### Alternatives unknown

Earlier framework bake-offs are not fully preserved. The decision above
matches the current `main.go` / `internal/api` structure.

## Consequences

- UI and external clients should treat OpenAPI as the contract; regenerate the
  TypeScript client when models or routes change.
- New endpoints follow Huma handler registration patterns (see contributor
  how-to for API endpoints).
- Switching frameworks or moving to spec-first OpenAPI would supersede this
  ADR and force client regeneration strategy changes.
