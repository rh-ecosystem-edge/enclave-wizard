import type {
  ConfigApiInterface,
  Defaults,
  DefaultsApiInterface,
  EnclaveConfig,
  PluginsApiInterface,
  PluginsOutputBody,
  ValidateConfigOutputBody,
} from "@enclave-wizard-ui/api-client";
import { useInjection } from "@y0n1/react-ioc";
import { useCallback } from "react";
import { Symbols } from "../main/Symbols.ts";

export interface EnclaveApiClient {
  getConfig: () => Promise<EnclaveConfig>;
  writeConfig: (config: EnclaveConfig) => Promise<void>;
  validateConfig: (config: EnclaveConfig) => Promise<ValidateConfigOutputBody>;
  getDefaults: () => Promise<Defaults>;
  getPlugins: () => Promise<PluginsOutputBody>;
}

export function useEnclaveApi(): EnclaveApiClient {
  const configApi = useInjection<ConfigApiInterface>(Symbols.ConfigApi);
  const defaultsApi = useInjection<DefaultsApiInterface>(Symbols.DefaultsApi);
  const pluginsApi = useInjection<PluginsApiInterface>(Symbols.PluginsApi);

  const getConfig = useCallback(() => configApi.getConfig(), [configApi]);

  const writeConfig = useCallback(
    (config: EnclaveConfig) => configApi.writeConfig({ enclaveConfig: config }),
    [configApi],
  );

  const validateConfig = useCallback(
    (config: EnclaveConfig) =>
      configApi.validateConfig({ enclaveConfig: config }),
    [configApi],
  );

  const getDefaults = useCallback(
    () => defaultsApi.getDefaults(),
    [defaultsApi],
  );

  const getPlugins = useCallback(() => pluginsApi.listPlugins(), [pluginsApi]);

  return { getConfig, writeConfig, validateConfig, getDefaults, getPlugins };
}
