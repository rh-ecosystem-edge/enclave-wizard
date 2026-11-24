import type { TaskRun } from "@enclave-wizard-ui/api-client";
import {
  Alert,
  AlertActionCloseButton,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  MenuToggle,
  type MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { CogIcon, CubesIcon } from "@patternfly/react-icons";
import {
  ActionsColumn,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import { AnsiUp } from "ansi_up";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useEnclaveApi } from "../api/useEnclaveApi.ts";
import { useTasksApi } from "../api/useTasksApi.ts";
import { RedHatLogo } from "../common/components/RedHatLogo.tsx";
import { StartTaskModal } from "./components/StartTaskModal.tsx";
import { TaskStatusLabel } from "./components/TaskStatusLabel.tsx";
import { TaskTypeLabel } from "./components/TaskTypeLabel.tsx";
import { usePolling } from "./hooks/usePolling.ts";
import { tasksStyles as styles } from "./tasksStyles.ts";

function formatDuration(start?: Date | null, end?: Date | null): string {
  if (!start) return "—";
  const endTime = end ?? new Date();
  const ms = endTime.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(date?: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString();
}

// --- Task Detail (inline) ---

function TaskDetail({
  taskId,
  onBack,
}: {
  taskId: string;
  onBack: () => void;
}): React.ReactElement {
  const api = useTasksApi();

  const [taskDone, setTaskDone] = useState(false);

  const fetchTask = useCallback(() => api.getTask(taskId), [api, taskId]);
  const {
    data: task,
    error: taskError,
    loading: taskLoading,
  } = usePolling(fetchTask, 3000, !taskDone);

  const isRunning = task?.status === "running";

  useEffect(() => {
    if (task != null && !isRunning) {
      setTaskDone(true);
    }
  }, [task, isRunning]);

  const fetchLogs = useCallback(() => api.getTaskLogs(taskId), [api, taskId]);
  const { data: logs } = usePolling(fetchLogs, 2000, !taskDone);

  const ansiUp = useMemo(() => {
    const instance = new AnsiUp();
    instance.use_classes = false;
    return instance;
  }, []);

  const logsHtml = useMemo(() => {
    if (!logs) return "";
    return ansiUp.ansi_to_html(logs);
  }, [logs, ansiUp]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (follow && isRunning && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // logs is not read above; it retriggers follow-scroll when output grows.
    void logs;
  }, [logs, follow, isRunning]);

  if (taskLoading && !task) {
    return <Spinner aria-label="Loading task..." />;
  }

  if (taskError) {
    return (
      <Alert variant="danger" title="Failed to load task">
        {taskError.message}
      </Alert>
    );
  }

  if (!task) return <Spinner aria-label="Loading..." />;

  return (
    <Stack hasGutter>
      <StackItem>
        <Breadcrumb>
          <BreadcrumbItem>
            <Button variant="link" isInline onClick={onBack}>
              Tasks
            </Button>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{task.id.substring(0, 8)}...</BreadcrumbItem>
        </Breadcrumb>
      </StackItem>

      <StackItem>
        <DescriptionList isHorizontal>
          <DescriptionListGroup>
            <DescriptionListTerm>Status</DescriptionListTerm>
            <DescriptionListDescription>
              <TaskStatusLabel status={task.status} />
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Type</DescriptionListTerm>
            <DescriptionListDescription>
              <TaskTypeLabel type={task.type} />
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Playbook</DescriptionListTerm>
            <DescriptionListDescription>
              {task.playbook}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Started</DescriptionListTerm>
            <DescriptionListDescription>
              {formatTimestamp(task.startedAt)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Ended</DescriptionListTerm>
            <DescriptionListDescription>
              {formatTimestamp(task.endedAt)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Duration</DescriptionListTerm>
            <DescriptionListDescription>
              {formatDuration(task.startedAt, task.endedAt)}
              {isRunning && (
                <Spinner size="sm" style={{ marginLeft: "0.5rem" }} />
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
          {task.exitCode != null && (
            <DescriptionListGroup>
              <DescriptionListTerm>Exit Code</DescriptionListTerm>
              <DescriptionListDescription>
                {task.exitCode}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {task.extraVars && Object.keys(task.extraVars).length > 0 && (
            <DescriptionListGroup>
              <DescriptionListTerm>Extra Vars</DescriptionListTerm>
              <DescriptionListDescription>
                {Object.entries(task.extraVars)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>
      </StackItem>

      {task.error && (
        <StackItem>
          <Alert variant="danger" title="Error" isInline>
            {task.error}
          </Alert>
        </StackItem>
      )}

      <StackItem>
        <Split hasGutter>
          <SplitItem isFilled>
            <Title headingLevel="h3" size="md">
              Output
            </Title>
          </SplitItem>
          {isRunning && (
            <SplitItem>
              <Button
                variant="link"
                isInline
                onClick={() => setFollow((f) => !f)}
              >
                {follow ? "Unfollow" : "Follow"}
              </Button>
            </SplitItem>
          )}
        </Split>
      </StackItem>

      <StackItem>
        <div className={styles.logsContainer}>
          {logsHtml ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is local ANSI conversion of task logs, not untrusted markup
            <div dangerouslySetInnerHTML={{ __html: logsHtml }} />
          ) : isRunning ? (
            "Waiting for output..."
          ) : (
            "No output available."
          )}
          <div ref={logsEndRef} />
        </div>
      </StackItem>
    </Stack>
  );
}

// --- Task List ---

export const TasksPage: React.FC = () => {
  const api = useTasksApi();
  const enclaveApi = useEnclaveApi();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [plugins, setPlugins] = useState<string[]>([]);

  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const statusFilters = useMemo(
    () => searchParams.getAll("status"),
    [searchParams],
  );
  const typeFilters = useMemo(
    () => searchParams.getAll("type"),
    [searchParams],
  );

  useEffect(() => {
    enclaveApi
      .getPlugins()
      .then((result) => {
        setPlugins((result.plugins ?? []).map((p) => p.name));
      })
      .catch(() => {});
  }, [enclaveApi.getPlugins]);

  const fetchTasks = useCallback(() => api.listTasks(), [api]);

  const {
    data: tasksData,
    error: tasksError,
    loading,
    refresh,
  } = usePolling(fetchTasks, 5000, true);

  const runs = (tasksData?.runs ?? []).filter((r) => r.type !== "validate");

  const anyRunning = runs.some((r) => r.status === "running");

  const filteredRuns = useMemo(() => {
    let result = runs;
    if (statusFilters.length > 0) {
      result = result.filter((r) => statusFilters.includes(r.status));
    }
    if (typeFilters.length > 0) {
      result = result.filter((r) => typeFilters.includes(r.type));
    }
    return result;
  }, [runs, statusFilters, typeFilters]);

  const toggleStatusFilter = (value: string) => {
    const params = new URLSearchParams(searchParams);
    const current = params.getAll("status");
    if (current.includes(value)) {
      params.delete("status");
      current
        .filter((v) => v !== value)
        .forEach((v) => params.append("status", v));
    } else {
      params.append("status", value);
    }
    setSearchParams(params, { replace: true });
  };

  const toggleTypeFilter = (value: string) => {
    const params = new URLSearchParams(searchParams);
    const current = params.getAll("type");
    if (current.includes(value)) {
      params.delete("type");
      current
        .filter((v) => v !== value)
        .forEach((v) => params.append("type", v));
    } else {
      params.append("type", value);
    }
    setSearchParams(params, { replace: true });
  };

  const handleTaskStarted = (task: TaskRun) => {
    setSelectedTaskId(task.id);
    refresh();
  };

  const handleDeleteTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    setDeleteError(null);
    try {
      await api.deleteTask(id);
      refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete task",
      );
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const content = selectedTaskId ? (
    <TaskDetail
      taskId={selectedTaskId}
      onBack={() => setSelectedTaskId(null)}
    />
  ) : (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h1" size="2xl">
          Deployment Tasks
        </Title>
        <Content component="small">
          {runs.length} task{runs.length !== 1 ? "s" : ""}
          {anyRunning && " — 1 running"}
        </Content>
      </StackItem>

      {tasksError && (
        <StackItem>
          <Alert variant="danger" title="Failed to load tasks" isInline>
            {tasksError.message}
            <Button
              variant="link"
              onClick={refresh}
              isInline
              style={{ marginLeft: "0.5rem" }}
            >
              Retry
            </Button>
          </Alert>
        </StackItem>
      )}

      {deleteError && (
        <StackItem>
          <Alert
            variant="danger"
            title="Failed to delete task"
            isInline
            actionClose={
              <AlertActionCloseButton onClose={() => setDeleteError(null)} />
            }
          >
            {deleteError}
          </Alert>
        </StackItem>
      )}

      <StackItem>
        <Toolbar>
          <ToolbarContent>
            {runs.length > 0 && (
              <>
                <ToolbarItem>
                  <Select
                    isOpen={statusFilterOpen}
                    onOpenChange={setStatusFilterOpen}
                    selected={statusFilters}
                    onSelect={(_e, value) => {
                      if (typeof value === "string") toggleStatusFilter(value);
                    }}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setStatusFilterOpen((p) => !p)}
                        isExpanded={statusFilterOpen}
                      >
                        Status
                        {statusFilters.length > 0
                          ? ` (${statusFilters.length})`
                          : ""}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption
                        value="running"
                        hasCheckbox
                        isSelected={statusFilters.includes("running")}
                      >
                        Running
                      </SelectOption>
                      <SelectOption
                        value="successful"
                        hasCheckbox
                        isSelected={statusFilters.includes("successful")}
                      >
                        Successful
                      </SelectOption>
                      <SelectOption
                        value="failed"
                        hasCheckbox
                        isSelected={statusFilters.includes("failed")}
                      >
                        Failed
                      </SelectOption>
                      <SelectOption
                        value="canceled"
                        hasCheckbox
                        isSelected={statusFilters.includes("canceled")}
                      >
                        Canceled
                      </SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarItem>
                <ToolbarItem>
                  <Select
                    isOpen={typeFilterOpen}
                    onOpenChange={setTypeFilterOpen}
                    selected={typeFilters}
                    onSelect={(_e, value) => {
                      if (typeof value === "string") toggleTypeFilter(value);
                    }}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setTypeFilterOpen((p) => !p)}
                        isExpanded={typeFilterOpen}
                      >
                        Type
                        {typeFilters.length > 0
                          ? ` (${typeFilters.length})`
                          : ""}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption
                        value="deploy"
                        hasCheckbox
                        isSelected={typeFilters.includes("deploy")}
                      >
                        Full Deploy
                      </SelectOption>
                      <SelectOption
                        value="deploy-phase"
                        hasCheckbox
                        isSelected={typeFilters.includes("deploy-phase")}
                      >
                        Phase
                      </SelectOption>
                      <SelectOption
                        value="deploy-plugin"
                        hasCheckbox
                        isSelected={typeFilters.includes("deploy-plugin")}
                      >
                        Plugin
                      </SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarItem>
              </>
            )}
            <ToolbarItem>
              <Button
                variant="primary"
                onClick={() => setIsStartModalOpen(true)}
              >
                Run Task
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </StackItem>

      {/* Content */}
      <StackItem>
        {loading && runs.length === 0 ? (
          <Spinner aria-label="Loading tasks..." />
        ) : runs.length === 0 ? (
          <EmptyState
            headingLevel="h2"
            icon={CubesIcon}
            titleText="No deployment tasks"
          >
            <EmptyStateBody>
              No tasks have been run yet. Start a deployment to see tasks here.
            </EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button
                  variant="primary"
                  onClick={() => setIsStartModalOpen(true)}
                >
                  Run Task
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        ) : (
          <Table aria-label="Task runs" variant="compact">
            <Thead>
              <Tr>
                <Th>Status</Th>
                <Th>Type</Th>
                <Th>Playbook</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRuns.map((run) => (
                <Tr
                  key={run.id}
                  isClickable
                  onRowClick={() => setSelectedTaskId(run.id)}
                  className={styles.clickableRow}
                >
                  <Td>
                    <TaskStatusLabel status={run.status} />
                  </Td>
                  <Td>
                    <TaskTypeLabel type={run.type} />
                  </Td>
                  <Td>{run.playbook}</Td>
                  <Td>{formatTimestamp(run.startedAt)}</Td>
                  <Td>
                    {formatDuration(run.startedAt, run.endedAt)}
                    {run.status === "running" && (
                      <Spinner size="sm" style={{ marginLeft: "0.5rem" }} />
                    )}
                  </Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}>
                    <ActionsColumn
                      items={[
                        {
                          title: "Delete",
                          isDisabled:
                            run.status === "running" || deletingIds.has(run.id),
                          onClick: (e) =>
                            handleDeleteTask(
                              e as unknown as React.MouseEvent,
                              run.id,
                            ),
                        },
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </StackItem>
    </Stack>
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Split hasGutter>
            <SplitItem isFilled>
              <RedHatLogo width={240} />
            </SplitItem>
            <SplitItem>
              <Link to="/wizard" className={styles.navButton}>
                <CogIcon /> Configuration
              </Link>
            </SplitItem>
          </Split>
        </div>
        <Divider />
      </header>

      <div className={styles.content}>
        <div className={styles.contentInner}>{content}</div>
      </div>

      <StartTaskModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onTaskStarted={handleTaskStarted}
        api={api}
        plugins={plugins}
      />
    </div>
  );
};
