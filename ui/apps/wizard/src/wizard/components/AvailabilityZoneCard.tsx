import {
  Card,
  CardBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput,
  Title,
} from "@patternfly/react-core";
import { ServerIcon } from "@patternfly/react-icons";
import type React from "react";
import type {
  NetrisSite,
  NetrisServer,
  NetrisSubnet,
} from "../../api/useNetrisApi.ts";
import { availabilityZoneCardStyles as styles } from "./availabilityZoneCardStyles.ts";

export interface AvailabilityZone {
  name: string;
  gateway: string;
  machineNetwork: string;
  dns: string;
  vpcName: string;
  siteIds: number[];
  assignedServerIds: number[];
}

interface AvailabilityZoneCardProps {
  index: number;
  zone: AvailabilityZone;
  onChange: (zone: AvailabilityZone) => void;
  sites?: NetrisSite[];
  servers?: NetrisServer[];
  subnets?: NetrisSubnet[];
  usedSiteIds?: number[];
}

export const emptyAvailabilityZone: AvailabilityZone = {
  name: "",
  gateway: "",
  machineNetwork: "",
  dns: "",
  vpcName: "",
  siteIds: [],
  assignedServerIds: [],
};

export const AvailabilityZoneCard: React.FC<AvailabilityZoneCardProps> = ({
  index,
  zone,
  onChange,
  sites,
  servers,
  subnets,
  usedSiteIds,
}) => {
  const prefix = `az-${index}`;
  const hasDiscovery = sites && sites.length > 0;

  const update = (field: keyof AvailabilityZone, value: unknown) =>
    onChange({ ...zone, [field]: value });

  const handleSiteToggle = (siteId: number) => {
    const current = zone.siteIds;
    const next = current.includes(siteId)
      ? current.filter((id) => id !== siteId)
      : [...current, siteId];

    const siteServers = (servers ?? []).filter((s) => next.includes(s.siteId));
    const serverIds = siteServers.map((s) => s.id);

    const siteSubnets = (subnets ?? []).filter(
      (s) => next.includes(s.siteId) && s.purpose === "common",
    );
    const firstSubnet = siteSubnets[0];

    const selectedSite = (sites ?? []).find((s) => s.id === siteId);

    const updated: AvailabilityZone = {
      ...zone,
      siteIds: next,
      assignedServerIds: serverIds,
      name: zone.name || (next.length === 1 && selectedSite ? selectedSite.name : zone.name),
      gateway: firstSubnet?.gateway ?? zone.gateway,
      machineNetwork: firstSubnet?.prefix ?? zone.machineNetwork,
      vpcName: zone.vpcName || `osac-${zone.name || selectedSite?.name || `zone-${index + 1}`}`,
    };
    onChange(updated);
  };

  const assignedServers = (servers ?? []).filter((s) =>
    zone.assignedServerIds.includes(s.id),
  );

  const availableSites = (sites ?? []).filter(
    (s) => zone.siteIds.includes(s.id) || !(usedSiteIds ?? []).includes(s.id),
  );

  return (
    <Card isRounded isCompact>
      <CardBody>
        <Title headingLevel="h4" size="md">
          Availability Zone {index + 1}
        </Title>
        <div className={styles.grid}>
          {hasDiscovery && (
            <div className={styles.siteSelector}>
              <FormGroup label="Populate from Sites" fieldId={`${prefix}-sites`}>
                <FormSelect
                  id={`${prefix}-sites`}
                  value=""
                  onChange={(_e, v) => {
                    if (v) handleSiteToggle(Number(v));
                  }}
                >
                  <FormSelectOption value="" label="Select a site to add..." />
                  {availableSites.map((site) => (
                    <FormSelectOption
                      key={site.id}
                      value={String(site.id)}
                      label={`${site.name} (${site.serverCount} servers, ${site.switchCount} switches)`}
                      isDisabled={zone.siteIds.includes(site.id)}
                    />
                  ))}
                </FormSelect>
                {zone.siteIds.length > 0 && (
                  <HelperText>
                    <HelperTextItem>
                      Sites: {zone.siteIds.map((id) => {
                        const site = (sites ?? []).find((s) => s.id === id);
                        return site?.name ?? id;
                      }).join(", ")}
                      {" "}
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--pf-t--global--color--status--danger--default)", cursor: "pointer", fontSize: "0.8125rem" }}
                        onClick={() => onChange({ ...zone, siteIds: [], assignedServerIds: [] })}
                      >
                        Clear all
                      </button>
                    </HelperTextItem>
                  </HelperText>
                )}
              </FormGroup>
            </div>
          )}

          <FormGroup label="Name" isRequired fieldId={`${prefix}-name`}>
            <TextInput
              id={`${prefix}-name`}
              value={zone.name}
              onChange={(_e, v) => update("name", v)}
              placeholder="e.g., zone-a"
              isRequired
            />
          </FormGroup>
          <FormGroup label="Gateway" isRequired fieldId={`${prefix}-gateway`}>
            <TextInput
              id={`${prefix}-gateway`}
              value={zone.gateway}
              onChange={(_e, v) => update("gateway", v)}
              placeholder="e.g., 10.0.1.1"
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="Machine Network"
            isRequired
            fieldId={`${prefix}-machine-network`}
          >
            <TextInput
              id={`${prefix}-machine-network`}
              value={zone.machineNetwork}
              onChange={(_e, v) => update("machineNetwork", v)}
              placeholder="e.g., 10.0.1.0/24"
              isRequired
            />
          </FormGroup>
          <FormGroup label="DNS" fieldId={`${prefix}-dns`}>
            <TextInput
              id={`${prefix}-dns`}
              value={zone.dns}
              onChange={(_e, v) => update("dns", v)}
              placeholder="Optional"
            />
            <HelperText>
              <HelperTextItem>Falls back to global DNS if empty</HelperTextItem>
            </HelperText>
          </FormGroup>

          {hasDiscovery && (
            <div className={styles.vpcField}>
              <FormGroup label="VPC Name" fieldId={`${prefix}-vpc`}>
                <TextInput
                  id={`${prefix}-vpc`}
                  value={zone.vpcName}
                  onChange={(_e, v) => update("vpcName", v)}
                  placeholder={`osac-zone-${index + 1}`}
                />
                <HelperText>
                  <HelperTextItem>
                    A dedicated VPC will be created for this AZ in Netris
                  </HelperTextItem>
                </HelperText>
              </FormGroup>
            </div>
          )}

          {assignedServers.length > 0 && (
            <div className={styles.assignedServers}>
              <Title headingLevel="h5" size="sm">
                <ServerIcon /> Assigned Servers ({assignedServers.length})
              </Title>
              <div style={{ marginTop: "0.25rem" }}>
                {assignedServers.map((server) => (
                  <span key={server.id} className={styles.serverChip}>
                    {server.name}
                    <span className={styles.serverDetail}>
                      BMC: {server.mgmtIp}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
