# ADR-001: GitHub Actions CI for PRs and releases

## Status

Accepted

## Date

2026-11-24

## Context

The repository had no GitHub Actions workflows. Contributors merge to `main` through pull requests. A repository ruleset already guards `main` (reviews, signatures, linear history); requiring the new `ci` status check is a follow-up after this workflow lands. The project is a full-stack app (Go API + React UI under `ui/`). Quality commands differ by stack. We need a minimal CI setup that:

- Gives a clear green/red signal on PRs
- Avoids a heavy pipeline (no e2e, RPM, or deploy in PR CI)
- Leaves a place to hang a future release pipeline (full build, e2e, distributable artifacts)

## Decision

Use **two** GitHub Actions workflows only:

1. **`.github/workflows/pr.yml`** — path-aware PR quality gates on `ubuntu-latest`, host commands only (no Docker/distrobox in these workflows).
2. **`.github/workflows/release.yml`** — noop stub for now (echo TBD / exit 0). Trigger on GitHub Release publish and `workflow_dispatch`. Real release work (BE+FE build, e2e, artifacts) comes later.

### PR path rules

| Change set | Jobs |
|------------|------|
| `ui/**` only | UI: Biome lint, build (includes typecheck), unit tests (host Node 24 + yarn) |
| Go source (`*.go`, `go.mod` / `go.sum`, `enclave-mock/**`) | Go: golangci-lint, `make test`, Go build |
| Shared/root (`Makefile`, `.golangci.yml`, `hack/**`, `Containerfile`) | Both job sets |
| `.github/**` only (including `release.yml` / `pr.yml`) | Skip stack CI (`ci` aggregator still succeeds) |
| `docs/**` only | Skip stack CI (`ci` aggregator still succeeds) |

Workflow YAML alone does not force `go`/`ui`. The release stub and path-filter
edits are not product-code changes. To re-validate both stacks after a CI
workflow change, also touch a shared path (for example `Makefile`) or open a
follow-up that changes Go/UI sources.

No dedicated workflow on push to `main`. Quality is enforced on the PR; merge-to-main does not re-run quality or a separate build workflow.

### Tooling

- **Node:** project standard is **Node 24** (CI `setup-node`, container images, `engines` in `ui/package.json`).
- **UI:** `yarn check:all` runs Biome from the `ui/` root. [`ui/biome.json`](../../ui/biome.json) excludes `packages/api-client/**` on purpose (generated OpenAPI client). Build via `yarn build:all` (standalone `typecheck` is folded into that build via `tsc -b`); unit tests via the wizard workspace.
- **Go:** **golangci-lint** v2.13.2 (`.golangci.yml`, `make lint` / `make lint-install`) plus `make test` and `go build` via `setup-go` (version from `go.mod`).

### Go embed note

`main.go` embeds `ui/apps/wizard/dist`. A Go-only CI job must ensure that directory exists (minimal stub file is enough) so `go build` succeeds without a full UI build.

### Required status check (post-merge)

After this workflow exists on `main`, add a required status check for the aggregator job name **`ci`** on the `main` ruleset so docs-only PRs and path-skipped stack jobs do not block merges incorrectly. Do not require `ui`/`go` individually.

### Fork guard

Every job is gated with `github.repository == 'rh-ecosystem-edge/enclave-wizard'`. Workflows do not run on forks (contributors need not disable Actions). Pull requests from forks into upstream still run, because the workflow executes in the upstream repository context.

## Alternatives Considered

### Three workflows (`pr.yml`, `main.yml`, `release.yml`)

- Pros: Explicit “build on merge to main”
- Cons: Extra workflow to maintain; PR already gates quality; ruleset can require the PR `ci` check after merge
- Rejected: Two files only; no merge-to-main build workflow

### Always run full-stack CI on every PR

- Pros: Simpler path filters
- Cons: Slower and costlier for single-stack changes
- Rejected: Path-scoped jobs match the “very simple but not wasteful” goal

### Containerized UI build in CI (`make build-ui` / node image)

- Pros: Matches local Make target that uses Podman/Docker
- Cons: Heavier runners; host commands preferred for these workflows
- Rejected: Run yarn/Node and Go directly on `ubuntu-latest`

### Defer golangci-lint; use only `go vet`

- Pros: Zero new tooling
- Cons: Weak Go lint signal
- Rejected: golangci-lint is wanted in the first CI slice

## Consequences

- Contributors get stack-specific CI feedback on PRs; docs-only PRs do not burn CI minutes on build/test.
- Local Go lint aligns with CI via `make lint` (requires `golangci-lint` installed).
- Release publishing stays a stub until a follow-up fills in build, e2e, and artifacts.
- Go-only builds on a clean checkout need a stub `ui/apps/wizard/dist` for `//go:embed`.
- Biome must keep excluding `ui/packages/api-client` so generated code is not linted.
