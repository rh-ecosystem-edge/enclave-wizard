package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

// newEnclaveDir creates the expected directory layout under a temp dir and
// returns the enclave root. Optionally seeds config files from the provided map
// (filename → YAML content).
func newEnclaveDir(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	configDir := filepath.Join(root, "config")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatalf("mkdir config: %v", err)
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(configDir, name), []byte(content), 0644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	return root
}

//--- Reader.ConfigExists ---

func TestConfigExists_ReturnsTrueWhenFilePresent(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"global.yaml": "baseDomain: test.local\n",
	})
	r := NewReader(root)
	if !r.ConfigExists() {
		t.Error("expected ConfigExists=true when global.yaml is present")
	}
}

func TestConfigExists_ReturnsFalseWhenFileMissing(t *testing.T) {
	root := newEnclaveDir(t, nil)
	r := NewReader(root)
	if r.ConfigExists() {
		t.Error("expected ConfigExists=false when global.yaml is absent")
	}
}

func TestConfigExists_ReturnsFalseForNonexistentDir(t *testing.T) {
	r := NewReader("/nonexistent/path/xyz")
	if r.ConfigExists() {
		t.Error("expected ConfigExists=false for nonexistent enclave dir")
	}
}

// --- Reader.ReadAll happy path ---

func TestReadAll_AllFilesMissing_ReturnsZeroValues(t *testing.T) {
	root := newEnclaveDir(t, nil)
	r := NewReader(root)

	cfg, err := r.ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg == nil {
		t.Fatal("expected non-nil config")
	}
	if cfg.Global.BaseDomain != "" {
		t.Errorf("expected empty BaseDomain, got %q", cfg.Global.BaseDomain)
	}
	if len(cfg.CloudInfra.DiscoveryHosts) != 0 {
		t.Errorf("expected no discovery hosts, got %v", cfg.CloudInfra.DiscoveryHosts)
	}
}

func TestReadAll_ReadsGlobalFields(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"global.yaml": "baseDomain: example.com\nclusterName: mgmt\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg.Global.BaseDomain != "example.com" {
		t.Errorf("BaseDomain: got %q", cfg.Global.BaseDomain)
	}
	if cfg.Global.ClusterName != "mgmt" {
		t.Errorf("ClusterName: got %q", cfg.Global.ClusterName)
	}
}

func TestReadAll_ReadsCertificates(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"certificates.yaml": "sslCACertificate: |\n  -----BEGIN CERTIFICATE-----\n  TEST\n  -----END CERTIFICATE-----\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg.Certificates.SSLCACertificate == nil {
		t.Fatal("expected SSLCACertificate to be set")
	}
}

func TestReadAll_ClearsCertPlaceholders(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"certificates.yaml": `
sslAPICertificateFullChain: |
  -----BEGIN CERTIFICATE-----
  YOUR_API_CERTIFICATE
  -----END CERTIFICATE-----
sslAPICertificateKey: |
  -----BEGIN PRIVATE KEY-----
  YOUR_API_PRIVATE_KEY
  -----END PRIVATE KEY-----
sslCACertificate: |
  -----BEGIN CERTIFICATE-----
  YOUR_ROOT_CA_CERTIFICATE
  -----END CERTIFICATE-----
`,
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg.Certificates.SSLAPICertificateFullChain != nil {
		t.Errorf("SSLAPICertificateFullChain should be nil, got %q", *cfg.Certificates.SSLAPICertificateFullChain)
	}
	if cfg.Certificates.SSLAPICertificateKey != nil {
		t.Errorf("SSLAPICertificateKey should be nil, got %q", *cfg.Certificates.SSLAPICertificateKey)
	}
	if cfg.Certificates.SSLCACertificate != nil {
		t.Errorf("SSLCACertificate should be nil, got %q", *cfg.Certificates.SSLCACertificate)
	}
}

func TestReadAll_PreservesRealCerts(t *testing.T) {
	realCert := "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW...\n-----END CERTIFICATE-----\n"
	root := newEnclaveDir(t, map[string]string{
		"certificates.yaml": "sslCACertificate: |\n  -----BEGIN CERTIFICATE-----\n  MIIBxTCCAW...\n  -----END CERTIFICATE-----\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg.Certificates.SSLCACertificate == nil {
		t.Fatal("expected real cert to be preserved, got nil")
	}
	_ = realCert
}

func TestReadAll_ClearsSimplePlaceholders(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"global.yaml": "baseDomain: YOUR_BASE_DOMAIN\nclusterName: YOUR_CLUSTER_NAME\ndefaultPrefix: 24\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if cfg.Global.BaseDomain != "" {
		t.Errorf("BaseDomain should be empty, got %q", cfg.Global.BaseDomain)
	}
	if cfg.Global.ClusterName != "" {
		t.Errorf("ClusterName should be empty, got %q", cfg.Global.ClusterName)
	}
	if cfg.Global.DefaultPrefix != 24 {
		t.Errorf("DefaultPrefix should be preserved, got %d", cfg.Global.DefaultPrefix)
	}
}

func TestReadAll_ReadsCloudInfraDiscoveryHosts(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"cloud_infra.yaml": "discovery_hosts:\n  - bmcAddress: 192.168.1.10\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(cfg.CloudInfra.DiscoveryHosts) != 1 {
		t.Fatalf("expected 1 discovery host, got %d", len(cfg.CloudInfra.DiscoveryHosts))
	}
}

// --- Reader.ReadAll: discovery_hosts fallback ---

func TestReadAll_FallsBackToGlobalDiscoveryHosts(t *testing.T) {
	// discovery_hosts in global.yaml should be merged when cloud_infra.yaml is empty.
	root := newEnclaveDir(t, map[string]string{
		"global.yaml": "baseDomain: test.local\ndiscovery_hosts:\n  - redfish: 10.0.0.1\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(cfg.CloudInfra.DiscoveryHosts) != 1 {
		t.Fatalf("expected 1 fallback discovery host, got %d", len(cfg.CloudInfra.DiscoveryHosts))
	}
	if cfg.CloudInfra.DiscoveryHosts[0].Redfish != "10.0.0.1" {
		t.Errorf("unexpected host redfish: %v", cfg.CloudInfra.DiscoveryHosts[0])
	}
}

func TestReadAll_CloudInfraTakesPrecedenceOverGlobal(t *testing.T) {
	// When cloud_infra.yaml already has hosts, global.yaml hosts must be ignored.
	root := newEnclaveDir(t, map[string]string{
		"global.yaml":      "discovery_hosts:\n  - redfish: 10.0.0.1\n",
		"cloud_infra.yaml": "discovery_hosts:\n  - redfish: 10.0.0.2\n",
	})
	cfg, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if len(cfg.CloudInfra.DiscoveryHosts) != 1 {
		t.Fatalf("expected 1 host, got %d", len(cfg.CloudInfra.DiscoveryHosts))
	}
	if cfg.CloudInfra.DiscoveryHosts[0].Redfish != "10.0.0.2" {
		t.Errorf("expected cloud_infra host to win, got %v", cfg.CloudInfra.DiscoveryHosts[0])
	}
}

// --- Reader.ReadAll: malformed YAML ---

func TestReadAll_MalformedGlobalYAML_ReturnsError(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"global.yaml": ":\tinvalid: yaml: [\n",
	})
	_, err := NewReader(root).ReadAll()
	if err == nil {
		t.Fatal("expected error for malformed global.yaml, got nil")
	}
}

func TestReadAll_MalformedCertificatesYAML_ReturnsError(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"certificates.yaml": ":\tinvalid: yaml: [\n",
	})
	_, err := NewReader(root).ReadAll()
	if err == nil {
		t.Fatal("expected error for malformed certificates.yaml, got nil")
	}
}

func TestReadAll_MalformedCloudInfraYAML_ReturnsError(t *testing.T) {
	root := newEnclaveDir(t, map[string]string{
		"cloud_infra.yaml": ":\tinvalid: yaml: [\n",
	})
	_, err := NewReader(root).ReadAll()
	if err == nil {
		t.Fatal("expected error for malformed cloud_infra.yaml, got nil")
	}
}

// --- Writer.WriteAll ---

func TestWriteAll_CreatesConfigDir(t *testing.T) {
	root := t.TempDir() // no config/ subdir yet
	w := NewWriter(root)

	if err := w.WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "config")); err != nil {
		t.Errorf("config dir not created: %v", err)
	}
}

func TestWriteAll_WritesAllThreeFiles(t *testing.T) {
	root := t.TempDir()
	if err := NewWriter(root).WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}
	for _, name := range []string{"global.yaml", "certificates.yaml", "cloud_infra.yaml"} {
		if _, err := os.Stat(filepath.Join(root, "config", name)); err != nil {
			t.Errorf("expected %s to exist: %v", name, err)
		}
	}
}

func TestWriteAll_OutputIsValidYAML(t *testing.T) {
	root := t.TempDir()
	cfg := &models.EnclaveConfig{}
	cfg.Global.BaseDomain = "write.test"
	cfg.Global.ClusterName = "cluster1"

	if err := NewWriter(root).WriteAll(cfg); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	for _, name := range []string{"global.yaml", "certificates.yaml", "cloud_infra.yaml"} {
		data, err := os.ReadFile(filepath.Join(root, "config", name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		var m map[string]any
		if err := yaml.Unmarshal(data, &m); err != nil {
			t.Errorf("%s is not valid YAML: %v", name, err)
		}
	}
}

// --- Round-trip: WriteAll → ReadAll ---

func TestWriteAllThenReadAll_GlobalRoundTrips(t *testing.T) {
	root := t.TempDir()

	want := &models.EnclaveConfig{}
	want.Global.BaseDomain = "roundtrip.test"
	want.Global.ClusterName = "mgmt"
	want.Global.APIVIP = "192.168.1.100"

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Global.BaseDomain != want.Global.BaseDomain {
		t.Errorf("BaseDomain: want %q, got %q", want.Global.BaseDomain, got.Global.BaseDomain)
	}
	if got.Global.ClusterName != want.Global.ClusterName {
		t.Errorf("ClusterName: want %q, got %q", want.Global.ClusterName, got.Global.ClusterName)
	}
	if got.Global.APIVIP != want.Global.APIVIP {
		t.Errorf("APIVIP: want %q, got %q", want.Global.APIVIP, got.Global.APIVIP)
	}
}

func TestWriteAllThenReadAll_CertificatesRoundTrip(t *testing.T) {
	root := t.TempDir()
	cert := "-----BEGIN CERTIFICATE-----\nABCD\n-----END CERTIFICATE-----\n"

	want := &models.EnclaveConfig{}
	want.Certificates.SSLCACertificate = &cert

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Certificates.SSLCACertificate == nil {
		t.Fatal("SSLCACertificate is nil after round-trip")
	}
}

func TestWriteAllThenReadAll_DiscoveryHostsRoundTrip(t *testing.T) {
	root := t.TempDir()

	want := &models.EnclaveConfig{}
	want.CloudInfra.DiscoveryHosts = []models.HostEntry{
		{Redfish: "192.168.2.10"},
		{Redfish: "192.168.2.11"},
	}

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if len(got.CloudInfra.DiscoveryHosts) != 2 {
		t.Fatalf("expected 2 discovery hosts, got %d", len(got.CloudInfra.DiscoveryHosts))
	}
	if got.CloudInfra.DiscoveryHosts[0].Redfish != "192.168.2.10" {
		t.Errorf("host[0]: got %v", got.CloudInfra.DiscoveryHosts[0])
	}
}

func TestWriteAllThenReadAll_OsacPluginRoundTrips(t *testing.T) {
	root := t.TempDir()
	profile := "caas"
	license := "/opt/enclave/config/plugins/manifest.zip"

	want := &models.EnclaveConfig{}
	want.Global.OsacProfile = &profile
	want.Global.OsacAapLicenseFile = &license

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	// osac.yaml should exist on disk
	if _, err := os.Stat(filepath.Join(root, "config", "plugins", "osac.yaml")); err != nil {
		t.Fatalf("osac.yaml not created: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Global.OsacProfile == nil || *got.Global.OsacProfile != profile {
		t.Errorf("OsacProfile: want %q, got %v", profile, got.Global.OsacProfile)
	}
	if got.Global.OsacAapLicenseFile == nil || *got.Global.OsacAapLicenseFile != license {
		t.Errorf("OsacAapLicenseFile: want %q, got %v", license, got.Global.OsacAapLicenseFile)
	}
}

func TestWriteAllThenReadAll_OsacDnsFieldsRoundTrip(t *testing.T) {
	root := t.TempDir()
	dnsClass := "dns.route53.dns"
	dnsZone := "example.com"

	want := &models.EnclaveConfig{}
	want.Global.OsacDnsClass = &dnsClass
	want.Global.OsacDnsZone = &dnsZone

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Global.OsacDnsClass == nil || *got.Global.OsacDnsClass != dnsClass {
		t.Errorf("OsacDnsClass: want %q, got %v", dnsClass, got.Global.OsacDnsClass)
	}
	if got.Global.OsacDnsZone == nil || *got.Global.OsacDnsZone != dnsZone {
		t.Errorf("OsacDnsZone: want %q, got %v", dnsZone, got.Global.OsacDnsZone)
	}

	data, _ := os.ReadFile(filepath.Join(root, "config", "global.yaml"))
	var global map[string]any
	yaml.Unmarshal(data, &global)
	if _, ok := global["osacDnsClass"]; ok {
		t.Error("osacDnsClass should NOT be in global.yaml (should be in plugins/osac.yaml)")
	}
	if _, ok := global["osacDnsZone"]; ok {
		t.Error("osacDnsZone should NOT be in global.yaml (should be in plugins/osac.yaml)")
	}
}

func TestWriteAllThenReadAll_RhbkPluginRoundTrips(t *testing.T) {
	root := t.TempDir()
	instances := 3
	deploy := true
	size := "10Gi"

	want := &models.EnclaveConfig{}
	want.Global.RhbkInstances = &instances
	want.Global.RhbkDeployDatabase = &deploy
	want.Global.RhbkDbSize = &size

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	if _, err := os.Stat(filepath.Join(root, "config", "plugins", "rhbk.yaml")); err != nil {
		t.Fatalf("rhbk.yaml not created: %v", err)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Global.RhbkInstances == nil || *got.Global.RhbkInstances != instances {
		t.Errorf("RhbkInstances: want %d, got %v", instances, got.Global.RhbkInstances)
	}
	if got.Global.RhbkDeployDatabase == nil || *got.Global.RhbkDeployDatabase != deploy {
		t.Errorf("RhbkDeployDatabase: want %v, got %v", deploy, got.Global.RhbkDeployDatabase)
	}
	if got.Global.RhbkDbSize == nil || *got.Global.RhbkDbSize != size {
		t.Errorf("RhbkDbSize: want %q, got %v", size, got.Global.RhbkDbSize)
	}
}

func TestWriteAll_OsacFieldsNotInGlobalYaml(t *testing.T) {
	root := t.TempDir()
	profile := "development"

	cfg := &models.EnclaveConfig{}
	cfg.Global.BaseDomain = "test.local"
	cfg.Global.OsacProfile = &profile

	if err := NewWriter(root).WriteAll(cfg); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	data, _ := os.ReadFile(filepath.Join(root, "config", "global.yaml"))
	var global map[string]any
	yaml.Unmarshal(data, &global)

	if _, ok := global["osacProfile"]; ok {
		t.Error("osacProfile should NOT be in global.yaml (should be in plugins/osac.yaml)")
	}
}

func TestWriteAll_NoPluginFiles_WhenFieldsEmpty(t *testing.T) {
	root := t.TempDir()

	if err := NewWriter(root).WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	if _, err := os.Stat(filepath.Join(root, "config", "plugins", "osac.yaml")); !os.IsNotExist(err) {
		t.Error("osac.yaml should not exist when no OSAC fields are set")
	}
	if _, err := os.Stat(filepath.Join(root, "config", "plugins", "rhbk.yaml")); !os.IsNotExist(err) {
		t.Error("rhbk.yaml should not exist when no RHBK fields are set")
	}
}

func TestWriteAll_RemovesPluginFilesWhenFieldsCleared(t *testing.T) {
	root := t.TempDir()
	pluginsDir := filepath.Join(root, "config", "plugins")
	os.MkdirAll(pluginsDir, 0755)
	os.WriteFile(filepath.Join(pluginsDir, "osac.yaml"), []byte("osacProfile: caas\n"), 0644)

	// Write config WITHOUT osac fields — should remove osac.yaml
	if err := NewWriter(root).WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	if _, err := os.Stat(filepath.Join(pluginsDir, "osac.yaml")); !os.IsNotExist(err) {
		t.Error("osac.yaml should be removed when no OSAC fields are set")
	}
}

func TestWriteAllThenReadAll_EnabledPluginsRoundTrips(t *testing.T) {
	root := t.TempDir()

	want := &models.EnclaveConfig{}
	want.Global.EnabledPlugins = []string{"lvms", "trust-manager", "rhbk", "authorino", "aap", "osac"}

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	// Verify the YAML file explicitly contains enabled_plugins
	data, _ := os.ReadFile(filepath.Join(root, "config", "global.yaml"))
	var raw map[string]any
	yaml.Unmarshal(data, &raw)
	if _, ok := raw["enabled_plugins"]; !ok {
		t.Fatal("enabled_plugins key missing from global.yaml")
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if len(got.Global.EnabledPlugins) != 6 {
		t.Fatalf("expected 6 enabled plugins, got %d: %v", len(got.Global.EnabledPlugins), got.Global.EnabledPlugins)
	}
	if got.Global.EnabledPlugins[0] != "lvms" {
		t.Errorf("first plugin: want lvms, got %q", got.Global.EnabledPlugins[0])
	}
	if got.Global.EnabledPlugins[5] != "osac" {
		t.Errorf("last plugin: want osac, got %q", got.Global.EnabledPlugins[5])
	}
}

func TestWriteAllThenReadAll_EmptyEnabledPluginsPreserved(t *testing.T) {
	root := t.TempDir()

	want := &models.EnclaveConfig{}
	want.Global.EnabledPlugins = []string{}

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	// The key must still exist in YAML even when empty
	data, _ := os.ReadFile(filepath.Join(root, "config", "global.yaml"))
	var raw map[string]any
	yaml.Unmarshal(data, &raw)
	if _, ok := raw["enabled_plugins"]; !ok {
		t.Fatal("enabled_plugins key missing from global.yaml even for empty slice")
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}

	if got.Global.EnabledPlugins == nil {
		t.Fatal("enabled_plugins should be empty slice, not nil")
	}
	if len(got.Global.EnabledPlugins) != 0 {
		t.Errorf("expected 0 plugins, got %d", len(got.Global.EnabledPlugins))
	}
}

func TestWriteAllThenReadAll_NilEnabledPluginsWritesEmptyList(t *testing.T) {
	root := t.TempDir()

	want := &models.EnclaveConfig{}
	// EnabledPlugins is nil (zero value)

	if err := NewWriter(root).WriteAll(want); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	// Even with nil input, the key must appear in YAML
	data, _ := os.ReadFile(filepath.Join(root, "config", "global.yaml"))
	var raw map[string]any
	yaml.Unmarshal(data, &raw)
	if _, ok := raw["enabled_plugins"]; !ok {
		t.Fatal("enabled_plugins key must always be present in global.yaml")
	}
}

func TestWriteAll_PEMWithoutTrailingNewline_DoesNotGlueCertAndKey(t *testing.T) {
	root := t.TempDir()

	fullchain := "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW\n-----END CERTIFICATE-----"
	key := "-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD\n-----END PRIVATE KEY-----"

	cfg := &models.EnclaveConfig{}
	cfg.Certificates.SSLIngressCertificateFullChain = &fullchain
	cfg.Certificates.SSLIngressCertificateKey = &key

	if err := NewWriter(root).WriteAll(cfg); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(root, "config", "certificates.yaml"))
	if err != nil {
		t.Fatalf("read certificates.yaml: %v", err)
	}
	content := string(data)

	if strings.Contains(content, "sslIngressCertificateFullChain: |-") {
		t.Errorf("expected literal block with trailing newline (|), got strip chomping (|-):\n%s", content)
	}

	got, err := NewReader(root).ReadAll()
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if got.Certificates.SSLIngressCertificateFullChain == nil || got.Certificates.SSLIngressCertificateKey == nil {
		t.Fatal("expected ingress cert and key to round-trip")
	}
	joined := *got.Certificates.SSLIngressCertificateFullChain + *got.Certificates.SSLIngressCertificateKey
	if strings.Contains(joined, "-----END CERTIFICATE----------BEGIN") {
		t.Fatalf("joined PEM glued cert and key: %q", joined)
	}
}

func TestWriteAll_FilePermsAre0640(t *testing.T) {
	root := t.TempDir()
	if err := NewWriter(root).WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}
	for _, name := range []string{"global.yaml", "certificates.yaml", "cloud_infra.yaml"} {
		info, err := os.Stat(filepath.Join(root, "config", name))
		if err != nil {
			t.Fatalf("stat %s: %v", name, err)
		}
		if perm := info.Mode().Perm(); perm != 0640 {
			t.Errorf("%s: expected 0640, got %o", name, perm)
		}
	}
}
