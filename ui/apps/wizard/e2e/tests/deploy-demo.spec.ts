import { test, expect } from "@playwright/test";
import { WizardPage } from "../helpers/wizard-page";

test.describe("Deploy flow (demo mode)", () => {
  test("walks through full wizard and starts deployment", async ({ page }) => {
    test.setTimeout(300_000);
    const wizard = new WizardPage(page);

    await wizard.goto();
    await wizard.clickGetStarted();

    await wizard.selectFlavor("CaaS");
    await wizard.clickNext();

    await wizard.fillLandingZone({ disconnected: false, lzBmcIP: "10.20.30.1" });
    await wizard.clickNext();

    await wizard.fillStorage({ quayUser: "admin", quayPassword: "quaypass" });
    await wizard.clickNext();

    await wizard.fillHubCluster({
      baseDomain: "deploy-demo.lab.local",
      clusterName: "demo",
      machineNetwork: "10.20.30.0/24",
      apiVIP: "10.20.30.200",
      ingressVIP: "10.20.30.201",
      rendezvousIP: "10.20.30.10",
      defaultDNS: "10.20.30.1",
      defaultGateway: "10.20.30.1",
      defaultPrefix: 24,
      pullSecret: '{"auths":{}}',
      sshPubKey: "ssh-rsa AAAA-deploy-demo-key",
      hosts: [
        { name: "cp-01", macAddress: "00:00:00:00:02:01", ipAddress: "10.20.30.11", redfish: "10.20.30.1", redfishUser: "admin", redfishPassword: "pass", rootDisk: "/dev/sda" },
        { name: "cp-02", macAddress: "00:00:00:00:02:02", ipAddress: "10.20.30.12", redfish: "10.20.30.1", redfishUser: "admin", redfishPassword: "pass", rootDisk: "/dev/sda" },
        { name: "cp-03", macAddress: "00:00:00:00:02:03", ipAddress: "10.20.30.13", redfish: "10.20.30.1", redfishUser: "admin", redfishPassword: "pass", rootDisk: "/dev/sda" },
      ],
    });
    await wizard.clickNext();

    await wizard.fillOsac({ rhbkInstances: 3, rhbkDbSize: "10Gi" });
    await wizard.clickNext();

    await wizard.fillCaas({ dnsZone: "deploy-demo.lab.local" });
    await wizard.clickNext();

    // Review — skip validation, go to Deploy
    await wizard.clickNext();

    // Click Deploy — handle reconnection to a previous run
    const deployButton = page.getByRole("button", { name: "Deploy" });
    if (await deployButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deployButton.click();
    }
    // If no Deploy button, a previous deployment reconnected — that's fine too

    // Verify deployment starts — output heading appears
    await expect(page.getByRole("heading", { name: "Output" })).toBeVisible({ timeout: 10_000 });

    // Wait for logs to start streaming
    await expect(page.getByText("TASK")).toBeVisible({ timeout: 30_000 });

    // Observe for 15s to verify logs keep streaming
    const logsLocator = page.locator("[class*='logsContainer'], pre").first();
    const initialText = await logsLocator.textContent() ?? "";
    await page.waitForTimeout(15_000);
    const laterText = await logsLocator.textContent() ?? "";

    // Logs should have grown (deployment is actively running)
    expect(laterText.length).toBeGreaterThan(initialText.length);
  });
});
