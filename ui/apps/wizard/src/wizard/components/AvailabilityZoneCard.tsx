import {
  Card,
  CardBody,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
  Title,
} from "@patternfly/react-core";
import type React from "react";
import { availabilityZoneCardStyles as styles } from "./availabilityZoneCardStyles.ts";

interface AvailabilityZone {
  name: string;
  gateway: string;
  machineNetwork: string;
  dns: string;
}

interface AvailabilityZoneCardProps {
  index: number;
  zone: AvailabilityZone;
  onChange: (zone: AvailabilityZone) => void;
}

export type { AvailabilityZone };

export const emptyAvailabilityZone: AvailabilityZone = {
  name: "",
  gateway: "",
  machineNetwork: "",
  dns: "",
};

export const AvailabilityZoneCard: React.FC<AvailabilityZoneCardProps> = ({
  index,
  zone,
  onChange,
}) => {
  const prefix = `az-${index}`;

  const update = (field: keyof AvailabilityZone, value: string) =>
    onChange({ ...zone, [field]: value });

  return (
    <Card isRounded isCompact>
      <CardBody>
        <Title headingLevel="h4" size="md">
          Availability Zone {index + 1}
        </Title>
        <div className={styles.grid}>
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
        </div>
      </CardBody>
    </Card>
  );
};
