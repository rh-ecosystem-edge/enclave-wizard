import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

export interface DiscoveredNode {
  id: string;
  name: string;
  bmcIp: string;
  bmcUser: string;
  bmcPassword: string;
  macAddress: string;
  ipAddress: string;
  rootDisk: string;
  siteName: string;
  siteId: number;
  description: string;
  cpus: number;
  ramGb: number;
  diskGb: number;
  gpuCount: number;
  gpuType: string;
  nvlinkDomain: string;
  rackPosition: string;
  portCount: number;
  labels: Record<string, string>;
  sources: string[];
}

export interface DiscoveredSite {
  id: number;
  name: string;
  asn: number;
  mesh: string;
  nodeCount: number;
  switchCount: number;
  sources: string[];
}

export interface DiscoveredNetwork {
  id: number;
  name: string;
  prefix: string;
  gateway: string;
  purpose: string;
  siteId: number;
  vpcName: string;
  sources: string[];
}

export interface DiscoveredInventory {
  sites: DiscoveredSite[];
  nodes: DiscoveredNode[];
  networks: DiscoveredNetwork[];
}

async function fetchJSON<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${window.location.origin}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
    cache: "no-store",
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text}`);
  }

  return resp.json() as Promise<T>;
}

export function useDiscoveryApi() {
  const { token } = useAuth();

  const getMergedInventory = useCallback(
    () => fetchJSON<DiscoveredInventory>("/api/v1/discovery/inventory", token),
    [token],
  );

  return { getMergedInventory };
}
