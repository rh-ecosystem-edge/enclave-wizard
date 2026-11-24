import type { TaskRun } from "@enclave-wizard-ui/api-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeploymentState } from "../../api/useDeployment.ts";
import { DeployStep } from "./DeployStep.tsx";

const mockStart = vi.fn();
const mockCancel = vi.fn();

function taskRun(partial: Partial<TaskRun> & Pick<TaskRun, "status">): TaskRun {
  return {
    id: "task-1",
    playbook: "deploy.yml",
    type: "deploy",
    startedAt: new Date(),
    ...partial,
  };
}

let mockDeploymentState: DeploymentState = {
  phase: "idle",
  progress: null,
  logs: "",
  error: null,
  deploymentId: null,
  taskId: null,
  task: null,
};

vi.mock("../../api/useDeployment.ts", () => ({
  useDeployment: () => ({
    state: mockDeploymentState,
    start: mockStart,
    cancel: mockCancel,
  }),
}));

vi.mock("../WizardContext.tsx", () => ({
  useWizard: () => ({
    state: {
      currentStep: 0,
      selectedFlavors: new Set(),
      configData: {},
      validationErrors: [],
      showValidation: false,
      schema: null,
      plugins: [],
    },
  }),
}));

vi.mock("../buildFinalConfig.ts", () => ({
  buildFinalConfig: (state: unknown) => state,
}));

describe("DeployStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeploymentState = {
      phase: "idle",
      progress: null,
      logs: "",
      error: null,
      deploymentId: null,
      taskId: null,
      task: null,
    };
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows deploy button in idle state", () => {
    render(<DeployStep />);
    expect(screen.getByRole("button", { name: "Deploy" })).toBeInTheDocument();
  });

  it("calls start on deploy button click", async () => {
    mockStart.mockResolvedValue(undefined);

    render(<DeployStep />);
    await userEvent.click(screen.getByRole("button", { name: "Deploy" }));

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("shows writing state", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "writing",
    };

    render(<DeployStep />);
    expect(screen.getByText("Writing configuration...")).toBeInTheDocument();
  });

  it("shows error state with message", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "error",
      error: { message: "deploy failed", details: [] },
    };

    render(<DeployStep />);
    expect(screen.getByText("deploy failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy" })).toBeInTheDocument();
  });

  it("shows error state with validation details", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "error",
      error: {
        message: "Configuration validation failed",
        details: ["field X is required", "field Y is invalid"],
      },
    };

    render(<DeployStep />);
    expect(screen.getByText("field X is required")).toBeInTheDocument();
    expect(screen.getByText("field Y is invalid")).toBeInTheDocument();
  });

  it("shows deploying state with output heading", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "deploying",
      taskId: "task-1",
      task: taskRun({ status: "running" }),
    };

    render(<DeployStep />);
    expect(screen.getByText("Deployment")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Waiting for output...")).toBeInTheDocument();
  });

  it("shows cancel button when deploying", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "deploying",
      taskId: "task-1",
      task: taskRun({ status: "running" }),
    };

    render(<DeployStep />);
    expect(screen.getByTestId("cancel-deploy")).toBeInTheDocument();
  });

  it("shows completed state", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "complete",
      taskId: "task-1",
      task: taskRun({
        status: "successful",
        endedAt: new Date(),
        exitCode: 0,
      }),
    };

    render(<DeployStep />);
    expect(screen.getByText("Deployment")).toBeInTheDocument();
    expect(screen.queryByTestId("cancel-deploy")).not.toBeInTheDocument();
  });

  it("shows failed state", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "failed",
      taskId: "task-1",
      task: taskRun({
        status: "failed",
        endedAt: new Date(),
        exitCode: 1,
      }),
    };

    render(<DeployStep />);
    expect(screen.getByText("Deployment")).toBeInTheDocument();
  });

  it("renders logs when available", () => {
    mockDeploymentState = {
      ...mockDeploymentState,
      phase: "deploying",
      taskId: "task-1",
      task: taskRun({ status: "running" }),
      logs: "PLAY [Setup]\nTASK [install] ok",
    };

    render(<DeployStep />);
    expect(screen.getByText("Output")).toBeInTheDocument();
  });
});
