# Verify config files written to disk are valid YAML and match API state
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: Verify wizard services are running"
assert_http_status "API health" "401" "https://localhost:3443/api/v1/defaults"
assert_http_status "UI health" "200" "https://localhost:3443/"

echo "  Step 2: Write a config with distinctive values"

CONFIG='{
  "global": {
    "workingDir": "/opt/enclave",
    "sshPubKey": "ssh-rsa AAAA fake-e2e-key",
    "baseDomain": "download-test.example.com",
    "clusterName": "dl-cluster",
    "machineNetwork": "10.77.88.0/24",
    "apiVIP": "10.77.88.200",
    "ingressVIP": "10.77.88.201",
    "rendezvousIP": "10.77.88.10",
    "defaultDNS": "10.77.88.1",
    "defaultGateway": "10.77.88.1",
    "defaultPrefix": 24,
    "lzBmcIP": "10.77.88.1",
    "quayUser": "dl-admin",
    "quayPassword": "dl-secret",
    "quayBackend": "LocalStorage",
    "storage_plugin": "lvms",
    "disconnected": true,
    "enabled_plugins": ["lvms", "nvidia-gpu"],
    "pullSecret": {"auths":{}},
    "agent_hosts": [
      {
        "name": "dl-node-01",
        "macAddress": "00:60:2f:e0:c1:00",
        "ipAddress": "10.77.88.10",
        "redfish": "10.77.88.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "dl-node-02",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "10.77.88.11",
        "redfish": "10.77.88.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "dl-node-03",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "10.77.88.12",
        "redfish": "10.77.88.1",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      }
    ]
  },
  "certificates": {
    "sslCACertificate": "-----BEGIN CERTIFICATE-----\nDL-TEST-CA\n-----END CERTIFICATE-----"
  },
  "cloudInfra": {
    "discovery_hosts": []
  }
}'

api_put "/api/v1/config" "${CONFIG}"
echo "    ✓ Config written via API"

echo "  Step 3: Verify YAML files exist and are valid YAML"
assert_ok "global.yaml exists" vm_exec "sudo test -f /opt/enclave/config/global.yaml"
assert_ok "certificates.yaml exists" vm_exec "sudo test -f /opt/enclave/config/certificates.yaml"
assert_ok "cloud_infra.yaml exists" vm_exec "sudo test -f /opt/enclave/config/cloud_infra.yaml"

assert_ok "global.yaml is valid YAML" \
    vm_exec "sudo python3 -c 'import yaml; yaml.safe_load(open(\"/opt/enclave/config/global.yaml\"))'"
assert_ok "certificates.yaml is valid YAML" \
    vm_exec "sudo python3 -c 'import yaml; yaml.safe_load(open(\"/opt/enclave/config/certificates.yaml\"))'"
assert_ok "cloud_infra.yaml is valid YAML" \
    vm_exec "sudo python3 -c 'import yaml; yaml.safe_load(open(\"/opt/enclave/config/cloud_infra.yaml\"))'"

echo "  Step 4: Verify global.yaml content matches written config"
assert_contains "baseDomain in YAML" "download-test.example.com" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "clusterName in YAML" "dl-cluster" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "apiVIP in YAML" "10.77.88.200" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "quayUser in YAML" "dl-admin" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "nvidia-gpu in YAML" "nvidia-gpu" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"
assert_contains "dl-node-03 in YAML" "dl-node-03" \
    vm_exec "sudo cat /opt/enclave/config/global.yaml"

echo "  Step 5: Verify certificates.yaml has PEM content"
assert_contains "CA cert in YAML" "DL-TEST-CA" \
    vm_exec "sudo cat /opt/enclave/config/certificates.yaml"

echo "  Step 6: Verify YAML on disk matches API round-trip"
RESPONSE=$(api_get "/api/v1/config")
assert_field "API baseDomain matches" ".global.baseDomain" "download-test.example.com" "${RESPONSE}"
assert_field "API clusterName matches" ".global.clusterName" "dl-cluster" "${RESPONSE}"

YAML_DOMAIN=$(vm_exec "sudo python3 -c \"import yaml; c=yaml.safe_load(open('/opt/enclave/config/global.yaml')); print(c.get('baseDomain',''))\"")
if [ "${YAML_DOMAIN}" = "download-test.example.com" ]; then
    echo "    ✓ YAML file baseDomain matches API response"
else
    echo "    ✗ YAML file baseDomain mismatch (got '${YAML_DOMAIN}')"
    exit 1
fi

echo "  Step 7: Validate against enclave schema"
validate_enclave_schema

echo "  All checks passed"
