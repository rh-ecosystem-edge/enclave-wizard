# ADR-005: Deploy and validate via ansible-runner tasks

## Status

Accepted

## Date

2026-11-25

## Context

Enclave deployment and much of its validation are implemented as Ansible
playbooks in the Enclave tree. The wizard needs to start those playbooks, track
progress, and expose logs/events to the UI without reimplementing Enclave
orchestration inside Go.

This ADR records the as-built execution model, including the single-active-task
constraint.

## Decision

Use **ansible-runner** (wrapped by `internal/runner`) as the execution engine
for long-running Enclave work.

1. **Task API** — Start deploy (full or phase), plugin deploy, and related runs
   through `/api/v1/tasks…` (and deploy helpers that use the same runner).
2. **Artifacts** — Persist run metadata, stdout, and job events from
   ansible-runner directories for list/get/logs/events/delete.
3. **Validation** — Config validation goes through Enclave/Ansible-backed
   validation rather than a fully independent wizard rules engine.
4. **Single active task** — At most one ansible-runner task may run at a time.
   Starting another while one is active returns **HTTP 409 Conflict**
   (`runner.ErrBusy`). Deleting a still-running task also conflicts until the
   run ends.
5. **No parallel deploy pipeline in-process** — Concurrency control lives in
   the runner; the API surfaces busy as 409.

Demo/replay runners exist for local UX; they are out of scope for this
baseline ADR set and must still honor the busy semantics where applicable.

## Alternatives Considered

### Reimplement deploy phases in Go

- Pros: Richer typed control; fewer process boundaries
- Cons: Duplicates Enclave playbooks; diverges from the product operators run
  outside the wizard
- Rejected (as-built): Delegate to Enclave playbooks via ansible-runner

### Allow concurrent ansible-runner tasks

- Pros: Parallel plugin deploys or overlapping validate/deploy
- Cons: Shared Enclave tree and host tools; harder reasoning about partial
  failure; LZ hosts are not sized as multi-tenant orchestrators
- Rejected (as-built): One active task; 409 when busy

### Queue tasks instead of rejecting with 409

- Pros: Clients need not retry manually
- Cons: Hidden backlog; harder UX for “what is running now”
- Rejected (as-built): Explicit busy error; client waits or polls

## Consequences

- UI and API clients must handle 409 and poll task status/logs.
- Host images need ansible-runner (and related tools) on PATH (or
  `--ansible-bin-dir`).
- Runner directory lifecycle (create/delete) is part of the public task API.
- Introducing a job queue or multi-task execution supersedes the single-task
  part of this decision and needs a new ADR.
