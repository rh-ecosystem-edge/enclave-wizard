import { useEffect, useRef } from "react";
import { useCatalog } from "../contexts/CatalogContext.tsx";
import { type Experience, FALLBACK_EXPERIENCES } from "../experiences.ts";
import { FALLBACK_FLAVORS } from "../flavors.ts";

/**
 * Fetches experiences from the backend API, falling back to hardcoded
 * arrays when the endpoint is unavailable.
 *
 * Call this once at the top of the wizard. It populates CatalogContext
 * with experiences and derived flavors.
 */
export function useWizardInit(): void {
  const { setState } = useCatalog();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      let experiences: Experience[];

      try {
        const res = await fetch("/api/v1/experiences");
        if (res.ok) {
          const body = await res.json();
          experiences = Array.isArray(body)
            ? body
            : (body.experiences ?? FALLBACK_EXPERIENCES);
        } else {
          experiences = FALLBACK_EXPERIENCES;
        }
      } catch {
        experiences = FALLBACK_EXPERIENCES;
      }

      // Derive flavors from experiences that have flavor-compatible IDs
      // (caas, vmaas, bmaas). Additional experiences like "gpu" are not
      // flavors — they are add-on capabilities.
      const flavorIds = new Set(FALLBACK_FLAVORS.map((f) => f.id));
      const flavors = FALLBACK_FLAVORS.filter((f) =>
        experiences.some((e) => e.id === f.experienceId && flavorIds.has(f.id)),
      );

      setState({
        experiences,
        flavors: flavors.length > 0 ? flavors : FALLBACK_FLAVORS,
        loading: false,
      });
    };

    init();
  }, [setState]);
}
