/** Product message for OSAC CaaS dependency (OSAC-5255 / OSAC-4677). */
export const CAAS_REQUIRES_COMPANION_MESSAGE = "CaaS requires VMaaS or BMaaS.";

/** Shown when no CaaS / VMaaS / BMaaS flavor is selected after the user interacts. */
export const SELECT_AT_LEAST_ONE_SERVICE_MESSAGE =
  "Select at least one service.";

/**
 * At least one service is required. CaaS alone is invalid (needs VMaaS
 * and/or BMaaS). VMaaS-only and BMaaS-only are valid.
 */
export function isValidFlavorSelection(selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return false;
  if (!selected.has("caas")) return true;
  return selected.has("vmaas") || selected.has("bmaas");
}

export interface FlavorConstraintMessageOptions {
  /** False while the step is pristine (no flavor toggle yet). */
  selectionTouched?: boolean;
}

/**
 * Inline danger-alert title for an invalid flavor selection, or null.
 * Empty selection stays silent until the user has touched the step.
 */
export function flavorConstraintMessage(
  selected: ReadonlySet<string>,
  options: FlavorConstraintMessageOptions = {},
): string | null {
  if (isValidFlavorSelection(selected)) return null;
  if (selected.size === 0) {
    return options.selectionTouched
      ? SELECT_AT_LEAST_ONE_SERVICE_MESSAGE
      : null;
  }
  return CAAS_REQUIRES_COMPANION_MESSAGE;
}
