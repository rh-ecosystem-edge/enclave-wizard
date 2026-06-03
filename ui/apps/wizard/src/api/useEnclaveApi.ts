import { useInjection } from "@enclave-wizard-ui/ioc";
import type {
  ConfigApiInterface,
  DefaultsApiInterface,
  PluginsApiInterface,
} from "@enclave-wizard-ui/api-client";
import type {
  EnclaveConfig,
  Defaults,
  PluginsOutputBody,
  ValidateConfigOutputBody,
} from "@enclave-wizard-ui/api-client";
import { useCallback } from "react";
import { Symbols } from "../main/Symbols.ts";

export interface ExperienceDefinition {
  name: string;
  description?: string;
  plugins: { name: string }[];
}

export interface EnclaveApiClient {
  getConfig: () => Promise<EnclaveConfig>;
  writeConfig: (config: EnclaveConfig) => Promise<void>;
  validateConfig: (
    config: EnclaveConfig,
  ) => Promise<ValidateConfigOutputBody>;
  getDefaults: () => Promise<Defaults>;
  getPlugins: () => Promise<PluginsOutputBody>;
  getExperiences: () => Promise<ExperienceDefinition[]>;
}

export function useEnclaveApi(): EnclaveApiClient {
  const configApi = useInjection<ConfigApiInterface>(Symbols.ConfigApi);
  const defaultsApi = useInjection<DefaultsApiInterface>(Symbols.DefaultsApi);
  const pluginsApi = useInjection<PluginsApiInterface>(Symbols.PluginsApi);

  const getConfig = useCallback(
    () => configApi.getConfig(),
    [configApi],
  );

  const writeConfig = useCallback(
    (config: EnclaveConfig) =>
      configApi.writeConfig({ enclaveConfig: config }),
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

  const getPlugins = useCallback(
    () => pluginsApi.listPlugins(),
    [pluginsApi],
  );

  const getExperiences = useCallback(async (): Promise<ExperienceDefinition[]> => {
    const resp = await fetch("/api/v1/experiences");
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.experiences ?? [];
  }, []);

  return { getConfig, writeConfig, validateConfig, getDefaults, getPlugins, getExperiences };
}
