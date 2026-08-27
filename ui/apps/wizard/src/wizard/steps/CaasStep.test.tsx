import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { CaasStep } from "./CaasStep.tsx";

const mockDispatch = vi.fn();
const mockState = {
  currentStep: 2,
  selectedFlavors: new Set(["caas"]),
  configData: { global: {}, cloudInfra: { discovery_hosts: [] } },
  validationErrors: [],
  showValidation: false,
  schema: null,
  plugins: [],
};

vi.mock("../WizardContext.tsx", () => ({
  useWizard: () => ({ state: mockState, dispatch: mockDispatch }),
}));

function renderStep() {
  return render(createElement(CaasStep));
}

describe("CaasStep", () => {
  it("renders global DNS class and DNS zone fields", () => {
    renderStep();

    expect(screen.getByLabelText("DNS class")).toBeInTheDocument();
    expect(screen.getByLabelText("DNS zone")).toBeInTheDocument();
    expect(screen.getByText("These settings apply to every host registered below.")).toBeInTheDocument();
  });

  it("dispatches SET_FIELD for DNS class", async () => {
    const user = userEvent.setup();
    mockDispatch.mockClear();
    renderStep();

    await user.selectOptions(screen.getByLabelText("DNS class"), "dns.route53.dns");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_FIELD",
      path: "global.osacDnsClass",
      value: "dns.route53.dns",
    });
  });

  it("dispatches SET_FIELD for DNS zone", () => {
    mockDispatch.mockClear();
    renderStep();

    fireEvent.change(screen.getByLabelText("DNS zone"), {
      target: { value: "example.com" },
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_FIELD",
      path: "global.osacDnsZone",
      value: "example.com",
    });
  });

  it("shows a format error for an invalid DNS zone", () => {
    mockState.showValidation = true;
    mockState.configData = {
      global: { osacDnsClass: "dns.route53.dns", osacDnsZone: "not a zone" },
      cloudInfra: { discovery_hosts: [] },
    };
    renderStep();

    expect(
      screen.getByText("Enter a valid DNS name (e.g. example.com)"),
    ).toBeInTheDocument();

    mockState.showValidation = false;
    mockState.configData = { global: {}, cloudInfra: { discovery_hosts: [] } };
  });
});
