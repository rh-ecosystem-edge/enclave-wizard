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
  ConnectedIcon,
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
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";
import { networkDiscoveryStyles as styles } from "./networkDiscoveryStyles.ts";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export const NetworkDiscoveryStep: React.FC = () => {
  const { dispatch } = useWizard();
  const netrisApi = useNetrisApi();

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [controllerUrl, setControllerUrl] = useState("https://netris.example.com");
  const [authType, setAuthType] = useState("token");
  const [apiToken, setApiToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [sites, setSites] = useState<NetrisSite[]>([]);
  const [inventory, setInventory] = useState<NetrisInventory | null>(null);
  const [ipam, setIPAM] = useState<NetrisIPAM | null>(null);
  const [vpcs, setVPCs] = useState<NetrisVPC[]>([]);
  const [controllerName, setControllerName] = useState("");

  const [expandedSites, setExpandedSites] = useState<Record<number, boolean>>({});

  const handleConnect = async () => {
    setConnectionState("connecting");
    setErrorMessage("");
    try {
      const result = await netrisApi.connect(
        controllerUrl,
        authType,
        authType === "token" ? apiToken : undefined,
        authType === "password" ? username : undefined,
        authType === "password" ? password : undefined,
      );

      if (!result.connected) {
        setConnectionState("error");
        setErrorMessage("Controller rejected the credentials.");
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

      dispatch({
        type: "SET_FIELD",
        path: "netrisDiscovery",
        value: {
          connected: true,
          controller: result.controller,
          sites: sitesResult,
          inventory: inventoryResult,
          ipam: ipamResult,
          vpcs: vpcsResult,
        },
      });

      setConnectionState("connected");
    } catch (err) {
      setConnectionState("error");
      setErrorMessage(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const toggleSiteExpanded = (siteId: number) =>
    setExpandedSites((prev) => ({ ...prev, [siteId]: !prev[siteId] }));

  const serversForSite = (siteId: number) =>
    inventory?.servers.filter((s) => s.siteId === siteId) ?? [];

  const switchesForSite = (siteId: number) =>
    inventory?.switches.filter((s) => s.siteId === siteId) ?? [];

  const softGatesForSite = (siteId: number) =>
    inventory?.softGates.filter((s) => s.siteId === siteId) ?? [];

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
        Network Discovery
      </Title>
      <Content component="p" className={stepStyles.subtitle}>
        Connect to your Netris controller to discover existing infrastructure, or skip to define availability zones manually.
      </Content>

      {connectionState !== "connected" && (
        <div className={styles.connectionForm}>
          <FormGroup label="Controller URL" isRequired fieldId="netris-url">
            <TextInput
              id="netris-url"
              value={controllerUrl}
              onChange={(_e, v) => setControllerUrl(v)}
              placeholder="https://netris.example.com"
              isDisabled={connectionState === "connecting"}
            />
          </FormGroup>

          <FormGroup label="Authentication" isRequired fieldId="netris-auth-type">
            <FormSelect
              id="netris-auth-type"
              value={authType}
              onChange={(_e, v) => setAuthType(v)}
              isDisabled={connectionState === "connecting"}
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
                isDisabled={connectionState === "connecting"}
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
                  isDisabled={connectionState === "connecting"}
                />
              </FormGroup>
              <FormGroup label="Password" isRequired fieldId="netris-password">
                <TextInput
                  id="netris-password"
                  type="password"
                  value={password}
                  onChange={(_e, v) => setPassword(v)}
                  isDisabled={connectionState === "connecting"}
                />
              </FormGroup>
            </>
          )}

          {connectionState === "error" && (
            <Alert variant="danger" title="Connection failed" isInline>
              {errorMessage}
            </Alert>
          )}

          <Button
            variant="primary"
            onClick={handleConnect}
            isLoading={connectionState === "connecting"}
            isDisabled={connectionState === "connecting"}
            style={{ marginTop: "1rem" }}
          >
            {connectionState === "connecting" ? "Connecting..." : "Connect"}
          </Button>
        </div>
      )}

      {connectionState === "connecting" && (
        <Flex justifyContent={{ default: "justifyContentCenter" }} style={{ padding: "2rem" }}>
          <Spinner aria-label="Connecting to Netris..." />
        </Flex>
      )}

      {connectionState === "connected" && (
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
              <Button
                variant="link"
                icon={<DisconnectedIcon />}
                onClick={() => {
                  setConnectionState("disconnected");
                  dispatch({ type: "SET_FIELD", path: "netrisDiscovery", value: null });
                }}
              >
                Disconnect
              </Button>
            </FlexItem>
          </div>

          <Title headingLevel="h3" size="lg" className={stepStyles.sectionTitle}>
            Discovered Sites
          </Title>
          <Content component="p" className={stepStyles.subtitle}>
            These sites and their inventory are available to assign to Availability Zones in the next step.
          </Content>

          <div className={styles.siteGrid}>
            {sites.map((site) => (
              <Card key={site.id} isRounded isCompact className={styles.siteCard}>
                <CardHeader>
                  <CardTitle>
                    <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
                      <NetworkIcon />
                      <span>{site.name}</span>
                      <Badge isRead>{site.siteMesh}</Badge>
                    </Flex>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <Flex gap={{ default: "gapMd" }} style={{ marginBottom: "0.5rem" }}>
                    <FlexItem>
                      <ServerIcon /> {site.serverCount} servers
                    </FlexItem>
                    <FlexItem>
                      <NetworkIcon /> {site.switchCount} switches
                    </FlexItem>
                    <FlexItem>ASN {site.publicAsn}</FlexItem>
                  </Flex>

                  <ExpandableSection
                    toggleText={expandedSites[site.id] ? "Hide inventory" : "Show inventory"}
                    isExpanded={expandedSites[site.id] ?? false}
                    onToggle={() => toggleSiteExpanded(site.id)}
                  >
                    {serversForSite(site.id).length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.5rem" }}>
                          Servers
                        </Title>
                        <div className={styles.inventoryList}>
                          {serversForSite(site.id).map((server) => (
                            <div key={server.id} className={styles.inventoryItem}>
                              <div>
                                <span className={styles.serverName}>{server.name}</span>
                                <div className={styles.serverDetail}>
                                  BMC: {server.mgmtIp} &middot; MAC: {server.macAddress} &middot; {server.portCount} ports
                                </div>
                                {server.labels && Object.entries(server.labels).map(([k, v]) => (
                                  <span key={k} className={styles.labelChip}>{k}={v}</span>
                                ))}
                              </div>
                              <span className={styles.serverDetail}>{server.description}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {switchesForSite(site.id).length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.75rem" }}>
                          Switches
                        </Title>
                        <div className={styles.inventoryList}>
                          {switchesForSite(site.id).map((sw) => (
                            <div key={sw.id} className={styles.inventoryItem}>
                              <span className={styles.serverName}>{sw.name}</span>
                              <span className={styles.serverDetail}>
                                {sw.role} &middot; {sw.nos} &middot; {sw.portCount} ports
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {softGatesForSite(site.id).length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.75rem" }}>
                          SoftGates
                        </Title>
                        <div className={styles.inventoryList}>
                          {softGatesForSite(site.id).map((sg) => (
                            <div key={sg.id} className={styles.inventoryItem}>
                              <span className={styles.serverName}>{sg.name}</span>
                              <span className={styles.serverDetail}>
                                Main: {sg.mainIp} &middot; Mgmt: {sg.mgmtIp}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {subnetsForSite(site.id).length > 0 && (
                      <>
                        <Title headingLevel="h5" size="sm" style={{ marginTop: "0.75rem" }}>
                          IPAM Subnets
                        </Title>
                        <div className={styles.inventoryList}>
                          {subnetsForSite(site.id).map((subnet) => (
                            <div key={subnet.id} className={styles.subnetRow}>
                              <span>
                                <strong>{subnet.prefix}</strong> &middot; {subnet.name}
                                {subnet.gateway && <> &middot; gw {subnet.gateway}</>}
                              </span>
                              <span
                                className={styles.purposeBadge}
                                style={{ color: purposeColor(subnet.purpose), border: `1px solid ${purposeColor(subnet.purpose)}` }}
                              >
                                {subnet.purpose}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </ExpandableSection>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </Form>
  );
};
