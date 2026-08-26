package validation

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/runner"
)

type Validator struct {
	enclaveDir string
	runner     runner.Runner
	available  bool
}

func NewValidator(enclaveDir string, runner runner.Runner) *Validator {
	if runner == nil {
		fmt.Println("WARNING: schema validation unavailable (task runner not available)")
		return &Validator{enclaveDir: enclaveDir}
	}

	playbook := filepath.Join(enclaveDir, "playbooks", "validation", "validate-schema.yaml")
	if _, err := os.Stat(playbook); err != nil {
		fmt.Println("WARNING: schema validation unavailable (playbook not found)")
		return &Validator{enclaveDir: enclaveDir}
	}

	patchValidationNoLog(enclaveDir)
	writePluginValidationPlaybook(enclaveDir)

	fmt.Println("Schema validation enabled")
	return &Validator{enclaveDir: enclaveDir, runner: runner, available: true}
}

func patchValidationNoLog(enclaveDir string) {
	taskFile := filepath.Join(enclaveDir, "playbooks", "validation", "tasks", "variables_schema_validation.yaml")
	data, err := os.ReadFile(taskFile)
	if err != nil {
		return
	}
	patched := strings.ReplaceAll(string(data), "  no_log: true", "  no_log: false")
	if patched == string(data) {
		return
	}
	os.WriteFile(taskFile, []byte(patched), 0640)
	fmt.Println("Patched validation playbook: disabled no_log for error visibility")
}

const pluginValidationPlaybook = `---
- name: Plugin Requirement Validation
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Include load-vars
      ansible.builtin.include_tasks:
        file: common/load-vars.yaml

    - name: Validate enabled plugin requirements
      ansible.builtin.include_tasks:
        file: tasks/validate_enabled_plugins.yaml
`

func writePluginValidationPlaybook(enclaveDir string) {
	tasksFile := filepath.Join(enclaveDir, "playbooks", "tasks", "validate_enabled_plugins.yaml")
	if _, err := os.Stat(tasksFile); err != nil {
		return
	}
	path := filepath.Join(enclaveDir, "playbooks", "validate-plugins.yaml")
	os.WriteFile(path, []byte(pluginValidationPlaybook), 0640)
	fmt.Println("Created plugin validation playbook wrapper")
}

func (v *Validator) Available() bool {
	return v.available && v.runner != nil
}

func (v *Validator) Validate(cfg *models.EnclaveConfig) []models.ValidationError {
	if !v.available {
		return nil
	}
	if v.runner == nil {
		return []models.ValidationError{{Message: "schema validation unavailable: ansible-runner not found"}}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	errs := v.runPlaybook(ctx, cfg, "playbooks/validation/validate-schema.yaml", []string{"validate-config"})
	if len(errs) > 0 {
		return errs
	}
	return v.runPlaybook(ctx, cfg, "playbooks/validate-plugins.yaml", nil)
}

func (v *Validator) runPlaybook(ctx context.Context, cfg *models.EnclaveConfig, playbook string, tags []string) []models.ValidationError {
	writer := config.NewWriter(v.enclaveDir)
	if err := writer.WriteAll(cfg); err != nil {
		return []models.ValidationError{{Message: fmt.Sprintf("failed to write config: %v", err)}}
	}

	run, _, err := v.runner.RunSync(ctx, runner.StartRequest{
		Type:     models.TaskTypeValidate,
		Playbook: playbook,
		Tags:     tags,
	})

	if err != nil {
		return []models.ValidationError{{Message: fmt.Sprintf("validation error: %v", err)}}
	}

	if run.Status == models.TaskStatusSuccessful {
		return nil
	}

	events, _ := v.runner.Events(run.ID)
	if errs := parseFailedEvents(events); len(errs) > 0 {
		return errs
	}

	return []models.ValidationError{{Message: "validation failed"}}
}

func parseFailedEvents(events []json.RawMessage) []models.ValidationError {
	var result []models.ValidationError
	for _, raw := range events {
		var ev struct {
			Event     string `json:"event"`
			Stdout    string `json:"stdout"`
			EventData struct {
				Task string `json:"task"`
				Res  struct {
					Msg    string `json:"msg"`
					Errors []struct {
						Message    string `json:"message"`
						DataPath   string `json:"data_path"`
						SchemaPath string `json:"schema_path"`
					} `json:"errors"`
					Results []struct {
						Failed bool   `json:"failed"`
						Msg    string `json:"msg"`
					} `json:"results"`
				} `json:"res"`
			} `json:"event_data"`
		}
		if json.Unmarshal(raw, &ev) != nil {
			continue
		}

		// ansible-runner reports playbook-level failures (missing collection,
		// syntax errors, etc. — anything before a task even starts) as an
		// "error" event with the message only in stdout, not event_data.res.
		if ev.Event == "error" {
			msg := strings.TrimSpace(ev.Stdout)
			if msg == "" {
				msg = "playbook error"
			}
			result = append(result, models.ValidationError{Message: msg})
			continue
		}

		if ev.Event != "runner_on_failed" {
			continue
		}

		if len(ev.EventData.Res.Errors) > 0 {
			for _, e := range ev.EventData.Res.Errors {
				field := e.DataPath
				if field == "" {
					field = e.SchemaPath
				}
				result = append(result, models.ValidationError{
					Field:   field,
					Message: e.Message,
				})
			}
			continue
		}

		if len(ev.EventData.Res.Results) > 0 {
			for _, r := range ev.EventData.Res.Results {
				if !r.Failed {
					continue
				}
				result = append(result, models.ValidationError{
					Message: r.Msg,
				})
			}
			continue
		}

		if ev.EventData.Res.Msg != "" {
			result = append(result, models.ValidationError{
				Message: ev.EventData.Res.Msg,
			})
			continue
		}

		msg := "validation failed"
		if ev.EventData.Task != "" {
			msg = fmt.Sprintf("task failed: %s", ev.EventData.Task)
		}
		result = append(result, models.ValidationError{Message: msg})
	}
	return result
}
