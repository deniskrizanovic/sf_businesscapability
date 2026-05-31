# Step 7 — Diagram: `bcm_CapabilityMap` LWC (read-only)

## Context

Step 6 complete (deployed 2026-05-30). Step 7 delivers the read-only SVG diagram visualisation: `bcm_CapabilityMap` LWC replacing the placeholder in `bcm_VisualisationButton`, three Apex controllers with test classes, a `bcm_ContextMenu` stub, and Playwright e2e tests. Brings project to ~89% (99/111 CFPs).

## Pre-condition check

`docs/plan/implementation-plan.md` line 333: Step 6 checkbox = `[x]`. Confirmed — proceed.

---

## Deliverables

### 1. Apex Controllers (skill: `generating-apex`)


| Class                      | Method                                                     | SOQL                                                                                    |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `bcm_MapController`        | `getMaps()` `@AuraEnabled(cacheable=true)`                 | `SELECT Id, Name FROM bcm_Map__c ORDER BY Name ASC`                                     |
| `bcm_CapabilityController` | `getCapabilities(Id mapId)` `@AuraEnabled(cacheable=true)` | See design doc query — includes subquery on`bcm_CapabilityTags__r` for tag colour data |
| `bcm_TagController`        | `getTags()` `@AuraEnabled(cacheable=true)`                 | `SELECT Id, Name, bcm_Colour__c FROM bcm_Tag__c ORDER BY Name ASC`                      |

All `with sharing`. Thin controllers — no business logic. `AuraHandledException` catch at controller boundary only.

### 2. Apex Test Classes (skill: `generating-apex-test`)

- `bcm_MapControllerTest` — getMaps returns records, empty org returns empty list
- `bcm_CapabilityControllerTest` — getCapabilities returns capabilities for correct map, excludes other maps, includes tag subquery data
- `bcm_TagControllerTest` — getTags returns all tags ordered by name
- All use `TestDataFactory` (`force-app/main/default/classes/TestDataFactory.cls`)
- All ≥75% coverage

### 3. LWC: `bcm_CapabilityMap` (new)

**SVG rendering approach:** Pure inline SVG in `bcm_CapabilityMap` template, no child LWC for SVG fragments (LWC SVG-in-shadow-DOM constraint per `docs/design/05-lwc-architecture.md` line 163). Layout nodes computed in JS, rendered via `for:each` directly in parent template.

**Layout constants** (from `docs/design/03-diagram-layout.md`):

```js
COLUMN_WIDTH=220, COLUMN_GAP=16, CHEVRON_HEIGHT=60, CHEVRON_NOTCH=16,
BOX_PADDING=12, BOX_HEADER_HEIGHT=40, LINE_HEIGHT=20, BOX_GAP=12,
DIAGRAM_PADDING=24, FONT_SIZE_L1=13, FONT_SIZE_L2=12, FONT_SIZE_L3=11
```

**Apex imports:**

```js
import getMaps from '@salesforce/apex/bcm_MapController.getMaps';
import getCapabilities from '@salesforce/apex/bcm_CapabilityController.getCapabilities';
import getTags from '@salesforce/apex/bcm_TagController.getTags';
```

**Tracked state:** `selectedMapId`, `capabilities`, `layoutNodes`, `zoom` (default 1.0, clamp 0.2–3.0), `panX`, `panY`, `selectedTagId`, `highlightedNodeIds`, `isLoading`, `errorMessage`, `canEdit`

**Key behaviours:**

- `getMaps` via `@wire` on load → populates Map combobox
- `getTags` via `@wire` on load → populates Tag combobox
- `getCapabilities` imperative on map selection change
- Tree assembly: flat list → `Map<Id, node{...record, children:[]}>` → root nodes sorted by `bcm_SortOrder__c`
- Layout calculation: column X from index, box Y from sibling heights, canvas dimensions from totals
- SVG elements: `<polygon>` for L1 chevrons (6 points), `<rect rx="6">` for L2 boxes, `<text>` for L3 bullets prefixed `• `
- Text wrapping: split on spaces, estimate char width = `fontSize × 0.6`, max 3 lines; L3 truncate with `…`
- Zoom: `onwheel` event, zoom toward cursor; `+`/`-` buttons zoom to canvas centre; clamp 0.2–3.0
- Pan: `onmousedown`/`onmousemove`/`onmouseup` on SVG background (not on nodes)
- Tag highlight: on tag change, collect IDs from loaded `bcm_CapabilityTags__r` data, set L2 box fill to tag `bcm_Colour__c`; "None" → all white
- `canEdit`: `import hasPermission from '@salesforce/customPermission/bcm_CanEdit'` — no drag handles rendered in Step 7

**Template structure:** per `docs/design/05-lwc-architecture.md` lines 67–124 — toolbar div, spinner, SVG canvas with `<g transform={viewportTransform}>`, context menu overlay div.

### 4. LWC: `bcm_ContextMenu` (new stub)

Floating `<div>` overlay positioned at click coordinates. Single `<li>` placeholder: "No actions available". Emits `close` custom event on outside click or Escape key. Properties: `@api x`, `@api y`, `@api node`.

### 5. LWC: `bcm_VisualisationButton` (update)

Replace placeholder HTML in `bcm_VisualisationButton.html` (line 3) with `<c-bcm_-capability-map>`. Remove placeholder `<p>` text.

### 6. Playwright e2e: `tests/e2e/diagram.spec.ts` (new)

Pattern mirrors `tests/e2e/import.spec.ts`. Cover all spec scenarios from `docs/specs/diagram.md`:


| describe block       | scenarios                                              |
| -------------------- | ------------------------------------------------------ |
| Map selector         | dropdown populated, empty canvas before selection      |
| Diagram structure    | L1 chevrons, L2 boxes, L3 bullets, sort order columns  |
| Zoom & pan           | wheel zoom in/out, zoom clamp, click-drag pan          |
| Tag highlight        | tag highlights L2, non-tagged stays white, None clears |
| Context menu         | node click opens menu, dismiss closes it               |
| Permission — viewer | no drag handles visible                                |

Use `editor.json` and `viewer.json` storage states. Use `RUN_ID` for unique map names. Seed diagram data in `beforeAll` using the SAMPLE_JSON import pattern from `import.spec.ts`.

---

## File Inventory


| Action | Path                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| NEW    | `force-app/main/default/classes/bcm_MapController.cls` + `-meta.xml`              |
| NEW    | `force-app/main/default/classes/bcm_MapControllerTest.cls` + `-meta.xml`          |
| NEW    | `force-app/main/default/classes/bcm_CapabilityController.cls` + `-meta.xml`       |
| NEW    | `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` + `-meta.xml`   |
| NEW    | `force-app/main/default/classes/bcm_TagController.cls` + `-meta.xml`              |
| NEW    | `force-app/main/default/classes/bcm_TagControllerTest.cls` + `-meta.xml`          |
| NEW    | `force-app/main/default/lwc/bcm_CapabilityMap/` (html, js, css, meta.xml)         |
| NEW    | `force-app/main/default/lwc/bcm_ContextMenu/` (html, js, meta.xml)                |
| EDIT   | `force-app/main/default/lwc/bcm_VisualisationButton/bcm_VisualisationButton.html` |
| NEW    | `tests/e2e/diagram.spec.ts`                                                       |
| EDIT   | `docs/plan/implementation-plan.md` — tick Step 7 checkbox + date                 |
| EDIT   | `docs/specs/diagram.md` — add `> Tested by:` markers                             |

---

## Build Sequence

1. Invoke `generating-apex` → `bcm_MapController`, `bcm_CapabilityController`, `bcm_TagController`
2. Invoke `generating-apex-test` → three test classes
3. Deploy all Apex classes
4. run Apex unit tests until they pass
5. Write `bcm_CapabilityMap` LWC (html + js + css + meta)
6. Write `bcm_ContextMenu` LWC stub
7. Edit `bcm_VisualisationButton.html` — replace placeholder with `<c-bcm_-capability-map>`
8. Deploy: `sf project deploy start --source-dir force-app`
9. Write `tests/e2e/diagram.spec.ts`
10. Run: `npx playwright test tests/e2e/diagram.spec.ts`
11. Tick Step 7 in `implementation-plan.md`, add `> Tested by:` in `diagram.md`

---

## Verification

- `sf project deploy start` — zero errors
- All Apex test classes ≥90% coverage in org
- `npx playwright test tests/e2e/diagram.spec.ts` — zero failures
- Manual: open Map record → Visualisation → diagram renders L1/L2/L3 → zoom/pan → tag highlight → context menu placeholder → no drag handles
