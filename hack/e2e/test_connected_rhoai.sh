# Connected deployment with LVMS + RHOAI (OpenShift AI) plugin configuration
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
    "baseDomain": "rhoai.lab.example.com",
    "clusterName": "ai-edge",
    "machineNetwork": "192.168.100.0/24",
    "apiVIP": "192.168.100.200",
    "ingressVIP": "192.168.100.201",
    "rendezvousIP": "192.168.100.10",
    "defaultDNS": "192.168.100.1",
    "defaultGateway": "192.168.100.1",
    "defaultPrefix": 24,
    "lzBmcIP": "192.168.100.1",
    "quayUser": "unused",
    "quayPassword": "unused",
    "quayBackend": "LocalStorage",
    "storage_plugin": "lvms",
    "disconnected": false,
    "enabled_plugins": ["lvms", "nvidia-gpu", "openshift-ai"],
    "pullSecret": {"auths":{}},
    "agent_hosts": [
      {
        "name": "ai-node-01",
        "macAddress": "00:60:2f:e0:c1:00",
        "ipAddress": "192.168.100.10",
        "redfish": "192.168.100.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "ai-node-02",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "192.168.100.11",
        "redfish": "192.168.100.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "ai-node-03",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "192.168.100.12",
        "redfish": "192.168.100.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
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
assert_contains "baseDomain is set" "rhoai.lab.example.com" api_get "/api/v1/config"
assert_contains "clusterName is set" "ai-edge" api_get "/api/v1/config"
assert_contains "disconnected is false" "false" api_get "/api/v1/config"
assert_contains "openshift-ai plugin enabled" "openshift-ai" api_get "/api/v1/config"
assert_contains "nvidia-gpu plugin enabled" "nvidia-gpu" api_get "/api/v1/config"
assert_contains "lvms storage backend" "lvms" api_get "/api/v1/config"
assert_contains "3 agent hosts" "ai-node-03" api_get "/api/v1/config"

echo "  Step 4: Verify config files exist on disk"
assert_ok "global.yaml exists" vm_exec "sudo test -f /opt/enclave/config/global.yaml"
assert_ok "certificates.yaml exists" vm_exec "sudo test -f /opt/enclave/config/certificates.yaml"
assert_ok "cloud_infra.yaml exists" vm_exec "sudo test -f /opt/enclave/config/cloud_infra.yaml"

echo "  Step 5: Verify config content in YAML files"
assert_contains "global.yaml has baseDomain" "rhoai.lab.example.com" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has openshift-ai" "openshift-ai" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has nvidia-gpu" "nvidia-gpu" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has disconnected false" "false" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has disconnected false" "false" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"

echo "  Step 6: Validate config against API schema"
VALIDATION=$(api_post "/api/v1/config/validate" "${CONFIG}")
assert_contains "API validation passes" "true" echo "${VALIDATION}"

echo "  Step 7: Validate against enclave schema"
validate_enclave_schema

echo "  All checks passed"
