---
name: add-wizard-field
description: Add a new config field to the wizard — Go struct tag, UI label, schema rendering, validation, and step wiring. Use when adding a field, config option, or parameter.
---

# Add a Wizard Config Field

## 1. Add the Go struct field

File: `internal/models/config.go`

Add to the appropriate sub-struct with JSON, YAML, and `doc` tags:

```go
MyField *string `json:"myField,omitempty" yaml:"myField,omitempty" doc:"Human-readable description" minLength:"1"`
```

Use `*Type` + `omitempty` for optional, value types for required. Tags: `doc`, `pattern`, `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`.

## 2. Rebuild

```bash
make build
```

## 3. Add label override (optional)

File: `ui/apps/wizard/src/schema/schemaUtils.ts` — `LABEL_OVERRIDES` map.

## 4. Add field to step component

Add the dot-path (e.g., `"global.myField"`) to the fields array in the step:

- `ui/apps/wizard/src/wizard/steps/LandingZoneStep.tsx`
- `ui/apps/wizard/src/wizard/steps/HubClusterStep.tsx`
- `ui/apps/wizard/src/wizard/steps/OsacStep.tsx`
- `ui/apps/wizard/src/wizard/steps/AAPStep.tsx`
- `ui/apps/wizard/src/wizard/steps/CaasStep.tsx`

## 5. Add placeholder hint (optional)

File: `ui/apps/wizard/src/schema/SchemaFormRenderer.tsx` — `PLACEHOLDER_HINTS` map.

## 6. Mark required (if applicable)

File: `ui/apps/wizard/src/wizard/stepFields.ts` — add to `STEP_REQUIRED_FIELDS`.

## 7. Custom validation (if needed)

File: `ui/apps/wizard/src/wizard/hooks/useStepValidation.ts` — add logic in the step's `if` block.

## 8. Verify

Run `make demo`, navigate to the step, confirm field renders correctly. Run `make test`.

See `docs/contributing/how-to/add-field.md` for the full guide with examples.
