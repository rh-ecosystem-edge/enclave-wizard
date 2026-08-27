import { EnclaveConfigToJSON } from "@enclave-wizard-ui/api-client";
import { describe, expect, it } from "vitest";
import { buildFinalConfig } from "./buildFinalConfig.ts";

// Simulates the full path: UI state -> buildFinalConfig -> EnclaveConfigToJSON -> wire JSON
// This is what the PUT /api/v1/config endpoint receives.
function buildWireConfig(configData: Record<string, unknown>) {
  const typed = buildFinalConfig({ configData });
  return EnclaveConfigToJSON(typed);
}

describe("buildFinalConfig", () => {
  it("passes through whatever disconnected value is in configData", () => {
    const wireTrue = buildWireConfig({
      global: { disconnected: true, baseDomain: "test.local" },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wireTrue.global.disconnected).toBe(true);

    const wireFalse = buildWireConfig({
      global: { disconnected: false, baseDomain: "test.local" },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wireFalse.global.disconnected).toBe(false);
  });

  it("preserves OSAC fields through the full round-trip", () => {
    const wire = buildWireConfig({
      global: {
        baseDomain: "test.local",
        osacProfile: "caas",
        osacAapLicenseFile: "/path/to/manifest.zip",
        osacBYODatabase: false,
        osacDnsClass: "dns.route53.dns",
        osacDnsZone: "example.com",
        enabled_plugins: [
          "lvms",
          "trust-manager",
          "rhbk",
          "authorino",
          "aap",
          "osac",
        ],
      },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wire.global.osacProfile).toBe("caas");
    expect(wire.global.osacAapLicenseFile).toBe("/path/to/manifest.zip");
    expect(wire.global.osacBYODatabase).toBe(false);
    expect(wire.global.osacDnsClass).toBe("dns.route53.dns");
    expect(wire.global.osacDnsZone).toBe("example.com");
    expect(wire.global.enabled_plugins).toEqual([
      "lvms",
      "trust-manager",
      "rhbk",
      "authorino",
      "aap",
      "osac",
    ]);
  });

  it("preserves RHBK fields through the full round-trip", () => {
    const wire = buildWireConfig({
      global: {
        baseDomain: "test.local",
        rhbk_instances: 3,
        rhbk_deploy_database: true,
        rhbk_db_size: "10Gi",
      },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wire.global.rhbk_instances).toBe(3);
    expect(wire.global.rhbk_deploy_database).toBe(true);
    expect(wire.global.rhbk_db_size).toBe("10Gi");
  });

  it("preserves bmcSystemId in agent_hosts", () => {
    const wire = buildWireConfig({
      global: {
        baseDomain: "test.local",
        agent_hosts: [
          {
            name: "cp-0",
            macAddress: "00:00:00:00:00:01",
            ipAddress: "10.0.0.10",
            redfish: "10.0.0.1:8100",
            redfishUser: "admin",
            redfishPassword: "pass",
            rootDisk: "/dev/sda",
            bmcSystemId: "abc-123-uuid",
          },
        ],
      },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wire.global.agent_hosts[0].bmcSystemId).toBe("abc-123-uuid");
  });

  it("sets default workingDir when not provided", () => {
    const wire = buildWireConfig({
      global: { baseDomain: "test.local" },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wire.global.workingDir).toBe("/home/enclave");
  });

  it("preserves existing workingDir", () => {
    const wire = buildWireConfig({
      global: { baseDomain: "test.local", workingDir: "/custom/path" },
      certificates: {},
      cloudInfra: { discovery_hosts: [] },
    });
    expect(wire.global.workingDir).toBe("/custom/path");
  });
});
