import { Alert, Bullseye, Spinner } from "@patternfly/react-core";
import type React from "react";
import { usePluginSchema } from "../../api/usePluginSchema.ts";
import { SchemaFormRenderer } from "../../schema/SchemaFormRenderer.tsx";
import { useWizard } from "../WizardContext.tsx";

interface SchemaStepProps {
  /** Plugin name to fetch schema for (e.g. "trust-manager") */
  pluginName: string;

  /** Dot-separated field paths to render (e.g. ["global.trustManagerDefaults.trust_manager_ca_issuer_duration"]) */
  fieldPaths: string[];

  /** Fallback component to render when schema is not available */
  fallback?: React.ReactNode;
}

export const SchemaStep: React.FC<SchemaStepProps> = ({
  pluginName,
  fieldPaths,
  fallback,
}) => {
  const { state, dispatch } = useWizard();
  const { schema: pluginSchema, loading, error } = usePluginSchema(pluginName);

  const onChange = (path: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path, value });

  if (loading) {
    return (
      <Bullseye>
        <Spinner size="lg" aria-label="Loading plugin configuration" />
      </Bullseye>
    );
  }

  if (error || !pluginSchema) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <Alert variant="info" title="Plugin configuration unavailable" isInline>
        The configuration schema for &quot;{pluginName}&quot; could not be
        loaded. {error?.message}
      </Alert>
    );
  }

  // Merge the plugin schema into the wizard's main schema structure so
  // SchemaFormRenderer can resolve dot-paths like "global.trustManagerDefaults.X".
  // The plugin schema is the sub-tree; we need to wrap it into the expected
  // root structure based on the field paths.
  const mergedSchema = buildMergedSchema(
    state.schema,
    pluginSchema,
    fieldPaths,
  );

  return (
    <SchemaFormRenderer
      schema={mergedSchema}
      fields={fieldPaths}
      values={state.configData as Record<string, unknown>}
      onChange={onChange}
      showValidation={state.showValidation}
    />
  );
};

/**
 * Build a merged schema. If the wizard already has a full schema from
 * openapi.json, use that. Otherwise, attempt to overlay the plugin schema
 * properties into the right position in a minimal schema tree.
 */
function buildMergedSchema(
  wizardSchema: unknown,
  pluginSchema: Record<string, unknown>,
  fieldPaths: string[],
): unknown {
  // If the wizard has a full schema, prefer it — it already has all fields
  if (wizardSchema) return wizardSchema;

  // Build a minimal schema tree from the plugin schema.
  // We expect fieldPaths like "global.trustManagerDefaults.foo" —
  // the plugin schema's properties should map to the leaf field names.
  const root: Record<string, unknown> = {
    type: "object",
    properties: {},
  };

  for (const path of fieldPaths) {
    const segments = path.split(".");
    let current = root;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const props = current.properties as Record<
        string,
        Record<string, unknown>
      >;
      if (!props[seg]) {
        props[seg] = { type: "object", properties: {} };
      }
      current = props[seg];
    }

    const leafName = segments[segments.length - 1];
    const props = current.properties as Record<string, unknown>;
    // Look up the field in the plugin schema
    const pluginProps = pluginSchema.properties as
      | Record<string, unknown>
      | undefined;
    if (pluginProps?.[leafName]) {
      props[leafName] = pluginProps[leafName];
    }
  }

  return root;
}
