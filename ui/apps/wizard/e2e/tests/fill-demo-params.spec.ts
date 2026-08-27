import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WizardPage } from "../helpers/wizard-page";

interface DemoParams {
  infra: {
    machineNetwork: string;
    gateway: string;
    apiVIP: string;
    ingressVIP: string;
    rendezvousIP: string;
    baseDomain: string;
    clusterName: string;
    defaultPrefix: number;
    bmc: { endpoint: string; user: string; password: string };
    hosts: Array<{
      name: string;
      mac: string;
      ip: string;
      disk: string;
      uuid: string;
    }>;
  };
  wizard: { url: string; password: string; lzBmcIP?: string };
}

const HOME = process.env.HOME ?? "/home/rpiccoli";

async function loadDemoParams(): Promise<DemoParams> {
  const paramsPath = resolve(__dirname, "../../../../..", "demo-params.json");
  return JSON.parse(await readFile(paramsPath, "utf-8"));
}

async function loadPullSecret(): Promise<string> {
  const path = process.env.PULL_SECRET ?? `${HOME}/src/secrets/pull-secret`;
  return (await readFile(path, "utf-8")).trim();
}

async function loadSshPubKey(): Promise<string> {
  const path = process.env.SSH_PUB_KEY ?? `${HOME}/.ssh/id_rsa.pub`;
  return (await readFile(path, "utf-8")).trim();
}

test("fill wizard from demo-params.json (stop before deploy)", async ({
  page,
}) => {
  test.setTimeout(0);
  const params = await loadDemoParams();
  const password = process.env.WIZARD_PASSWORD ?? params.wizard.password;
  const pullSecret = await loadPullSecret();
  const sshPubKey = await loadSshPubKey();

  // Login
  await page.goto("/wizard");
  await page.waitForLoadState("networkidle");
  const wizard = new WizardPage(page);
  await wizard.login(password);

  // Change password if the modal appears
  const getStarted = page.getByRole("button", { name: "Get started" });
  const newPwField = page.locator("#new-password");
  await Promise.race([
    getStarted.waitFor({ timeout: 10_000 }),
    newPwField.waitFor({ timeout: 10_000 }),
  ]);
  if (await newPwField.isVisible()) {
    await wizard.changePassword("pleaseletmein");
    await getStarted.waitFor({ timeout: 10_000 });
  }

  // Welcome
  await wizard.clickGetStarted();

  // Select flavors — wait for API init (experiences, config, schema) to complete
  await page.waitForLoadState("networkidle");
  await wizard.selectFlavor("CaaS");
  await wizard.selectFlavor("VMaaS");
  await wizard.selectFlavor("BMaaS");
  await wizard.clickNext();

  // Configure: Landing Zone
  await wizard.fillLandingZone({
    disconnected: false,
    lzBmcIP: params.wizard.lzBmcIP ?? "",
  });
  await wizard.clickNext();

  // Configure: Storage
  await wizard.fillStorage({
    storagePlugin: "lvms",
    quayBackend: "LocalStorage",
    quayUser: "admin",
    quayPassword: "quaypass",
  });
  await wizard.clickNext();

  // Configure: Hub Cluster
  await wizard.fillHubCluster({
    baseDomain: params.infra.baseDomain,
    clusterName: params.infra.clusterName,
    machineNetwork: params.infra.machineNetwork,
    apiVIP: params.infra.apiVIP,
    ingressVIP: params.infra.ingressVIP,
    rendezvousIP: params.infra.rendezvousIP,
    defaultDNS: params.infra.gateway,
    defaultGateway: params.infra.gateway,
    defaultPrefix: params.infra.defaultPrefix,
    pullSecret,
    sshPubKey,
    hosts: params.infra.hosts.map((h) => ({
      name: h.name,
      macAddress: h.mac,
      ipAddress: h.ip,
      rootDisk: h.disk,
      bmcSystemId: h.uuid,
      redfish: params.infra.bmc.endpoint,
      redfishUser: params.infra.bmc.user,
      redfishPassword: params.infra.bmc.password,
    })),
  });
  await wizard.clickNext();

  // Configure: OSAC Platform
  const manifestPath =
    process.env.AAP_MANIFEST ?? `${HOME}/src/enclave/manifest.zip`;
  await wizard.fillOsac({ aapLicenseFilePath: manifestPath });
  await wizard.clickNext();

  // Configure: remaining sub-steps (VMaaS, CaaS) — click through
  // Remove any empty discovery hosts on the CaaS step
  let safetyCount = 0;
  while (safetyCount < 10) {
    if (
      await page
        .locator("#osac-dns-zone")
        .isVisible({ timeout: 300 })
        .catch(() => false)
    ) {
      await wizard.fillCaas({ dnsZone: params.infra.baseDomain });
    }

    while (
      await page
        .locator('button[aria-label^="Remove host"]')
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false)
    ) {
      await page.locator('button[aria-label^="Remove host"]').first().click();
      await page.waitForTimeout(200);
    }

    const continueBtn = page.getByRole("button", { name: "Continue" });
    if (await continueBtn.count() > 0) {
      await continueBtn.scrollIntoViewIfNeeded();
      await continueBtn.click();
      await page.waitForTimeout(300);
      safetyCount++;
    } else {
      break;
    }
  }

  // Configure → Review
  await wizard.clickNext();

  if (!process.env.SKIP_PAUSE) {
    await page.pause();
  }
});
