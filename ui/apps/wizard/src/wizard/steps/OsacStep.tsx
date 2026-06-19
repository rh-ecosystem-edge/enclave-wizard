import {
  Content,
  FileUpload,
  Flex,
  FlexItem,
  FormGroup,
  HelperText,
  HelperTextItem,
  NumberInput,
  Radio,
  Switch,
  TextInput,
  Title,
} from "@patternfly/react-core";
import type React from "react";
import { useCallback, useState } from "react";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

export const OsacStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const globalData = ((state.configData as Record<string, unknown>).global ??
    {}) as Record<string, unknown>;

  const aapLicenseFile = (globalData.osacAapLicenseFile as string) ?? "";
  const byoDatabase = (globalData.osacBYODatabase as boolean) ?? false;
  const databaseUrl = (globalData.osacDatabaseUrl as string) ?? "";

  // RHBK settings
  const rhbkInstances = (globalData.rhbk_instances as number) ?? 1;
  const rhbkDeployDatabase =
    (globalData.rhbk_deploy_database as boolean) ?? true;
  const rhbkDbSize = (globalData.rhbk_db_size as string) ?? "5Gi";

  const [uploadFilename, setUploadFilename] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const setField = (field: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path: `global.${field}`, value });

  const handleFileUpload = useCallback(
    async (_e: unknown, file: File) => {
      setUploadError("");
      setUploading(true);
      setUploadFilename(file.name);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("dest", "plugins");
        const resp = await fetch("/api/v1/files", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const { path } = (await resp.json()) as { path: string };
        setField("osacAapLicenseFile", path);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [setField],
  );

  const handleFileClear = useCallback(() => {
    setUploadFilename("");
    setField("osacAapLicenseFile", "");
  }, [setField]);

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      <FlexItem>
        <Title headingLevel="h3" size="lg">
          OSAC Platform
        </Title>
        <Content component="p" className={stepStyles.subtitle}>
          Configure the Open Sovereign AI Cloud platform.
        </Content>
      </FlexItem>

      {/* AAP License */}
      <FlexItem>
        <FormGroup
          label="AAP subscription file"
          isRequired
          fieldId="aap-license"
        >
          <FileUpload
            id="aap-license-upload"
            type="dataURL"
            filename={
              uploadFilename ||
              (aapLicenseFile ? aapLicenseFile.split("/").pop() : "")
            }
            filenamePlaceholder="Upload your AAP license manifest.zip"
            onFileInputChange={(_e, file) => handleFileUpload(_e, file)}
            onClearClick={handleFileClear}
            isLoading={uploading}
            browseButtonText="Upload"
            validated={
              state.showValidation && !aapLicenseFile.trim()
                ? "error"
                : uploadError
                  ? "error"
                  : "default"
            }
          />
          {uploadError && (
            <HelperText>
              <HelperTextItem variant="error">{uploadError}</HelperTextItem>
            </HelperText>
          )}
          {aapLicenseFile && !uploadError && (
            <HelperText>
              <HelperTextItem variant="success">
                Saved to: {aapLicenseFile}
              </HelperTextItem>
            </HelperText>
          )}
          {!aapLicenseFile && !uploadError && (
            <HelperText>
              <HelperTextItem>
                Obtain from
                access.redhat.com/management/subscription_allocations
              </HelperTextItem>
            </HelperText>
          )}
        </FormGroup>
      </FlexItem>

      {/* Fulfillment Database */}
      <FlexItem>
        <Title headingLevel="h4" size="md">
          Fulfillment Database
        </Title>
        <FormGroup label="Database backend" fieldId="byo-database">
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <Radio
              id="db-builtin"
              name="byo-database"
              label="Built-in PostgreSQL"
              description="Deploy a managed PostgreSQL instance (recommended for dev/test)"
              isChecked={!byoDatabase}
              onChange={() => setField("osacBYODatabase", false)}
            />
            <Radio
              id="db-external"
              name="byo-database"
              label="Bring your own database"
              description="Connect to an existing PostgreSQL instance"
              isChecked={byoDatabase}
              onChange={() => setField("osacBYODatabase", true)}
            />
          </Flex>
        </FormGroup>
      </FlexItem>

      {byoDatabase && (
        <FlexItem>
          <FormGroup
            label="Database URL"
            isRequired
            fieldId="database-url"
          >
            <TextInput
              id="database-url"
              value={databaseUrl}
              onChange={(_e, val) => setField("osacDatabaseUrl", val)}
              placeholder="postgres://user@host:5432/dbname?sslmode=require"
              validated={
                state.showValidation && byoDatabase && !databaseUrl.trim()
                  ? "error"
                  : "default"
              }
            />
          </FormGroup>
        </FlexItem>
      )}

      {/* Identity Provider (RHBK/Keycloak) */}
      <FlexItem>
        <Title headingLevel="h4" size="md">
          Identity Provider (Keycloak)
        </Title>
      </FlexItem>

      <FlexItem>
        <FormGroup label="Keycloak replicas" fieldId="rhbk-instances">
          <NumberInput
            id="rhbk-instances"
            value={rhbkInstances}
            min={1}
            max={5}
            onMinus={() =>
              setField("rhbk_instances", Math.max(1, rhbkInstances - 1))
            }
            onPlus={() =>
              setField("rhbk_instances", Math.min(5, rhbkInstances + 1))
            }
            onChange={(e) => {
              const v = Number.parseInt(
                (e.target as HTMLInputElement).value,
                10,
              );
              if (v >= 1 && v <= 5) setField("rhbk_instances", v);
            }}
          />
          <HelperText>
            <HelperTextItem>
              Use 3+ for production high availability
            </HelperTextItem>
          </HelperText>
        </FormGroup>
      </FlexItem>

      <FlexItem>
        <FormGroup
          label="Keycloak database"
          fieldId="rhbk-deploy-database"
        >
          <Switch
            id="rhbk-deploy-database"
            label="Deploy built-in PostgreSQL for Keycloak"
            labelOff="Use external database for Keycloak"
            isChecked={rhbkDeployDatabase}
            onChange={(_e, checked) =>
              setField("rhbk_deploy_database", checked)
            }
          />
        </FormGroup>
      </FlexItem>

      {rhbkDeployDatabase && (
        <FlexItem>
          <FormGroup
            label="Keycloak database size"
            fieldId="rhbk-db-size"
          >
            <TextInput
              id="rhbk-db-size"
              value={rhbkDbSize}
              onChange={(_e, val) => setField("rhbk_db_size", val)}
              placeholder="5Gi"
            />
            <HelperText>
              <HelperTextItem>
                PVC size for the Keycloak PostgreSQL volume
              </HelperTextItem>
            </HelperText>
          </FormGroup>
        </FlexItem>
      )}
    </Flex>
  );
};
