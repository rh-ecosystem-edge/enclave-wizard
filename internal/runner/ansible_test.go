package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

// --- NewAnsibleRunner ---

func TestNewAnsibleRunner_DirNotFound(t *testing.T) {
	_, err := NewAnsibleRunner("/nonexistent/does-not-exist-xyz", "")
	if err == nil {
		t.Fatal("expected error for missing directory, got nil")
	}
}

func TestNewAnsibleRunner_ResolvesBinaryFromBinDir(t *testing.T) {
	binDir := t.TempDir()
	fakeBin := filepath.Join(binDir, "ansible-runner")
	if err := os.WriteFile(fakeBin, []byte("#!/bin/sh\nexit 0\n"), 0755); err != nil {
		t.Fatalf("writing fake ansible-runner: %v", err)
	}

	t.Setenv("PATH", "")

	if _, err := NewAnsibleRunner(t.TempDir(), binDir); err != nil {
		t.Fatalf("expected ansible-runner to resolve via binDir, got: %v", err)
	}
}

func TestNewAnsibleRunner_MissingBinaryEvenWithBinDir(t *testing.T) {
	t.Setenv("PATH", "")

	if _, err := NewAnsibleRunner(t.TempDir(), t.TempDir()); err != ErrRunnerBin {
		t.Fatalf("expected ErrRunnerBin, got: %v", err)
	}
}

func TestNewAnsibleRunner_CreatesArtifactsDir(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	dir := t.TempDir()
	if _, err := NewAnsibleRunner(dir, ""); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "artifacts")); err != nil {
		t.Fatalf("artifacts dir not created: %v", err)
	}
}

// --- Start ---

func TestAnsibleRunner_Start_Success(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "success.yaml",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if run.Status != models.TaskStatusRunning {
		t.Errorf("initial status: want running, got %s", run.Status)
	}
	if run.PID == 0 {
		t.Error("PID not set")
	}
	if run.StartedAt.IsZero() {
		t.Error("StartedAt not set")
	}

	completed := pollRun(t, r, run.ID, 60*time.Second)
	if completed.Status != models.TaskStatusSuccessful {
		t.Errorf("final status: want successful, got %s", completed.Status)
	}
	if completed.ExitCode == nil || *completed.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %v", completed.ExitCode)
	}
	if completed.EndedAt == nil {
		t.Error("EndedAt not set after completion")
	}
}

func TestAnsibleRunner_Start_Failure(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "fail.yaml",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	completed := pollRun(t, r, run.ID, 60*time.Second)
	if completed.Status != models.TaskStatusFailed {
		t.Errorf("final status: want failed, got %s", completed.Status)
	}
	if completed.ExitCode == nil {
		t.Error("ExitCode not set after failure")
	}
	if completed.ExitCode != nil && *completed.ExitCode == 0 {
		t.Error("expected non-zero exit code, got 0")
	}
	if completed.EndedAt == nil {
		t.Error("EndedAt not set after failure")
	}
}

func TestAnsibleRunner_Start_Busy(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	if _, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "slow.yaml",
	}); err != nil {
		t.Fatalf("first Start: %v", err)
	}

	_, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "success.yaml",
	})
	if err != ErrBusy {
		t.Errorf("expected ErrBusy, got %v", err)
	}
}

func TestAnsibleRunner_Start_ExtraVars(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{
		Type:      models.TaskTypeDeploy,
		Playbook:  "echo_var.yaml",
		ExtraVars: map[string]string{"my_var": "test_value"},
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	completed := pollRun(t, r, run.ID, 60*time.Second)
	if completed.Status != models.TaskStatusSuccessful {
		t.Errorf("final status: want successful, got %s", completed.Status)
	}
	if completed.ExtraVars["my_var"] != "test_value" {
		t.Errorf("ExtraVars not preserved in stored run: %v", completed.ExtraVars)
	}
}

// --- Cancel ---

func TestAnsibleRunner_Cancel(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "slow.yaml",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Give the process a moment to start.
	time.Sleep(500 * time.Millisecond)

	if err := r.Cancel(run.ID); err != nil {
		t.Fatalf("Cancel: %v", err)
	}

	stored, err := r.Get(run.ID)
	if err != nil {
		t.Fatalf("Get after Cancel: %v", err)
	}
	if stored.Status != models.TaskStatusCanceled {
		t.Errorf("expected canceled, got %s", stored.Status)
	}
}

func TestAnsibleRunner_Cancel_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	if err := r.Cancel("nonexistent"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- Get ---

func TestAnsibleRunner_Get_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if _, err := r.Get("does-not-exist"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAnsibleRunner_Get_ReturnsStoredFields(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	now := time.Now().Truncate(time.Second)
	want := &models.TaskRun{
		ID:        "stored-run",
		Type:      models.TaskTypeDeploy,
		Status:    models.TaskStatusSuccessful,
		Playbook:  "success.yaml",
		ExtraVars: map[string]string{"k": "v"},
		StartedAt: now,
	}
	seedRun(t, r.artifactsDir, want)

	got, err := r.Get("stored-run")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != want.ID {
		t.Errorf("ID: want %s, got %s", want.ID, got.ID)
	}
	if got.Status != want.Status {
		t.Errorf("Status: want %s, got %s", want.Status, got.Status)
	}
	if got.ExtraVars["k"] != "v" {
		t.Errorf("ExtraVars not round-tripped: %v", got.ExtraVars)
	}
}

// --- List ---

func TestAnsibleRunner_List_Empty(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	runs, err := r.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(runs) != 0 {
		t.Errorf("expected 0 runs, got %d", len(runs))
	}
}

func TestAnsibleRunner_List_SortedNewestFirst(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	now := time.Now()
	older := &models.TaskRun{ID: "older", Status: models.TaskStatusSuccessful, StartedAt: now.Add(-1 * time.Hour)}
	middle := &models.TaskRun{ID: "middle", Status: models.TaskStatusSuccessful, StartedAt: now.Add(-30 * time.Minute)}
	newer := &models.TaskRun{ID: "newer", Status: models.TaskStatusSuccessful, StartedAt: now}

	for _, run := range []*models.TaskRun{older, newer, middle} {
		seedRun(t, r.artifactsDir, run)
	}

	runs, err := r.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(runs) != 3 {
		t.Fatalf("expected 3 runs, got %d", len(runs))
	}
	if runs[0].ID != "newer" {
		t.Errorf("[0] want newer, got %s", runs[0].ID)
	}
	if runs[1].ID != "middle" {
		t.Errorf("[1] want middle, got %s", runs[1].ID)
	}
	if runs[2].ID != "older" {
		t.Errorf("[2] want older, got %s", runs[2].ID)
	}
}

// --- Logs ---

func TestAnsibleRunner_Logs_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if _, err := r.Logs("does-not-exist"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAnsibleRunner_Logs_EmptyWhenStdoutMissing(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	seedRun(t, r.artifactsDir, &models.TaskRun{
		ID: "no-stdout", Status: models.TaskStatusRunning,
	})

	logs, err := r.Logs("no-stdout")
	if err != nil {
		t.Fatalf("Logs: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("expected empty logs, got %d bytes", len(logs))
	}
}

func TestAnsibleRunner_Logs_Integration(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{Type: models.TaskTypeDeploy, Playbook: "success.yaml"})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	pollRun(t, r, run.ID, 60*time.Second)

	logs, err := r.Logs(run.ID)
	if err != nil {
		t.Fatalf("Logs: %v", err)
	}
	if len(logs) == 0 {
		t.Error("expected non-empty logs after successful run")
	}
}

// --- Events ---

func TestAnsibleRunner_Events_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if _, err := r.Events("does-not-exist"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAnsibleRunner_Events_EmptyWhenEventsDirMissing(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	seedRun(t, r.artifactsDir, &models.TaskRun{
		ID: "no-events", Status: models.TaskStatusSuccessful,
	})

	events, err := r.Events("no-events")
	if err != nil {
		t.Fatalf("Events: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("expected 0 events, got %d", len(events))
	}
}

func TestAnsibleRunner_Events_OrderedByNumericPrefix(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	runDir := seedRun(t, r.artifactsDir, &models.TaskRun{
		ID: "ordered-run", Status: models.TaskStatusSuccessful,
	})
	eventsDir := filepath.Join(runDir, "job_events")
	if err := os.MkdirAll(eventsDir, 0750); err != nil {
		t.Fatalf("mkdir events: %v", err)
	}

	eventFiles := []struct {
		name    string
		counter int
	}{
		{"3-abc-runner_on_ok.json", 3},
		{"1-def-playbook_on_start.json", 1},
		{"2-ghi-runner_on_task.json", 2},
	}
	for _, f := range eventFiles {
		data := fmt.Appendf(nil, `{"counter":%d}`, f.counter)
		if err := os.WriteFile(filepath.Join(eventsDir, f.name), data, 0644); err != nil {
			t.Fatalf("write event file: %v", err)
		}
	}

	got, err := r.Events("ordered-run")
	if err != nil {
		t.Fatalf("Events: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 events, got %d", len(got))
	}
	for i, ev := range got {
		var m map[string]any
		if err := json.Unmarshal(ev, &m); err != nil {
			t.Fatalf("unmarshal event[%d]: %v", i, err)
		}
		if m["counter"] != float64(i+1) {
			t.Errorf("events[%d]: want counter %d, got %v", i, i+1, m["counter"])
		}
	}
}

func TestAnsibleRunner_Events_SkipsNonJSONFiles(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	runDir := seedRun(t, r.artifactsDir, &models.TaskRun{
		ID: "skip-non-json", Status: models.TaskStatusSuccessful,
	})
	eventsDir := filepath.Join(runDir, "job_events")
	if err := os.MkdirAll(eventsDir, 0750); err != nil {
		t.Fatalf("mkdir events: %v", err)
	}

	os.WriteFile(filepath.Join(eventsDir, "1-abc-event.json"), []byte(`{"counter":1}`), 0644)
	os.WriteFile(filepath.Join(eventsDir, "2-abc-event.txt"), []byte("not json"), 0644)
	os.WriteFile(filepath.Join(eventsDir, "metadata"), []byte("{}"), 0644)

	got, err := r.Events("skip-non-json")
	if err != nil {
		t.Fatalf("Events: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 event (only .json files), got %d", len(got))
	}
}

func TestAnsibleRunner_Events_Integration(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{Type: models.TaskTypeDeploy, Playbook: "success.yaml"})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	pollRun(t, r, run.ID, 60*time.Second)

	events, err := r.Events(run.ID)
	if err != nil {
		t.Fatalf("Events: %v", err)
	}
	if len(events) == 0 {
		t.Error("expected at least one event after a completed run")
	}
}

// --- Stream ---

func TestAnsibleRunner_Stream_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if _, err := r.Stream("does-not-exist"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAnsibleRunner_Stream_CompletedRun(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	runDir := seedRun(t, r.artifactsDir, &models.TaskRun{
		ID: "stream-done", Status: models.TaskStatusSuccessful,
	})
	eventsDir := filepath.Join(runDir, "job_events")
	os.MkdirAll(eventsDir, 0750)
	os.WriteFile(filepath.Join(eventsDir, "1-abc.json"), []byte(`{"counter":1}`), 0644)
	os.WriteFile(filepath.Join(eventsDir, "2-def.json"), []byte(`{"counter":2}`), 0644)

	ch, err := r.Stream("stream-done")
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	var events []Event
	for ev := range ch {
		events = append(events, ev)
	}
	if len(events) != 2 {
		t.Errorf("expected 2 events from stream, got %d", len(events))
	}
}

// --- Delete ---

func TestAnsibleRunner_Delete_NotFound(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if err := r.Delete("does-not-exist"); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAnsibleRunner_Delete_RemovesDirectory(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	runDir := seedRun(t, r.artifactsDir, &models.TaskRun{
		ID:     "to-delete",
		Status: models.TaskStatusSuccessful,
	})

	if err := r.Delete("to-delete"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := os.Stat(runDir); !os.IsNotExist(err) {
		t.Error("expected run directory to be removed")
	}
}

func TestAnsibleRunner_Delete_ActiveRunReturnsErrRunning(t *testing.T) {
	r := newRunner(t, newTestProject(t))

	run, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "slow.yaml",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	if err := r.Delete(run.ID); err != ErrRunning {
		t.Errorf("expected ErrRunning, got %v", err)
	}
}

// --- Recover ---

func TestAnsibleRunner_Recover_DeadProcessNoStatus(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	now := time.Now()
	seedRun(t, r.artifactsDir, &models.TaskRun{
		ID:        "dead-no-status",
		Status:    models.TaskStatusRunning,
		Playbook:  "success.yaml",
		PID:       999999999,
		StartedAt: now,
	})

	if err := r.Recover(); err != nil {
		t.Fatalf("Recover: %v", err)
	}

	recovered, err := r.Get("dead-no-status")
	if err != nil {
		t.Fatalf("Get after Recover: %v", err)
	}
	if recovered.Status != models.TaskStatusFailed {
		t.Errorf("expected failed, got %s", recovered.Status)
	}
	if recovered.Error == "" {
		t.Error("expected error message to be set")
	}
	if recovered.EndedAt == nil {
		t.Error("expected EndedAt to be set")
	}
}

func TestAnsibleRunner_Recover_DeadProcessWithSuccessStatus(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	now := time.Now()
	runDir := seedRun(t, r.artifactsDir, &models.TaskRun{
		ID:        "dead-successful",
		Status:    models.TaskStatusRunning,
		Playbook:  "success.yaml",
		PID:       999999999,
		StartedAt: now,
	})
	os.WriteFile(filepath.Join(runDir, "status"), []byte("successful"), 0640)
	os.WriteFile(filepath.Join(runDir, "rc"), []byte("0"), 0640)

	if err := r.Recover(); err != nil {
		t.Fatalf("Recover: %v", err)
	}

	recovered, err := r.Get("dead-successful")
	if err != nil {
		t.Fatalf("Get after Recover: %v", err)
	}
	if recovered.Status != models.TaskStatusSuccessful {
		t.Errorf("expected successful, got %s", recovered.Status)
	}
	if recovered.ExitCode == nil || *recovered.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %v", recovered.ExitCode)
	}
	if recovered.EndedAt == nil {
		t.Error("expected EndedAt to be set")
	}
}

func TestAnsibleRunner_Recover_SkipsAlreadyCompletedRuns(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	now := time.Now()
	seedRun(t, r.artifactsDir, &models.TaskRun{
		ID:        "already-done",
		Status:    models.TaskStatusSuccessful,
		Playbook:  "success.yaml",
		StartedAt: now,
	})

	if err := r.Recover(); err != nil {
		t.Fatalf("Recover: %v", err)
	}

	recovered, err := r.Get("already-done")
	if err != nil {
		t.Fatalf("Get after Recover: %v", err)
	}
	if recovered.Status != models.TaskStatusSuccessful {
		t.Errorf("expected successful (unchanged), got %s", recovered.Status)
	}
}

// --- Shutdown ---

func TestAnsibleRunner_Shutdown_NoActiveRun(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(t.TempDir(), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	if err := r.Shutdown(context.Background()); err != nil {
		t.Fatalf("Shutdown with no active run: %v", err)
	}
}

func TestAnsibleRunner_Shutdown_CancelsActiveRun(t *testing.T) {
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(newTestProject(t), "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}

	run, err := r.Start(StartRequest{
		Type:     models.TaskTypeDeploy,
		Playbook: "slow.yaml",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := r.Shutdown(ctx); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}

	stored, err := r.Get(run.ID)
	if err != nil {
		t.Fatalf("Get after Shutdown: %v", err)
	}
	if stored.Status != models.TaskStatusCanceled {
		t.Errorf("expected canceled, got %s", stored.Status)
	}
	if stored.Error != "server shutdown" {
		t.Errorf("expected error %q, got %q", "server shutdown", stored.Error)
	}
}
