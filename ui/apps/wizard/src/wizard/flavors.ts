import { getExperiencePlugins } from "./experiences.ts";

export type FlavorId = "caas" | "vmaas" | "bmaas";

export interface FlavorDefinition {
  id: FlavorId;
  title: string;
  subtitle: string;
  description: string;
  osacProfile: string;
  experienceId: string;
}

export const FLAVORS: FlavorDefinition[] = [
  {
    id: "caas",
    title: "CaaS",
    subtitle: "Containers as a Service",
    description:
      "Self-service OpenShift cluster provisioning with Hosted Control Planes on bare metal infrastructure.",
    osacProfile: "caas",
    experienceId: "caas",
  },
  {
    id: "vmaas",
    title: "VMaaS",
    subtitle: "VMs as a Service",
    description:
      "Self-service virtual machine provisioning on OpenShift Virtualization. Migrate existing VM workloads to a cloud-native platform.",
    osacProfile: "vmaas",
    experienceId: "vmaas",
  },
  {
    id: "bmaas",
    title: "BMaaS",
    subtitle: "Bare Metal as a Service",
    description:
      "Self-service bare metal server provisioning and lifecycle management via Metal3 and Ironic.",
    osacProfile: "bmaas",
    experienceId: "bmaas",
  },
];

export function getFlavorPlugins(flavor: FlavorDefinition): string[] {
  return getExperiencePlugins(flavor.experienceId);
}
