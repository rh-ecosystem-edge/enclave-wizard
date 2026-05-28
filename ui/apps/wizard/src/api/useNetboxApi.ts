import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

export interface NetboxSite {
  id: number;
  name: string;
  slug: string;
  region: string;
  facility: string;
  asn: number;
  status: string;
}

export interface NetboxDevice {
  id: number;
  name: string;
  deviceType: string;
  manufacturer: string;
  role: string;
  site: string;
  rack: string;
  position: number;
  serialNumber: string;
  status: string;
  primaryIp: string;
  tags: string[];
}

export interface NetboxRack {
  id: number;
  name: string;
  site: string;
  uHeight: number;
  devices: number;
  utilizationPercent: number;
}

export interface NetboxPrefix {
  id: number;
  prefix: string;
  status: string;
  site: string;
  vrf: string;
  role: string;
  tenant: string;
  isPool: boolean;
}

export interface NetboxVRF {
  id: number;
  name: string;
  rd: string;
}

export interface NetboxInventory {
  sites: NetboxSite[];
  devices: NetboxDevice[];
  racks: NetboxRack[];
  prefixes: NetboxPrefix[];
  vrfs: NetboxVRF[];
}

export interface NetboxConnectResponse {
  connected: boolean;
  endpoint: string;
  siteCount: number;
  deviceCount: number;
  prefixCount: number;
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

export function useNetboxApi() {
  const { token } = useAuth();

  const connect = useCallback(
    (url: string, apiToken: string) =>
      fetchJSON<NetboxConnectResponse>("/api/v1/netbox/connect", token, {
        method: "POST",
        body: JSON.stringify({ url, token: apiToken }),
      }),
    [token],
  );

  const getInventory = useCallback(
    () => fetchJSON<NetboxInventory>("/api/v1/netbox/inventory", token),
    [token],
  );

  const disconnect = useCallback(
    () => fetchJSON<void>("/api/v1/netbox/disconnect", token, { method: "POST" }),
    [token],
  );

  return { connect, disconnect, getInventory };
}
