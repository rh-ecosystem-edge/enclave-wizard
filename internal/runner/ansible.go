package runner

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

// AnsibleRunner executes ansible-runner subprocesses. It enforces single-task
// execution through a mutex combined with an advisory file lock.
type AnsibleRunner struct {
	enclaveDir       string
	artifactsDir     string
	binDir           string // extra directory prepended to PATH when resolving/running ansible-runner
	ansibleRunnerBin string // resolved absolute path to the ansible-runner binary

	mu       sync.Mutex
	lockFile *os.File

	activeRun *models.TaskRun
	activeCmd *exec.Cmd
	done      chan struct{} // closed by waitForCompletion when the process exits
}

// pathWithBinDir prepends binDir (if set and not already present) to the given PATH.
func pathWithBinDir(binDir, currentPath string) string {
	if binDir == "" || strings.Contains(currentPath, binDir) {
		return currentPath
	}
	return binDir + ":" + currentPath
}

// resolveBinary returns the absolute path to name, preferring binDir over the
// process's own PATH. exec.Command resolves bare command names using the
// current process's PATH at construction time — not cmd.Env — so callers
// that want a subprocess to find a binary via a custom bin dir must resolve
// the absolute path themselves and pass that to exec.Command instead of the
// bare name.
func resolveBinary(name, binDir string) (string, error) {
	if binDir != "" {
		candidate := filepath.Join(binDir, name)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return exec.LookPath(name)
}

// NewAnsibleRunner creates a runner that executes real ansible-runner subprocesses.
// binDir, if non-empty, is prepended to PATH when locating and running ansible-runner,
// so deployments can point at wherever ansible-runner was installed without relying
// on the invoking user's own PATH/HOME.
func NewAnsibleRunner(enclaveDir, binDir string) (*AnsibleRunner, error) {
	absDir, err := filepath.Abs(enclaveDir)
	if err != nil {
		return nil, fmt.Errorf("resolving enclave directory: %w", err)
	}
	if _, err := os.Stat(absDir); err != nil {
		return nil, fmt.Errorf("enclave directory: %w", err)
	}

	uvBinDir := filepath.Join(absDir, ".local", "bin")
	ansibleRunnerBin, err := resolveBinary("ansible-runner", binDir)
	if err != nil {
		ansibleRunnerBin, err = resolveBinary("ansible-runner", uvBinDir)
		if err != nil {
			return nil, ErrRunnerBin
		}
	}

	artifactsDir := filepath.Join(absDir, "artifacts")
	if err := os.MkdirAll(artifactsDir, 0750); err != nil {
		return nil, fmt.Errorf("creating artifacts directory: %w", err)
	}

	return &AnsibleRunner{
		enclaveDir:       absDir,
		artifactsDir:     artifactsDir,
		binDir:           binDir,
		ansibleRunnerBin: ansibleRunnerBin,
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

	cmd := exec.Command(r.ansibleRunnerBin, args...)
	cmd.Dir = r.enclaveDir

	uvBinDir := filepath.Join(r.enclaveDir, ".local", "bin")
	currentPath := pathWithBinDir(uvBinDir, os.Getenv("PATH"))
	currentPath = pathWithBinDir(r.binDir, currentPath)
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

	slog.Info("task started", "run_id", runID, "type", req.Type, "playbook", req.Playbook, "pid", run.PID, "cmd", cmd.String(), "dir", cmd.Dir)

	runCopy := *run

	done := make(chan struct{})
	r.mu.Lock()
	r.activeRun = run
	r.activeCmd = cmd
	r.done = done
	r.mu.Unlock()

	go r.waitForCompletion(cmd, run, runDir, done)

	return &runCopy, done, nil
}

func (r *AnsibleRunner) waitForCompletion(cmd *exec.Cmd, run *models.TaskRun, runDir string, done chan struct{}) {
	waitErr := cmd.Wait()

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

	stderrBytes, _ := os.ReadFile(filepath.Join(runDir, "stderr"))

	switch run.Status {
	case models.TaskStatusSuccessful:
		slog.Info("task completed", "run_id", run.ID, "playbook", run.Playbook, "duration", duration)
	default:
		slog.Warn("task did not complete successfully",
			"run_id", run.ID, "playbook", run.Playbook,
			"status", run.Status, "ar_status", arStatus,
			"exit_code", run.ExitCode, "duration", duration,
			"wait_err", waitErr, "stderr", string(stderrBytes))
	}

	writeRunJSON(runDir, run)

	r.releaseLock()
	close(done)
}

// Cancel terminates a running task by ID. It sends SIGTERM to the process
// group, waits up to 10 seconds for graceful exit, then sends SIGKILL.
func (r *AnsibleRunner) Cancel(id string) error {
	r.mu.Lock()
	if r.activeRun == nil || r.activeRun.ID != id {
		r.mu.Unlock()
		return ErrNotFound
	}
	cmd := r.activeCmd
	run := r.activeRun
	done := r.done
	runDir := filepath.Join(r.artifactsDir, id)
	r.mu.Unlock()

	slog.Info("canceling task", "run_id", id)

	if cmd != nil && cmd.Process != nil {
		syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	}

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		slog.Warn("task did not terminate after SIGTERM, sending SIGKILL", "run_id", id)
		if cmd != nil && cmd.Process != nil {
			syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		<-done
	}

	// waitForCompletion may have already written status; override with canceled.
	run.Status = models.TaskStatusCanceled
	now := time.Now()
	run.EndedAt = &now
	writeRunJSON(runDir, run)

	return nil
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

// Stream returns a channel that emits structured events for a running task.
// The channel is closed when the task completes. For completed tasks, all
// events are emitted immediately.
func (r *AnsibleRunner) Stream(id string) (<-chan Event, error) {
	runDir := filepath.Join(r.artifactsDir, id)
	if _, err := readRunJSON(runDir); err != nil {
		return nil, ErrNotFound
	}

	ch := make(chan Event, 64)

	r.mu.Lock()
	isActive := r.activeRun != nil && r.activeRun.ID == id
	var done <-chan struct{}
	if isActive {
		done = r.done
	}
	r.mu.Unlock()

	go r.streamEvents(runDir, ch, done)

	return ch, nil
}

func (r *AnsibleRunner) streamEvents(runDir string, ch chan<- Event, done <-chan struct{}) {
	defer close(ch)

	eventsDir := filepath.Join(runDir, "job_events")
	emitted := 0

	for {
		entries, _ := os.ReadDir(eventsDir)
		sortEventEntries(entries)

		var jsonEntries []os.DirEntry
		for _, e := range entries {
			if strings.HasSuffix(e.Name(), ".json") {
				jsonEntries = append(jsonEntries, e)
			}
		}

		for i := emitted; i < len(jsonEntries); i++ {
			data, err := os.ReadFile(filepath.Join(eventsDir, jsonEntries[i].Name()))
			if err != nil {
				continue
			}
			ch <- Event{Type: "log", Data: json.RawMessage(data)}
			emitted++
		}

		// If no active done channel, this task is already completed.
		if done == nil {
			return
		}

		select {
		case <-done:
			// Emit any remaining events after completion.
			remaining, _ := os.ReadDir(eventsDir)
			sortEventEntries(remaining)
			var jsonRemaining []os.DirEntry
			for _, e := range remaining {
				if strings.HasSuffix(e.Name(), ".json") {
					jsonRemaining = append(jsonRemaining, e)
				}
			}
			for i := emitted; i < len(jsonRemaining); i++ {
				data, err := os.ReadFile(filepath.Join(eventsDir, jsonRemaining[i].Name()))
				if err != nil {
					continue
				}
				ch <- Event{Type: "log", Data: json.RawMessage(data)}
			}
			return
		case <-time.After(250 * time.Millisecond):
			// Poll for new events.
		}
	}
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
