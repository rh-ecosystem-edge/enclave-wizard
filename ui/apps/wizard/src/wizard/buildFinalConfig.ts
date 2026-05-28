import type { EnclaveConfig } from "@enclave-wizard-ui/api-client";
import { EnclaveConfigFromJSON } from "@enclave-wizard-ui/api-client";
import type { WizardState } from "./WizardContext.ts";

export function buildFinalConfig(state: WizardState): EnclaveConfig {
  const globalData = (state.configData.global ?? {}) as Record<string, unknown>;

  const raw = {
    ...state.configData,
    global: {
      ...globalData,
      workingDir: "/home/enclave",
      disconnected: true,
    },
    certificates: state.configData.certificates ?? {},
    cloudInfra: state.configData.cloudInfra ?? { discovery_hosts: [] },
    topology: state.configData.topology ?? { availability_zones: [] },
  };

  return EnclaveConfigFromJSON(raw);
}
