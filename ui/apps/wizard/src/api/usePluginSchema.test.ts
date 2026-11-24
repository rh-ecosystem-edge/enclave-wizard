import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPluginSchemaCache, usePluginSchema } from "./usePluginSchema.ts";

const MOCK_SCHEMA = {
  type: "object",
  properties: {
    trust_manager_ca_issuer_duration: {
      type: "string",
      description: "CA certificate lifetime",
    },
    trust_manager_ca_issuer_renew_before: {
      type: "string",
      description: "CA renewal period",
    },
  },
};

const mockFetch = vi.fn();

describe("usePluginSchema", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    clearPluginSchemaCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches schema for a plugin", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(MOCK_SCHEMA), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => usePluginSchema("trust-manager"));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.schema).toEqual(MOCK_SCHEMA);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/plugins/trust-manager/schema",
    );
  });

  it("returns null schema on 404", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => usePluginSchema("nonexistent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    const { result } = renderHook(() => usePluginSchema("broken"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("500");
  });

  it("caches schema across renders", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(MOCK_SCHEMA), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // First render
    const { result: result1, unmount } = renderHook(() =>
      usePluginSchema("trust-manager"),
    );

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Second render should use cache
    const { result: result2 } = renderHook(() =>
      usePluginSchema("trust-manager"),
    );

    // Should have schema immediately from cache (no loading)
    expect(result2.current.schema).toEqual(MOCK_SCHEMA);
    expect(result2.current.loading).toBe(false);
    // fetch should not have been called again
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows loading state initially", () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { result } = renderHook(() => usePluginSchema("slow-plugin"));

    expect(result.current.loading).toBe(true);
    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
