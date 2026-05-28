import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  ExpandableSection,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Spinner,
  TextInput,
  Title,
} from "@patternfly/react-core";
import {
  CheckCircleIcon,
  ConnectedIcon,
  DisconnectedIcon,
  ServerIcon,
  NetworkIcon,
  OutlinedCircleIcon,
} from "@patternfly/react-icons";
import type React from "react";
import { useState } from "react";
import {
  useNetrisApi,
  type NetrisSite,
  type NetrisInventory,
  type NetrisIPAM,
  type NetrisVPC,
} from "../../api/useNetrisApi.ts";
import { useDiscoveryApi, type DiscoveredInventory } from "../../api/useDiscoveryApi.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";
import { networkDiscoveryStyles as styles } from "./networkDiscoveryStyles.ts";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface ProviderState {
  status: ConnectionState;
  error: string;
}

const ProviderCard: React.FC<{
  name: string;
  description: string;
  status: ConnectionState;
  children: React.ReactNode;
}> = ({ name, description, status, children }) => {
  const statusIcon = status === "connected"
    ? <CheckCircleIcon color="var(--pf-t--global--color--status--success--default)" />
    : <OutlinedCircleIcon color="var(--pf-t--global--text--color--subtle)" />;

  const statusLabel = status === "connected" ? "Connected" : "Not connected";

  return (
    <Card isRounded isCompact style={{ marginBottom: "1rem" }}>
      <CardHeader>
        <CardTitle>
          <Flex justifyContent={{ default: "justifyContentSpaceBetween" }} alignItems={{ default: "alignItemsCenter" }}>
            <FlexItem>
              <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
                {statusIcon}
                <span style={{ fontWeight: 600 }}>{name}</span>
                <span style={{ color: "var(--pf-t--global--text--color--subtle)", fontWeight: 400, fontSize: "0.875rem" }}>
                  {description}
                </span>
              </Flex>
            </FlexItem>
            <FlexItem>
              <span style={{ fontSize: "0.8125rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                {statusLabel}
              </span>
            </FlexItem>
          </Flex>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {children}
      </CardBody>
    </Card>
  );
};

export const NetworkDiscoveryStep: React.FC = () => {
  const { dispatch } = useWizard();
  const netrisApi = useNetrisApi();
  const discoveryApi = useDiscoveryApi();

  const [netrisState, setNetrisState] = useState<ProviderState>({ status: "disconnected", error: "" });
  const [controllerUrl, setControllerUrl] = useState("https://netris.example.com");
  const [authType, setAuthType] = useState("token");
  const [apiToken, setApiToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [controllerName, setControllerName] = useState("");

  const [sites, setSites] = useState<NetrisSite[]>([]);
  const [inventory, setInventory] = useState<NetrisInventory | null>(null);
  const [ipam, setIPAM] = useState<NetrisIPAM | null>(null);
  const [vpcs, setVPCs] = useState<NetrisVPC[]>([]);
  const [expandedSites, setExpandedSites] = useState<Record<number, boolean>>({});

  const handleNetrisConnect = async () => {
    setNetrisState({ status: "connecting", error: "" });
    try {
      const result = await netrisApi.connect(
        controllerUrl,
        authType,
        authType === "token" ? apiToken : undefined,
        authType === "password" ? username : undefined,
        authType === "password" ? password : undefined,
      );

      if (!result.connected) {
        setNetrisState({ status: "error", error: "Controller rejected the credentials." });
        return;
      }

      setControllerName(result.controller);

      const [sitesResult, inventoryResult, ipamResult, vpcsResult] =
        await Promise.all([
          netrisApi.getSites(),
          netrisApi.getInventory(),
          netrisApi.getIPAM(),
          netrisApi.getVPCs(),
        ]);

      setSites(sitesResult);
      setInventory(inventoryResult);
      setIPAM(ipamResult);
      setVPCs(vpcsResult);

      const merged = await discoveryApi.getMergedInventory();
      dispatch({ type: "SET_FIELD", path: "discovery", value: merged });

      setNetrisState({ status: "connected", error: "" });
    } catch (err) {
      setNetrisState({ status: "error", error: err instanceof Error ? err.message : "Connection failed" });
    }
  };

  const handleNetrisDisconnect = () => {
    setNetrisState({ status: "disconnected", error: "" });
    setSites([]);
    setInventory(null);
    setIPAM(null);
    setVPCs([]);
    dispatch({ type: "SET_FIELD", path: "discovery", value: null });
  };

  const toggleSiteExpanded = (siteId: number) =>
    setExpandedSites((prev) => ({ ...prev, [siteId]: !prev[siteId] }));

  const serversForSite = (siteId: number) =>
    inventory?.servers.filter((s) => s.siteId === siteId) ?? [];

  const switchesForSite = (siteId: number) =>
    inventory?.switches.filter((s) => s.siteId === siteId) ?? [];

  const subnetsForSite = (siteId: number) =>
    ipam?.subnets.filter((s) => s.siteId === siteId) ?? [];

  const purposeColor = (purpose: string): string => {
    switch (purpose) {
      case "management": return "var(--pf-t--global--color--status--info--default)";
      case "common": return "var(--pf-t--global--color--status--success--default)";
      case "loopback": return "var(--pf-t--global--color--status--warning--default)";
      default: return "var(--pf-t--global--text--color--subtle)";
    }
  };

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        Infrastructure Discovery
      </Title>
      <Content component="p" className={stepStyles.subtitle}>
        Connect to your infrastructure providers to discover existing inventory. All providers are optional — skip this step to configure everything manually.
      </Content>

      {/* Netris Provider */}
      <ProviderCard
        name="Netris"
        description="Sites, VPCs, switches, IPAM, V-Nets"
        status={netrisState.status}
      >
        {netrisState.status !== "connected" ? (
          <div className={styles.connectionForm}>
            <FormGroup label="Controller URL" isRequired fieldId="netris-url">
              <TextInput
                id="netris-url"
                value={controllerUrl}
                onChange={(_e, v) => setControllerUrl(v)}
                placeholder="https://netris.example.com"
                isDisabled={netrisState.status === "connecting"}
              />
            </FormGroup>

            <FormGroup label="Authentication" isRequired fieldId="netris-auth-type">
              <FormSelect
                id="netris-auth-type"
                value={authType}
                onChange={(_e, v) => setAuthType(v)}
                isDisabled={netrisState.status === "connecting"}
              >
                <FormSelectOption value="token" label="API Token" />
                <FormSelectOption value="password" label="Username / Password" />
              </FormSelect>
            </FormGroup>

            {authType === "token" ? (
              <FormGroup label="API Token" isRequired fieldId="netris-token">
                <TextInput
                  id="netris-token"
                  type="password"
                  value={apiToken}
                  onChange={(_e, v) => setApiToken(v)}
                  placeholder="Enter API token"
                  isDisabled={netrisState.status === "connecting"}
                />
              </FormGroup>
            ) : (
              <>
                <FormGroup label="Username" isRequired fieldId="netris-username">
                  <TextInput
                    id="netris-username"
                    value={username}
                    onChange={(_e, v) => setUsername(v)}
                    placeholder="netris"
                    isDisabled={netrisState.status === "connecting"}
                  />
                </FormGroup>
                <FormGroup label="Password" isRequired fieldId="netris-password">
                  <TextInput
                    id="netris-password"
                    type="password"
                    value={password}
                    onChange={(_e, v) => setPassword(v)}
                    isDisabled={netrisState.status === "connecting"}
                  />
                </FormGroup>
              </>
            )}

            {netrisState.status === "error" && (
              <Alert variant="danger" title="Connection failed" isInline>
                {netrisState.error}
              </Alert>
            )}

            <Button
              variant="primary"
              onClick={handleNetrisConnect}
              isLoading={netrisState.status === "connecting"}
              isDisabled={netrisState.status === "connecting"}
              style={{ marginTop: "0.75rem" }}
            >
              {netrisState.status === "connecting" ? "Connecting..." : "Connect"}
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.summaryBar}>
              <ConnectedIcon color="var(--pf-t--global--color--status--success--default)" />
              <span>
                Connected to <strong>{controllerName}</strong>
              </span>
              <Badge className={styles.summaryBadge}>{sites.length} Sites</Badge>
              <Badge className={styles.summaryBadge}>{inventory?.servers.length ?? 0} Servers</Badge>
              <Badge className={styles.summaryBadge}>{inventory?.switches.length ?? 0} Switches</Badge>
              <Badge className={styles.summaryBadge}>{vpcs.length} VPCs</Badge>
              <FlexItem align={{ default: "alignRight" }}>
                <Button variant="link" icon={<DisconnectedIcon />} onClick={handleNetrisDisconnect}>
                  Disconnect
                </Button>
              </FlexItem>
            </div>

            <div className={styles.siteGrid}>
              {sites.map((site) => (
                <Card key={site.id} isRounded isCompact isFlat className={styles.siteCard}>
                  <CardBody>
                    <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }} style={{ marginBottom: "0.25rem" }}>
                      <NetworkIcon />
                      <strong>{site.name}</strong>
                      <Badge isRead>{site.siteMesh}</Badge>
                    </Flex>
                    <Flex gap={{ default: "gapMd" }} style={{ fontSize: "0.875rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                      <FlexItem><ServerIcon /> {site.serverCount} servers</FlexItem>
                      <FlexItem><NetworkIcon /> {site.switchCount} switches</FlexItem>
                      <FlexItem>ASN {site.publicAsn}</FlexItem>
                    </Flex>

                    <ExpandableSection
                      toggleText={expandedSites[site.id] ? "Hide details" : "Show details"}
                      isExpanded={expandedSites[site.id] ?? false}
                      onToggle={() => toggleSiteExpanded(site.id)}
                      style={{ marginTop: "0.25rem" }}
                    >
                      {serversForSite(site.id).map((server) => (
                        <div key={server.id} className={styles.inventoryItem}>
                          <div>
                            <span className={styles.serverName}>{server.name}</span>
                            <span className={styles.serverDetail}> BMC: {server.mgmtIp} &middot; MAC: {server.macAddress}</span>
                          </div>
                          <span className={styles.serverDetail}>{server.description}</span>
                        </div>
                      ))}
                      {switchesForSite(site.id).map((sw) => (
                        <div key={sw.id} className={styles.inventoryItem}>
                          <span className={styles.serverName}>{sw.name}</span>
                          <span className={styles.serverDetail}>{sw.role} &middot; {sw.nos}</span>
                        </div>
                      ))}
                      {subnetsForSite(site.id).map((subnet) => (
                        <div key={subnet.id} className={styles.subnetRow}>
                          <span><strong>{subnet.prefix}</strong> {subnet.gateway && <>gw {subnet.gateway}</>}</span>
                          <span className={styles.purposeBadge} style={{ color: purposeColor(subnet.purpose), border: `1px solid ${purposeColor(subnet.purpose)}` }}>
                            {subnet.purpose}
                          </span>
                        </div>
                      ))}
                    </ExpandableSection>
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        )}
      </ProviderCard>

      {/* NVIDIA Carbide / NICo — placeholder */}
      <ProviderCard
        name="NVIDIA Carbide / NICo"
        description="Spectrum switches, DPUs, GPUs, NVLink, InfiniBand"
        status="disconnected"
      >
        <Content component="p" style={{ color: "var(--pf-t--global--text--color--subtle)", fontSize: "0.875rem" }}>
          NVIDIA Carbide and NICo integration coming soon. Will discover GPU inventory, DPU configuration, NVLink domains, and Spectrum switch fabric.
        </Content>
      </ProviderCard>

      {/* Metal3 / Ironic — placeholder */}
      <ProviderCard
        name="Metal3 / Ironic"
        description="Bare metal hosts, BMC credentials, hardware introspection"
        status="disconnected"
      >
        <Content component="p" style={{ color: "var(--pf-t--global--text--color--subtle)", fontSize: "0.875rem" }}>
          Metal3 / Ironic integration coming soon. Will discover BareMetalHost resources from the hub cluster with BMC credentials and hardware inspection data.
        </Content>
      </ProviderCard>

      {/* NetBox — placeholder */}
      <ProviderCard
        name="NetBox"
        description="DCIM, racks, devices, IPAM prefixes, VRFs"
        status="disconnected"
      >
        <Content component="p" style={{ color: "var(--pf-t--global--text--color--subtle)", fontSize: "0.875rem" }}>
          NetBox integration coming soon. Will discover devices, rack positions, IPAM prefixes, and VRF assignments.
        </Content>
      </ProviderCard>
    </Form>
  );
};
