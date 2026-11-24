# OSAC Configuration Reference

## Experiences

OSAC defines three service experiences, each with a specific set of plugins:

| Experience | Profile | Plugins | Description |
|---|---|---|---|
| **CaaS** | `caas` | trust-manager, rhbk, authorino, aap, osac | Self-service OpenShift cluster provisioning with Hosted Control Planes |
| **VMaaS** | `vmaas` | trust-manager, rhbk, authorino, aap, gpu-passthrough*, osac | Self-service virtual machine provisioning on OpenShift Virtualization |
| **BMaaS** | `bmaas` | trust-manager, rhbk, authorino, aap, osac | Self-service bare metal server provisioning and lifecycle management |

\* `gpu-passthrough` is planned but not yet available. Use `cnv` for OpenShift Virtualization in the meantime.

Selecting multiple experiences results in the union of their plugins. When both CaaS and VMaaS are selected, the `development` profile is used (enables all operator controllers).

## OSAC Profiles

The `osacProfile` setting controls which controllers are enabled in the OSAC operator:

| Profile | `clusterOrder` | `computeInstance` | `tenant` | `networking` | Use case |
|---|---|---|---|---|---|
| `development` | ✓ | ✓ | ✓ | ✓ | Full stack (CaaS + VMaaS) |
| `caas` | ✓ | | ✓ | ✓ | Cluster provisioning only |
| `vmaas` | | ✓ | ✓ | ✓ | VM provisioning only |
| `bmaas` | | | ✓ | ✓ | Bare metal provisioning only |

## Plugin Configuration

### OSAC Plugin (`config/plugins/osac.yaml`)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `osacAapLicenseFile` | string | **Yes** | — | Path to AAP license manifest.zip on the landing zone |
| `osacProfile` | enum | No | `development` | Deployment profile: `development`, `caas`, `vmaas`, `bmaas` |
| `osacBYODatabase` | bool | No | `false` | Use external PostgreSQL instead of built-in dev postgres |
| `osacDatabaseUrl` | string | No | — | PostgreSQL connection URL (required when `osacBYODatabase=true`) |

### RHBK Plugin (`config/plugins/rhbk.yaml`)

| Field | Type | Default | Description |
|---|---|---|---|
| `rhbk_instances` | int | `1` | Number of Keycloak replicas |
| `rhbk_deploy_database` | bool | `true` | Deploy PostgreSQL alongside Keycloak |
| `rhbk_db_size` | string | `5Gi` | PVC size for Keycloak's PostgreSQL |

### Trust Manager Plugin (defaults only)

| Field | Default | Description |
|---|---|---|
| `trust_manager_cluster_issuer` | `default-ca` | ClusterIssuer name |
| `trust_manager_ca_issuer_duration` | `87600h` | CA certificate lifetime (10 years) |
| `trust_manager_ca_issuer_renew_before` | `8760h` | Renew window (1 year before expiry) |
| `trust_manager_ca_bundle_name` | `ca-bundle` | ConfigMap name for CA bundle |

### AAP Plugin (no configuration required)

Installs the AAP operator only. The OSAC plugin's Helm chart manages the AAP instance.

## OSAC Helm Chart Values

The OSAC Helm chart (from `osac-installer`) exposes these key configuration areas:

### Operator

```yaml
operator:
  controllers:
    clusterOrder: true      # Set by osacProfile
    computeInstance: true    # Set by osacProfile
    tenant: true            # Always enabled
    networking: true        # Always enabled
  aap:
    url: ""                 # Set post-install automatically
    insecureSkipVerify: "true"
    statusPollInterval: "30s"
    templatePrefix: "osac"
```

### Fulfillment Service

```yaml
service:
  variant: openshift
  auth:
    issuerUrl: "https://<keycloak>/realms/osac"    # Auto-derived from RHBK
  database:
    connection:                                     # Auto-configured from osac plugin
      - secret: { name: fulfillment-db }
  certs:
    issuerRef: { kind: ClusterIssuer, name: default-ca }
    caBundle: { configMap: ca-bundle }
```

### AAP Instance

```yaml
aap:
  aap:
    instance:
      enabled: true
      name: "osac-aap"
      controller: { disabled: false }
      eda: { disabled: false }
      hub: { disabled: true }
      lightspeed: { disabled: true }
  bootstrap:
    enabled: true
    backoffLimit: 15
```

### Bare Metal Fulfillment (BMaaS)

```yaml
bmf:
  image:
    repository: ghcr.io/osac-project/bare-metal-fulfillment-operator
    tag: latest
  secrets:
    inventoryConfig: "osac-inventory-config"
    managementConfig: "osac-management-config"
    osClouds: "osac-os-clouds"
  configMaps:
    profiles: "osac-profiles"
```

### Cluster Fulfillment (CaaS)

```yaml
clusterFulfillment:
  enabled: false        # Enable for CaaS with external network integration
  config:
    NETWORK_CLASS: ""
    NETWORK_STEPS_COLLECTION: ""
    EXTERNAL_ACCESS_BASE_DOMAIN: ""
    HOSTED_CLUSTER_BASE_DOMAIN: ""
    HOSTED_CLUSTER_CONTROLLER_AVAILABILITY_POLICY: ""
    HOSTED_CLUSTER_INFRASTRUCTURE_AVAILABILITY_POLICY: ""
  secret:
    AWS_ACCESS_KEY_ID: ""
    AWS_SECRET_ACCESS_KEY: ""
```

### Database

```yaml
# Built-in dev postgres (default)
bundledPostgres:
  enabled: false        # Enclave manages its own PostgreSQL deployment

# BYO database
# osacBYODatabase: true
# osacDatabaseUrl: "postgres://user@host:5432/dbname?sslmode=require"
```

## Configuration Combinations

### Minimal CaaS (development/testing)

```yaml
# config/plugins/osac.yaml
osacAapLicenseFile: /path/to/manifest.zip
osacProfile: caas
```

Deploys: trust-manager → rhbk → authorino → aap → osac with cluster ordering enabled.

### Minimal VMaaS

```yaml
# config/plugins/osac.yaml
osacAapLicenseFile: /path/to/manifest.zip
osacProfile: vmaas
```

Also requires CNV plugin in `enabled_plugins`. Deploys VM provisioning with OpenShift Virtualization.

### Full Stack (CaaS + VMaaS)

```yaml
# config/plugins/osac.yaml
osacAapLicenseFile: /path/to/manifest.zip
osacProfile: development
```

Enables all operator controllers. Requires CNV in `enabled_plugins` for VM support.

### Production with External Database

```yaml
# config/plugins/osac.yaml
osacAapLicenseFile: /path/to/manifest.zip
osacProfile: caas
osacBYODatabase: true
osacDatabaseUrl: "postgres://service:password@db.example.com:5432/fulfillment?sslmode=require"
```

### Production with External Keycloak

```yaml
# config/plugins/rhbk.yaml
rhbk_instances: 3
rhbk_deploy_database: false    # Use external PostgreSQL for Keycloak
```

### BMaaS Only

```yaml
# config/plugins/osac.yaml
osacAapLicenseFile: /path/to/manifest.zip
osacProfile: bmaas
```

Deploys bare metal fulfillment operator for hardware lifecycle management.

## Deployment Order

Following enclave's plugin deployment model, plugins are deployed sequentially:

1. `trust-manager` (order 100) — cert-manager ClusterIssuer + CA bundle
2. `rhbk` (order 101) — Red Hat Build of Keycloak
3. `authorino` (order 102) — gRPC authorization
4. `aap` (order 103) — AAP operator (CRDs only)
5. `cnv` (order 104) — OpenShift Virtualization (VMaaS/development only)
6. `osac` (order 200) — OSAC Helm chart + AAP instance + fulfillment service

Each plugin is deployed via `make deploy-plugin PLUGIN=<name>` from the enclave directory. The wizard automates this by chaining `deploy-plugin.yaml` playbook runs after the main deployment completes.
