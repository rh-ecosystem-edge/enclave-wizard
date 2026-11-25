# Architecture Decision Records (ADRs)

As-built decisions for Enclave Wizard. Use these when proposing a refactor:
name the ADR you challenge, and show that the new design still solves the
problem in Context.

| ADR | Title |
|-----|--------|
| [ADR-001](ADR-001-github-actions-ci.md) | GitHub Actions CI for PRs and releases |
| [ADR-002](ADR-002-huma-openapi-from-go-types.md) | Huma on the Go stdlib router; OpenAPI from Go types |
| [ADR-003](ADR-003-wizard-fronts-enclave-tree.md) | Wizard fronts an Enclave directory tree |
| [ADR-004](ADR-004-config-yaml-on-disk.md) | Config persistence is YAML on disk |
| [ADR-005](ADR-005-ansible-runner-tasks.md) | Deploy and validate via ansible-runner tasks |
| [ADR-006](ADR-006-auth-and-tls.md) | Local admin auth and HTTPS transport |
| [ADR-007](ADR-007-ui-client-owned-wizard.md) | Client-owned wizard UI over a thin API |
| [ADR-008](ADR-008-packaging-and-delivery.md) | Packaging and delivery on the Landing Zone |

Status for ADR-002 through ADR-008: **Accepted** (documented from current
practice on 2026-11-25). Demo/replay and e2e strategy ADRs are intentionally
out of this baseline.
