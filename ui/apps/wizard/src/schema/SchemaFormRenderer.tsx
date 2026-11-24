import {
  Checkbox,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  TextInput,
} from "@patternfly/react-core";
import type React from "react";
import { StringArrayField } from "../wizard/components/StringArrayField.tsx";
import { stepStyles } from "../wizard/steps/stepStyles.ts";
import { extractFieldMeta, type FieldMeta } from "./schemaUtils.ts";

const PLACEHOLDER_HINTS: Record<string, string> = {
  baseDomain: "example.com",
  clusterName: "mgmt",
  machineNetwork: "192.168.1.0/24",
  apiVIP: "192.168.1.200",
  ingressVIP: "192.168.1.201",
  rendezvousIP: "192.168.1.10",
  defaultDNS: "192.168.1.1",
  defaultGateway: "192.168.1.1",
  lzBmcIP: "192.168.1.100",
  lzBmcHostname: "lz.example.com",
};

function isFieldEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

interface SchemaFormRendererProps {
  schema: unknown;
  fields: string[];
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  showValidation?: boolean;
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function getFieldValidationStatus(
  meta: FieldMeta,
  value: unknown,
  showValidation: boolean,
): "default" | "error" {
  if (!showValidation) return "default";
  if (
    meta.required &&
    (value == null || (typeof value === "string" && value.trim() === ""))
  ) {
    return "error";
  }
  if (typeof value === "string" && value.trim() !== "" && meta.pattern) {
    try {
      if (!new RegExp(meta.pattern).test(value)) return "error";
    } catch {
      /* skip */
    }
  }
  if (typeof value === "number") {
    if (meta.minimum != null && value < meta.minimum) return "error";
    if (meta.maximum != null && value > meta.maximum) return "error";
  }
  return "default";
}

function renderField(
  meta: FieldMeta,
  value: unknown,
  onChange: (path: string, value: unknown) => void,
  showValidation: boolean,
): React.ReactNode {
  const fieldId = `field-${meta.path}`;
  const validated = getFieldValidationStatus(meta, value, showValidation);

  if (meta.type === "boolean") {
    return (
      <FormGroup key={meta.path} fieldId={fieldId}>
        <Checkbox
          id={fieldId}
          label={meta.label}
          aria-label={meta.label}
          isChecked={Boolean(value)}
          onChange={(_e, checked) => onChange(meta.path, checked)}
          description={meta.description}
        />
      </FormGroup>
    );
  }

  if (meta.type === "string" && meta.enum) {
    return (
      <FormGroup
        key={meta.path}
        label={meta.label}
        isRequired={meta.required}
        fieldId={fieldId}
      >
        <FormSelect
          id={fieldId}
          aria-label={meta.label}
          value={(value as string) ?? ""}
          onChange={(_e, v) => onChange(meta.path, v)}
        >
          <FormSelectOption value="" label="Select..." isPlaceholder />
          {meta.enum.map((opt) => (
            <FormSelectOption key={opt} value={opt} label={opt} />
          ))}
        </FormSelect>
        {meta.description && (
          <FormHelperText>{meta.description}</FormHelperText>
        )}
      </FormGroup>
    );
  }

  if (meta.type === "integer") {
    const numValue =
      typeof value === "number" && value !== 0 ? value : undefined;
    return (
      <FormGroup
        key={meta.path}
        label={meta.label}
        isRequired={meta.required}
        fieldId={fieldId}
      >
        <TextInput
          id={fieldId}
          aria-label={meta.label}
          type="number"
          value={numValue ?? ""}
          placeholder={
            meta.minimum != null && meta.maximum != null
              ? `${meta.minimum}–${meta.maximum}`
              : undefined
          }
          onChange={(_e, v) => {
            if (v === "") {
              onChange(meta.path, undefined);
            } else {
              onChange(meta.path, Number(v));
            }
          }}
          isRequired={meta.required}
          validated={validated}
        />
        {meta.description && (
          <FormHelperText>{meta.description}</FormHelperText>
        )}
      </FormGroup>
    );
  }

  if (
    meta.type === "array" &&
    (meta.items as Record<string, unknown>)?.type === "string"
  ) {
    const arrayValue = Array.isArray(value) ? (value as string[]) : [];
    return (
      <StringArrayField
        key={meta.path}
        label={meta.label}
        description={meta.description}
        values={arrayValue}
        onChange={(v) => onChange(meta.path, v)}
        isRequired={meta.required}
      />
    );
  }

  // Default: text input
  return (
    <FormGroup
      key={meta.path}
      label={meta.label}
      isRequired={meta.required}
      fieldId={fieldId}
    >
      <TextInput
        id={fieldId}
        aria-label={meta.label}
        value={(value as string) ?? ""}
        onChange={(_e, v) => onChange(meta.path, v)}
        placeholder={PLACEHOLDER_HINTS[meta.path.split(".").pop() ?? ""]}
        isRequired={meta.required}
        validated={validated}
      />
      {validated === "error" && meta.required && isFieldEmpty(value) && (
        <FormHelperText>
          <span className={stepStyles.validationError}>
            This field is required
          </span>
        </FormHelperText>
      )}
      {validated === "error" && !isFieldEmpty(value) && meta.pattern && (
        <FormHelperText>
          <span className={stepStyles.validationError}>Invalid format</span>
        </FormHelperText>
      )}
      {validated !== "error" && meta.description && (
        <FormHelperText>{meta.description}</FormHelperText>
      )}
    </FormGroup>
  );
}

export const SchemaFormRenderer: React.FC<SchemaFormRendererProps> = ({
  schema,
  fields,
  values,
  onChange,
  showValidation = false,
}) => {
  return (
    <>
      {fields.map((fieldPath) => {
        const meta = extractFieldMeta(
          schema as Record<string, unknown>,
          fieldPath,
        );
        if (!meta) return null;
        const value = getValueByPath(values, fieldPath);
        return renderField(meta, value, onChange, showValidation);
      })}
    </>
  );
};
