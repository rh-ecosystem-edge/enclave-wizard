import {
  Button,
  Content,
  ExpandableSection,
  FileUpload,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormGroupLabelHelp,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  NumberInput,
  Popover,
  Radio,
  Switch,
  TextInput,
  Title,
} from "@patternfly/react-core";
import { css as pfCss } from "@patternfly/react-styles";
import formStyles from "@patternfly/react-styles/css/components/Form/form.mjs";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useFileUpload } from "../../api/useFileUpload.ts";
import { CertificateField } from "../components/CertificateField.tsx";
import {
  DEFAULT_OSAC_NETWORKING,
  getOsacNetworking,
  isNetrisFabricManager,
  isOsacNetworkingUnset,
  isValidNetrisControllerUrl,
  type OsacNetworkingData,
} from "../osacNetworkingValidation.ts";
import { useWizard } from "../WizardContext.tsx";
import { stepStyles } from "./stepStyles.ts";

const BCM_PRODUCT_DOC =
  "https://docs.nvidia.com/base-command-manager/base-command-manager-user-guide/latest/overview.html";
const METAL3_DOC =
  "https://github.com/metal3-io/bare-metal-operator/blob/main/README.md";

const INVENTORY_BACKEND_INTRO =
  "Connect an external inventory source so bare metal as a service can discover servers and provision them. Only one source can be enabled at a time.";

function InventoryBackendRadio({
  id,
  name,
  label,
  description,
  isChecked,
  onChange,
  helpAriaLabel,
  headerContent,
  bodyContent,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  isChecked: boolean;
  onChange: () => void;
  helpAriaLabel: string;
  headerContent?: React.ReactNode;
  bodyContent: React.ReactNode;
}) {
  const preventLabelToggle = (e: React.PointerEvent) => {
    e.preventDefault();
  };

  return (
    <Radio
      id={id}
      name={name}
      label={
        <>
          {label}
          <span
            className={stepStyles.radioLabelHelp}
            onPointerDown={preventLabelToggle}
          >
            <Popover headerContent={headerContent} bodyContent={bodyContent}>
              <FormGroupLabelHelp
                component="button"
                type="button"
                aria-label={helpAriaLabel}
                onPointerDown={preventLabelToggle}
              />
            </Popover>
          </span>
        </>
      }
      description={description}
      isChecked={isChecked}
      onChange={onChange}
    />
  );
}

export const OsacStep: React.FC = () => {
  const { state, dispatch } = useWizard();
  const globalData = ((state.configData as Record<string, unknown>).global ??
    {}) as Record<string, unknown>;
  const showBcm = state.selectedFlavors.has("bmaas");

  const aapLicenseFile = (globalData.osacAapLicenseFile as string) ?? "";
  const byoDatabase = (globalData.osacBYODatabase as boolean) ?? false;
  const databaseUrl = (globalData.osacDatabaseUrl as string) ?? "";

  // RHBK settings
  const rhbkInstances = (globalData.rhbk_instances as number) ?? 1;
  const rhbkDeployDatabase =
    (globalData.rhbk_deploy_database as boolean) ?? true;
  const rhbkDbSize = (globalData.rhbk_db_size as string) ?? "5Gi";

  const bcmEnabled = (globalData.osacBcmEnabled as boolean) ?? false;
  const bcmUrl = (globalData.osacBcmUrl as string) ?? "";
  const bcmCert = (globalData.osacBcmCert as string) ?? "";
  const bcmKey = (globalData.osacBcmKey as string) ?? "";
  const bcmCaCert = (globalData.osacBcmCaCert as string) ?? "";
  const bcmInsecure =
    (globalData.osacBcmInsecureSkipVerify as boolean) ?? false;
  const bcmHostClass = (globalData.osacBcmHostClass as string) ?? "";
  const bcmBmhNamespace = (globalData.osacBcmBmhNamespace as string) ?? "";

  const metal3Enabled = (globalData.osacMetal3Enabled as boolean) ?? false;
  const metal3Namespace = (globalData.osacMetal3Namespace as string) ?? "";
  const metal3HostClass = (globalData.osacMetal3HostClass as string) ?? "";

  const networking = getOsacNetworking(globalData);
  const netrisSelected = isNetrisFabricManager(networking);
  const netris = networking.netris ?? {};
  const netrisCredentials = netris.credentials ?? {};
  const netrisControllerUrl = netris.controllerUrl ?? "";
  const netrisUsername = netrisCredentials.username ?? "";
  const netrisPassword = netrisCredentials.password ?? "";
  const netrisSiteId = netris.siteId ?? "";
  const netrisTenantId = netris.tenantId ?? "";
  const netrisTenantName = netris.tenantName ?? "";

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [uploadFilename, setUploadFilename] = useState("");
  const { upload, uploading, error: uploadError } = useFileUpload();

  const setField = useCallback(
    (field: string, value: unknown) =>
      dispatch({ type: "SET_FIELD", path: `global.${field}`, value }),
    [dispatch],
  );

  const setNetworking = useCallback(
    (next: OsacNetworkingData) => setField("osacNetworking", next),
    [setField],
  );

  useEffect(() => {
    if (isOsacNetworkingUnset({ osacNetworking: globalData.osacNetworking })) {
      setNetworking(DEFAULT_OSAC_NETWORKING);
    }
  }, [globalData.osacNetworking, setNetworking]);

  const setFabricManager = useCallback(
    (mode: "none" | "netris") => {
      if (mode === "none") {
        setNetworking({ fabricManager: "", k8sManager: "k8s_only" });
        return;
      }
      setNetworking({
        fabricManager: "netris",
        k8sManager: "",
        netris: {
          controllerUrl: netrisControllerUrl,
          credentials: {
            username: netrisUsername,
            password: netrisPassword,
          },
          siteId: netrisSiteId,
          tenantId: netrisTenantId,
          tenantName: netrisTenantName,
        },
      });
    },
    [
      setNetworking,
      netrisControllerUrl,
      netrisUsername,
      netrisPassword,
      netrisSiteId,
      netrisTenantId,
      netrisTenantName,
    ],
  );

  const patchNetris = useCallback(
    (patch: NonNullable<OsacNetworkingData["netris"]>) => {
      setNetworking({
        fabricManager: "netris",
        k8sManager: "",
        netris: {
          controllerUrl: netrisControllerUrl,
          siteId: netrisSiteId,
          tenantId: netrisTenantId,
          tenantName: netrisTenantName,
          ...patch,
          credentials: {
            username: netrisUsername,
            password: netrisPassword,
            ...patch.credentials,
          },
        },
      });
    },
    [
      setNetworking,
      netrisControllerUrl,
      netrisUsername,
      netrisPassword,
      netrisSiteId,
      netrisTenantId,
      netrisTenantName,
    ],
  );

  const handleFileUpload = useCallback(
    async (_e: unknown, file: File) => {
      setUploadFilename(file.name);
      try {
        const { path } = await upload(file, "plugins");
        setField("osacAapLicenseFile", path);
      } catch {
        // error is tracked by useFileUpload
      }
    },
    [upload, setField],
  );

  const handleFileClear = useCallback(() => {
    setUploadFilename("");
    setField("osacAapLicenseFile", "");
  }, [setField]);

  const setInventoryBackend = useCallback(
    (backend: "none" | "bcm" | "metal3") => {
      setField("osacBcmEnabled", backend === "bcm");
      setField("osacMetal3Enabled", backend === "metal3");
    },
    [setField],
  );

  const bcmUrlError =
    state.showValidation &&
    bcmEnabled &&
    (!bcmUrl.trim() || !bcmUrl.startsWith("https://"));
  const bcmCertError = state.showValidation && bcmEnabled && !bcmCert.trim();
  const bcmKeyError = state.showValidation && bcmEnabled && !bcmKey.trim();
  const bcmNsError =
    state.showValidation && bcmEnabled && !bcmBmhNamespace.trim();
  const metal3NsError =
    state.showValidation && metal3Enabled && !metal3Namespace.trim();

  const netrisUrlError =
    state.showValidation &&
    netrisSelected &&
    (!netrisControllerUrl.trim() ||
      !isValidNetrisControllerUrl(netrisControllerUrl));
  const netrisUsernameError =
    state.showValidation && netrisSelected && !netrisUsername.trim();
  const netrisPasswordError =
    state.showValidation && netrisSelected && !netrisPassword.trim();
  const netrisSiteIdError =
    state.showValidation && netrisSelected && !netrisSiteId.trim();
  const netrisTenantIdError =
    state.showValidation && netrisSelected && !netrisTenantId.trim();
  const netrisTenantNameError =
    state.showValidation && netrisSelected && !netrisTenantName.trim();

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      <FlexItem>
        <Title headingLevel="h3" size="lg">
          OSAC Platform
        </Title>
        <Content component="p" className={stepStyles.subtitle}>
          Configure the Open Sovereign AI Cloud platform.
        </Content>
      </FlexItem>

      <FlexItem>
        <Form isWidthLimited>
          <FormGroup
            label="AAP subscription manifest"
            isRequired
            fieldId="aap-license"
            labelHelp={
              <Popover bodyContent="The OSAC platform uses Ansible Automation Platform (AAP) as its automation engine. AAP requires a Red Hat subscription manifest (manifest.zip) to operate. Download it from access.redhat.com under Subscription Allocations.">
                <FormGroupLabelHelp aria-label="More information about the AAP subscription manifest" />
              </Popover>
            }
          >
            <FileUpload
              id="aap-license-upload"
              type="dataURL"
              filename={
                uploadFilename ||
                (aapLicenseFile ? aapLicenseFile.split("/").pop() : "")
              }
              filenamePlaceholder="Upload your AAP license manifest.zip"
              onFileInputChange={(_e, file) => handleFileUpload(_e, file)}
              onClearClick={handleFileClear}
              isLoading={uploading}
              browseButtonText="Upload"
              validated={
                state.showValidation && !aapLicenseFile.trim()
                  ? "error"
                  : uploadError
                    ? "error"
                    : "default"
              }
            />
            {uploadError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{uploadError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {aapLicenseFile && !uploadError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="success">
                    Saved to: {aapLicenseFile}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {!aapLicenseFile && !uploadError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Download manifest.zip from Red Hat Subscription Allocations
                    (access.redhat.com)
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormSection aria-labelledby="osac-networking-title">
            <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
              <h4
                id="osac-networking-title"
                className={pfCss(formStyles.formSectionTitle)}
              >
                Networking
              </h4>
              <Content component="p" className={stepStyles.formSectionIntro}>
                Choose the platform fabric manager. Agentless (Kubernetes-only)
                is the default; select Netris to connect a fabric controller.
              </Content>
            </Flex>
            <FormGroup
              fieldId="osac-fabric-manager"
              role="radiogroup"
              aria-label="Fabric manager"
            >
              <Flex
                direction={{ default: "column" }}
                gap={{ default: "gapMd" }}
              >
                <Radio
                  id="osac-fabric-none"
                  name="osac-fabric-manager"
                  label="None (Kubernetes-only)"
                  description="No fabric manager — use the installer Kubernetes networking profile (k8s_only)."
                  isChecked={!netrisSelected}
                  onChange={() => setFabricManager("none")}
                />
                <Radio
                  id="osac-fabric-netris"
                  name="osac-fabric-manager"
                  label="Netris"
                  description="Configure Netris as the fabric manager for cluster and network fulfillment."
                  isChecked={netrisSelected}
                  onChange={() => setFabricManager("netris")}
                />
              </Flex>
            </FormGroup>

            {netrisSelected && (
              <>
                <FormGroup
                  label="Controller URL"
                  isRequired
                  fieldId="osac-netris-controller-url"
                >
                  <TextInput
                    id="osac-netris-controller-url"
                    value={netrisControllerUrl}
                    onChange={(_e, val) => patchNetris({ controllerUrl: val })}
                    placeholder="https://ctl.netris.example.com"
                    validated={netrisUrlError ? "error" : "default"}
                  />
                </FormGroup>
                <FormGroup
                  label="Username"
                  isRequired
                  fieldId="osac-netris-username"
                >
                  <TextInput
                    id="osac-netris-username"
                    value={netrisUsername}
                    onChange={(_e, val) =>
                      patchNetris({ credentials: { username: val } })
                    }
                    validated={netrisUsernameError ? "error" : "default"}
                  />
                </FormGroup>
                <FormGroup
                  label="Password"
                  isRequired
                  fieldId="osac-netris-password"
                >
                  <TextInput
                    id="osac-netris-password"
                    type="password"
                    value={netrisPassword}
                    onChange={(_e, val) =>
                      patchNetris({ credentials: { password: val } })
                    }
                    validated={netrisPasswordError ? "error" : "default"}
                  />
                </FormGroup>
                <FormGroup
                  label="Site ID"
                  isRequired
                  fieldId="osac-netris-site-id"
                >
                  <TextInput
                    id="osac-netris-site-id"
                    value={netrisSiteId}
                    onChange={(_e, val) => patchNetris({ siteId: val })}
                    validated={netrisSiteIdError ? "error" : "default"}
                  />
                </FormGroup>
                <FormGroup
                  label="Tenant ID"
                  isRequired
                  fieldId="osac-netris-tenant-id"
                >
                  <TextInput
                    id="osac-netris-tenant-id"
                    value={netrisTenantId}
                    onChange={(_e, val) => patchNetris({ tenantId: val })}
                    validated={netrisTenantIdError ? "error" : "default"}
                  />
                </FormGroup>
                <FormGroup
                  label="Tenant name"
                  isRequired
                  fieldId="osac-netris-tenant-name"
                >
                  <TextInput
                    id="osac-netris-tenant-name"
                    value={netrisTenantName}
                    onChange={(_e, val) => patchNetris({ tenantName: val })}
                    validated={netrisTenantNameError ? "error" : "default"}
                  />
                </FormGroup>
              </>
            )}
          </FormSection>

          {showBcm && (
            <FormSection aria-labelledby="osac-bare-metal-provisioning-title">
              <Flex
                direction={{ default: "column" }}
                gap={{ default: "gapXs" }}
              >
                <h4
                  id="osac-bare-metal-provisioning-title"
                  className={pfCss(formStyles.formSectionTitle)}
                >
                  Bare-metal provisioning
                </h4>
                <Content component="p" className={stepStyles.formSectionIntro}>
                  {INVENTORY_BACKEND_INTRO}
                </Content>
              </Flex>
              <FormGroup
                fieldId="osac-inventory-sources"
                role="radiogroup"
                aria-label="Inventory backend"
              >
                <Flex
                  direction={{ default: "column" }}
                  gap={{ default: "gapMd" }}
                >
                  <InventoryBackendRadio
                    id="osac-inventory-bcm"
                    name="osac-inventory-backend"
                    label="NVIDIA Base Command Manager (BCM)"
                    description="BCM head node API with client certificate authentication"
                    isChecked={bcmEnabled}
                    onChange={() => setInventoryBackend("bcm")}
                    helpAriaLabel="More information about NVIDIA Base Command Manager"
                    headerContent="NVIDIA Base Command Manager"
                    bodyContent={
                      <>
                        <Content component="p">
                          Discover servers and provision hosts through the BCM
                          head node JSON API (HTTPS, mTLS).
                        </Content>
                        <Button
                          variant="link"
                          isInline
                          component="a"
                          href={BCM_PRODUCT_DOC}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Learn more
                        </Button>
                      </>
                    }
                  />
                  <InventoryBackendRadio
                    id="osac-inventory-metal3"
                    name="osac-inventory-backend"
                    label="Metal3 (BareMetalHost)"
                    description="Existing BareMetalHost CRs in an OpenShift namespace"
                    isChecked={metal3Enabled}
                    onChange={() => setInventoryBackend("metal3")}
                    helpAriaLabel="More information about Metal3 bare-metal inventory"
                    headerContent="Metal3 bare-metal operator"
                    bodyContent={
                      <>
                        <Content component="p">
                          Use BareMetalHost custom resources managed by the
                          Metal3 bare-metal operator in your cluster.
                        </Content>
                        <Button
                          variant="link"
                          isInline
                          component="a"
                          href={METAL3_DOC}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Learn more
                        </Button>
                      </>
                    }
                  />
                  <Radio
                    id="osac-inventory-none"
                    name="osac-inventory-backend"
                    label="None"
                    description="Do not connect an external inventory source in this wizard"
                    isChecked={!bcmEnabled && !metal3Enabled}
                    onChange={() => setInventoryBackend("none")}
                  />
                </Flex>
              </FormGroup>

              {bcmEnabled && (
                <>
                  <FormGroup
                    label="BCM API URL"
                    isRequired
                    fieldId="osac-bcm-url"
                  >
                    <TextInput
                      id="osac-bcm-url"
                      value={bcmUrl}
                      onChange={(_e, val) => setField("osacBcmUrl", val)}
                      placeholder="https://bcm-head:8081"
                      validated={bcmUrlError ? "error" : "default"}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>
                          Head node JSON API endpoint (HTTPS, mTLS)
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>

                  <CertificateField
                    label="BCM client certificate"
                    description="PEM client certificate for mTLS"
                    value={bcmCert}
                    onChange={(v) => setField("osacBcmCert", v)}
                  />
                  {bcmCertError && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">
                          Client certificate is required
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}

                  <CertificateField
                    label="BCM client private key"
                    value={bcmKey}
                    onChange={(v) => setField("osacBcmKey", v)}
                  />
                  {bcmKeyError && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">
                          Client private key is required
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}

                  <CertificateField
                    label="BCM CA certificate (optional)"
                    description="Trust anchor for the BCM server certificate"
                    value={bcmCaCert}
                    onChange={(v) => setField("osacBcmCaCert", v)}
                  />

                  <FormGroup
                    label="BareMetalHost namespace"
                    isRequired
                    fieldId="osac-bcm-bmh-namespace"
                  >
                    <TextInput
                      id="osac-bcm-bmh-namespace"
                      value={bcmBmhNamespace}
                      onChange={(_e, val) =>
                        setField("osacBcmBmhNamespace", val)
                      }
                      placeholder="openshift-machine-api"
                      validated={bcmNsError ? "error" : "default"}
                    />
                  </FormGroup>

                  <FormGroup label="Host class" fieldId="osac-bcm-host-class">
                    <TextInput
                      id="osac-bcm-host-class"
                      value={bcmHostClass}
                      onChange={(_e, val) => setField("osacBcmHostClass", val)}
                      placeholder="bcm"
                    />
                  </FormGroup>

                  <FormGroup fieldId="osac-bcm-insecure">
                    <Switch
                      id="osac-bcm-insecure"
                      label="Skip TLS verification (test environments only)"
                      isChecked={bcmInsecure}
                      onChange={(_e, checked) =>
                        setField("osacBcmInsecureSkipVerify", checked)
                      }
                    />
                  </FormGroup>
                </>
              )}

              {metal3Enabled && (
                <>
                  <FormGroup
                    label="BareMetalHost namespace"
                    isRequired
                    fieldId="osac-metal3-namespace"
                  >
                    <TextInput
                      id="osac-metal3-namespace"
                      value={metal3Namespace}
                      onChange={(_e, val) =>
                        setField("osacMetal3Namespace", val)
                      }
                      placeholder="openshift-machine-api"
                      validated={metal3NsError ? "error" : "default"}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>
                          Namespace where existing BareMetalHost CRs are managed
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>

                  <FormGroup
                    label="Host class"
                    fieldId="osac-metal3-host-class"
                  >
                    <TextInput
                      id="osac-metal3-host-class"
                      value={metal3HostClass}
                      onChange={(_e, val) =>
                        setField("osacMetal3HostClass", val)
                      }
                      placeholder="metal3"
                    />
                  </FormGroup>
                </>
              )}
            </FormSection>
          )}

          <ExpandableSection
            toggleText={
              advancedOpen ? "Hide advanced settings" : "Advanced settings"
            }
            isExpanded={advancedOpen}
            onToggle={(_e, expanded) => setAdvancedOpen(expanded)}
          >
            <FormSection title="Fulfillment database" titleElement="h4">
              <FormGroup
                label="Database backend"
                fieldId="byo-database"
                role="radiogroup"
              >
                <Radio
                  id="db-builtin"
                  name="byo-database"
                  label="Built-in PostgreSQL"
                  description="Deploy a managed PostgreSQL instance (recommended for dev/test)"
                  isChecked={!byoDatabase}
                  onChange={() => setField("osacBYODatabase", false)}
                />
                <Radio
                  id="db-external"
                  name="byo-database"
                  label="Bring your own database"
                  description="Connect to an existing PostgreSQL instance"
                  isChecked={byoDatabase}
                  onChange={() => setField("osacBYODatabase", true)}
                />
              </FormGroup>

              {byoDatabase && (
                <FormGroup
                  label="Database URL"
                  isRequired
                  fieldId="database-url"
                >
                  <TextInput
                    id="database-url"
                    value={databaseUrl}
                    onChange={(_e, val) => setField("osacDatabaseUrl", val)}
                    placeholder="postgres://user@host:5432/dbname?sslmode=require"
                    validated={
                      state.showValidation && byoDatabase && !databaseUrl.trim()
                        ? "error"
                        : "default"
                    }
                  />
                </FormGroup>
              )}
            </FormSection>

            <FormSection title="Identity provider (Keycloak)" titleElement="h4">
              <FormGroup label="Keycloak replicas" fieldId="rhbk-instances">
                <NumberInput
                  id="rhbk-instances"
                  value={rhbkInstances}
                  min={1}
                  max={5}
                  onMinus={() =>
                    setField("rhbk_instances", Math.max(1, rhbkInstances - 1))
                  }
                  onPlus={() =>
                    setField("rhbk_instances", Math.min(5, rhbkInstances + 1))
                  }
                  onChange={(e) => {
                    const v = Number.parseInt(
                      (e.target as HTMLInputElement).value,
                      10,
                    );
                    if (v >= 1 && v <= 5) setField("rhbk_instances", v);
                  }}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      Use 3+ for production high availability
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>

              <FormGroup
                label="Keycloak database"
                fieldId="rhbk-deploy-database"
              >
                <Switch
                  id="rhbk-deploy-database"
                  label="Deploy built-in PostgreSQL for Keycloak"
                  isChecked={rhbkDeployDatabase}
                  onChange={(_e, checked) =>
                    setField("rhbk_deploy_database", checked)
                  }
                />
              </FormGroup>

              {rhbkDeployDatabase && (
                <FormGroup
                  label="Keycloak database size"
                  fieldId="rhbk-db-size"
                >
                  <TextInput
                    id="rhbk-db-size"
                    value={rhbkDbSize}
                    onChange={(_e, val) => setField("rhbk_db_size", val)}
                    placeholder="5Gi"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        PVC size for the Keycloak PostgreSQL volume
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              )}
            </FormSection>
          </ExpandableSection>
        </Form>
      </FlexItem>
    </Flex>
  );
};
