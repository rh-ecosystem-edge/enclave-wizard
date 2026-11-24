import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WizardHeader } from "./WizardHeader.tsx";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderHeader(currentStep: number) {
  return render(
    <MemoryRouter future={routerFuture}>
      <WizardHeader currentStep={currentStep} />
    </MemoryRouter>,
  );
}

describe("WizardHeader", () => {
  it("renders logo", () => {
    renderHeader(0);
    // RedHatLogo renders an SVG, check for its container
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders Tasks link", () => {
    renderHeader(0);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("does not render stepper on welcome step", () => {
    renderHeader(0);
    expect(screen.queryByLabelText("Wizard progress")).not.toBeInTheDocument();
  });

  it("renders stepper on non-welcome steps", () => {
    renderHeader(1);
    expect(screen.getByLabelText("Wizard progress")).toBeInTheDocument();
  });

  it("marks current step correctly", () => {
    renderHeader(2);
    // The Configure step (index 2) should be current
    const configStep = screen.getByLabelText("Configure");
    expect(configStep).toBeInTheDocument();
  });
});
