# Enclave Lab Testing Patterns

Comprehensive documentation of all testing patterns, frameworks, tools, and approaches
used in the [Enclave](https://github.com/rh-ecosystem-edge/enclave) repository.

---

## 1. Test Frameworks and Tools

The Enclave repo uses **no traditional unit test frameworks** (no pytest, no bats, no Go
test). Instead, it relies on a combination of linters, schema validators, Ansible-based
validation playbooks, and shell-script-based verification scripts.

### Linting Tools

| Tool | Purpose | Config File |
|------|---------|-------------|
| **shellcheck** | Static analysis of shell scripts | N/A (uses `-x -S warning` flags) |
| **yamllint** | YAML syntax and formatting validation | `.yamllint.yml` |
| **ansible-lint** | Ansible playbook best-practices lint | `.ansible-lint` |
| **actionlint** | GitHub Actions workflow validation | `.github/actionlint.yaml` |

### Schema Validation

| Tool | Purpose |
|------|---------|
| **ansible.utils.jsonschema** | JSON Schema validation via Ansible `ansible.utils.validate` module |
| **python3 + PyYAML** | YAML parsing and structural validation (used in plugin validation) |
| **jsonschema (Python)** | JSON Schema support library on the Landing Zone |

### Build/CI Tools

| Tool | Purpose |
|------|---------|
| **make** | Task runner (both `Makefile` for Landing Zone, `Makefile.ci` for CI) |
| **podman** | Container builds and CI image testing |
| **ansible-playbook** | Validation playbook execution |

---

## 2. Types of Tests

### 2.1 Static Analysis / Linting

**Shell Script Validation** (`validate-shell`)
- Runs `shellcheck -x -S warning` on all `.sh` files under `scripts/`.
- Catches common shell scripting errors, quoting issues, and portability problems.

**YAML Validation** (`validate-yaml`)
- Runs `yamllint` with the project config (`.yamllint.yml`).
- Validates all YAML files in the repo. Key-duplicates are treated as errors; most
  other rules are warning-only for gradual adoption.
- Ignores: `.github/`, `.git/`, `.idea/`, `*.j2`, `*.jinja2`, `config/*.example.yaml`.

**Ansible Lint** (`validate-ansible`)
- Runs `ansible-lint` using `basic` profile (lenient).
- Numerous rules are skipped (line-length, trailing-spaces, fqcn, no-changed-when, etc.)
  for gradual adoption.
- Excludes: `.git/`, `.github/`, schemas, example configs, Jinja2 templates.

**Makefile Validation** (`validate-makefile`)
- Runs `make -n help` on both `Makefile` and `Makefile.ci` to verify syntax.

### 2.2 JSON Schema Validation

**Defaults Schema Validation** (`validate-json-schema`)
- Validates every `defaults/*.yaml` file against its corresponding schema in `schemas/`.
- Schemas validated:
  - `deployment.yaml`
  - `catalogs.yaml`
  - `control_binaries.yaml`
  - `operators.yaml`
  - `platforms.yaml`
  - `mirror_registry.yaml`
  - `quay_operator.yaml`
  - `oc_mirror.yaml`
  - `k8s.yaml`
- Also validates every `plugins/*/plugin.yaml` against `schemas/plugin.yaml`.
- Additionally asserts that `mgmt_openshift_version` is present in the `openshift_versions` list.

**Variables Schema Validation**
- Validates test fixtures against `schemas/variables.yaml` using `ansible.utils.jsonschema`.
- **Valid fixtures** (under `test-fixtures/schemas/valid/`): must pass validation.
- **Invalid fixtures** (under `test-fixtures/schemas/invalid/`): must fail validation;
  the test asserts that they indeed fail (negative testing).

### 2.3 Template Rendering Validation

**Template Validation** (`validate-templates`)
- Playbook: `playbooks/validation/validate-templates.yaml`
- Uses test fixture data from `test-fixtures/templates/global.yaml` (synthetic values
  using RFC 5737 TEST-NET addresses).
- Workflow:
  1. **Setup**: Loads all default var files, plugin descriptors; creates a temp directory
     with dummy pull secret, SSH key, and CA certificate files.
  2. **Render templates**: Renders each Jinja2 template to the temp directory.
  3. **Validate output**: Asserts that rendered output is valid YAML and has the expected
     structure.
- Templates validated:
  - `imagesetconfiguration.yaml` (both connected and disconnected variants)
  - `agent-config.yaml`
  - `install-config-connected.yaml` and `install-config-disconnected.yaml`
  - `registries.conf`
  4. **Teardown**: Removes temp directory.

### 2.4 Ansible Tag Validation

**Tag Validation** (`validate-tags`)
- Verifies that Ansible playbook tags correctly include expected tasks.
- Runs `ansible-playbook --list-tasks --tags <tag>` for each tag and checks that the
  expected task name appears in the output.
- Tags validated (partial list):
  - `download-content`, `download-control-binaries` (01-prepare.yaml)
  - `mirror-registry` (02-mirror.yaml)
  - `configure-abi`, `hardware`, `wait-deployment` (03-deploy.yaml)
  - `post-install-config` (04-post-install.yaml)
  - `operators` (05-operators.yaml)
  - `clair-disconnected`, `acm-policy-catalogsources` (06-day2.yaml)
  - `schema-validation` (validate-schema.yaml)
  - `mirror-validation` (validate-mirror.yaml)

### 2.5 Plugin Validation

**Plugin Structure Validation** (`validate-plugins`)
- Script: `scripts/verification/validate_plugins.sh`
- For each plugin under `plugins/`:
  1. Checks `plugin.yaml` exists and is a valid YAML mapping.
  2. Validates required fields (`name`, `type`) and known fields.
  3. Validates that task files under `tasks/` are valid YAML lists of task mappings.
  4. Checks for unexpected files/directories (only `plugin.yaml`, `tasks/`, `files/`,
     `charts/`, and `templates/` are allowed).

### 2.6 Configuration Validation (Runtime)

**Configuration Validation** (`validations.sh`)
- A comprehensive runtime validation script run on the Landing Zone before deployment.
- Invoked via `make validate-config`.
- Validates:
  - **Syntax**: YAML parsing of configuration files via Ansible variable rendering.
  - **IP addresses**: API VIP != Ingress VIP; all VIPs and gateway in machine network.
  - **DNS**: Landing Zone DNS matches `defaultDNS`; DNS resolution for API, ingress,
    and mirror registry hostnames.
  - **Pull secret**: Tests image manifest inspection with the pull secret.
  - **Redfish/BMC**: Validates redfish connectivity to all 3 agent hosts.
  - **S3/RadosGW**: (when `quayBackend=RadosGWStorage`) Validates S3 endpoint, bucket
    access, and chunk size configuration.
  - **SSL certificates**: Validates API and ingress certificates (key/cert match,
    expiry, subject alternate names). Optional Ironic HTTPS cert.
  - **nmstate**: Validates advanced network config on hosts with `networkConfig`.
  - **HTTP server**: Verifies content served from `/var/www/html` is accessible.
  - **Mirror registry port**: Checks port 8443 availability.

### 2.7 Mirror Artifact Validation

**Mirror Validation** (`validate-mirror`)
- Playbook: `playbooks/validation/validate-mirror.yaml`
- Run after Phase 2 (mirror registry setup) to validate artifacts.
- Validations:
  1. **Mirror registry health**: Quay container is running; API returns 200.
  2. **Pull secret**: File exists, contains mirror auth entry, credentials decode properly.
  3. **IDMS manifest**: Exists, is valid YAML, contains OCP release mirror entries.
  4. **ITMS manifest**: Exists and is valid YAML.
  5. **CatalogSource manifests**: Exist, images point to local mirror, sourceType is `grpc`.
  6. **TLS certificate**: CA cert exists, not expired, hostname matches.
  7. **imagesetconfiguration.yaml**: Exists, has platform channels and operator catalogs.
- Validations 3-5 are skipped in dry-run mode (oc-mirror `--dry-run` does not generate
  cluster-resources).

### 2.8 Infrastructure Verification

Multiple shell scripts verify different layers of the infrastructure:

**Verify Infrastructure** (`scripts/verification/verify_infrastructure.sh`)
- Checks libvirt networks (BMC and cluster) exist and are active.
- Checks master VMs exist with correct network interface count.
- Checks Landing Zone VM exists and has 2 network interfaces.
- Checks BMC emulation (sushy-tools) is accessible via Redfish API.

**Verify Landing Zone** (`scripts/verification/verify_landing_zone.sh`)
- 12 tests covering:
  1. VM is running
  2. SSH connectivity
  3. Network interfaces (BMC + cluster)
  4. BMC network connectivity (ping gateway)
  5. Cluster network connectivity
  6. sushy-tools accessibility from LZ
  7. Required packages (git, ansible, python3, curl, jq)
  8. Disk space
  9. cloud-init completion
  10. Hostname configuration

**Verify Enclave Installation** (`scripts/verification/verify_enclave_installation.sh`)
- 12 tests covering:
  1. SSH connectivity
  2. Enclave Lab directory and playbooks exist
  3. Configuration files exist and are valid YAML
  4. Required tools installed (git, ansible, python3, curl, jq, podman, httpd, nmstatectl)
  5. Web server running
  6. Ansible collections installed (containers.podman, kubernetes.core, community.crypto, ansible.utils)
  7. SSH key exists
  8. Pull secret embedded in configuration
  9. Directory structure (defaults, templates, operators, files)
  10. DNS resolution for cluster endpoints and mirror registry
  11. Network connectivity to BMC emulation
  12. Disk space (400GB+ recommended)

**Verify Cluster** (`scripts/verification/verify_cluster.sh`)
- Verifies OpenShift cluster deployment:
  - Landing Zone IP accessible
  - Kubeconfig exists
  - Nodes are ready (count)
  - Cluster operators are healthy (no degraded operators)
  - Cluster version retrieved

**Verify Cleanup** (`scripts/cleanup/verify_cleanup.sh`)
- Post-cleanup verification:
  - No leftover VMs
  - No leftover networks
  - No leftover files/directories
  - No leftover storage pools

### 2.9 CI Image Testing

**CI Image Smoke Tests** (`test-ci-image` target)
- Verifies the CI container image by running version commands:
  1. `shellcheck --version`
  2. `yamllint --version`
  3. `ansible-lint --version`
  4. `ansible --version`
  5. `make --version`
  6. `docker --version`

### 2.10 Tarball Validation

**Build Artifact Validation** (in `build-push-tarball.yml`)
- After building the tarball:
  - Size check (must not exceed 1GB).
  - Required files present (`.version`, `Makefile`).
  - Required directories present (`playbooks`, `operators`, `configs`).
  - Excluded paths not present (`.git/`, `.github/`, `Makefile.ci`).
  - File count validation: source directory file count matches tarball count for
    critical directories.

### 2.11 Pre-install Validation

**Pre-install Hardware Validation** (playbook tag `pre-install-validate`)
- Validates servers are ready before OpenShift installation.
- Plugin-level pre-install validation: `playbooks/tasks/pre_install_validate_plugins.yaml` and
  `playbooks/tasks/validate_enabled_plugins.yaml`.

### 2.12 Preflight Checks

**CI Preflight Checks** (`scripts/setup/preflight_checks.sh`)
- Validates environment before CI workflow execution:
  - `DEV_SCRIPTS_PATH` is set
  - `BASE_WORKING_DIR` or `WORKING_DIR` is set
  - `PULL_SECRET` is set (optional check)
  - System resources: total RAM, available disk space (minimum 80GB)
  - Libvirt access

---

## 3. Directory Structure

```
enclave/
  .ansible-lint                    # Ansible-lint configuration
  .yamllint.yml                    # yamllint configuration
  .github/
    actionlint.yaml                # actionlint runner label config
    actions/
      allocate-subnet/action.yml   # Composite action: allocate unique subnet
      collect-artifacts/action.yml # Composite action: collect CI artifacts
      notify-slack/action.yml      # Composite action: Slack notifications
      preflight-checks/action.yml  # Composite action: preflight checks
      setup-cluster-name/action.yml # Composite action: generate cluster name
    workflows/
      pr-validation.yml            # PR validation (lint, schema, templates, tags, plugins)
      e2e-deployment.yml           # E2E deployment tests (connected + disconnected)
      e2e-odf-schedule.yml         # Scheduled ODF E2E dispatch
      infra-verify.yml             # Infrastructure verification
      disconnected-dry-run.yml     # Disconnected dry-run (mirror without image download)
      ci-image.yml                 # CI image build/test/push
      resolve-ci-image.yml         # Reusable: resolve CI image (build if changed)
      build-push-tarball.yml       # Build and validate tarball artifact
      cleanup.yml                  # Scheduled/manual infrastructure cleanup
      slash-command.yml            # /test and /retest PR comment commands
      labeler.yml                  # Automatic PR labeling
      Dockerfile.ci                # CI container image definition
  Makefile                         # Landing Zone targets (validate-config, validate-schema)
  Makefile.ci                      # CI targets (validate-*, verify-*, test-ci-image, etc.)
  validations.sh                   # Runtime configuration validation script
  schemas/
    definitions.yaml               # Shared JSON Schema definitions ($refs)
    variables.yaml                 # Schema for user configuration (global.yaml)
    deployment.yaml                # Schema for defaults/deployment.yaml
    catalogs.yaml                  # Schema for defaults/catalogs.yaml
    control_binaries.yaml          # Schema for defaults/control_binaries.yaml
    operators.yaml                 # Schema for defaults/operators.yaml
    platforms.yaml                 # Schema for defaults/platforms.yaml
    mirror_registry.yaml           # Schema for defaults/mirror_registry.yaml
    quay_operator.yaml             # Schema for defaults/quay_operator.yaml
    oc_mirror.yaml                 # Schema for defaults/oc_mirror.yaml
    k8s.yaml                       # Schema for defaults/k8s.yaml
    plugin.yaml                    # Schema for plugin descriptors
  test-fixtures/
    schemas/
      valid/                       # Valid config fixtures (must pass schema validation)
        local-lvms.yaml
        local-lvms-with-discovery.yaml
        local-lvms-with-ironic-https.yaml
        local-lvms-with-ssl.yaml
        local-odf.yaml
        radosgw-lvms-all-optionals.yaml
        radosgw-odf.yaml
      invalid/                     # Invalid config fixtures (must fail schema validation)
        invalid-additional-property.yaml
        invalid-discovery-host-missing-field.yaml
        invalid-empty-string.yaml
        invalid-enum.yaml
        invalid-ip.yaml
        invalid-port.yaml
        invalid-rgw-unknown-key.yaml
        invalid-storage-path.yaml
        ironic-https-empty-key.yaml
        ironic-https-missing-key.yaml
        odf-without-external-config.yaml
        radosgw-without-rgw-config.yaml
        ssl-empty-key.yaml
        ssl-missing-key.yaml
    templates/
      global.yaml                  # Template rendering fixture (synthetic values)
  playbooks/
    validation/
      validate-schema.yaml         # Schema validation playbook (defaults + variables)
      validate-templates.yaml      # Template rendering validation playbook
      validate-mirror.yaml         # Mirror artifact validation playbook
      tasks/
        defaults_schema_validation.yaml   # Validates all defaults/*.yaml schemas
        variables_schema_validation.yaml  # Validates test-fixtures against variables schema
    tasks/
      template_validation/
        main.yaml                  # Entry point for template validation
        setup.yaml                 # Load vars, create temp dir, dummy files
        teardown.yaml              # Remove temp directory
        test_agent_config.yaml     # Validate agent-config template rendering
        test_imagesetconfiguration.yaml # Validate imagesetconfiguration template
        test_install_config.yaml   # Validate install-config templates
        test_registries_conf.yaml  # Validate registries.conf template
      mirror_validation.yaml       # Mirror artifact validation tasks (7 checks)
      pre_install_validate_plugins.yaml
      validate_enabled_plugins.yaml
      validate_single_plugin.yaml
  scripts/
    verification/
      validate.sh                  # Main validation orchestrator
      validate_plugins.sh          # Plugin directory structure validation
      verify_infrastructure.sh     # Infrastructure verification (networks, VMs, BMC)
      verify_landing_zone.sh       # Landing Zone VM verification (12 tests)
      verify_enclave_installation.sh # Enclave Lab installation verification (12 tests)
      verify_cluster.sh            # OpenShift cluster verification
      collect_ci_artifacts.sh      # CI artifact collection (4 levels)
      collect_step_logs.sh         # Collect per-step logs
    cleanup/
      verify_cleanup.sh            # Post-cleanup verification
      cleanup.sh                   # Infrastructure cleanup
      cleanup_infrastructure.sh    # Infrastructure cleanup details
      cleanup_orphaned_resources.sh
    setup/
      preflight_checks.sh          # CI preflight checks
      validate_prerequisites.sh    # Prerequisite validation
    infrastructure/
      verify_networks.sh           # Network verification
      verify_ceph.sh               # Ceph health verification
      verify_ceph_on_lz.sh         # Ceph on Landing Zone verification
```

---

## 4. How Tests Are Run

### Makefile Targets

**`Makefile` (Landing Zone)**:
- `make validate-config` -- Run runtime configuration validation (`validations.sh`)
- `make validate-schema` -- Run schema validation playbook with user config

**`Makefile.ci` (CI, includes Makefile)**:
- `make -f Makefile.ci validate` -- Run ALL validation checks
- `make -f Makefile.ci validate-shell` -- shellcheck
- `make -f Makefile.ci validate-yaml` -- yamllint
- `make -f Makefile.ci validate-json-schema` -- JSON schema validation
- `make -f Makefile.ci validate-ansible` -- ansible-lint
- `make -f Makefile.ci validate-tags` -- Ansible tag validation
- `make -f Makefile.ci validate-templates` -- Template rendering validation
- `make -f Makefile.ci validate-makefile` -- Makefile syntax validation
- `make -f Makefile.ci validate-plugins` -- Plugin structure validation
- `make -f Makefile.ci validate-mirror` -- Mirror artifact validation (on Landing Zone)
- `make -f Makefile.ci test-ci-image` -- Smoke-test the CI container image
- `make -f Makefile.ci verify` -- Verify infrastructure
- `make -f Makefile.ci verify-landing-zone` -- Verify Landing Zone VM
- `make -f Makefile.ci verify-enclave-installation` -- Verify Enclave Lab installation
- `make -f Makefile.ci verify-cluster` -- Verify OpenShift cluster deployment
- `make -f Makefile.ci verify-cleanup` -- Verify infrastructure cleanup
- `make -f Makefile.ci ci-flow-connected` -- Full CI flow (connected mode)
- `make -f Makefile.ci ci-flow-disconnected` -- Full CI flow (disconnected mode)

### Central Validation Script

`scripts/verification/validate.sh` is the main validation orchestrator. It accepts a
subcommand (`all`, `shell`, `yaml`, `json-schema`, `ansible`, `tags`, `templates`,
`makefile`, `plugins`, `mirror`) and runs the corresponding check(s). When called with
`all`, it runs all checks and reports aggregate pass/fail.

---

## 5. CI/CD Integration (GitHub Actions)

### Self-Hosted Runners

Three runner classes are defined in `.github/actionlint.yaml`:
- `pr-validation` -- Fast validation jobs (linting, schema, templates)
- `enclave-small` -- Medium jobs (infrastructure verification, dry-run, cleanup)
- `enclave-large` -- Long-running E2E deployment jobs

### CI Container Image

Defined in `.github/workflows/Dockerfile.ci`:
- Base: `registry.access.redhat.com/ubi10/ubi`
- Installed tools: shellcheck, yamllint, ansible-core, ansible-lint, make, docker CLI,
  gh CLI, python3, git, curl
- Pre-installed: Ansible Galaxy collections, Python pip requirements
- Built and pushed to `quay.io/edge-infrastructure/enclave-lab-ci`

The `resolve-ci-image.yml` reusable workflow conditionally builds a SHA-tagged image when
`Dockerfile.ci`, `ansible_collections.txt`, or `ansible_pip_requirements.txt` change;
otherwise uses `:latest`.

### Workflow: PR Validation (`pr-validation.yml`)

Triggered on: PR opened/synchronized/reopened, merge_group, workflow_dispatch.

Runs 8 parallel validation jobs inside the CI container:
1. **shellcheck** -- `make -f Makefile.ci validate-shell`
2. **yamllint** -- `make -f Makefile.ci validate-yaml`
3. **json-schema** -- `make -f Makefile.ci validate-json-schema`
4. **ansible-lint** -- `make -f Makefile.ci validate-ansible`
5. **ansible-tags** -- `make -f Makefile.ci validate-tags`
6. **template-rendering** -- `make -f Makefile.ci validate-templates`
7. **makefile** -- `make -f Makefile.ci validate-makefile`
8. **plugins** -- `make -f Makefile.ci validate-plugins`

Each job uploads logs as artifacts on failure (7-day retention).

### Workflow: E2E Deployment (`e2e-deployment.yml`)

Triggered on: PR, merge_group, nightly schedule (3:00 UTC), workflow_dispatch.

Uses `dorny/paths-filter` to detect whether E2E-relevant files changed and skip
E2E tests for documentation-only changes.

Runs two parallel E2E jobs with matrix strategy:
- **e2e-connected**: Connected mode (pulls from upstream registries).
  Timeout: 210 minutes.
- **e2e-disconnected**: Air-gapped mode with local mirror registry.
  Timeout: 360 minutes (600 for scheduled runs).

Each E2E job performs a full deployment lifecycle:
1. Generate unique cluster name
2. Setup cluster-specific working directory
3. Preflight checks
4. Allocate unique subnet (for parallel execution isolation)
5. Create infrastructure (VMs, networks, BMC emulation)
6. Provision Landing Zone VM
7. Install Enclave Lab
8. (Optional) Generate Ironic TLS certificate
9. (Optional) Setup Ceph for ODF
10. Bootstrap phases: setup, validate, download content, build cache, acquire hardware,
    deploy cluster, post-install, operators, day-2, discovery
11. Verify cluster deployment
12. Collect artifacts (basic on success, full diagnostics + must-gather on failure)
13. Cleanup infrastructure
14. Post-cleanup state verification
15. Slack notification (scheduled runs or manual opt-in)

Storage plugin matrix: `lvms` (default) or `odf` (on dedicated ODF runners).

### Workflow: Infrastructure Verification (`infra-verify.yml`)

Triggered on: PR, merge_group, workflow_dispatch.

Lighter-weight test that validates infrastructure creation and Landing Zone provisioning
without running a full deployment:
1. Create infrastructure
2. Provision Landing Zone
3. Install Enclave Lab (connected mode)
4. Collect artifacts
5. Cleanup and verify cleanup

### Workflow: Disconnected Dry-Run (`disconnected-dry-run.yml`)

Triggered on: PR (specific paths), nightly schedule (4:00 UTC), workflow_dispatch.

Validates disconnected/mirror configuration without downloading images:
1. Create infrastructure
2. Provision Landing Zone
3. Install Enclave Lab
4. Phase 1 (prepare binaries)
5. Phase 2 (mirror registry with `--dry-run`)
6. Phase 2.5 (validate mirror artifacts)
7. Cleanup

### Workflow: E2E ODF Schedule (`e2e-odf-schedule.yml`)

Daily at 5:00 UTC -- dispatches `e2e-deployment.yml` with `storage-plugin=odf` and
disconnected mode.

### Workflow: CI Image Build (`ci-image.yml`)

Triggered on: push to main, workflow_dispatch.

Builds, tests (smoke test), and pushes the CI container image.

### Workflow: Build and Push Tarball (`build-push-tarball.yml`)

Triggered on: PR, push to main/0-rc, tags, workflow_dispatch.

Builds the distribution tarball and validates it:
- Size < 1GB
- Required files/directories present
- Excluded paths not present
- File count consistency

Pushes to `quay.io/edge-infrastructure/enclave` via ORAS.

### Workflow: Slash Command (`slash-command.yml`)

Triggered on: PR comments starting with `/test`, `/retest`, or `/cancel`.

Supports:
- `/test validation` -- Re-run PR validation
- `/test tarball` -- Re-run tarball build
- `/test infra` -- Re-run infrastructure verification
- `/test e2e-connected` -- Dispatch E2E connected
- `/test e2e-disconnected` -- Dispatch E2E disconnected
- `/test e2e-disconnected-odf` -- Dispatch E2E disconnected with ODF
- `/test cleanup` -- Run cleanup
- `/test all` -- Run everything
- `/retest` -- Re-run all failed checks
- `/cancel <name>` or `/cancel` -- Cancel running checks

Permission check: requires write access or above.

### Workflow: Cleanup (`cleanup.yml`)

Triggered on: weekly schedule (Sunday 4:00 UTC), workflow_dispatch.

Three cleanup levels:
- `standard` -- Run `make clean`
- `deep` -- Destroy all CI VMs and networks
- `full` -- Deep + stop sushy-tools, remove storage pools, clean dangling interfaces

---

## 6. Test Fixtures, Mocks, and Test Data

### Schema Test Fixtures

Located in `test-fixtures/schemas/`:

**Valid fixtures** (7 files) -- each represents a valid configuration scenario:
- `local-lvms.yaml` -- LocalStorage + LVMS (baseline)
- `local-lvms-with-discovery.yaml` -- LVMS with hardware discovery hosts
- `local-lvms-with-ironic-https.yaml` -- LVMS with Ironic HTTPS configuration
- `local-lvms-with-ssl.yaml` -- LVMS with SSL certificates
- `local-odf.yaml` -- LocalStorage + ODF (requires `odfExternalConfig`)
- `radosgw-lvms-all-optionals.yaml` -- RadosGW + LVMS with all optional fields
- `radosgw-odf.yaml` -- RadosGW + ODF

**Invalid fixtures** (14 files) -- each exercises a specific validation failure:
- `invalid-additional-property.yaml` -- Unknown top-level property
- `invalid-discovery-host-missing-field.yaml` -- Missing required field in discovery host
- `invalid-empty-string.yaml` -- Empty string where `nonEmptyString` is required
- `invalid-enum.yaml` -- Invalid enum value
- `invalid-ip.yaml` -- Malformed IPv4 address
- `invalid-port.yaml` -- Invalid port number
- `invalid-rgw-unknown-key.yaml` -- Unknown key in RGW configuration
- `invalid-storage-path.yaml` -- Invalid storage path format
- `ironic-https-empty-key.yaml` -- Ironic HTTPS cert without key
- `ironic-https-missing-key.yaml` -- Ironic HTTPS cert with missing key
- `odf-without-external-config.yaml` -- ODF without required `odfExternalConfig`
- `radosgw-without-rgw-config.yaml` -- RadosGW without required `quayBackendRGWConfiguration`
- `ssl-empty-key.yaml` -- SSL cert with empty key
- `ssl-missing-key.yaml` -- SSL cert with missing key

### Template Validation Fixture

`test-fixtures/templates/global.yaml`:
- Synthetic configuration using RFC 5737 TEST-NET addresses (192.0.2.0/24).
- Provides all variables needed for template rendering without real infrastructure values.
- Used exclusively for template rendering tests.

### Mocks / Dummy Files Created During Tests

The template validation setup (`playbooks/tasks/template_validation/setup.yaml`) creates:
- A dummy pull secret file (`{"auths":{}}`)
- A dummy SSH public key file
- A dummy CA certificate file (self-signed test cert)
- Overrides `workingDir`, `pullSecretPath`, `sshPubPath`, `quayCAPath` to point to the
  temp directory.

---

## 7. What Is Being Tested

### Configuration Files
- `config/global.yaml` -- Main cluster configuration
- `config/certificates.yaml` -- TLS certificate configuration
- `config/cloud_infra.yaml` -- Cloud infrastructure configuration
- `defaults/*.yaml` -- Default values for deployment, catalogs, operators, etc.
- `plugins/*/plugin.yaml` -- Plugin descriptors

### Jinja2 Templates
- `templates/install-config-connected.yaml.j2`
- `templates/install-config-disconnected.yaml.j2`
- `templates/agent-config.yaml.j2`
- `templates/imagesetconfiguration*.yaml.j2`
- `templates/registries.conf.j2`

### Shell Scripts
- All `scripts/**/*.sh` files (validated with shellcheck)

### YAML Files
- All YAML files in the repo (validated with yamllint)

### Ansible Playbooks
- All playbooks under `playbooks/` (validated with ansible-lint)
- Playbook tag integrity (tag-to-task mapping)

### Makefiles
- `Makefile` and `Makefile.ci` syntax

### Plugin Structure
- Directory layout of each plugin under `plugins/`
- `plugin.yaml` required fields and YAML structure

### Infrastructure
- libvirt networks, VMs, storage pools
- Landing Zone VM provisioning and configuration
- BMC emulation (sushy-tools)
- DNS resolution
- Network connectivity

### OpenShift Cluster
- Node readiness
- Cluster operator health
- Cluster version

### CI Artifacts
- CI container image tool availability
- Distribution tarball integrity

---

## 8. Key Testing Patterns

### Pattern: Schema-Driven Configuration Validation
All configuration files have corresponding JSON Schemas in `schemas/`. Validation uses
`ansible.utils.validate` with the `ansible.utils.jsonschema` engine. Schemas use
`$ref` to a shared `definitions.yaml` for reusable types (ipv4Address, nonEmptyString,
cidr, etc.). Conditional requirements are expressed via `allOf`/`if`/`then` (e.g.,
RadosGW backend requires RGW configuration).

### Pattern: Positive and Negative Fixture Testing
Schema validation runs both valid fixtures (must pass) and invalid fixtures (must fail).
The invalid fixture tests use `ignore_errors: true` followed by an assertion that the
validation indeed failed. This prevents schema regressions where invalid configs would
silently pass.

### Pattern: Template Render-and-Validate
Templates are rendered with fixture data and then parsed back to verify they produce
valid YAML. This catches template syntax errors, missing variables, and structural
issues without requiring a real deployment.

### Pattern: Layered Verification
Infrastructure is verified at multiple layers:
1. Infrastructure level (networks, VMs, BMC)
2. Landing Zone level (SSH, packages, disk, DNS)
3. Installation level (repo, config, collections, services)
4. Cluster level (nodes, operators, version)
5. Cleanup level (no leftover resources)

### Pattern: CI Image as Test Environment
All PR validation runs inside a purpose-built CI container image. This ensures
consistent tool versions across runs and eliminates host environment variability.
The image itself is smoke-tested before push.

### Pattern: Parallel Execution Isolation
E2E tests use unique cluster names and dynamically allocated subnets to allow
parallel execution on the same host without resource conflicts.

### Pattern: Multi-Level Artifact Collection
CI artifact collection has four levels (`basic`, `infra`, `deployment`, `full`),
collecting progressively more diagnostics. On failure, full diagnostics including
OpenShift must-gather are collected.

### Pattern: Slash Command Test Dispatch
PR comments (`/test`, `/retest`, `/cancel`) provide a ChatOps interface for
triggering and managing CI jobs, with permission checks and result reporting.
