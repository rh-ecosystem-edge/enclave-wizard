package models

import "time"

type TaskStatus string

const (
	TaskStatusRunning    TaskStatus = "running"
	TaskStatusSuccessful TaskStatus = "successful"
	TaskStatusFailed     TaskStatus = "failed"
	TaskStatusCanceled   TaskStatus = "canceled"
)

type TaskType string

const (
	TaskTypeDeploy        TaskType = "deploy"
	TaskTypeDeployPhase   TaskType = "deploy-phase"
	TaskTypeDeployPlugin  TaskType = "deploy-plugin"
	TaskTypeValidate      TaskType = "validate"
	TaskTypeApplyTopology TaskType = "apply-topology"
)

type TaskRun struct {
	ID        string            `json:"id" doc:"Unique run identifier"`
	Type      TaskType          `json:"type" doc:"Type of task" enum:"deploy,deploy-phase,deploy-plugin,validate,apply-topology"`
	Status    TaskStatus        `json:"status" doc:"Current execution status" enum:"running,successful,failed,canceled"`
	Playbook  string            `json:"playbook" doc:"Playbook path relative to enclave directory"`
	ExtraVars map[string]string `json:"extraVars,omitempty" doc:"Extra variables passed to ansible-runner"`
	PID       int               `json:"pid,omitempty" doc:"OS process ID of ansible-runner"`
	ExitCode  *int              `json:"exitCode,omitempty" doc:"Process exit code"`
	StartedAt time.Time          `json:"startedAt" doc:"When ansible-runner started"`
	EndedAt   *time.Time        `json:"endedAt,omitempty" doc:"When the run completed"`
	Error     string            `json:"error,omitempty" doc:"Error message if failed"`
}
