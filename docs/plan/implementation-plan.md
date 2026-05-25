# Business Capability Map — Implementation Plan

## How to use this plan

- Each step has a BDD spec file in `docs/plan/specs/` listing formal acceptance criteria. Review the spec before starting the step.
- Each step is a deployable slice you can manually inspect in the org (`home-denispoc` sandbox) before progressing.
- **Do not start a step until the previous step's checkbox is ticked.**
- Before starting any step, Claude must check that the prior step checkbox is `[x]`. If it is still `[ ]`, Claude must stop and ask why before proceeding.
- Every step that creates Salesforce metadata must use the appropriate skill from the table in `CLAUDE.md`. Claude must confirm which skill it is invoking before generating any file.
- Every Apex test class must test permission boundaries using `System.runAs()` — at minimum one test user with `bcm_Viewer` assigned and one with `bcm_Editor` assigned. DML operations that should fail for Viewers must assert a `DmlException` is thrown. DML operations that should succeed for Editors must assert the record is saved.
- Page layouts use org-generated defaults. No custom layout XML is created.
- The Custom Permission (`bcm_CanEdit`) is the single explicit exception — it is hand-written XML.

---

## Progress Tracker

| Step | Description | Status |
|---|---|---|
| 1 | `bcm_Map__c` — object, fields, permission sets, Maps tab, app with Maps tab | `[ ]` |
| 2 | `bcm_Capability__c` — object, fields, validation rules, permission additions, Capabilities tab added to app | `[ ]` |
| 3 | `bcm_Tag__c` — object, fields, validation rule, permission additions, Tags tab added to app | `[ ]` |
| 4 | `bcm_CapabilityTag__c` — junction object, permission additions | `[ ]` |
| 5 | App structure — Custom Permission, Import + Map FlexiPage stubs, Import tab added to app | `[ ]` |
| 6 | Import — `bcm_ImportController` Apex + `bcm_ImportUtility` LWC | `[ ]` |
| 7 | Diagram — `bcm_CapabilityMap` LWC (read-only: layout, render, zoom/pan, tag highlight) | `[ ]` |
| 8 | Drag-drop — `bcm_DragDropController` Apex + drag-drop interactions in LWC | `[ ]` |

---

## Step 1 — `bcm_Map__c`: Object, Fields, Permission Sets, Maps Tab, App

**Spec:** [step-01-map-object.md](../specs/step-01-map-object.md)

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

**Step complete:** `[ ]`

---

## Step 2 — `bcm_Capability__c`: Object, Fields, Validation Rules, Permission Additions, Capabilities Tab

**Spec:** [step-02-capability-object.md](../specs/step-02-capability-object.md)

**Before starting:** Claude must confirm Step 1 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Custom object `bcm_Capability__c`
- Fields:
  - `bcm_Map__c` (Lookup → `bcm_Map__c`, Required, deleteConstraint: Restrict)
  - `bcm_Parent__c` (Lookup → `bcm_Capability__c`, Optional, deleteConstraint: SetNull)
  - `bcm_Level__c` (Number 1,0 — Required)
  - `bcm_SortOrder__c` (Number 6,0 — Required)
  - `bcm_ExternalId__c` (Text 255 — Unique, External ID)
  - `bcm_Definition__c` (Rich Text Area 32768)
  - `bcm_StrategySupport__c` (Rich Text Area 32768)
  - `bcm_ArchitecturalNuance__c` (Rich Text Area 32768)
- Validation rules:
  - Level must be 1, 2, or 3
  - If Parent is null, Level must be 1
  - If Parent is set, Level must be 2 or 3
- Apex test class `bcm_CapabilityValidationTest` covering:
  - Level 0 → `DmlException` thrown
  - Level 4 → `DmlException` thrown
  - Level 1, no parent → saves successfully
  - Level 2, no parent → `DmlException` thrown
  - Level 3, no parent → `DmlException` thrown
  - Level 1, parent set → `DmlException` thrown
  - Level 2, parent set → saves successfully
  - Level 3, parent set → saves successfully
- Permission set additions:
  - `bcm_Viewer`: add Read on `bcm_Capability__c`; Capabilities tab Default On
  - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_Capability__c`; Capabilities tab Default On
- Object Tab for `bcm_Capability__c` (Capabilities tab)
- `bcm_BusinessCapabilityMap` app updated to include the Capabilities tab

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-custom-object` — for `bcm_Capability__c`
- `generating-custom-field` — for each field (invoke per field or in batch as skill allows)
- `generating-validation-rule` — for each validation rule
- `generating-custom-tab` — for the Capabilities tab
- `generating-permission-set` — update `bcm_Viewer` and `bcm_Editor`
- `generating-custom-application` — update `bcm_BusinessCapabilityMap` to include Capabilities tab
- No skill for Apex — hand-written; state this explicitly before writing

**Manual inspection checklist:**
- [ ] `bcm_Capability__c` visible in Setup → Object Manager
- [ ] All 8 custom fields present
- [ ] `bcm_ExternalId__c` marked as External ID in field detail
- [ ] `bcm_Parent__c` is a self-referencing lookup (not Master-Detail)
- [ ] All 3 validation rules active on the object
- [ ] `bcm_CapabilityValidationTest` passes with all 8 test methods green
- [ ] Create a test Capability record with no Parent and Level = 2 → validation fires in UI
- [ ] Create a test Capability record with a Parent and Level = 1 → validation fires in UI
- [ ] Capabilities tab visible in the BCM app
- [ ] `bcm_Viewer` now grants Read on `bcm_Capability__c`
- [ ] `bcm_Editor` now grants Read/Create/Edit/Delete on `bcm_Capability__c`

**Step complete:** `[ ]`

---

## Step 3 — `bcm_Tag__c`: Object, Fields, Validation Rule, Permission Additions, Tags Tab

**Spec:** [step-03-tag-object.md](../specs/step-03-tag-object.md)

**Before starting:** Claude must confirm Step 2 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Custom object `bcm_Tag__c`
- Fields:
  - `bcm_Colour__c` (Text 7 — Required)
- Validation rule:
  - `bcm_Colour__c` must match `#[0-9A-Fa-f]{6}`
- Apex test class `bcm_TagValidationTest` covering:
  - Empty string → `DmlException` thrown
  - `red` (no hash, not hex) → `DmlException` thrown
  - `#GGGGGG` (invalid hex chars) → `DmlException` thrown
  - `#3A86FF` (valid, uppercase) → saves successfully
  - `#3a86ff` (valid, lowercase) → saves successfully
  - `#3A86` (too short) → `DmlException` thrown
  - `#3A86FFAA` (too long) → `DmlException` thrown
- Permission set additions:
  - `bcm_Viewer`: add Read on `bcm_Tag__c`; Tags tab Default On
  - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_Tag__c`; Tags tab Default On
- Object Tab for `bcm_Tag__c` (Tags tab)
- `bcm_BusinessCapabilityMap` app updated to include the Tags tab

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-custom-object` — for `bcm_Tag__c`
- `generating-custom-field` — for `bcm_Colour__c`
- `generating-validation-rule` — for colour format rule
- `generating-custom-tab` — for the Tags tab
- `generating-permission-set` — update `bcm_Viewer` and `bcm_Editor`
- `generating-custom-application` — update `bcm_BusinessCapabilityMap` to include Tags tab
- No skill for Apex — hand-written; state this explicitly before writing

**Manual inspection checklist:**
- [ ] `bcm_Tag__c` visible in Setup → Object Manager
- [ ] `bcm_Colour__c` field present
- [ ] `bcm_TagValidationTest` passes with all 7 test methods green
- [ ] Colour validation rule active — create a Tag with colour `red` → validation fires in UI
- [ ] Create a Tag with colour `#3A86FF` → saves successfully
- [ ] Tags tab visible in the BCM app
- [ ] `bcm_Viewer` grants Read on `bcm_Tag__c`
- [ ] `bcm_Editor` grants Read/Create/Edit/Delete on `bcm_Tag__c`

**Step complete:** `[ ]`

---

## Step 4 — `bcm_CapabilityTag__c`: Junction Object, Permission Set Additions

**Spec:** [step-04-capabilitytag-object.md](../specs/step-04-capabilitytag-object.md)

**Before starting:** Claude must confirm Step 3 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Custom object `bcm_CapabilityTag__c`
- Fields:
  - `bcm_Capability__c` (Master-Detail → `bcm_Capability__c`)
  - `bcm_Tag__c` (Master-Detail → `bcm_Tag__c`)
- Permission set additions:
  - `bcm_Viewer`: add Read on `bcm_CapabilityTag__c`
  - `bcm_Editor`: add Read, Create, Edit, Delete on `bcm_CapabilityTag__c`

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-custom-object` — for `bcm_CapabilityTag__c`
- `generating-custom-field` — for both Master-Detail fields
- `generating-permission-set` — update `bcm_Viewer` and `bcm_Editor`

**Manual inspection checklist:**
- [ ] `bcm_CapabilityTag__c` visible in Setup → Object Manager
- [ ] Both Master-Detail relationships present and pointing to correct objects
- [ ] Related list "Tags" appears on a `bcm_Capability__c` record detail page
- [ ] Related list "Capabilities" appears on a `bcm_Tag__c` record detail page
- [ ] Create a junction record linking a test Capability to a test Tag → saves successfully
- [ ] Delete the parent Capability → junction record is deleted (cascade)
- [ ] `bcm_Viewer` grants Read on `bcm_CapabilityTag__c`
- [ ] `bcm_Editor` grants Read/Create/Edit/Delete on `bcm_CapabilityTag__c`

**Step complete:** `[ ]`

---

## Step 5 — App Structure: Custom Permission, Import Tab, FlexiPage Stubs

**Spec:** [step-05-app-structure.md](../specs/step-05-app-structure.md)

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

**Step complete:** `[ ]`

---

## Step 6 — Import: `bcm_ImportController` Apex + `bcm_ImportUtility` LWC

**Spec:** [step-06-import.md](../specs/step-06-import.md)

**Before starting:** Claude must confirm Step 5 checkbox is `[x]`. If not, stop and ask why.

**What gets built:**
- Apex classes (no skill exists — hand-written Apex is permitted):
  - `bcm_ImportController` with `importCapabilities(String jsonPayload)` per `02-import.md`
  - `bcm_ImportPayload`, `bcm_CapabilityNode`, `bcm_ImportResult` wrapper classes
  - `bcm_ImportControllerTest` (unit test, minimum 75% coverage)
- LWC `bcm_ImportUtility` per `05-lwc-architecture.md`
- `bcm_ImportPage` FlexiPage updated to host `bcm_ImportUtility` (replaces placeholder)

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-flexipage` — update `bcm_ImportPage` to add `bcm_ImportUtility` component
- No skill for Apex — hand-written; state this explicitly before writing

**Manual inspection checklist:**
- [ ] Deploy succeeds with no errors
- [ ] Apex test class passes with ≥75% coverage
- [ ] Navigate to Import tab in BCM app — `bcm_ImportUtility` component visible
- [ ] Paste the sample JSON from `02-import.md` and click Import → success message with counts
- [ ] Navigate to Capabilities tab → imported capabilities visible
- [ ] Navigate to Tags tab → imported tags visible (e.g. "NEW" tag present)
- [ ] Re-run import with same JSON → idempotent, no duplicates created
- [ ] Paste malformed JSON → error message displayed (no unhandled exception)

**Step complete:** `[ ]`

---

## Step 7 — Diagram: `bcm_CapabilityMap` LWC (read-only)

**Spec:** [step-07-diagram.md](../specs/step-07-diagram.md)

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

**Skills to invoke (Claude must confirm before generating any file):**
- `generating-flexipage` — update `bcm_MapPage` to add `bcm_CapabilityMap` component
- No skill for Apex or LWC JS — hand-written; state this explicitly before writing

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

**Step complete:** `[ ]`

---

## Step 8 — Drag-Drop: `bcm_DragDropController` Apex + LWC Interactions

**Spec:** [step-08-drag-drop.md](../specs/step-08-drag-drop.md)

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

**Skills to invoke (Claude must confirm before generating any file):**
- No skill for Apex or LWC JS — hand-written; state this explicitly before writing

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

**Step complete:** `[ ]`
