import { expect, test } from "@playwright/test";
import { WizardPage } from "../helpers/wizard-page";

test.describe("Connected + LVMS scenario", () => {
  let wizard: WizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new WizardPage(page);
  });

  test("completes the wizard end-to-end with connected LVMS config", async () => {
    await wizard.goto();
    await wizard.clickGetStarted();

    // Skip flavor selection
    await wizard.clickNext();

    // Landing Zone: connected mode
    await wizard.fillLandingZone({
      disconnected: false,
      lzBmcIP: "10.10.50.1",
    });
    await wizard.clickNext();

    // Storage: LVMS + quay credentials
    await wizard.fillStorage({
      quayUser: "admin",
      quayPassword: "quaypass",
    });
    await wizard.clickNext();

    // Hub Cluster
    await wizard.fillHubCluster({
      baseDomain: "connected-lvms.lab.local",
      clusterName: "edge-conn",
      machineNetwork: "10.10.50.0/24",
      apiVIP: "10.10.50.200",
      ingressVIP: "10.10.50.201",
      rendezvousIP: "10.10.50.10",
      defaultDNS: "10.10.50.1",
      defaultGateway: "10.10.50.1",
      defaultPrefix: 24,
      pullSecret: '{"auths":{}}',
      sshPubKey: "ssh-rsa AAAA-test-key",
      hosts: [
        {
          name: "ctrl-01",
          macAddress: "00:00:00:00:01:01",
          ipAddress: "10.10.50.11",
          redfish: "10.10.50.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
        {
          name: "ctrl-02",
          macAddress: "00:00:00:00:01:02",
          ipAddress: "10.10.50.12",
          redfish: "10.10.50.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
        {
          name: "ctrl-03",
          macAddress: "00:00:00:00:01:03",
          ipAddress: "10.10.50.13",
          redfish: "10.10.50.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
      ],
    });
    await wizard.clickNext();

    // Review: verify YAML and validate
    const yamlContent = await wizard.getYamlContent("global.yaml");
    expect(yamlContent).toContain("connected-lvms.lab.local");
    expect(yamlContent).toContain("edge-conn");
    expect(yamlContent).toContain("10.10.50.200");

    await wizard.clickValidate();
    const isValid = await wizard.isValidationSuccess();
    expect(isValid).toBe(true);

    // Navigate to Deploy step
    await wizard.clickNext();
  });
});
