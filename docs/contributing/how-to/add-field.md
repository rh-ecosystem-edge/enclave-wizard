# How to Add a Wizard Field

The architecture is schema-driven: add a Go struct tag, rebuild, and the UI renders the field automatically from the OpenAPI schema.

## Example: Adding a `proxyURL` field

### 1. Add the Go struct field

Edit `internal/models/config.go`. Add the field to the appropriate sub-struct with JSON, YAML, and `doc` tags:

```go
type ClusterConfig struct {
    // ... existing fields ...
    ProxyURL *string `json:"proxyURL,omitempty" yaml:"proxyURL,omitempty" doc:"HTTP proxy URL for outbound traffic" pattern:"^https?://"`
}
```

Available struct tags:

| Tag | Purpose | Example |
|-----|---------|---------|
| `json` | JSON field name (API + OpenAPI) | `json:"proxyURL,omitempty"` |
| `yaml` | YAML field name (config files) | `yaml:"proxyURL,omitempty"` |
| `doc` | Description (shown as helper text in UI) | `doc:"HTTP proxy URL"` |
| `pattern` | Regex validation | `pattern:"^https?://"` |
| `enum` | Allowed values (renders as dropdown) | `enum:"option1,option2"` |
| `minimum` / `maximum` | Numeric bounds | `minimum:"1" maximum:"100"` |
| `minLength` / `maxLength` | String length bounds | `minLength:"1"` |
| `minItems` / `maxItems` | Array length bounds | `minItems:"3" maxItems:"3"` |

Use pointer types (`*string`, `*bool`, `*int`) with `omitempty` for optional fields. Use value types for required fields.

### 2. Rebuild

```bash
make build
```

The huma framework auto-generates the OpenAPI spec from Go struct tags. The UI fetches this schema at runtime from `/openapi.json`.

### 3. Add a label override (if needed)

File: `ui/apps/wizard/src/schema/schemaUtils.ts`

Add an entry to `LABEL_OVERRIDES` if the auto-generated label isn't clear:

```typescript
const LABEL_OVERRIDES: Record<string, string> = {
  // ...existing entries...
  proxyURL: "HTTP Proxy URL",
};
```

Without an override, `proxyURL` renders as "Proxy URL" (auto-split from camelCase).

### 4. Add the field to a step component

Each step component defines an array of dot-paths passed to `SchemaFormRenderer`. Add your field:

```typescript
const NETWORK_FIELDS = [
  "global.machineNetwork",
  "global.apiVIP",
  "global.ingressVIP",
  "global.proxyURL",  // <-- add here
];
```

`SchemaFormRenderer` auto-renders the correct widget based on the schema type:
- `string` with `enum` -> dropdown
- `boolean` -> checkbox
- `integer` -> number input
- `array` of strings -> add/remove list
- `string` (default) -> text input with pattern validation

Step component files:

| Step | File |
|------|------|
| Landing Zone | `ui/apps/wizard/src/wizard/steps/LandingZoneStep.tsx` |
| Hub Cluster | `ui/apps/wizard/src/wizard/steps/HubClusterStep.tsx` |
| OSAC | `ui/apps/wizard/src/wizard/steps/OsacStep.tsx` |
| AAP | `ui/apps/wizard/src/wizard/steps/AAPStep.tsx` |
| CaaS | `ui/apps/wizard/src/wizard/steps/CaasStep.tsx` |

### 5. Add a placeholder hint (optional)

File: `ui/apps/wizard/src/schema/SchemaFormRenderer.tsx`

```typescript
const PLACEHOLDER_HINTS: Record<string, string> = {
  // ...existing...
  proxyURL: "http://proxy.example.com:8080",
};
```

### 6. Mark as required (if applicable)

File: `ui/apps/wizard/src/wizard/stepFields.ts`

```typescript
export const STEP_REQUIRED_FIELDS: Record<string, string[]> = {
  "hub-cluster": [
    // ...existing...
    "global.proxyURL",
  ],
};
```

### 7. Add custom validation (if needed)

File: `ui/apps/wizard/src/wizard/hooks/useStepValidation.ts`

For validation beyond what struct tags express (conditional, cross-field), add logic in the appropriate `if (currentSubStepId === "...")` block. Simple required/pattern/enum/range validation is automatic.

### 8. Config reader/writer (usually no changes)

For fields on existing `GlobalConfig` sub-structs, YAML marshaling handles it automatically. Only plugin-specific fields need changes in `internal/config/reader.go` and `writer.go`.

## Summary

| Step | File | What to do |
|------|------|------------|
| 1 | `internal/models/config.go` | Add Go struct field with tags |
| 2 | (build) | `make build` to regenerate |
| 3 | `ui/.../schema/schemaUtils.ts` | Add label override (optional) |
| 4 | `ui/.../steps/<Step>.tsx` | Add field path to fields array |
| 5 | `ui/.../schema/SchemaFormRenderer.tsx` | Add placeholder hint (optional) |
| 6 | `ui/.../wizard/stepFields.ts` | Add to required fields (if required) |
| 7 | `ui/.../hooks/useStepValidation.ts` | Add custom validation (if needed) |
