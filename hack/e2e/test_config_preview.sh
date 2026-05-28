# Test config preview and section endpoints for review/download
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: Write a config via the wizard API"

CONFIG='{
  "global": {
    "workingDir": "/opt/enclave",
    "sshPubKey": "ssh-rsa AAAA fake-e2e-key",
    "baseDomain": "preview-test.local",
    "clusterName": "preview-cl",
    "machineNetwork": "192.168.200.0/24",
    "apiVIP": "192.168.200.100",
    "ingressVIP": "192.168.200.101",
    "rendezvousIP": "192.168.200.10",
    "defaultDNS": "192.168.200.1",
    "defaultGateway": "192.168.200.1",
    "defaultPrefix": 24,
    "lzBmcIP": "192.168.200.1",
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
        "ipAddress": "192.168.200.10",
        "redfish": "192.168.200.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/vda"
      },
      {
        "name": "node-02",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "192.168.200.11",
        "redfish": "192.168.200.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/vda"
      },
      {
        "name": "node-03",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "192.168.200.12",
        "redfish": "192.168.200.1",
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

echo "  Step 2: Test config preview endpoint"
PREVIEW=$(api_post "/api/v1/config/preview" "${CONFIG}")
assert_contains "preview returns globalYaml" "globalYaml" echo "${PREVIEW}"
assert_contains "preview returns certificatesYaml" "certificatesYaml" echo "${PREVIEW}"

echo "  Step 3: Test section endpoints"

CLUSTER=$(api_get "/api/v1/config/cluster")
assert_contains "baseDomain in cluster" "preview-test.local" echo "${CLUSTER}"
assert_contains "clusterName in cluster" "preview-cl" echo "${CLUSTER}"

NETWORK=$(api_get "/api/v1/config/network")
assert_contains "defaultDNS in network" "192.168.200.1" echo "${NETWORK}"
assert_contains "defaultGateway in network" "192.168.200.1" echo "${NETWORK}"

STORAGE=$(api_get "/api/v1/config/storage")
assert_contains "lvms in storage" "lvms" echo "${STORAGE}"

PLUGINS=$(api_get "/api/v1/config/plugins")
assert_contains "lvms in plugins" "lvms" echo "${PLUGINS}"

CERTIFICATES=$(api_get "/api/v1/config/certificates")
assert_contains "certificates section returned" "CertificatesConfig" echo "${CERTIFICATES}"

HOSTS=$(api_get "/api/v1/config/hosts")
assert_contains "hosts section returned" "discovery_hosts" echo "${HOSTS}"

echo "  Step 4: Verify full config GET matches what was written"
FULL=$(api_get "/api/v1/config")
assert_contains "full config baseDomain" "preview-test.local" echo "${FULL}"
assert_contains "full config clusterName" "preview-cl" echo "${FULL}"
assert_contains "full config apiVIP" "192.168.200.100" echo "${FULL}"
assert_contains "full config lvms" "lvms" echo "${FULL}"

echo "  All checks passed"
