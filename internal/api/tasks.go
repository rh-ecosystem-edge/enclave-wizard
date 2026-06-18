package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/plugins"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/tasks"
)

var phasePlaybooks = map[int]string{
	1: "playbooks/01-prepare.yaml",
	2: "playbooks/02-mirror.yaml",
	3: "playbooks/03-deploy.yaml",
	4: "playbooks/04-post-install.yaml",
	5: "playbooks/05-operators.yaml",
	6: "playbooks/06-day2.yaml",
	7: "playbooks/07-configure-discovery.yaml",
}

type TasksHandler struct {
	runner       tasks.Runner
	registry     *plugins.Registry
	configReader *config.Reader
	enclaveDir   string
}

func NewTasksHandler(runner tasks.Runner, registry *plugins.Registry, configReader *config.Reader, enclaveDir string) *TasksHandler {
	return &TasksHandler{runner: runner, registry: registry, configReader: configReader, enclaveDir: enclaveDir}
}

// --- Request / Response types ---

type StartDeployInput struct{}

type StartDeployPhaseInput struct {
	Phase int `path:"phase" doc:"Deployment phase number (1-7)" minimum:"1" maximum:"7"`
}

type StartDeployPluginInput struct {
	Name string `path:"name" doc:"Plugin name" minLength:"1"`
}

type StartTaskOutput struct {
	Body models.TaskRun
}

type ListTasksOutput struct {
	Body struct {
		Runs []models.TaskRun `json:"runs" doc:"All known task runs"`
	}
}

type GetTaskInput struct {
	ID string `path:"id" doc:"Run identifier" minLength:"1"`
}

type GetTaskOutput struct {
	Body models.TaskRun
}

type GetTaskLogsInput struct {
	ID string `path:"id" doc:"Run identifier" minLength:"1"`
}

type GetTaskLogsOutput struct {
	Body string
}

type GetTaskEventsInput struct {
	ID string `path:"id" doc:"Run identifier" minLength:"1"`
}

type GetTaskEventsOutput struct {
	Body struct {
		Events []json.RawMessage `json:"events" doc:"Ansible Runner job events"`
	}
}

type DeleteTaskInput struct {
	ID string `path:"id" doc:"Run identifier" minLength:"1"`
}

// --- Registration ---

func (h *TasksHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "start-deploy",
		Method:      http.MethodPost,
		Path:        "/api/v1/tasks/deploy",
		Summary:     "Start full deployment",
		Description: "Runs the main.yaml playbook (all 7 phases).",
		Tags:        []string{"Tasks"},
	}, h.startDeploy)

	huma.Register(api, huma.Operation{
		OperationID: "start-deploy-phase",
		Method:      http.MethodPost,
		Path:        "/api/v1/tasks/deploy/{phase}",
		Summary:     "Start a specific deployment phase",
		Description: "Runs a single deployment phase (1-7).",
		Tags:        []string{"Tasks"},
	}, h.startDeployPhase)

	huma.Register(api, huma.Operation{
		OperationID: "start-deploy-plugin",
		Method:      http.MethodPost,
		Path:        "/api/v1/tasks/plugins/{name}",
		Summary:     "Deploy a plugin",
		Description: "Runs the deploy-plugin.yaml playbook for the named plugin.",
		Tags:        []string{"Tasks"},
	}, h.startDeployPlugin)

	huma.Register(api, huma.Operation{
		OperationID: "list-tasks",
		Method:      http.MethodGet,
		Path:        "/api/v1/tasks",
		Summary:     "List all task runs",
		Description: "Returns all known task runs, most recent first.",
		Tags:        []string{"Tasks"},
	}, h.listTasks)

	huma.Register(api, huma.Operation{
		OperationID: "get-task",
		Method:      http.MethodGet,
		Path:        "/api/v1/tasks/{id}",
		Summary:     "Get task run details",
		Description: "Returns status and metadata for a specific run.",
		Tags:        []string{"Tasks"},
	}, h.getTask)

	huma.Register(api, huma.Operation{
		OperationID: "get-task-logs",
		Method:      http.MethodGet,
		Path:        "/api/v1/tasks/{id}/logs",
		Summary:     "Get task output logs",
		Description: "Returns ansible-runner stdout as text/plain. Use the offset query parameter for incremental reads.",
		Tags:        []string{"Tasks"},
	}, h.getTaskLogs)

	huma.Register(api, huma.Operation{
		OperationID: "get-task-events",
		Method:      http.MethodGet,
		Path:        "/api/v1/tasks/{id}/events",
		Summary:     "Get task job events",
		Description: "Returns ansible-runner job events as a JSON array.",
		Tags:        []string{"Tasks"},
	}, h.getTaskEvents)

	huma.Register(api, huma.Operation{
		OperationID: "delete-task",
		Method:      http.MethodDelete,
		Path:        "/api/v1/tasks/{id}",
		Summary:     "Delete a task run",
		Description: "Removes the ansible-runner directory for the given run. Returns 409 if the task is still running.",
		Tags:        []string{"Tasks"},
	}, h.deleteTask)

	huma.Register(api, huma.Operation{
		OperationID: "start-validate",
		Method:      http.MethodPost,
		Path:        "/api/v1/tasks/validate",
		Summary:     "Run operational validation (validations.sh)",
		Description: "Runs the enclave operational validation script that checks DNS, Redfish, certificates, and registry connectivity.",
		Tags:        []string{"Tasks"},
	}, h.startValidate)
}

// --- Handlers ---

func (h *TasksHandler) startDeploy(ctx context.Context, _ *StartDeployInput) (*StartTaskOutput, error) {
	addonPlugins := h.addonPluginsFromConfig()
	playbook := "playbooks/main.yaml"

	if len(addonPlugins) > 0 {
		slog.Info("deploy with addon plugins", "plugins", addonPlugins)
		pb, err := h.writeDeployWithPluginsPlaybook(addonPlugins)
		if err != nil {
			slog.Error("failed to generate deploy playbook", "error", err)
		} else {
			playbook = pb
		}
	}

	run, err := h.runner.Start(tasks.StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: playbook,
		ExtraVars: map[string]string{
			"workingDir": h.enclaveDir,
		},
	})
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &StartTaskOutput{Body: *run}, nil
}

func (h *TasksHandler) addonPluginsFromConfig() []string {
	if h.configReader == nil {
		return nil
	}
	cfg, err := h.configReader.ReadAll()
	if err != nil {
		return nil
	}
	type addonInfo struct {
		name  string
		order int
	}
	var addons []addonInfo
	for _, name := range cfg.Global.EnabledPlugins {
		p, ok := h.registry.Get(name)
		if !ok {
			continue
		}
		if p.Type == models.PluginTypeAddon {
			addons = append(addons, addonInfo{name: p.Name, order: p.Order})
		}
	}
	sort.Slice(addons, func(i, j int) bool { return addons[i].order < addons[j].order })
	result := make([]string, len(addons))
	for i, a := range addons {
		result[i] = a.name
	}
	return result
}

func (h *TasksHandler) writeDeployWithPluginsPlaybook(addonPlugins []string) (string, error) {
	var buf strings.Builder
	buf.WriteString("---\n")
	buf.WriteString("# Auto-generated: deploy cluster + addon plugins\n")
	buf.WriteString("- ansible.builtin.import_playbook: main.yaml\n\n")

	for _, name := range addonPlugins {
		buf.WriteString(fmt.Sprintf("- name: Deploy addon plugin %s\n", name))
		buf.WriteString("  hosts: localhost\n")
		buf.WriteString("  gather_facts: false\n")
		buf.WriteString("  tasks:\n")
		buf.WriteString("    - name: Include plugin deploy tasks\n")
		buf.WriteString("      ansible.builtin.include_tasks:\n")
		buf.WriteString("        file: tasks/deploy_plugin.yaml\n")
		buf.WriteString("      vars:\n")
		buf.WriteString(fmt.Sprintf("        plugin_name: %s\n\n", name))
	}

	path := filepath.Join(h.enclaveDir, "playbooks", "wizard-deploy.yaml")
	if err := os.WriteFile(path, []byte(buf.String()), 0640); err != nil {
		return "", fmt.Errorf("writing deploy playbook: %w", err)
	}
	return "playbooks/wizard-deploy.yaml", nil
}

func (h *TasksHandler) startDeployPhase(ctx context.Context, input *StartDeployPhaseInput) (*StartTaskOutput, error) {
	playbook, ok := phasePlaybooks[input.Phase]
	if !ok {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid phase: %d", input.Phase))
	}
	run, err := h.runner.Start(tasks.StartRequest{
		Type:     models.TaskTypeDeployPhase,
		Playbook: playbook,
		ExtraVars: map[string]string{
			"workingDir": h.enclaveDir,
		},
	})
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &StartTaskOutput{Body: *run}, nil
}

func (h *TasksHandler) startDeployPlugin(ctx context.Context, input *StartDeployPluginInput) (*StartTaskOutput, error) {
	if _, ok := h.registry.Get(input.Name); !ok {
		return nil, huma.Error404NotFound("unknown plugin: " + input.Name)
	}
	run, err := h.runner.Start(tasks.StartRequest{
		Type:     models.TaskTypeDeployPlugin,
		Playbook: "playbooks/deploy-plugin.yaml",
		ExtraVars: map[string]string{
			"plugin_name": input.Name,
			"workingDir":  h.enclaveDir,
		},
	})
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &StartTaskOutput{Body: *run}, nil
}

func (h *TasksHandler) listTasks(_ context.Context, _ *struct{}) (*ListTasksOutput, error) {
	runs, err := h.runner.List()
	if err != nil {
		return nil, mapTaskError(err)
	}
	out := &ListTasksOutput{}
	if runs == nil {
		runs = []models.TaskRun{}
	}
	out.Body.Runs = runs
	return out, nil
}

func (h *TasksHandler) getTask(_ context.Context, input *GetTaskInput) (*GetTaskOutput, error) {
	run, err := h.runner.Get(input.ID)
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &GetTaskOutput{Body: *run}, nil
}

func (h *TasksHandler) getTaskLogs(_ context.Context, input *GetTaskLogsInput) (*GetTaskLogsOutput, error) {
	data, err := h.runner.Logs(input.ID)
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &GetTaskLogsOutput{Body: string(data)}, nil
}

func (h *TasksHandler) getTaskEvents(_ context.Context, input *GetTaskEventsInput) (*GetTaskEventsOutput, error) {
	events, err := h.runner.Events(input.ID)
	if err != nil {
		return nil, mapTaskError(err)
	}
	out := &GetTaskEventsOutput{}
	out.Body.Events = events
	return out, nil
}

func (h *TasksHandler) deleteTask(_ context.Context, input *DeleteTaskInput) (*struct{}, error) {
	if err := h.runner.Delete(input.ID); err != nil {
		return nil, mapTaskError(err)
	}
	return nil, nil
}

type StartValidateInput struct{}

func (h *TasksHandler) startValidate(ctx context.Context, _ *StartValidateInput) (*StartTaskOutput, error) {
	run, err := h.runner.Start(tasks.StartRequest{
		Type:     models.TaskTypeValidate,
		Playbook: "validations.sh",
	})
	if err != nil {
		return nil, mapTaskError(err)
	}
	return &StartTaskOutput{Body: *run}, nil
}

func mapTaskError(err error) error {
	switch {
	case errors.Is(err, tasks.ErrBusy):
		return huma.Error409Conflict("a task is already running")
	case errors.Is(err, tasks.ErrRunning):
		return huma.Error409Conflict("task is still running")
	case errors.Is(err, tasks.ErrNotFound):
		return huma.Error404NotFound("run not found")
	default:
		return huma.Error500InternalServerError("task operation failed", err)
	}
}
