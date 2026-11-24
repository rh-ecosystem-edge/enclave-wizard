import {
  Checkbox,
  Content,
  Flex,
  FlexItem,
  Title,
} from "@patternfly/react-core";
import type React from "react";
import { SchemaStep } from "../components/SchemaStep.tsx";
import { getExperiencePlugins } from "../experiences.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

const GPU_PLUGINS = getExperiencePlugins("gpu");

const GPU_SCHEMA_FIELDS = ["global.gpuPassthrough"];

/**
 * Hand-crafted fallback form for when the plugin schema endpoint is not
 * available. This preserves the original behavior.
 */
const GpuAiFallback: React.FC = () => {
  const { state, dispatch } = useWizard();

  const globalData = ((state.configData as Record<string, unknown>).global ??
    {}) as Record<string, unknown>;
  const enabledPlugins = Array.isArray(globalData.enabled_plugins)
    ? (globalData.enabled_plugins as string[])
    : [];

  const isEnabled = GPU_PLUGINS.every((p) => enabledPlugins.includes(p));

  const toggle = (checked: boolean) => {
    const current = new Set(enabledPlugins);
    for (const p of GPU_PLUGINS) {
      if (checked) current.add(p);
      else current.delete(p);
    }
    dispatch({
      type: "SET_FIELD",
      path: "global.enabled_plugins",
      value: [...current],
    });
  };

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      <FlexItem>
        <Title headingLevel="h3" size="lg">
          VMaaS GPU Passthrough
        </Title>
        <Content component="p" className={stepStyles.subtitle}>
          Allow virtual machines to use physical GPUs on the host nodes.
        </Content>
      </FlexItem>

      <FlexItem>
        <Checkbox
          id="enable-gpu"
          label="Enable GPU passthrough"
          description="Installs the NVIDIA GPU Operator to expose host GPUs to virtual machines via PCI passthrough."
          isChecked={isEnabled}
          onChange={(_e, checked) => toggle(checked)}
        />
      </FlexItem>
    </Flex>
  );
};

export const GpuAiStep: React.FC = () => {
  return (
    <SchemaStep
      pluginName="nvidia-gpu"
      fieldPaths={GPU_SCHEMA_FIELDS}
      fallback={<GpuAiFallback />}
    />
  );
};
