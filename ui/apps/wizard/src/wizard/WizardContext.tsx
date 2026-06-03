import type React from "react";
import { createContext, useContext, useReducer } from "react";
import type { ExperienceDefinition } from "../api/useEnclaveApi.ts";

export interface ValidationError {
  field: string;
  message: string;
}

interface ConfigData {
  global?: Record<string, unknown>;
  certificates?: Record<string, unknown>;
  cloudInfra?: Record<string, unknown>;
}

export interface WizardState {
  currentStep: number;
  selectedExperiences: Set<string>;
  experiences: ExperienceDefinition[];
  configData: ConfigData;
  validationErrors: ValidationError[];
  showValidation: boolean;
  schema: unknown | null;
  plugins: unknown[];
}

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "TOGGLE_EXPERIENCE"; name: string }
  | { type: "SET_EXPERIENCES"; experiences: ExperienceDefinition[] }
  | { type: "SET_FIELD"; path: string; value: unknown }
  | { type: "SET_SCHEMA"; schema: unknown }
  | { type: "SET_PLUGINS"; plugins: unknown[] }
  | { type: "SET_VALIDATION_ERRORS"; errors: ValidationError[] }
  | { type: "SET_SHOW_VALIDATION"; show: boolean }
  | { type: "LOAD_CONFIG"; config: ConfigData };

export const initialWizardState: WizardState = {
  currentStep: 0,
  selectedExperiences: new Set(),
  experiences: [],
  configData: {},
  validationErrors: [],
  showValidation: false,
  schema: null,
  plugins: [],
};

function setNestedField(
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

function computeEnabledPlugins(
  state: WizardState,
  selectedExperiences: Set<string>,
): string[] {
  const globalData = (state.configData.global ?? {}) as Record<string, unknown>;
  const storagePlugin = (globalData.storage_plugin as string) ?? "lvms";

  const pluginSet = new Set<string>([storagePlugin]);
  for (const exp of state.experiences) {
    if (selectedExperiences.has(exp.name)) {
      for (const p of exp.plugins) {
        pluginSet.add(p.name);
      }
    }
  }
  return Array.from(pluginSet);
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "TOGGLE_EXPERIENCE": {
      const next = new Set(state.selectedExperiences);
      if (next.has(action.name)) {
        next.delete(action.name);
      } else {
        next.add(action.name);
      }
      const enabledPlugins = computeEnabledPlugins(state, next);
      const configData = setNestedField(
        { ...state.configData } as Record<string, unknown>,
        ["global", "enabled_plugins"],
        enabledPlugins,
      ) as ConfigData;
      return { ...state, selectedExperiences: next, configData };
    }
    case "SET_EXPERIENCES":
      return { ...state, experiences: action.experiences };
    case "SET_FIELD": {
      const keys = action.path.split(".");
      const configData = setNestedField(
        { ...state.configData } as Record<string, unknown>,
        keys,
        action.value,
      ) as ConfigData;
      return { ...state, configData };
    }
    case "SET_SCHEMA":
      return { ...state, schema: action.schema };
    case "SET_PLUGINS":
      return { ...state, plugins: action.plugins };
    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors };
    case "SET_SHOW_VALIDATION":
      return { ...state, showValidation: action.show };
    case "LOAD_CONFIG":
      return { ...state, configData: action.config };
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
};

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (context === null) {
    throw new Error("useWizard must be used within a WizardProvider.");
  }
  return context;
}
