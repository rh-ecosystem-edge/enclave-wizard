---
name: commit-format
description: Commit message format for enclave-wizard. Use before every git commit to ensure correct format.
---

# Commit Message Format

All commits in this project MUST follow this format:

```
<issue>: (<type>) <short description>

Assisted-by: <agent-name>
```

`<issue>` is `OSAC-<number>` when a ticket exists, or `NO-ISSUE` when it does not.

## Types

- `feat` — new feature or functionality
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `docs` — documentation only
- `test` — adding or updating tests
- `chore` — build, CI, tooling changes

## Examples

```
OSAC-813: (feat) Add ansible-based schema validation

Assisted-by: Claude Code
```

```
OSAC-824: (fix) Release runner lock before signaling completion

Assisted-by: Cursor
```

```
NO-ISSUE: (docs) Clarify agent instruction layout

Assisted-by: Cursor
```

## Rules

- Issue id comes first: `OSAC-<number>` or `NO-ISSUE`
- Type is in parentheses after the colon
- Short description in imperative mood, no period at end
- Body is optional — use it for bullet points if the change is multi-faceted
- End every commit with `Assisted-by: <agent-name>` (for example `Claude Code` or `Cursor`)
- Do not use `Co-Authored-By` for AI attribution
