import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeployment } from "./useDeployment.ts";

vi.mock("../auth/AuthContext.tsx", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

// Mock useEnclaveApi
const mockWriteConfig = vi.fn();
vi.mock("./useEnclaveApi.ts", () => ({
  useEnclaveApi: () => ({
    writeConfig: mockWriteConfig,
  }),
}));

// Mock useTasksApi
const mockStartDeploy = vi.fn();
const mockGetTask = vi.fn();
const mockGetTaskLogs = vi.fn();
const mockDeleteTask = vi.fn();
vi.mock("./useTasksApi.ts", () => ({
  useTasksApi: () => ({
    startDeploy: mockStartDeploy,
    getTask: mockGetTask,
    getTaskLogs: mockGetTaskLogs,
    deleteTask: mockDeleteTask,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();

describe("useDeployment", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));
    mockWriteConfig.mockResolvedValue(undefined);
    mockStartDeploy.mockResolvedValue({ id: "task-123" });
    mockGetTask.mockResolvedValue({
      id: "task-123",
      status: "running",
      startedAt: new Date(),
    });
    mockGetTaskLogs.mockResolvedValue("log line 1\nlog line 2");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts in idle phase", () => {
    const { result } = renderHook(() => useDeployment());
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.taskId).toBeNull();
    expect(result.current.state.deploymentId).toBeNull();
  });

  it("transitions through writing → deploying on start", async () => {
    // Make writeConfig wait so we can observe the "writing" phase
    let resolveWrite: () => void = () => {};
    mockWriteConfig.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const { result } = renderHook(() => useDeployment());

    // Start deployment (non-awaiting to observe intermediate state)
    let startPromise: Promise<void> | undefined;
    act(() => {
      startPromise = result.current.start({} as never);
    });

    // While writeConfig is pending, phase should be "writing"
    await waitFor(() => {
      expect(result.current.state.phase).toBe("writing");
    });

    if (!startPromise) {
      throw new Error("deployment start did not return a promise");
    }
    const pendingStart = startPromise;

    // Resolve writeConfig and let deployment proceed
    await act(async () => {
      resolveWrite();
      await pendingStart;
    });

    expect(result.current.state.phase).toBe("deploying");
    expect(result.current.state.taskId).toBe("task-123");
    expect(mockWriteConfig).toHaveBeenCalled();
  });

  it("falls back to old startDeploy when new endpoint returns 404", async () => {
    // New endpoint returns 404
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    expect(mockStartDeploy).toHaveBeenCalled();
    expect(result.current.state.taskId).toBe("task-123");
  });

  it("uses new deployment endpoint when available", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/deployments" && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: "deploy-1", taskId: "task-new" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url === "/api/v1/deployments/current") {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    expect(mockStartDeploy).not.toHaveBeenCalled();
    expect(result.current.state.deploymentId).toBe("deploy-1");
    expect(result.current.state.taskId).toBe("task-new");
  });

  it("sets error phase when writeConfig fails", async () => {
    mockWriteConfig.mockRejectedValue(new Error("Write failed"));

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error?.message).toBe("Write failed");
  });

  it("cancel calls DELETE on new deployment endpoint", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/deployments" && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: "deploy-1", taskId: "task-1" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url === "/api/v1/deployments/deploy-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      if (url === "/api/v1/deployments/current") {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    expect(result.current.state.phase).toBe("deploying");

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.state.phase).toBe("idle");
  });

  it("cancel falls back to deleteTask when new endpoint returns 404", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockDeleteTask).toHaveBeenCalledWith("task-123");
    expect(result.current.state.phase).toBe("idle");
  });

  it("polls task status and transitions to complete", async () => {
    let pollCount = 0;
    mockGetTask.mockImplementation(() => {
      pollCount++;
      if (pollCount >= 2) {
        return Promise.resolve({
          id: "task-123",
          status: "completed",
          startedAt: new Date(),
          endedAt: new Date(),
        });
      }
      return Promise.resolve({
        id: "task-123",
        status: "running",
        startedAt: new Date(),
      });
    });

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    // First poll returns running
    expect(result.current.state.phase).toBe("deploying");

    // Advance timer to trigger next poll
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe("complete");
    });
  });

  it("polls task status and transitions to failed", async () => {
    let pollCount = 0;
    mockGetTask.mockImplementation(() => {
      pollCount++;
      if (pollCount >= 2) {
        return Promise.resolve({
          id: "task-123",
          status: "failed",
          error: "Playbook failed",
          startedAt: new Date(),
          endedAt: new Date(),
        });
      }
      return Promise.resolve({
        id: "task-123",
        status: "running",
        startedAt: new Date(),
      });
    });

    const { result } = renderHook(() => useDeployment());

    await act(async () => {
      await result.current.start({} as never);
    });

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe("failed");
      expect(result.current.state.error?.message).toBe("Playbook failed");
    });
  });
});
