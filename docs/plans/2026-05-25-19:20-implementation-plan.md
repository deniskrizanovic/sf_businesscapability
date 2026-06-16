# Business Capability Map — Implementation Plan

## How to use this plan

- Each step has a BDD spec file in `docs/specs/` listing formal acceptance criteria. Review the spec before starting the step.
- Each step is a deployable slice. Claude deploys to `home-denispoc` at the end of each step and reports the deployment result, then stops.
- **Claude never marks a step complete.** Only you mark a step complete after confirming every item in the manual inspection checklist.
- **Do not start a step until the previous step's checkbox is ticked.**
- Before starting any step, Claude must check that the prior step checkbox is `[x]`. If it is still `[ ]`, Claude must stop and ask why before proceeding.
- Before starting any step, Claude must run `git status` and confirm the branch is clean (no uncommitted changes, no untracked files under `force-app/`). If the branch is not clean, Claude must stop and ask before proceeding.
- Every step that creates Salesforce metadata must use the appropriate skill from the table in `CLAUDE.md`. Claude must confirm which skill it is invoking before generating any file.
- Every permission set must include `<applicationVisibilities>` for `bcm_BusinessCapabilityMap` with `<visible>true</visible>` so the app appears in the App Launcher.
- **Deploy command:** use `--source-dir` flags for each new metadata folder rather than deploying the whole `force-app` tree. This avoids stale `destructiveChanges.xml` entries from source tracking picking up not-yet-built future components.
- Every Apex test class must test permission boundaries using `System.runAs()` — at minimum one test user with `bcm_Viewer` assigned and one with `bcm_Editor` assigned. DML operations that should fail for Viewers must assert a `DmlException` is thrown. DML operations that should succeed for Editors must assert the record is saved.
- Page layouts use org-generated defaults. No custom layout XML is created.
- The Custom Permission (`bcm_CanEdit`) is the single explicit exception — it is hand-written XML.

---

## Progress Tracker

| Step | Description                                                                                        | FPs Unlocked                                            | CFP | Cumul. | % Done | Status | Completed  |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --- | ------ | ------ | ------ | ---------- |
| 1    | `bcm_Map__c` — object, fields, permission sets, Maps tab, app                                      | FP7–12 (Map CRUD)                                       | 18  | 18     | 15%    | `[x]`  | 2026-05-25 |
| 2    | `bcm_Capability__c` — object, fields, trigger, validation rules, Capabilities tab, Map record page | FP13, FP15–19 (Capability list + CRUD)                  | 21  | 39     | 33%    | `[x]`  | 2026-05-26 |
| 3    | `bcm_Tag__c` — object, fields, validation rule, Tags tab                                           | FP22–28 (Tag CRUD + detail)                             | 23  | 62     | 52%    | `[x]`  | 2026-05-27 |
| 4    | `bcm_CapabilityTag__c` — junction object, permission additions                                     | FP14, FP20–21 (Capability detail w/tags, tag junctions) | 15  | 77     | 65%    | `[x]`  | 2026-05-28 |
| 5    | App structure — Custom Permission, FlexiPage stubs, Import tab                                     | —                                                       | 0   | 77     | 65%    | `[x]`  | 2026-05-30 |
| 6    | Import —`bcm_ImportController` Apex + `bcm_Import_Flow` Screen Flow                                | FP4 (Import JSON)                                       | 11  | 88     | 74%    | `[x]`  | 2026-05-30 |
| 7    | Diagram —`bcm_CapabilityMap` LWC (read-only) + Detail Panel + cross-cutting band                   | FP1–3, FP29–30 (Diagram + Detail Panel)                 | 19  | 107    | 90%    | `[x]`  | 2026-06-05 |
| 8    | Drag-drop —`bcm_DragDropController` Apex + LWC interactions                                        | FP5–6 (Reorder + Reparent)                              | 12  | 119    | 100%   | `[ ]`  | —          |

---

## Step 1 — `bcm_Map__c`: Object, Fields, Permission Sets, Maps Tab, App

**Spec:** [map-object.md](../specs/map-object.md)

**Before starting:** No prior step. Proceed directly.

**What gets built:**

- Custom object `bcm_Map__c`
- Fields: `bcm_Description__c` (Rich Text Area)
- Permission sets `bcm_Viewer` and `bcm_Editor` (created here; both expanded in later steps)
    - `bcm_Viewer`: Read on `bcm_Map__c`; Maps tab Hidden
    - `bcm_Editor`: Read, Create, Edit, Delete on `bcm_Map__c`; Maps tab Default On
- Object Tab for `bcm_Map__c` (Maps tab)
- Lightning App `bcm_BusinessCapabilityMap` with the Maps tab included

**Skills to invoke (Claude must confirm before generating any file):**

- `generating-custom-object` — for `bcm_Map__c`
- `generating-custom-tab` — for the Maps tab
- `generating-permission-set` — for `bcm_Viewer`
- `generating-permission-set` — for `bcm_Editor`
- `generating-custom-application` — for `bcm_BusinessCapabilityMap`

**Manual inspection checklist:**

- [ ] `bcm_Map__c` visible in Setup → Object Manager
- [ ] `bcm_Description__c` field present on the object
- [ ] `bcm_BusinessCapabilityMap` Lightning App visible in App Launcher
- [ ] Maps tab visible in the BCM app (when assigned `bcm_Editor`)
- [ ] Maps tab visible when assigned `bcm_Viewer`
- [ ] Can create a Map record from the Maps tab
- [ ] `bcm_Viewer` permission set exists and grants Read on `bcm_Map__c`
- [ ] `bcm_Editor` permission set exists and grants Read/Create/Edit/Delete on `bcm_Map__c`
- [ ] `npx playwright test tests/e2e/map.spec.ts` passes with zero failures

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-25

---

## Step 2 — `bcm_Capability__c`: Object, Fields, Validation Rules, Permission Additions, Capabilities Tab

**Spec:** [capability-object.md](../specs/capability-object.md)

**Before starting:** Claude must confirm Step 1 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Custom object `bcm_Capability__c`
- Fields:
    - `bcm_Map__c` (Lookup → `bcm_Map__c`, Required, deleteConstraint: Restrict)
    - `bcm_Parent__c` (Lookup → `bcm_Capability__c`, Optional, deleteConstraint: SetNull)
    - `bcm_Level__c` (Number 1,0 — Optional; set by trigger)
    - `bcm_SortOrder__c` (Number 6,0 — Optional; set by trigger)
    - `bcm_ExternalId__c` (Text 255 — Unique, External ID)
    - `bcm_Definition__c` (Rich Text Area 32768)
    - `bcm_StrategySupport__c` (Rich Text Area 32768)
    - `bcm_ArchitecturalNuance__c` (Rich Text Area 32768)
- Apex trigger `bcm_CapabilityTrigger` + handler `bcm_CapabilityHandler` (before insert, before update):
    - Derives `bcm_Level__c` from parent: null parent → 1; parent set → parent's level + 1
    - If `bcm_SortOrder__c` is blank, sets it to MAX sibling SortOrder + 1 (scope: same map, same parent)
- Validation rules (safety guards — trigger sets valid values, rules catch anything that bypasses the trigger):
    - Level must be 1, 2, or 3
    - If Parent is null, Level must be 1
    - If Parent is set, Level must be 2 or 3
    - If Parent is set, Parent's Level must equal this Level − 1 (prevents e.g. L3 parented to L1)
- Apex test class `bcm_CapabilityValidationTest` covering:
    - Level derived as 1 when no parent provided
    - Level derived as 2 when parent is L1
    - Level derived as 3 when parent is L2
    - SortOrder auto-assigned as MAX+1 when not provided
    - SortOrder preserved when explicitly provided
    - Viewer cannot insert (DmlException)
    - Editor can insert valid Capability
    - Editor cannot insert invalid Capability (Level 2, no parent)
- Permission set additions:
    - `bcm_Viewer`: add Read on `bcm_Capability__c`; Capabilities tab Default On
    - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_Capability__c`; Capabilities tab Default On
- Object Tab for `bcm_Capability__c` (Capabilities tab)
- `bcm_BusinessCapabilityMap` app updated to include the Capabilities tab
- Lightning Record Page `bcm_MapRecordPage` for `bcm_Map__c` — assigned as default for the app; includes highlights panel, detail, and Capabilities related list

**Skills to invoke (Claude must confirm before generating any file):**

- `generating-custom-object` — for `bcm_Capability__c`
- `generating-custom-field` — for each field (invoke per field or in batch as skill allows)
- `generating-validation-rule` — for each validation rule
- `generating-custom-tab` — for the Capabilities tab
- `generating-permission-set` — update `bcm_Viewer` and `bcm_Editor`
- `generating-custom-application` — update `bcm_BusinessCapabilityMap` to include Capabilities tab
- `generating-apex` — for `bcm_CapabilityTrigger` and `bcm_CapabilityHandler`
- `generating-apex-test` — for `bcm_CapabilityValidationTest`
- `generating-flexipage` — for `bcm_MapRecordPage` (Record Page for `bcm_Map__c`)

**Manual inspection checklist:**

- [ ] `bcm_Capability__c` visible in Setup → Object Manager
- [ ] All 8 custom fields present
- [ ] Capability record layout shows fields in order: Map, Level, Capability Name, Parent Capability, Sort Order
- [ ] `bcm_ExternalId__c` marked as External ID in field detail
- [ ] `bcm_Parent__c` is a self-referencing lookup (not Master-Detail)
- [ ] All 4 validation rules active on the object
- [ ] Create a Capability with no Parent, no Level → record saves; Level = 1 set by trigger
- [ ] Create a Capability with an L1 Parent, no Level → record saves; Level = 2 set by trigger
- [ ] Create a Capability with no SortOrder → record saves; SortOrder = MAX+1 within siblings
- [ ] `bcm_CapabilityValidationTest` passes with all test methods green
- [ ] Capabilities tab visible in the BCM app
- [ ] `bcm_Viewer` now grants Read on `bcm_Capability__c`
- [ ] `bcm_Editor` now grants Read/Create/Edit/Delete on `bcm_Capability__c`
- [ ] Open a `bcm_Map__c` record → `bcm_MapRecordPage` loads with Capabilities related list visible
- [ ] Create a Capability linked to that Map → it appears in the related list without page refresh
- [ ] `npx playwright test tests/e2e/capability.spec.ts` passes with zero failures

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-26

---

## Step 3 — `bcm_Tag__c`: Object, Fields, Validation Rule, Permission Additions, Tags Tab

**Spec:** [tag-object.md](../specs/tag-object.md)

**Before starting:** Claude must confirm Step 2 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Custom object `bcm_Tag__c`
- Fields:
    - `bcm_Colour__c` (Restricted Picklist — Required; 10 values, label = colour name, stored value = hex code)
    - Palette: Blue `#3A86FF`, Green `#2DC653`, Red `#E63946`, Purple `#7B2FBE`, Orange `#FB5607`, Teal `#0096C7`, Pink `#FF006E`, Amber `#FFBE0B`, Indigo `#4361EE`, Emerald `#06A77D`
- No validation rule — restricted picklist enforces allowed values at platform level
- Apex test class `bcm_TagValidationTest` covering:
    - `#3A86FF` (Blue) → saves; stored value verified
    - `#06A77D` (Emerald) → saves; stored value verified
    - Blank colour → `DmlException` (required field)
    - `red` (not in picklist) → `DmlException` (restricted picklist)
    - Viewer cannot insert (ObjectPermissions query)
    - Editor can insert valid Tag
- Permission set additions:
    - `bcm_Viewer`: add Read on `bcm_Tag__c`; Tags tab Default On
    - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_Tag__c`; Tags tab Default On
- Object Tab for `bcm_Tag__c` (Tags tab)
- `bcm_BusinessCapabilityMap` app updated to include the Tags tab
- LWC `bcm_ColourSwatch` — display-only component; renders a `lightning-card` tile with a full-width colour block and centred white colour-name label; field is configurable at design time via `colourField` property; placed on `bcm_Tag_Record_Page` above the detail tabs
- FlexiPage `bcm_Tag_Record_Page` — highlights panel + colour swatch + tabset (Detail + Related)

**Skills invoked:**

- `generating-custom-object` — for `bcm_Tag__c`
- `generating-custom-field` — for `bcm_Colour__c` (Picklist)
- `generating-custom-tab` — for the Tags tab
- `generating-permission-set` — updated `bcm_Viewer` and `bcm_Editor`
- `generating-custom-application` — updated `bcm_BusinessCapabilityMap`
- `generating-apex-test` — for `bcm_TagValidationTest`
- `generating-flexipage` — updated `bcm_Tag_Record_Page` to add `bcm_ColourSwatch`

**Manual inspection checklist:**

- [ ] `bcm_Tag__c` visible in Setup → Object Manager
- [ ] `bcm_Colour__c` is a picklist — opens a dropdown with 10 named colours
- [ ] `bcm_TagValidationTest` passes with all 6 test methods green
- [ ] Create a Tag, leave Colour blank → save blocked (required field error)
- [ ] Create a Tag, select "Blue" → saves; record shows a blue-filled `lightning-card` tile above the detail tabs with "Blue" in white centred text
- [ ] Swatch tile colour and label match the selected picklist value visually
- [ ] Tags tab visible in the BCM app for both Viewer and Editor
- [ ] `bcm_Viewer` grants Read on `bcm_Tag__c`
- [ ] `bcm_Editor` grants Read/Create/Edit/Delete on `bcm_Tag__c`
- [ ] `npx playwright test tests/e2e/tag.spec.ts` passes with zero failures

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-27

---

## Step 4 — `bcm_CapabilityTag__c`: Junction Object, Permission Set Additions

**Spec:** [capability-tag-object.md](../specs/capability-tag-object.md)

**Before starting:** Claude must confirm Step 3 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Custom object `bcm_CapabilityTag__c`
- Fields:
    - `bcm_Capability__c` (Master-Detail → `bcm_Capability__c`)
    - `bcm_Tag__c` (Master-Detail → `bcm_Tag__c`)
- Permission set additions:
    - `bcm_Viewer`: add Read on `bcm_CapabilityTag__c`
    - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_CapabilityTag__c`
- Apex test class `bcm_CapabilityTagTest` covering:
    - Editor can insert a junction record linking a Capability to a Tag
    - Deleting the parent Capability cascades and deletes the junction
    - Deleting the parent Tag cascades and deletes the junction
    - Viewer cannot create a junction record (ObjectPermissions assertion)
    - Editor can delete a junction record
- FlexiPage `bcm_Capability_Record_Page` — auto-generated by the org on deploy; retrieved and committed; includes Tags related list (`Tags__r`) in the sidebar. Manually assigned as default for `bcm_BusinessCapabilityMap` app.
- Note: Capabilities related list on `bcm_Tag_Record_Page` is intentionally deferred to Step 7 (not needed until diagram tag highlight feature).
- Playwright tests in `tests/e2e/capability-tag.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**

- `generating-custom-object` — for `bcm_CapabilityTag__c`
- `generating-custom-field` — for both Master-Detail fields
- `generating-permission-set` — update `bcm_Viewer` and `bcm_Editor`
- `generating-apex-test` — for `bcm_CapabilityTagTest`

**Manual inspection checklist:**

- [ ] `bcm_CapabilityTag__c` visible in Setup → Object Manager
- [ ] Both Master-Detail relationships present and pointing to correct objects
- [ ] Related list "Tags" appears on a `bcm_Capability__c` record detail page
- [ ] `bcm_Capability_Record_Page` assigned as default record page for `bcm_BusinessCapabilityMap` app
- [ ] Create a junction record linking a test Capability to a test Tag → saves successfully
- [ ] Delete the parent Capability → junction record is deleted (cascade)
- [ ] `bcm_CapabilityTagTest` passes with all 5 test methods green
- [ ] `bcm_Viewer` grants Read on `bcm_CapabilityTag__c`
- [ ] `bcm_Editor` grants Read/Create/Edit/Delete on `bcm_CapabilityTag__c`
- [ ] `npx playwright test tests/e2e/capability-tag.spec.ts` passes with zero failures

**Step complete:** `[x]`

---

## Step 5 — App Structure: Custom Permission, Visualisation Tab, Import on Record Page

**Spec:** [app-structure.md](../specs/app-structure.md)

**Before starting:** Claude must confirm Step 4 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Custom Permission `bcm_CanEdit` (hand-written XML — explicit exception to the no-hand-write rule)
- `bcm_Editor` permission set updated to grant `bcm_CanEdit`; Visualisation tab Visible
- `bcm_Viewer` permission set updated: Visualisation tab Visible
- LWC `bcm_VisualisationButton` — opens `bcm_VisualisationModal` from the Map record page header
- LWC `bcm_VisualisationModal` — stub modal (placeholder text; replaced by `bcm_CapabilityMap` in Step 7)
- LWC `bcm_ImportButton` — opens `bcm_ImportModal` from the Map record page header
- LWC `bcm_ImportModal` — stub modal (placeholder text; replaced by `bcm_ImportUtility` in Step 6)
- `bcm_MapRecordPage` updated: Visualisation and Import buttons in header (no separate tabs or app pages)
- Playwright tests in `tests/e2e/app-structure.spec.ts` covering all UI-visible scenarios from the spec

**Skills invoked:**

- Hand-write `bcm_CanEdit` Custom Permission XML (noted exception)
- `generating-permission-set` — update `bcm_Editor` and `bcm_Viewer`
- `generating-flexipage` — update `bcm_MapRecordPage` (two buttons in header)

**Manual inspection checklist:**

- [ ] `bcm_CanEdit` Custom Permission visible in Setup → Custom Permissions
- [ ] `bcm_Editor` permission set includes `bcm_CanEdit`
- [ ] Assign `bcm_Editor` — tabs visible: Maps, Capabilities, Tags (no Visualisation or Import tabs)
- [ ] Assign `bcm_Viewer` — same three tabs visible
- [ ] Open a Map record → Visualisation and Import buttons visible in record header
- [ ] Click Visualisation button → modal opens with placeholder text; close dismisses it
- [ ] Click Import button → modal opens with placeholder text; close dismisses it
- [ ] `npx playwright test tests/e2e/app-structure.spec.ts` passes with zero failures

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-30

---

## Step 6 — Import: `bcm_ImportController` Apex + `bcm_Import_Flow` Screen Flow

**Spec:** [import.md](../specs/import.md)

**Before starting:** Claude must confirm Step 5 checkbox is `[x]`. If not, stop and ask why.

**Design decisions:**

- **Tags are not imported.** `bcm_Colour__c` is a restricted required picklist with no grey value. Tags must be created manually via the Tags tab after import.
- Wrapper classes (`bcm_ImportPayload`, `bcm_CapabilityNode`, `bcm_ImportResult`) are inner classes inside `bcm_ImportController`, not separate files.
- `bcm_ImportResult` has no `tagsCreated` field (tags not imported).
- `bcm_CanEdit` custom permission is checked at the top of the controller; missing permission throws `AuraHandledException`.
- **`@AuraEnabled` is not used.** `bcm_ImportResult` fields use `@InvocableVariable`; `bcm_ImportController` exposes `@InvocableMethod execute(List<FlowInput>)` as the Flow entry point. No separate wrapper class is needed.
- `bcm_ImportButton` embeds the Flow via `<lightning-flow>` — the `bcm_ImportUtility` LWC is never created.

**What gets built:**

- Apex (use skills: `generating-apex` for controller, `generating-apex-test` for test class):
    - `bcm_ImportController` with `importCapabilities(String jsonPayload)`, `@InvocableMethod execute(List<FlowInput>)`, inner classes: `bcm_ImportPayload`, `bcm_CapabilityNode`, `bcm_ImportResult`, `FlowInput`
    - `bcm_ImportControllerTest` (unit test, minimum 75% coverage; includes invocable path tests)
- Screen Flow `bcm_Import_Flow` (use `generating-flow` skill): Screen 1 JSON input → Apex action → decision → Screen 2a success / Screen 2b error
- `bcm_ImportButton` updated to embed `<lightning-flow flow-api-name="bcm_Import_Flow">` (replaces placeholder text from Step 5)
- Playwright tests in `tests/e2e/import.spec.ts` covering all UI-visible scenarios from the spec

**Manual inspection checklist:**

- [ ] Deploy succeeds with no errors
- [ ] Apex test class passes with ≥75% coverage (all 8 methods green)
- [ ] Open a Map record → click Import button → panel shows Flow Screen 1 with JSON textarea
- [ ] Paste the sample JSON from `02-import.md` and click Import → Screen 2a shows "Successfully imported N capabilities."
- [ ] Click Close → action panel closes
- [ ] Navigate to Capabilities tab → imported capabilities visible with correct parent hierarchy
- [ ] Re-run import with same JSON → idempotent, no duplicates created
- [ ] Paste malformed JSON → Screen 2b shows error message → click Previous → returns to Screen 1
- [ ] As Viewer: click Import → Screen 2b shows "Access denied" (no generic unhandled Flow error)
- [ ] `npx playwright test tests/e2e/import.spec.ts` passes with zero failures

**Adjustments:** [step6-adjustments](2026-05-31-06:30-step6-adjustments.md) — move Import button to Map list view, relabel "JSON Import"

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-30

---

## Step 7 — Diagram: `bcm_CapabilityMap` LWC (read-only)

**Spec:** [diagram.md](../specs/diagram.md)

**Before starting:** Claude must confirm Step 6 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Apex controllers (use skills):
    - `bcm_MapController.getMaps()`
    - `bcm_CapabilityController.getCapabilities(Id mapId)`
    - `bcm_TagController.getTags()`
    - Test classes for all three
- LWC `bcm_CapabilityMap` — read-only slice:
    - Map selector combobox
    - Tag highlight combobox
    - SVG diagram rendering (L1 chevrons, L2 boxes, L3 bullets)
    - Zoom and pan
    - Tag colourisation
    - No drag-drop (handles hidden; drag-drop added in Step 8)
- `bcm_ContextMenu` LWC stub (placeholder, no actions — v1 per `05-lwc-architecture.md`)
- `bcm_VisualisationModal` updated to host `bcm_CapabilityMap` in its modal body (replaces placeholder text)
- Playwright tests in `tests/e2e/diagram.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**

- `generating-apex` — for `bcm_MapController`, `bcm_CapabilityController`, `bcm_TagController`
- `generating-apex-test` — for test classes for all three controllers
- `generating-apex` — for `bcm_MapController`, `bcm_CapabilityController`, `bcm_TagController`
- `generating-apex-test` — for test classes for all three controllers

**Manual inspection checklist:**

- [x] Deploy succeeds with no errors
- [x] All Apex test classes pass with ≥75% coverage
- [x] Open a Map record → click Visualisation button → modal shows map selector combobox
- [x] Select the imported map → diagram renders with correct L1/L2/L3 structure
- [x] All L1 chevrons visible with correct labels
- [x] L2 boxes stacked within correct columns
- [x] L3 bullets listed inside correct L2 boxes
- [x] Mouse wheel zoom works (in and out)
- [x] Click-drag on background pans the diagram
- [x] Select a tag in the Tag combobox → capabilities with that tag highlight in tag colour
- [x] Select "None" → highlights clear
- [x] Left-click a node → context menu appears with placeholder text
- [x] No drag handles visible (drag-drop not yet built)
- [x] `npx playwright test tests/e2e/diagram.spec.ts` passes with zero failures

**Adjustments shipped post-plan (closing 2026-06-05):**

- Detail Panel slide-in (GH #22, #23) — replaces context-menu placeholder; FP29 + FP30 in `99-cosmic-function-point-count.md`
- `bcm_IsCrossCutting__c` field + L1 validation (GH #29)
- Cross-cutting band — full-width layered chevron stack at canvas bottom (GH #30)
- Cross-cutting toolbar toggle, hidden-by-default, resets on map switch (GH #31)
- Context menu removed; first-click focus / second-click panel UX (GH #32)
- `bcm_HideFromDiagram__c` field + Show Hidden toggle + dashed-border render
- Keyboard navigation — Arrow keys (pan + node nav), Escape clears focus
- Fit-to-window + Reset view toolbar buttons; zoom/pan reset on map switch
- sessionStorage map-id persistence with stale-id fallback (GH #26)
- Free vertical pan — `panY ≤ 0` clamp removed (GH #35)
- Canvas focus outline suppressed (GH #34)
- Detail panel anchored to LWC root, not canvas container (GH #41)
- L3 bullet tag colourisation — tinted background rect when carrying selected tag (GH #46)

**Step complete:** `[x]` — deployed to `home-denispoc` 2026-05-30; final scope closed 2026-06-05

> See also:
>
> - [step7-diagram-lwc](2026-05-30-18:30-step7-diagram-lwc.md) — original step plan
> - [step7-adjustments](2026-05-31-06:19-step7-adjustments.md) — visualisation tab variant
> - [step7-visualiser-adjustments](2026-05-31-12:22-step7-visualiser-adjustments.md) — wrap/pin/hide/keyboard
> - [step7-status](2026-05-31-step7-status.md) — execution status, 21/21 e2e pass
> - [capability-detail-panel](2026-06-02-09:48-capability-detail-panel.md) — Detail Panel feature (GH #22/#23)
> - [issue-26 persist selected map](2026-06-03-09:33-issue-26-persist-selected-map.md)
> - [issue-29 isCrossCutting flag](2026-06-03-14:57-issue-29-iscrosscutting-flag.md)
> - [issue-30 cross-cutting band](2026-06-03-16:52-issue-30-cross-cutting-band.md)
> - [cc-band layered fullwidth](2026-06-03-17:30-cc-band-layered-fullwidth.md)
> - [issue-31 cc toggle](2026-06-03-19:41-issue-31-cc-toggle.md)
> - [issue-32 remove context menu](2026-06-03-20:16-issue-32-remove-context-menu.md)
> - [issue-34 suppress canvas focus outline](2026-06-03-12:49-issue-34-suppress-canvas-focus-outline.md)
> - [issue-35 remove svg viewport boundary](2026-06-03-13:52-issue-35-remove-svg-viewport-boundary.md)
> - [issue-41 detail panel clipping](2026-06-04-17:41-issue-41-detail-panel-clipping.md)
> - [l3 tag colourisation](2026-06-05-16:11-l3-tag-colourisation.md)
> - this closeout: [step7-closeout](2026-06-06-11:24-step7-closeout.md)

---

## Step 8 — Drag-Drop: `bcm_DragDropController` Apex + LWC Interactions

**Spec:** [drag-drop.md](../specs/drag-drop.md)

**Before starting:** Claude must confirm Step 7 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**

- Apex controller `bcm_DragDropController` (hand-written):
    - `reorderCapabilities(List<Id> orderedIds)`
    - `reparentCapability(Id capabilityId, Id newParentId, List<Id> newSiblingIds, List<Id> oldSiblingIds)`
    - `bcm_DragDropControllerTest` with ≥75% coverage
- `bcm_CapabilityMap` LWC updated to add:
    - Drag handles (visible to `bcm_CanEdit` users only)
    - Ghost element during drag
    - Drop indicator line
    - Optimistic local state update
    - Apex calls for reorder and reparent
    - Revert on Apex error with toast notification
- Playwright tests in `tests/e2e/drag-drop.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**

- `generating-apex` — for `bcm_DragDropController`
- `generating-apex-test` — for `bcm_DragDropControllerTest`

**Manual inspection checklist:**

- [ ] Deploy succeeds with no errors
- [ ] Apex test class passes with ≥75% coverage
- [ ] Assign `bcm_Editor` to yourself — drag handles visible on diagram nodes
- [ ] Drag an L2 box to a new position within the same column → diagram re-renders in new order; refresh page → order persists in org
- [ ] Drag an L2 box to a different L1 column → capability reparented; refresh → persists
- [ ] Drag an L1 chevron to a new column position → reorders correctly; refresh → persists
- [ ] Drag an L3 item within its L2 box → reorders; refresh → persists
- [ ] Drag an L3 item to a different L2 box → reparents; refresh → persists
- [ ] Assign `bcm_Viewer` to a test user — confirm drag handles not visible
- [ ] Simulate Apex failure (temporarily break controller) → toast error appears and diagram reverts
- [ ] `npx playwright test tests/e2e/drag-drop.spec.ts` passes with zero failures

**Step complete:** `[ ]`
