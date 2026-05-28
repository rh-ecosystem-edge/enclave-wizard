import {
  Button,
  ExpandableSection,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  Title,
} from "@patternfly/react-core";
import { MinusCircleIcon } from "@patternfly/react-icons";
import type React from "react";
import { useState } from "react";
import type { DiscoveredInventory, DiscoveredNode } from "../../api/useDiscoveryApi.ts";
import { SchemaFormRenderer } from "../../schema/SchemaFormRenderer.tsx";
import { useWizard } from "../WizardContext.tsx";
import { CertificateField } from "../components/CertificateField.tsx";
import { HostEntryCard, type HostEntry } from "../components/HostEntryCard.tsx";
import { stepStyles } from "./stepStyles.ts";

const CLUSTER_FIELDS = ["global.baseDomain", "global.clusterName"];

const NETWORK_FIELDS = [
  "global.machineNetwork",
  "global.apiVIP",
  "global.ingressVIP",
  "global.rendezvousIP",
  "global.defaultDNS",
  "global.defaultGateway",
  "global.defaultPrefix",
];

const EMPTY_HOST: HostEntry = {
  name: "",
  macAddress: "",
  ipAddress: "",
  redfish: "",
  redfishUser: "",
  redfishPassword: "",
  rootDisk: "",
};

const HUB_CERTS = [
  { path: "certificates.sslAPICertificateFullChain", label: "API Certificate (Full Chain)" },
  { path: "certificates.sslAPICertificateKey", label: "API Certificate Key" },
  { path: "certificates.sslIngressCertificateFullChain", label: "Ingress Certificate (Full Chain)" },
  { path: "certificates.sslIngressCertificateKey", label: "Ingress Certificate Key" },
  { path: "certificates.sslCACertificate", label: "Root CA Certificate" },
];

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function nodeToHostEntry(node: DiscoveredNode): HostEntry {
  return {
    name: node.name,
    macAddress: node.macAddress || "",
    ipAddress: node.ipAddress || node.bmcIp || "",
    redfish: node.bmcIp || "",
    redfishUser: node.bmcUser || "",
    redfishPassword: node.bmcPassword || "",
    rootDisk: node.rootDisk || "/dev/sda",
  };
}

export const HUB_REQUIRED_FIELDS = [
  "global.baseDomain",
  "global.clusterName",
  "global.machineNetwork",
  "global.apiVIP",
  "global.ingressVIP",
  "global.rendezvousIP",
  "global.defaultDNS",
  "global.defaultGateway",
  "global.defaultPrefix",
  "global.pullSecret",
  "global.sshPubKey",
];

export const HubClusterStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const [certsOpen, setCertsOpen] = useState(false);

  const onChange = (path: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path, value });

  const configData = state.configData as Record<string, unknown>;
  const globalData = (configData.global ?? {}) as Record<string, unknown>;

  const topologyData = (configData.topology ?? {}) as Record<string, unknown>;
  const azNames: string[] = Array.isArray(topologyData.availability_zones)
    ? (topologyData.availability_zones as { name: string }[])
        .map((az) => az.name)
        .filter(Boolean)
    : [];

  const discovery = configData.discovery as DiscoveredInventory | null;
  const discoveredNodes = discovery?.nodes ?? [];
  const hasDiscovery = discoveredNodes.length > 0;

  const agentHosts: HostEntry[] = Array.isArray(globalData.agent_hosts)
    ? (globalData.agent_hosts as HostEntry[])
    : [];

  const setAgentHosts = (hosts: HostEntry[]) =>
    dispatch({ type: "SET_FIELD", path: "global.agent_hosts", value: hosts });

  const usedNodeNames = new Set(agentHosts.map((h) => h.name).filter(Boolean));

  const availableNodes = discoveredNodes.filter((n) => !usedNodeNames.has(n.name));

  const handleNodeSelect = (value: string) => {
    if (!value) return;

    if (value === "__manual__") {
      setAgentHosts([...agentHosts, { ...EMPTY_HOST }]);
      return;
    }

    const node = discoveredNodes.find((n) => n.id === value);
    if (node) {
      setAgentHosts([...agentHosts, nodeToHostEntry(node)]);
    }
  };

  const hostCount = agentHosts.length;
  const canAddHost = hostCount < 3;

  if (!state.schema) {
    return <div>Loading schema...</div>;
  }

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        Hub Cluster
      </Title>

      <Title headingLevel="h3" size="lg" className={stepStyles.firstSectionTitle}>
        Cluster Identity
      </Title>
      <SchemaFormRenderer
        schema={state.schema}
        fields={CLUSTER_FIELDS}
        values={configData}
        onChange={onChange}
        showValidation={state.showValidation}
      />

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Network
      </Title>
      <SchemaFormRenderer
        schema={state.schema}
        fields={NETWORK_FIELDS}
        values={configData}
        onChange={onChange}
        showValidation={state.showValidation}
      />

      <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
        Authentication
      </Title>
      <FormGroup label="Pull Secret" isRequired fieldId="pull-secret">
        <TextArea
          id="pull-secret"
          value={
            typeof globalData.pullSecret === "object" && globalData.pullSecret !== null
              ? JSON.stringify(globalData.pullSecret, null, 2)
              : (globalData.pullSecret as string) ?? ""
          }
          onChange={(_e, v) => {
            try {
              onChange("global.pullSecret", JSON.parse(v));
            } catch {
              onChange("global.pullSecret", v);
            }
          }}
          placeholder='{"auths":{}}'
          rows={4}
          isRequired
          aria-label="Pull Secret"
        />
      </FormGroup>
      <FormGroup label="SSH Public Key" isRequired fieldId="ssh-pub-key">
        <TextArea
          id="ssh-pub-key"
          value={(globalData.sshPubKey as string) ?? ""}
          onChange={(_e, v) => onChange("global.sshPubKey", v)}
          placeholder="ssh-rsa AAAA..."
          rows={3}
          isRequired
          aria-label="SSH Public Key"
        />
      </FormGroup>

      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        className={stepStyles.sectionTitle}
      >
        <FlexItem>
          <Title headingLevel="h3" size="lg">
            Control Plane Nodes ({hostCount}/3)
          </Title>
        </FlexItem>
        <FlexItem>
          {canAddHost && hasDiscovery ? (
            <FormSelect
              id="add-cp-node"
              value=""
              onChange={(_e, v) => handleNodeSelect(v)}
              style={{ width: "auto", minWidth: "250px" }}
            >
              <FormSelectOption value="" label="Add a node..." isPlaceholder />
              {availableNodes.map((node) => (
                <FormSelectOption
                  key={node.id}
                  value={node.id}
                  label={`${node.name} (BMC: ${node.bmcIp}${node.gpuType ? `, ${node.gpuCount}x ${node.gpuType}` : ""})`}
                />
              ))}
              <FormSelectOption value="__manual__" label="Manually add..." />
            </FormSelect>
          ) : (
            <Button
              variant="link"
              onClick={() => setAgentHosts([...agentHosts, { ...EMPTY_HOST }])}
              isDisabled={!canAddHost}
            >
              Add node
            </Button>
          )}
        </FlexItem>
      </Flex>
      {hostCount === 0 && (
        <p className={stepStyles.emptyHint}>
          {hasDiscovery
            ? "Select 3 control plane nodes from discovered inventory, or add them manually."
            : "Add 3 control plane nodes to proceed. Click \"Add node\" to get started."}
        </p>
      )}
      {hostCount > 0 && hostCount < 3 && (
        <p className={stepStyles.warningHint}>
          {3 - hostCount} more node{3 - hostCount > 1 ? "s" : ""} required.
        </p>
      )}
      <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }} className={stepStyles.hostSection}>
        {agentHosts.map((host, i) => (
          <FlexItem key={`agent-${i}`}>
            <Flex alignItems={{ default: "alignItemsFlexStart" }} gap={{ default: "gapSm" }}>
              <FlexItem grow={{ default: "grow" }}>
                <HostEntryCard
                  index={i}
                  host={host}
                  onChange={(h) => {
                    const updated = [...agentHosts];
                    updated[i] = h;
                    setAgentHosts(updated);
                  }}
                  label="Node"
                  availabilityZones={azNames}
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label={`Remove node ${i + 1}`}
                  onClick={() => setAgentHosts(agentHosts.filter((_, idx) => idx !== i))}
                  className={stepStyles.removeButton}
                >
                  <MinusCircleIcon />
                </Button>
              </FlexItem>
            </Flex>
          </FlexItem>
        ))}
      </Flex>

      <ExpandableSection
        toggleText={certsOpen ? "Hide TLS certificates" : "TLS certificates (optional)"}
        isExpanded={certsOpen}
        onToggle={(_e, expanded) => setCertsOpen(expanded)}
        className={stepStyles.sectionTitle}
      >
        {HUB_CERTS.map(({ path, label }) => (
          <CertificateField
            key={path}
            label={label}
            value={(getValueByPath(configData, path) as string) ?? ""}
            onChange={(v) => onChange(path, v)}
          />
        ))}
      </ExpandableSection>
    </Form>
  );
};
