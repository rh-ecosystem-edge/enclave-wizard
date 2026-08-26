package validation

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"gopkg.in/yaml.v3"
)

func TestParseFailedEvents_StructuredErrors(t *testing.T) {
	event := map[string]any{
		"event": "runner_on_failed",
		"event_data": map[string]any{
			"task": "Validate merged config",
			"res": map[string]any{
				"msg": "Validation errors",
				"errors": []any{
					map[string]any{
						"message":     "'odfExternalConfig' is a required property",
						"data_path":   "",
						"schema_path": "allOf.1.if.then.required",
					},
				},
			},
		},
	}
	raw, _ := json.Marshal(event)
	errs := parseFailedEvents([]json.RawMessage{raw})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(errs), errs)
	}
	if errs[0].Message != "'odfExternalConfig' is a required property" {
		t.Errorf("got %q", errs[0].Message)
	}
	if errs[0].Field != "allOf.1.if.then.required" {
		t.Errorf("expected schema_path as field, got %q", errs[0].Field)
	}
}

func TestParseFailedEvents_MsgFallback(t *testing.T) {
	event := map[string]any{
		"event": "runner_on_failed",
		"event_data": map[string]any{
			"task": "Validate config",
			"res":  map[string]any{"msg": "simple error"},
		},
	}
	raw, _ := json.Marshal(event)
	errs := parseFailedEvents([]json.RawMessage{raw})
	if len(errs) != 1 || errs[0].Message != "simple error" {
		t.Errorf("expected 'simple error', got %v", errs)
	}
}

func TestParseFailedEvents_CensoredFallsBackToTaskName(t *testing.T) {
	event := map[string]any{
		"event": "runner_on_failed",
		"event_data": map[string]any{
			"task": "Validate merged config against variables schema",
			"res": map[string]any{
				"censored": "the output has been hidden",
				"changed":  false,
			},
		},
	}
	raw, _ := json.Marshal(event)
	errs := parseFailedEvents([]json.RawMessage{raw})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
	if errs[0].Message != "task failed: Validate merged config against variables schema" {
		t.Errorf("expected task name in message, got %q", errs[0].Message)
	}
}

func TestParseFailedEvents_PlaybookLevelError(t *testing.T) {
	event := map[string]any{
		"event":  "error",
		"stdout": "[ERROR]: couldn't resolve module/action 'ansible.utils.validate'. This often indicates a misspelling, missing collection, or incorrect module path.",
	}
	raw, _ := json.Marshal(event)
	errs := parseFailedEvents([]json.RawMessage{raw})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(errs), errs)
	}
	if !strings.Contains(errs[0].Message, "ansible.utils.validate") {
		t.Errorf("expected stdout message surfaced, got %q", errs[0].Message)
	}
}

func TestParseFailedEvents_IgnoresNonFailure(t *testing.T) {
	event := map[string]any{
		"event":      "runner_on_ok",
		"event_data": map[string]any{"res": map[string]any{"msg": "ignored"}},
	}
	raw, _ := json.Marshal(event)
	errs := parseFailedEvents([]json.RawMessage{raw})
	if len(errs) != 0 {
		t.Errorf("expected no errors, got %d", len(errs))
	}
}

func TestNewValidator_Unavailable(t *testing.T) {
	v := NewValidator("/nonexistent/path", nil)
	if v.available {
		t.Error("expected validator to be unavailable for nonexistent path")
	}
}

func TestValidate_SkipsWhenUnavailable(t *testing.T) {
	v := &Validator{enclaveDir: "/nonexistent", available: false}
	errs := v.Validate(&models.EnclaveConfig{})
	if errs != nil {
		t.Errorf("expected nil errors when unavailable, got %v", errs)
	}
}

func TestWriter_StoragePlugin(t *testing.T) {
	dir := t.TempDir()
	cfg := &models.EnclaveConfig{}
	cfg.Global.StoragePlugin = "odf"
	cfg.Global.BaseDomain = "test.local"

	w := config.NewWriter(dir)
	if err := w.WriteAll(cfg); err != nil {
		t.Fatal(err)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "config", "global.yaml"))
	var m map[string]any
	yaml.Unmarshal(data, &m)

	if m["storage_plugin"] != "odf" {
		t.Errorf("expected storage_plugin=odf, got %v", m["storage_plugin"])
	}
}

func TestWriter_WritesAllFiles(t *testing.T) {
	dir := t.TempDir()
	w := config.NewWriter(dir)
	if err := w.WriteAll(&models.EnclaveConfig{}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"global.yaml", "certificates.yaml", "cloud_infra.yaml"} {
		if _, err := os.Stat(filepath.Join(dir, "config", name)); err != nil {
			t.Errorf("expected %s to exist", name)
		}
	}
}

func TestWriter_CertificatesPreserved(t *testing.T) {
	dir := t.TempDir()
	cert := "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----"
	cfg := &models.EnclaveConfig{}
	cfg.Certificates.SSLCACertificate = &cert

	w := config.NewWriter(dir)
	w.WriteAll(cfg)

	data, _ := os.ReadFile(filepath.Join(dir, "config", "certificates.yaml"))
	if !strings.Contains(string(data), "TEST") {
		t.Error("expected certificate content")
	}
}
