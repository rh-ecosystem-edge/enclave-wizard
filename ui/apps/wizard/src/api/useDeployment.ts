import type { EnclaveConfig, TaskRun } from "@enclave-wizard-ui/api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { useEnclaveApi } from "./useEnclaveApi.ts";
import { useTasksApi } from "./useTasksApi.ts";

export interface DeploymentError {
  message: string;
  details: string[];
}

export type DeployPhase =
  | "idle"
  | "writing"
  | "deploying"
  | "complete"
  | "failed"
  | "error";

export interface DeploymentProgress {
  percentage: number;
  currentTask: string;
}

export interface DeploymentState {
  phase: DeployPhase;
  deploymentId: string | null;
  taskId: string | null;
  task: TaskRun | null;
  progress: DeploymentProgress | null;
  logs: string;
  error: DeploymentError | null;
}

export interface UseDeploymentReturn {
  state: DeploymentState;
  start: (config: EnclaveConfig) => Promise<void>;
  cancel: () => Promise<void>;
}

const INITIAL_STATE: DeploymentState = {
  phase: "idle",
  deploymentId: null,
  taskId: null,
  task: null,
  progress: null,
  logs: "",
  error: null,
};

/** Try a fetch with auth; return the Response on success, null on 404. Throws on other errors. */
async function fetchWithFallback(
  url: string,
  token: string | null,
  init?: RequestInit,
): Promise<Response | null> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { ...init, headers });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp;
}

async function extractErrorDetails(err: unknown): Promise<DeploymentError> {
  const details: string[] = [];
  if (err && typeof err === "object" && "response" in err) {
    try {
      const body = await (err as { response: Response }).response.json();
      if (body.errors && Array.isArray(body.errors)) {
        for (const e of body.errors) {
          const field = e.field ? `${e.field}: ` : "";
          details.push(`${field}${e.message ?? String(e)}`);
        }
      } else if (body.detail) {
        details.push(body.detail);
      }
    } catch {
      // response not JSON
    }
  }
  return {
    message:
      details.length > 0
        ? "Configuration validation failed"
        : err instanceof Error
          ? err.message
          : "Failed to start deployment",
    details,
  };
}

export function useDeployment(): UseDeploymentReturn {
  const { token } = useAuth();
  const api = useEnclaveApi();
  const tasksApi = useTasksApi();
  const [state, setState] = useState<DeploymentState>(INITIAL_STATE);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const reconnectedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollDeployment = useCallback(
    (deploymentId: string | null, taskId: string) => {
      stopPolling();

      const tick = async () => {
        if (!mountedRef.current) return;

        try {
          const currentToken = tokenRef.current;

          // Always get task metadata (status, startedAt, etc.)
          const task = await tasksApi.getTask(taskId);

          // Fetch progress
          let progress: DeploymentProgress | null = null;
          if (deploymentId) {
            try {
              const resp = await fetchWithFallback(
                `/api/v1/deployments/${deploymentId}/progress`,
                currentToken,
              );
              if (resp) {
                const body = await resp.json();
                progress = {
                  percentage: body.percentage ?? 0,
                  currentTask: body.currentTask ?? "",
                };
              }
            } catch {
              // progress not available
            }
          }

          // Fetch logs
          let logs = "";
          try {
            logs = await tasksApi.getTaskLogs(taskId);
          } catch {
            // logs may not be available yet
          }

          if (!mountedRef.current) return;

          const isRunning = task.status === "running";
          const isFailed = task.status === "failed";
          const phase: DeployPhase = isRunning
            ? "deploying"
            : isFailed
              ? "failed"
              : "complete";

          setState((prev) => ({
            ...prev,
            phase,
            task,
            progress: isRunning
              ? progress
              : isFailed
                ? progress
                : { percentage: 100, currentTask: "" },
            logs,
            error: task?.error
              ? { message: task.error, details: [] }
              : prev.error,
          }));

          if (!isRunning) {
            stopPolling();
          }
        } catch {
          // Polling errors are transient; keep trying
        }
      };

      tick();
      pollRef.current = setInterval(tick, 3000);
    },
    [tasksApi, stopPolling],
  );

  const start = useCallback(
    async (config: EnclaveConfig) => {
      setState({
        ...INITIAL_STATE,
        phase: "writing",
      });

      try {
        // Write config
        await api.writeConfig(config);

        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, phase: "deploying" }));

        // Try new deployment endpoint first
        let deploymentId: string | null = null;
        let taskId: string | null = null;

        const resp = await fetchWithFallback(
          "/api/v1/deployments",
          tokenRef.current,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        if (resp) {
          const body = await resp.json();
          deploymentId = body.id ?? null;
          taskId = body.taskId ?? body.id ?? null;
        }

        // Fall back to old endpoint
        if (!taskId) {
          const task = await tasksApi.startDeploy();
          taskId = task.id;
        }

        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          deploymentId,
          taskId,
        }));

        pollDeployment(deploymentId, taskId);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const error = await extractErrorDetails(err);
        setState((prev) => ({
          ...prev,
          phase: "error",
          error,
        }));
      }
    },
    [api, tasksApi, pollDeployment],
  );

  const cancel = useCallback(async () => {
    const { deploymentId, taskId } = state;
    stopPolling();

    try {
      if (deploymentId) {
        const resp = await fetchWithFallback(
          `/api/v1/deployments/${deploymentId}`,
          tokenRef.current,
          { method: "DELETE" },
        );
        if (resp) {
          setState(INITIAL_STATE);
          return;
        }
      }

      // Fall back: delete the task via old API
      if (taskId) {
        await tasksApi.deleteTask(taskId);
      }

      setState(INITIAL_STATE);
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: {
          message:
            err instanceof Error ? err.message : "Failed to cancel deployment",
          details: [],
        },
      }));
    }
  }, [state, tasksApi, stopPolling]);

  // Reconnect to an in-progress deployment on mount (runs once after auth)
  useEffect(() => {
    if (!token || reconnectedRef.current) return;
    reconnectedRef.current = true;

    const reconnect = async () => {
      try {
        const resp = await fetchWithFallback(
          "/api/v1/deployments/current",
          tokenRef.current,
        );
        if (resp) {
          const body = await resp.json();
          const deploymentId = body.id ?? null;
          const taskId = body.taskId ?? body.id ?? null;
          if (taskId) {
            setState((prev) => ({
              ...prev,
              phase: "deploying",
              deploymentId,
              taskId,
            }));
            pollDeployment(deploymentId, taskId);
          }
          return;
        }
      } catch {
        // New endpoint not available
      }

      try {
        const resp = await fetch("/api/v1/deployment", {
          headers: tokenRef.current
            ? { Authorization: `Bearer ${tokenRef.current}` }
            : {},
        });
        if (resp.ok) {
          const body = await resp.json();
          if (body.taskId && body.status === "running") {
            setState((prev) => ({
              ...prev,
              phase: "deploying",
              taskId: body.taskId,
            }));
            pollDeployment(null, body.taskId);
          }
        }
      } catch {
        // No active deployment
      }
    };

    reconnect();
  }, [token, pollDeployment]);

  return useMemo(() => ({ state, start, cancel }), [state, start, cancel]);
}
