/** Product message for OSAC CaaS dependency (OSAC-5255 / OSAC-4677). */
export const CAAS_REQUIRES_COMPANION_MESSAGE =
  "CaaS requires VMaaS or BMaaS.";

/** CaaS alone is invalid; empty and VMaaS/BMaaS-only are valid. */
export function isValidFlavorSelection(
  selected: ReadonlySet<string>,
): boolean {
  if (!selected.has("caas")) return true;
  return selected.has("vmaas") || selected.has("bmaas");
}

export function previewFlavorToggle(
  selected: ReadonlySet<string>,
  flavor: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(flavor)) {
    next.delete(flavor);
  } else {
    next.add(flavor);
  }
  return next;
}

/**
 * Refuse deselects that would leave CaaS without VMaaS or BMaaS.
 * Selecting into CaaS-alone is allowed (Next is blocked separately).
 */
export function shouldRefuseFlavorToggle(
  selected: ReadonlySet<string>,
  flavor: string,
): boolean {
  const isDeselect = selected.has(flavor);
  if (!isDeselect) return false;
  return !isValidFlavorSelection(previewFlavorToggle(selected, flavor));
}
