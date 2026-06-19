package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/validation"
)

type ConfigHandler struct {
	reader    *config.Reader
	writer    *config.Writer
	validator *validation.Validator
}

func NewConfigHandler(reader *config.Reader, writer *config.Writer, validator *validation.Validator) *ConfigHandler {
	return &ConfigHandler{reader: reader, writer: writer, validator: validator}
}

// --- Full-config Input / Output types ---

type GetConfigOutput struct {
	Body models.EnclaveConfig
}

type WriteConfigInput struct {
	Body models.EnclaveConfig
}

type ValidateConfigInput struct {
	Body models.EnclaveConfig
}

type ValidateConfigOutput struct {
	Body struct {
		Valid  bool                     `json:"valid" doc:"Whether the config passes all validation checks"`
		Errors []models.ValidationError `json:"errors,omitempty" doc:"Validation errors, if any"`
	}
}

type PreviewConfigInput struct {
	Body models.EnclaveConfig
}

type PreviewConfigOutput struct {
	Body struct {
		GlobalYaml       string `json:"globalYaml" doc:"Rendered global.yaml content"`
		CertificatesYaml string `json:"certificatesYaml" doc:"Rendered certificates.yaml content"`
		CloudInfraYaml   string `json:"cloudInfraYaml" doc:"Rendered cloud_infra.yaml content"`
	}
}

// --- Section Input / Output types ---

type SectionOutput[T any] struct {
	Body T
}

type SectionInput[T any] struct {
	Body T
}

// --- Registration ---

func (h *ConfigHandler) Register(api huma.API) {
	// Full-config endpoints
	huma.Register(api, huma.Operation{
		OperationID: "get-config",
		Method:      http.MethodGet,
		Path:        "/api/v1/config",
		Summary:     "Load existing configuration",
		Description: "Reads config/global.yaml, config/certificates.yaml, and config/cloud_infra.yaml from the Enclave directory and returns the merged configuration.",
		Tags:        []string{"Config"},
	}, h.getConfig)

	huma.Register(api, huma.Operation{
		OperationID: "write-config",
		Method:      http.MethodPut,
		Path:        "/api/v1/config",
		Summary:     "Write configuration to disk",
		Description: "Accepts wizard state, serializes to YAML, and writes to the Enclave config directory.",
		Tags:        []string{"Config"},
	}, h.writeConfig)

	huma.Register(api, huma.Operation{
		OperationID: "validate-config",
		Method:      http.MethodPost,
		Path:        "/api/v1/config/validate",
		Summary:     "Validate configuration",
		Description: "Validates the candidate configuration against Enclave JSON schemas and returns structured errors.",
		Tags:        []string{"Config"},
	}, h.validateConfig)

	huma.Register(api, huma.Operation{
		OperationID: "preview-config",
		Method:      http.MethodPost,
		Path:        "/api/v1/config/preview",
		Summary:     "Preview rendered YAML",
		Description: "Returns the rendered YAML content for each config file without writing to disk.",
		Tags:        []string{"Config"},
	}, h.previewConfig)

	// Section endpoints
	registerSection(api, h, "lz", "Landing Zone", "Landing zone configuration",
		func(cfg *models.EnclaveConfig) models.LandingZoneConfig { return cfg.Global.LandingZoneConfig },
		func(cfg *models.EnclaveConfig, v models.LandingZoneConfig) { cfg.Global.LandingZoneConfig = v },
	)
	registerSection(api, h, "cluster", "Cluster", "Management cluster install configuration",
		func(cfg *models.EnclaveConfig) models.ClusterConfig { return cfg.Global.ClusterConfig },
		func(cfg *models.EnclaveConfig, v models.ClusterConfig) { cfg.Global.ClusterConfig = v },
	)
	registerSection(api, h, "network", "Network", "Host network configuration",
		func(cfg *models.EnclaveConfig) models.NetworkConfig { return cfg.Global.NetworkConfig },
		func(cfg *models.EnclaveConfig, v models.NetworkConfig) { cfg.Global.NetworkConfig = v },
	)
	registerSection(api, h, "quay", "Quay", "Quay registry configuration",
		func(cfg *models.EnclaveConfig) models.QuayConfig { return cfg.Global.QuayConfig },
		func(cfg *models.EnclaveConfig, v models.QuayConfig) { cfg.Global.QuayConfig = v },
	)
	registerSection(api, h, "storage", "Storage", "Block storage configuration",
		func(cfg *models.EnclaveConfig) models.StorageConfig { return cfg.Global.StorageConfig },
		func(cfg *models.EnclaveConfig, v models.StorageConfig) { cfg.Global.StorageConfig = v },
	)
	registerSection(api, h, "plugins", "Plugins", "Enabled plugins configuration",
		func(cfg *models.EnclaveConfig) models.PluginsConfig { return cfg.Global.PluginsConfig },
		func(cfg *models.EnclaveConfig, v models.PluginsConfig) { cfg.Global.PluginsConfig = v },
	)
	registerSection(api, h, "certificates", "Certificates", "TLS certificates",
		func(cfg *models.EnclaveConfig) models.CertificatesConfig { return cfg.Certificates },
		func(cfg *models.EnclaveConfig, v models.CertificatesConfig) { cfg.Certificates = v },
	)
	registerSection(api, h, "hosts", "Hosts", "Discovery hosts (cloud infrastructure)",
		func(cfg *models.EnclaveConfig) models.CloudInfraConfig { return cfg.CloudInfra },
		func(cfg *models.EnclaveConfig, v models.CloudInfraConfig) { cfg.CloudInfra = v },
	)
}

func registerSection[T any](
	api huma.API,
	h *ConfigHandler,
	path, tag, summary string,
	get func(*models.EnclaveConfig) T,
	set func(*models.EnclaveConfig, T),
) {
	huma.Register(api, huma.Operation{
		OperationID: "get-config-" + path,
		Method:      http.MethodGet,
		Path:        "/api/v1/config/" + path,
		Summary:     "Load " + summary,
		Tags:        []string{tag},
	}, func(_ context.Context, _ *struct{}) (*SectionOutput[T], error) {
		cfg, err := h.reader.ReadAll()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to read config", err)
		}
		return &SectionOutput[T]{Body: get(cfg)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "write-config-" + path,
		Method:      http.MethodPut,
		Path:        "/api/v1/config/" + path,
		Summary:     "Update " + summary,
		Tags:        []string{tag},
	}, func(_ context.Context, input *SectionInput[T]) (*struct{}, error) {
		cfg, err := h.reader.ReadAll()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to read config", err)
		}
		set(cfg, input.Body)
		if h.validator.Available() {
			if errs := h.validator.Validate(cfg); len(errs) > 0 {
				details := make([]error, len(errs))
				for i, e := range errs {
					details[i] = fmt.Errorf("%s: %s", e.Field, e.Message)
				}
				return nil, huma.Error422UnprocessableEntity("config validation failed", details...)
			}
		}
		if err := h.writer.WriteAll(cfg); err != nil {
			return nil, huma.Error500InternalServerError("failed to write config", err)
		}
		return nil, nil
	})
}

// --- Full-config Handlers ---

func (h *ConfigHandler) getConfig(_ context.Context, _ *struct{}) (*GetConfigOutput, error) {
	cfg, err := h.reader.ReadAll()
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to read config", err)
	}
	return &GetConfigOutput{Body: *cfg}, nil
}

func (h *ConfigHandler) writeConfig(_ context.Context, input *WriteConfigInput) (*struct{}, error) {
	if h.validator.Available() {
		// Strip OSAC plugin fields before validation — they go to config/plugins/osac.yaml,
		// not global.yaml, and the enclave schema validator rejects unknown fields.
		saved := input.Body.Global.PluginsConfig
		input.Body.Global.PluginsConfig.OsacProfile = nil
		input.Body.Global.PluginsConfig.OsacAapLicenseFile = nil
		input.Body.Global.PluginsConfig.OsacBYODatabase = nil
		input.Body.Global.PluginsConfig.OsacDatabaseUrl = nil
		input.Body.Global.PluginsConfig.RhbkInstances = nil
		input.Body.Global.PluginsConfig.RhbkDeployDatabase = nil
		input.Body.Global.PluginsConfig.RhbkDbSize = nil

		errs := h.validator.Validate(&input.Body)

		input.Body.Global.PluginsConfig = saved

		if len(errs) > 0 {
			details := make([]error, len(errs))
			for i, e := range errs {
				details[i] = fmt.Errorf("%s: %s", e.Field, e.Message)
			}
			return nil, huma.Error422UnprocessableEntity("config validation failed", details...)
		}
	}
	if err := h.writer.WriteAll(&input.Body); err != nil {
		return nil, huma.Error500InternalServerError("failed to write config", err)
	}
	return nil, nil
}

func (h *ConfigHandler) validateConfig(_ context.Context, input *ValidateConfigInput) (*ValidateConfigOutput, error) {
	errs := h.validator.Validate(&input.Body)
	out := &ValidateConfigOutput{}
	out.Body.Valid = len(errs) == 0
	out.Body.Errors = errs
	if !out.Body.Valid {
		slog.Warn("config validation found errors", "error_count", len(errs))
	}
	return out, nil
}

func (h *ConfigHandler) previewConfig(_ context.Context, _ *PreviewConfigInput) (*PreviewConfigOutput, error) {
	// TODO: serialize each config section to YAML and return as strings
	out := &PreviewConfigOutput{}
	out.Body.GlobalYaml = "# TODO: render global.yaml"
	out.Body.CertificatesYaml = "# TODO: render certificates.yaml"
	out.Body.CloudInfraYaml = "# TODO: render cloud_infra.yaml"
	return out, nil
}
