import {
  Alert,
  Button,
  Content,
  Flex,
  FlexItem,
  Tab,
  Tabs,
  TabTitleText,
  Title,
} from "@patternfly/react-core";
import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
} from "@patternfly/react-icons";
import { css } from "@emotion/css";
import jsYaml from "js-yaml";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { EnclaveConfig } from "@enclave-wizard-ui/api-client";
import { EnclaveConfigToJSON } from "@enclave-wizard-ui/api-client";
import { useEnclaveApi } from "../../api/useEnclaveApi.ts";
import { useWizard } from "../WizardContext.tsx";
import { buildFinalConfig } from "../buildFinalConfig.ts";
import { YamlEditor } from "../components/YamlEditor.tsx";

const styles = {
  toolbar: css`
    margin: 1rem 0;
    gap: 0.5rem;
  `,
  tabContent: css`
    margin-top: 1rem;
  `,
  statusBar: css`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #6a6e73;
  `,
};

interface ConfigFile {
  key: string;
  label: string;
  path: string;
}

const CONFIG_FILES: ConfigFile[] = [
  { key: "global", label: "global.yaml", path: "global" },
  { key: "cloudInfra", label: "cloud_infra.yaml", path: "cloudInfra" },
  { key: "certificates", label: "certificates.yaml", path: "certificates" },
  { key: "topology", label: "topology.yaml", path: "topology" },
];

function configToYaml(data: unknown): string {
  if (data == null || (typeof data === "object" && Object.keys(data as object).length === 0)) {
    return "# (empty)\n";
  }
  try {
    return jsYaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true });
  } catch {
    return `# Error serializing config\n${JSON.stringify(data, null, 2)}`;
  }
}

function yamlToConfig(yamlStr: string): unknown {
  try {
    return jsYaml.load(yamlStr);
  } catch {
    return null;
  }
}

export const ReviewStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const api = useEnclaveApi();
  const [activeTab, setActiveTab] = useState<string>("global");
  const [validating, setValidating] = useState(false);
  const [validationDone, setValidationDone] = useState(false);
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const finalConfig = useMemo(() => buildFinalConfig(state), [state]);
  const wireConfig = useMemo(() => EnclaveConfigToJSON(finalConfig) as Record<string, unknown>, [finalConfig]);

  const yamlContents = useMemo(() => {
    const result: Record<string, string> = {};
    for (const file of CONFIG_FILES) {
      result[file.key] = configToYaml(wireConfig[file.path]);
    }
    return result;
  }, [wireConfig]);

  const handleYamlChange = useCallback(
    (fileKey: string, yamlStr: string) => {
      const parsed = yamlToConfig(yamlStr);
      if (parsed === null) {
        setParseErrors((prev) => ({ ...prev, [fileKey]: "Invalid YAML syntax" }));
      } else {
        setParseErrors((prev) => {
          const next = { ...prev };
          delete next[fileKey];
          return next;
        });
        dispatch({ type: "SET_FIELD", path: fileKey, value: parsed });
      }
    },
    [dispatch],
  );

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setValidationDone(false);
    try {
      const result = await api.validateConfig(finalConfig);
      dispatch({
        type: "SET_VALIDATION_ERRORS",
        errors: result.errors ?? [],
      });
      setValidationDone(true);
    } catch (err: unknown) {
      const errors: Array<{ field: string; message: string }> = [];
      if (err && typeof err === "object" && "response" in err) {
        try {
          const body = await (err as { response: Response }).response.json();
          if (body.errors && Array.isArray(body.errors)) {
            for (const e of body.errors) {
              errors.push({
                field: e.location ?? e.field ?? "",
                message: e.message ?? String(e),
              });
            }
          } else if (body.detail) {
            errors.push({ field: "", message: body.detail });
          }
        } catch {
          // response body not JSON
        }
      }
      if (errors.length === 0) {
        errors.push({
          field: "",
          message: err instanceof Error ? err.message : "Validation request failed",
        });
      }
      dispatch({ type: "SET_VALIDATION_ERRORS", errors });
      setValidationDone(true);
    } finally {
      setValidating(false);
    }
  }, [api, finalConfig, dispatch]);

  const handleCopyAll = useCallback(() => {
    const allYaml = CONFIG_FILES.map(
      (f) => `# --- ${f.label} ---\n${yamlContents[f.key]}`,
    ).join("\n");
    navigator.clipboard.writeText(allYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [yamlContents]);

  const handleDownload = useCallback(() => {
    for (const file of CONFIG_FILES) {
      const blob = new Blob([yamlContents[file.key]], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.label;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [yamlContents]);

  const hasParseErrors = Object.keys(parseErrors).length > 0;

  return (
    <div>
      <Title headingLevel="h2" size="xl">
        Review & Edit Configuration
      </Title>
      <Content component="p" style={{ marginTop: "0.5rem" }}>
        Review the generated YAML configuration. Edit directly in the editor
        if needed.
      </Content>

      <Flex className={styles.toolbar}>
        <FlexItem>
          <Button
            variant="secondary"
            onClick={handleValidate}
            isLoading={validating}
            isDisabled={validating || hasParseErrors}
          >
            {validating ? "Validating..." : "Validate"}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="tertiary"
            icon={copied ? <CheckCircleIcon /> : <CopyIcon />}
            onClick={handleCopyAll}
          >
            {copied ? "Copied" : "Copy all"}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="tertiary"
            icon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download files
          </Button>
        </FlexItem>
      </Flex>

      {!validating && validationDone && state.validationErrors.length > 0 && (
        <Alert
          variant="danger"
          title="Validation errors"
          isInline
          style={{ marginBottom: "1rem" }}
        >
          <ul>
            {state.validationErrors.map((err, i) => (
              <li key={`${err.field}-${i}`}>
                {err.field ? <strong>{err.field}:</strong> : null} {err.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {!validating && validationDone && state.validationErrors.length === 0 && (
        <Alert
          variant="success"
          title="Configuration is valid"
          isInline
          style={{ marginBottom: "1rem" }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onSelect={(_e, key) => setActiveTab(key as string)}
        aria-label="Configuration files"
      >
        {CONFIG_FILES.map((file) => (
          <Tab
            key={file.key}
            eventKey={file.key}
            title={
              <TabTitleText>
                {file.label}
                {parseErrors[file.key] ? " ⚠" : ""}
              </TabTitleText>
            }
          />
        ))}
      </Tabs>

      <div className={styles.tabContent}>
        {parseErrors[activeTab] && (
          <Alert
            variant="warning"
            title={parseErrors[activeTab]}
            isInline
            style={{ marginBottom: "0.5rem" }}
          />
        )}
        <YamlEditor
          value={yamlContents[activeTab]}
          onChange={(v) => handleYamlChange(activeTab, v)}
        />
        <div className={styles.statusBar}>
          <span>
            {yamlContents[activeTab].split("\n").length} lines
          </span>
        </div>
      </div>
    </div>
  );
};
