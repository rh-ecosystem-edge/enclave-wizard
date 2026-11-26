import type React from "react";
import { createContext, useContext, useReducer } from "react";
import type { Experience } from "../experiences.ts";
import type { FlavorDefinition } from "../flavors.ts";

export interface ConfigData {
  global?: Record<string, unknown>;
  certificates?: Record<string, unknown>;
  cloudInfra?: Record<string, unknown>;
}

export interface ConfigState {
  selectedFlavors: Set<string>;
  configData: ConfigData;
}

export type ConfigAction =
  | { type: "SET_FIELD"; path: string; value: unknown }
  | {
      type: "TOGGLE_FLAVOR";
      flavor: string;
      experiences: Experience[];
      flavors: FlavorDefinition[];
    }
  | { type: "LOAD_CONFIG"; config: ConfigData };

export const initialConfigState: ConfigState = {
  selectedFlavors: new Set(),
  configData: {},
};

export function setNestedField(
  obj: Record<string, unknown>,
  keys: string[],
  value: unknown,
): Record<string, unknown> {
  if (keys.length === 0) return obj;
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [head, ...rest] = keys;
  const child = (obj[head] as Record<string, unknown>) ?? {};
  return { ...obj, [head]: setNestedField({ ...child }, rest, value) };
}

function toggleFlavor(flavors: Set<string>, id: string): Set<string> {
  const next = new Set(flavors);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  next.add(id);
  return next;
}

export function configReducer(
  state: ConfigState,
  action: ConfigAction,
): ConfigState {
  switch (action.type) {
    case "TOGGLE_FLAVOR": {
      const nextFlavors = toggleFlavor(state.selectedFlavors, action.flavor);

      // Collect all plugins that should NOT be auto-managed (those not from any flavor)
      const allFlavorPlugins = new Set<string>();
      for (const f of action.flavors) {
        const exp = action.experiences.find((e) => e.id === f.experienceId);
        if (!exp) continue;
        for (const p of exp.plugins) {
          allFlavorPlugins.add(p.name);
        }
      }

      // Start with non-flavor plugins that were previously enabled
      const existingPlugins =
        ((
          (state.configData as Record<string, unknown>).global as
            | Record<string, unknown>
            | undefined
        )?.enabled_plugins as string[]) ?? [];
      const allPlugins = new Set(
        existingPlugins.filter((p) => !allFlavorPlugins.has(p)),
      );

      // Add plugins for selected flavors
      for (const f of action.flavors) {
        if (!nextFlavors.has(f.id)) continue;
        const exp = action.experiences.find((e) => e.id === f.experienceId);
        if (!exp) continue;
        for (const p of exp.plugins.sort((a, b) => a.order - b.order)) {
          allPlugins.add(p.name);
        }
      }

      const selected = action.flavors.filter((f) => nextFlavors.has(f.id));
      let osacProfile = "";
      if (selected.length > 1) osacProfile = "development";
      else if (selected.length === 1) osacProfile = selected[0].osacProfile;

      let updated = setNestedField(
        { ...state.configData } as Record<string, unknown>,
        ["global", "enabled_plugins"],
        [...allPlugins],
      );
      updated = setNestedField(
        updated,
        ["global", "osacProfile"],
        osacProfile || undefined,
      );
      const profilesList = selected.map((f) => f.id);
      if (profilesList.length > 0) {
        updated = setNestedField(
          updated,
          ["global", "osacProfilesList"],
          profilesList,
        );
      }
      return {
        ...state,
        selectedFlavors: nextFlavors,
        configData: updated as ConfigData,
      };
    }
    case "SET_FIELD": {
      const keys = action.path.split(".");
      const configData = setNestedField(
        { ...state.configData } as Record<string, unknown>,
        keys,
        action.value,
      ) as ConfigData;
      return { ...state, configData };
    }
    case "LOAD_CONFIG":
      return { ...state, configData: action.config };
    default:
      return state;
  }
}

interface ConfigContextValue {
  state: ConfigState;
  dispatch: React.Dispatch<ConfigAction>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(configReducer, initialConfigState);
  return (
    <ConfigContext.Provider value={{ state, dispatch }}>
      {children}
    </ConfigContext.Provider>
  );
};

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context === null) {
    throw new Error("useConfig must be used within a ConfigProvider.");
  }
  return context;
}
