import { describe, expect, it } from "vitest";
import {
  extractPluginConfig,
  OSAC_PLUGIN_KEYS,
  stripPluginKeys,
} from "./ReviewStep.tsx";

describe("Review YAML split for OSAC DNS fields", () => {
  const globalData = {
    baseDomain: "test.local",
    osacProfile: "caas",
    osacDnsClass: "dns.route53.dns",
    osacDnsZone: "example.com",
  };

  it("includes DNS fields in plugins/osac.yaml", () => {
    const osac = extractPluginConfig(globalData, OSAC_PLUGIN_KEYS);
    expect(osac).toMatchObject({
      osacDnsClass: "dns.route53.dns",
      osacDnsZone: "example.com",
    });
  });

  it("strips DNS fields from global.yaml", () => {
    const stripped = stripPluginKeys(globalData);
    expect(stripped).not.toHaveProperty("osacDnsClass");
    expect(stripped).not.toHaveProperty("osacDnsZone");
    expect(stripped.baseDomain).toBe("test.local");
  });
});
