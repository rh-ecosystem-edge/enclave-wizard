import type React from "react";
import { createContext, useContext, useReducer } from "react";
import type { FlavorId } from "./flavors.ts";

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
  selectedFlavors: Set<FlavorId>;
  configData: ConfigData;
  validationErrors: ValidationError[];
  showValidation: boolean;
  schema: unknown | null;
  plugins: unknown[];
}

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "TOGGLE_FLAVOR"; flavor: FlavorId }
  | { type: "SET_FIELD"; path: string; value: unknown }
  | { type: "SET_SCHEMA"; schema: unknown }
  | { type: "SET_PLUGINS"; plugins: unknown[] }
  | { type: "SET_VALIDATION_ERRORS"; errors: ValidationError[] }
  | { type: "SET_SHOW_VALIDATION"; show: boolean }
  | { type: "LOAD_CONFIG"; config: ConfigData }
  | { type: "REMOVE_AZ"; name: string };

export const initialWizardState: WizardState = {
  currentStep: 0,
  selectedFlavors: new Set(),
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

function toggleFlavor(flavors: Set<FlavorId>, id: FlavorId): Set<FlavorId> {
  const next = new Set(flavors);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "TOGGLE_FLAVOR":
      return { ...state, selectedFlavors: toggleFlavor(state.selectedFlavors, action.flavor) };
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
    case "REMOVE_AZ": {
      const clearZone = (hosts: unknown[]): unknown[] =>
        hosts.map((h: any) =>
          h.zone === action.name ? { ...h, zone: "" } : h,
        );
      const globalData = { ...(state.configData.global as Record<string, unknown> ?? {}) };
      if (Array.isArray(globalData.agent_hosts)) {
        globalData.agent_hosts = clearZone(globalData.agent_hosts);
      }
      const infraData = { ...(state.configData.cloudInfra as Record<string, unknown> ?? {}) };
      if (Array.isArray(infraData.discovery_hosts)) {
        infraData.discovery_hosts = clearZone(infraData.discovery_hosts);
      }
      return {
        ...state,
        configData: { ...state.configData, global: globalData, cloudInfra: infraData },
      };
    }
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
