import {
  Alert,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  FlexItem,
  ProgressStep,
  ProgressStepper,
  Split,
  SplitItem,
  Spinner,
  Title,
} from "@patternfly/react-core";
import { ListIcon } from "@patternfly/react-icons";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EnclaveConfigToJSON } from "@enclave-wizard-ui/api-client";
import { useEnclaveApi } from "../api/useEnclaveApi.ts";
import { RedHatLogo } from "../common/components/RedHatLogo.tsx";
import {
  validateFields,
  validateHostEntries,
  type StepValidationError,
} from "../schema/schemaUtils.ts";
import { useOpenApiSchema } from "../schema/useOpenApiSchema.ts";
import { STEP_REQUIRED_FIELDS } from "./stepFields.ts";
import { CaasStep } from "./steps/CaasStep.tsx";
import { DeployStep } from "./steps/DeployStep.tsx";
import { HubClusterStep } from "./steps/HubClusterStep.tsx";
import { InfrastructureStep } from "./steps/InfrastructureStep.tsx";
import { LandingZoneStep } from "./steps/LandingZoneStep.tsx";
import { NetworkDiscoveryStep } from "./steps/NetworkDiscoveryStep.tsx";
import { ReviewStep } from "./steps/ReviewStep.tsx";
import { SelectFlavorStep } from "./steps/SelectFlavorStep.tsx";
import { StorageStep } from "./steps/StorageStep.tsx";
import { WelcomeStep } from "./steps/WelcomeStep.tsx";
import { useWizard, WizardProvider } from "./WizardContext.tsx";
import { wizardStyles as styles } from "./wizardStyles.ts";
import { css } from "@emotion/css";

const taskNavButton = css`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 1rem;
  border: 1px solid var(--pf-t--global--border--color--default);
  border-radius: var(--pf-t--global--border--radius--small);
  color: var(--pf-t--global--text--color--regular);
  text-decoration: none;
  font-size: 0.875rem;
  &:hover {
    background-color: var(--pf-t--global--background--color--secondary--hover);
  }
`;

const configLayout = css`
  display: flex;
  gap: 2rem;
`;

const configNav = css`
  min-width: 200px;
  padding-top: 0.5rem;
`;

const configNavItem = css`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem 0;
  cursor: pointer;
  color: var(--pf-t--global--text--color--subtle);
  &:hover {
    color: var(--pf-t--global--text--color--regular);
  }
`;

const configNavItemActive = css`
  color: var(--pf-t--global--text--color--regular);
  font-weight: 600;
`;

const configNavCircle = css`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--pf-t--global--border--color--default);
  flex-shrink: 0;
  margin-top: 2px;
`;

const configNavCircleActive = css`
  border-color: var(--pf-t--global--icon--color--brand--default);
  background-color: var(--pf-t--global--icon--color--brand--default);
`;

const configNavLine = css`
  width: 2px;
  height: 24px;
  background-color: var(--pf-t--global--border--color--default);
  margin-left: 9px;
`;

const configContent = css`
  flex: 1;
  min-width: 0;
`;

interface StepDef {
  id: string;
  label: string;
}

interface SubStep {
  id: string;
  label: string;
}

const TOP_STEPS: StepDef[] = [
  { id: "welcome", label: "Welcome" },
  { id: "flavor", label: "Select" },
  { id: "discovery", label: "Discovery" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "configure", label: "Configure" },
  { id: "review", label: "Review" },
  { id: "deploy", label: "Deploy" },
];

const DISCOVERY_SUBSTEPS: SubStep[] = [
  { id: "netris", label: "Netris" },
  { id: "nvidia", label: "NVIDIA Carbide / NICo" },
  { id: "metal3", label: "Metal3 / Ironic" },
  { id: "openstack", label: "OpenStack" },
  { id: "netbox", label: "NetBox" },
];

const BASE_CONFIG_SUBSTEPS: SubStep[] = [
  { id: "landing-zone", label: "Landing Zone" },
  { id: "storage", label: "Storage" },
  { id: "hub-cluster", label: "Hub Cluster" },
];

function buildConfigSubSteps(selectedFlavors: Set<string>): SubStep[] {
  const subs = [...BASE_CONFIG_SUBSTEPS];
  if (selectedFlavors.has("cluster")) {
    subs.push({ id: "caas", label: "Cluster as a Service" });
  }
  return subs;
}

function SubStepContent({ subStepId }: { subStepId: string }): React.ReactElement {
  switch (subStepId) {
    case "landing-zone":
      return <LandingZoneStep />;
    case "storage":
      return <StorageStep />;
    case "hub-cluster":
      return <HubClusterStep />;
    case "caas":
      return <CaasStep />;
    default:
      return <div>Unknown section</div>;
  }
}

function SubStepLayout({
  title,
  subtitle,
  subSteps,
  activeSubStep,
  onSubStepChange,
  children,
}: {
  title: string;
  subtitle: string;
  subSteps: SubStep[];
  activeSubStep: number;
  onSubStepChange: (index: number) => void;
  children: React.ReactNode;
}): React.ReactElement {
  const currentSub = subSteps[activeSubStep];
  return (
    <div>
      <Title headingLevel="h2" size="xl" style={{ marginBottom: "0.25rem" }}>
        {title}
      </Title>
      <p style={{ color: "var(--pf-t--global--text--color--subtle)", marginBottom: "1.5rem" }}>
        {subtitle}
      </p>

      <div className={configLayout}>
        <nav className={configNav}>
          {subSteps.map((sub, i) => (
            <div key={sub.id}>
              <div
                className={`${configNavItem} ${i === activeSubStep ? configNavItemActive : ""}`}
                onClick={() => onSubStepChange(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSubStepChange(i)}
              >
                <div
                  className={`${configNavCircle} ${i === activeSubStep ? configNavCircleActive : ""}`}
                />
                <span>{sub.label}</span>
              </div>
              {i < subSteps.length - 1 && <div className={configNavLine} />}
            </div>
          ))}
        </nav>

        <div className={configContent}>
          <p style={{ color: "var(--pf-t--global--text--color--subtle)", marginBottom: "1rem", fontSize: "0.875rem" }}>
            Step {activeSubStep + 1} of {subSteps.length} &middot; {currentSub?.label}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

function StepContent({
  stepId,
  configSubSteps,
  activeConfigSubStep,
  onConfigSubStepChange,
  activeDiscoverySubStep,
  onDiscoverySubStepChange,
}: {
  stepId: string;
  configSubSteps: SubStep[];
  activeConfigSubStep: number;
  onConfigSubStepChange: (index: number) => void;
  activeDiscoverySubStep: number;
  onDiscoverySubStepChange: (index: number) => void;
}): React.ReactElement {
  switch (stepId) {
    case "welcome":
      return <WelcomeStep />;
    case "flavor":
      return <SelectFlavorStep />;
    case "discovery":
      return (
        <SubStepLayout
          title="Infrastructure Discovery"
          subtitle="Connect to your infrastructure providers to discover existing inventory. All providers are optional."
          subSteps={DISCOVERY_SUBSTEPS}
          activeSubStep={activeDiscoverySubStep}
          onSubStepChange={onDiscoverySubStepChange}
        >
          <NetworkDiscoveryStep providerId={DISCOVERY_SUBSTEPS[activeDiscoverySubStep]?.id ?? "netris"} />
        </SubStepLayout>
      );
    case "infrastructure":
      return <InfrastructureStep />;
    case "configure":
      return (
        <SubStepLayout
          title="Configure your deployment"
          subtitle="Answer a few questions to set up your chosen services."
          subSteps={configSubSteps}
          activeSubStep={activeConfigSubStep}
          onSubStepChange={onConfigSubStepChange}
        >
          <SubStepContent subStepId={configSubSteps[activeConfigSubStep]?.id ?? ""} />
        </SubStepLayout>
      );
    case "review":
      return <ReviewStep />;
    case "deploy":
      return <DeployStep />;
    default:
      return <div>Unknown step</div>;
  }
}

function WizardContent(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { schema, loading: schemaLoading } = useOpenApiSchema();
  const api = useEnclaveApi();
  const [initDone, setInitDone] = useState(false);
  const [stepErrors, setStepErrors] = useState<StepValidationError[]>([]);
  const [activeConfigSubStep, setActiveConfigSubStep] = useState(0);
  const [activeDiscoverySubStep, setActiveDiscoverySubStep] = useState(0);

  const configSubSteps = useMemo(
    () => buildConfigSubSteps(state.selectedFlavors),
    [state.selectedFlavors],
  );

  useEffect(() => {
    if (schema) {
      dispatch({ type: "SET_SCHEMA", schema });
    }
  }, [schema, dispatch]);

  useEffect(() => {
    if (initDone) return;
    const init = async () => {
      try {
        const [defaults, pluginsResult, existingConfig] =
          await Promise.allSettled([
            api.getDefaults(),
            api.getPlugins(),
            api.getConfig(),
          ]);

        if (defaults.status === "fulfilled") {
          const d = defaults.value;
          dispatch({ type: "SET_FIELD", path: "global.disconnected", value: d.disconnected });
          dispatch({ type: "SET_FIELD", path: "global.storage_plugin", value: d.storagePlugin });
          dispatch({ type: "SET_FIELD", path: "global.defaultPrefix", value: 24 });
          dispatch({ type: "SET_FIELD", path: "global.quayBackend", value: "LocalStorage" });
          dispatch({ type: "SET_FIELD", path: "global.enabled_plugins", value: ["lvms", "nvidia-gpu", "openshift-ai"] });
        }

        if (pluginsResult.status === "fulfilled") {
          dispatch({ type: "SET_PLUGINS", plugins: pluginsResult.value.plugins ?? [] });
        }

        if (existingConfig.status === "fulfilled") {
          dispatch({ type: "LOAD_CONFIG", config: EnclaveConfigToJSON(existingConfig.value) });
        }
      } catch (err) {
        console.warn("Failed to load initial data:", err);
      }
      setInitDone(true);
    };
    init();
  }, [api, dispatch, initDone]);

  const currentStepId = TOP_STEPS[state.currentStep]?.id;
  const isWelcome = currentStepId === "welcome";
  const isFirst = state.currentStep === 0;
  const isLast = state.currentStep === TOP_STEPS.length - 1;
  const isConfigure = currentStepId === "configure";
  const isDiscovery = currentStepId === "discovery";
  const hasSubSteps = isConfigure || isDiscovery;

  const currentSubSteps = isConfigure ? configSubSteps : isDiscovery ? DISCOVERY_SUBSTEPS : [];
  const activeSubStep = isConfigure ? activeConfigSubStep : activeDiscoverySubStep;
  const setActiveSubStep = isConfigure ? setActiveConfigSubStep : setActiveDiscoverySubStep;

  const isLastSubStep = activeSubStep === currentSubSteps.length - 1;
  const isFirstSubStep = activeSubStep === 0;

  const currentSubStepId = hasSubSteps ? currentSubSteps[activeSubStep]?.id : currentStepId;

  const goBack = () => {
    setStepErrors([]);
    dispatch({ type: "SET_SHOW_VALIDATION", show: false });

    if (hasSubSteps && !isFirstSubStep) {
      setActiveSubStep((s: number) => s - 1);
      return;
    }

    if (hasSubSteps && isFirstSubStep) {
      setActiveSubStep(0);
    }

    dispatch({ type: "SET_STEP", step: Math.max(0, state.currentStep - 1) });
  };

  const skipValidation = new URLSearchParams(window.location.search).has("skip_validation");

  const validateCurrentSubStep = useCallback((): StepValidationError[] => {
    if (skipValidation || !state.schema || !currentSubStepId) return [];

    const fieldsToValidate = STEP_REQUIRED_FIELDS[currentSubStepId];
    let errors: StepValidationError[] = [];

    if (fieldsToValidate) {
      const nonHostFields = fieldsToValidate.filter((f) => f !== "global.agentHosts");
      errors = validateFields(state.schema, nonHostFields, state.configData as Record<string, unknown>);
    }

    if (currentSubStepId === "storage") {
      const globalData = ((state.configData as Record<string, unknown>).global ?? {}) as Record<string, unknown>;
      const disconnected = globalData.disconnected !== false;
      const backend = globalData.storage_plugin as string;
      if (backend === "odf" && !((globalData.odfExternalConfig as string) ?? "").trim()) {
        errors.push({ path: "global.odfExternalConfig", label: "ODF connection details", message: "ODF external Ceph connection details are required" });
      }
      if (backend === "vast-csi") {
        for (const [field, label] of [["vastEndpoint", "Management endpoint"], ["vastAdminUsername", "Admin username"], ["vastAdminPassword", "Admin password"]] as const) {
          if (!((globalData[field] as string) ?? "").trim()) {
            errors.push({ path: `global.${field}`, label, message: `${label} is required for VAST CSI` });
          }
        }
        const pool = globalData.vastVipPool as { subnet_cidr?: number; ip_ranges?: { start: string; end: string }[] } | undefined;
        if (!pool || !pool.ip_ranges?.length || pool.ip_ranges.some((r) => !r.start.trim() || !r.end.trim())) {
          errors.push({ path: "global.vastVipPool", label: "VIP pool", message: "VIP pool with at least one complete IP range is required for VAST CSI" });
        }
      }
      if (disconnected) {
        for (const [field, label] of [["quayUser", "Admin username"], ["quayPassword", "Admin password"]] as const) {
          if (!((globalData[field] as string) ?? "").trim()) {
            errors.push({ path: `global.${field}`, label, message: `Quay ${label} is required` });
          }
        }
        const quayBackend = globalData.quayBackend as string;
        if (quayBackend === "RadosGWStorage") {
          const rgw = (globalData.quayBackendRGWConfiguration ?? {}) as Record<string, unknown>;
          for (const key of ["access_key", "secret_key", "bucket_name", "hostname"]) {
            if (!rgw[key] || (typeof rgw[key] === "string" && (rgw[key] as string).trim() === "")) {
              errors.push({ path: `global.quayBackendRGWConfiguration.${key}`, label: key, message: `${key} is required for RadosGW backend` });
            }
          }
        }
      }
    }

    if (currentSubStepId === "hub-cluster") {
      const globalData = ((state.configData as Record<string, unknown>).global ?? {}) as Record<string, unknown>;
      const agentHosts = Array.isArray(globalData.agent_hosts) ? (globalData.agent_hosts as Record<string, unknown>[]) : [];
      if (agentHosts.length !== 3) {
        errors.push({ path: "global.agentHosts", label: "Control Plane Nodes", message: `Exactly 3 control plane nodes are required (currently ${agentHosts.length})` });
      } else {
        errors.push(...validateHostEntries(state.schema, agentHosts, "Node"));
      }
    }

    return errors;
  }, [currentSubStepId, state.schema, state.configData, skipValidation]);

  const goNext = useCallback(() => {
    if (hasSubSteps) {
      if (isConfigure) {
        const errors = validateCurrentSubStep();
        if (errors.length > 0) {
          setStepErrors(errors);
          dispatch({ type: "SET_SHOW_VALIDATION", show: true });
          return;
        }
      }
      setStepErrors([]);
      dispatch({ type: "SET_SHOW_VALIDATION", show: false });

      if (!isLastSubStep) {
        setActiveSubStep((s: number) => s + 1);
        return;
      }
    }

    setStepErrors([]);
    dispatch({ type: "SET_SHOW_VALIDATION", show: false });
    dispatch({ type: "SET_STEP", step: Math.min(TOP_STEPS.length - 1, state.currentStep + 1) });

    const nextStepId = TOP_STEPS[state.currentStep + 1]?.id;
    if (nextStepId === "configure") setActiveConfigSubStep(0);
    if (nextStepId === "discovery") setActiveDiscoverySubStep(0);
  }, [hasSubSteps, isConfigure, isLastSubStep, state.currentStep, dispatch, validateCurrentSubStep, setActiveSubStep]);

  if (schemaLoading) {
    return <Spinner aria-label="Loading wizard..." />;
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Split hasGutter>
            <SplitItem isFilled>
              <RedHatLogo width={240} />
            </SplitItem>
            <SplitItem>
              <Link to="/tasks" className={taskNavButton}>
                <ListIcon /> Tasks
              </Link>
            </SplitItem>
          </Split>
        </div>
        <Divider />
        {!isWelcome && (
          <div className={styles.headerInner}>
            <ProgressStepper aria-label="Wizard progress">
              {TOP_STEPS.map((step, i) => (
                <ProgressStep
                  key={step.id}
                  id={step.id}
                  titleId={`step-title-${step.id}`}
                  variant={i < state.currentStep ? "success" : i === state.currentStep ? "info" : "pending"}
                  isCurrent={i === state.currentStep}
                  aria-label={step.label}
                >
                  {step.label}
                </ProgressStep>
              ))}
            </ProgressStepper>
          </div>
        )}
      </header>

      <div className={styles.content}>
        <div className={styles.contentInner}>
          {stepErrors.length > 0 && (
            <Alert variant="danger" title="Please fill in all required fields" isInline className={styles.errorAlert}>
              <ul>
                {stepErrors.map((err) => (
                  <li key={err.path}>{err.message}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Card isRounded>
            <CardBody className={styles.cardBody}>
              <StepContent
                stepId={currentStepId ?? "welcome"}
                configSubSteps={configSubSteps}
                activeConfigSubStep={activeConfigSubStep}
                onConfigSubStepChange={setActiveConfigSubStep}
                activeDiscoverySubStep={activeDiscoverySubStep}
                onDiscoverySubStepChange={setActiveDiscoverySubStep}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {!isWelcome && (
        <div className={styles.footer}>
          <div className={styles.footerInner}>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
              <FlexItem>
                <Button variant="secondary" onClick={goBack} isDisabled={isFirst}>Back</Button>
              </FlexItem>
              <FlexItem>
                <Button variant="primary" onClick={goNext} isDisabled={isLast}>
                  {hasSubSteps && !isLastSubStep ? "Continue" : "Next"}
                </Button>
              </FlexItem>
            </Flex>
          </div>
        </div>
      )}
    </div>
  );
}

export const WizardPage: React.FC = () => {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
};
