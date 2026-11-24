import {
  Card,
  CardBody,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
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
  bmcSystemId?: string;
}

interface HostEntryCardProps {
  index: number;
  host: HostEntry;
  onChange: (host: HostEntry) => void;
  label?: string;
}

export type { HostEntry };

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const IP_RE =
  /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

function validateField(value: string, pattern?: RegExp): "default" | "error" {
  if (!value) return "default";
  if (pattern && !pattern.test(value)) return "error";
  return "default";
}

export const HostEntryCard: React.FC<HostEntryCardProps> = ({
  index,
  host,
  onChange,
  label = "Host",
}) => {
  const prefix = `${label.toLowerCase().replace(/\s+/g, "-")}-${index}`;

  const update = (field: keyof HostEntry, value: string) =>
    onChange({ ...host, [field]: value });

  return (
    <Card isCompact>
      <CardBody>
        <Title headingLevel="h4" size="md">
          {label} {index + 1}
        </Title>
        <div className={styles.grid}>
          <FormGroup label="Hostname" isRequired fieldId={`${prefix}-name`}>
            <TextInput
              id={`${prefix}-name`}
              value={host.name}
              onChange={(_e, v) => update("name", v)}
              placeholder="e.g. ctrl-plane-0"
              isRequired
            />
          </FormGroup>
          <FormGroup label="MAC address" isRequired fieldId={`${prefix}-mac`}>
            <TextInput
              id={`${prefix}-mac`}
              value={host.macAddress}
              onChange={(_e, v) => update("macAddress", v)}
              placeholder="00:1a:2b:3c:4d:5e"
              validated={validateField(host.macAddress, MAC_RE)}
              isRequired
            />
            {host.macAddress && !MAC_RE.test(host.macAddress) && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    Expected format: 00:1a:2b:3c:4d:5e
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <FormGroup label="IP address" isRequired fieldId={`${prefix}-ip`}>
            <TextInput
              id={`${prefix}-ip`}
              value={host.ipAddress}
              onChange={(_e, v) => update("ipAddress", v)}
              placeholder="192.168.1.10"
              validated={validateField(host.ipAddress, IP_RE)}
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="BMC address"
            isRequired
            fieldId={`${prefix}-redfish`}
          >
            <TextInput
              id={`${prefix}-redfish`}
              value={host.redfish}
              onChange={(_e, v) => update("redfish", v)}
              placeholder="192.168.1.200"
              isRequired
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Redfish/IPMI management IP or IP:port
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup
            label="BMC username"
            isRequired
            fieldId={`${prefix}-rfuser`}
          >
            <TextInput
              id={`${prefix}-rfuser`}
              value={host.redfishUser}
              onChange={(_e, v) => update("redfishUser", v)}
              placeholder="admin"
              isRequired
            />
          </FormGroup>
          <FormGroup
            label="BMC password"
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
              label="Installation disk"
              isRequired
              fieldId={`${prefix}-rootdisk`}
            >
              <TextInput
                id={`${prefix}-rootdisk`}
                value={host.rootDisk}
                onChange={(_e, v) => update("rootDisk", v)}
                placeholder="/dev/sda"
                isRequired
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Block device path for OS installation (e.g. /dev/sda,
                    /dev/disk/by-path/...)
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </div>
          <div className={styles.fullWidth}>
            <FormGroup label="BMC System ID" fieldId={`${prefix}-bmcsystemid`}>
              <TextInput
                id={`${prefix}-bmcsystemid`}
                value={host.bmcSystemId ?? ""}
                onChange={(_e, v) => update("bmcSystemId", v)}
                placeholder="Auto-detected if empty"
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Redfish System ID (UUID). Leave empty for single-system
                    BMCs.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
