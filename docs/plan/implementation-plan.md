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

| Step | Description | FPs Unlocked | CFP | Cumul. | % Done | Status | Completed |
|---|---|---|---|---|---|---|---|
| 1 | `bcm_Map__c` — object, fields, permission sets, Maps tab, app | FP7–12 (Map CRUD) | 18 | 18 | 16% | `[x]` | 2026-05-25 |
| 2 | `bcm_Capability__c` — object, fields, trigger, validation rules, Capabilities tab, Map record page | FP13, FP15–19 (Capability list + CRUD) | 21 | 39 | 35% | `[x]` | 2026-05-26 |
| 3 | `bcm_Tag__c` — object, fields, validation rule, Tags tab | FP22–28 (Tag CRUD + detail) | 23 | 62 | 56% | `[ ]` | — |
| 4 | `bcm_CapabilityTag__c` — junction object, permission additions | FP14, FP20–21 (Capability detail w/tags, tag junctions) | 15 | 77 | 69% | `[ ]` | — |
| 5 | App structure — Custom Permission, FlexiPage stubs, Import tab | — | 0 | 77 | 69% | `[ ]` | — |
| 6 | Import — `bcm_ImportController` Apex + `bcm_ImportUtility` LWC | FP4 (Import JSON) | 11 | 88 | 79% | `[ ]` | — |
| 7 | Diagram — `bcm_CapabilityMap` LWC (read-only) | FP1–3 (Map / Capability / Tag diagram load) | 11 | 99 | 89% | `[ ]` | — |
| 8 | Drag-drop — `bcm_DragDropController` Apex + LWC interactions | FP5–6 (Reorder + Reparent) | 12 | 111 | 100% | `[ ]` | — |

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
- [ ] Maps tab hidden when assigned `bcm_Viewer`
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

**Step complete:** `[ ]`

---

## Step 5 — App Structure: Custom Permission, Import Tab, FlexiPage Stubs

**Spec:** [app-structure.md](../specs/app-structure.md)

**Before starting:** Claude must confirm Step 4 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Custom Permission `bcm_CanEdit` (hand-written XML — explicit exception to the no-hand-write rule)
- `bcm_Editor` permission set updated to grant `bcm_CanEdit`; Import tab Default On; Maps tab Default On
- `bcm_Viewer` permission set updated: Import tab Hidden; Maps tab Hidden
- Object Tab for `bcm_Map__c` is already deployed (Step 1) — just ensure tab visibility in permission sets is correct here
- Import Object Tab added to `bcm_BusinessCapabilityMap` app
- Lightning App Pages (stubs — placeholder text component):
  - `bcm_MapPage` (full-width, single region — replaced by LWC in Step 7)
  - `bcm_ImportPage` (full-width, single region — replaced by LWC in Step 6)
- Map tab added to the app pointing to `bcm_MapPage`
- Playwright tests in `tests/e2e/app-structure.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**
- Hand-write `bcm_CanEdit` Custom Permission XML (noted exception)
- `generating-permission-set` — update `bcm_Editor` with Custom Permission + tab visibility
- `generating-permission-set` — update `bcm_Viewer` with tab visibility
- `generating-custom-application` — update `bcm_BusinessCapabilityMap` to include Map and Import tabs
- `generating-flexipage` — for `bcm_MapPage` stub
- `generating-flexipage` — for `bcm_ImportPage` stub

**Manual inspection checklist:**
- [ ] `bcm_CanEdit` Custom Permission visible in Setup → Custom Permissions
- [ ] `bcm_Editor` permission set includes `bcm_CanEdit`
- [ ] Assign `bcm_Editor` — all tabs visible: Map, Capabilities, Tags, Import, Maps
- [ ] Assign `bcm_Viewer` — Import and Maps tabs are hidden; Map, Capabilities, Tags visible
- [ ] Map tab in app navigates to `bcm_MapPage` (shows placeholder)
- [ ] Import tab navigates to `bcm_ImportPage` (shows placeholder)
- [ ] `npx playwright test tests/e2e/app-structure.spec.ts` passes with zero failures

**Step complete:** `[ ]`

---

## Step 6 — Import: `bcm_ImportController` Apex + `bcm_ImportUtility` LWC

**Spec:** [import.md](../specs/import.md)

**Before starting:** Claude must confirm Step 5 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Apex classes (no skill exists — hand-written Apex is permitted):
  - `bcm_ImportController` with `importCapabilities(String jsonPayload)` per `02-import.md`
  - `bcm_ImportPayload`, `bcm_CapabilityNode`, `bcm_ImportResult` wrapper classes
  - `bcm_ImportControllerTest` (unit test, minimum 75% coverage)
- LWC `bcm_ImportUtility` per `05-lwc-architecture.md`
- `bcm_ImportPage` FlexiPage updated to host `bcm_ImportUtility` (replaces placeholder)
- Playwright tests in `tests/e2e/import.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-flexipage` — update `bcm_ImportPage` to add `bcm_ImportUtility` component
- `generating-apex` — for `bcm_ImportController`, `bcm_ImportPayload`, `bcm_CapabilityNode`, `bcm_ImportResult`
- `generating-apex-test` — for `bcm_ImportControllerTest`

**Manual inspection checklist:**
- [ ] Deploy succeeds with no errors
- [ ] Apex test class passes with ≥75% coverage
- [ ] Navigate to Import tab in BCM app — `bcm_ImportUtility` component visible
- [ ] Paste the sample JSON from `02-import.md` and click Import → success message with counts
- [ ] Navigate to Capabilities tab → imported capabilities visible
- [ ] Navigate to Tags tab → imported tags visible (e.g. "NEW" tag present)
- [ ] Re-run import with same JSON → idempotent, no duplicates created
- [ ] Paste malformed JSON → error message displayed (no unhandled exception)
- [ ] `npx playwright test tests/e2e/import.spec.ts` passes with zero failures

**Step complete:** `[ ]`

---

## Step 7 — Diagram: `bcm_CapabilityMap` LWC (read-only)

**Spec:** [diagram.md](../specs/diagram.md)

**Before starting:** Claude must confirm Step 6 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Apex controllers (hand-written):
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
- `bcm_MapPage` FlexiPage updated to host `bcm_CapabilityMap` (replaces placeholder)
- Playwright tests in `tests/e2e/diagram.spec.ts` covering all UI-visible scenarios from the spec

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-flexipage` — update `bcm_MapPage` to add `bcm_CapabilityMap` component
- `generating-apex` — for `bcm_MapController`, `bcm_CapabilityController`, `bcm_TagController`
- `generating-apex-test` — for test classes for all three controllers

**Manual inspection checklist:**
- [ ] Deploy succeeds with no errors
- [ ] All Apex test classes pass with ≥75% coverage
- [ ] Navigate to Map tab → map selector combobox visible
- [ ] Select the imported map → diagram renders with correct L1/L2/L3 structure
- [ ] All L1 chevrons visible with correct labels
- [ ] L2 boxes stacked within correct columns
- [ ] L3 bullets listed inside correct L2 boxes
- [ ] Mouse wheel zoom works (in and out)
- [ ] Click-drag on background pans the diagram
- [ ] Select a tag in the Tag combobox → capabilities with that tag highlight in tag colour
- [ ] Select "None" → highlights clear
- [ ] Left-click a node → context menu appears with placeholder text
- [ ] No drag handles visible (drag-drop not yet built)
- [ ] `npx playwright test tests/e2e/diagram.spec.ts` passes with zero failures

**Step complete:** `[ ]`

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
