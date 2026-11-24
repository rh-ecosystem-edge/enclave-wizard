import type { EnclaveConfig } from "@enclave-wizard-ui/api-client";
import { EnclaveConfigToJSON } from "@enclave-wizard-ui/api-client";

/** Wire JSON for the config API (snake_case keys). Generated ToJSON is mistyped as EnclaveConfig. */
export function toWireConfig(config: EnclaveConfig): Record<string, unknown> {
  return EnclaveConfigToJSON(config) as unknown as Record<string, unknown>;
}
