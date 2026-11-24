# How to Add a Plugin

Plugins are discovered automatically from `<enclave-dir>/plugins/*/plugin.yaml`. The Go backend loads them at startup and the UI can render their config schemas automatically.

## Plugin Directory Structure

```
plugins/my-plugin/
  plugin.yaml           # Required: name, type, order, description
  defaults.yaml         # Optional: default config values
  schemas/
    config.yaml         # Optional: JSON Schema for config validation
    defaults.yaml       # Optional: JSON Schema for defaults validation
  tasks/
    deploy.yaml         # Ansible tasks for deploying this plugin
    pre-validate.yaml   # Optional: pre-deployment checks
    post-validate.yaml  # Optional: post-deployment checks
  files/                # Optional: Kubernetes manifests, templates
```

## Steps

### 1. Create plugin.yaml

```yaml
name: my-plugin
type: addon          # "foundation" (deployed in main playbook) or "addon" (deployed after)
order: 150           # Deployment order (lower = earlier)
description: What this plugin does
defaults:
  myPluginReplicas: 3
  myPluginDebug: false
```

### 2. Create schemas (optional but recommended)

`schemas/config.yaml` — JSON Schema that Ansible validation runs against:

```yaml
type: object
properties:
  myPluginReplicas:
    type: integer
    minimum: 1
  myPluginDebug:
    type: boolean
```

### 3. Create deploy tasks

`tasks/deploy.yaml` — standard Ansible tasks:

```yaml
- name: Deploy my-plugin operator
  ansible.builtin.shell: |
    helm install my-plugin ...
  tags: [deploy]
```

### 4. Add Go model fields (if plugin has config)

File: `internal/models/config.go`

If the plugin has configurable fields that the wizard should expose, add a config struct and embed it in `PluginsConfig`:

```go
type MyPluginConfig struct {
    MyPluginReplicas *int  `json:"myPluginReplicas,omitempty" yaml:"myPluginReplicas,omitempty" doc:"Number of replicas" minimum:"1"`
    MyPluginDebug    *bool `json:"myPluginDebug,omitempty" yaml:"myPluginDebug,omitempty" doc:"Enable debug mode"`
}

type PluginsConfig struct {
    // ...existing fields...
    MyPluginConfig *MyPluginConfig `json:"myPluginDefaults,omitempty" yaml:"myPluginDefaults,omitempty" doc:"My Plugin configuration"`
}
```

### 5. Update config reader/writer (if plugin has its own config file)

If the plugin stores config in a separate file (like `config/plugins/my-plugin.yaml`), add read/write logic:

- `internal/config/reader.go` — add to `mergePluginConfigs()` to read the file
- `internal/config/writer.go` — add a `buildMyPluginConfig()` function and write the file

For simple plugins whose config lives in `global.yaml`, no reader/writer changes are needed.

### 6. Link to an experience

Add the plugin to the relevant experience definition(s):

- Enclave side: `experiences/<id>/experience.yaml`
- UI fallback: `ui/apps/wizard/src/wizard/experiences.ts` in `FALLBACK_EXPERIENCES`

### 7. Verify

```bash
make dev
# Navigate to wizard — plugin should appear in GET /api/v1/plugins
# If linked to an experience, selecting that flavor should include the plugin
```

## Plugin Discovery

The Go backend (`internal/plugins/loader.go`) scans `<enclaveDir>/plugins/*/plugin.yaml`:
- Skips the `example` directory
- Returns plugins sorted by `order`, then `name`
- The `Registry` provides `Get(name)`, `All()`, and `ValidateCombination(names)`

## Existing Plugins

| Plugin | Type | Order |
|--------|------|-------|
| lvms | foundation | 10 |
| odf | foundation | 10 |
| vast-csi | foundation | 10 |
| trust-manager | addon | 100 |
| rhbk | addon | 101 |
| authorino | addon | 102 |
| aap | addon | 103 |
| cnv | addon | 104 |
| nvidia-gpu | addon | 110 |
| openshift-ai | addon | 120 |
| osac | addon | 200 |
| clair-import | addon | 300 |
