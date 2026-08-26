package runner

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

// --- Interface compliance tests ---

// Verify all implementations satisfy the Runner interface at compile time.
var (
	_ Runner = (*AnsibleRunner)(nil)
	_ Runner = (*ReplayRunner)(nil)
	_ Runner = (*RecordingRunner)(nil)
)

// --- Shared test helpers ---

func skipIfNoAnsibleRunner(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("ansible-runner"); err != nil {
		t.Skip("ansible-runner not in PATH")
	}
}

// newTestProject creates a minimal ansible-runner private data directory in a
// temp dir. The project/ subdirectory contains several test playbooks.
func newTestProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}

	must(os.MkdirAll(filepath.Join(dir, "project"), 0755))
	must(os.MkdirAll(filepath.Join(dir, "inventory"), 0755))

	must(os.WriteFile(filepath.Join(dir, "inventory", "hosts"),
		[]byte("[all]\nlocalhost ansible_connection=local\n"), 0644))

	must(os.WriteFile(filepath.Join(dir, "ansible.cfg"),
		[]byte("[defaults]\nhost_key_checking = False\n"), 0644))

	must(os.WriteFile(filepath.Join(dir, "project", "success.yaml"), []byte(`---
- name: Success
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Print message
      ansible.builtin.debug:
        msg: "hello from test"
`), 0644))

	must(os.WriteFile(filepath.Join(dir, "project", "fail.yaml"), []byte(`---
- name: Failure
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Fail task
      ansible.builtin.fail:
        msg: "intentional failure"
`), 0644))

	must(os.WriteFile(filepath.Join(dir, "project", "echo_var.yaml"), []byte(`---
- name: Echo variable
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Fail if var is unset
      ansible.builtin.fail:
        msg: "my_var was not passed"
      when: my_var is not defined
    - name: Print var
      ansible.builtin.debug:
        msg: "value={{ my_var }}"
`), 0644))

	must(os.WriteFile(filepath.Join(dir, "project", "slow.yaml"), []byte(`---
- name: Slow
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Wait
      ansible.builtin.command: sleep 30
`), 0644))

	return dir
}

// newRunner creates an AnsibleRunner and registers Shutdown as test cleanup.
func newRunner(t *testing.T, dir string) *AnsibleRunner {
	t.Helper()
	skipIfNoAnsibleRunner(t)
	r, err := NewAnsibleRunner(dir, "")
	if err != nil {
		t.Fatalf("NewAnsibleRunner: %v", err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		r.Shutdown(ctx) //nolint:errcheck
	})
	return r
}

// pollRun polls Get until the run leaves "running" status.
func pollRun(t *testing.T, r Runner, id string, timeout time.Duration) *models.TaskRun {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		run, err := r.Get(id)
		if err != nil {
			t.Fatalf("Get(%q): %v", id, err)
		}
		if run.Status != models.TaskStatusRunning {
			return run
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("run %q did not finish within %v", id, timeout)
	return nil
}

// seedRun writes a fake run.json into the runner's artifacts directory.
func seedRun(t *testing.T, artifactsDir string, run *models.TaskRun) string {
	t.Helper()
	runDir := filepath.Join(artifactsDir, run.ID)
	if err := os.MkdirAll(runDir, 0750); err != nil {
		t.Fatalf("mkdir %s: %v", runDir, err)
	}
	if err := writeRunJSON(runDir, run); err != nil {
		t.Fatalf("writeRunJSON: %v", err)
	}
	return runDir
}

// createTestRecording writes a minimal recording JSON file for replay tests.
func createTestRecording(t *testing.T, dir, key string, status string, eventCount int) string {
	t.Helper()

	now := time.Now()
	ended := now.Add(time.Duration(eventCount) * time.Second)
	rc := 0
	if status != "successful" {
		rc = 1
	}

	var events []json.RawMessage
	for i := 1; i <= eventCount; i++ {
		ev := map[string]any{
			"uuid":    generateRunID(),
			"counter": i,
			"event":   "runner_on_ok",
			"stdout":  "task " + string(rune('0'+i)) + " output",
		}
		data, _ := json.Marshal(ev)
		events = append(events, data)
	}

	rec := Recording{
		Run: models.TaskRun{
			ID:        "rec-" + key,
			Type:      models.TaskTypeDeploy,
			Status:    models.TaskStatus(status),
			Playbook:  "success.yaml",
			StartedAt: now,
			EndedAt:   &ended,
			ExitCode:  &rc,
		},
		RC:     rc,
		Status: status,
		Stdout: "test stdout",
		Stderr: "",
		Events: events,
	}

	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		t.Fatalf("marshaling recording: %v", err)
	}

	path := filepath.Join(dir, key+".json")
	if err := os.WriteFile(path, data, 0640); err != nil {
		t.Fatalf("writing recording: %v", err)
	}
	return path
}
