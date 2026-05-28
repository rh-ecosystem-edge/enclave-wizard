import {
  Card,
  CardBody,
  Flex,
  FlexItem,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  TextInput,
  Title,
} from "@patternfly/react-core";
import type React from "react";
import { hostEntryCardStyles as styles } from "./hostEntryCardStyles.ts";

interface HostEntry {
  name: string;
  macAddress: string;
  ipAddress: string;
  redfish: string;
  redfishUser: string;
  redfishPassword: string;
  rootDisk: string;
  zone?: string;
  sources?: string[];
}

interface HostEntryCardProps {
  index: number;
  host: HostEntry;
  onChange: (host: HostEntry) => void;
  label?: string;
  availabilityZones?: string[];
  zoneReadOnly?: boolean;
}

export type { HostEntry };

export const HostEntryCard: React.FC<HostEntryCardProps> = ({
  index,
  host,
  onChange,
  label = "Host",
  availabilityZones,
  zoneReadOnly,
}) => {
  const prefix = `${label.toLowerCase().replace(/\s+/g, "-")}-${index}`;

  const update = (field: keyof HostEntry, value: string) =>
    onChange({ ...host, [field]: value });

  return (
    <Card isRounded isCompact>
      <CardBody>
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <FlexItem>
            <Title headingLevel="h4" size="md">
              {label} {index + 1}
            </Title>
          </FlexItem>
          {host.sources?.map((src) => (
            <FlexItem key={src}>
              <Label isCompact>{src}</Label>
            </FlexItem>
          ))}
        </Flex>
        <div className={styles.grid}>
          <FormGroup label="Name" isRequired fieldId={`${prefix}-name`}>
            <TextInput
              id={`${prefix}-name`}
              value={host.name}
              onChange={(_e, v) => update("name", v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label="MAC address" isRequired fieldId={`${prefix}-mac`}>
            <TextInput
              id={`${prefix}-mac`}
              value={host.macAddress}
              onChange={(_e, v) => update("macAddress", v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label="IP address" isRequired fieldId={`${prefix}-ip`}>
            <TextInput
              id={`${prefix}-ip`}
              value={host.ipAddress}
              onChange={(_e, v) => update("ipAddress", v)}
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="Redfish IP"
            isRequired
            fieldId={`${prefix}-redfish`}
          >
            <TextInput
              id={`${prefix}-redfish`}
              value={host.redfish}
              onChange={(_e, v) => update("redfish", v)}
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="Redfish user"
            isRequired
            fieldId={`${prefix}-rfuser`}
          >
            <TextInput
              id={`${prefix}-rfuser`}
              value={host.redfishUser}
              onChange={(_e, v) => update("redfishUser", v)}
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="Redfish password"
            isRequired
            fieldId={`${prefix}-rfpass`}
          >
            <TextInput
              id={`${prefix}-rfpass`}
              type="password"
              value={host.redfishPassword}
              onChange={(_e, v) => update("redfishPassword", v)}
              isRequired
            />
          </FormGroup>
          <div className={styles.fullWidth}>
          <FormGroup
            label="Root Disk Path"
            isRequired
            fieldId={`${prefix}-rootdisk`}
          >
            <TextInput
              id={`${prefix}-rootdisk`}
              value={host.rootDisk}
              onChange={(_e, v) => update("rootDisk", v)}
              isRequired
            />
          </FormGroup>
          </div>
          {availabilityZones && availabilityZones.length >= 2 && (
            <FormGroup
              label="Availability Zone"
              isRequired
              fieldId={`${prefix}-zone`}
            >
              <FormSelect
                id={`${prefix}-zone`}
                value={host.zone ?? ""}
                onChange={(_e, v) => update("zone", v)}
                isRequired
                isDisabled={zoneReadOnly}
              >
                <FormSelectOption value="" label="Select a zone" isPlaceholder />
                {availabilityZones.map((az) => (
                  <FormSelectOption key={az} value={az} label={az} />
                ))}
              </FormSelect>
            </FormGroup>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
