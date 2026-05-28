# Full-fidelity round-trip test: write config, read back, verify all fields match
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

echo "  Step 1: Write a complete config with distinctive values in every section"

CONFIG='{
  "global": {
    "workingDir": "/opt/enclave",
    "sshPubKey": "ssh-rsa AAAA fake-e2e-key",
    "baseDomain": "roundtrip.e2e-test.local",
    "clusterName": "rt-mgmt",
    "machineNetwork": "10.99.88.0/24",
    "apiVIP": "10.99.88.100",
    "ingressVIP": "10.99.88.101",
    "rendezvousIP": "10.99.88.10",
    "defaultDNS": "10.99.88.1",
    "defaultGateway": "10.99.88.1",
    "defaultPrefix": 24,
    "lzBmcIP": "10.99.88.77",
    "disconnected": true,
    "quayUser": "rt-admin",
    "quayPassword": "rt-secret-pw",
    "quayBackend": "RadosGWStorage",
    "quayBackendRGWConfiguration": {
      "access_key": "RTACCESSKEY",
      "secret_key": "RTSECRETKEY",
      "bucket_name": "rt-quay-bucket",
      "hostname": "rgw.roundtrip.local"
    },
    "storage_plugin": "lvms",
    "pullSecret": {"auths":{}},
    "agent_hosts": [
      {
        "name": "rt-cp-0",
        "macAddress": "00:60:2f:e0:c1:00",
        "ipAddress": "10.99.88.10",
        "redfish": "10.99.88.200",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "rt-cp-1",
        "macAddress": "00:60:2f:e0:c1:01",
        "ipAddress": "10.99.88.11",
        "redfish": "10.99.88.200",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      },
      {
        "name": "rt-cp-2",
        "macAddress": "00:60:2f:e0:c1:02",
        "ipAddress": "10.99.88.12",
        "redfish": "10.99.88.200",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sda"
      }
    ]
  },
  "certificates": {
    "sslCACertificate": "-----BEGIN CERTIFICATE-----\nRT-TEST-CA\n-----END CERTIFICATE-----",
    "sslAPICertificateFullChain": "-----BEGIN CERTIFICATE-----\nRT-API-CERT\n-----END CERTIFICATE-----",
    "sslAPICertificateKey": "-----BEGIN RSA PRIVATE KEY-----\nRT-API-KEY\n-----END RSA PRIVATE KEY-----",
    "sslIngressCertificateFullChain": "-----BEGIN CERTIFICATE-----\nRT-INGRESS-CERT\n-----END CERTIFICATE-----",
    "sslIngressCertificateKey": "-----BEGIN RSA PRIVATE KEY-----\nRT-INGRESS-KEY\n-----END RSA PRIVATE KEY-----"
  },
  "cloudInfra": {
    "discovery_hosts": [
      {
        "name": "rt-worker-0",
        "macAddress": "aa:bb:cc:00:00:10",
        "ipAddress": "10.99.88.50",
        "redfish": "10.99.88.201",
        "redfishUser": "admin",
        "redfishPassword": "password",
        "rootDisk": "/dev/sdb"
      }
    ]
  }
}'

api_put "/api/v1/config" "${CONFIG}"
echo "    ✓ Config written via API"

echo "  Step 2: Read config back"
RESPONSE=$(api_get "/api/v1/config")

echo "  Step 3: Verify global scalar fields"
assert_field "workingDir"       '.global.workingDir'           "/opt/enclave"               "${RESPONSE}"
assert_field "baseDomain"       '.global.baseDomain'           "roundtrip.e2e-test.local"   "${RESPONSE}"
assert_field "clusterName"      '.global.clusterName'          "rt-mgmt"                    "${RESPONSE}"
assert_field "machineNetwork"   '.global.machineNetwork'       "10.99.88.0/24"              "${RESPONSE}"
assert_field "apiVIP"           '.global.apiVIP'               "10.99.88.100"               "${RESPONSE}"
assert_field "ingressVIP"       '.global.ingressVIP'           "10.99.88.101"               "${RESPONSE}"
assert_field "rendezvousIP"     '.global.rendezvousIP'         "10.99.88.10"                "${RESPONSE}"
assert_field "defaultDNS"       '.global.defaultDNS'           "10.99.88.1"                 "${RESPONSE}"
assert_field "defaultGateway"   '.global.defaultGateway'       "10.99.88.1"                 "${RESPONSE}"
assert_field "defaultPrefix"    '.global.defaultPrefix'        "24"                         "${RESPONSE}"
assert_field "lzBmcIP"          '.global.lzBmcIP'              "10.99.88.77"                "${RESPONSE}"
assert_field "disconnected"     '.global.disconnected'         "true"                       "${RESPONSE}"
assert_field "quayUser"         '.global.quayUser'             "rt-admin"                   "${RESPONSE}"
assert_field "quayPassword"     '.global.quayPassword'         "rt-secret-pw"               "${RESPONSE}"
assert_field "quayBackend"      '.global.quayBackend'          "RadosGWStorage"             "${RESPONSE}"
assert_field "storage_plugin" '.global.storage_plugin' "lvms"                     "${RESPONSE}"

echo "  Step 4: Verify agent_hosts"
assert_field "agent_hosts count"      '.global.agent_hosts | length'   "3"         "${RESPONSE}"
assert_field "agent_hosts[0] name"    '.global.agent_hosts[0].name'    "rt-cp-0"   "${RESPONSE}"
assert_field "agent_hosts[2] name"    '.global.agent_hosts[2].name'    "rt-cp-2"   "${RESPONSE}"

echo "  Step 5: Verify quayBackendRGWConfiguration"
assert_field "RGW access_key"   '.global.quayBackendRGWConfiguration.access_key'   "RTACCESSKEY"          "${RESPONSE}"
assert_field "RGW secret_key"   '.global.quayBackendRGWConfiguration.secret_key'   "RTSECRETKEY"          "${RESPONSE}"
assert_field "RGW bucket_name"  '.global.quayBackendRGWConfiguration.bucket_name'  "rt-quay-bucket"       "${RESPONSE}"
assert_field "RGW hostname"     '.global.quayBackendRGWConfiguration.hostname'     "rgw.roundtrip.local"  "${RESPONSE}"


echo "  Step 7: Verify certificates"
assert_contains "sslCACertificate"            "RT-TEST-CA"  echo "${RESPONSE}"
assert_contains "sslAPICertificateFullChain"  "RT-API-CERT" echo "${RESPONSE}"
assert_contains "sslAPICertificateKey"        "RT-API-KEY"  echo "${RESPONSE}"

echo "  Step 8: Verify cloudInfra.discovery_hosts"
assert_field "discovery_hosts count"    '.cloudInfra.discovery_hosts | length'         "1"            "${RESPONSE}"
assert_field "discovery_hosts[0] name"  '.cloudInfra.discovery_hosts[0].name'          "rt-worker-0"  "${RESPONSE}"
assert_field "discovery_hosts[0] IP"    '.cloudInfra.discovery_hosts[0].ipAddress'     "10.99.88.50"  "${RESPONSE}"

echo "  All checks passed"
