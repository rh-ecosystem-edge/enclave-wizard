package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/plugins"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/tasks"
	"go.uber.org/mock/gomock"
)

func setupTasksAPI(runner tasks.Runner) *httptest.Server {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	registry := plugins.NewRegistry([]models.Plugin{
		{Name: "lvms", Type: models.PluginTypeFoundation},
	})
	NewTasksHandler(runner, registry, nil, "/opt/enclave").Register(api)
	return httptest.NewServer(mux)
}

func sampleRun() *models.TaskRun {
	now := time.Now()
	return &models.TaskRun{
		ID:        "run-123",
		Type:      models.TaskTypeDeploy,
		Status:    models.TaskStatusRunning,
		Playbook:  "playbooks/main.yaml",
		StartedAt: now,
	}
}

// --- Start deploy ---

func TestStartDeploy_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	run := sampleRun()
	m.EXPECT().Start(tasks.StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "playbooks/main.yaml",
		ExtraVars: map[string]string{
			"workingDir": "/opt/enclave",
		},
	}).Return(run, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/deploy", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var got models.TaskRun
	json.NewDecoder(resp.Body).Decode(&got)
	assertEqual(t, "id", "run-123", got.ID)
	assertEqual(t, "type", models.TaskTypeDeploy, got.Type)
}

func TestStartDeploy_Busy(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Start(gomock.Any()).Return(nil, tasks.ErrBusy)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/deploy", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusConflict, resp.StatusCode)
}

// --- Start deploy phase ---

func TestStartDeployPhase_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	run := sampleRun()
	run.Type = models.TaskTypeDeployPhase
	run.Playbook = "playbooks/03-deploy.yaml"
	m.EXPECT().Start(tasks.StartRequest{
		Type:     models.TaskTypeDeployPhase,
		Playbook: "playbooks/03-deploy.yaml",
		ExtraVars: map[string]string{
			"workingDir": "/opt/enclave",
		},
	}).Return(run, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/deploy/3", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var got models.TaskRun
	json.NewDecoder(resp.Body).Decode(&got)
	assertEqual(t, "playbook", "playbooks/03-deploy.yaml", got.Playbook)
}

func TestStartDeployPhase_InvalidPhase(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/deploy/0", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusUnprocessableEntity, resp.StatusCode)
}

func TestStartDeployPhase_AllPhases(t *testing.T) {
	expected := map[int]string{
		1: "playbooks/01-prepare.yaml",
		2: "playbooks/02-mirror.yaml",
		3: "playbooks/03-deploy.yaml",
		4: "playbooks/04-post-install.yaml",
		5: "playbooks/05-operators.yaml",
		6: "playbooks/06-day2.yaml",
		7: "playbooks/07-configure-discovery.yaml",
	}

	for phase, playbook := range expected {
		t.Run(playbook, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			m := tasks.NewMockRunner(ctrl)
			run := sampleRun()
			run.Type = models.TaskTypeDeployPhase
			run.Playbook = playbook
			m.EXPECT().Start(tasks.StartRequest{
				Type:     models.TaskTypeDeployPhase,
				Playbook: playbook,
				ExtraVars: map[string]string{
					"workingDir": "/opt/enclave",
				},
			}).Return(run, nil)

			srv := setupTasksAPI(m)
			defer srv.Close()

			resp, err := http.Post(srv.URL+"/api/v1/tasks/deploy/"+string(rune('0'+phase)), "application/json", nil)
			if err != nil {
				t.Fatalf("POST: %v", err)
			}
			defer resp.Body.Close()

			assertEqual(t, "status", http.StatusOK, resp.StatusCode)

			var got models.TaskRun
			json.NewDecoder(resp.Body).Decode(&got)
			assertEqual(t, "playbook", playbook, got.Playbook)
		})
	}
}

// --- Start deploy plugin ---

func TestStartDeployPlugin_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	run := sampleRun()
	run.Type = models.TaskTypeDeployPlugin
	run.Playbook = "playbooks/deploy-plugin.yaml"
	run.ExtraVars = map[string]string{"plugin_name": "lvms", "workingDir": "/opt/enclave"}
	m.EXPECT().Start(tasks.StartRequest{
		Type:     models.TaskTypeDeployPlugin,
		Playbook: "playbooks/deploy-plugin.yaml",
		ExtraVars: map[string]string{
			"plugin_name": "lvms",
			"workingDir":  "/opt/enclave",
		},
	}).Return(run, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/plugins/lvms", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var got models.TaskRun
	json.NewDecoder(resp.Body).Decode(&got)
	assertEqual(t, "plugin_name", "lvms", got.ExtraVars["plugin_name"])
}

func TestStartDeployPlugin_Unknown(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/tasks/plugins/bogus", "application/json", nil)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNotFound, resp.StatusCode)
}

// --- List tasks ---

func TestListTasks_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	runs := []models.TaskRun{*sampleRun()}
	m.EXPECT().List().Return(runs, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var out struct {
		Runs []models.TaskRun `json:"runs"`
	}
	json.NewDecoder(resp.Body).Decode(&out)
	if len(out.Runs) != 1 {
		t.Fatalf("expected 1 run, got %d", len(out.Runs))
	}
	assertEqual(t, "id", "run-123", out.Runs[0].ID)
}

func TestListTasks_Empty(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().List().Return([]models.TaskRun{}, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	var out struct {
		Runs []models.TaskRun `json:"runs"`
	}
	json.NewDecoder(resp.Body).Decode(&out)
	if len(out.Runs) != 0 {
		t.Fatalf("expected 0 runs, got %d", len(out.Runs))
	}
}

func TestListTasks_NilRunsEncodesAsArray(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().List().Return(nil, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var raw map[string]json.RawMessage
	json.NewDecoder(resp.Body).Decode(&raw)
	if string(raw["runs"]) == "null" {
		t.Error("runs field must encode as [] not null when runner returns nil slice")
	}
}

// --- Get task ---

func TestGetTask_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	run := sampleRun()
	m.EXPECT().Get("run-123").Return(run, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/run-123")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var got models.TaskRun
	json.NewDecoder(resp.Body).Decode(&got)
	assertEqual(t, "id", "run-123", got.ID)
}

func TestGetTask_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Get("nonexistent").Return(nil, tasks.ErrNotFound)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/nonexistent")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNotFound, resp.StatusCode)
}

// --- Get task logs ---

func TestGetTaskLogs_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Logs("run-123").Return([]byte("PLAY [deploy] *******\nok: [localhost]\n"), nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/run-123/logs")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var logs string
	json.NewDecoder(resp.Body).Decode(&logs)
	if len(logs) == 0 {
		t.Fatal("expected non-empty log output")
	}
}

func TestGetTaskLogs_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Logs("nonexistent").Return(nil, tasks.ErrNotFound)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/nonexistent/logs")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNotFound, resp.StatusCode)
}

// --- Get task events ---

func TestGetTaskEvents_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	events := []json.RawMessage{
		json.RawMessage(`{"event":"playbook_on_start","counter":1}`),
		json.RawMessage(`{"event":"runner_on_ok","counter":2}`),
	}
	m.EXPECT().Events("run-123").Return(events, nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/run-123/events")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	assertEqual(t, "status", http.StatusOK, resp.StatusCode)

	var out struct {
		Events []json.RawMessage `json:"events"`
	}
	json.NewDecoder(resp.Body).Decode(&out)
	if len(out.Events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(out.Events))
	}
}

func TestGetTaskEvents_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Events("nonexistent").Return(nil, tasks.ErrNotFound)

	srv := setupTasksAPI(m)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/tasks/nonexistent/events")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNotFound, resp.StatusCode)
}

// --- Delete task ---

func TestDeleteTask_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Delete("run-123").Return(nil)

	srv := setupTasksAPI(m)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/v1/tasks/run-123", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNoContent, resp.StatusCode)
}

func TestDeleteTask_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Delete("nonexistent").Return(tasks.ErrNotFound)

	srv := setupTasksAPI(m)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/v1/tasks/nonexistent", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusNotFound, resp.StatusCode)
}

func TestDeleteTask_StillRunning(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := tasks.NewMockRunner(ctrl)
	m.EXPECT().Delete("run-123").Return(tasks.ErrRunning)

	srv := setupTasksAPI(m)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/v1/tasks/run-123", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	resp.Body.Close()
	assertEqual(t, "status", http.StatusConflict, resp.StatusCode)
}

func assertEqual[T comparable](t *testing.T, field string, want, got T) {
	t.Helper()
	if want != got {
		t.Errorf("%s: want %v, got %v", field, want, got)
	}
}
