package config

import (
	"fmt"
	"os"
	"path/filepath"

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

	topo, err := r.readTopology()
	if err != nil {
		return nil, fmt.Errorf("reading topology.yaml: %w", err)
	}

	// cloud_infra.yaml is the canonical location; fall back to global.yaml
	if len(infra.DiscoveryHosts) == 0 && len(globalRaw.DiscoveryHosts) > 0 {
		infra.DiscoveryHosts = globalRaw.DiscoveryHosts
	}

	return &models.EnclaveConfig{
		Global:       globalRaw.GlobalConfig,
		Certificates: *certs,
		CloudInfra:   *infra,
		Topology:     *topo,
	}, nil
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

func (r *Reader) readTopology() (*models.TopologyConfig, error) {
	return readYAMLFile[models.TopologyConfig](filepath.Join(r.enclaveDir, "config", "topology.yaml"))
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
