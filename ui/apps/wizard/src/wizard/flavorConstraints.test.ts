import { describe, expect, it } from "vitest";
import {
  CAAS_REQUIRES_COMPANION_MESSAGE,
  isValidFlavorSelection,
} from "./flavorConstraints.ts";

describe("isValidFlavorSelection", () => {
  it("allows empty selection", () => {
    expect(isValidFlavorSelection(new Set())).toBe(true);
  });

  it("allows VMaaS only", () => {
    expect(isValidFlavorSelection(new Set(["vmaas"]))).toBe(true);
  });

  it("allows BMaaS only", () => {
    expect(isValidFlavorSelection(new Set(["bmaas"]))).toBe(true);
  });

  it("rejects CaaS only", () => {
    expect(isValidFlavorSelection(new Set(["caas"]))).toBe(false);
  });

  it("allows CaaS + VMaaS", () => {
    expect(isValidFlavorSelection(new Set(["caas", "vmaas"]))).toBe(true);
  });

  it("allows CaaS + BMaaS", () => {
    expect(isValidFlavorSelection(new Set(["caas", "bmaas"]))).toBe(true);
  });

  it("allows all three", () => {
    expect(isValidFlavorSelection(new Set(["caas", "vmaas", "bmaas"]))).toBe(
      true,
    );
  });
});

describe("CAAS_REQUIRES_COMPANION_MESSAGE", () => {
  it("is a non-empty product string", () => {
    expect(CAAS_REQUIRES_COMPANION_MESSAGE.length).toBeGreaterThan(0);
  });
});
