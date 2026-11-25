import { Alert, Content, Flex, FlexItem, Title } from "@patternfly/react-core";
import { ClusterIcon, CubesIcon, ServerIcon } from "@patternfly/react-icons";
import type React from "react";
import { useState, type ReactNode } from "react";
import { FlavorCard } from "../components/FlavorCard.tsx";
import { useCatalog } from "../contexts/CatalogContext.tsx";
import {
  CAAS_REQUIRES_COMPANION_MESSAGE,
  isValidFlavorSelection,
  shouldRefuseFlavorToggle,
} from "../flavorConstraints.ts";
import type { FlavorId } from "../flavors.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

const FLAVOR_ICONS: Record<FlavorId, ReactNode> = {
  caas: <ClusterIcon />,
  vmaas: <CubesIcon />,
  bmaas: <ServerIcon />,
};

export const SelectFlavorStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const { flavors, experiences } = useCatalog();
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);

  const selectionInvalid = !isValidFlavorSelection(state.selectedFlavors);
  const constraintMessage = selectionInvalid
    ? CAAS_REQUIRES_COMPANION_MESSAGE
    : refusedMessage;

  const onSelectFlavor = (flavorId: FlavorId) => {
    if (shouldRefuseFlavorToggle(state.selectedFlavors, flavorId)) {
      setRefusedMessage(CAAS_REQUIRES_COMPANION_MESSAGE);
      return;
    }
    setRefusedMessage(null);
    dispatch({
      type: "TOGGLE_FLAVOR",
      flavor: flavorId,
      experiences,
    });
  };

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      <FlexItem>
        <Title headingLevel="h2" size="xl">
          Select your services
        </Title>
        <Content component="p" className={stepStyles.subtitle}>
          Choose which services to deploy on your sovereign cloud. You can
          enable both for a full-stack deployment. The landing zone, hub
          cluster, and OSAC platform are always included.
        </Content>
      </FlexItem>
      {constraintMessage && (
        <FlexItem>
          <Alert variant="danger" title={constraintMessage} isInline />
        </FlexItem>
      )}
      <FlexItem>
        <Flex
          gap={{ default: "gapMd" }}
          flexWrap={{ default: "wrap" }}
          alignItems={{ default: "alignItemsStretch" }}
        >
          {flavors.map((flavor) => (
            <FlexItem key={flavor.id} style={{ minWidth: 240, flex: "1 1 0" }}>
              <FlavorCard
                title={flavor.title}
                subtitle={flavor.subtitle}
                description={flavor.description}
                icon={FLAVOR_ICONS[flavor.id]}
                isSelected={state.selectedFlavors.has(flavor.id)}
                onSelect={() => onSelectFlavor(flavor.id)}
              />
            </FlexItem>
          ))}
        </Flex>
      </FlexItem>
    </Flex>
  );
};
