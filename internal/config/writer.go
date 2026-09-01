package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/pem"
	"gopkg.in/yaml.v3"
)

type Writer struct {
	enclaveDir string
}

func NewWriter(enclaveDir string) *Writer {
	return &Writer{enclaveDir: enclaveDir}
}

// WriteAll serializes the config to disk. It never mutates cfg.
func (w *Writer) WriteAll(cfg *models.EnclaveConfig) error {
	configDir := filepath.Join(w.enclaveDir, "config")
	if err := os.MkdirAll(configDir, 0750); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	// Copy plugin fields, then strip from global so they only appear in plugin files
	pc := cfg.Global.PluginsConfig
	osacCfg := buildOsacConfig(&pc)
	rhbkCfg := buildRhbkConfig(&pc)

	globalCopy := cfg.Global
	globalCopy.PluginsConfig = models.PluginsConfig{
		EnabledPlugins: cfg.Global.EnabledPlugins,
	}

	if err := writeYAMLFile(filepath.Join(configDir, "global.yaml"), &globalCopy); err != nil {
		return fmt.Errorf("writing global.yaml: %w", err)
	}

	certs := cfg.Certificates
	normalizeCertPEMFields(&certs)
	nilEmptyCertFields(&certs)
	if err := writeYAMLFile(filepath.Join(configDir, "certificates.yaml"), &certs); err != nil {
		return fmt.Errorf("writing certificates.yaml: %w", err)
	}

	if err := writeYAMLFile(filepath.Join(configDir, "cloud_infra.yaml"), &cfg.CloudInfra); err != nil {
		return fmt.Errorf("writing cloud_infra.yaml: %w", err)
	}

	pluginsDir := filepath.Join(configDir, "plugins")
	if osacCfg != nil || rhbkCfg != nil {
		if err := os.MkdirAll(pluginsDir, 0750); err != nil {
			return fmt.Errorf("creating plugins config directory: %w", err)
		}
	}
	if osacCfg != nil {
		if err := writeYAMLFile(filepath.Join(pluginsDir, "osac.yaml"), osacCfg); err != nil {
			return fmt.Errorf("writing osac.yaml: %w", err)
		}
	} else {
		removeIfExists(filepath.Join(pluginsDir, "osac.yaml"))
	}
	if rhbkCfg != nil {
		if err := writeYAMLFile(filepath.Join(pluginsDir, "rhbk.yaml"), rhbkCfg); err != nil {
			return fmt.Errorf("writing rhbk.yaml: %w", err)
		}
	} else {
		removeIfExists(filepath.Join(pluginsDir, "rhbk.yaml"))
	}

	return nil
}

func removeIfExists(path string) {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		fmt.Printf("WARNING: failed to remove %s: %v\n", filepath.Base(path), err)
	}
}

// buildOsacConfig reads OSAC fields without mutating the source.
func buildOsacConfig(pc *models.PluginsConfig) *osacPluginConfig {
	if pc.OsacProfile == nil && pc.OsacAapLicenseFile == nil && pc.OsacDnsClass == nil && pc.OsacDnsZone == nil && len(pc.ClusterFulfillmentConfig) == 0 {
		return nil
	}
	cfg := &osacPluginConfig{}
	if pc.OsacProfile != nil {
		cfg.OsacProfile = *pc.OsacProfile
	}
	if pc.OsacAapLicenseFile != nil {
		cfg.OsacAapLicenseFile = *pc.OsacAapLicenseFile
	}
	if pc.OsacBYODatabase != nil {
		cfg.OsacBYODatabase = *pc.OsacBYODatabase
	}
	if pc.OsacDatabaseUrl != nil {
		cfg.OsacDatabaseUrl = *pc.OsacDatabaseUrl
	}
	if pc.OsacDnsClass != nil {
		cfg.OsacDnsClass = *pc.OsacDnsClass
	}
	if pc.OsacDnsZone != nil {
		cfg.OsacDnsZone = *pc.OsacDnsZone
	}
	if len(pc.ClusterFulfillmentConfig) > 0 {
		cfg.ClusterFulfillmentConfig = pc.ClusterFulfillmentConfig
	}
	return cfg
}

// buildRhbkConfig reads RHBK fields without mutating the source.
func buildRhbkConfig(pc *models.PluginsConfig) *rhbkPluginConfig {
	if pc.RhbkInstances == nil && pc.RhbkDeployDatabase == nil && pc.RhbkDbSize == nil {
		return nil
	}
	cfg := &rhbkPluginConfig{}
	if pc.RhbkInstances != nil {
		cfg.RhbkInstances = *pc.RhbkInstances
	}
	if pc.RhbkDeployDatabase != nil {
		cfg.RhbkDeployDatabase = pc.RhbkDeployDatabase
	}
	if pc.RhbkDbSize != nil {
		cfg.RhbkDbSize = *pc.RhbkDbSize
	}
	return cfg
}

func nilIfEmpty(s **string) {
	if *s != nil && **s == "" {
		*s = nil
	}
}

func nilEmptyCertFields(c *models.CertificatesConfig) {
	nilIfEmpty(&c.SSLAPICertificateFullChain)
	nilIfEmpty(&c.SSLAPICertificateKey)
	nilIfEmpty(&c.SSLIngressCertificateFullChain)
	nilIfEmpty(&c.SSLIngressCertificateKey)
	nilIfEmpty(&c.SSLCACertificate)
	nilIfEmpty(&c.IronicHTTPSCertificate)
	nilIfEmpty(&c.IronicHTTPSKey)
}

func normalizeCertPEMFields(c *models.CertificatesConfig) {
	normalizePEMField(&c.SSLAPICertificateFullChain)
	normalizePEMField(&c.SSLAPICertificateKey)
	normalizePEMField(&c.SSLIngressCertificateFullChain)
	normalizePEMField(&c.SSLIngressCertificateKey)
	normalizePEMField(&c.SSLCACertificate)
	normalizePEMField(&c.IronicHTTPSCertificate)
	normalizePEMField(&c.IronicHTTPSKey)
}

func normalizePEMField(p **string) {
	if p == nil || *p == nil || **p == "" {
		return
	}
	normalized := pem.EnsureTrailingNewline(**p)
	*p = &normalized
}

func writeYAMLFile[T any](path string, data *T) error {
	out, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshaling %s: %w", filepath.Base(path), err)
	}
	return os.WriteFile(path, out, 0640)
}
