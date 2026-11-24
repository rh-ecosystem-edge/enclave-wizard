import { expect, test } from "@playwright/test";
import { WizardPage } from "../helpers/wizard-page";

test.describe("Disconnected + ODF + GPU scenario", () => {
  let wizard: WizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new WizardPage(page);
  });

  test("completes full wizard flow with disconnected, ODF, and GPU enabled", async ({
    page,
  }) => {
    await wizard.goto();
    await wizard.clickGetStarted();

    // Select VMaaS flavor (includes GPU passthrough option)
    await wizard.selectFlavor("VMaaS");
    await wizard.clickNext();

    // Landing Zone: disconnected mode
    await wizard.fillLandingZone({
      disconnected: true,
      lzBmcIP: "172.20.0.1",
    });
    await wizard.clickNext();

    // Storage: ODF + quay credentials
    await wizard.fillStorage({
      storagePlugin: "odf",
      odfExternalConfig: '{"clusterID":"e2e-ceph"}',
      quayUser: "registry-admin",
      quayPassword: "odf-gpu-secret",
      quayBackend: "LocalStorage",
    });
    await wizard.clickNext();

    // Hub Cluster
    await wizard.fillHubCluster({
      baseDomain: "odf-gpu.enclave.io",
      clusterName: "gpu-mgmt",
      machineNetwork: "172.20.0.0/24",
      apiVIP: "172.20.0.200",
      ingressVIP: "172.20.0.201",
      rendezvousIP: "172.20.0.10",
      defaultDNS: "172.20.0.1",
      defaultGateway: "172.20.0.1",
      defaultPrefix: 24,
      pullSecret: '{"auths":{}}',
      sshPubKey: "ssh-rsa AAAA-gpu-test",
      hosts: [
        {
          name: "gpu-node-01",
          macAddress: "AA:BB:CC:DD:01:01",
          ipAddress: "172.20.0.11",
          redfish: "172.20.0.100",
          redfishUser: "admin",
          redfishPassword: "redfish01",
          rootDisk: "/dev/sda",
        },
        {
          name: "gpu-node-02",
          macAddress: "AA:BB:CC:DD:01:02",
          ipAddress: "172.20.0.12",
          redfish: "172.20.0.101",
          redfishUser: "admin",
          redfishPassword: "redfish02",
          rootDisk: "/dev/sda",
        },
        {
          name: "gpu-node-03",
          macAddress: "AA:BB:CC:DD:01:03",
          ipAddress: "172.20.0.13",
          redfish: "172.20.0.102",
          redfishUser: "admin",
          redfishPassword: "redfish03",
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
    expect(globalYaml).toContain("odf-gpu.enclave.io");
    expect(globalYaml).toContain("nvidia-gpu");

    await wizard.clickValidate();

    // Navigate to Deploy step
    await wizard.clickNext();
  });
});
