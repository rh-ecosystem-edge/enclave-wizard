import { expect, test } from "@playwright/test";
import { WizardPage } from "../helpers/wizard-page";

test.describe("Connected + VMaaS + GPU scenario", () => {
  let wizard: WizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new WizardPage(page);
  });

  test("configures a connected cluster with VMaaS and GPU passthrough", async ({
    page,
  }) => {
    await wizard.goto();
    await wizard.clickGetStarted();

    // Select VMaaS flavor
    await wizard.selectFlavor("VMaaS");
    await wizard.clickNext();

    // Landing Zone: connected mode
    await wizard.fillLandingZone({
      disconnected: false,
      lzBmcIP: "192.168.100.1",
    });
    await wizard.clickNext();

    // Storage: defaults + credentials
    await wizard.fillStorage({
      quayUser: "admin",
      quayPassword: "quaypass",
    });
    await wizard.clickNext();

    // Hub Cluster
    await wizard.fillHubCluster({
      baseDomain: "vmaas-gpu.lab.example.com",
      clusterName: "gpu-edge",
      machineNetwork: "192.168.100.0/24",
      apiVIP: "192.168.100.200",
      ingressVIP: "192.168.100.201",
      rendezvousIP: "192.168.100.10",
      defaultDNS: "192.168.100.1",
      defaultGateway: "192.168.100.1",
      defaultPrefix: 24,
      pullSecret: '{"auths":{}}',
      sshPubKey: "ssh-rsa AAAA-gpu-test",
      hosts: [
        {
          name: "gpu-node-01",
          macAddress: "00:00:00:00:01:01",
          ipAddress: "192.168.100.11",
          redfish: "192.168.100.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
        {
          name: "gpu-node-02",
          macAddress: "00:00:00:00:01:02",
          ipAddress: "192.168.100.12",
          redfish: "192.168.100.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
        {
          name: "gpu-node-03",
          macAddress: "00:00:00:00:01:03",
          ipAddress: "192.168.100.13",
          redfish: "192.168.100.1",
          redfishUser: "admin",
          redfishPassword: "password",
          rootDisk: "/dev/sda",
        },
      ],
    });

    // OSAC Platform step: upload AAP license
    await wizard.fillOsac({});
    await wizard.clickNext();

    // VMaaS step — enable GPU passthrough
    await wizard.clickNext();
    await wizard.enableGpuPassthrough();
    const gpuCheckbox = page.locator("#enable-gpu");
    await expect(gpuCheckbox).toBeChecked();

    // Review
    await wizard.clickNext();
    const globalYaml = await wizard.getYamlContent("global.yaml");
    expect(globalYaml).toContain("vmaas-gpu.lab.example.com");
    expect(globalYaml).toContain("nvidia-gpu");

    await wizard.clickValidate();
    const validationPassed = await wizard.isValidationSuccess();
    expect(validationPassed).toBe(true);

    // Navigate to Deploy step
    await wizard.clickNext();
  });
});
