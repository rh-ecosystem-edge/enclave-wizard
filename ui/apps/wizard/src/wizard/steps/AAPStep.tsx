import {
  Checkbox,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  Title,
} from "@patternfly/react-core";
import type { DropEvent } from "@patternfly/react-core/dist/esm/helpers/typeUtils.js";
import type React from "react";
import { useState } from "react";
import { useFileUpload } from "../../api/useFileUpload.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export const AAPStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const [uploadFilename, setUploadFilename] = useState("");
  const { upload, uploading, error: uploadError } = useFileUpload();

  const onChange = (path: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path, value });

  const configData = state.configData as Record<string, unknown>;
  const aapDefaults = (getValueByPath(configData, "global.aapDefaults") ??
    {}) as Record<string, unknown>;
  const savedPath = (aapDefaults.aapLicenseFile as string) ?? "";

  const setAAP = (field: string, value: unknown) =>
    onChange(`global.aapDefaults.${field}`, value);

  const handleFileChange = async (_event: DropEvent, file: File) => {
    setUploadFilename(file.name);
    try {
      const data = await upload(file, "plugins/aap");
      setAAP("aapLicenseFile", data.path);
    } catch {
      // error is tracked by useFileUpload
    }
  };

  const handleClear = () => {
    setUploadFilename("");
    setAAP("aapLicenseFile", undefined);
  };

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        Ansible Automation Platform
      </Title>

      <Title
        headingLevel="h3"
        size="lg"
        className={stepStyles.firstSectionTitle}
      >
        Subscription
      </Title>

      <FormGroup
        label="Subscription manifest"
        isRequired
        fieldId="aap-subscription-file"
      >
        <FileUpload
          id="aap-subscription-file"
          browseButtonText="Upload"
          filename={
            uploadFilename ||
            (savedPath ? (savedPath.split("/").pop() ?? "") : "")
          }
          isLoading={uploading}
          onFileInputChange={handleFileChange}
          onClearClick={handleClear}
          validated={
            state.showValidation && !savedPath.trim() ? "error" : "default"
          }
        />
        {uploadError && (
          <FormHelperText>
            <span className={stepStyles.validationError}>{uploadError}</span>
          </FormHelperText>
        )}
        {!uploadError && savedPath && (
          <FormHelperText>Uploaded to {savedPath}</FormHelperText>
        )}
        {!uploadError && !savedPath && (
          <FormHelperText>
            Upload the AAP subscription manifest.zip file.
          </FormHelperText>
        )}
      </FormGroup>

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Components
      </Title>

      <Checkbox
        id="aap-controller"
        label="Automation Controller"
        isChecked={(aapDefaults.aap_controller_disabled as boolean) !== true}
        onChange={(_e, checked) => setAAP("aap_controller_disabled", !checked)}
        description="Deploy the Automation Controller for running playbooks and workflows."
      />
      <Checkbox
        id="aap-eda"
        label="Event-Driven Ansible"
        isChecked={(aapDefaults.aap_eda_disabled as boolean) !== true}
        onChange={(_e, checked) => setAAP("aap_eda_disabled", !checked)}
        description="Deploy the Event-Driven Ansible component for event-based automation."
      />
      <Checkbox
        id="aap-hub"
        label="Automation Hub"
        isChecked={(aapDefaults.aap_hub_disabled as boolean) !== true}
        onChange={(_e, checked) => setAAP("aap_hub_disabled", !checked)}
        description="Deploy Automation Hub for managing Ansible content collections."
      />
      <Checkbox
        id="aap-lightspeed"
        label="Ansible Lightspeed"
        isChecked={(aapDefaults.aap_lightspeed_disabled as boolean) !== true}
        onChange={(_e, checked) => setAAP("aap_lightspeed_disabled", !checked)}
        description="Deploy Ansible Lightspeed for AI-assisted automation."
      />

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Advanced Settings
      </Title>

      <FormGroup label="Image pull policy" fieldId="aap-pull-policy">
        <FormSelect
          id="aap-pull-policy"
          aria-label="Image pull policy"
          value={(aapDefaults.aap_image_pull_policy as string) ?? ""}
          onChange={(_e, v) => setAAP("aap_image_pull_policy", v || undefined)}
        >
          <FormSelectOption
            value=""
            label="Default (IfNotPresent)"
            isPlaceholder
          />
          <FormSelectOption value="Always" label="Always" />
          <FormSelectOption value="IfNotPresent" label="IfNotPresent" />
          <FormSelectOption value="Never" label="Never" />
        </FormSelect>
      </FormGroup>

      <FormGroup label="Redis mode" fieldId="aap-redis-mode">
        <FormSelect
          id="aap-redis-mode"
          aria-label="Redis mode"
          value={(aapDefaults.aap_redis_mode as string) ?? ""}
          onChange={(_e, v) => setAAP("aap_redis_mode", v || undefined)}
        >
          <FormSelectOption
            value=""
            label="Default (standalone)"
            isPlaceholder
          />
          <FormSelectOption value="standalone" label="Standalone" />
          <FormSelectOption value="cluster" label="Cluster" />
        </FormSelect>
      </FormGroup>

      <FormGroup label="Route TLS termination" fieldId="aap-tls-termination">
        <FormSelect
          id="aap-tls-termination"
          aria-label="Route TLS termination"
          value={(aapDefaults.aap_route_tls_termination as string) ?? ""}
          onChange={(_e, v) =>
            setAAP("aap_route_tls_termination", v || undefined)
          }
        >
          <FormSelectOption value="" label="Default (Edge)" isPlaceholder />
          <FormSelectOption value="Edge" label="Edge" />
          <FormSelectOption value="Passthrough" label="Passthrough" />
          <FormSelectOption value="Reencrypt" label="Reencrypt" />
        </FormSelect>
      </FormGroup>

      <Checkbox
        id="aap-no-log"
        label="Suppress sensitive log output"
        isChecked={(aapDefaults.aap_no_log as boolean) ?? true}
        onChange={(_e, checked) => setAAP("aap_no_log", checked)}
        className={stepStyles.sectionTitle}
      />
    </Form>
  );
};
