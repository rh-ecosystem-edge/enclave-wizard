/** Product message for OSAC CaaS dependency (OSAC-5255 / OSAC-4677). */
export const CAAS_REQUIRES_COMPANION_MESSAGE = "CaaS requires VMaaS or BMaaS.";

/** CaaS alone is invalid; empty and VMaaS/BMaaS-only are valid. */
export function isValidFlavorSelection(selected: ReadonlySet<string>): boolean {
  if (!selected.has("caas")) return true;
  return selected.has("vmaas") || selected.has("bmaas");
}
