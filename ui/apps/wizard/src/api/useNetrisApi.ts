import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

export interface NetrisSite {
  id: number;
  name: string;
  publicAsn: number;
  siteMesh: string;
  aclPolicy: string;
  switchCount: number;
  serverCount: number;
}

export interface NetrisServer {
  id: number;
  name: string;
  siteId: number;
  siteName: string;
  description: string;
  mainIp: string;
  mgmtIp: string;
  portCount: number;
  macAddress: string;
  labels: Record<string, string>;
}

export interface NetrisSwitch {
  id: number;
  name: string;
  siteId: number;
  siteName: string;
  nos: string;
  role: string;
  portCount: number;
}

export interface NetrisSoftGate {
  id: number;
  name: string;
  siteId: number;
  siteName: string;
  mainIp: string;
  mgmtIp: string;
}

export interface NetrisVPC {
  id: number;
  name: string;
  tenantId: number;
  tenant: string;
}

export interface NetrisSubnet {
  id: number;
  name: string;
  prefix: string;
  purpose: string;
  siteId: number;
  vpcId: number;
  gateway: string;
}

export interface NetrisConnectResponse {
  connected: boolean;
  controller: string;
  siteCount: number;
  serverCount: number;
  vpcCount: number;
}

export interface NetrisInventory {
  servers: NetrisServer[];
  switches: NetrisSwitch[];
  softGates: NetrisSoftGate[];
}

export interface NetrisIPAM {
  subnets: NetrisSubnet[];
}

export interface NetrisApiClient {
  connect: (url: string, authType: string, token?: string, username?: string, password?: string) => Promise<NetrisConnectResponse>;
  getSites: () => Promise<NetrisSite[]>;
  getInventory: (siteId?: number) => Promise<NetrisInventory>;
  getVPCs: () => Promise<NetrisVPC[]>;
  getIPAM: (siteId?: number) => Promise<NetrisIPAM>;
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

export function useNetrisApi(): NetrisApiClient {
  const { token } = useAuth();

  const connect = useCallback(
    (url: string, authType: string, apiToken?: string, username?: string, password?: string) =>
      fetchJSON<NetrisConnectResponse>("/api/v1/netris/connect", token, {
        method: "POST",
        body: JSON.stringify({ url, authType, token: apiToken, username, password }),
      }),
    [token],
  );

  const getSites = useCallback(
    () => fetchJSON<{ sites: NetrisSite[] }>("/api/v1/netris/sites", token).then((r) => r.sites),
    [token],
  );

  const getInventory = useCallback(
    (siteId?: number) => {
      const qs = siteId != null ? `?siteId=${siteId}` : "";
      return fetchJSON<NetrisInventory>(`/api/v1/netris/inventory${qs}`, token);
    },
    [token],
  );

  const getVPCs = useCallback(
    () => fetchJSON<{ vpcs: NetrisVPC[] }>("/api/v1/netris/vpcs", token).then((r) => r.vpcs),
    [token],
  );

  const getIPAM = useCallback(
    (siteId?: number) => {
      const qs = siteId != null ? `?siteId=${siteId}` : "";
      return fetchJSON<NetrisIPAM>(`/api/v1/netris/ipam${qs}`, token);
    },
    [token],
  );

  return { connect, getSites, getInventory, getVPCs, getIPAM };
}
