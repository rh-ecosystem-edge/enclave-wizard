import { describe, expect, it } from "vitest";
import {
  CAAS_REQUIRES_COMPANION_MESSAGE,
  flavorConstraintMessage,
  isValidFlavorSelection,
  SELECT_AT_LEAST_ONE_SERVICE_MESSAGE,
} from "./flavorConstraints.ts";

describe("isValidFlavorSelection", () => {
  it("rejects empty selection", () => {
    expect(isValidFlavorSelection(new Set())).toBe(false);
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

describe("flavorConstraintMessage", () => {
  it("stays silent for a pristine empty selection", () => {
    expect(flavorConstraintMessage(new Set())).toBeNull();
    expect(
      flavorConstraintMessage(new Set(), { selectionTouched: false }),
    ).toBeNull();
  });

  it("asks for a service when empty after the user interacted", () => {
    expect(flavorConstraintMessage(new Set(), { selectionTouched: true })).toBe(
      SELECT_AT_LEAST_ONE_SERVICE_MESSAGE,
    );
  });

  it("shows the CaaS companion message for CaaS alone", () => {
    expect(flavorConstraintMessage(new Set(["caas"]))).toBe(
      CAAS_REQUIRES_COMPANION_MESSAGE,
    );
  });

  it("returns null for valid selections", () => {
    expect(flavorConstraintMessage(new Set(["vmaas"]))).toBeNull();
    expect(flavorConstraintMessage(new Set(["caas", "vmaas"]))).toBeNull();
  });
});

describe("constraint message strings", () => {
  it("are non-empty product strings", () => {
    expect(CAAS_REQUIRES_COMPANION_MESSAGE.length).toBeGreaterThan(0);
    expect(SELECT_AT_LEAST_ONE_SERVICE_MESSAGE.length).toBeGreaterThan(0);
  });
});
