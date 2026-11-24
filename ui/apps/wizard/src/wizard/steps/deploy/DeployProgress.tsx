import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Spinner,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
} from "@patternfly/react-core";
import { AnsiUp } from "ansi_up";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeploymentState } from "../../../api/useDeployment.ts";
import { TaskStatusLabel } from "../../../tasks/components/TaskStatusLabel.tsx";
import { tasksStyles as styles } from "../../../tasks/tasksStyles.ts";
import { formatDuration } from "../../../utils/formatDuration.ts";

export const DeployProgress: React.FC<{
  state: DeploymentState;
}> = ({ state: deployment }) => {
  const { task, logs } = deployment;
  const isRunning = task?.status === "running";

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
    if (!follow || !isRunning || !logsEndRef.current) return;
    logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    // logs is not read above; it retriggers follow-scroll when output grows.
    void logs;
  }, [follow, isRunning, logs]);

  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h2" size="xl">
          Deployment
        </Title>
      </StackItem>

      {task && (
        <StackItem>
          <DescriptionList isHorizontal isCompact>
            <DescriptionListGroup>
              <DescriptionListTerm>Status</DescriptionListTerm>
              <DescriptionListDescription>
                <TaskStatusLabel status={task.status} />
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
          </DescriptionList>
        </StackItem>
      )}

      {task?.error && (
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
            // biome-ignore lint/security/noDangerouslySetInnerHtml: ANSI-to-HTML rendering requires innerHTML
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
};
