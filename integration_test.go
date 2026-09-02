package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/auth"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/pem"
	"gopkg.in/yaml.v3"
)

func setupTestServer(t *testing.T) (*httptest.Server, string) {
	t.Helper()
	enclaveDir := t.TempDir()
	authStore := auth.NewStore(filepath.Join(t.TempDir(), "password"))
	if _, err := authStore.Init(); err != nil {
		t.Fatalf("auth store init: %v", err)
	}
	mux := http.NewServeMux()
	if _, _, err := SetupAPI(mux, enclaveDir, authStore, &Options{}); err != nil {
		t.Fatalf("SetupAPI: %v", err)
	}
	return httptest.NewServer(mux), enclaveDir
}

func testConfig() models.EnclaveConfig {
	disc := true
	return models.EnclaveConfig{
		Global: models.GlobalConfig{
			LandingZoneConfig: models.LandingZoneConfig{
				WorkingDir:   "/home/enclave",
				LZBMCIP:      "192.168.2.50",
				Disconnected: &disc,
			},
			ClusterConfig: models.ClusterConfig{
				BaseDomain:     "enclave-test.nodns.in",
				ClusterName:    "mgmt",
				MachineNetwork: "192.168.2.0/24",
				APIVIP:         "192.168.2.10",
				IngressVIP:     "192.168.2.11",
				RendezvousIP:   "192.168.2.100",
				PullSecret:     map[string]any{"auths": map[string]any{}},
				SSHPubKey:     "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ test@enclave",
				AgentHosts: []models.HostEntry{
					{
						Name:            "cp-0",
						MACAddress:      "aa:bb:cc:dd:ee:01",
						IPAddress:       "192.168.2.100",
						Redfish:         "192.168.2.200",
						RedfishUser:     "admin",
						RedfishPassword: "redfish-pass",
						RootDisk:        "/dev/disk/by-path/pci-0000:00:11.4-ata-1.0",
					},
					{
						Name:            "cp-1",
						MACAddress:      "aa:bb:cc:dd:ee:02",
						IPAddress:       "192.168.2.101",
						Redfish:         "192.168.2.201",
						RedfishUser:     "admin",
						RedfishPassword: "redfish-pass",
						RootDisk:        "/dev/disk/by-path/pci-0000:00:11.4-ata-1.0",
					},
					{
						Name:            "cp-2",
						MACAddress:      "aa:bb:cc:dd:ee:03",
						IPAddress:       "192.168.2.102",
						Redfish:         "192.168.2.202",
						RedfishUser:     "admin",
						RedfishPassword: "redfish-pass",
						RootDisk:        "/dev/disk/by-path/pci-0000:00:11.4-ata-1.0",
					},
				},
			},
			NetworkConfig: models.NetworkConfig{
				DefaultDNS:     "192.168.2.1",
				DefaultGateway: "192.168.2.1",
				DefaultPrefix:  24,
			},
			QuayConfig: models.QuayConfig{
				QuayUser:     "admin",
				QuayPassword: "secret",
				QuayBackend:  "LocalStorage",
			},
			StorageConfig: models.StorageConfig{
				StoragePlugin: "lvms",
			},
		},
		Certificates: models.CertificatesConfig{
			SSLCACertificate: strPtr("-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----"),
		},
		CloudInfra: models.CloudInfraConfig{
			DiscoveryHosts: []models.HostEntry{
				{
					Name:            "worker-0",
					MACAddress:      "aa:bb:cc:dd:ee:10",
					IPAddress:       "192.168.2.110",
					Redfish:         "192.168.2.210",
					RedfishUser:     "admin",
					RedfishPassword: "redfish-pass",
					RootDisk:        "/dev/disk/by-path/pci-0000:00:11.4-ata-1.0",
				},
			},
		},
	}
}

func TestWriteConfig(t *testing.T) {
	srv, enclaveDir := setupTestServer(t)
	defer srv.Close()

	cfg := testConfig()
	body, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshaling request body: %v", err)
	}

	// PUT the config
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT /api/v1/config: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	// Verify global.yaml
	t.Run("global.yaml", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join(enclaveDir, "config", "global.yaml"))
		if err != nil {
			t.Fatalf("reading global.yaml: %v", err)
		}
		var got models.GlobalConfig
		if err := yaml.Unmarshal(data, &got); err != nil {
			t.Fatalf("parsing global.yaml: %v", err)
		}

		assertEqual(t, "clusterName", cfg.Global.ClusterName, got.ClusterName)
		assertEqual(t, "baseDomain", cfg.Global.BaseDomain, got.BaseDomain)
		assertEqual(t, "machineNetwork", cfg.Global.MachineNetwork, got.MachineNetwork)
		assertEqual(t, "apiVIP", cfg.Global.APIVIP, got.APIVIP)
		assertEqual(t, "ingressVIP", cfg.Global.IngressVIP, got.IngressVIP)
		assertEqual(t, "rendezvousIP", cfg.Global.RendezvousIP, got.RendezvousIP)
		assertEqual(t, "defaultDNS", cfg.Global.DefaultDNS, got.DefaultDNS)
		assertEqual(t, "defaultGateway", cfg.Global.DefaultGateway, got.DefaultGateway)
		assertEqual(t, "defaultPrefix", cfg.Global.DefaultPrefix, got.DefaultPrefix)
		assertEqual(t, "quayBackend", cfg.Global.QuayBackend, got.QuayBackend)
		assertEqual(t, "storage_plugin", cfg.Global.StoragePlugin, got.StoragePlugin)
		assertEqual(t, "sshPubKey", cfg.Global.SSHPubKey, got.SSHPubKey)
		assertEqual(t, "agent_hosts count", len(cfg.Global.AgentHosts), len(got.AgentHosts))

		for i, want := range cfg.Global.AgentHosts {
			assertEqual(t, "agent_hosts[%d].name", want.Name, got.AgentHosts[i].Name)
			assertEqual(t, "agent_hosts[%d].ipAddress", want.IPAddress, got.AgentHosts[i].IPAddress)
			assertEqual(t, "agent_hosts[%d].macAddress", want.MACAddress, got.AgentHosts[i].MACAddress)
		}
	})

	// Verify certificates.yaml
	t.Run("certificates.yaml", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join(enclaveDir, "config", "certificates.yaml"))
		if err != nil {
			t.Fatalf("reading certificates.yaml: %v", err)
		}
		var got models.CertificatesConfig
		if err := yaml.Unmarshal(data, &got); err != nil {
			t.Fatalf("parsing certificates.yaml: %v", err)
		}

		if got.SSLCACertificate == nil {
			t.Fatal("sslCACertificate is nil")
		}
		assertPEMEqual(t, "sslCACertificate", *cfg.Certificates.SSLCACertificate, *got.SSLCACertificate)
	})

	// Verify cloud_infra.yaml
	t.Run("cloud_infra.yaml", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join(enclaveDir, "config", "cloud_infra.yaml"))
		if err != nil {
			t.Fatalf("reading cloud_infra.yaml: %v", err)
		}
		var got models.CloudInfraConfig
		if err := yaml.Unmarshal(data, &got); err != nil {
			t.Fatalf("parsing cloud_infra.yaml: %v", err)
		}

		assertEqual(t, "discovery_hosts count", len(cfg.CloudInfra.DiscoveryHosts), len(got.DiscoveryHosts))
		assertEqual(t, "discovery_hosts[0].name", cfg.CloudInfra.DiscoveryHosts[0].Name, got.DiscoveryHosts[0].Name)
		assertEqual(t, "discovery_hosts[0].ipAddress", cfg.CloudInfra.DiscoveryHosts[0].IPAddress, got.DiscoveryHosts[0].IPAddress)
	})
}

func TestWriteConfigRoundTrip(t *testing.T) {
	srv, _ := setupTestServer(t)
	defer srv.Close()

	cfg := testConfig()
	body, _ := json.Marshal(cfg)

	// Write
	putReq, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config", bytes.NewReader(body))
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatalf("PUT: %v", err)
	}
	putResp.Body.Close()

	// Read back
	getResp, err := http.Get(srv.URL + "/api/v1/config")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer getResp.Body.Close()

	var got models.EnclaveConfig
	if err := json.NewDecoder(getResp.Body).Decode(&got); err != nil {
		t.Fatalf("decoding GET response: %v", err)
	}

	assertEqual(t, "clusterName", cfg.Global.ClusterName, got.Global.ClusterName)
	assertEqual(t, "baseDomain", cfg.Global.BaseDomain, got.Global.BaseDomain)
	assertEqual(t, "apiVIP", cfg.Global.APIVIP, got.Global.APIVIP)
	assertEqual(t, "ingressVIP", cfg.Global.IngressVIP, got.Global.IngressVIP)
	assertEqual(t, "agent_hosts count", len(cfg.Global.AgentHosts), len(got.Global.AgentHosts))
	assertEqual(t, "discovery_hosts count", len(cfg.CloudInfra.DiscoveryHosts), len(got.CloudInfra.DiscoveryHosts))

	if got.Certificates.SSLCACertificate == nil {
		t.Fatal("round-trip: sslCACertificate is nil")
	}
	assertPEMEqual(t, "sslCACertificate", *cfg.Certificates.SSLCACertificate, *got.Certificates.SSLCACertificate)
}

func TestGetConfigSection(t *testing.T) {
	srv, _ := setupTestServer(t)
	defer srv.Close()

	cfg := testConfig()
	body, _ := json.Marshal(cfg)

	putReq, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config", bytes.NewReader(body))
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatalf("PUT: %v", err)
	}
	putResp.Body.Close()

	t.Run("lz", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/lz")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.LandingZoneConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "workingDir", cfg.Global.WorkingDir, got.WorkingDir)
		assertEqual(t, "lzBmcIP", cfg.Global.LZBMCIP, got.LZBMCIP)
	})

	t.Run("cluster", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/cluster")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.ClusterConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "clusterName", cfg.Global.ClusterName, got.ClusterName)
		assertEqual(t, "baseDomain", cfg.Global.BaseDomain, got.BaseDomain)
		assertEqual(t, "agent_hosts count", len(cfg.Global.AgentHosts), len(got.AgentHosts))
	})

	t.Run("network", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/network")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.NetworkConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "defaultDNS", cfg.Global.DefaultDNS, got.DefaultDNS)
		assertEqual(t, "defaultGateway", cfg.Global.DefaultGateway, got.DefaultGateway)
		assertEqual(t, "defaultPrefix", cfg.Global.DefaultPrefix, got.DefaultPrefix)
	})

	t.Run("quay", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/quay")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.QuayConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "quayUser", cfg.Global.QuayUser, got.QuayUser)
		assertEqual(t, "quayBackend", cfg.Global.QuayBackend, got.QuayBackend)
	})

	t.Run("storage", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/storage")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.StorageConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "storage_plugin", cfg.Global.StoragePlugin, got.StoragePlugin)
	})

	t.Run("certificates", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/certificates")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.CertificatesConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.SSLCACertificate == nil {
			t.Fatal("sslCACertificate is nil")
		}
		assertPEMEqual(t, "sslCACertificate", *cfg.Certificates.SSLCACertificate, *got.SSLCACertificate)
	})

	t.Run("hosts", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/v1/config/hosts")
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
		defer resp.Body.Close()
		var got models.CloudInfraConfig
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		assertEqual(t, "discovery_hosts count", len(cfg.CloudInfra.DiscoveryHosts), len(got.DiscoveryHosts))
		assertEqual(t, "discovery_hosts[0].name", cfg.CloudInfra.DiscoveryHosts[0].Name, got.DiscoveryHosts[0].Name)
	})
}

func TestWriteConfigSection(t *testing.T) {
	srv, enclaveDir := setupTestServer(t)
	defer srv.Close()

	cfg := testConfig()
	body, _ := json.Marshal(cfg)

	putReq, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config", bytes.NewReader(body))
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatalf("PUT full config: %v", err)
	}
	putResp.Body.Close()

	t.Run("update network leaves cluster untouched", func(t *testing.T) {
		updated := models.NetworkConfig{
			DefaultDNS:     "10.0.0.1",
			DefaultGateway: "10.0.0.254",
			DefaultPrefix:  16,
		}
		secBody, _ := json.Marshal(updated)
		req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config/network", bytes.NewReader(secBody))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("PUT /config/network: %v", err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusNoContent {
			t.Fatalf("expected 204, got %d", resp.StatusCode)
		}

		data, _ := os.ReadFile(filepath.Join(enclaveDir, "config", "global.yaml"))
		var got models.GlobalConfig
		if err := yaml.Unmarshal(data, &got); err != nil {
			t.Fatalf("parsing global.yaml: %v", err)
		}
		assertEqual(t, "defaultDNS", "10.0.0.1", got.DefaultDNS)
		assertEqual(t, "defaultGateway", "10.0.0.254", got.DefaultGateway)
		assertEqual(t, "defaultPrefix", 16, got.DefaultPrefix)
		assertEqual(t, "clusterName unchanged", cfg.Global.ClusterName, got.ClusterName)
		assertEqual(t, "baseDomain unchanged", cfg.Global.BaseDomain, got.BaseDomain)
		assertEqual(t, "quayUser unchanged", cfg.Global.QuayUser, got.QuayUser)
	})

	t.Run("update certificates leaves global untouched", func(t *testing.T) {
		updated := models.CertificatesConfig{
			SSLCACertificate: strPtr("-----BEGIN CERTIFICATE-----\nNEW\n-----END CERTIFICATE-----"),
		}
		secBody, _ := json.Marshal(updated)
		req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config/certificates", bytes.NewReader(secBody))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("PUT /config/certificates: %v", err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusNoContent {
			t.Fatalf("expected 204, got %d", resp.StatusCode)
		}

		data, _ := os.ReadFile(filepath.Join(enclaveDir, "config", "certificates.yaml"))
		var gotCerts models.CertificatesConfig
		if err := yaml.Unmarshal(data, &gotCerts); err != nil {
			t.Fatalf("parsing certificates.yaml: %v", err)
		}
		if gotCerts.SSLCACertificate == nil {
			t.Fatal("sslCACertificate is nil after update")
		}
		assertPEMEqual(t, "sslCACertificate", "-----BEGIN CERTIFICATE-----\nNEW\n-----END CERTIFICATE-----", *gotCerts.SSLCACertificate)

		data, _ = os.ReadFile(filepath.Join(enclaveDir, "config", "global.yaml"))
		var gotGlobal models.GlobalConfig
		if err := yaml.Unmarshal(data, &gotGlobal); err != nil {
			t.Fatalf("parsing global.yaml: %v", err)
		}
		assertEqual(t, "clusterName unchanged", cfg.Global.ClusterName, gotGlobal.ClusterName)
	})
}

func TestWriteConfigSectionRoundTrip(t *testing.T) {
	srv, _ := setupTestServer(t)
	defer srv.Close()

	want := models.StorageConfig{
		StoragePlugin: "odf",
		ODFExternalConfig:   strPtr(`{"key":"value"}`),
	}
	body, _ := json.Marshal(want)
	putReq, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/config/storage", bytes.NewReader(body))
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatalf("PUT: %v", err)
	}
	putResp.Body.Close()
	if putResp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", putResp.StatusCode)
	}

	getResp, err := http.Get(srv.URL + "/api/v1/config/storage")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer getResp.Body.Close()

	var got models.StorageConfig
	if err := json.NewDecoder(getResp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	assertEqual(t, "storage_plugin", want.StoragePlugin, got.StoragePlugin)
	if got.ODFExternalConfig == nil {
		t.Fatal("odfExternalConfig is nil after round-trip")
	}
	assertEqual(t, "odfExternalConfig", *want.ODFExternalConfig, *got.ODFExternalConfig)
}

func assertPEMEqual(t *testing.T, field, want, got string) {
	t.Helper()
	assertEqual(t, field, pem.EnsureTrailingNewline(want), got)
}

func assertEqual[T comparable](t *testing.T, field string, want, got T) {
	t.Helper()
	if want != got {
		t.Errorf("%s: want %v, got %v", field, want, got)
	}
}

func strPtr(s string) *string { return &s }
