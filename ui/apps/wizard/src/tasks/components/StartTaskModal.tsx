import type { TaskRun } from "@enclave-wizard-ui/api-client";
import { ResponseError } from "@enclave-wizard-ui/api-client";
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
} from "@patternfly/react-core";
import type React from "react";
import { useState } from "react";
import type { TasksApiClient } from "../../api/useTasksApi.ts";

interface StartTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskStarted: (task: TaskRun) => void;
  api: TasksApiClient;
  plugins: string[];
}

type TaskMode = "deploy" | "phase" | "plugin";

export const StartTaskModal: React.FC<StartTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskStarted,
  api,
  plugins,
}) => {
  const [mode, setMode] = useState<TaskMode>("deploy");
  const [phase, setPhase] = useState(1);
  const [pluginName, setPluginName] = useState(plugins[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let task: TaskRun;
      switch (mode) {
        case "deploy":
          task = await api.startDeploy();
          break;
        case "phase":
          task = await api.startDeployPhase(phase);
          break;
        case "plugin":
          task = await api.startDeployPlugin(pluginName);
          break;
      }
      onTaskStarted(task);
      onClose();
    } catch (err) {
      if (err instanceof ResponseError && err.response.status === 409) {
        setError("A task is already running. Please wait for it to complete.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to start task");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="small"
      aria-label="Start a new task"
    >
      <ModalHeader title="Run Task" />
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            title={error}
            isInline
            style={{ marginBottom: "1rem" }}
          />
        )}
        <Form>
          <FormGroup label="Task type" fieldId="task-mode" isRequired>
            <Radio
              id="mode-deploy"
              name="task-mode"
              label="Full deployment (all 7 phases)"
              isChecked={mode === "deploy"}
              onChange={() => setMode("deploy")}
            />
            <Radio
              id="mode-phase"
              name="task-mode"
              label="Single phase"
              isChecked={mode === "phase"}
              onChange={() => setMode("phase")}
            />
            <Radio
              id="mode-plugin"
              name="task-mode"
              label="Deploy plugin"
              isChecked={mode === "plugin"}
              onChange={() => setMode("plugin")}
              isDisabled={plugins.length === 0}
            />
          </FormGroup>

          {mode === "phase" && (
            <FormGroup label="Phase" fieldId="phase-select">
              <FormSelect
                id="phase-select"
                value={phase}
                onChange={(_e, val) => setPhase(Number(val))}
              >
                <FormSelectOption value={1} label="Phase 1 — Prepare" />
                <FormSelectOption value={2} label="Phase 2 — Mirror" />
                <FormSelectOption value={3} label="Phase 3 — Deploy" />
                <FormSelectOption value={4} label="Phase 4 — Post-install" />
                <FormSelectOption value={5} label="Phase 5 — Operators" />
                <FormSelectOption value={6} label="Phase 6 — Day 2" />
                <FormSelectOption
                  value={7}
                  label="Phase 7 — Configure Discovery"
                />
              </FormSelect>
            </FormGroup>
          )}

          {mode === "plugin" && plugins.length > 0 && (
            <FormGroup label="Plugin" fieldId="plugin-select">
              <FormSelect
                id="plugin-select"
                value={pluginName}
                onChange={(_e, val) => setPluginName(val)}
              >
                {plugins.map((p) => (
                  <FormSelectOption key={p} value={p} label={p} />
                ))}
              </FormSelect>
            </FormGroup>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isDisabled={submitting}
          isLoading={submitting}
        >
          {submitting ? "Starting..." : "Start"}
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={submitting}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
