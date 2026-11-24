import { useCallback, useEffect, useRef, useState } from "react";

export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  doc?: string;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: JSONSchema;
  [key: string]: unknown;
}

export interface UsePluginSchemaReturn {
  schema: JSONSchema | null;
  loading: boolean;
  error: Error | null;
}

// Module-level cache so schema is fetched at most once per plugin per session
const schemaCache = new Map<string, JSONSchema>();

export function usePluginSchema(pluginName: string): UsePluginSchemaReturn {
  const [schema, setSchema] = useState<JSONSchema | null>(
    schemaCache.get(pluginName) ?? null,
  );
  const [loading, setLoading] = useState(!schemaCache.has(pluginName));
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef<string | null>(null);

  const fetchSchema = useCallback(async (name: string) => {
    const cached = schemaCache.get(name);
    if (cached) {
      setSchema(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`/api/v1/plugins/${name}/schema`);
      if (resp.status === 404) {
        setSchema(null);
        setLoading(false);
        return;
      }
      if (!resp.ok) {
        throw new Error(
          `Failed to fetch schema for plugin ${name}: ${resp.status}`,
        );
      }
      const data: JSONSchema = await resp.json();
      schemaCache.set(name, data);
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Avoid re-fetching if we already fetched for this plugin name
    if (fetchedRef.current === pluginName && !loading) return;
    fetchedRef.current = pluginName;
    fetchSchema(pluginName);
  }, [pluginName, fetchSchema, loading]);

  return { schema, loading, error };
}

/** Clear the schema cache (useful for testing). */
export function clearPluginSchemaCache(): void {
  schemaCache.clear();
}
