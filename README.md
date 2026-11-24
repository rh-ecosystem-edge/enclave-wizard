# Enclave Configuration Wizard API

Backend API for the Enclave Configuration Wizard — a web-based tool that runs on the Landing Zone (LZ) and manages Enclave deployment config files (`config/global.yaml`, `config/certificates.yaml`, `config/cloud_infra.yaml`).

Built with [Huma](https://huma.rocks/) on the Go stdlib router. The API generates an OpenAPI 3.1 spec from Go types, which can be used to generate typed clients for any frontend framework.

## Quick start

```bash
make run
# or: go run . --port 8080 --enclave-dir ../enclave
```

The server starts on `http://localhost:8080` with interactive docs at `/docs`.

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port`, `-p` | `8080` | Port to listen on |
| `--enclave-dir` | `../enclave` | Path to the Enclave repository root |

## OpenAPI schema

With the server running:

```bash
# OpenAPI 3.1 spec (YAML)
curl http://localhost:8080/openapi.yaml -o openapi.yaml

# OpenAPI 3.1 spec (JSON)
curl http://localhost:8080/openapi.json -o openapi.json
```

Use the spec to generate a typed client, for example with [openapi-typescript](https://openapi-ts.dev/):

```bash
npx openapi-typescript openapi.yaml -o src/api/schema.d.ts
```

## API endpoints

### Full config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/config` | Load existing config from disk |
| PUT | `/api/v1/config` | Write config to disk |
| POST | `/api/v1/config/validate` | Validate config against Enclave schemas |
| POST | `/api/v1/config/preview` | Preview rendered YAML without writing |

### Config sections

Each section can be read or updated independently. A PUT to a section endpoint merges the payload into the existing config and writes the result to disk — other sections are left untouched.

| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/api/v1/config/lz` | Landing zone (BMC IP, working dir, disconnected mode) |
| GET/PUT | `/api/v1/config/cluster` | Management cluster install (domain, VIPs, control-plane hosts, pull secret) |
| GET/PUT | `/api/v1/config/network` | Host network (DNS, gateway, prefix) |
| GET/PUT | `/api/v1/config/quay` | Quay registry (credentials, backend, RGW config) |
| GET/PUT | `/api/v1/config/storage` | Block storage (LVMS/ODF backend, external config) |
| GET/PUT | `/api/v1/config/plugins` | Enabled plugins and their configuration |
| GET/PUT | `/api/v1/config/certificates` | TLS certificates (API server, ingress, CA, Ironic) |
| GET/PUT | `/api/v1/config/hosts` | Discovery hosts (cloud infrastructure) |

### Defaults & plugins

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/defaults` | Get default values from `defaults/deployment.yaml` and plugin `defaults` blocks |
| GET | `/api/v1/plugins` | List available plugins |
| POST | `/api/v1/plugins/validate` | Check if a plugin combination is valid |

### Tasks

Task endpoints start and monitor long-running Ansible playbook executions. Only one task may run at a time — starting a second while one is active returns `409 Conflict`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/tasks/deploy` | Run the full deployment (`playbooks/main.yaml`, all 7 phases) |
| POST | `/api/v1/tasks/deploy/{phase}` | Run a single deployment phase (1–7) |
| POST | `/api/v1/tasks/plugins/{name}` | Deploy a specific plugin (`playbooks/deploy-plugin.yaml`) |
| GET | `/api/v1/tasks` | List all task runs, most recent first |
| GET | `/api/v1/tasks/{id}` | Get status and metadata for a specific run |
| GET | `/api/v1/tasks/{id}/logs` | Get ansible-runner stdout as `text/plain` |
| GET | `/api/v1/tasks/{id}/events` | Get ansible-runner job events as a JSON array |
| DELETE | `/api/v1/tasks/{id}` | Delete a task run and remove its ansible-runner directory. Returns `409 Conflict` if the task is still running |

Each run is represented by a `TaskRun` object:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique run identifier |
| `type` | string | `deploy`, `deploy-phase`, or `deploy-plugin` |
| `status` | string | `running`, `successful`, `failed`, or `canceled` |
| `playbook` | string | Playbook path relative to the enclave directory |
| `extraVars` | object | Extra variables passed to ansible-runner (e.g. `plugin_name`) |
| `pid` | int | OS process ID of the ansible-runner process |
| `exitCode` | int | Process exit code (present when the run has ended) |
| `createdAt` | timestamp | When the run was created |
| `startedAt` | timestamp | When ansible-runner started |
| `endedAt` | timestamp | When the run completed |
| `error` | string | Error message if the run failed |

## Development

```bash
make setup-githooks   # one-time: commit template + Assisted-by hook (hack/git/)
make build            # compile binary
make test             # run tests
make lint             # go vet
make tidy             # go mod tidy
```

See [docs/contributing/README.md](docs/contributing/README.md) for the full
developer guide (including commit message format and git hook details).
Docs index: [docs/README.md](docs/README.md).
