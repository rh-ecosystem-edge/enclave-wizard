package experiences

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

var Blacklist = []string{}

func LoadFromDir(enclaveDir string, blacklist []string) ([]models.Experience, error) {
	dir := filepath.Join(enclaveDir, "experiences")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading experiences directory: %w", err)
	}

	bl := append(Blacklist, blacklist...)

	var result []models.Experience
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		path := filepath.Join(dir, entry.Name(), "experience.yaml")
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var exp models.Experience
		if yaml.Unmarshal(data, &exp) != nil {
			continue
		}
		if exp.Name == "" {
			continue
		}

		if slices.Contains(bl, exp.Name) {
			continue
		}

		result = append(result, exp)
	}

	return result, nil
}
