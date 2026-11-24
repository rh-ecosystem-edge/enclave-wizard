import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogProvider, useCatalog } from "../contexts/CatalogContext.tsx";
import { FALLBACK_EXPERIENCES } from "../experiences.ts";
import { FALLBACK_FLAVORS } from "../flavors.ts";
import { useWizardInit } from "./useWizardInit.ts";

function useTestHook() {
  useWizardInit();
  return useCatalog();
}

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(CatalogProvider, null, children);
}

describe("useWizardInit", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches experiences from API when available", async () => {
    const apiExperiences = [
      {
        id: "caas",
        name: "Containers as a Service",
        description: "CaaS description",
        plugins: [{ name: "osac", order: 200 }],
      },
    ];

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ experiences: apiExperiences }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/experiences");
    expect(result.current.experiences).toEqual(apiExperiences);
  });

  it("handles huma-wrapped response with $schema field", async () => {
    const apiExperiences = [
      { id: "caas", name: "CaaS", description: "d", plugins: [] },
      { id: "vmaas", name: "VMaaS", description: "d", plugins: [] },
      { id: "bmaas", name: "BMaaS", description: "d", plugins: [] },
    ];

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          $schema: "https://localhost/schemas/ExperiencesOutputBody.json",
          experiences: apiExperiences,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.experiences).toEqual(apiExperiences);
    expect(result.current.flavors).toHaveLength(3);
  });

  it("falls back to hardcoded experiences when API returns 404", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.experiences).toEqual(FALLBACK_EXPERIENCES);
    expect(result.current.flavors).toEqual(FALLBACK_FLAVORS);
  });

  it("falls back to hardcoded experiences when fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.experiences).toEqual(FALLBACK_EXPERIENCES);
    expect(result.current.flavors).toEqual(FALLBACK_FLAVORS);
  });

  it("falls back to hardcoded experiences when API returns 500", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.experiences).toEqual(FALLBACK_EXPERIENCES);
  });

  it("derives flavors from fetched experiences", async () => {
    // Return only caas and vmaas experiences, not bmaas
    const apiExperiences = [
      {
        id: "caas",
        name: "CaaS",
        description: "CaaS",
        plugins: [{ name: "osac", order: 200 }],
      },
      {
        id: "vmaas",
        name: "VMaaS",
        description: "VMaaS",
        plugins: [{ name: "cnv", order: 104 }],
      },
    ];

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ experiences: apiExperiences }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useTestHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have only caas and vmaas flavors, not bmaas
    expect(result.current.flavors.map((f) => f.id)).toEqual(["caas", "vmaas"]);
  });

  it("starts in loading state", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useTestHook(), { wrapper });

    expect(result.current.loading).toBe(true);

    // Flush the async catalog update so React does not warn about act(...).
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
