import { describe, expect, it } from "vitest";
import {
  CAAS_REQUIRES_COMPANION_MESSAGE,
  isValidFlavorSelection,
  previewFlavorToggle,
  shouldRefuseFlavorToggle,
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

describe("shouldRefuseFlavorToggle", () => {
  it("allows selecting CaaS alone", () => {
    expect(shouldRefuseFlavorToggle(new Set(), "caas")).toBe(false);
  });

  it("allows clearing CaaS when it is alone", () => {
    expect(shouldRefuseFlavorToggle(new Set(["caas"]), "caas")).toBe(false);
  });

  it("refuses clearing the last companion while CaaS remains", () => {
    expect(
      shouldRefuseFlavorToggle(new Set(["caas", "vmaas"]), "vmaas"),
    ).toBe(true);
    expect(
      shouldRefuseFlavorToggle(new Set(["caas", "bmaas"]), "bmaas"),
    ).toBe(true);
  });

  it("allows clearing one companion when another remains with CaaS", () => {
    expect(
      shouldRefuseFlavorToggle(
        new Set(["caas", "vmaas", "bmaas"]),
        "vmaas",
      ),
    ).toBe(false);
  });

  it("allows clearing CaaS while companions remain", () => {
    expect(
      shouldRefuseFlavorToggle(new Set(["caas", "vmaas"]), "caas"),
    ).toBe(false);
  });
});

describe("previewFlavorToggle", () => {
  it("adds and removes flavors", () => {
    expect([...previewFlavorToggle(new Set(), "caas")]).toEqual(["caas"]);
    expect([...previewFlavorToggle(new Set(["caas"]), "caas")]).toEqual([]);
  });
});

describe("CAAS_REQUIRES_COMPANION_MESSAGE", () => {
  it("is a non-empty product string", () => {
    expect(CAAS_REQUIRES_COMPANION_MESSAGE.length).toBeGreaterThan(0);
  });
});
