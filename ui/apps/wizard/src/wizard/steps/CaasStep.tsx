import {
  Button,
  Content,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from "@patternfly/react-core";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";
import type React from "react";
import { type HostEntry, HostEntryCard } from "../components/HostEntryCard.tsx";
import { isValidDnsZone } from "../dnsZone.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

const EMPTY_HOST: HostEntry = {
  name: "",
  macAddress: "",
  ipAddress: "",
  redfish: "",
  redfishUser: "",
  redfishPassword: "",
  rootDisk: "",
};

export const OSAC_DNS_CLASS_OPTIONS = ["dns.route53.dns"] as const;

export const CaasStep: React.FC = () => {
  const { state, dispatch } = useWizard();

  const configData = state.configData as Record<string, unknown>;
  const globalData = (configData.global ?? {}) as Record<string, unknown>;
  const dnsClass = (globalData.osacDnsClass as string) ?? "";
  const dnsZone = (globalData.osacDnsZone as string) ?? "";
  const discoveryHosts: HostEntry[] = Array.isArray(
    (configData.cloudInfra as Record<string, unknown>)?.discovery_hosts,
  )
    ? ((configData.cloudInfra as Record<string, unknown>)
        .discovery_hosts as HostEntry[])
    : [];

  const setField = (field: string, value: unknown) =>
    dispatch({ type: "SET_FIELD", path: `global.${field}`, value });

  const setDiscoveryHosts = (hosts: HostEntry[]) =>
    dispatch({
      type: "SET_FIELD",
      path: "cloudInfra.discovery_hosts",
      value: hosts,
    });

  const dnsClassError = state.showValidation && !dnsClass.trim();
  const dnsZoneMissing = !dnsZone.trim();
  const dnsZoneInvalid = !dnsZoneMissing && !isValidDnsZone(dnsZone);
  const dnsZoneError = state.showValidation && (dnsZoneMissing || dnsZoneInvalid);

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        CaaS
      </Title>

      <Title
        headingLevel="h3"
        size="lg"
        className={stepStyles.firstSectionTitle}
      >
        DNS
      </Title>
      <Content component="p">
        These settings apply to every host registered below.
      </Content>

      <FormGroup label="DNS class" isRequired fieldId="osac-dns-class">
        <FormSelect
          id="osac-dns-class"
          aria-label="DNS class"
          value={dnsClass}
          onChange={(_e, v) => setField("osacDnsClass", v || undefined)}
        >
          <FormSelectOption value="" label="Select..." isPlaceholder />
          {OSAC_DNS_CLASS_OPTIONS.map((opt) => (
            <FormSelectOption key={opt} value={opt} label={opt} />
          ))}
        </FormSelect>
        <FormHelperText>
          {dnsClassError ? (
            <span className={stepStyles.validationError}>
              DNS class is required
            </span>
          ) : (
            "Fully-qualified Ansible role name of the DNS driver"
          )}
        </FormHelperText>
      </FormGroup>

      <FormGroup label="DNS zone" isRequired fieldId="osac-dns-zone">
        <TextInput
          id="osac-dns-zone"
          aria-label="DNS zone"
          value={dnsZone}
          onChange={(_e, val) => setField("osacDnsZone", val)}
          placeholder="example.com"
          validated={dnsZoneError ? "error" : "default"}
          isRequired
        />
        <FormHelperText>
          {state.showValidation && dnsZoneMissing ? (
            <span className={stepStyles.validationError}>
              DNS zone is required
            </span>
          ) : state.showValidation && dnsZoneInvalid ? (
            <span className={stepStyles.validationError}>
              Enter a valid DNS name (e.g. example.com)
            </span>
          ) : (
            "DNS zone to operate in (defaults to EXTERNAL_ACCESS_BASE_DOMAIN)"
          )}
        </FormHelperText>
      </FormGroup>

      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        className={stepStyles.sectionTitle}
      >
        <FlexItem>
          <Title headingLevel="h3" size="lg">
            Available Hosts ({discoveryHosts.length})
          </Title>
          <Content component="p">
            Register bare metal machines that form the resource pool for CaaS. The
            platform draws from this pool when provisioning managed clusters. Each
            machine is enrolled via its BMC (Redfish/IPMI) interface. You can add
            machines later through the management interface.
          </Content>
        </FlexItem>
        <FlexItem>
          <Button
            variant="link"
            icon={<PlusCircleIcon />}
            onClick={() =>
              setDiscoveryHosts([...discoveryHosts, { ...EMPTY_HOST }])
            }
          >
            Add host
          </Button>
        </FlexItem>
      </Flex>

      {discoveryHosts.length === 0 && (
        <p className={stepStyles.emptyHint}>
          No hosts registered yet. Click &quot;Add host&quot; to register bare
          metal hosts, or skip this step to add them later.
        </p>
      )}

      <Flex
        direction={{ default: "column" }}
        gap={{ default: "gapMd" }}
        className={stepStyles.hostSection}
      >
        {discoveryHosts.map((host, i) => (
          <FlexItem key={`discovery-${i}`}>
            <Flex
              alignItems={{ default: "alignItemsFlexStart" }}
              gap={{ default: "gapSm" }}
            >
              <FlexItem grow={{ default: "grow" }}>
                <HostEntryCard
                  index={i}
                  host={host}
                  onChange={(h) => {
                    const updated = [...discoveryHosts];
                    updated[i] = h;
                    setDiscoveryHosts(updated);
                  }}
                  label="Host"
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label={`Remove host ${i + 1}`}
                  onClick={() =>
                    setDiscoveryHosts(
                      discoveryHosts.filter((_, idx) => idx !== i),
                    )
                  }
                  className={stepStyles.removeButton}
                >
                  <MinusCircleIcon />
                </Button>
              </FlexItem>
            </Flex>
          </FlexItem>
        ))}
      </Flex>
    </Form>
  );
};
