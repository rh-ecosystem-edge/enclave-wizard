import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Content,
  ExpandableSection,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  TextInput,
  Title,
} from "@patternfly/react-core";
import {
  ConnectedIcon,
  CpuIcon,
  DisconnectedIcon,
  ServerIcon,
  NetworkIcon,
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
import { useDiscoveryApi } from "../../api/useDiscoveryApi.ts";
import {
  useNicoApi,
  type NicoInventory,
} from "../../api/useNicoApi.ts";
import {
  useOpenStackApi,
  type OSInventory,
} from "../../api/useOpenStackApi.ts";
import {
  useNetboxApi,
  type NetboxInventory,
} from "../../api/useNetboxApi.ts";
import { useWizard } from "../WizardContext.tsx";
import { networkDiscoveryStyles as styles } from "./networkDiscoveryStyles.ts";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

const NetrisProvider: React.FC = () => {
  const { dispatch } = useWizard();
  const netrisApi = useNetrisApi();
  const discoveryApi = useDiscoveryApi();

  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [errorMsg, setErrorMsg] = useState("");
  const [controllerUrl, setControllerUrl] = useState("https://netris.example.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [controllerName, setControllerName] = useState("");

  const [sites, setSites] = useState<NetrisSite[]>([]);
  const [inventory, setInventory] = useState<NetrisInventory | null>(null);
  const [ipam, setIPAM] = useState<NetrisIPAM | null>(null);
  const [vpcs, setVPCs] = useState<NetrisVPC[]>([]);
  const [expandedSites, setExpandedSites] = useState<Record<number, boolean>>({});

  const handleConnect = async () => {
    setStatus("connecting");
    setErrorMsg("");
    try {
      const result = await netrisApi.connect(
        controllerUrl, "password",
        undefined,
        username,
        password,
      );
      if (!result.connected) {
        setStatus("error");
        setErrorMsg("Controller rejected the credentials.");
        return;
      }
      setControllerName(result.controller);

      const [s, inv, ip, v] = await Promise.all([
        netrisApi.getSites(), netrisApi.getInventory(), netrisApi.getIPAM(), netrisApi.getVPCs(),
      ]);
      setSites(s); setInventory(inv); setIPAM(ip); setVPCs(v);

      const merged = await discoveryApi.getMergedInventory();
      dispatch({ type: "SET_FIELD", path: "discovery", value: merged });
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = () => {
    setStatus("disconnected");
    setSites([]); setInventory(null); setIPAM(null); setVPCs([]);
    dispatch({ type: "SET_FIELD", path: "discovery", value: null });
  };

  const toggleSite = (id: number) =>
    setExpandedSites((p) => ({ ...p, [id]: !p[id] }));

  const serversForSite = (id: number) => inventory?.servers.filter((s) => s.siteId === id) ?? [];
  const switchesForSite = (id: number) => inventory?.switches.filter((s) => s.siteId === id) ?? [];
  const subnetsForSite = (id: number) => ipam?.subnets.filter((s) => s.siteId === id) ?? [];

  const purposeColor = (p: string) => {
    switch (p) {
      case "management": return "var(--pf-t--global--color--status--info--default)";
      case "common": return "var(--pf-t--global--color--status--success--default)";
      case "loopback": return "var(--pf-t--global--color--status--warning--default)";
      default: return "var(--pf-t--global--text--color--subtle)";
    }
  };

  if (status === "connected") {
    return (
      <>
        <div className={styles.summaryBar}>
          <ConnectedIcon color="var(--pf-t--global--color--status--success--default)" />
          <span>Connected to <strong>{controllerName}</strong></span>
          <Badge className={styles.summaryBadge}>{sites.length} Sites</Badge>
          <Badge className={styles.summaryBadge}>{inventory?.servers.length ?? 0} Servers</Badge>
          <Badge className={styles.summaryBadge}>{inventory?.switches.length ?? 0} Switches</Badge>
          <Badge className={styles.summaryBadge}>{vpcs.length} VPCs</Badge>
          <FlexItem align={{ default: "alignRight" }}>
            <Button variant="link" icon={<DisconnectedIcon />} onClick={handleDisconnect}>
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
                  onToggle={() => toggleSite(site.id)}
                  style={{ marginTop: "0.25rem" }}
                >
                  {serversForSite(site.id).map((srv) => (
                    <div key={srv.id} className={styles.inventoryItem}>
                      <div>
                        <span className={styles.serverName}>{srv.name}</span>
                        <span className={styles.serverDetail}> BMC: {srv.mgmtIp} &middot; MAC: {srv.macAddress}</span>
                      </div>
                      <span className={styles.serverDetail}>{srv.description}</span>
                    </div>
                  ))}
                  {switchesForSite(site.id).map((sw) => (
                    <div key={sw.id} className={styles.inventoryItem}>
                      <span className={styles.serverName}>{sw.name}</span>
                      <span className={styles.serverDetail}>{sw.role} &middot; {sw.nos}</span>
                    </div>
                  ))}
                  {subnetsForSite(site.id).map((sub) => (
                    <div key={sub.id} className={styles.subnetRow}>
                      <span><strong>{sub.prefix}</strong> {sub.gateway && <>gw {sub.gateway}</>}</span>
                      <span className={styles.purposeBadge} style={{ color: purposeColor(sub.purpose), border: `1px solid ${purposeColor(sub.purpose)}` }}>
                        {sub.purpose}
                      </span>
                    </div>
                  ))}
                </ExpandableSection>
              </CardBody>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={styles.connectionForm}>
      <Content component="p" style={{ marginBottom: "1rem", color: "var(--pf-t--global--text--color--subtle)" }}>
        Connect to your Netris controller to discover sites, switches, servers, VPCs, and IPAM subnets.
      </Content>

      <FormGroup label="Controller URL" isRequired fieldId="netris-url">
        <TextInput id="netris-url" value={controllerUrl} onChange={(_e, v) => setControllerUrl(v)}
          placeholder="https://netris.example.com" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Username" isRequired fieldId="netris-username">
        <TextInput id="netris-username" value={username} onChange={(_e, v) => setUsername(v)}
          placeholder="netris" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Password" isRequired fieldId="netris-password">
        <TextInput id="netris-password" type="password" value={password} onChange={(_e, v) => setPassword(v)}
          isDisabled={status === "connecting"} />
      </FormGroup>
      {status === "error" && <Alert variant="danger" title="Connection failed" isInline>{errorMsg}</Alert>}
      <Button variant="primary" onClick={handleConnect} isLoading={status === "connecting"}
        isDisabled={status === "connecting"} style={{ marginTop: "0.75rem" }}>
        {status === "connecting" ? "Connecting..." : "Connect"}
      </Button>
    </div>
  );
};

const NvidiaProvider: React.FC = () => {
  const { dispatch } = useWizard();
  const nicoApi = useNicoApi();
  const discoveryApi = useDiscoveryApi();

  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [errorMsg, setErrorMsg] = useState("");
  const [controllerUrl, setControllerUrl] = useState("https://nico.example.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [controllerName, setControllerName] = useState("");
  const [inventory, setInventory] = useState<NicoInventory | null>(null);

  const handleConnect = async () => {
    setStatus("connecting");
    setErrorMsg("");
    try {
      const result = await nicoApi.connect(controllerUrl, username, password);
      if (!result.connected) {
        setStatus("error");
        setErrorMsg("Controller rejected the credentials.");
        return;
      }
      setControllerName(result.controller);
      const inv = await nicoApi.getInventory();
      setInventory(inv);

      const merged = await discoveryApi.getMergedInventory();
      dispatch({ type: "SET_FIELD", path: "discovery", value: merged });
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = () => {
    setStatus("disconnected");
    setInventory(null);
  };

  const gpuServers = inventory?.servers.filter((s) => s.gpus?.length > 0) ?? [];
  const infraServers = inventory?.servers.filter((s) => !s.gpus?.length) ?? [];

  if (status === "connected" && inventory) {
    const totalGPUs = inventory.servers.reduce((sum, s) => sum + (s.gpus?.length ?? 0), 0);
    const totalDPUs = inventory.servers.reduce((sum, s) => sum + (s.dpus?.length ?? 0), 0);

    return (
      <>
        <div className={styles.summaryBar}>
          <ConnectedIcon color="var(--pf-t--global--color--status--success--default)" />
          <span>Connected to <strong>{controllerName}</strong></span>
          <Badge className={styles.summaryBadge}>{inventory.servers.length} Servers</Badge>
          <Badge className={styles.summaryBadge}>{totalGPUs} GPUs</Badge>
          <Badge className={styles.summaryBadge}>{totalDPUs} DPUs</Badge>
          <Badge className={styles.summaryBadge}>{inventory.nvlinkDomains.length} NVLink Domains</Badge>
          <FlexItem align={{ default: "alignRight" }}>
            <Button variant="link" icon={<DisconnectedIcon />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </FlexItem>
        </div>

        {inventory.nvlinkDomains.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
              NVLink Domains
            </Title>
            <Content component="p" style={{ fontSize: "0.8125rem", color: "var(--pf-t--global--text--color--subtle)", marginBottom: "0.5rem" }}>
              Servers in the same NVLink domain share GPU-to-GPU interconnect and should stay in the same AZ.
            </Content>
            <div className={styles.siteGrid}>
              {inventory.nvlinkDomains.map((domain) => (
                <Card key={domain.name} isRounded isCompact isFlat>
                  <CardBody>
                    <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
                      <CpuIcon />
                      <strong>{domain.name}</strong>
                      <Badge isRead>{domain.gpuCount} GPUs</Badge>
                    </Flex>
                    <div className={styles.inventoryList}>
                      {domain.servers.map((name) => {
                        const srv = inventory.servers.find((s) => s.name === name);
                        return (
                          <div key={name} className={styles.inventoryItem}>
                            <span className={styles.serverName}>{name}</span>
                            <span className={styles.serverDetail}>
                              {srv ? `${srv.model} · ${srv.gpus?.length ?? 0}x ${srv.gpus?.[0]?.type ?? "GPU"} · ${srv.dpus?.length ?? 0} DPUs` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        )}

        {gpuServers.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
              GPU Servers ({gpuServers.length})
            </Title>
            <div className={styles.inventoryList}>
              {gpuServers.map((srv) => (
                <div key={srv.name} className={styles.inventoryItem}>
                  <div>
                    <span className={styles.serverName}>{srv.name}</span>
                    <span className={styles.serverDetail}>
                      {" "}{srv.model} · S/N {srv.serialNumber} · {srv.cpus} CPUs · {srv.ramGb} GB RAM
                    </span>
                    <div className={styles.serverDetail}>
                      {srv.gpus.length}x {srv.gpus[0]?.type} ({srv.gpus[0]?.memoryGb} GB)
                      {srv.dpus?.length > 0 && <> · {srv.dpus.length}x {srv.dpus[0]?.model} (fw {srv.dpus[0]?.firmware})</>}
                      {srv.nvlinkDomain && <> · NVLink: {srv.nvlinkDomain}</>}
                    </div>
                  </div>
                  <span className={styles.serverDetail}>
                    {srv.gpus.every((g) => g.health === "Healthy")
                      ? <span style={{ color: "var(--pf-t--global--color--status--success--default)" }}>All GPUs Healthy</span>
                      : <span style={{ color: "var(--pf-t--global--color--status--danger--default)" }}>GPU Issues</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {infraServers.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
              Infrastructure Servers ({infraServers.length})
            </Title>
            <div className={styles.inventoryList}>
              {infraServers.map((srv) => (
                <div key={srv.name} className={styles.inventoryItem}>
                  <span className={styles.serverName}>{srv.name}</span>
                  <span className={styles.serverDetail}>{srv.model} · {srv.cpus} CPUs · {srv.ramGb} GB RAM</span>
                </div>
              ))}
            </div>
          </>
        )}

        {inventory.switches.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
              Spectrum Switches ({inventory.switches.length})
            </Title>
            <div className={styles.inventoryList}>
              {inventory.switches.map((sw) => (
                <div key={sw.name} className={styles.inventoryItem}>
                  <span className={styles.serverName}>{sw.name}</span>
                  <span className={styles.serverDetail}>{sw.model} · {sw.role} · fw {sw.firmware} · {sw.ports} ports</span>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className={styles.connectionForm}>
      <Content component="p" style={{ marginBottom: "1rem", color: "var(--pf-t--global--text--color--subtle)" }}>
        Connect to your NVIDIA NICo controller to discover GPU servers, DPUs, NVLink domains, and Spectrum switches.
      </Content>
      <FormGroup label="Controller URL" isRequired fieldId="nico-url">
        <TextInput id="nico-url" value={controllerUrl} onChange={(_e, v) => setControllerUrl(v)}
          placeholder="https://nico.example.com" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Username" isRequired fieldId="nico-username">
        <TextInput id="nico-username" value={username} onChange={(_e, v) => setUsername(v)}
          placeholder="admin" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Password" isRequired fieldId="nico-password">
        <TextInput id="nico-password" type="password" value={password} onChange={(_e, v) => setPassword(v)}
          isDisabled={status === "connecting"} />
      </FormGroup>
      {status === "error" && <Alert variant="danger" title="Connection failed" isInline>{errorMsg}</Alert>}
      <Button variant="primary" onClick={handleConnect} isLoading={status === "connecting"}
        isDisabled={status === "connecting"} style={{ marginTop: "0.75rem" }}>
        {status === "connecting" ? "Connecting..." : "Connect"}
      </Button>
    </div>
  );
};

const OpenStackProvider: React.FC = () => {
  const { dispatch } = useWizard();
  const osApi = useOpenStackApi();
  const discoveryApi = useDiscoveryApi();

  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [errorMsg, setErrorMsg] = useState("");
  const [authUrl, setAuthUrl] = useState("https://keystone.example.com:5000/v3");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [project, setProject] = useState("osac-infra");
  const [domain, setDomain] = useState("Default");
  const [endpoint, setEndpoint] = useState("");
  const [inventory, setInventory] = useState<OSInventory | null>(null);
  const [expandedAZs, setExpandedAZs] = useState<Record<string, boolean>>({});

  const handleConnect = async () => {
    setStatus("connecting");
    setErrorMsg("");
    try {
      const result = await osApi.connect(authUrl, username, password, project, domain);
      if (!result.connected) {
        setStatus("error");
        setErrorMsg("Authentication failed.");
        return;
      }
      setEndpoint(result.endpoint);
      const inv = await osApi.getInventory();
      setInventory(inv);

      const merged = await discoveryApi.getMergedInventory();
      dispatch({ type: "SET_FIELD", path: "discovery", value: merged });
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = () => {
    setStatus("disconnected");
    setInventory(null);
  };

  const toggleAZ = (name: string) =>
    setExpandedAZs((p) => ({ ...p, [name]: !p[name] }));

  const nodesForAZ = (azName: string) =>
    inventory?.baremetalNodes.filter((n) => n.availabilityZone === azName) ?? [];

  const stateColor = (state: string) => {
    switch (state) {
      case "available": return "var(--pf-t--global--color--status--success--default)";
      case "active": case "deploying": return "var(--pf-t--global--color--status--info--default)";
      default: return "var(--pf-t--global--text--color--subtle)";
    }
  };

  if (status === "connected" && inventory) {
    const availableCount = inventory.baremetalNodes.filter((n) => n.provisionState === "available").length;
    const totalSubnets = inventory.networks.reduce((sum, n) => sum + n.subnets.length, 0);

    return (
      <>
        <div className={styles.summaryBar}>
          <ConnectedIcon color="var(--pf-t--global--color--status--success--default)" />
          <span>Connected to <strong>{endpoint}</strong> &middot; project <strong>{project}</strong></span>
          <Badge className={styles.summaryBadge}>{inventory.availabilityZones.length} AZs</Badge>
          <Badge className={styles.summaryBadge}>{availableCount}/{inventory.baremetalNodes.length} nodes available</Badge>
          <Badge className={styles.summaryBadge}>{inventory.networks.length} networks</Badge>
          <FlexItem align={{ default: "alignRight" }}>
            <Button variant="link" icon={<DisconnectedIcon />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </FlexItem>
        </div>

        <Title headingLevel="h4" size="md" style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
          Availability Zones &amp; Bare Metal Nodes (Ironic)
        </Title>
        <div className={styles.siteGrid}>
          {inventory.availabilityZones.map((az) => {
            const azNodes = nodesForAZ(az.name);
            return (
              <Card key={az.name} isRounded isCompact isFlat className={styles.siteCard}>
                <CardBody>
                  <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }} style={{ marginBottom: "0.25rem" }}>
                    <ServerIcon />
                    <strong>{az.name}</strong>
                    <Badge isRead>{azNodes.length} nodes</Badge>
                    {az.available
                      ? <Badge style={{ backgroundColor: "var(--pf-t--global--color--status--success--default)", color: "white" }}>available</Badge>
                      : <Badge>unavailable</Badge>}
                  </Flex>
                  <ExpandableSection
                    toggleText={expandedAZs[az.name] ? "Hide nodes" : "Show nodes"}
                    isExpanded={expandedAZs[az.name] ?? false}
                    onToggle={() => toggleAZ(az.name)}
                    style={{ marginTop: "0.25rem" }}
                  >
                    {azNodes.map((node) => (
                      <div key={node.uuid} className={styles.inventoryItem}>
                        <div>
                          <span className={styles.serverName}>{node.name}</span>
                          <span className={styles.serverDetail}>
                            {" "}{node.manufacturer} {node.model} &middot; {node.cpus} CPUs &middot; {node.ramGb} GB &middot; {node.diskGb} GB disk
                          </span>
                          <div className={styles.serverDetail}>
                            BMC: {node.bmcAddress} &middot; MAC: {node.bootMacAddress} &middot; {node.rootDisk}
                          </div>
                        </div>
                        <span style={{ color: stateColor(node.provisionState), fontSize: "0.8125rem", fontWeight: 500 }}>
                          {node.provisionState} &middot; {node.powerState}
                        </span>
                      </div>
                    ))}
                  </ExpandableSection>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <Title headingLevel="h4" size="md" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
          Networks (Neutron) &middot; {totalSubnets} subnets
        </Title>
        <div className={styles.inventoryList}>
          {inventory.networks.map((net) => (
            <div key={net.id}>
              <div className={styles.inventoryItem} style={{ borderBottom: "none", paddingBottom: 0 }}>
                <span>
                  <span className={styles.serverName}>{net.name}</span>
                  <span className={styles.serverDetail}> {net.networkType}{net.physicalNet && ` (${net.physicalNet})`}{net.shared && " · shared"}</span>
                </span>
              </div>
              {net.subnets.map((sub) => (
                <div key={sub.id} className={styles.subnetRow} style={{ paddingLeft: "1.5rem" }}>
                  <span><strong>{sub.cidr}</strong> &middot; {sub.name}{sub.gateway && <> &middot; gw {sub.gateway}</>}{sub.dns && <> &middot; dns {sub.dns}</>}</span>
                  <span className={styles.purposeBadge} style={{ color: "var(--pf-t--global--text--color--subtle)", border: "1px solid var(--pf-t--global--border--color--default)" }}>
                    IPv{sub.ipVersion}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={styles.connectionForm}>
      <Content component="p" style={{ marginBottom: "1rem", color: "var(--pf-t--global--text--color--subtle)" }}>
        Connect to OpenStack to discover availability zones, bare metal nodes (Ironic), and networks (Neutron).
      </Content>
      <FormGroup label="Auth URL (Keystone v3)" isRequired fieldId="os-auth-url">
        <TextInput id="os-auth-url" value={authUrl} onChange={(_e, v) => setAuthUrl(v)}
          placeholder="https://keystone.example.com:5000/v3" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Username" isRequired fieldId="os-username">
        <TextInput id="os-username" value={username} onChange={(_e, v) => setUsername(v)}
          placeholder="admin" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Password" isRequired fieldId="os-password">
        <TextInput id="os-password" type="password" value={password} onChange={(_e, v) => setPassword(v)}
          isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Project" isRequired fieldId="os-project">
        <TextInput id="os-project" value={project} onChange={(_e, v) => setProject(v)}
          placeholder="osac-infra" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="Domain" fieldId="os-domain">
        <TextInput id="os-domain" value={domain} onChange={(_e, v) => setDomain(v)}
          placeholder="Default" isDisabled={status === "connecting"} />
      </FormGroup>
      {status === "error" && <Alert variant="danger" title="Connection failed" isInline>{errorMsg}</Alert>}
      <Button variant="primary" onClick={handleConnect} isLoading={status === "connecting"}
        isDisabled={status === "connecting"} style={{ marginTop: "0.75rem" }}>
        {status === "connecting" ? "Connecting..." : "Connect"}
      </Button>
    </div>
  );
};

const NetboxProvider: React.FC = () => {
  const { dispatch } = useWizard();
  const nbApi = useNetboxApi();
  const discoveryApi = useDiscoveryApi();

  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [errorMsg, setErrorMsg] = useState("");
  const [nbUrl, setNbUrl] = useState("https://netbox.example.com");
  const [apiToken, setApiToken] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [inventory, setInventory] = useState<NetboxInventory | null>(null);
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});

  const handleConnect = async () => {
    setStatus("connecting");
    setErrorMsg("");
    try {
      const result = await nbApi.connect(nbUrl, apiToken);
      if (!result.connected) {
        setStatus("error");
        setErrorMsg("Authentication failed.");
        return;
      }
      setEndpoint(result.endpoint);
      const inv = await nbApi.getInventory();
      setInventory(inv);

      const merged = await discoveryApi.getMergedInventory();
      dispatch({ type: "SET_FIELD", path: "discovery", value: merged });
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = () => {
    setStatus("disconnected");
    setInventory(null);
  };

  const toggleSite = (name: string) =>
    setExpandedSites((p) => ({ ...p, [name]: !p[name] }));

  const devicesForSite = (siteName: string) =>
    inventory?.devices.filter((d) => d.site === siteName) ?? [];

  const racksForSite = (siteName: string) =>
    inventory?.racks.filter((r) => r.site === siteName) ?? [];

  const prefixesForSite = (siteName: string) =>
    inventory?.prefixes.filter((p) => p.site === siteName && p.status !== "container") ?? [];

  if (status === "connected" && inventory) {
    const serverCount = inventory.devices.filter((d) => d.role.includes("server")).length;
    const switchCount = inventory.devices.filter((d) => ["spine", "leaf"].includes(d.role)).length;

    return (
      <>
        <div className={styles.summaryBar}>
          <ConnectedIcon color="var(--pf-t--global--color--status--success--default)" />
          <span>Connected to <strong>{endpoint}</strong></span>
          <Badge className={styles.summaryBadge}>{inventory.sites.length} Sites</Badge>
          <Badge className={styles.summaryBadge}>{serverCount} Servers</Badge>
          <Badge className={styles.summaryBadge}>{switchCount} Switches</Badge>
          <Badge className={styles.summaryBadge}>{inventory.racks.length} Racks</Badge>
          <Badge className={styles.summaryBadge}>{inventory.prefixes.length} Prefixes</Badge>
          <FlexItem align={{ default: "alignRight" }}>
            <Button variant="link" icon={<DisconnectedIcon />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </FlexItem>
        </div>

        {inventory.vrfs.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
              VRFs
            </Title>
            <div className={styles.inventoryList}>
              {inventory.vrfs.map((vrf) => (
                <div key={vrf.id} className={styles.inventoryItem}>
                  <span className={styles.serverName}>{vrf.name}</span>
                  <span className={styles.serverDetail}>RD: {vrf.rd}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Title headingLevel="h4" size="md" style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
          Sites &amp; Inventory
        </Title>
        <div className={styles.siteGrid}>
          {inventory.sites.map((site) => {
            const siteDevices = devicesForSite(site.name);
            const siteRacks = racksForSite(site.name);
            const sitePrefixes = prefixesForSite(site.name);
            const servers = siteDevices.filter((d) => d.role.includes("server"));
            const switches = siteDevices.filter((d) => ["spine", "leaf"].includes(d.role));

            return (
              <Card key={site.id} isRounded isCompact isFlat className={styles.siteCard}>
                <CardBody>
                  <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }} style={{ marginBottom: "0.25rem" }}>
                    <ServerIcon />
                    <strong>{site.name}</strong>
                    {site.region && <Badge isRead>{site.region}</Badge>}
                  </Flex>
                  <div style={{ fontSize: "0.875rem", color: "var(--pf-t--global--text--color--subtle)", marginBottom: "0.25rem" }}>
                    {site.facility && <>{site.facility} &middot; </>}
                    {servers.length} servers &middot; {switches.length} switches &middot; {siteRacks.length} racks
                    {site.asn > 0 && <> &middot; ASN {site.asn}</>}
                  </div>

                  <ExpandableSection
                    toggleText={expandedSites[site.name] ? "Hide details" : "Show details"}
                    isExpanded={expandedSites[site.name] ?? false}
                    onToggle={() => toggleSite(site.name)}
                  >
                    {siteRacks.length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.25rem" }}>Racks</Title>
                        <div className={styles.inventoryList}>
                          {siteRacks.map((rack) => (
                            <div key={rack.id} className={styles.inventoryItem}>
                              <span className={styles.serverName}>{rack.name}</span>
                              <span className={styles.serverDetail}>
                                {rack.uHeight}U &middot; {rack.devices} devices &middot; {rack.utilizationPercent.toFixed(0)}% utilized
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {servers.length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.5rem" }}>Servers</Title>
                        <div className={styles.inventoryList}>
                          {servers.map((dev) => (
                            <div key={dev.id} className={styles.inventoryItem}>
                              <div>
                                <span className={styles.serverName}>{dev.name}</span>
                                <span className={styles.serverDetail}>
                                  {" "}{dev.manufacturer} {dev.deviceType}
                                  {dev.rack && <> &middot; {dev.rack} U{dev.position}</>}
                                  {dev.serialNumber && <> &middot; S/N {dev.serialNumber}</>}
                                </span>
                                {dev.primaryIp && <div className={styles.serverDetail}>IP: {dev.primaryIp}</div>}
                                {dev.tags?.length > 0 && (
                                  <div style={{ marginTop: "0.125rem" }}>
                                    {dev.tags.map((t) => (
                                      <span key={t} className={styles.labelChip}>{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span style={{ color: "var(--pf-t--global--color--status--success--default)", fontSize: "0.8125rem" }}>
                                {dev.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {sitePrefixes.length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.5rem" }}>Prefixes</Title>
                        <div className={styles.inventoryList}>
                          {sitePrefixes.map((pfx) => (
                            <div key={pfx.id} className={styles.subnetRow}>
                              <span>
                                <strong>{pfx.prefix}</strong>
                                {pfx.vrf && <> &middot; VRF {pfx.vrf}</>}
                                {pfx.tenant && <> &middot; {pfx.tenant}</>}
                              </span>
                              <span className={styles.purposeBadge} style={{
                                color: pfx.role === "management" ? "var(--pf-t--global--color--status--info--default)" : "var(--pf-t--global--color--status--success--default)",
                                border: `1px solid ${pfx.role === "management" ? "var(--pf-t--global--color--status--info--default)" : "var(--pf-t--global--color--status--success--default)"}`,
                              }}>
                                {pfx.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </ExpandableSection>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className={styles.connectionForm}>
      <Content component="p" style={{ marginBottom: "1rem", color: "var(--pf-t--global--text--color--subtle)" }}>
        Connect to NetBox to discover sites, devices, racks, IPAM prefixes, and VRFs.
      </Content>
      <FormGroup label="NetBox URL" isRequired fieldId="nb-url">
        <TextInput id="nb-url" value={nbUrl} onChange={(_e, v) => setNbUrl(v)}
          placeholder="https://netbox.example.com" isDisabled={status === "connecting"} />
      </FormGroup>
      <FormGroup label="API Token" isRequired fieldId="nb-token">
        <TextInput id="nb-token" type="password" value={apiToken} onChange={(_e, v) => setApiToken(v)}
          placeholder="Enter API token" isDisabled={status === "connecting"} />
      </FormGroup>
      {status === "error" && <Alert variant="danger" title="Connection failed" isInline>{errorMsg}</Alert>}
      <Button variant="primary" onClick={handleConnect} isLoading={status === "connecting"}
        isDisabled={status === "connecting"} style={{ marginTop: "0.75rem" }}>
        {status === "connecting" ? "Connecting..." : "Connect"}
      </Button>
    </div>
  );
};

interface NetworkDiscoveryStepProps {
  providerId: string;
}

export const NetworkDiscoveryStep: React.FC<NetworkDiscoveryStepProps> = ({ providerId }) => {
  switch (providerId) {
    case "netris":
      return <NetrisProvider />;
    case "nvidia":
      return <NvidiaProvider />;
    case "openstack":
      return <OpenStackProvider />;
    case "netbox":
      return <NetboxProvider />;
    default:
      return <div>Unknown provider</div>;
  }
};
