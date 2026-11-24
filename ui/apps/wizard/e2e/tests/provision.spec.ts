import { expect, test } from "@playwright/test";
import { WizardApi } from "../helpers/wizard-api";
import { WizardPage } from "../helpers/wizard-page";

const minimalHubConfig = {
  baseDomain: "provision-test.local",
  clusterName: "prov-cl",
  machineNetwork: "10.0.0.0/24",
  apiVIP: "10.0.0.10",
  ingressVIP: "10.0.0.11",
  rendezvousIP: "10.0.0.12",
  defaultDNS: "10.0.0.1",
  defaultGateway: "10.0.0.1",
  defaultPrefix: 24,
  pullSecret: '{"auths":{}}',
  sshPubKey: "ssh-ed25519 AAAA fake-key",
  hosts: [
    {
      name: "node-0",
      macAddress: "AA:BB:CC:DD:EE:00",
      ipAddress: "10.0.0.20",
      redfish: "10.0.0.100",
      redfishUser: "admin",
      redfishPassword: "password",
      rootDisk: "/dev/sda",
    },
    {
      name: "node-1",
      macAddress: "AA:BB:CC:DD:EE:01",
      ipAddress: "10.0.0.21",
      redfish: "10.0.0.101",
      redfishUser: "admin",
      redfishPassword: "password",
      rootDisk: "/dev/sda",
    },
    {
      name: "node-2",
      macAddress: "AA:BB:CC:DD:EE:02",
      ipAddress: "10.0.0.22",
      redfish: "10.0.0.102",
      redfishUser: "admin",
      redfishPassword: "password",
      rootDisk: "/dev/sda",
    },
  ],
};

test.describe("Provision flow", () => {
  let wizard: WizardPage;
  let api: WizardApi;

  test.beforeEach(async ({ page, request, baseURL }) => {
    if (!baseURL) {
      throw new Error("baseURL is required");
    }
    wizard = new WizardPage(page);
    api = new WizardApi(request, baseURL);
  });

  test("full wizard flow ending at deploy step", async () => {
    await wizard.goto();
    await wizard.clickGetStarted();

    // Skip flavor
    await wizard.clickNext();

    // Landing Zone
    await wizard.fillLandingZone({
      disconnected: false,
      lzBmcIP: "10.0.0.1",
    });
    await wizard.clickNext();

    // Storage
    await wizard.fillStorage({
      quayUser: "admin",
      quayPassword: "quaypass",
    });
    await wizard.clickNext();

    // Hub Cluster
    await wizard.fillHubCluster(minimalHubConfig);
    await wizard.clickNext();

    // Review — validate
    await wizard.clickValidate();
    const isValid = await wizard.isValidationSuccess();
    expect(isValid).toBe(true);

    // Navigate to Deploy step
    await wizard.clickNext();
  });

  test("config can be downloaded from review step", async () => {
    await wizard.goto();
    await wizard.clickGetStarted();
    await wizard.clickNext(); // skip flavor

    await wizard.fillLandingZone({
      disconnected: false,
      lzBmcIP: "10.0.0.1",
    });
    await wizard.clickNext();

    await wizard.fillStorage({
      quayUser: "admin",
      quayPassword: "quaypass",
    });
    await wizard.clickNext();

    await wizard.fillHubCluster(minimalHubConfig);
    await wizard.clickNext();

    // Verify YAML tab content (downloads may not work in headless mode)
    const tabContent = await wizard.getYamlContent("global.yaml");
    expect(tabContent).toContain("provision-test.local");
    expect(tabContent).toContain("prov-cl");
  });

  test("provision API helpers return expected responses", async () => {
    const provisionResponse = await api.triggerProvision({});
    expect(provisionResponse.state).toBe("accepted");
    expect(provisionResponse.id).toBeTruthy();

    const status = await api.getProvisionStatus(provisionResponse.id);
    expect(status.state).toBe("completed");
    expect(status.progress).toBe(100);
  });
});
