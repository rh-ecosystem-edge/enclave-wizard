import { Content, Flex, FlexItem, Title } from "@patternfly/react-core";
import { CubesIcon } from "@patternfly/react-icons";
import type React from "react";
import { FlavorCard } from "../components/FlavorCard.tsx";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

export const SelectFlavorStep: React.FC = () => {
  const { state, dispatch } = useWizard();

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      <FlexItem>
        <Title headingLevel="h2" size="xl">
          Select your sovereign cloud setup
        </Title>
        <Content component="p" className={stepStyles.subtitle}>
          Choose experiences to deploy, or skip this step to set up only the
          landing zone and hub cluster.
        </Content>
      </FlexItem>
      <FlexItem>
        <Flex gap={{ default: "gapMd" }} flexWrap={{ default: "wrap" }}>
          {state.experiences.map((exp) => (
            <FlexItem key={exp.name} style={{ minWidth: 280, flex: 1 }}>
              <FlavorCard
                title={exp.name}
                description={exp.description ?? ""}
                icon={<CubesIcon />}
                isSelected={state.selectedExperiences.has(exp.name)}
                onSelect={() =>
                  dispatch({ type: "TOGGLE_EXPERIENCE", name: exp.name })
                }
              />
            </FlexItem>
          ))}
        </Flex>
      </FlexItem>
    </Flex>
  );
};
