# Contributing to Enclave Wizard

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Go | 1.25+ | Match `go.mod` (`go version`). Newer host toolchains are fine; Go may download the module toolchain via `GOTOOLCHAIN=auto` |
| Node | 24 | **Not installed on host** — use `distrobox enter osac` for all Node/yarn/tsc commands |
| golangci-lint | v2.13.2 | Same pin as PR CI; install with `make lint-install` |
| Podman (or Docker) | latest | Used for UI builds, RPM packaging, and container-based cross-compilation |
| make | any | GNU Make |

### Git hooks and commit template

One-time per clone:

```bash
make setup-githooks
```

This configures:

| Setting | Value | Purpose |
|---------|-------|---------|
| `core.hooksPath` | `hack/git/hooks/` | `prepare-commit-msg` appends `Assisted-by:` when missing |
| `commit.template` | `hack/git/commit-template` | Subject / Why / Notes skeleton for editor commits |

Fill [`hack/git/commit-template`](../hack/git/commit-template) (Subject + Why required;
Notes optional). Prefer `git commit -F <file> --cleanup=strip` after editing a copy
of the template. `--cleanup=strip` removes `#` instruction lines. Bare
`git commit -m "..."` skips the template.

Override the Assisted-by name with `ASSISTED_BY` (or `GIT_ASSISTED_BY`) if
auto-detection is wrong:

```bash
ASSISTED_BY='Cursor' git commit -F /tmp/commitmsg --cleanup=strip
```

## Project Structure

```
enclave-wizard/
  main.go                          # Entry point, huma API wiring
  internal/
    api/                           # HTTP handlers (huma framework)
    models/                        # Go structs -> OpenAPI -> TypeScript
    config/                        # YAML reader/writer for enclave config
    plugins/                       # Plugin discovery and registry
    experience/                    # Experience loader
    deploy/                        # Deployer + state machine
    runner/                        # ansible-runner integration
    validation/                    # Config validation via Ansible
  ui/
    apps/wizard/                   # React SPA (PatternFly 6, Vite)
      src/schema/                  # Schema-driven form rendering
      src/wizard/                  # Wizard steps, experiences, flavors
      e2e/                         # Playwright browser tests
    packages/api-client/           # Generated TypeScript API client
  enclave-mock/                    # Fake enclave directory for local dev
  hack/                            # Scripts: deploy, RPM, e2e, infra, git hooks/template
```

## Running Locally

All three modes serve the wizard at `https://localhost:3443`.

### Demo mode (recorded ansible-runner replay)

```bash
make demo
```

Builds with the `dev` tag, starts with `--demo-deploy` serving a pre-recorded deployment. Background process; stop with `make demo-stop`. Tune speed with `SPEED=10`.

### Dev mode (no auth, enclave-mock)

```bash
make dev
```

Builds with the `dev` tag, runs against `enclave-mock/` with `--no-auth`. Generates self-signed TLS certs if missing. Foreground process — Ctrl-C to stop.

### Real mode (needs real enclave directory)

```bash
make run
```

Builds the UI and Go binary, runs against `../enclave`. Requires a real enclave directory with schemas, playbooks, and config.

## Continuous Integration

See [ADR-001](decisions/ADR-001-github-actions-ci.md). Summary:

| Workflow | When | What |
|----------|------|------|
| `.github/workflows/pr.yml` | Pull request to `main` | Path-aware UI and/or Go quality; docs-only skips stack jobs |
| `.github/workflows/release.yml` | GitHub Release / manual | Stub only (full release pipeline TBD) |

After this workflow is on `main`, require the **`ci`** status check on the `main` ruleset (aggregator over path-skipped jobs). Do not require `ui`/`go` individually.

Fork PRs that introduce new workflows may need a maintainer to **Approve and run workflows** once before Actions appear.

### Local commands that match PR CI

```bash
# Go
make lint-install              # once: golangci-lint v2.13.2 into $(go env GOPATH)/bin
make lint
make test
go build -o enclave-wizard .   # needs ui/apps/wizard/dist (or run make build-ui first)

# UI (distrobox / Node 24)
cd ui
yarn install
yarn check:all                 # Biome; excludes packages/api-client (generated)
yarn build:all                 # build + typecheck
yarn workspace @enclave-wizard-ui/wizard test
```

## Running Tests

### Go unit tests

```bash
make test
# or
go test ./...
```

### Go lint

```bash
make lint-install   # once, pins v2.13.2 to match .github/workflows/pr.yml
make lint
```

### UI unit tests

Node is not available on the host. Use distrobox:

```bash
distrobox enter osac
cd ui
yarn install
yarn workspace @enclave-wizard-ui/wizard test
```

### E2E tests (API-level, against a remote host)

```bash
# Full run: build RPM, deploy to VM, run tests
make e2e TARGET=root@myhost

# Rerun tests without redeploying
make e2e-rerun TARGET=root@myhost

# Browser-based UI tests (Playwright)
make e2e-browser WIZARD_URL=https://myhost:3443
```

## Building

```bash
make build          # Build UI + Go binary (host arch)
make build-linux    # Cross-compile for linux/amd64 in a container
make rpm            # Build RPM package (calls build-linux)
```

## Deploying

```bash
make deploy TARGET=root@myhost            # Deploy with auth
make deploy TARGET=root@myhost AUTH=none   # Deploy without auth
```

See [deployment.md](deployment.md) for details on the RPM structure, systemd service, and VM provisioning.

## How-To Guides

- [Adding a wizard field](howto-add-field.md) — add a new config field end-to-end
- [Adding an experience](howto-add-experience.md) — create a new deployable experience
- [Adding a plugin](howto-add-plugin.md) — create a new enclave plugin
- [Adding an API endpoint](howto-add-api-endpoint.md) — add a new REST endpoint

## Agent instructions

- Shared agent rules live in [`AGENTS.md`](../AGENTS.md) at the repo root.
  `CLAUDE.md` is a thin stub that imports that file for Claude Code.
- Shared project skills live under [`.claude/skills/`](../.claude/skills/).
- Personal plugins and skill packs are up to each contributor. Do not commit them.

### Personal skill index (`AGENTS.local.md`)

Install personal skills where your agent harness expects them (user skill
dir, plugin marketplace, and so on). Do **not** copy skill bodies into the
repo or into `AGENTS.local.md`.

Use `AGENTS.local.md` (gitignored) only as a short **When → Use** index so
the agent knows which of *your* skills to load for a given situation:

| When... | Use... |
|---------|--------|
| Opening or reviewing a PR | `pull-request-workflow` |
| Searching Slack for prior discussion | `search-slack` |

Keep rows concrete and task-shaped. The harness loads the skill content;
the index only points at it.

## Other Documentation

- [Enclave config reference](enclave-config.md) — config file format and fields
- [OSAC configuration](osac-configuration.md) — OSAC-specific settings
- [Deployment](deployment.md) — RPM packaging and remote deployment
- [Testing patterns](enclave-testing-patterns.md) — test strategy and patterns
- [Recording deployments](recording-deployment.md) — recording ansible-runner output for demo mode
- [ADR-001: GitHub Actions CI](decisions/ADR-001-github-actions-ci.md) — PR and release workflow decisions
