package config

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

type Reader struct {
	enclaveDir string
}

func NewReader(enclaveDir string) *Reader {
	return &Reader{enclaveDir: enclaveDir}
}

func (r *Reader) ConfigExists() bool {
	_, err := os.Stat(filepath.Join(r.enclaveDir, "config", "global.yaml"))
	return err == nil
}

// globalWithDiscoveryHosts captures discovery_hosts that may appear in global.yaml
// so we can merge them into CloudInfraConfig.
type globalWithDiscoveryHosts struct {
	models.GlobalConfig `yaml:",inline"`
	DiscoveryHosts      []models.HostEntry `yaml:"discovery_hosts,omitempty"`
}

func (r *Reader) ReadAll() (*models.EnclaveConfig, error) {
	globalRaw, err := r.readGlobalRaw()
	if err != nil {
		return nil, fmt.Errorf("reading global.yaml: %w", err)
	}
	certs, err := r.readCertificates()
	if err != nil {
		return nil, fmt.Errorf("reading certificates.yaml: %w", err)
	}
	infra, err := r.readCloudInfra()
	if err != nil {
		return nil, fmt.Errorf("reading cloud_infra.yaml: %w", err)
	}

	// cloud_infra.yaml is the canonical location; fall back to global.yaml
	if len(infra.DiscoveryHosts) == 0 && len(globalRaw.DiscoveryHosts) > 0 {
		infra.DiscoveryHosts = globalRaw.DiscoveryHosts
	}

	cfg := &models.EnclaveConfig{
		Global:       globalRaw.GlobalConfig,
		Certificates: *certs,
		CloudInfra:   *infra,
	}
	clearTemplatePlaceholders(cfg)

	r.mergePluginConfigs(cfg)

	return cfg, nil
}

func (r *Reader) mergePluginConfigs(cfg *models.EnclaveConfig) {
	pluginsDir := filepath.Join(r.enclaveDir, "config", "plugins")

	osac, _ := readYAMLFile[osacPluginConfig](filepath.Join(pluginsDir, "osac.yaml"))
	if osac != nil {
		if osac.OsacProfile != "" {
			cfg.Global.OsacProfile = &osac.OsacProfile
		}
		if osac.OsacAapLicenseFile != "" {
			cfg.Global.OsacAapLicenseFile = &osac.OsacAapLicenseFile
		}
		if osac.OsacBYODatabase {
			cfg.Global.OsacBYODatabase = &osac.OsacBYODatabase
		}
		if osac.OsacDatabaseUrl != "" {
			cfg.Global.OsacDatabaseUrl = &osac.OsacDatabaseUrl
		}
		if osac.OsacDnsClass != "" {
			cfg.Global.OsacDnsClass = &osac.OsacDnsClass
		}
		if osac.OsacDnsZone != "" {
			cfg.Global.OsacDnsZone = &osac.OsacDnsZone
		}
		if len(osac.ClusterFulfillmentConfig) > 0 {
			cfg.Global.ClusterFulfillmentConfig = osac.ClusterFulfillmentConfig
		}
	}

	rhbk, _ := readYAMLFile[rhbkPluginConfig](filepath.Join(pluginsDir, "rhbk.yaml"))
	if rhbk != nil {
		if rhbk.RhbkInstances > 0 {
			cfg.Global.RhbkInstances = &rhbk.RhbkInstances
		}
		if rhbk.RhbkDeployDatabase != nil {
			cfg.Global.RhbkDeployDatabase = rhbk.RhbkDeployDatabase
		}
		if rhbk.RhbkDbSize != "" {
			cfg.Global.RhbkDbSize = &rhbk.RhbkDbSize
		}
	}
}

type osacPluginConfig struct {
	OsacProfile              string            `yaml:"osacProfile,omitempty"`
	OsacAapLicenseFile       string            `yaml:"osacAapLicenseFile,omitempty"`
	OsacBYODatabase          bool              `yaml:"osacBYODatabase,omitempty"`
	OsacDatabaseUrl          string            `yaml:"osacDatabaseUrl,omitempty"`
	OsacDnsClass             string            `yaml:"osacDnsClass,omitempty"`
	OsacDnsZone              string            `yaml:"osacDnsZone,omitempty"`
	ClusterFulfillmentConfig map[string]string `yaml:"clusterFulfillmentConfig,omitempty"`
}

type rhbkPluginConfig struct {
	RhbkInstances      int    `yaml:"rhbk_instances,omitempty"`
	RhbkDeployDatabase *bool  `yaml:"rhbk_deploy_database,omitempty"`
	RhbkDbSize         string `yaml:"rhbk_db_size,omitempty"`
}

func (r *Reader) readGlobalRaw() (*globalWithDiscoveryHosts, error) {
	return readYAMLFile[globalWithDiscoveryHosts](filepath.Join(r.enclaveDir, "config", "global.yaml"))
}

func (r *Reader) readCertificates() (*models.CertificatesConfig, error) {
	return readYAMLFile[models.CertificatesConfig](filepath.Join(r.enclaveDir, "config", "certificates.yaml"))
}

func (r *Reader) readCloudInfra() (*models.CloudInfraConfig, error) {
	return readYAMLFile[models.CloudInfraConfig](filepath.Join(r.enclaveDir, "config", "cloud_infra.yaml"))
}

func clearTemplatePlaceholders(cfg *models.EnclaveConfig) {
	clearStringFields(&cfg.Global)
	clearStringFields(&cfg.Certificates)
	for i := range cfg.Global.AgentHosts {
		clearStringFields(&cfg.Global.AgentHosts[i])
	}
	for i := range cfg.CloudInfra.DiscoveryHosts {
		clearStringFields(&cfg.CloudInfra.DiscoveryHosts[i])
	}
}

func clearStringFields(ptr any) {
	v := reflect.ValueOf(ptr).Elem()
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		switch f.Kind() {
		case reflect.String:
			if f.CanSet() && strings.Contains(f.String(), "YOUR_") {
				f.SetString("")
			}
		case reflect.Pointer:
			if !f.IsNil() && f.Type().Elem().Kind() == reflect.String {
				if strings.Contains(f.Elem().String(), "YOUR_") {
					f.Set(reflect.Zero(f.Type()))
				}
			}
		case reflect.Struct:
			if f.CanAddr() {
				clearStringFields(f.Addr().Interface())
			}
		}
	}
}

func readYAMLFile[T any](path string) (*T, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			var zero T
			return &zero, nil
		}
		return nil, err
	}
	var result T
	if err := yaml.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", filepath.Base(path), err)
	}
	return &result, nil
}
