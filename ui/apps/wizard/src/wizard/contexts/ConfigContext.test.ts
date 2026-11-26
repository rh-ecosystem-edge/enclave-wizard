import { describe, expect, it } from "vitest";
import { EXPERIENCES } from "../experiences.ts";
import { FLAVORS } from "../flavors.ts";
import {
  configReducer,
  initialConfigState,
  setNestedField,
} from "./ConfigContext.tsx";

describe("setNestedField", () => {
  it("sets a top-level key", () => {
    const result = setNestedField({}, ["name"], "test");
    expect(result).toEqual({ name: "test" });
  });

  it("sets a nested key", () => {
    const result = setNestedField({}, ["a", "b", "c"], 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });

  it("preserves sibling keys", () => {
    const result = setNestedField({ x: 1 }, ["y"], 2);
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it("returns original object for empty keys", () => {
    const obj = { a: 1 };
    expect(setNestedField(obj, [], "ignored")).toBe(obj);
  });
});

describe("configReducer", () => {
  describe("SET_FIELD", () => {
    it("sets a simple field", () => {
      const state = configReducer(initialConfigState, {
        type: "SET_FIELD",
        path: "global.baseDomain",
        value: "test.local",
      });
      expect(state.configData.global?.baseDomain).toBe("test.local");
    });

    it("sets a deeply nested field", () => {
      const state = configReducer(initialConfigState, {
        type: "SET_FIELD",
        path: "global.quayBackendRGWConfiguration.hostname",
        value: "rgw.example.com",
      });
      const global = state.configData.global as Record<string, unknown>;
      const rgw = global.quayBackendRGWConfiguration as Record<string, unknown>;
      expect(rgw.hostname).toBe("rgw.example.com");
    });

    it("preserves existing fields", () => {
      let state = configReducer(initialConfigState, {
        type: "SET_FIELD",
        path: "global.baseDomain",
        value: "a.com",
      });
      state = configReducer(state, {
        type: "SET_FIELD",
        path: "global.clusterName",
        value: "hub",
      });
      expect(state.configData.global?.baseDomain).toBe("a.com");
      expect(state.configData.global?.clusterName).toBe("hub");
    });
  });

  describe("TOGGLE_FLAVOR", () => {
    it("adds a flavor to selectedFlavors", () => {
      const state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(state.selectedFlavors.has("caas")).toBe(true);
    });

    it("removes a flavor on second toggle", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(state.selectedFlavors.has("caas")).toBe(false);
    });

    it("populates enabled_plugins from experience plugins", () => {
      const state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      const plugins = (state.configData.global as Record<string, unknown>)
        .enabled_plugins as string[];
      expect(plugins).toContain("osac");
      expect(plugins).toContain("aap");
      expect(plugins).toContain("trust-manager");
      expect(plugins).toContain("rhbk");
      expect(plugins).toContain("authorino");
    });

    it("sets osacProfile for single flavor", () => {
      const state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(
        (state.configData.global as Record<string, unknown>).osacProfile,
      ).toBe("caas");
    });

    it("sets osacProfile to development for multiple flavors", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "vmaas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(
        (state.configData.global as Record<string, unknown>).osacProfile,
      ).toBe("development");
    });

    it("includes cnv plugin for vmaas flavor", () => {
      const state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "vmaas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      const plugins = (state.configData.global as Record<string, unknown>)
        .enabled_plugins as string[];
      expect(plugins).toContain("cnv");
    });

    it("keeps shared plugins when toggling off one of two flavors", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "vmaas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      // Toggle caas OFF — shared plugins should remain via vmaas
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      const plugins = (state.configData.global as Record<string, unknown>)
        .enabled_plugins as string[];
      expect(plugins).toContain("osac");
      expect(plugins).toContain("aap");
      expect(plugins).toContain("trust-manager");
      expect(plugins).toContain("cnv");
      expect(state.selectedFlavors.has("vmaas")).toBe(true);
      expect(state.selectedFlavors.has("caas")).toBe(false);
    });

    it("allows clearing the last companion while CaaS remains", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "vmaas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "vmaas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(state.selectedFlavors.has("caas")).toBe(true);
      expect(state.selectedFlavors.has("vmaas")).toBe(false);
    });

    it("clears osacProfile when all flavors are deselected", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(
        (state.configData.global as Record<string, unknown>).osacProfile,
      ).toBe("caas");
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      expect(
        (state.configData.global as Record<string, unknown>).osacProfile,
      ).toBeUndefined();
    });

    it("clears flavor-managed plugins when all flavors are deselected", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      const plugins = (state.configData.global as Record<string, unknown>)
        .enabled_plugins as string[];
      expect(plugins).toEqual([]);
    });

    it("preserves non-flavor plugins when toggling flavors", () => {
      let state = configReducer(initialConfigState, {
        type: "SET_FIELD",
        path: "global.enabled_plugins",
        value: ["lvms"],
      });
      state = configReducer(state, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      const plugins = (state.configData.global as Record<string, unknown>)
        .enabled_plugins as string[];
      expect(plugins).toContain("lvms");
      expect(plugins).toContain("osac");
    });
  });

  describe("LOAD_CONFIG", () => {
    it("replaces configData entirely", () => {
      const config = {
        global: { baseDomain: "test.com" },
        certificates: { ca: "cert" },
        cloudInfra: { discovery_hosts: [] },
      };
      const state = configReducer(initialConfigState, {
        type: "LOAD_CONFIG",
        config,
      });
      expect(state.configData).toEqual(config);
    });

    it("does not affect selectedFlavors", () => {
      let state = configReducer(initialConfigState, {
        type: "TOGGLE_FLAVOR",
        flavor: "caas",
        experiences: EXPERIENCES,
        flavors: FLAVORS,
      });
      state = configReducer(state, {
        type: "LOAD_CONFIG",
        config: { global: { baseDomain: "new.com" } },
      });
      expect(state.selectedFlavors.has("caas")).toBe(true);
    });
  });
});
