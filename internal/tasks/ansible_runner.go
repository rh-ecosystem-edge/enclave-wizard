package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

type AnsibleRunner struct {
	enclaveDir    string
	artifactsDir  string
	demoTypes     map[models.TaskType]bool
	recordingsDir string
	demoSpeed     float64

	mu       sync.Mutex
	lockFile *os.File

	activeRun *models.TaskRun
	activeCmd *exec.Cmd
	// Closed by waitForCompletion when the process exits.
	done chan struct{}
}

func NewAnsibleRunner(enclaveDir string) (*AnsibleRunner, error) {
	if _, err := os.Stat(enclaveDir); err != nil {
		return nil, fmt.Errorf("enclave directory: %w", err)
	}
	if _, err := exec.LookPath("ansible-runner"); err != nil {
		return nil, ErrRunnerBin
	}

	artifactsDir := filepath.Join(enclaveDir, "artifacts")
	if err := os.MkdirAll(artifactsDir, 0750); err != nil {
		return nil, fmt.Errorf("creating artifacts directory: %w", err)
	}

	return &AnsibleRunner{
		enclaveDir:   enclaveDir,
		artifactsDir: artifactsDir,
	}, nil
}

func NewDemoRunner(enclaveDir, recordingsDir string, speed float64, demoTypes map[models.TaskType]bool) (*AnsibleRunner, error) {
	if _, err := os.Stat(enclaveDir); err != nil {
		return nil, fmt.Errorf("enclave directory: %w", err)
	}
	if _, err := os.Stat(recordingsDir); err != nil {
		return nil, fmt.Errorf("recordings directory: %w", err)
	}

	artifactsDir := filepath.Join(enclaveDir, "artifacts")
	if err := os.MkdirAll(artifactsDir, 0750); err != nil {
		return nil, fmt.Errorf("creating artifacts directory: %w", err)
	}

	return &AnsibleRunner{
		enclaveDir:    enclaveDir,
		artifactsDir:  artifactsDir,
		demoTypes:     demoTypes,
		recordingsDir: recordingsDir,
		demoSpeed:     speed,
	}, nil
}

func (r *AnsibleRunner) Start(req StartRequest) (*models.TaskRun, error) {
	run, _, err := r.runAsync(req)
	return run, err
}

func (r *AnsibleRunner) RunSync(ctx context.Context, req StartRequest) (*models.TaskRun, []byte, error) {
	run, done, err := r.runAsync(req)
	if err != nil {
		return nil, nil, err
	}

	select {
	case <-ctx.Done():
		return run, nil, ctx.Err()
	case <-done:
		updated, _ := r.Get(run.ID)
		if updated != nil {
			run = updated
		}
		logs, _ := r.Logs(run.ID)
		return run, logs, nil
	}
}

func (r *AnsibleRunner) runAsync(req StartRequest) (*models.TaskRun, <-chan struct{}, error) {
	if err := r.acquireLock(); err != nil {
		return nil, nil, err
	}

	runID := generateRunID()
	runDir := filepath.Join(r.artifactsDir, runID)
	if err := os.MkdirAll(runDir, 0750); err != nil {
		r.releaseLock()
		return nil, nil, fmt.Errorf("creating run directory: %w", err)
	}

	if r.demoTypes[req.Type] {
		key := ScenarioKey(req.Playbook, req.Tags)
		recordingFile := filepath.Join(r.recordingsDir, key+".json")
		if _, err := os.Stat(recordingFile); err != nil {
			r.releaseLock()
			return nil, nil, fmt.Errorf("%w: %s", ErrNoRecording, key)
		}

		now := time.Now()
		run := &models.TaskRun{
			ID:        runID,
			Type:      req.Type,
			Status:    models.TaskStatusRunning,
			Playbook:  req.Playbook,
			ExtraVars: req.ExtraVars,
			StartedAt: now,
		}
		writeRunJSON(runDir, run)

		slog.Info("demo task started", "run_id", runID, "playbook", req.Playbook, "speed", r.demoSpeed)

		done := make(chan struct{})
		r.mu.Lock()
		r.activeRun = run
		r.activeCmd = nil
		r.done = done
		r.mu.Unlock()

		go r.runFake(recordingFile, run, runDir, done)
		return run, done, nil
	}

	args := []string{"run", r.enclaveDir, "-p", req.Playbook, "--ident", runID}

	var cmdParts []string
	if len(req.ExtraVars) > 0 {
		keys := make([]string, 0, len(req.ExtraVars))
		for k := range req.ExtraVars {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			cmdParts = append(cmdParts, "--extra-vars", k+"="+req.ExtraVars[k])
		}
	}
	if len(req.Tags) > 0 {
		cmdParts = append(cmdParts, "--tags", strings.Join(req.Tags, ","))
	}
	envDir := filepath.Join(r.enclaveDir, "env")
	os.MkdirAll(envDir, 0750)
	cmdline := strings.Join(cmdParts, " ")
	if cmdline == "" {
		cmdline = " "
	}
	os.WriteFile(filepath.Join(envDir, "cmdline"), []byte(cmdline), 0640)
	if len(cmdParts) > 0 {
		args = append(args, "--cmdline", strings.Join(cmdParts, " "))
	}

	cmd := exec.Command("ansible-runner", args...)
	cmd.Dir = r.enclaveDir

	uvBinDir := filepath.Join(r.enclaveDir, ".local", "bin")
	currentPath := os.Getenv("PATH")
	if !strings.Contains(currentPath, uvBinDir) {
		currentPath = uvBinDir + ":" + currentPath
	}
	cmd.Env = append(os.Environ(),
		"ANSIBLE_CONFIG="+filepath.Join(r.enclaveDir, "ansible.cfg"),
		"PATH="+currentPath,
	)
	for k, v := range req.Env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	now := time.Now()
	run := &models.TaskRun{
		ID:        runID,
		Type:      req.Type,
		Status:    models.TaskStatusRunning,
		Playbook:  req.Playbook,
		ExtraVars: req.ExtraVars,
		StartedAt: now,
	}

	if err := cmd.Start(); err != nil {
		r.releaseLock()
		slog.Error("failed to start ansible-runner", "run_id", runID, "playbook", req.Playbook, "error", err)
		return nil, nil, fmt.Errorf("starting ansible-runner: %w", err)
	}

	run.PID = cmd.Process.Pid
	if err := writeRunJSON(runDir, run); err != nil {
		cmd.Process.Kill()
		r.releaseLock()
		slog.Error("failed to write run metadata", "run_id", runID, "error", err)
		return nil, nil, fmt.Errorf("writing run metadata: %w", err)
	}

	slog.Info("task started", "run_id", runID, "type", req.Type, "playbook", req.Playbook, "pid", run.PID)

	done := make(chan struct{})
	r.mu.Lock()
	r.activeRun = run
	r.activeCmd = cmd
	r.done = done
	r.mu.Unlock()

	go r.waitForCompletion(cmd, run, runDir, done)

	return run, done, nil
}

func (r *AnsibleRunner) runFake(recordingFile string, run *models.TaskRun, runDir string, done chan struct{}) {
	data, err := os.ReadFile(recordingFile)
	if err != nil {
		slog.Error("failed to read recording", "error", err)
		r.releaseLock()
		close(done)
		return
	}

	var rec Recording
	if err := json.Unmarshal(data, &rec); err != nil {
		slog.Error("failed to parse recording", "error", err)
		r.releaseLock()
		close(done)
		return
	}

	eventsDir := filepath.Join(runDir, "job_events")
	os.MkdirAll(eventsDir, 0750)

	var totalDuration time.Duration
	if rec.Run.EndedAt != nil {
		totalDuration = rec.Run.EndedAt.Sub(rec.Run.StartedAt)
	}

	var stdoutBuilder strings.Builder
	for _, event := range rec.Events {
		if r.demoSpeed > 0 && totalDuration > 0 && len(rec.Events) > 1 {
			delay := time.Duration(float64(totalDuration) / float64(len(rec.Events)) / r.demoSpeed)
			time.Sleep(delay)
		}

		var meta struct {
			UUID    string `json:"uuid"`
			Counter int    `json:"counter"`
			Stdout  string `json:"stdout"`
		}
		json.Unmarshal(event, &meta)

		filename := fmt.Sprintf("%03d-%s.json", meta.Counter, meta.UUID)
		os.WriteFile(filepath.Join(eventsDir, filename), event, 0640)

		if meta.Stdout != "" {
			stdoutBuilder.WriteString(meta.Stdout)
			stdoutBuilder.WriteString("\n")
			os.WriteFile(filepath.Join(runDir, "stdout"), []byte(stdoutBuilder.String()), 0640)
		}
	}

	os.WriteFile(filepath.Join(runDir, "stdout"), []byte(rec.Stdout), 0640)
	os.WriteFile(filepath.Join(runDir, "stderr"), []byte(rec.Stderr), 0640)
	os.WriteFile(filepath.Join(runDir, "status"), []byte(rec.Status), 0640)
	os.WriteFile(filepath.Join(runDir, "rc"), []byte(fmt.Sprintf("%d", rec.RC)), 0640)

	now := time.Now()
	run.EndedAt = &now
	switch rec.Status {
	case "successful":
		run.Status = models.TaskStatusSuccessful
	default:
		run.Status = models.TaskStatusFailed
	}
	run.ExitCode = &rec.RC
	writeRunJSON(runDir, run)

	slog.Info("demo task completed", "run_id", run.ID, "status", run.Status, "events", len(rec.Events))
	r.releaseLock()
	close(done)
}

func (r *AnsibleRunner) waitForCompletion(cmd *exec.Cmd, run *models.TaskRun, runDir string, done chan struct{}) {
	_ = cmd.Wait()

	now := time.Now()
	run.EndedAt = &now
	duration := now.Sub(run.StartedAt)

	arStatus := readAnsibleRunnerStatus(runDir)
	switch arStatus {
	case "successful":
		run.Status = models.TaskStatusSuccessful
	case "failed":
		run.Status = models.TaskStatusFailed
	default:
		if run.Status != models.TaskStatusCanceled {
			run.Status = models.TaskStatusFailed
		}
	}

	if rc, err := readAnsibleRunnerRC(runDir); err == nil {
		run.ExitCode = &rc
	}

	switch run.Status {
	case models.TaskStatusSuccessful:
		slog.Info("task completed", "run_id", run.ID, "playbook", run.Playbook, "duration", duration)
	default:
		slog.Warn("task did not complete successfully", "run_id", run.ID, "playbook", run.Playbook, "status", run.Status, "duration", duration)
	}

	writeRunJSON(runDir, run)

	r.releaseLock()
	close(done)
}

func (r *AnsibleRunner) Get(id string) (*models.TaskRun, error) {
	return artifactGet(r.artifactsDir, id)
}

func (r *AnsibleRunner) List() ([]models.TaskRun, error) {
	return artifactList(r.artifactsDir)
}

func (r *AnsibleRunner) Logs(id string) ([]byte, error) {
	return artifactLogs(r.artifactsDir, id)
}

func (r *AnsibleRunner) Events(id string) ([]json.RawMessage, error) {
	return artifactEvents(r.artifactsDir, id)
}

func (r *AnsibleRunner) Delete(id string) error {
	r.mu.Lock()
	active := r.activeRun
	r.mu.Unlock()

	if active != nil && active.ID == id {
		return ErrRunning
	}

	runDir := filepath.Join(r.artifactsDir, id)
	if _, err := os.Stat(runDir); os.IsNotExist(err) {
		return ErrNotFound
	}

	if err := os.RemoveAll(runDir); err != nil {
		return err
	}
	slog.Info("task deleted", "run_id", id)
	return nil
}


func (r *AnsibleRunner) Recover() error {
	entries, err := os.ReadDir(r.artifactsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("reading artifacts dir: %w", err)
	}

	recovered := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		runDir := filepath.Join(r.artifactsDir, entry.Name())
		run, err := readRunJSON(runDir)
		if err != nil {
			continue
		}

		if run.Status != models.TaskStatusRunning {
			continue
		}

		slog.Warn("recovering interrupted task", "run_id", run.ID, "playbook", run.Playbook, "pid", run.PID)

		if run.PID > 0 && processAlive(run.PID) {
			syscall.Kill(run.PID, syscall.SIGTERM)
			time.Sleep(5 * time.Second)
			syscall.Kill(run.PID, syscall.SIGKILL)
		}

		now := time.Now()
		run.EndedAt = &now
		arStatus := readAnsibleRunnerStatus(runDir)
		if arStatus == "successful" || arStatus == "failed" {
			run.Status = models.TaskStatus(arStatus)
			if rc, err := readAnsibleRunnerRC(runDir); err == nil {
				run.ExitCode = &rc
			}
		}
		if run.Status == models.TaskStatusRunning {
			run.Status = models.TaskStatusFailed
			run.Error = "recovered after server restart: process no longer running"
		}

		writeRunJSON(runDir, run)
		recovered++
	}

	if recovered > 0 {
		slog.Info("task recovery complete", "recovered", recovered)
	}

	return nil
}

func (r *AnsibleRunner) Shutdown(ctx context.Context) error {
	r.mu.Lock()
	cmd := r.activeCmd
	run := r.activeRun
	done := r.done
	runDir := ""
	if run != nil {
		runDir = filepath.Join(r.artifactsDir, run.ID)
	}
	r.mu.Unlock()

	if cmd == nil || run == nil {
		return nil
	}

	slog.Info("shutting down active task", "run_id", run.ID, "playbook", run.Playbook)

	if cmd.Process != nil {
		syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	}

	select {
	case <-done:
	case <-ctx.Done():
		slog.Warn("task shutdown timed out, force-killing", "run_id", run.ID)
		if cmd.Process != nil {
			syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		<-done
	}

	// waitForCompletion may have already updated the run; override with canceled.
	run.Status = models.TaskStatusCanceled
	now := time.Now()
	run.EndedAt = &now
	run.Error = "server shutdown"
	if runDir != "" {
		writeRunJSON(runDir, run)
	}

	return nil
}

func (r *AnsibleRunner) acquireLock() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.activeRun != nil {
		return ErrBusy
	}

	f, err := os.OpenFile(
		filepath.Join(r.artifactsDir, ".runner.lock"),
		os.O_CREATE|os.O_RDWR, 0640,
	)
	if err != nil {
		return fmt.Errorf("opening lock file: %w", err)
	}

	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return ErrBusy
	}

	r.lockFile = f
	return nil
}

func (r *AnsibleRunner) releaseLock() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.lockFile != nil {
		syscall.Flock(int(r.lockFile.Fd()), syscall.LOCK_UN)
		r.lockFile.Close()
		r.lockFile = nil
	}
	r.activeRun = nil
	r.activeCmd = nil
	r.done = nil
}
