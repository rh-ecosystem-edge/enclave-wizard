package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

func setupConfigAPI(t *testing.T) (*httptest.Server, string) {
	t.Helper()
	enclaveDir := t.TempDir()

	reader := config.NewReader(enclaveDir)
	writer := config.NewWriter(enclaveDir)

	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	NewConfigHandler(reader, writer, nil).Register(api)

	return httptest.NewServer(mux), enclaveDir
}

func validConfig() models.EnclaveConfig {
	disconnected := false
	return models.EnclaveConfig{
		Global: models.GlobalConfig{
			LandingZoneConfig: models.LandingZoneConfig{
				LZBMCIP:      "10.0.0.1",
				WorkingDir:   "/home/enclave",
				Disconnected: &disconnected,
			},
			ClusterConfig: models.ClusterConfig{
				BaseDomain:     "example.com",
				ClusterName:    "mgmt",
				MachineNetwork: "192.168.1.0/24",
				APIVIP:         "192.168.1.100",
				IngressVIP:     "192.168.1.101",
				RendezvousIP:   "192.168.1.10",
				SSHPubKey:      "ssh-rsa AAAA...",
				AgentHosts: []models.HostEntry{
					{Name: "node1", MACAddress: "aa:bb:cc:dd:ee:01", IPAddress: "192.168.1.10", Redfish: "10.0.0.11", RedfishUser: "admin", RedfishPassword: "pass", RootDisk: "/dev/sda"},
					{Name: "node2", MACAddress: "aa:bb:cc:dd:ee:02", IPAddress: "192.168.1.11", Redfish: "10.0.0.12", RedfishUser: "admin", RedfishPassword: "pass", RootDisk: "/dev/sda"},
					{Name: "node3", MACAddress: "aa:bb:cc:dd:ee:03", IPAddress: "192.168.1.12", Redfish: "10.0.0.13", RedfishUser: "admin", RedfishPassword: "pass", RootDisk: "/dev/sda"},
				},
			},
			NetworkConfig: models.NetworkConfig{
				DefaultDNS:     "8.8.8.8",
				DefaultGateway: "192.168.1.1",
				DefaultPrefix:  24,
			},
			StorageConfig: models.StorageConfig{
				StoragePlugin: "lvms",
			},
			QuayConfig: models.QuayConfig{
				QuayUser:     "admin",
				QuayPassword: "password",
				QuayBackend:  "LocalStorage",
			},
			PluginsConfig: models.PluginsConfig{
				EnabledPlugins: []string{"lvms", "trust-manager", "rhbk"},
			},
		},
	}
}

func putConfig(t *testing.T, srv *httptest.Server, cfg models.EnclaveConfig) {
	t.Helper()
	body, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("PUT /api/v1/config returned %d: %s", resp.StatusCode, string(b))
	}
}

func readYAMLOnDisk(t *testing.T, path string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", filepath.Base(path), err)
	}
	var m map[string]any
	if err := yaml.Unmarshal(data, &m); err != nil {
		t.Fatalf("unmarshal %s: %v", filepath.Base(path), err)
	}
	return m
}

func TestConfigRoundTrip_GlobalFields(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	putConfig(t, srv, validConfig())

	global := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "global.yaml"))

	assertEqual(t, "lzBmcIP", "10.0.0.1", global["lzBmcIP"])
	assertEqual(t, "baseDomain", "example.com", global["baseDomain"])
	assertEqual(t, "clusterName", "mgmt", global["clusterName"])
	assertEqual(t, "apiVIP", "192.168.1.100", global["apiVIP"])
	assertEqual(t, "ingressVIP", "192.168.1.101", global["ingressVIP"])
	assertEqual(t, "defaultDNS", "8.8.8.8", global["defaultDNS"])
	assertEqual(t, "defaultGateway", "192.168.1.1", global["defaultGateway"])
	assertEqual(t, "defaultPrefix", 24, global["defaultPrefix"])
	assertEqual(t, "storage_plugin", "lvms", global["storage_plugin"])
	assertEqual(t, "workingDir", "/home/enclave", global["workingDir"])

	hosts, ok := global["agent_hosts"].([]any)
	if !ok {
		t.Fatalf("agent_hosts: expected array, got %T", global["agent_hosts"])
	}
	assertEqual(t, "agent_hosts count", 3, len(hosts))

	plugins, ok := global["enabled_plugins"].([]any)
	if !ok {
		t.Fatalf("enabled_plugins: expected array, got %T", global["enabled_plugins"])
	}
	assertEqual(t, "enabled_plugins count", 3, len(plugins))
}

func TestConfigRoundTrip_Certificates(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	caCert := "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW...\n-----END CERTIFICATE-----\n"
	apiCert := "-----BEGIN CERTIFICATE-----\nAPIcert...\n-----END CERTIFICATE-----\n"
	apiKey := "-----BEGIN PRIVATE KEY-----\nAPIkey...\n-----END PRIVATE KEY-----\n"

	cfg := validConfig()
	cfg.Certificates.SSLCACertificate = &caCert
	cfg.Certificates.SSLAPICertificateFullChain = &apiCert
	cfg.Certificates.SSLAPICertificateKey = &apiKey

	putConfig(t, srv, cfg)

	certs := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "certificates.yaml"))

	if certs["sslCACertificate"] == nil {
		t.Error("sslCACertificate should be present")
	}
	if certs["sslAPICertificateFullChain"] == nil {
		t.Error("sslAPICertificateFullChain should be present")
	}
	if certs["sslAPICertificateKey"] == nil {
		t.Error("sslAPICertificateKey should be present")
	}
}

func TestConfigRoundTrip_CloudInfra(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	cfg := validConfig()
	cfg.CloudInfra.DiscoveryHosts = []models.HostEntry{
		{Name: "worker1", Redfish: "10.0.0.20", RedfishUser: "admin", RedfishPassword: "pass", RootDisk: "/dev/sda", MACAddress: "aa:bb:cc:00:00:04", IPAddress: "192.168.1.20"},
		{Name: "worker2", Redfish: "10.0.0.21", RedfishUser: "admin", RedfishPassword: "pass", RootDisk: "/dev/sda", MACAddress: "aa:bb:cc:00:00:05", IPAddress: "192.168.1.21"},
	}

	putConfig(t, srv, cfg)

	infra := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "cloud_infra.yaml"))

	hosts, ok := infra["discovery_hosts"].([]any)
	if !ok {
		t.Fatalf("discovery_hosts: expected array, got %T", infra["discovery_hosts"])
	}
	assertEqual(t, "discovery_hosts count", 2, len(hosts))
}

func TestConfigRoundTrip_OsacPlugin(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	profile := "caas"
	license := "/opt/enclave/config/plugins/manifest.zip"
	cfg := validConfig()
	cfg.Global.OsacProfile = &profile
	cfg.Global.OsacAapLicenseFile = &license

	putConfig(t, srv, cfg)

	osacPath := filepath.Join(enclaveDir, "config", "plugins", "osac.yaml")
	if _, err := os.Stat(osacPath); err != nil {
		t.Fatalf("osac.yaml not created: %v", err)
	}

	osac := readYAMLOnDisk(t, osacPath)
	assertEqual(t, "osacProfile", "caas", osac["osacProfile"])
	if osac["osacAapLicenseFile"] != license {
		t.Errorf("osacAapLicenseFile: want %q, got %v", license, osac["osacAapLicenseFile"])
	}

	global := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "global.yaml"))
	if _, ok := global["osacProfile"]; ok {
		t.Error("osacProfile should NOT leak into global.yaml")
	}
}

func TestConfigRoundTrip_OsacDnsFields(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	dnsClass := "dns.route53.dns"
	dnsZone := "example.com"
	cfg := validConfig()
	cfg.Global.OsacDnsClass = &dnsClass
	cfg.Global.OsacDnsZone = &dnsZone

	putConfig(t, srv, cfg)

	osac := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "plugins", "osac.yaml"))
	if osac["osacDnsClass"] != dnsClass {
		t.Errorf("osacDnsClass: want %q, got %v", dnsClass, osac["osacDnsClass"])
	}
	if osac["osacDnsZone"] != dnsZone {
		t.Errorf("osacDnsZone: want %q, got %v", dnsZone, osac["osacDnsZone"])
	}

	global := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "global.yaml"))
	if _, ok := global["osacDnsClass"]; ok {
		t.Error("osacDnsClass should NOT leak into global.yaml")
	}
	if _, ok := global["osacDnsZone"]; ok {
		t.Error("osacDnsZone should NOT leak into global.yaml")
	}
}

func TestConfigRoundTrip_RhbkPlugin(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	instances := 3
	deploy := true
	size := "10Gi"
	cfg := validConfig()
	cfg.Global.RhbkInstances = &instances
	cfg.Global.RhbkDeployDatabase = &deploy
	cfg.Global.RhbkDbSize = &size

	putConfig(t, srv, cfg)

	rhbkPath := filepath.Join(enclaveDir, "config", "plugins", "rhbk.yaml")
	if _, err := os.Stat(rhbkPath); err != nil {
		t.Fatalf("rhbk.yaml not created: %v", err)
	}

	rhbk := readYAMLOnDisk(t, rhbkPath)
	assertEqual(t, "rhbk_instances", 3, rhbk["rhbk_instances"])
	assertEqual(t, "rhbk_deploy_database", true, rhbk["rhbk_deploy_database"])
	assertEqual(t, "rhbk_db_size", "10Gi", rhbk["rhbk_db_size"])
}

func TestConfigRoundTrip_NoPluginFilesWhenEmpty(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	putConfig(t, srv, validConfig())

	for _, name := range []string{"osac.yaml", "rhbk.yaml"} {
		path := filepath.Join(enclaveDir, "config", "plugins", name)
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Errorf("%s should not exist when no plugin fields are set", name)
		}
	}
}

func TestConfigRoundTrip_WriteAndReadBack(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	profile := "development"
	instances := 2
	deployDb := true

	cfg := validConfig()
	cfg.Global.BaseDomain = "roundtrip.test"
	cfg.Global.OsacProfile = &profile
	cfg.Global.RhbkInstances = &instances
	cfg.Global.RhbkDeployDatabase = &deployDb
	cfg.Global.EnabledPlugins = []string{"lvms", "trust-manager", "rhbk", "osac"}

	putConfig(t, srv, cfg)

	reader := config.NewReader(enclaveDir)
	got, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	assertEqual(t, "baseDomain", "roundtrip.test", got.Global.BaseDomain)
	assertEqual(t, "clusterName", "mgmt", got.Global.ClusterName)
	assertEqual(t, "apiVIP", "192.168.1.100", got.Global.APIVIP)
	assertEqual(t, "defaultDNS", "8.8.8.8", got.Global.DefaultDNS)
	assertEqual(t, "defaultPrefix", 24, got.Global.DefaultPrefix)
	assertEqual(t, "storage_plugin", "lvms", got.Global.StoragePlugin)
	assertEqual(t, "agent_hosts count", 3, len(got.Global.AgentHosts))

	if got.Global.OsacProfile == nil || *got.Global.OsacProfile != "development" {
		t.Errorf("OsacProfile: want development, got %v", got.Global.OsacProfile)
	}
	if got.Global.RhbkInstances == nil || *got.Global.RhbkInstances != 2 {
		t.Errorf("RhbkInstances: want 2, got %v", got.Global.RhbkInstances)
	}
}

func TestConfigRoundTrip_YAMLUsesSnakeCaseKeys(t *testing.T) {
	srv, enclaveDir := setupConfigAPI(t)
	defer srv.Close()

	putConfig(t, srv, validConfig())

	global := readYAMLOnDisk(t, filepath.Join(enclaveDir, "config", "global.yaml"))

	if _, ok := global["storage_plugin"]; !ok {
		t.Error("expected snake_case 'storage_plugin' in YAML")
	}
	if _, ok := global["storagePlugin"]; ok {
		t.Error("unexpected camelCase 'storagePlugin' in YAML — should be snake_case")
	}
	if _, ok := global["enabled_plugins"]; !ok {
		t.Error("expected snake_case 'enabled_plugins' in YAML")
	}
	if _, ok := global["agent_hosts"]; !ok {
		t.Error("expected snake_case 'agent_hosts' in YAML")
	}
}
