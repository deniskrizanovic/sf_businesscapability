# Plan: Inline edit + save in Capability Detail Panel (Issue #23 — FP30)

**Date:** 2026-06-03
**Branch:** sf_businesscapability-23
**Tracks:** GH issue #23 — Inline edit + save in Capability Detail panel (FP30)
**Builds on:** `docs/plans/2026-06-02-19:54-issue-22-detail-panel-readonly.md` (FP29 — read-only panel)

---

## Goal

Vertical end-to-end slice: editor with `bcm_CanEdit` toggles edit mode in the existing Capability Detail panel and saves Name + Definition + Strategy Support + Architectural Nuance via Apex; container reloads diagram so renamed nodes appear updated. Cancel reverts unsaved changes. Hide From Diagram excluded (already covered by `hideCapability`).

**In scope (#23):**
- New `bcm_CapabilityService` class (per ADR 0002 layered Apex architecture)
- `bcm_CapabilityController.updateCapability` — thin pass-through to service
- `bcm_CapabilityDetail` LWC — edit state, Save / Cancel, rich-text inputs
- `bcm_CapabilityMap` — `handleDetailSaved` calls `updateCapability` then reloads
- Apex tests + Jest tests + Playwright e2e

**Out of scope:**
- Hide From Diagram editing in panel (separate flow already lives in `hideCapability`)
- Tag editing in panel (separate FP not yet on the roadmap)
- Optimistic concurrency / lock detection

---

## Decisions

| Decision | Choice |
|---|---|
| Edit affordance | Edit button in panel header (only when `canEdit`) toggles edit mode |
| Save / Cancel placement | Footer of panel, only visible while in edit mode |
| Field set | Name (`lightning-input`), Definition / Strategy / Nuance (`lightning-input-rich-text`) |
| Apex layer | New `bcm_CapabilityService.updateCapability` — `update as user`; controller delegates only |
| Service exception strategy | Service throws `IllegalArgumentException` for null; lets DML errors surface; controller wraps every throwable as `AuraHandledException` |
| Field whitelist | Service builds a fresh `bcm_Capability__c` from input — only Id + four whitelisted fields are written; prevents mass assignment of fields outside scope |
| Panel error region | Existing `errorMessage` slot reused; `_detailRequestSeq` already guards stale responses |
| Diagram refresh | After save resolves, container calls `_loadCapabilities()` (existing fn) — refetches all caps, rebuilds layout |
| Panel post-save state | Stays open; switches back to read mode; shows latest record (re-fetched in container response) |
| Cancel revert source | Snapshot of original `capability` prop captured on edit-mode entry; replay-only client side, no Apex |
| Viewer (no `bcm_CanEdit`) | No Edit button; no Save / Cancel; no rich-text inputs ever rendered |
| `canEdit` propagation | Container reads `@salesforce/customPermission/bcm_CanEdit` (already imported) and passes `can-edit` to `c-bcm_-capability-detail` |

---

## Function Points (COSMIC)

| FP | Process | CFP | Status this slice |
|---|---|---|---|
| FP30 | Edit Capability via Panel — Save | 3 | **Delivered in #23 (2026-06-03)** |

`docs/design/99-cosmic-function-point-count.md` already enumerates FP30 with running total **122 CFP** — no arithmetic change. Update delivery status note.

---

## Architecture

```
bcm_CapabilityMap (container)
├── owns: detailCapability* state (existing)
├── canEdit (existing)
├── on saved (from c-bcm_-capability-detail)
│     → updateCapability(record) imperative
│     → on resolve: _loadCapabilities()  (refresh diagram)
│     → on reject:  push errorMessage back into panel
└── c-bcm_-capability-detail (presentational)
    ├── @api capability   (existing)
    ├── @api breadcrumb   (existing)
    ├── @api isLoading    (existing)
    ├── @api errorMessage (existing)
    ├── @api canEdit       ← NEW
    ├── internal: editMode, draft, _snapshot
    └── fires: close (existing) | saved ← NEW
```

```
bcm_CapabilityController (LWC boundary)
└── updateCapability(bcm_Capability__c cap)
        → bcm_CapabilityService.updateCapability(cap)   (NEW)
            → update as user (Id + 4 whitelisted fields)
```

---

## Files to create

| File | Purpose |
|---|---|
| `force-app/main/default/classes/bcm_CapabilityService.cls` | Service layer (per ADR 0002) — `updateCapability(bcm_Capability__c)` |
| `force-app/main/default/classes/bcm_CapabilityService.cls-meta.xml` | API version metadata |
| `force-app/main/default/classes/bcm_CapabilityServiceTest.cls` | Service unit tests |
| `force-app/main/default/classes/bcm_CapabilityServiceTest.cls-meta.xml` | API version metadata |

## Files to modify

| File | Change |
|---|---|
| `force-app/main/default/classes/bcm_CapabilityController.cls` | Add `updateCapability(bcm_Capability__c)` — delegates to service, wraps as `AuraHandledException` |
| `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` | Add `updateCapability_persists` + `updateCapability_nullCapability_throws` |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js` | Add `canEdit` prop, edit-mode state, save/cancel handlers, draft tracking, `saved` event |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.html` | Edit button (header), Save/Cancel (footer), field inputs in edit mode |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css` | Footer button row + label/input alignment |
| `force-app/main/default/lwc/bcm_CapabilityDetail/__tests__/bcm_CapabilityDetail.test.js` | Add edit-mode tests (button visibility, save event payload, cancel revert) |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` | `handleDetailSaved` — call `updateCapability` then `_loadCapabilities`; pass `canEdit` to detail panel |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` | Bind `can-edit={canEdit}` and `onsaved={handleDetailSaved}` to `c-bcm_-capability-detail` |
| `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` | Add `saved` event test — Apex called, layout rebuilt with new name |
| `tests/e2e/capability-detail.spec.ts` | Add editor-only edit/save scenario, viewer-no-save, cancel revert |
| `docs/specs/diagram.md` | Replace `> Deferred: edit affordances out of scope for #22; FP30 in #3` markers with `> Tested by:` lines for delivered scenarios; update viewer-no-save to point at e2e |
| `docs/design/99-cosmic-function-point-count.md` | Update delivery-status footer line: FP30 delivered in #23 (2026-06-03) |
| `docs/design/05-lwc-architecture.md` | Add `updateCapability` controller import + `canEdit` prop on `bcm_CapabilityDetail` + `saved` event flow in container |

---

## Build sequence

### Step 1 — Apex: `bcm_CapabilityService` + `updateCapability`

```apex
public with sharing class bcm_CapabilityService {

    /**
     * Persists Name, Definition, Strategy Support, Architectural Nuance.
     * Uses `update as user` (USER_MODE) so FLS/CRUD enforced.
     * Rejects null input early; lets DML exceptions surface to caller.
     *
     * @param cap  Capability with Id and at least one editable field set.
     */
    public static void updateCapability(bcm_Capability__c cap) {
        if (cap == null || cap.Id == null) {
            throw new IllegalArgumentException('Capability with Id is required');
        }
        // Whitelist: only persist fields in edit panel scope. Prevents
        // unintended writes if caller passes a record with extra populated fields.
        bcm_Capability__c toUpdate = new bcm_Capability__c(
            Id                          = cap.Id,
            Name                        = cap.Name,
            bcm_Definition__c           = cap.bcm_Definition__c,
            bcm_StrategySupport__c      = cap.bcm_StrategySupport__c,
            bcm_ArchitecturalNuance__c  = cap.bcm_ArchitecturalNuance__c
        );
        update as user toUpdate;
    }
}
```

Controller addition (`bcm_CapabilityController`):

```apex
@AuraEnabled
public static void updateCapability(bcm_Capability__c capability) {
    try {
        bcm_CapabilityService.updateCapability(capability);
    } catch (Exception ex) {
        throw new AuraHandledException(ex.getMessage());
    }
}
```

**Apex tests:**

`bcm_CapabilityServiceTest`:
- `updateCapability_persists_whitelistedFields` — seed Capability, call service with Name + Definition + Strategy + Nuance, assert all four updated
- `updateCapability_ignoresFieldsOutsideWhitelist` — pass record with `bcm_HideFromDiagram__c=true`; assert original value unchanged
- `updateCapability_nullCapability_throws_IllegalArgument`
- `updateCapability_nullId_throws_IllegalArgument`

`bcm_CapabilityControllerTest` additions:
- `updateCapability_persists` — happy path; record reflects new Name
- `updateCapability_nullCapability_throws` — `AuraHandledException`

### Step 2 — LWC `bcm_CapabilityDetail` edit mode

JS additions:

```js
@api canEdit = false;

@track editMode  = false;
@track draftName;
@track draftDefinition;
@track draftStrategy;
@track draftNuance;
_snapshot = null;

get canShowEditButton() {
    return this.canEdit && this.hasContent && !this.editMode;
}

get canShowSaveCancel() {
    return this.editMode;
}

handleEdit() {
    if (!this.canEdit || !this.capability) return;
    this._snapshot = {
        name      : this.capability.Name,
        definition: this.capability.bcm_Definition__c,
        strategy  : this.capability.bcm_StrategySupport__c,
        nuance    : this.capability.bcm_ArchitecturalNuance__c,
    };
    this.draftName       = this._snapshot.name;
    this.draftDefinition = this._snapshot.definition;
    this.draftStrategy   = this._snapshot.strategy;
    this.draftNuance     = this._snapshot.nuance;
    this.editMode        = true;
}

handleNameChange(evt)        { this.draftName       = evt.target.value; }
handleDefinitionChange(evt)  { this.draftDefinition = evt.target.value; }
handleStrategyChange(evt)    { this.draftStrategy   = evt.target.value; }
handleNuanceChange(evt)      { this.draftNuance     = evt.target.value; }

handleCancel() {
    this.editMode = false;
    this._snapshot = null;
}

handleSave() {
    if (!this.canEdit || !this.capability) return;
    this.dispatchEvent(new CustomEvent('saved', {
        detail: {
            id                : this.capability.Id,
            name              : this.draftName,
            definition        : this.draftDefinition,
            strategySupport   : this.draftStrategy,
            architecturalNuance: this.draftNuance,
        },
    }));
    this.editMode  = false;
    this._snapshot = null;
}
```

Template additions:
- Header: `lightning-button-icon` Edit (utility:edit) when `canShowEditButton`
- Body in edit mode: `lightning-input` for Name, three `lightning-input-rich-text` for Definition / Strategy / Nuance
- Footer: `lightning-button` Save (variant=brand) + Cancel — only when `canShowSaveCancel`

Read mode unchanged.

### Step 3 — `bcm_CapabilityMap` wiring

Pass `can-edit={canEdit}` and bind `onsaved={handleDetailSaved}` in the template.

```js
handleDetailSaved(evt) {
    const payload = evt.detail || {};
    const capability = {
        Id                         : payload.id,
        Name                       : payload.name,
        bcm_Definition__c          : payload.definition,
        bcm_StrategySupport__c     : payload.strategySupport,
        bcm_ArchitecturalNuance__c : payload.architecturalNuance,
    };
    this.detailErrorMessage = null;
    updateCapability({ capability })
        .then(() => {
            // Refresh diagram so renamed node visible without manual reload
            this._loadCapabilities();
            // Re-fetch panel record so saved values reflected in read-mode display
            return getCapabilityDetail({ capabilityId: payload.id });
        })
        .then(rec => {
            if (rec) this.detailCapability = rec;
        })
        .catch(err => {
            this.detailErrorMessage =
                err?.body?.message || 'Failed to save capability';
        });
}
```

Add `import updateCapability from '@salesforce/apex/bcm_CapabilityController.updateCapability';` at the top.

### Step 4 — Jest tests

`bcm_CapabilityDetail.test.js` additions:
- `canEdit=false` -> no Edit button rendered
- `canEdit=true` -> Edit button rendered when capability set
- Click Edit -> rich-text inputs visible, Save+Cancel visible, Edit hidden
- Type into Name + click Save -> `saved` event fired with `{id,name,definition,strategySupport,architecturalNuance}`
- Click Cancel -> reverts to read mode; no `saved` event
- Save handler does not fire when `canEdit=false` (safety regression)

`bcm_CapabilityMap.test.js` additions:
- saved event triggers `updateCapability` mock with built payload
- After save resolves, `getCapabilities` mock is called again (diagram refresh)

### Step 5 — Playwright e2e

Add to `tests/e2e/capability-detail.spec.ts`:

- Editor: open detail on L2 -> click Edit -> change Name -> Save -> panel shows new name -> diagram chevron / box label reflects new name (requires waiting for re-render)
- Editor: open detail -> Edit -> change Name -> Cancel -> panel reverts; diagram unchanged
- Viewer (separate `test.describe` using `viewer.json` storage state if pattern exists, otherwise covered by Jest only) -> no Edit button visible

If viewer storage state path is not yet wired, leave viewer-no-save coverage to Jest (already exists from #22) and document in spec coverage marker.

### Step 6 — Spec + design + FP doc updates

`docs/specs/diagram.md` — replace deferred markers under "Detail Panel — inline edit (Editors only)":

| Scenario | New marker |
|---|---|
| Editor sees editable fields | `> Tested by: capability-detail.spec.ts — "Editor sees Edit button and can enter edit mode"` |
| Viewer sees read-only fields | `> Tested by: bcm_CapabilityDetail.test.js — "No Save / Cancel buttons rendered (read-only scope)", "Viewer (canEdit=false) sees no Edit button"` |
| Save persists field changes | `> Tested by: capability-detail.spec.ts — "Save persists name change and refreshes diagram"; bcm_CapabilityServiceTest.updateCapability_persists_whitelistedFields; bcm_CapabilityControllerTest.updateCapability_persists` |
| Cancel discards unsaved changes | `> Tested by: capability-detail.spec.ts — "Cancel reverts unsaved name change"; bcm_CapabilityDetail.test.js — "Cancel reverts to read mode without firing saved"` |
| Save error shows inline message | `> Deferred: requires seeded validation rule; covered by code review (errorMessage prop wired in container catch handler)` |

`docs/design/99-cosmic-function-point-count.md` — update footer line:
> **Delivery status:** FP29 delivered in GH issue #22 (2026-06-02). FP30 delivered in GH issue #23 (2026-06-03).

`docs/design/05-lwc-architecture.md` — append `updateCapability` to controller import list; add `canEdit` prop + `saved` event to `bcm_CapabilityDetail` row.

### Step 7 — Deploy + verify

```sh
sf project deploy start \
  --source-dir force-app/main/default/classes/bcm_CapabilityService.cls \
  --source-dir force-app/main/default/classes/bcm_CapabilityServiceTest.cls \
  --source-dir force-app/main/default/classes/bcm_CapabilityController.cls \
  --source-dir force-app/main/default/classes/bcm_CapabilityControllerTest.cls \
  --source-dir force-app/main/default/lwc/bcm_CapabilityDetail \
  --source-dir force-app/main/default/lwc/bcm_CapabilityMap

sf apex run test -n bcm_CapabilityServiceTest,bcm_CapabilityControllerTest -w 5
npm run test:unit -- bcm_CapabilityDetail bcm_CapabilityMap
npx playwright test tests/e2e/capability-detail.spec.ts
```

Walk acceptance checklist below + on issue #23.

---

## E2e test plan (per project rule)

- **Spec file changed:** `tests/e2e/capability-detail.spec.ts` — add `Detail panel — edit + save — editor project` describe block with three new scenarios listed above.
- **Helpers changed:** `openDetailPanelOnL2` already exists; reuse. Add small inline helper for "fill rich text input" only if `lightning-input-rich-text` selector pattern proves brittle — otherwise targeting via `panel.locator('lightning-input').getByLabel('Name')` is sufficient for Name, and rich-text changes are covered at the Jest layer.
- **Navigation/interaction pattern:** open panel -> `[data-open="true"]` -> click `.bcm-detail-edit` -> fill `lightning-input[data-field="name"]` -> click Save button (label "Save") -> assert panel name + diagram chevron text both reflect new value.

---

## Acceptance checklist (matches issue #23)

- [ ] Editor (`bcm_CanEdit` true) sees Save and Cancel buttons in panel (in edit mode)
- [ ] Viewer sees no Save/Cancel buttons (and no Edit button)
- [ ] Editable fields: Name, Definition (rich text), Strategy Support (rich text), Architectural Nuance (rich text)
- [ ] Hide From Diagram remains read-only in this panel (existing flow)
- [ ] Save persists changes via Apex, panel reflects saved values, diagram refreshes
- [ ] Cancel reverts edited fields to last-saved values without Apex call
- [ ] Apex error surfaces in panel error region
- [ ] `bcm_CapabilityService` created with `updateCapability` using `update as user`
- [ ] `bcm_CapabilityController.updateCapability` delegates to service (no DML in controller)
- [ ] Apex tests: controller (valid + null) + service (DML succeeds; whitelist; nulls)
- [ ] Playwright e2e covers: editor save + diagram refresh, Cancel reverts; Jest covers viewer-no-edit
- [ ] Spec coverage markers in `docs/specs/diagram.md` updated per project rules
- [ ] FP30 row in `docs/design/99-cosmic-function-point-count.md` annotated **delivered in #23 (2026-06-03)**
