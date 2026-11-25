# Enclave Wizard UI Design Spec

## Overview

A web-based install wizard for Red Hat Sovereign Enclave (RHSE), running on the landing zone LAN. The wizard collects deployment configuration from the user and writes it to disk via the enclave-wizard API. The UI is semi-dynamic: wizard steps and field groupings are hardcoded, but within each step, form fields are rendered from the API's OpenAPI schema. New fields added to the API appear automatically.

## Architecture Decisions

- **Option A**: UI owns wizard state; API is a thin config read/write/validate layer (no server-side wizard state).
- **Flavor model**: The UI presents "flavor" cards (product-level abstractions). Only "Cluster as a Service" ships initially; the system is designed for adding VM, Model, and Bare Metal flavors later.
- **Secure & Comply**: Skipped. The wizard only exposes fields that produce real enclave config YAML.
- **API client**: Generated from the enclave-wizard OpenAPI spec via openapi-generator-cli (containerized), matching migration-planner's approach.
- **DI pattern**: IoC container copied from migration-planner-agent-ui.
- **Defaults**: Loaded from `GET /api/v1/defaults` at wizard init.
- **Validation**: Client-side validation per step (from schema metadata) + `POST /api/v1/config/validate` before Review.
- **Generate**: Calls `PUT /api/v1/config` to write YAML files to disk. Shows success/failure.
- **Testing**: Vitest + React Testing Library for unit/component tests. Containerized test execution.
- **Development**: Podman + Containerfiles. No local Node.js required.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Package manager | Yarn 4 (with .yarn/releases) |
| Monorepo | Yarn workspaces |
| Framework | React 18 |
| UI library | PatternFly 6 (@patternfly/react-core, react-icons, react-table) |
| Build | Vite + @vitejs/plugin-react-swc |
| Linting | Biome |
| Routing | react-router-dom v6 |
| API client | openapi-generator typescript-fetch |
| DI | `@y0n1/react-ioc` |
| Testing | Vitest + @testing-library/react |
| Containers | Podman, Containerfile, compose.yaml |

## Project Structure

```
enclave-wizard-ui/
├── .yarn/releases/yarn-4.x.cjs
├── .yarnrc.yml
├── package.json                    # root workspace config
├── biome.json                      # root linter config
├── Makefile                        # dev, build, test, api-client targets
├── openapitools.json               # openapi-generator → enclave-wizard spec
├── Containerfile                   # production: multi-stage build + nginx
├── Containerfile.dev               # development: Node.js + yarn + hot reload
├── compose.yaml                    # wizard-ui + wizard-api stack
├── nginx.conf                      # production proxy config
├── packages/
│   └── api-client/                 # generated TypeScript fetch client
│       ├── src/apis/              # ConfigApi, DefaultsApi, PluginsApi
│       ├── src/models/            # EnclaveConfig, GlobalConfig, etc.
│       └── api/openapi.yaml       # source spec from enclave-wizard
├── apps/
│   └── wizard/
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts          # proxy /api/v1 → backend
│       ├── biome.json
│       ├── tsconfig*.json
│       └── src/
│           ├── main/
│           │   ├── Root.tsx        # entry, DI setup, PatternFly CSS import
│           │   ├── Router.tsx      # lazy-loaded routes
│           │   └── Symbols.ts     # DI symbols
│           ├── api/
│           │   └── useEnclaveApi.ts  # hook wrapping generated client
│           ├── schema/
│           │   ├── useOpenApiSchema.ts    # fetch + cache /openapi.json
│           │   ├── SchemaFormRenderer.tsx # renders fields from JSON Schema
│           │   └── fieldMapping.ts        # maps schema paths → wizard steps
│           ├── wizard/
│           │   ├── WizardContext.tsx      # state (step, form data, errors)
│           │   ├── WizardPage.tsx         # layout + stepper
│           │   ├── steps/
│           │   │   ├── WelcomeStep.tsx
│           │   │   ├── SelectFlavorStep.tsx
│           │   │   ├── ClusterNetworkStep.tsx
│           │   │   ├── StorageRegistryStep.tsx
│           │   │   ├── HostsCertificatesStep.tsx
│           │   │   ├── ReviewStep.tsx
│           │   │   └── GenerateStep.tsx
│           │   └── components/
│           │       ├── FlavorCard.tsx
│           │       ├── HostEntryCard.tsx
│           │       └── CertificateField.tsx
│           └── common/
│               └── components/
```

## Wizard Steps

### Step 1: Welcome

Hero landing page with project branding and "Get started" CTA. Static content, no form fields.

### Step 2: Select Flavor

Displays flavor cards from the `FLAVORS` array. User selects one (only "Cluster as a Service" available). Selection stored in `WizardState.selectedFlavor`.

### Step 3: Cluster & Network

Fields from `global.*` schema paths:

- workingDir, baseDomain, clusterName
- machineNetwork, apiVIP, ingressVIP, rendezvousIP
- defaultDNS, defaultGateway, defaultPrefix
- lzBmcIP, lzBmcHostname (optional)
- disconnected (toggle)
- masterMaxPods, diskEncryption, ocMirrorLogLevel, defaultNtpServers (collapsible "Advanced" section)

Pre-populated from `GET /api/v1/defaults` where applicable.

### Step 4: Storage & Registry

Fields from `global.*` schema paths:

- quayUser, quayPassword
- quayBackend (select: RadosGWStorage / LocalStorage)
- quayBackendRGWConfiguration.* (conditional — shown when RadosGWStorage selected)
- blockStorageBackend / storage_plugin (select: lvms / odf)
- odfExternalConfig (conditional — shown when odf selected)
- lvmsConfig (conditional — shown when lvms selected)
- enabled_plugins (multi-select, populated from `GET /api/v1/plugins`)

### Step 5: Hosts & Certificates

**Hosts section** (flavor-aware — Cluster as a Service shows both):
- agent_hosts: exactly 3 host entries (HostEntryCard component)
  - Each: name, macAddress, ipAddress, redfish, redfishUser, redfishPassword, rootDisk, bmcSystemId (optional), mapInterfaces (optional), networkConfig (optional)
- discovery_hosts: variable number of host entries (from cloudInfra)

**Auth section**:
- pullSecret (textarea — user pastes JSON from console.redhat.com)
- sshPubPath (text input)

**Certificates section**:
- sslAPICertificateFullChain, sslAPICertificateKey
- sslIngressCertificateFullChain, sslIngressCertificateKey
- sslCACertificate
- ironicHTTPSCertificate, ironicHTTPSKey
- All optional PEM text areas (CertificateField component)

### Step 6: Review

Read-only summary of all configured values, grouped by step. Calls `POST /api/v1/config/validate` with the full `EnclaveConfig` payload. Displays validation errors if any, with links back to the relevant step.

### Step 7: Generate

Calls `PUT /api/v1/config` to write YAML files to disk. Shows a spinner during the write, then success message with the file paths written, or error details on failure.

## Schema-Driven Form Rendering

### Field Mapping

`fieldMapping.ts` declares which schema paths belong to which step:

```typescript
const STEP_FIELD_MAP: Record<string, string[]> = {
  "cluster-network": [
    "global.workingDir",
    "global.baseDomain",
    "global.clusterName",
    // ... all cluster & network paths
  ],
  "storage-registry": [
    "global.quayUser",
    "global.quayBackend",
    // ... all storage & registry paths
  ],
  "hosts-certificates": [
    "global.agent_hosts",
    "certificates",
    "cloudInfra.discovery_hosts",
    // ... all host & cert paths
  ],
};
```

Schema paths not claimed by any step appear in an "Additional Settings" section at the bottom of the last configure step (Hosts & Certificates). This is how new API fields appear automatically.

### SchemaFormRenderer

Given a list of schema paths and the parsed OpenAPI spec, renders form fields:

| Schema type | PatternFly widget |
|-------------|-------------------|
| `string` with `enum` | `<FormSelect>` |
| `string` with `pattern` (IP/CIDR/MAC) | `<TextInput>` with regex validation |
| `string` (plain) | `<TextInput>` |
| `string` (multiline, e.g. PEM certs) | `<TextArea>` via CertificateField |
| `boolean` | `<Checkbox>` |
| `integer` with `minimum`/`maximum` | `<NumberInput>` |
| `array` of `string` | multi-value text input (add/remove) |
| `array` of objects (hosts) | custom HostEntryCard (not auto-rendered) |
| `object` (nested) | recursive sub-fields, conditionally shown |

The Huma `doc` annotation becomes each field's `<FormHelperText>`.

### Conditional Fields

Hardcoded in step components (not derived from schema):

- `quayBackendRGWConfiguration.*` visible when `quayBackend === "RadosGWStorage"`
- `odfExternalConfig` visible when `storage_plugin === "odf"`
- `lvmsConfig` visible when `storage_plugin === "lvms"`

## Wizard State

```typescript
type WizardState = {
  currentStep: number;
  selectedFlavor: FlavorId | null;
  configData: Partial<EnclaveConfig>;
  validationErrors: ValidationError[];
  apiDefaults: DefaultsOutput | null;
  schema: OpenAPISchema | null;
  plugins: PluginDescriptor[];
};

type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_FLAVOR"; flavor: FlavorId }
  | { type: "SET_FIELD"; path: string; value: unknown }
  | { type: "SET_DEFAULTS"; defaults: DefaultsOutput }
  | { type: "SET_SCHEMA"; schema: OpenAPISchema }
  | { type: "SET_PLUGINS"; plugins: PluginDescriptor[] }
  | { type: "SET_VALIDATION_ERRORS"; errors: ValidationError[] }
  | { type: "LOAD_CONFIG"; config: EnclaveConfig };
```

Managed via `useReducer` in `WizardContext`. The reducer uses the `SET_FIELD` action with dot-path notation (`"global.apiVIP"`) to merge values into the nested `configData` object.

## Data Flow

1. **Init**: Wizard mounts → parallel fetch of `/openapi.json`, `GET /api/v1/defaults`, `GET /api/v1/plugins`, `GET /api/v1/config` (for resume). Results dispatched to context.

2. **Per step**: SchemaFormRenderer reads `configData` for values, dispatches `SET_FIELD` on change. Client-side validation runs on "Next" — checks `required`, `pattern`, `minimum`/`maximum`, `minItems`/`maxItems` from schema metadata.

3. **Review**: Calls `POST /api/v1/config/validate`. Displays API errors. User can navigate back to fix.

4. **Generate**: Calls `PUT /api/v1/config`. Shows success or error.

5. **Resume**: If `GET /api/v1/config` returns existing config, dispatches `LOAD_CONFIG` to pre-fill all fields.

## Flavor Extensibility

```typescript
type FlavorId = "cluster";

type FlavorDefinition = {
  id: FlavorId;
  title: string;
  description: string;
  icon: ReactNode;
  hostStepPaths: string[];     // schema paths for flavor-specific host config
  defaultPlugins: string[];    // plugins pre-selected for this flavor
};

const FLAVORS: FlavorDefinition[] = [
  {
    id: "cluster",
    title: "Cluster as a Service",
    description: "On-demand container clusters with built-in scalability, resilience, and lifecycle management.",
    icon: <ClusterIcon />,
    hostStepPaths: ["global.agent_hosts", "cloudInfra.discovery_hosts"],
    defaultPlugins: ["lvms"],
  },
];
```

Adding a flavor: add an entry to `FLAVORS`, optionally extend `fieldMapping.ts` with flavor-specific groupings, and create any custom components for that flavor's host/node UI.

## Container Setup

### Development (Containerfile.dev)

Node.js 22 Alpine image, yarn install, Vite dev server with hot reload on port 3001. Source directories mounted as volumes for live editing.

### Production (Containerfile)

Multi-stage: Node.js build stage → nginx Alpine serving static files. nginx proxies `/api/v1/*` to the enclave-wizard backend.

### compose.yaml

Two services:
- `wizard-ui`: dev container on port 3001, source volumes mounted
- `wizard-api`: enclave-wizard binary on port 8080, enclave repo mounted at `/enclave`

Vite dev server proxies `/api/v1/*` to `wizard-api:8080`.

### Makefile Targets

| Target | Description |
|--------|-------------|
| `make dev` | `podman compose up` — full stack with hot reload |
| `make build` | `podman build -f Containerfile` — production image |
| `make test` | Run Vitest in container |
| `make test-watch` | Vitest watch mode in container |
| `make api-client` | Generate TypeScript client from OpenAPI spec |
| `make check` | Run Biome lint/format in container |
| `make clean` | Remove containers and build artifacts |

## Testing

### Unit/Component Tests (Vitest + React Testing Library)

- **SchemaFormRenderer**: given JSON Schema fragments, verify correct PatternFly widgets render
- **fieldMapping**: verify unclaimed schema fields appear in catch-all section
- **WizardContext**: step navigation, form data persistence, reducer correctness
- **Conditional fields**: RGW config visibility, ODF/LVMS toggling
- **Validation**: required fields, IP/CIDR/MAC patterns, host count constraints
- **FlavorCard**: selection state, keyboard accessibility

### Integration Tests

Tests against the real containerized API (via compose test profile):
- Load defaults from API and verify form pre-population
- Submit config and verify API receives correct payload
- Validate config and verify error display
