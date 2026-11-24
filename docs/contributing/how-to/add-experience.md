# How to Add an Experience

An "experience" is a named deployment profile (e.g., CaaS, VMaaS, BMaaS) that maps to a set of plugins. Experiences appear as selectable flavor cards in the wizard.

## Data Flow

```
enclave repo: experiences/*/experience.yaml
    ↓ (Go loader reads at startup)
API: GET /api/v1/experiences
    ↓ (UI fetches, falls back to hardcoded)
UI: experiences.ts FALLBACK_EXPERIENCES
    ↓ (flavor cards reference experience IDs)
UI: flavors.ts FALLBACK_FLAVORS
```

## Steps

### 1. Create experience.yaml (enclave side)

In the enclave repo (or `enclave-mock/` for dev), create `experiences/<id>/experience.yaml`:

```yaml
name: My Experience
description: Short description of what this experience deploys
plugins:
  - name: trust-manager
    order: 100
  - name: rhbk
    order: 101
  - name: my-plugin
    order: 200
```

### 2. Add to FALLBACK_EXPERIENCES (UI)

File: `ui/apps/wizard/src/wizard/experiences.ts`

The UI tries to fetch experiences from the API but falls back to this hardcoded list. Add your experience:

```typescript
export const FALLBACK_EXPERIENCES: Experience[] = [
  // ...existing...
  {
    id: "myexp",
    name: "My Experience",
    description: "Short description",
    plugins: [
      { name: "trust-manager", order: 100 },
      { name: "rhbk", order: 101 },
      { name: "my-plugin", order: 200 },
    ],
  },
];
```

### 3. Add a flavor card (UI)

File: `ui/apps/wizard/src/wizard/flavors.ts`

Flavors are the user-facing cards on the "Select Flavor" step. Each flavor maps to an experience by ID:

```typescript
export const FALLBACK_FLAVORS: Flavor[] = [
  // ...existing...
  {
    id: "myexp",
    name: "My Experience",
    description: "User-facing description for the card",
    icon: "...",
  },
];
```

Update the `FlavorId` type if it's a union type.

### 4. Register sub-steps (if experience needs custom config)

File: `ui/apps/wizard/src/wizard/hooks/useSubSteps.ts`

If the experience needs its own configuration sub-step, add it to `buildConfigSubSteps()`:

```typescript
if (selectedFlavors.has("myexp")) {
  subs.push({ id: "my-config", label: "My Config" });
}
```

### 5. Route the sub-step to a component

File: `ui/apps/wizard/src/wizard/steps/ConfigureStep.tsx`

Add a case to `SubStepContent`:

```typescript
case "my-config":
  return <MyConfigStep />;
```

Also add the same case in `ui/apps/wizard/src/wizard/WizardPage.tsx` if it still has its own sub-step routing.

### 6. Create the step component (if needed)

Create `ui/apps/wizard/src/wizard/steps/MyConfigStep.tsx` following the pattern of existing steps (e.g., `OsacStep.tsx`). Use `SchemaFormRenderer` with dot-path field arrays for schema-driven rendering.

## Existing Experiences

| ID | Name | Plugins |
|----|------|---------|
| `caas` | Containers as a Service | trust-manager, rhbk, authorino, aap, osac |
| `vmaas` | VMs as a Service | trust-manager, rhbk, authorino, aap, cnv, osac |
| `bmaas` | Bare Metal as a Service | trust-manager, rhbk, authorino, aap, osac |
| `gpu` | GPU Compute | nvidia-gpu |
