import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext.tsx";

export interface NicoGPU {
  index: number;
  type: string;
  memoryGb: number;
  health: string;
}

export interface NicoDPU {
  name: string;
  model: string;
  firmware: string;
  vfCount: number;
  mgmtIp: string;
  bmcIp: string;
}

export interface NicoServer {
  name: string;
  model: string;
  serialNumber: string;
  gpus: NicoGPU[];
  dpus: NicoDPU[];
  nvlinkDomain: string;
  cpus: number;
  ramGb: number;
}

export interface NicoNVLinkDomain {
  name: string;
  servers: string[];
  gpuCount: number;
}

export interface NicoSwitch {
  name: string;
  model: string;
  firmware: string;
  role: string;
  ports: number;
}

export interface NicoInventory {
  servers: NicoServer[];
  nvlinkDomains: NicoNVLinkDomain[];
  switches: NicoSwitch[];
}

export interface NicoConnectResponse {
  connected: boolean;
  controller: string;
  serverCount: number;
  gpuCount: number;
  dpuCount: number;
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

export function useNicoApi() {
  const { token } = useAuth();

  const connect = useCallback(
    (url: string, username: string, password: string) =>
      fetchJSON<NicoConnectResponse>("/api/v1/nico/connect", token, {
        method: "POST",
        body: JSON.stringify({ url, username, password }),
      }),
    [token],
  );

  const getInventory = useCallback(
    () => fetchJSON<NicoInventory>("/api/v1/nico/inventory", token),
    [token],
  );

  return { connect, getInventory };
}
