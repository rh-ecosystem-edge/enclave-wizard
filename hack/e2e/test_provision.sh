# NOTE: This test requires the provisioning API (not yet implemented).
# It documents the expected API contract and will fail until the API is built.
# Provision trigger and status monitoring
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: Write a valid config for provisioning"

CONFIG='{
  "global": {
    "workingDir": "/opt/enclave",
    "sshPubKey": "ssh-rsa AAAA fake-e2e-key",
    "baseDomain": "provision-test.local",
    "clusterName": "prov-cl",
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
    "disconnected": false,
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

echo "  Step 2: Trigger provisioning (POST /api/v1/provision)"

# The provisioning endpoint does not exist yet — expect 404.
assert_http_code "POST /api/v1/provision returns 404 (not yet implemented)" \
    "404" "POST" "/api/v1/provision" "${CONFIG}"

# When API is implemented, uncomment:
# RESULT=$(api_post "/api/v1/provision" "${CONFIG}")
# assert_contains "provision accepted" "provision" echo "${RESULT}"

echo "  Step 3: Check provisioning status (GET /api/v1/provision/status)"

# The status endpoint does not exist yet — expect 404.
assert_http_code "GET /api/v1/provision/status returns 404 (not yet implemented)" \
    "404" "GET" "/api/v1/provision/status"

# When API is implemented, uncomment:
# for i in $(seq 1 30); do
#     STATUS=$(api_get "/api/v1/provision/status")
#     STATE=$(echo "${STATUS}" | jq -r '.state')
#     echo "    Provision state: ${STATE}"
#     if [ "${STATE}" = "completed" ]; then break; fi
#     if [ "${STATE}" = "failed" ]; then
#         echo "    FAIL: provisioning failed"
#         echo "${STATUS}" | jq .
#         exit 1
#     fi
#     sleep 10
# done
# assert_contains "provisioning completed" "completed" echo "${STATUS}"

echo "  All checks passed (provisioning API not yet implemented — 404s expected)"
