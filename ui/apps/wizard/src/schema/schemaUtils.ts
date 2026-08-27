export interface FieldMeta {
  path: string;
  label: string;
  description: string | undefined;
  type: string;
  required: boolean;
  enum: string[] | undefined;
  pattern: string | undefined;
  minimum: number | undefined;
  maximum: number | undefined;
  items: unknown | undefined;
}

interface SchemaNode {
  type?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  doc?: string;
  description?: string;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: SchemaNode;
  [key: string]: unknown;
}

const LABEL_OVERRIDES: Record<string, string> = {
  apiVIP: "API VIP",
  ingressVIP: "Ingress VIP",
  rendezvousIP: "Rendezvous IP",
  defaultDNS: "DNS Server",
  defaultGateway: "Default Gateway",
  defaultPrefix: "Subnet Prefix Length",
  lzBmcIP: "Landing Zone BMC IP",
  lzBmcHostname: "Landing Zone BMC Hostname",
  baseDomain: "Base Domain",
  clusterName: "Cluster Name",
  machineNetwork: "Machine Network CIDR",
  disconnected: "Disconnected (Air-Gapped) Mode",
  masterMaxPods: "Max Pods per Node",
  diskEncryption: "TPM v2 Disk Encryption",
  ocMirrorLogLevel: "oc-mirror Log Level",
  defaultNtpServers: "NTP Servers",
  quayUser: "Quay Admin Username",
  quayPassword: "Quay Admin Password",
  quayBackend: "Quay Storage Backend",
  quayBackendRGWConfiguration: "RadosGW Configuration",
  storage_plugin: "Storage Plugin",
  osacDnsClass: "DNS class",
  osacDnsZone: "DNS zone",
  odfExternalConfig: "ODF External Config",
  lvmsConfig: "LVMS Configuration",
  enabled_plugins: "Enabled Plugins",
  pullSecret: "Pull Secret",
  sshPubKey: "SSH Public Key",
  agent_hosts: "Agent Hosts",
  discovery_hosts: "Discovery Hosts",
  macAddress: "MAC Address",
  ipAddress: "IP Address",
  redfish: "Redfish BMC IP",
  redfishUser: "Redfish Username",
  redfishPassword: "Redfish Password",
  rootDisk: "Root Disk Path",
  bmcSystemId: "BMC System ID",
  mapInterfaces: "Interface Mapping",
  networkConfig: "Network Configuration",
  sslAPICertificateFullChain: "API Certificate (Full Chain)",
  sslAPICertificateKey: "API Certificate Key",
  sslIngressCertificateFullChain: "Ingress Certificate (Full Chain)",
  sslIngressCertificateKey: "Ingress Certificate Key",
  sslCACertificate: "Root CA Certificate",
  ironicHTTPSCertificate: "Ironic HTTPS Certificate",
  ironicHTTPSKey: "Ironic HTTPS Key",
  access_key: "Access Key",
  secret_key: "Secret Key",
  bucket_name: "Bucket Name",
  hostname: "Hostname",
  is_secure: "Use HTTPS",
  port: "Port",
  minimum_chunk_size_mb: "Min Chunk Size (MB)",
  maximum_chunk_size_mb: "Max Chunk Size (MB)",
  server_side_assembly: "Server-Side Assembly",
  storage_path: "Storage Path",
};

export function humanizeFieldName(fieldName: string): string {
  if (LABEL_OVERRIDES[fieldName]) {
    return LABEL_OVERRIDES[fieldName];
  }
  return fieldName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function getNestedSchema(
  root: SchemaNode,
  dotPath: string,
): SchemaNode | undefined {
  const keys = dotPath.split(".");
  let current: SchemaNode | undefined = root;

  for (const key of keys) {
    if (!current?.properties) return undefined;
    current = current.properties[key];
    if (!current) return undefined;
  }

  return current;
}

export function extractFieldMeta(
  root: SchemaNode,
  dotPath: string,
  requiredOverride?: string[],
): FieldMeta | undefined {
  const schema = getNestedSchema(root, dotPath);
  if (!schema) return undefined;

  const keys = dotPath.split(".");
  const fieldName = keys[keys.length - 1];
  const parentPath = keys.slice(0, -1).join(".");
  const parentSchema = parentPath ? getNestedSchema(root, parentPath) : root;

  const requiredList = requiredOverride ?? parentSchema?.required ?? [];

  return {
    path: dotPath,
    label: humanizeFieldName(fieldName),
    description: (schema.doc ?? schema.description) as string | undefined,
    type: (schema.type as string) ?? "string",
    required: requiredList.includes(fieldName),
    enum: schema.enum,
    pattern: schema.pattern,
    minimum: schema.minimum,
    maximum: schema.maximum,
    items: schema.items,
  };
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isFieldEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export interface StepValidationError {
  path: string;
  label: string;
  message: string;
}

function validateSingleField(meta: FieldMeta, value: unknown): string | null {
  if (meta.required && isFieldEmpty(value)) {
    return `${meta.label} is required`;
  }

  if (isFieldEmpty(value)) return null;

  if (typeof value === "string") {
    if (meta.pattern) {
      try {
        const re = new RegExp(meta.pattern);
        if (!re.test(value)) {
          return `${meta.label} has an invalid format`;
        }
      } catch {
        // skip invalid regex from schema
      }
    }
  }

  if (typeof value === "number") {
    if (meta.minimum != null && value < meta.minimum) {
      return `${meta.label} must be at least ${meta.minimum}`;
    }
    if (meta.maximum != null && value > meta.maximum) {
      return `${meta.label} must be at most ${meta.maximum}`;
    }
  }

  if (meta.enum && typeof value === "string") {
    if (!meta.enum.includes(value)) {
      return `${meta.label} must be one of: ${meta.enum.join(", ")}`;
    }
  }

  return null;
}

export function validateFields(
  schema: unknown,
  fields: string[],
  values: Record<string, unknown>,
): StepValidationError[] {
  const errors: StepValidationError[] = [];
  for (const field of fields) {
    const meta = extractFieldMeta(schema as SchemaNode, field);
    if (!meta) continue;
    const value = getValueByPath(values, field);
    const error = validateSingleField(meta, value);
    if (error) {
      errors.push({ path: field, label: meta.label, message: error });
    }
  }
  return errors;
}

export function validateHostEntries(
  schema: unknown,
  hosts: Record<string, unknown>[],
  label: string,
): StepValidationError[] {
  const errors: StepValidationError[] = [];
  const hostSchema = getNestedSchema(
    schema as SchemaNode,
    "global.agent_hosts",
  );
  const itemSchema = (hostSchema as SchemaNode)?.items;
  if (!itemSchema?.properties) return errors;

  const hostFieldPaths = Object.keys(itemSchema.properties);
  const requiredFields = itemSchema.required ?? [];

  for (let i = 0; i < hosts.length; i++) {
    for (const fieldName of hostFieldPaths) {
      const fieldSchema = itemSchema.properties[fieldName];
      if (!fieldSchema) continue;
      const meta: FieldMeta = {
        path: `${label}[${i}].${fieldName}`,
        label: humanizeFieldName(fieldName),
        description: (fieldSchema.doc ?? fieldSchema.description) as
          | string
          | undefined,
        type: (fieldSchema.type as string) ?? "string",
        required: requiredFields.includes(fieldName),
        enum: fieldSchema.enum,
        pattern: fieldSchema.pattern,
        minimum: fieldSchema.minimum,
        maximum: fieldSchema.maximum,
        items: fieldSchema.items,
      };
      const value = hosts[i][fieldName];
      const error = validateSingleField(meta, value);
      if (error) {
        errors.push({
          path: meta.path,
          label: meta.label,
          message: `${label} ${i + 1}: ${error}`,
        });
      }
    }
  }
  return errors;
}

// Keep backwards compat alias
export const validateRequiredFields = validateFields;

export function listSchemaFields(
  root: SchemaNode,
  parentPath: string,
): string[] {
  const parent = getNestedSchema(root, parentPath);
  if (!parent?.properties) return [];

  return Object.keys(parent.properties).map((key) => `${parentPath}.${key}`);
}
