---
name: dev-workflow
description: Development workflow for enclave-wizard — building, running, testing, demo environment, and local dev modes. Use when building, running, testing, starting demo or dev mode, refreshing the local environment, or when asked about make targets, how to run the project, or how to test changes.
---

# Development Workflow

## Quick Reference

```
make help           # see all available targets
make demo           # build + start demo in background (one command)
make demo-stop      # stop the demo
make demo-restart   # restart the demo
make test           # run Go tests
make build          # build UI + Go binary
make lint           # run go vet
```

## Demo Environment

The demo environment runs the wizard with fake deploy/validation backends (recorded ansible runs replayed at 10x speed) and no authentication. Ideal for UI development and manual testing.

### Start

```bash
make demo
```

This builds the UI (vite), builds the Go binary with the `dev` tag (enables demo/recording features), and starts the server in the background on `https://localhost:3443`.

### Stop

```bash
make demo-stop
```

### Customize

Environment variables control the demo:

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEED` | `10` | Replay speed multiplier (0=instant, 1=real-time) |
| `PORT` | `3443` | HTTPS port |
| `ENCLAVE_DIR` | `hack/enclave` | Enclave directory path |

Example: `SPEED=0 PORT=4443 make demo`

### How it works

- `hack/demo-start.sh` — starts the wizard in background, writes PID to `/tmp/enclave-wizard-demo.pid`, waits for health check
- `hack/demo-stop.sh` — reads PID file, kills the process, cleans up
- Logs go to `/tmp/enclave-wizard-demo.log`
- TLS certs are auto-generated if missing (`hack/tls/`)
- Demo recordings live in `fixtures/recordings/`
- Experience definitions live in `hack/enclave/experiences/`

## Building

### Full build (UI + backend)

```bash
make build
```

The UI is embedded in the Go binary at build time via `//go:embed`. Changing UI code requires rebuilding both.

### Backend only (Go changes)

```bash
go build -tags dev -o enclave-wizard .
```

Skip `build-ui` when only Go code changed. Use `dev` tag if you need demo/recording features.

### Linux cross-compile (for deployment)

```bash
make build-linux
```

Builds inside a container for linux/amd64. Used by `make rpm` and `make deploy`.

## Testing

### Go tests

```bash
make test                  # all tests with coverage
go test ./internal/api/... # specific package
go test -race ./...        # with race detector
```

### Frontend tests

Run inside a container (no Node.js on host):

```bash
# Via the UI Makefile
cd ui && make test

# Or directly
distrobox enter osac -- bash -c "cd ui && podman run --rm -v \$(pwd):/app:z -w /app node:24-alpine sh -c 'corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard test'"
```

### TypeScript check

```bash
distrobox enter osac -- bash -c "cd ui && podman run --rm -v \$(pwd):/app:z -w /app node:24-alpine sh -c 'corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard run -T tsc --noEmit'"
```

## Key Directories

| Path | Purpose |
|------|---------|
| `internal/runner/` | Runner interface + implementations (ansible, replay, recording) |
| `internal/deploy/` | Deployment orchestrator + persistent state |
| `internal/api/` | HTTP handlers (huma framework) |
| `internal/experience/` | Experience loader from YAML |
| `internal/config/` | Config reader/writer (YAML I/O) |
| `ui/apps/wizard/src/` | React frontend (PatternFly 6) |
| `ui/apps/wizard/src/wizard/contexts/` | Split state management (Config, Nav, Catalog) |
| `ui/apps/wizard/src/wizard/hooks/` | Extracted hooks (init, substeps, validation, navigation) |
| `ui/apps/wizard/src/api/` | API hooks (useDeployment, useSSE, useFileUpload, usePluginSchema) |
| `hack/enclave/` | Local enclave dir for demo mode |
| `fixtures/recordings/` | Recorded ansible runs for demo replay |

## Common Tasks

### After modifying a Go file

```bash
make demo-restart    # if demo is running
# or
make test            # run tests first
```

### After modifying a UI file

```bash
make demo            # rebuilds UI + binary + restarts
```

### After modifying both

```bash
make demo            # handles everything
```

### Running the real wizard (not demo)

```bash
make run             # requires ../enclave directory with real ansible playbooks
```

## Dev Mode (enclave-mock)

An alternative to demo mode that runs against `enclave-mock/` — noop'd ansible tasks from the real enclave repo. Use this when testing config writes or validation flows (demo mode replays recordings, dev mode runs real playbooks with noop tasks).

| Mode | Command | Backend | Use for |
|------|---------|---------|---------|
| Demo | `make demo` | Recorded replays at 10x speed | UI dev, manual walkthrough |
| Dev | `make dev` | Noop ansible tasks | Config write, validation flows |
| Real | `make run` | Real ansible (requires `../enclave`) | Full integration |

### Setup enclave-mock (first time)

```bash
make enclave-mock
```

To regenerate from a specific branch:
```bash
make clean-enclave-mock
make enclave-mock ENCLAVE_MOCK_BRANCH=<branch>
```

### Start dev mode

```bash
make dev
```

Runs in the foreground with `--no-auth` against `enclave-mock/`.

## Notes

- Go and Node.js run inside `distrobox enter osac` — they're not installed on the host
- The `dev` build tag enables demo/recording runner modes; production builds omit them
- `--no-auth` skips bearer token checks but the login screen still appears in the UI (use any password shown at startup)
- Config validation requires `ansible-runner` which is only available in the real enclave environment
- `enclave-mock/` is gitignored
