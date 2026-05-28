# Write deployment config via wizard API and validate against enclave schemas
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
    "baseDomain": "e2e-test.example.com",
    "clusterName": "mgmt",
    "machineNetwork": "192.168.223.0/24",
    "apiVIP": "192.168.223.200",
    "ingressVIP": "192.168.223.201",
    "rendezvousIP": "192.168.223.10",
    "defaultDNS": "192.168.223.1",
    "defaultGateway": "192.168.223.1",
    "defaultPrefix": 24,
    "lzBmcIP": "192.168.223.1",
    "quayUser": "admin",
    "quayPassword": "testpassword",
    "quayBackend": "LocalStorage",
    "storage_plugin": "lvms",
    "disconnected": true,
    "enabled_plugins": ["lvms"],
    "pullSecret": {"auths":{}},
    "agent_hosts": [
      {
        "name": "node-01",
        "macAddress": "00:60:2f:e0:c1:00",
        "ipAddress": "192.168.223.10",
        "redfish": "192.168.223.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/vda"
      },
      {
        "name": "node-02",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "192.168.223.11",
        "redfish": "192.168.223.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/vda"
      },
      {
        "name": "node-03",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "192.168.223.12",
        "redfish": "192.168.223.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/vda"
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
assert_contains "baseDomain is set" "e2e-test.example.com" api_get "/api/v1/config"
assert_contains "clusterName is set" "mgmt" api_get "/api/v1/config"
assert_contains "3 agent hosts" "node-03" api_get "/api/v1/config"

echo "  Step 4: Verify config files exist on disk"
assert_ok "global.yaml exists" vm_exec "sudo test -f /opt/enclave/config/global.yaml"
assert_ok "certificates.yaml exists" vm_exec "sudo test -f /opt/enclave/config/certificates.yaml"
assert_ok "cloud_infra.yaml exists" vm_exec "sudo test -f /opt/enclave/config/cloud_infra.yaml"

echo "  Step 5: Verify config content in YAML files"
assert_contains "global.yaml has baseDomain" "e2e-test.example.com" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has clusterName" "mgmt" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "global.yaml has 3 nodes" "node-03" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"

echo "  Step 6: Validate config against API schema"
VALIDATION=$(api_post "/api/v1/config/validate" "${CONFIG}")
assert_contains "API validation passes" "true" echo "${VALIDATION}"

echo "  Step 7: Validate against enclave schema"
validate_enclave_schema

echo "  All checks passed"
