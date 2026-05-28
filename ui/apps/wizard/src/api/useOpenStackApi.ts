import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

export interface OSAvailabilityZone {
  name: string;
  available: boolean;
  hostCount: number;
}

export interface OSBaremetalNode {
  uuid: string;
  name: string;
  provisionState: string;
  powerState: string;
  driver: string;
  bmcAddress: string;
  bmcUser: string;
  bmcPassword: string;
  bootMacAddress: string;
  rootDisk: string;
  cpus: number;
  ramGb: number;
  diskGb: number;
  manufacturer: string;
  model: string;
  serialNumber: string;
  availabilityZone: string;
}

export interface OSSubnet {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  dns: string;
  ipVersion: number;
}

export interface OSNetwork {
  id: string;
  name: string;
  networkType: string;
  physicalNet: string;
  shared: boolean;
  subnets: OSSubnet[];
}

export interface OSInventory {
  availabilityZones: OSAvailabilityZone[];
  baremetalNodes: OSBaremetalNode[];
  networks: OSNetwork[];
}

export interface OSConnectResponse {
  connected: boolean;
  endpoint: string;
  project: string;
  azCount: number;
  nodeCount: number;
  networkCount: number;
}

async function fetchJSON<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${window.location.origin}${path}`, {
    ...options, headers: { ...headers, ...options?.headers }, cache: "no-store",
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

export function useOpenStackApi() {
  const { token } = useAuth();

  const connect = useCallback(
    (authUrl: string, username: string, password: string, project: string, domain: string) =>
      fetchJSON<OSConnectResponse>("/api/v1/openstack/connect", token, {
        method: "POST",
        body: JSON.stringify({ authUrl, username, password, project, domain }),
      }),
    [token],
  );

  const getInventory = useCallback(
    () => fetchJSON<OSInventory>("/api/v1/openstack/inventory", token),
    [token],
  );

  return { connect, getInventory };
}
