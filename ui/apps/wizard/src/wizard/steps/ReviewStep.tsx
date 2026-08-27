import { css } from "@emotion/css";
import type { EnclaveConfig } from "@enclave-wizard-ui/api-client";
import { EnclaveConfigToJSON } from "@enclave-wizard-ui/api-client";
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
import jsYaml from "js-yaml";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useEnclaveApi } from "../../api/useEnclaveApi.ts";
import { buildFinalConfig } from "../buildFinalConfig.ts";
import { YamlEditor } from "../components/YamlEditor.tsx";
import { useWizard } from "../WizardContext.tsx";

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

const BASE_CONFIG_FILES: ConfigFile[] = [
  { key: "global", label: "global.yaml", path: "global" },
  { key: "cloudInfra", label: "cloud_infra.yaml", path: "cloudInfra" },
  { key: "certificates", label: "certificates.yaml", path: "certificates" },
];

export const OSAC_PLUGIN_KEYS = [
  "osacProfile",
  "osacAapLicenseFile",
  "osacBYODatabase",
  "osacDatabaseUrl",
  "osacDnsClass",
  "osacDnsZone",
  "clusterFulfillmentConfig",
];

const RHBK_PLUGIN_KEYS = [
  "rhbk_instances",
  "rhbk_deploy_database",
  "rhbk_db_size",
];

export function extractPluginConfig(
  globalData: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  let hasValue = false;
  for (const key of keys) {
    if (
      globalData[key] != null &&
      globalData[key] !== "" &&
      globalData[key] !== false
    ) {
      result[key] = globalData[key];
      hasValue = true;
    }
  }
  return hasValue ? result : null;
}

export function stripPluginKeys(
  globalData: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...globalData };
  for (const key of [...OSAC_PLUGIN_KEYS, ...RHBK_PLUGIN_KEYS]) {
    delete result[key];
  }
  return result;
}

function configToYaml(data: unknown): string {
  if (
    data == null ||
    (typeof data === "object" && Object.keys(data as object).length === 0)
  ) {
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
  const wireConfig = useMemo(
    () => EnclaveConfigToJSON(finalConfig) as Record<string, unknown>,
    [finalConfig],
  );

  const { configFiles, yamlContents } = useMemo(() => {
    const globalData = (wireConfig.global ?? {}) as Record<string, unknown>;
    const osacPlugin = extractPluginConfig(globalData, OSAC_PLUGIN_KEYS);
    const rhbkPlugin = extractPluginConfig(globalData, RHBK_PLUGIN_KEYS);
    const strippedGlobal = stripPluginKeys(globalData);

    const files: ConfigFile[] = [...BASE_CONFIG_FILES];
    if (osacPlugin) {
      files.push({ key: "osac", label: "plugins/osac.yaml", path: "osac" });
    }
    if (rhbkPlugin) {
      files.push({ key: "rhbk", label: "plugins/rhbk.yaml", path: "rhbk" });
    }

    const contents: Record<string, string> = {};
    for (const file of BASE_CONFIG_FILES) {
      const data =
        file.key === "global" ? strippedGlobal : wireConfig[file.path];
      contents[file.key] = configToYaml(data);
    }
    if (osacPlugin) contents.osac = configToYaml(osacPlugin);
    if (rhbkPlugin) contents.rhbk = configToYaml(rhbkPlugin);

    return { configFiles: files, yamlContents: contents };
  }, [wireConfig]);

  const handleYamlChange = useCallback(
    (fileKey: string, yamlStr: string) => {
      const parsed = yamlToConfig(yamlStr);
      if (parsed === null) {
        setParseErrors((prev) => ({
          ...prev,
          [fileKey]: "Invalid YAML syntax",
        }));
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
          message:
            err instanceof Error ? err.message : "Validation request failed",
        });
      }
      dispatch({ type: "SET_VALIDATION_ERRORS", errors });
      setValidationDone(true);
    } finally {
      setValidating(false);
    }
  }, [api, finalConfig, dispatch]);

  const handleCopyAll = useCallback(() => {
    const allYaml = configFiles
      .map((f) => `# --- ${f.label} ---\n${yamlContents[f.key]}`)
      .join("\n");
    navigator.clipboard.writeText(allYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [yamlContents]);

  const handleDownload = useCallback(() => {
    for (const file of configFiles) {
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
        Review the generated YAML configuration. Edit directly in the editor if
        needed.
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
        {configFiles.map((file) => (
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
          readOnly={activeTab === "osac" || activeTab === "rhbk"}
        />
        <div className={styles.statusBar}>
          <span>{yamlContents[activeTab].split("\n").length} lines</span>
        </div>
      </div>
    </div>
  );
};
