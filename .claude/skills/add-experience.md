---
name: add-experience
description: Add a new experience (deployment profile/flavor) to the wizard. Use when creating a new flavor card or experience definition.
---

# Add an Experience

## 1. Create experience.yaml (enclave side)

Create `experiences/<id>/experience.yaml` in the enclave repo (or `enclave-mock/` for dev):

```yaml
name: My Experience
description: Short description
plugins:
  - name: trust-manager
    order: 100
  - name: my-plugin
    order: 200
```

## 2. Add to FALLBACK_EXPERIENCES

File: `ui/apps/wizard/src/wizard/experiences.ts`

```typescript
{
  id: "myexp",
  name: "My Experience",
  description: "Description",
  plugins: [
    { name: "trust-manager", order: 100 },
    { name: "my-plugin", order: 200 },
  ],
},
```

## 3. Add a flavor card

File: `ui/apps/wizard/src/wizard/flavors.ts`

Add a flavor entry. Update the `FlavorId` type if it's a union.

## 4. Register sub-steps (if custom config needed)

File: `ui/apps/wizard/src/wizard/hooks/useSubSteps.ts`

Add conditional sub-step in `buildConfigSubSteps()`:

```typescript
if (selectedFlavors.has("myexp")) {
  subs.push({ id: "my-config", label: "My Config" });
}
```

## 5. Route the sub-step

File: `ui/apps/wizard/src/wizard/steps/ConfigureStep.tsx` — add case in `SubStepContent`.

Also check `ui/apps/wizard/src/wizard/WizardPage.tsx` if it has its own routing.

## 6. Create step component (if needed)

Create `ui/apps/wizard/src/wizard/steps/MyConfigStep.tsx` following existing patterns. Use `SchemaFormRenderer` for schema-driven fields.

See `docs/contributing/how-to/add-experience.md` for the full guide.
