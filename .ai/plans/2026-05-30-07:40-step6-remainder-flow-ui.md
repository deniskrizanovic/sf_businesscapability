# Plan: Step 6 Remainder — Flow UI + Docs Update

## Context

Step 6 Apex is complete. `bcm_ImportController.cls` already has `@InvocableVariable` on
`bcm_ImportResult` fields, `FlowInput` inner class, and `@InvocableMethod execute()`. The test
class has all 8 methods including both invocable tests. The original implementation plan still
references `bcm_ImportUtility` LWC — that approach is abandoned in favour of a Screen Flow
(`bcm_Import_Flow`). `bcm_ImportButton` still holds the Step 5 placeholder. Nothing under
`force-app/main/default/flows/` exists yet.

## What's Left to Build

| # | File | Action |
|---|---|---|
| 1 | `force-app/main/default/flows/bcm_Import_Flow.flow-meta.xml` | Create via `generating-flow` skill |
| 2 | `force-app/main/default/lwc/bcm_ImportButton/bcm_ImportButton.html` | Replace placeholder with `<lightning-flow>` |
| 3 | `force-app/main/default/lwc/bcm_ImportButton/bcm_ImportButton.js` | Replace `close()` with `handleStatusChange()` |
| 4 | `docs/plan/implementation-plan.md` (Step 6 block, lines 280–310) | Rewrite to reflect Flow approach |
| 5 | `docs/specs/import.md` | Add `invocable_viewer_returnsAccessDenied` marker |

## Step-by-Step

### 1 — Flow: `bcm_Import_Flow`

Invoke `generating-flow` skill. Use the three-step MCP pipeline.

Flow type: Screen Flow, API name `bcm_Import_Flow`, label "Import Capability Map".

Design:
- **Screen 1** — Long Text Area input variable `jsonPayload` (label "Paste JSON", required)
- **Apex Action** — calls `bcm_ImportController.execute`, passing `jsonPayload`; outputs stored
  as `importSuccess` (Boolean), `importErrorMessage` (Text), `capabilitiesInserted` (Number),
  `capabilitiesUpdated` (Number)
- **Decision** — `importSuccess == true` → Screen 2a; else → Screen 2b
- **Screen 2a** — Display Text "Successfully imported {capabilitiesInserted} capabilities." +
  Finish button labelled "Close"
- **Screen 2b** — Display Text showing `importErrorMessage` + Previous button (returns to Screen 1)

`inflightMetadata`: `[]` (Flow only calls Apex; no direct object field references)

Write result to `force-app/main/default/flows/bcm_Import_Flow.flow-meta.xml`.

### 2 — LWC `bcm_ImportButton.html`

Replace entire template:
```html
<template>
    <lightning-flow
        flow-api-name="bcm_Import_Flow"
        onstatuschange={handleStatusChange}>
    </lightning-flow>
</template>
```

### 3 — LWC `bcm_ImportButton.js`

Replace `close()` with:
```js
import { LightningElement } from 'lwc';

export default class BcmImportButton extends LightningElement {
    handleStatusChange(event) {
        const s = event.detail.status;
        if (s === 'FINISHED' || s === 'FINISHED_SCREEN') {
            this.dispatchEvent(new CustomEvent('closeactionpanel'));
        }
    }
}
```

### 4 — `docs/plan/implementation-plan.md` Step 6 block

Rewrite the Step 6 section (lines ~280–310):

- **Title**: `Step 6 — Import: bcm_ImportController Apex + bcm_Import_Flow Screen Flow`
- **Progress tracker row**: update description from `bcm_ImportController Apex + bcm_ImportUtility LWC` → `bcm_ImportController Apex + bcm_Import_Flow Screen Flow`
- **Design decisions**: add note — `@AuraEnabled` removed; `@InvocableVariable` + `@InvocableMethod execute()` added; no separate wrapper class; `bcm_ImportButton` embeds `<lightning-flow>` instead of `bcm_ImportUtility`
- **What gets built**: remove `bcm_ImportUtility LWC`; add `bcm_Import_Flow` Screen Flow; note `bcm_ImportButton` updated to embed Flow via `<lightning-flow>`
- **Manual checklist**: replace "panel shows `bcm_ImportUtility` component" → "panel shows Flow Screen 1 with JSON textarea"

### 5 — `docs/specs/import.md`

Add marker after "Import panel is not accessible to Viewers" scenario (after existing `permission_viewer_cannotCallImport` line):
```
> Tested by: bcm_ImportControllerTest.invocable_viewer_returnsAccessDenied
```

## Verification

1. `sf project deploy start --source-dir force-app/main/default/classes` — Apex compiles with no `@AuraEnabled` references remaining
2. Run Apex tests in org — all 8 `bcm_ImportControllerTest` methods pass at ≥75% coverage
3. `sf project deploy start --source-dir force-app/main/default/flows` — Flow deploys and is Active in Setup → Flows
4. `sf project deploy start --source-dir force-app/main/default/lwc/bcm_ImportButton` — LWC deploys
5. On a Map record page: click Import → Screen 1 (JSON textarea) appears → paste sample JSON → click Import → Screen 2a "Successfully imported N capabilities." → click Close → panel closes
6. Paste malformed JSON → Screen 2b shows error → click Previous → returns to Screen 1
7. As Viewer: click Import → Screen 2b shows "Access denied" (no unhandled Flow error)
8. `npx playwright test tests/e2e/import.spec.ts` passes
