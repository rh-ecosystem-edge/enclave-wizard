---
name: commit-format
description: Commit message format for enclave-wizard. Use before every git commit to ensure correct format.
---

# Commit Message Format

Fill the repo commit template [`hack/git/commit-template`](../../hack/git/commit-template).
Do not invent a different layout.

## How to commit

1. Copy `hack/git/commit-template` to a temp file (or rely on `commit.template` if the editor opens).
2. Fill **Subject** and **Why**. Fill **Notes** only when useful; otherwise delete that section.
3. Commit with `git commit -F <file> --cleanup=strip` (preferred). Avoid bare
   `git commit -m "..."` for multi-section messages — that skips the template.
   `--cleanup=strip` drops `#` instruction lines left from the template.
4. Do **not** add `Assisted-by` by hand. `hack/git/hooks/prepare-commit-msg` appends it.
5. Do **not** use `Co-Authored-By` for AI attribution.

One-time setup (if not done): `make setup-githooks`.

## Subject

```
<issue>: (<type>) <short description>
```

- `<issue>` is `OSAC-<number>` when a ticket exists, or `NO-ISSUE` when it does not
- Type is in parentheses after the colon
- Short description in imperative mood, no period at end

## Types

- `feat` — new feature or functionality
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `docs` — documentation only
- `test` — adding or updating tests
- `chore` — build, CI, tooling changes

## Why

Required. One or two sentences on motivation (why this change), not a file list.

## Notes

Optional. Short bullets for risks, follow-ups, or extra context. Delete the section
when unused.

## Examples

Subject only (Why still required in real commits):

```
OSAC-813: (feat) Add ansible-based schema validation
```

```
OSAC-824: (fix) Release runner lock before signaling completion
```

```
NO-ISSUE: (docs) Clarify agent instruction layout
```

Filled message before the hook runs:

```
NO-ISSUE: (docs) Clarify agent instruction layout

Keep shared agent rules in AGENTS.md and leave personal skills local.

- Document When → Use index in CONTRIBUTING.md
```
