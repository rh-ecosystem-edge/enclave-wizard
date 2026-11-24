import {
  Button,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  Popover,
  Radio,
  TextArea,
  TextInput,
  Title,
} from "@patternfly/react-core";
import {
  MinusCircleIcon,
  OutlinedQuestionCircleIcon,
  PlusCircleIcon,
} from "@patternfly/react-icons";
import type React from "react";
import { useRowKeys } from "../components/useRowKeys.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

const STORAGE_PLUGINS = ["lvms", "odf", "vast-csi"];

type IPRange = { start: string; end: string };
type VipPool = { subnet_cidr: number; ip_ranges: IPRange[] };

function VipPoolEditor({
  value,
  onChange,
}: {
  value: VipPool | undefined;
  onChange: (v: VipPool) => void;
}) {
  const pool: VipPool = value ?? {
    subnet_cidr: 24,
    ip_ranges: [{ start: "", end: "" }],
  };
  const ranges =
    pool.ip_ranges.length > 0 ? pool.ip_ranges : [{ start: "", end: "" }];
  const { keys: rangeKeys, removeAt: removeRangeKey } = useRowKeys(
    ranges.length,
  );
  const rangeRows = ranges.map((range, index) => ({
    key: rangeKeys[index] ?? "",
    range,
    index,
  }));

  const update = (patch: Partial<VipPool>) =>
    onChange({ ...pool, ...patch } as VipPool);

  const setRange = (i: number, field: keyof IPRange, val: string) =>
    update({
      ip_ranges: ranges.map((r, idx) =>
        idx === i ? { ...r, [field]: val } : r,
      ),
    });

  return (
    <>
      <FormGroup
        label="Subnet prefix length"
        fieldId="vast-vip-cidr"
        isRequired
      >
        <TextInput
          id="vast-vip-cidr"
          type="number"
          value={String(pool.subnet_cidr ?? 24)}
          onChange={(_e, v) => update({ subnet_cidr: parseInt(v, 10) || 24 })}
          style={{ maxWidth: "6rem" }}
        />
      </FormGroup>
      <FormGroup label="IP ranges" fieldId="vast-vip-ranges" isRequired>
        {rangeRows.map((row) => (
          <Flex
            key={row.key}
            gap={{ default: "gapSm" }}
            alignItems={{ default: "alignItemsCenter" }}
            style={{ marginBottom: "0.5rem" }}
          >
            <FlexItem>
              <TextInput
                id={`vast-vip-start-${row.index}`}
                placeholder="Start IP"
                value={row.range.start}
                onChange={(_e, v) => setRange(row.index, "start", v)}
                aria-label="Range start IP"
              />
            </FlexItem>
            <FlexItem>—</FlexItem>
            <FlexItem>
              <TextInput
                id={`vast-vip-end-${row.index}`}
                placeholder="End IP"
                value={row.range.end}
                onChange={(_e, v) => setRange(row.index, "end", v)}
                aria-label="Range end IP"
              />
            </FlexItem>
            <FlexItem>
              <Button
                variant="plain"
                aria-label="Remove range"
                onClick={() => {
                  removeRangeKey(row.index);
                  update({
                    ip_ranges: ranges.filter((_, idx) => idx !== row.index),
                  });
                }}
                isDisabled={ranges.length === 1}
              >
                <MinusCircleIcon />
              </Button>
            </FlexItem>
          </Flex>
        ))}
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          onClick={() =>
            update({ ip_ranges: [...ranges, { start: "", end: "" }] })
          }
        >
          Add IP range
        </Button>
      </FormGroup>
    </>
  );
}

const RGW_FIELDS = [
  { key: "access_key", label: "Access key" },
  { key: "secret_key", label: "Secret key" },
  { key: "bucket_name", label: "Bucket name" },
  { key: "hostname", label: "Hostname" },
] as const;

const subFormStyle = { marginLeft: "1.75rem", marginTop: "0.75rem" };

export const StorageStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const onChange = (path: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path, value });

  const configData = state.configData as Record<string, unknown>;
  const globalData = (configData.global ?? {}) as Record<string, unknown>;
  const enabledPlugins: string[] = Array.isArray(globalData.enabled_plugins)
    ? (globalData.enabled_plugins as string[])
    : ["lvms"];
  const backend = (globalData.storage_plugin as string) ?? "lvms";
  const quayBackend = (globalData.quayBackend as string) ?? "LocalStorage";
  const odfExternalConfig = (globalData.odfExternalConfig as string) ?? "";
  const vastEndpoint = (globalData.vastEndpoint as string) ?? "";
  const vastAdminUsername = (globalData.vastAdminUsername as string) ?? "";
  const vastAdminPassword = (globalData.vastAdminPassword as string) ?? "";
  const vastVipPool = globalData.vastVipPool as VipPool | undefined;
  const lvmsConfig = (globalData.lvmsConfig ?? {}) as Record<string, unknown>;
  const deviceSelector = (lvmsConfig.deviceSelector ?? {}) as Record<
    string,
    unknown
  >;
  const optionalPaths: string[] = Array.isArray(deviceSelector.optionalPaths)
    ? (deviceSelector.optionalPaths as string[])
    : [];
  const { keys: pathKeys, removeAt: removePathKey } = useRowKeys(
    optionalPaths.length,
  );
  const pathRows = optionalPaths.map((path, index) => ({
    key: pathKeys[index] ?? "",
    path,
    index,
  }));
  const quayUser = (globalData.quayUser as string) ?? "";
  const quayPassword = (globalData.quayPassword as string) ?? "";
  const rgwConfig = (globalData.quayBackendRGWConfiguration ?? {}) as Record<
    string,
    unknown
  >;

  const selectBackend = (next: string) => {
    const nonStorage = enabledPlugins.filter(
      (p) => !STORAGE_PLUGINS.includes(p),
    );
    onChange("global.enabled_plugins", [...nonStorage, next]);
    onChange("global.storage_plugin", next);
    if (next !== "odf") {
      onChange("global.odfExternalConfig", undefined);
    }
    if (next !== "lvms") {
      onChange("global.lvmsConfig", undefined);
    }
    if (next !== "vast-csi") {
      onChange("global.vastEndpoint", undefined);
      onChange("global.vastAdminUsername", undefined);
      onChange("global.vastAdminPassword", undefined);
      onChange("global.vastVipPool", undefined);
    }
  };

  const setOptionalPaths = (paths: string[]) => {
    if (paths.length === 0) {
      onChange("global.lvmsConfig", undefined);
    } else {
      onChange("global.lvmsConfig", {
        deviceSelector: { optionalPaths: paths },
      });
    }
  };

  const updateRgwField = (key: string, value: string) =>
    onChange("global.quayBackendRGWConfiguration", {
      ...rgwConfig,
      [key]: value,
    });

  const quayLocalLabel =
    backend === "vast-csi"
      ? "VAST NFS tier (infra-quay)"
      : backend === "odf"
        ? "Local storage (ODF PVC)"
        : "Local storage (LVMS PVC)";

  const quayLocalDescription =
    backend === "vast-csi"
      ? "Quay images are stored on the VAST cluster using a dedicated NFS tier."
      : "Quay images are stored on a PVC backed by the cluster block storage.";

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        Storage
      </Title>

      <Title
        headingLevel="h3"
        size="lg"
        className={stepStyles.firstSectionTitle}
      >
        Hub Cluster Storage
      </Title>
      <p className={stepStyles.subtitle}>
        Block storage provisioner for the OpenShift cluster.
      </p>

      <Radio
        id="storage-lvms"
        name="storage-backend"
        label="LVMS — Logical Volume Manager Storage"
        description="Local block storage using LVM thin provisioning on node disks. Default option with no external dependencies."
        isChecked={backend === "lvms"}
        onChange={() => selectBackend("lvms")}
      />

      {backend === "lvms" && (
        <FormGroup
          label="Disk device paths"
          fieldId="lvms-optional-paths"
          style={subFormStyle}
        >
          <FormHelperText>
            Optional. Specify disk device paths for LVMS to use. Leave empty to
            auto-discover all available block devices.
          </FormHelperText>
          {pathRows.map((row) => (
            <Flex
              key={row.key}
              gap={{ default: "gapSm" }}
              alignItems={{ default: "alignItemsCenter" }}
              style={{
                marginBottom: "0.5rem",
                marginTop: row.index === 0 ? "0.5rem" : undefined,
              }}
            >
              <FlexItem grow={{ default: "grow" }}>
                <TextInput
                  id={`lvms-path-${row.index}`}
                  value={row.path}
                  onChange={(_e, v) =>
                    setOptionalPaths(
                      optionalPaths.map((p, idx) =>
                        idx === row.index ? v : p,
                      ),
                    )
                  }
                  placeholder="/dev/sdb or /dev/disk/by-path/..."
                  aria-label="Disk device path"
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label="Remove disk path"
                  onClick={() => {
                    removePathKey(row.index);
                    setOptionalPaths(
                      optionalPaths.filter((_, idx) => idx !== row.index),
                    );
                  }}
                >
                  <MinusCircleIcon />
                </Button>
              </FlexItem>
            </Flex>
          ))}
          <Button
            variant="link"
            icon={<PlusCircleIcon />}
            onClick={() => setOptionalPaths([...optionalPaths, ""])}
          >
            Add disk path
          </Button>
        </FormGroup>
      )}

      <Radio
        id="storage-odf"
        name="storage-backend"
        label="ODF — OpenShift Data Foundation"
        description="External Ceph cluster via ODF. Requires connection details from ceph-external-cluster-details-exporter.py."
        isChecked={backend === "odf"}
        onChange={() => selectBackend("odf")}
        style={{ marginTop: "0.5rem" }}
      />
      {backend === "odf" && (
        <FormGroup
          label="ODF External Ceph connection details"
          isRequired
          fieldId="odf-external-config"
          style={subFormStyle}
        >
          <TextArea
            id="odf-external-config"
            value={odfExternalConfig}
            onChange={(_e, v) => onChange("global.odfExternalConfig", v)}
            placeholder='[{"name": "external-cluster-user-command", "kind": "ConfigMap", "data": ...}]'
            rows={4}
            isRequired
            aria-label="ODF External Ceph Connection Details"
          />
          <FormHelperText>
            JSON output from ceph-external-cluster-details-exporter.py
          </FormHelperText>
        </FormGroup>
      )}

      <Radio
        id="storage-vast"
        name="storage-backend"
        label="VAST CSI — VAST Data Storage"
        description="VAST Data storage via CSI driver. Provides dedicated NFS and block tiers, including a dedicated NFS tier for the image registry."
        isChecked={backend === "vast-csi"}
        onChange={() => selectBackend("vast-csi")}
        style={{ marginTop: "0.5rem" }}
      />
      {backend === "vast-csi" && (
        <Flex
          direction={{ default: "column" }}
          gap={{ default: "gapMd" }}
          style={subFormStyle}
        >
          <FlexItem>
            <FormGroup
              label="Management endpoint"
              fieldId="vast-endpoint"
              isRequired
            >
              <TextInput
                id="vast-endpoint"
                value={vastEndpoint}
                onChange={(_e, v) => onChange("global.vastEndpoint", v)}
                placeholder="https://vms.example.com"
                isRequired
              />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <FormGroup
              label="Admin username"
              fieldId="vast-username"
              isRequired
            >
              <TextInput
                id="vast-username"
                value={vastAdminUsername}
                onChange={(_e, v) => onChange("global.vastAdminUsername", v)}
                isRequired
              />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <FormGroup
              label="Admin password"
              fieldId="vast-password"
              isRequired
            >
              <TextInput
                id="vast-password"
                type="password"
                value={vastAdminPassword}
                onChange={(_e, v) => onChange("global.vastAdminPassword", v)}
                isRequired
              />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <Title headingLevel="h4" size="md">
              VIP Pool (CSI traffic)
            </Title>
          </FlexItem>
          <FlexItem>
            <VipPoolEditor
              value={vastVipPool}
              onChange={(v) => onChange("global.vastVipPool", v)}
            />
          </FlexItem>
        </Flex>
      )}

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Image Registry
      </Title>
      <p className={stepStyles.subtitle}>
        Storage backend for the hub cluster's Quay image registry.
      </p>

      <Radio
        id="quay-local"
        name="quay-backend"
        label={quayLocalLabel}
        description={quayLocalDescription}
        isChecked={quayBackend === "LocalStorage"}
        onChange={() => onChange("global.quayBackend", "LocalStorage")}
      />
      <Radio
        id="quay-rgw"
        name="quay-backend"
        label={
          <span>
            External object storage{" "}
            <Popover bodyContent="Any S3-compatible object store such as Ceph RadosGW, AWS S3, or MinIO. Requires access credentials and a pre-created bucket.">
              <OutlinedQuestionCircleIcon
                style={{ cursor: "pointer", color: "#6a6e73" }}
              />
            </Popover>
          </span>
        }
        description="Quay images are stored in an independent S3-compatible object store."
        isChecked={quayBackend === "RadosGWStorage"}
        onChange={() => onChange("global.quayBackend", "RadosGWStorage")}
        style={{ marginTop: "0.5rem" }}
      />
      {quayBackend === "RadosGWStorage" && (
        <Flex
          direction={{ default: "column" }}
          gap={{ default: "gapMd" }}
          style={subFormStyle}
        >
          {RGW_FIELDS.map(({ key, label }) => (
            <FlexItem key={key}>
              <FormGroup label={label} isRequired fieldId={`rgw-${key}`}>
                <TextInput
                  id={`rgw-${key}`}
                  value={(rgwConfig[key] as string) ?? ""}
                  onChange={(_e, v) => updateRgwField(key, v)}
                  isRequired
                  type={key === "secret_key" ? "password" : "text"}
                />
              </FormGroup>
            </FlexItem>
          ))}
        </Flex>
      )}

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Registry Credentials
      </Title>
      <p className={stepStyles.subtitle}>
        Admin credentials for the landing zone mirror registry and the hub
        cluster's Quay registry.
      </p>
      <FormGroup label="Admin username" isRequired fieldId="quay-user">
        <TextInput
          id="quay-user"
          value={quayUser}
          onChange={(_e, v) => onChange("global.quayUser", v)}
          isRequired
        />
      </FormGroup>
      <FormGroup label="Admin password" isRequired fieldId="quay-password">
        <TextInput
          id="quay-password"
          type="password"
          value={quayPassword}
          onChange={(_e, v) => onChange("global.quayPassword", v)}
          isRequired
        />
      </FormGroup>
    </Form>
  );
};
