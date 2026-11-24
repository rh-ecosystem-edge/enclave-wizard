import { Label } from "@patternfly/react-core";
import type React from "react";

interface TaskTypeLabelProps {
  type: string;
}

export const TaskTypeLabel: React.FC<TaskTypeLabelProps> = ({ type }) => {
  switch (type) {
    case "deploy":
      return <Label color="blue">Full Deploy</Label>;
    case "deploy-phase":
      return <Label color="purple">Phase</Label>;
    case "deploy-plugin":
      return <Label color="teal">Plugin</Label>;
    default:
      return <Label>{type}</Label>;
  }
};
