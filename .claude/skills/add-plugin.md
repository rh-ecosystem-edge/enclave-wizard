---
name: add-plugin
description: Add a new enclave plugin — directory structure, plugin.yaml, schemas, Go model fields, and experience linking. Use when creating a new deployable plugin.
---

# Add a Plugin

## 1. Create plugin directory

In the enclave repo (or `enclave-mock/`):

```
plugins/my-plugin/
  plugin.yaml       # Required: name, type, order
  defaults.yaml     # Optional: default values
  schemas/
    config.yaml     # Optional: JSON Schema for validation
  tasks/
    deploy.yaml     # Ansible deploy tasks
```

## 2. Create plugin.yaml

```yaml
name: my-plugin
type: addon           # "foundation" or "addon"
order: 150            # Deploy order (lower = earlier)
description: What this plugin does
defaults:
  myPluginReplicas: 3
```

## 3. Add Go model fields (if configurable)

File: `internal/models/config.go`

Add a config struct and embed in `PluginsConfig`:

```go
type MyPluginConfig struct {
    Replicas *int `json:"myPluginReplicas,omitempty" yaml:"myPluginReplicas,omitempty" doc:"Number of replicas" minimum:"1"`
}
```

## 4. Update config reader/writer (if separate config file)

- `internal/config/reader.go` — add to `mergePluginConfigs()`
- `internal/config/writer.go` — add extraction function

For plugins whose config lives in `global.yaml`, no changes needed.

## 5. Link to experience

- Enclave: `experiences/<id>/experience.yaml`
- UI fallback: `ui/apps/wizard/src/wizard/experiences.ts`

## 6. Verify

```bash
make dev
# Check GET /api/v1/plugins — plugin should appear
```

See `docs/contributing/how-to/add-plugin.md` for the full guide.
