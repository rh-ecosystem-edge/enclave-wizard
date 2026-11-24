import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  Progress,
  ProgressMeasureLocation,
  ProgressVariant,
  Spinner,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
} from "@patternfly/react-core";
import { AnsiUp } from "ansi_up";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeployment } from "../../api/useDeployment.ts";
import { TaskStatusLabel } from "../../tasks/components/TaskStatusLabel.tsx";
import { tasksStyles as styles } from "../../tasks/tasksStyles.ts";
import { buildFinalConfig } from "../buildFinalConfig.ts";
import { useWizard } from "../WizardContext.tsx";

function errorDetailRows(details: string[]): { key: string; detail: string }[] {
  const seen = new Map<string, number>();
  return details.map((detail) => {
    const occurrence = seen.get(detail) ?? 0;
    seen.set(detail, occurrence + 1);
    return { key: `${occurrence}:${detail}`, detail };
  });
}

function formatDuration(start?: Date | null, end?: Date | null): string {
  if (!start) return "—";
  const elapsed = (end ?? new Date()).getTime() - start.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export const DeployStep: React.FC = () => {
  const { state: wizardState } = useWizard();
  const { state: deployment, start, cancel } = useDeployment();

  const handleDeploy = useCallback(() => {
    start(buildFinalConfig(wizardState));
  }, [start, wizardState]);

  const ansiUp = useMemo(() => {
    const instance = new AnsiUp();
    instance.use_classes = false;
    return instance;
  }, []);

  const logsHtml = useMemo(() => {
    if (!deployment.logs) return "";
    return ansiUp.ansi_to_html(deployment.logs);
  }, [deployment.logs, ansiUp]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  const isRunning = deployment.phase === "deploying";

  useEffect(() => {
    if (follow && isRunning && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // deployment.logs is not read above; it retriggers follow-scroll when output grows.
    void deployment.logs;
  }, [deployment.logs, follow, isRunning]);

  if (deployment.phase === "writing") {
    return (
      <EmptyState
        variant="lg"
        titleText="Writing configuration..."
        headingLevel="h2"
        icon={Spinner}
      >
        <EmptyStateBody>
          Writing config files before starting deployment.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  if (
    deployment.phase === "idle" ||
    (deployment.phase === "error" && !deployment.taskId)
  ) {
    return (
      <div>
        <Title headingLevel="h2" size="xl">
          Deploy
        </Title>

        {deployment.phase === "error" && deployment.error && (
          <Alert
            variant="danger"
            title={deployment.error.message}
            isInline
            style={{ margin: "1rem 0" }}
          >
            {deployment.error.details.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {errorDetailRows(deployment.error.details).map((row) => (
                  <li key={row.key}>{row.detail}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <p style={{ margin: "1rem 0" }}>
          Write the configuration and start a full deployment (all 7 phases).
        </p>

        <Button variant="primary" size="lg" onClick={handleDeploy}>
          Deploy
        </Button>
      </div>
    );
  }

  // Deploying / complete / failed — show task output
  const task = deployment.task;

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

      {deployment.progress && (
        <StackItem>
          <Progress
            value={
              deployment.phase === "complete"
                ? 100
                : (deployment.progress.percentage ?? 0)
            }
            title={
              deployment.progress.currentTask ||
              (isRunning ? "Starting..." : "")
            }
            measureLocation={ProgressMeasureLocation.top}
            variant={
              deployment.phase === "failed"
                ? ProgressVariant.danger
                : deployment.phase === "complete"
                  ? ProgressVariant.success
                  : undefined
            }
            aria-label="Deployment progress"
          />
        </StackItem>
      )}

      {deployment.error && (
        <StackItem>
          <Alert variant="danger" title="Error" isInline>
            {deployment.error.message}
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
            <>
              <SplitItem>
                <Button
                  variant="link"
                  isInline
                  onClick={() => setFollow((f) => !f)}
                >
                  {follow ? "Unfollow" : "Follow"}
                </Button>
              </SplitItem>
              <SplitItem>
                <Button
                  variant="danger"
                  isInline
                  onClick={cancel}
                  data-testid="cancel-deploy"
                >
                  Cancel
                </Button>
              </SplitItem>
            </>
          )}
        </Split>
      </StackItem>

      <StackItem>
        <div className={styles.logsContainer}>
          {logsHtml ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is local ANSI conversion of deploy logs, not untrusted markup
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
