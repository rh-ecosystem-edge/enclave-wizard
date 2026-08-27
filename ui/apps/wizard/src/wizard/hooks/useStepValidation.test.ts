import { renderHook } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  validateFields,
  validateHostEntries,
} from "../../schema/schemaUtils.ts";
import { STEP_REQUIRED_FIELDS } from "../stepFields.ts";
import { useStepValidation } from "./useStepValidation.ts";

// Minimal schema structure that validates required fields
const MOCK_SCHEMA = {
  properties: {
    global: {
      type: "object",
      properties: {
        lzBmcIP: { type: "string", doc: "Landing Zone BMC IP" },
        baseDomain: { type: "string", doc: "Base Domain" },
        clusterName: { type: "string", doc: "Cluster Name" },
        machineNetwork: { type: "string", doc: "Machine Network" },
        apiVIP: { type: "string", doc: "API VIP" },
        ingressVIP: { type: "string", doc: "Ingress VIP" },
        rendezvousIP: { type: "string", doc: "Rendezvous IP" },
        defaultDNS: { type: "string", doc: "DNS Server" },
        defaultGateway: { type: "string", doc: "Default Gateway" },
        defaultPrefix: { type: "number", doc: "Subnet Prefix" },
        storage_plugin: { type: "string", doc: "Storage Plugin" },
        pullSecret: { type: "object", doc: "Pull Secret" },
        sshPubKey: { type: "string", doc: "SSH Public Key" },
        agent_hosts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              macAddress: { type: "string" },
              ipAddress: { type: "string" },
              redfish: { type: "string" },
              redfishUser: { type: "string" },
              redfishPassword: { type: "string" },
              rootDisk: { type: "string" },
            },
            required: [
              "name",
              "macAddress",
              "ipAddress",
              "redfish",
              "redfishUser",
              "redfishPassword",
              "rootDisk",
            ],
          },
        },
      },
      required: [
        "lzBmcIP",
        "baseDomain",
        "clusterName",
        "machineNetwork",
        "apiVIP",
        "ingressVIP",
        "rendezvousIP",
        "defaultDNS",
        "defaultGateway",
        "defaultPrefix",
        "storage_plugin",
        "pullSecret",
        "sshPubKey",
      ],
    },
  },
};

// Mock context hooks so useStepValidation can be called via renderHook
let mockConfigState: Record<string, unknown> = {};
let mockCatalogState: Record<string, unknown> = {};

vi.mock("../contexts/ConfigContext.tsx", () => ({
  useConfig: () => ({ state: mockConfigState }),
}));

vi.mock("../contexts/CatalogContext.tsx", () => ({
  useCatalog: () => ({ state: mockCatalogState }),
}));

function renderValidation(subStepId: string) {
  return renderHook(() => useStepValidation(subStepId));
}

describe("step validation rules", () => {
  describe("landing-zone required fields", () => {
    it("returns errors for missing required fields", () => {
      const fields = STEP_REQUIRED_FIELDS["landing-zone"];
      const errors = validateFields(MOCK_SCHEMA, fields, { global: {} });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe("global.lzBmcIP");
    });

    it("returns no errors when required fields are filled", () => {
      const fields = STEP_REQUIRED_FIELDS["landing-zone"];
      const errors = validateFields(MOCK_SCHEMA, fields, {
        global: { lzBmcIP: "192.168.1.1" },
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("storage required fields", () => {
    it("returns error for missing storage_plugin", () => {
      const fields = STEP_REQUIRED_FIELDS.storage;
      const errors = validateFields(MOCK_SCHEMA, fields, { global: {} });
      expect(errors.some((e) => e.path === "global.storage_plugin")).toBe(true);
    });
  });

  describe("hub-cluster required fields", () => {
    it("validates multiple required hub-cluster fields", () => {
      const fields = STEP_REQUIRED_FIELDS["hub-cluster"].filter(
        (f) => f !== "global.agentHosts",
      );
      const errors = validateFields(MOCK_SCHEMA, fields, { global: {} });
      expect(errors.length).toBeGreaterThanOrEqual(5);
    });

    it("returns no errors when all hub-cluster fields provided", () => {
      const fields = STEP_REQUIRED_FIELDS["hub-cluster"].filter(
        (f) => f !== "global.agentHosts",
      );
      const errors = validateFields(MOCK_SCHEMA, fields, {
        global: {
          baseDomain: "test.local",
          clusterName: "hub",
          machineNetwork: "10.0.0.0/24",
          apiVIP: "10.0.0.100",
          ingressVIP: "10.0.0.101",
          rendezvousIP: "10.0.0.10",
          defaultDNS: "10.0.0.1",
          defaultGateway: "10.0.0.1",
          defaultPrefix: 24,
          pullSecret: { auths: {} },
          sshPubKey: "ssh-rsa AAAA",
        },
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("host validation", () => {
    it("validates required host entry fields", () => {
      const hosts = [{ name: "", macAddress: "", ipAddress: "" }];
      const errors = validateHostEntries(MOCK_SCHEMA, hosts, "Node");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("passes with valid host entries", () => {
      const hosts = [
        {
          name: "cp-0",
          macAddress: "00:00:00:00:00:01",
          ipAddress: "10.0.0.10",
          redfish: "10.0.0.1:8000",
          redfishUser: "admin",
          redfishPassword: "pass",
          rootDisk: "/dev/sda",
        },
      ];
      const errors = validateHostEntries(MOCK_SCHEMA, hosts, "Node");
      expect(errors).toHaveLength(0);
    });
  });
});

describe("useStepValidation custom rules", () => {
  describe("hub-cluster 3-node check", () => {
    it("requires exactly 3 control plane nodes", () => {
      mockConfigState = { configData: { global: { agent_hosts: [] } } };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("hub-cluster");
      const errors = result.current();
      expect(
        errors.some((e) => e.message.includes("Exactly 3 control plane")),
      ).toBe(true);
    });

    it("rejects 2 nodes", () => {
      const twoHosts = [
        { name: "cp-0", macAddress: "aa", ipAddress: "10.0.0.1", redfish: "r", redfishUser: "u", redfishPassword: "p", rootDisk: "/dev/sda" },
        { name: "cp-1", macAddress: "bb", ipAddress: "10.0.0.2", redfish: "r", redfishUser: "u", redfishPassword: "p", rootDisk: "/dev/sda" },
      ];
      mockConfigState = { configData: { global: { agent_hosts: twoHosts } } };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("hub-cluster");
      const errors = result.current();
      expect(errors.some((e) => e.path === "global.agentHosts")).toBe(true);
    });
  });

  describe("storage ODF validation", () => {
    it("requires ODF external config when backend is odf", () => {
      mockConfigState = {
        configData: { global: { storage_plugin: "odf", odfExternalConfig: "" } },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("storage");
      const errors = result.current();
      expect(
        errors.some((e) => e.path === "global.odfExternalConfig"),
      ).toBe(true);
    });
  });

  describe("storage VAST CSI validation", () => {
    it("requires VAST fields when backend is vast-csi", () => {
      mockConfigState = {
        configData: { global: { storage_plugin: "vast-csi" } },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("storage");
      const errors = result.current();
      expect(errors.some((e) => e.path === "global.vastEndpoint")).toBe(true);
      expect(errors.some((e) => e.path === "global.vastAdminUsername")).toBe(true);
      expect(errors.some((e) => e.path === "global.vastAdminPassword")).toBe(true);
      expect(errors.some((e) => e.path === "global.vastVipPool")).toBe(true);
    });

    it("accepts valid VAST fields", () => {
      mockConfigState = {
        configData: {
          global: {
            storage_plugin: "vast-csi",
            vastEndpoint: "https://vast.local",
            vastAdminUsername: "admin",
            vastAdminPassword: "secret",
            vastVipPool: {
              subnet_cidr: 24,
              ip_ranges: [{ start: "10.0.0.1", end: "10.0.0.10" }],
            },
          },
        },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("storage");
      const errors = result.current();
      const vastErrors = errors.filter(
        (e) => e.path.includes("vast") || e.path.includes("Vast"),
      );
      expect(vastErrors).toHaveLength(0);
    });
  });

  describe("OSAC license validation", () => {
    it("requires AAP subscription manifest for OSAC step", () => {
      mockConfigState = { configData: { global: {} } };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("osac");
      const errors = result.current();
      expect(
        errors.some((e) => e.path === "global.osacAapLicenseFile"),
      ).toBe(true);
    });

    it("passes when OSAC license is provided", () => {
      mockConfigState = {
        configData: { global: { osacAapLicenseFile: "/path/to/manifest.zip" } },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("osac");
      const errors = result.current();
      const osacErrors = errors.filter((e) =>
        e.path.includes("osacAapLicenseFile"),
      );
      expect(osacErrors).toHaveLength(0);
    });
  });

  describe("AAP license validation", () => {
    it("requires AAP subscription file for standalone AAP step", () => {
      mockConfigState = { configData: { global: { aapDefaults: {} } } };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("aap");
      const errors = result.current();
      expect(
        errors.some((e) => e.path === "global.aapDefaults.aapLicenseFile"),
      ).toBe(true);
    });

    it("passes when AAP license is provided", () => {
      mockConfigState = {
        configData: {
          global: {
            aapDefaults: { aapLicenseFile: "/uploads/manifest.zip" },
          },
        },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("aap");
      const errors = result.current();
      const aapErrors = errors.filter((e) =>
        e.path.includes("aapLicenseFile"),
      );
      expect(aapErrors).toHaveLength(0);
    });
  });

  describe("CaaS DNS validation", () => {
    it("requires DNS class and zone for CaaS step", () => {
      mockConfigState = { configData: { global: {} } };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("caas");
      const errors = result.current();
      expect(errors.some((e) => e.path === "global.osacDnsClass")).toBe(true);
      expect(errors.some((e) => e.path === "global.osacDnsZone")).toBe(true);
    });

    it("requires DNS zone when only class is set", () => {
      mockConfigState = {
        configData: { global: { osacDnsClass: "dns.route53.dns" } },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("caas");
      const errors = result.current();
      expect(errors.some((e) => e.path === "global.osacDnsClass")).toBe(false);
      expect(errors.some((e) => e.path === "global.osacDnsZone")).toBe(true);
    });

    it("passes when DNS class and zone are provided", () => {
      mockConfigState = {
        configData: {
          global: {
            osacDnsClass: "dns.route53.dns",
            osacDnsZone: "example.com",
          },
        },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("caas");
      const errors = result.current();
      const dnsErrors = errors.filter(
        (e) => e.path === "global.osacDnsClass" || e.path === "global.osacDnsZone",
      );
      expect(dnsErrors).toHaveLength(0);
    });

    it("rejects a DNS zone that is not a valid DNS name", () => {
      mockConfigState = {
        configData: {
          global: {
            osacDnsClass: "dns.route53.dns",
            osacDnsZone: "not a zone",
          },
        },
      };
      mockCatalogState = { schema: MOCK_SCHEMA };
      const { result } = renderValidation("caas");
      const errors = result.current();
      expect(
        errors.some(
          (e) =>
            e.path === "global.osacDnsZone" &&
            e.message.includes("valid DNS name"),
        ),
      ).toBe(true);
    });
  });
});
