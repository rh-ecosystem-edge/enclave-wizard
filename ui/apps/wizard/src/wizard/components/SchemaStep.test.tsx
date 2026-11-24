import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPluginSchemaCache } from "../../api/usePluginSchema.ts";
import { WizardProvider } from "../WizardContext.tsx";
import { SchemaStep } from "./SchemaStep.tsx";

const MOCK_PLUGIN_SCHEMA = {
  type: "object",
  properties: {
    trust_manager_ca_issuer_duration: {
      type: "string",
      description: "CA certificate lifetime",
      doc: "Lifetime of the CA certificate",
    },
    trust_manager_ca_issuer_renew_before: {
      type: "string",
      description: "CA renewal period",
      doc: "How long before expiry to renew",
    },
  },
};

const mockFetch = vi.fn();

function renderWithWizard(ui: React.ReactElement) {
  return render(<WizardProvider>{ui}</WizardProvider>);
}

describe("SchemaStep", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    clearPluginSchemaCache();
    mockFetch.mockReset();
    // Default: openapi.json returns 404 (useOpenApiSchema is not in play here)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading spinner while schema is being fetched", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

    renderWithWizard(
      <SchemaStep
        pluginName="trust-manager"
        fieldPaths={[
          "global.trustManagerDefaults.trust_manager_ca_issuer_duration",
        ]}
      />,
    );

    expect(
      screen.getByLabelText("Loading plugin configuration"),
    ).toBeInTheDocument();
  });

  it("renders form fields from plugin schema", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(MOCK_PLUGIN_SCHEMA), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithWizard(
      <SchemaStep
        pluginName="trust-manager"
        fieldPaths={[
          "global.trustManagerDefaults.trust_manager_ca_issuer_duration",
          "global.trustManagerDefaults.trust_manager_ca_issuer_renew_before",
        ]}
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Loading plugin configuration"),
      ).not.toBeInTheDocument();
    });

    // Schema fields should render using the humanized labels from schemaUtils
    expect(
      screen.getByText("Lifetime of the CA certificate"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How long before expiry to renew"),
    ).toBeInTheDocument();
  });

  it("shows error alert when schema is unavailable and no fallback", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    renderWithWizard(
      <SchemaStep
        pluginName="missing-plugin"
        fieldPaths={["global.some_field"]}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Plugin configuration unavailable"),
      ).toBeInTheDocument();
    });
  });

  it("renders fallback when schema is unavailable", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    renderWithWizard(
      <SchemaStep
        pluginName="missing-plugin"
        fieldPaths={["global.some_field"]}
        fallback={<div>Fallback content here</div>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Fallback content here")).toBeInTheDocument();
    });
  });

  it("renders fallback on fetch error", async () => {
    mockFetch.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    renderWithWizard(
      <SchemaStep
        pluginName="broken-plugin"
        fieldPaths={["global.some_field"]}
        fallback={<div>Error fallback</div>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Error fallback")).toBeInTheDocument();
    });
  });
});
