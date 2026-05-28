import {
  Button,
  Content,
  Flex,
  FlexItem,
  Form,
  Title,
} from "@patternfly/react-core";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";
import type React from "react";
import type { DiscoveredInventory } from "../../api/useDiscoveryApi.ts";
import { useWizard } from "../WizardContext.tsx";
import {
  type AvailabilityZone,
  AvailabilityZoneCard,
  emptyAvailabilityZone,
} from "../components/AvailabilityZoneCard.tsx";
import { stepStyles } from "./stepStyles.ts";

export const InfrastructureStep: React.FC = () => {
  const { state, dispatch } = useWizard();

  const configData = state.configData as Record<string, unknown>;
  const topologyData = (configData.topology ?? {}) as Record<string, unknown>;
  const zones: AvailabilityZone[] = Array.isArray(
    topologyData.availability_zones,
  )
    ? (topologyData.availability_zones as AvailabilityZone[])
    : [];

  const discovery = configData.discovery as DiscoveredInventory | null;
  const hasDiscovery = discovery != null && discovery.nodes.length > 0;

  const usedSiteIds = zones.flatMap((z) => z.siteIds ?? []);

  const setZones = (updated: AvailabilityZone[]) =>
    dispatch({
      type: "SET_FIELD",
      path: "topology.availability_zones",
      value: updated,
    });

  const addZone = () => setZones([...zones, { ...emptyAvailabilityZone }]);

  const updateZone = (index: number, zone: AvailabilityZone) => {
    const updated = [...zones];
    updated[index] = zone;
    setZones(updated);
  };

  const removeZone = (index: number) => {
    const removedName = zones[index].name;
    const updated = zones.filter((_, i) => i !== index);
    setZones(updated);
    if (removedName) {
      dispatch({ type: "REMOVE_AZ", name: removedName });
    }
  };

  return (
    <Form>
      <Title headingLevel="h2" size="xl">
        Availability Zones
      </Title>
      <Content component="p" className={stepStyles.subtitle}>
        {hasDiscovery
          ? "Create availability zones and populate them from discovered sites, or define them manually."
          : "Define your Availability Zones"}
      </Content>

      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        className={stepStyles.sectionTitle}
      >
        <FlexItem>
          <Title headingLevel="h3" size="lg">
            Zones ({zones.length})
          </Title>
        </FlexItem>
        <FlexItem>
          <Button
            variant="link"
            icon={<PlusCircleIcon />}
            onClick={addZone}
          >
            Add Availability Zone
          </Button>
        </FlexItem>
      </Flex>

      {zones.length === 0 && (
        <p className={stepStyles.emptyHint}>
          No availability zones defined. Click &quot;Add Availability Zone&quot;
          to create zones for your infrastructure.
          {hasDiscovery && (
            <> You can populate zones from the sites discovered in the previous step.</>
          )}
        </p>
      )}

      <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }} className={stepStyles.hostSection}>
        {zones.map((zone, i) => (
          <FlexItem key={`az-${i}`}>
            <Flex alignItems={{ default: "alignItemsFlexStart" }} gap={{ default: "gapSm" }}>
              <FlexItem grow={{ default: "grow" }}>
                <AvailabilityZoneCard
                  index={i}
                  zone={zone}
                  onChange={(z) => updateZone(i, z)}
                  discovery={hasDiscovery ? discovery : undefined}
                  usedSiteIds={usedSiteIds}
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label={`Remove availability zone ${i + 1}`}
                  onClick={() => removeZone(i)}
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
