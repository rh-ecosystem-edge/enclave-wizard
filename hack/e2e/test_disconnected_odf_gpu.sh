# Disconnected deployment with ODF storage and GPU plugins
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: Verify wizard services are running"
assert_http_status "API health" "401" "https://localhost:3443/api/v1/defaults"
assert_http_status "UI health" "200" "https://localhost:3443/"

echo "  Step 2: Write a complete config via the wizard API"

CONFIG='{
  "global": {
    "workingDir": "/opt/enclave",
    "sshPubKey": "ssh-rsa AAAA fake-e2e-key",
    "baseDomain": "odf-gpu.enclave.io",
    "clusterName": "gpu-mgmt",
    "machineNetwork": "172.20.0.0/24",
    "apiVIP": "172.20.0.200",
    "ingressVIP": "172.20.0.201",
    "rendezvousIP": "172.20.0.10",
    "defaultDNS": "172.20.0.1",
    "defaultGateway": "172.20.0.1",
    "defaultPrefix": 24,
    "lzBmcIP": "172.20.0.1",
    "quayUser": "registry-admin",
    "quayPassword": "odf-gpu-secret",
    "quayBackend": "LocalStorage",
    "storage_plugin": "odf",
    "odfExternalConfig": "{\"clusterID\":\"e2e-ceph-cluster-id\",\"monitors\":[\"172.20.0.50:6789\"]}",
    "disconnected": true,
    "enabled_plugins": ["lvms", "odf", "nvidia-gpu"],
    "pullSecret": {"auths":{}},
    "agent_hosts": [
      {
        "name": "gpu-node-01",
        "macAddress": "00:60:2f:e0:c1:00",
        "ipAddress": "172.20.0.10",
        "redfish": "172.20.0.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/nvme0n1"
      },
      {
        "name": "gpu-node-02",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "172.20.0.11",
        "redfish": "172.20.0.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/nvme0n1"
      },
      {
        "name": "gpu-node-03",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "172.20.0.12",
        "redfish": "172.20.0.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/nvme0n1"
      }
    ]
  },
  "certificates": {},
  "cloudInfra": {
    "discovery_hosts": []
  }
}'

api_put "/api/v1/config" "${CONFIG}"
echo "    ✓ Config written via API"

echo "  Step 3: Read config back and verify key fields"
assert_contains "baseDomain is set" "odf-gpu.enclave.io" api_get "/api/v1/config"
assert_contains "clusterName is set" "gpu-mgmt" api_get "/api/v1/config"
assert_contains "disconnected is true" "true" api_get "/api/v1/config"
assert_contains "odf storage backend" "odf" api_get "/api/v1/config"
assert_contains "odfExternalConfig has cluster ID" "e2e-ceph-cluster-id" api_get "/api/v1/config"
assert_contains "nvidia-gpu plugin enabled" "nvidia-gpu" api_get "/api/v1/config"
assert_contains "quayUser is set" "registry-admin" api_get "/api/v1/config"
assert_contains "3 agent hosts" "gpu-node-03" api_get "/api/v1/config"

echo "  Step 4: Verify config files exist on disk"
assert_ok "global.yaml exists" vm_exec "sudo test -f /opt/enclave/config/global.yaml"
assert_ok "certificates.yaml exists" vm_exec "sudo test -f /opt/enclave/config/certificates.yaml"
assert_ok "cloud_infra.yaml exists" vm_exec "sudo test -f /opt/enclave/config/cloud_infra.yaml"

echo "  Step 5: Verify config content in YAML files"
assert_contains "global.yaml has baseDomain" "odf-gpu.enclave.io" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has odf storage" "odf" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has odfExternalConfig" "e2e-ceph-cluster-id" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has nvidia-gpu plugin" "nvidia-gpu" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has quayUser" "registry-admin" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"

echo "  Step 6: Validate config against API schema"
VALIDATION=$(api_post "/api/v1/config/validate" "${CONFIG}")
assert_contains "API validation passes" "true" echo "${VALIDATION}"

echo "  Step 7: Validate against enclave schema"
validate_enclave_schema

echo "  All checks passed"
