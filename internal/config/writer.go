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

	if err := writeYAMLFile(filepath.Join(configDir, "global.yaml"), &cfg.Global); err != nil {
		return fmt.Errorf("writing global.yaml: %w", err)
	}
	if err := writeYAMLFile(filepath.Join(configDir, "certificates.yaml"), &cfg.Certificates); err != nil {
		return fmt.Errorf("writing certificates.yaml: %w", err)
	}
	if err := writeYAMLFile(filepath.Join(configDir, "cloud_infra.yaml"), &cfg.CloudInfra); err != nil {
		return fmt.Errorf("writing cloud_infra.yaml: %w", err)
	}
	if err := writeYAMLFile(filepath.Join(configDir, "topology.yaml"), &cfg.Topology); err != nil {
		return fmt.Errorf("writing topology.yaml: %w", err)
	}
	return nil
}

func writeYAMLFile[T any](path string, data *T) error {
	out, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshaling %s: %w", filepath.Base(path), err)
	}
	return os.WriteFile(path, out, 0640)
}
