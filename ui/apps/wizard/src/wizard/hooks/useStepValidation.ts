import { useCallback } from "react";
import {
  type StepValidationError,
  validateFields,
  validateHostEntries,
} from "../../schema/schemaUtils.ts";
import { useCatalog } from "../contexts/CatalogContext.tsx";
import { useConfig } from "../contexts/ConfigContext.tsx";
import { isValidDnsZone } from "../dnsZone.ts";
import { STEP_REQUIRED_FIELDS } from "../stepFields.ts";

export function useStepValidation(
  currentSubStepId: string | undefined,
): () => StepValidationError[] {
  const { state: config } = useConfig();
  const { state: catalog } = useCatalog();

  return useCallback((): StepValidationError[] => {
    if (!catalog.schema || !currentSubStepId) return [];

    const fieldsToValidate = STEP_REQUIRED_FIELDS[currentSubStepId];
    let errors: StepValidationError[] = [];

    if (fieldsToValidate) {
      const nonHostFields = fieldsToValidate.filter(
        (f) => f !== "global.agentHosts",
      );
      errors = validateFields(
        catalog.schema,
        nonHostFields,
        config.configData as Record<string, unknown>,
      );
    }

    if (currentSubStepId === "storage") {
      const globalData = ((config.configData as Record<string, unknown>)
        .global ?? {}) as Record<string, unknown>;
      const disconnected = globalData.disconnected !== false;
      const backend = globalData.storage_plugin as string;
      if (
        backend === "odf" &&
        !((globalData.odfExternalConfig as string) ?? "").trim()
      ) {
        errors.push({
          path: "global.odfExternalConfig",
          label: "ODF connection details",
          message: "ODF external Ceph connection details are required",
        });
      }
      if (backend === "vast-csi") {
        for (const [field, label] of [
          ["vastEndpoint", "Management endpoint"],
          ["vastAdminUsername", "Admin username"],
          ["vastAdminPassword", "Admin password"],
        ] as const) {
          if (!((globalData[field] as string) ?? "").trim()) {
            errors.push({
              path: `global.${field}`,
              label,
              message: `${label} is required for VAST CSI`,
            });
          }
        }
        const pool = globalData.vastVipPool as
          | {
              subnet_cidr?: number;
              ip_ranges?: { start: string; end: string }[];
            }
          | undefined;
        if (
          !pool?.ip_ranges?.length ||
          pool.ip_ranges.some((r) => !r.start.trim() || !r.end.trim())
        ) {
          errors.push({
            path: "global.vastVipPool",
            label: "VIP pool",
            message:
              "VIP pool with at least one complete IP range is required for VAST CSI",
          });
        }
      }
      if (disconnected) {
        for (const [field, label] of [
          ["quayUser", "Admin username"],
          ["quayPassword", "Admin password"],
        ] as const) {
          if (!((globalData[field] as string) ?? "").trim()) {
            errors.push({
              path: `global.${field}`,
              label,
              message: `Quay ${label} is required`,
            });
          }
        }
        const quayBackend = globalData.quayBackend as string;
        if (quayBackend === "RadosGWStorage") {
          const rgw = (globalData.quayBackendRGWConfiguration ?? {}) as Record<
            string,
            unknown
          >;
          for (const key of [
            "access_key",
            "secret_key",
            "bucket_name",
            "hostname",
          ]) {
            if (
              !rgw[key] ||
              (typeof rgw[key] === "string" &&
                (rgw[key] as string).trim() === "")
            ) {
              errors.push({
                path: `global.quayBackendRGWConfiguration.${key}`,
                label: key,
                message: `${key} is required for RadosGW backend`,
              });
            }
          }
        }
      }
    }

    if (currentSubStepId === "osac") {
      const globalData = ((config.configData as Record<string, unknown>)
        .global ?? {}) as Record<string, unknown>;
      if (!((globalData.osacAapLicenseFile as string) ?? "").trim()) {
        errors.push({
          path: "global.osacAapLicenseFile",
          label: "AAP subscription manifest",
          message: "AAP subscription manifest is required for OSAC",
        });
      }
    }

    if (currentSubStepId === "caas") {
      const globalData = ((config.configData as Record<string, unknown>)
        .global ?? {}) as Record<string, unknown>;
      if (!((globalData.osacDnsClass as string) ?? "").trim()) {
        errors.push({
          path: "global.osacDnsClass",
          label: "DNS class",
          message: "DNS class is required for CaaS",
        });
      }
      if (!((globalData.osacDnsZone as string) ?? "").trim()) {
        errors.push({
          path: "global.osacDnsZone",
          label: "DNS zone",
          message: "DNS zone is required for CaaS",
        });
      } else if (!isValidDnsZone(globalData.osacDnsZone as string)) {
        errors.push({
          path: "global.osacDnsZone",
          label: "DNS zone",
          message: "DNS zone must be a valid DNS name (e.g. example.com)",
        });
      }
    }

    if (currentSubStepId === "aap") {
      const globalData = ((config.configData as Record<string, unknown>)
        .global ?? {}) as Record<string, unknown>;
      const aapDefaults = (globalData.aapDefaults ?? {}) as Record<
        string,
        unknown
      >;
      if (!((aapDefaults.aapLicenseFile as string) ?? "").trim()) {
        errors.push({
          path: "global.aapDefaults.aapLicenseFile",
          label: "Subscription file path",
          message: "AAP subscription file path is required",
        });
      }
    }

    if (currentSubStepId === "hub-cluster") {
      const globalData = ((config.configData as Record<string, unknown>)
        .global ?? {}) as Record<string, unknown>;
      const agentHosts = Array.isArray(globalData.agent_hosts)
        ? (globalData.agent_hosts as Record<string, unknown>[])
        : [];
      if (agentHosts.length !== 3) {
        errors.push({
          path: "global.agentHosts",
          label: "Control Plane Nodes",
          message: `Exactly 3 control plane nodes are required (currently ${agentHosts.length})`,
        });
      }
      if (agentHosts.length === 3) {
        errors.push(...validateHostEntries(catalog.schema, agentHosts, "Node"));
      }
    }

    return errors;
  }, [currentSubStepId, catalog.schema, config.configData]);
}
