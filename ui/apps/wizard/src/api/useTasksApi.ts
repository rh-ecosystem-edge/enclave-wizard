import type {
  GetTaskEventsOutputBody,
  ListTasksOutputBody,
  TaskRun,
  TasksApiInterface,
} from "@enclave-wizard-ui/api-client";
import { useInjection } from "@y0n1/react-ioc";
import { useCallback } from "react";
import { Symbols } from "../main/Symbols.ts";

export interface TasksApiClient {
  listTasks: () => Promise<ListTasksOutputBody>;
  getTask: (id: string) => Promise<TaskRun>;
  getTaskLogs: (id: string) => Promise<string>;
  getTaskEvents: (id: string) => Promise<GetTaskEventsOutputBody>;
  startDeploy: () => Promise<TaskRun>;
  startDeployPhase: (phase: number) => Promise<TaskRun>;
  startDeployPlugin: (name: string) => Promise<TaskRun>;
  deleteTask: (id: string) => Promise<void>;
}

export function useTasksApi(): TasksApiClient {
  const tasksApi = useInjection<TasksApiInterface>(Symbols.TasksApi);

  const listTasks = useCallback(() => tasksApi.listTasks(), [tasksApi]);

  const getTask = useCallback(
    (id: string) => tasksApi.getTask({ id }),
    [tasksApi],
  );

  const getTaskLogs = useCallback(
    (id: string) => tasksApi.getTaskLogs({ id }),
    [tasksApi],
  );

  const getTaskEvents = useCallback(
    (id: string) => tasksApi.getTaskEvents({ id }),
    [tasksApi],
  );

  const startDeploy = useCallback(() => tasksApi.startDeploy(), [tasksApi]);

  const startDeployPhase = useCallback(
    (phase: number) => tasksApi.startDeployPhase({ phase }),
    [tasksApi],
  );

  const startDeployPlugin = useCallback(
    (name: string) => tasksApi.startDeployPlugin({ name }),
    [tasksApi],
  );

  const deleteTask = useCallback(
    (id: string) => tasksApi.deleteTask({ id }),
    [tasksApi],
  );

  return {
    listTasks,
    getTask,
    getTaskLogs,
    getTaskEvents,
    startDeploy,
    startDeployPhase,
    startDeployPlugin,
    deleteTask,
  };
}
