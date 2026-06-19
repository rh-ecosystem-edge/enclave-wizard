package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

type Writer struct {
	enclaveDir string
}

func NewWriter(enclaveDir string) *Writer {
	return &Writer{enclaveDir: enclaveDir}
}

func (w *Writer) WriteAll(cfg *models.EnclaveConfig) error {
	configDir := filepath.Join(w.enclaveDir, "config")
	if err := os.MkdirAll(configDir, 0750); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	osacConfig := extractOsacConfig(&cfg.Global.PluginsConfig)
	rhbkConfig := extractRhbkConfig(&cfg.Global.PluginsConfig)

	if err := writeYAMLFile(filepath.Join(configDir, "global.yaml"), &cfg.Global); err != nil {
		return fmt.Errorf("writing global.yaml: %w", err)
	}
	if err := writeYAMLFile(filepath.Join(configDir, "certificates.yaml"), &cfg.Certificates); err != nil {
		return fmt.Errorf("writing certificates.yaml: %w", err)
	}
	if err := writeYAMLFile(filepath.Join(configDir, "cloud_infra.yaml"), &cfg.CloudInfra); err != nil {
		return fmt.Errorf("writing cloud_infra.yaml: %w", err)
	}

	pluginsDir := filepath.Join(configDir, "plugins")
	if osacConfig != nil || rhbkConfig != nil {
		if err := os.MkdirAll(pluginsDir, 0750); err != nil {
			return fmt.Errorf("creating plugins config directory: %w", err)
		}
	}
	if osacConfig != nil {
		if err := writeYAMLFile(filepath.Join(pluginsDir, "osac.yaml"), osacConfig); err != nil {
			return fmt.Errorf("writing osac.yaml: %w", err)
		}
	}
	if rhbkConfig != nil {
		if err := writeYAMLFile(filepath.Join(pluginsDir, "rhbk.yaml"), rhbkConfig); err != nil {
			return fmt.Errorf("writing rhbk.yaml: %w", err)
		}
	}

	return nil
}

type osacPluginConfig struct {
	OsacProfile        string `yaml:"osacProfile,omitempty"`
	OsacAapLicenseFile string `yaml:"osacAapLicenseFile,omitempty"`
	OsacBYODatabase    bool   `yaml:"osacBYODatabase,omitempty"`
	OsacDatabaseUrl    string `yaml:"osacDatabaseUrl,omitempty"`
}

func extractOsacConfig(pc *models.PluginsConfig) *osacPluginConfig {
	if pc.OsacProfile == nil && pc.OsacAapLicenseFile == nil {
		return nil
	}
	cfg := &osacPluginConfig{}
	if pc.OsacProfile != nil {
		cfg.OsacProfile = *pc.OsacProfile
		pc.OsacProfile = nil
	}
	if pc.OsacAapLicenseFile != nil {
		cfg.OsacAapLicenseFile = *pc.OsacAapLicenseFile
		pc.OsacAapLicenseFile = nil
	}
	if pc.OsacBYODatabase != nil {
		cfg.OsacBYODatabase = *pc.OsacBYODatabase
		pc.OsacBYODatabase = nil
	}
	if pc.OsacDatabaseUrl != nil {
		cfg.OsacDatabaseUrl = *pc.OsacDatabaseUrl
		pc.OsacDatabaseUrl = nil
	}
	return cfg
}

type rhbkPluginConfig struct {
	RhbkInstances      int    `yaml:"rhbk_instances,omitempty"`
	RhbkDeployDatabase *bool  `yaml:"rhbk_deploy_database,omitempty"`
	RhbkDbSize         string `yaml:"rhbk_db_size,omitempty"`
}

func extractRhbkConfig(pc *models.PluginsConfig) *rhbkPluginConfig {
	if pc.RhbkInstances == nil && pc.RhbkDeployDatabase == nil && pc.RhbkDbSize == nil {
		return nil
	}
	cfg := &rhbkPluginConfig{}
	if pc.RhbkInstances != nil {
		cfg.RhbkInstances = *pc.RhbkInstances
		pc.RhbkInstances = nil
	}
	if pc.RhbkDeployDatabase != nil {
		cfg.RhbkDeployDatabase = pc.RhbkDeployDatabase
		pc.RhbkDeployDatabase = nil
	}
	if pc.RhbkDbSize != nil {
		cfg.RhbkDbSize = *pc.RhbkDbSize
		pc.RhbkDbSize = nil
	}
	return cfg
}

func writeYAMLFile[T any](path string, data *T) error {
	out, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshaling %s: %w", filepath.Base(path), err)
	}
	return os.WriteFile(path, out, 0640)
}
