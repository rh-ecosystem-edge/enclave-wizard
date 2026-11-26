import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_EXPERIENCES } from "../experiences.ts";
import { CAAS_REQUIRES_COMPANION_MESSAGE } from "../flavorConstraints.ts";
import { FALLBACK_FLAVORS } from "../flavors.ts";
import { SelectFlavorStep } from "./SelectFlavorStep.tsx";

const mockDispatch = vi.fn();
const mockState = {
  currentStep: 1,
  selectedFlavors: new Set<string>(),
  configData: {},
  validationErrors: [],
  showValidation: false,
  schema: null,
  plugins: [],
};

function resetMockState(selected: string[] = []) {
  mockState.selectedFlavors = new Set(selected);
  mockDispatch.mockClear();
}

vi.mock("../WizardContext.tsx", () => ({
  useWizard: () => ({ state: mockState, dispatch: mockDispatch }),
}));

const mockCatalog = {
  experiences: FALLBACK_EXPERIENCES,
  flavors: FALLBACK_FLAVORS,
  loading: false,
  setState: vi.fn(),
};

vi.mock("../contexts/CatalogContext.tsx", () => ({
  useCatalog: () => mockCatalog,
}));

function renderStep() {
  return render(createElement(SelectFlavorStep));
}

describe("SelectFlavorStep", () => {
  it("renders all three flavor cards", () => {
    renderStep();

    expect(screen.getByText("CaaS")).toBeInTheDocument();
    expect(screen.getByText("VMaaS")).toBeInTheDocument();
    expect(screen.getByText("BMaaS")).toBeInTheDocument();
  });

  it("renders flavor subtitles", () => {
    renderStep();

    expect(screen.getByText("Containers as a Service")).toBeInTheDocument();
    expect(screen.getByText("VMs as a Service")).toBeInTheDocument();
    expect(screen.getByText("Bare Metal as a Service")).toBeInTheDocument();
  });

  it("shows no cards when catalog has empty flavors", () => {
    mockCatalog.flavors = [];
    renderStep();

    expect(screen.queryByText("CaaS")).not.toBeInTheDocument();
    expect(screen.queryByText("VMaaS")).not.toBeInTheDocument();
    expect(screen.queryByText("BMaaS")).not.toBeInTheDocument();

    mockCatalog.flavors = FALLBACK_FLAVORS;
  });

  it("dispatches TOGGLE_FLAVOR with experiences on click", async () => {
    const user = userEvent.setup();
    resetMockState();
    renderStep();

    const caasCard = screen.getByText("CaaS").closest("[role='button']");
    if (!caasCard) {
      throw new Error("CaaS card not found");
    }
    await user.click(caasCard);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "TOGGLE_FLAVOR",
      flavor: "caas",
      experiences: FALLBACK_EXPERIENCES,
    });
  });

  it("marks selected flavors as pressed", () => {
    resetMockState(["vmaas"]);
    renderStep();

    const cards = screen.getAllByRole("button");
    const vmaasCard = cards.find((c) => within(c).queryByText("VMaaS"));
    expect(vmaasCard).toHaveAttribute("aria-pressed", "true");

    const caasCard = cards.find((c) => within(c).queryByText("CaaS"));
    expect(caasCard).toHaveAttribute("aria-pressed", "false");

    resetMockState();
  });

  it("shows an inline message when CaaS is selected alone", () => {
    resetMockState(["caas"]);
    renderStep();

    expect(
      screen.getByText(CAAS_REQUIRES_COMPANION_MESSAGE),
    ).toBeInTheDocument();
    resetMockState();
  });

  it("dispatches when clearing the last companion while CaaS remains", async () => {
    const user = userEvent.setup();
    resetMockState(["caas", "vmaas"]);
    renderStep();

    const vmaasCard = screen.getByText("VMaaS").closest("[role='button']");
    if (!vmaasCard) {
      throw new Error("VMaaS card not found");
    }
    await user.click(vmaasCard);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TOGGLE_FLAVOR", flavor: "vmaas" }),
    );
    resetMockState();
  });
});
