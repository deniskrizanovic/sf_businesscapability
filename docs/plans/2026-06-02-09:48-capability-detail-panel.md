# Plan: Capability Detail Panel

**Date:** 2026-06-02  
**Branch:** feature/capability-detail-panel

---

## Goal

Slide-out panel (400px overlay, CSS transition) triggered by "View detail" context menu action on any node (L1/L2/L3). Displays all capability fields, supports inline edit for `bcm_CanEdit` users, refreshes diagram on save.

---

## Decisions

| Decision | Choice |
|---|---|
| Layout | Overlay (not push) — SVG coordinates fixed |
| Levels that trigger panel | All (L1, L2, L3) |
| Panel width | 400px fixed |
| Data source | Fresh Apex call (`getCapabilityDetail`) |
| New Apex method location | Extend `bcm_CapabilityController` |
| Panel implementation | New `bcm_CapabilityDetail` LWC (presentational) |
| ID flow | `viewdetail` event (no payload); parent uses `contextMenuNode.id` |
| Close gestures | X button + Escape key |
| Panel-already-open behaviour | Update in place |
| Edit mode | Inline (Save/Cancel); gated by `bcm_CanEdit` |
| Editable fields | Name, Definition, Strategy Support, Architectural Nuance, Hide From Diagram |
| Rich text fields | `lightning-input-rich-text` for Definition, Strategy Support, Architectural Nuance (already `Html` type) |
| Save mechanism | Explicit Save/Cancel |
| Post-save | Trust saved values; re-call `loadCapabilities()` to refresh diagram |
| Apex save architecture | ADR 0002: Controller → Service (new) |
| Container/presentational | `bcm_CapabilityMap` owns all Apex; `bcm_CapabilityDetail` purely presentational |
| Breadcrumb | Built client-side from `_capabilities` tree; passed as `@api` prop |
| Animation | CSS `transform: translateX(100%)` → `translateX(0)`, ~250ms ease |
| E2e tests | New `tests/e2e/capability-detail.spec.ts` |

---

## New Functional Processes (COSMIC)

| FP | Functional Process | E | X | R | W | CFP | Implements |
|---|---|---|---|---|---|---|---|
| FP29 | View Capability Detail via Panel | 1 | 1 | 3 | 0 | 5 | `getCapabilityDetail` in `bcm_CapabilityController` |
| FP30 | Edit Capability via Panel — Save | 1 | 1 | 0 | 1 | 3 | `updateCapability` in `bcm_CapabilityController` + `bcm_CapabilityService` |

Full data movement breakdown in `docs/design/99-cosmic-function-point-count.md`.  
Running total: 111 → **119 CFP**.

---

## Architecture

```
bcm_CapabilityMap (container)
├── owns: detailCapabilityId, detailCapability, detailBreadcrumb, detailIsLoading
├── on viewdetail event → calls getCapabilityDetail(contextMenuNode.id) imperatively
├── on saved event → calls loadCapabilities() to refresh diagram
└── c-bcm_-capability-detail
    ├── @api capability       ← full record object
    ├── @api breadcrumb       ← [{label, id}] array, root-first
    ├── @api canEdit          ← boolean from hasPermission
    ├── @api isLoading        ← boolean while Apex call in flight
    ├── fires: close
    └── fires: saved (detail: { id, fields })
```

---

## Files to create

| File | Purpose |
|---|---|
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js` | Panel JS |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.html` | Panel template |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css` | Slide-in animation + layout |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js-meta.xml` | LWC metadata |
| `force-app/main/default/classes/bcm_CapabilityService.cls` | Business logic for updateCapability |
| `force-app/main/default/classes/bcm_CapabilityService.cls-meta.xml` | Apex metadata |
| `force-app/main/default/classes/bcm_CapabilityServiceTest.cls` | Unit tests for service |
| `force-app/main/default/classes/bcm_CapabilityServiceTest.cls-meta.xml` | Apex metadata |
| `tests/e2e/capability-detail.spec.ts` | Playwright e2e tests |

---

## Files to modify

| File | Change |
|---|---|
| `force-app/main/default/classes/bcm_CapabilityController.cls` | Add `getCapabilityDetail(Id capabilityId)` and `updateCapability(bcm_Capability__c capability)` methods |
| `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` | Tests for new controller methods |
| `force-app/main/default/lwc/bcm_ContextMenu/bcm_ContextMenu.html` | Add "View detail" menu item for L1 and L2 (already exists for L3) |
| `force-app/main/default/lwc/bcm_ContextMenu/bcm_ContextMenu.js` | `handleViewDetail()` fires `CustomEvent('viewdetail')` instead of no-op |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` | Add detail panel state, `handleViewDetail`, `handleDetailClose`, `handleDetailSaved`, `_buildBreadcrumb()` |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` | Slot in `<c-bcm_-capability-detail>` alongside context menu |

---

## Build sequence

### Step 1 — Design docs

Update before writing any code (already done as part of planning):

| File | Change |
|---|---|
| `docs/design/05-lwc-architecture.md` | Add `bcm_CapabilityDetail` component row; add `getCapabilityDetail`/`updateCapability` imports; add `detail*` tracked state; update template snippet; rewrite `bcm_ContextMenu` section; add new `bcm_CapabilityDetail` section; add methods to Apex controllers table |
| `docs/design/99-cosmic-function-point-count.md` | Add FP29 (View detail via panel, 5 CFP) and FP30 (Edit via panel save, 3 CFP); update summary table to 119 CFP; clarify section 6 context menu exclusion note |

---

### Step 2 — Apex: `getCapabilityDetail`

Add to `bcm_CapabilityController` (implements **FP29** — Entry: capabilityId; Reads: Capability, CapabilityTag, Tag; Exit: detail to UI):

```apex
@AuraEnabled
public static bcm_Capability__c getCapabilityDetail(Id capabilityId) {
    if (capabilityId == null) throw new AuraHandledException('capabilityId is required');
    try {
        return [
            SELECT Id, Name, bcm_Parent__c, bcm_Level__c,
                   bcm_Definition__c, bcm_StrategySupport__c,
                   bcm_ArchitecturalNuance__c, bcm_HideFromDiagram__c,
                   (SELECT bcm_Tag__c, bcm_Tag__r.Name, bcm_Tag__r.bcm_Colour__c FROM Tags__r)
            FROM bcm_Capability__c
            WHERE Id = :capabilityId
            WITH USER_MODE
            LIMIT 1
        ];
    } catch (Exception ex) {
        throw new AuraHandledException(ex.getMessage());
    }
}
```

Note: NOT `cacheable=true` — imperative mutation-adjacent call.

### Step 3 — Apex: `bcm_CapabilityService` + `updateCapability`

Add to `bcm_CapabilityController` + create `bcm_CapabilityService.cls` (implements **FP30** — Entry: updated fields; Write: UPDATE; Exit: confirmation to UI):

Create `bcm_CapabilityService.cls`:

```apex
public with sharing class bcm_CapabilityService {
    public static void updateCapability(bcm_Capability__c capability) {
        update as user capability;
    }
}
```

Add to `bcm_CapabilityController`:

```apex
@AuraEnabled
public static void updateCapability(bcm_Capability__c capability) {
    if (capability == null) throw new AuraHandledException('capability is required');
    try {
        bcm_CapabilityService.updateCapability(capability);
    } catch (Exception ex) {
        throw new AuraHandledException(ex.getMessage());
    }
}
```

### Step 4 — Context menu: all levels + fire event

`bcm_ContextMenu.html` — remove `if:true={isL3}` gate on "View detail"; show for all levels.

`bcm_ContextMenu.js` — replace stub:
```js
handleViewDetail() {
    this.dispatchEvent(new CustomEvent('viewdetail'));
    this._close();
}
```

### Step 5 — `bcm_CapabilityDetail` LWC

**JS (`bcm_CapabilityDetail.js`):**
- `@api capability` — full record (or null while loading)
- `@api breadcrumb` — `[{ id, label }]` array
- `@api canEdit` — boolean
- `@api isLoading` — boolean
- `@track editName`, `editDefinition`, `editStrategySupport`, `editArchitecturalNuance`, `editHideFromDiagram` — local edit state
- `@track isDirty`, `isSaving`, `errorMessage`
- `connectedCallback` / `capability` setter → reset edit state to current values
- `handleClose()` → fires `close` CustomEvent
- `handleSave()` → fires `saved` CustomEvent with `{ id, name, definition, strategySupport, architecturalNuance, hideFromDiagram }`
- `handleCancel()` → resets edit state from `capability`
- Escape keydown handler on panel root → fires `close`

**HTML (`bcm_CapabilityDetail.html`):**
```
<div class="bcm-detail-panel" class:bcm-detail-panel--open={isOpen}>
  <!-- header: breadcrumb + X button -->
  <!-- loading spinner (if isLoading) -->
  <!-- level badge (read-only) -->
  <!-- tags swatches (read-only) -->
  <!-- fields: view mode (if !canEdit) or edit mode (if canEdit) -->
  <!-- Save/Cancel buttons (canEdit only) -->
  <!-- error message (if errorMessage) -->
</div>
```

**CSS (`bcm_CapabilityDetail.css`):**
```css
.bcm-detail-panel {
    position: absolute;
    top: 0; right: 0;
    width: 400px; height: 100%;
    transform: translateX(100%);
    transition: transform 250ms ease;
    z-index: 100;
    background: #fff;
    box-shadow: -4px 0 16px rgba(0,0,0,0.12);
    overflow-y: auto;
}
.bcm-detail-panel--open {
    transform: translateX(0);
}
```

Container (`.bcm-canvas-container`) needs `position: relative` — verify in `bcm_CapabilityMap.css`.

### Step 6 — Wire into `bcm_CapabilityMap`

**New state:**
```js
detailCapabilityId = null;   // null = panel closed
detailCapability = null;
detailBreadcrumb = [];
detailIsLoading = false;
detailErrorMessage = null;
```

**New import:**
```js
import getCapabilityDetail from '@salesforce/apex/bcm_CapabilityController.getCapabilityDetail';
import updateCapability from '@salesforce/apex/bcm_CapabilityController.updateCapability';
```

**`handleViewDetail()`** (catches `viewdetail` from context menu):
```js
handleViewDetail() {
    const id = this.contextMenuNode?.id;
    if (!id) return;
    this.detailCapabilityId = id;
    this.detailIsLoading = true;
    this.detailCapability = null;
    getCapabilityDetail({ capabilityId: id })
        .then(record => {
            this.detailCapability = record;
            this.detailBreadcrumb = this._buildBreadcrumb(id);
        })
        .catch(err => { this.detailErrorMessage = err.body?.message; })
        .finally(() => { this.detailIsLoading = false; });
}
```

**`_buildBreadcrumb(id)`:**
- Walk `_capabilities` map by parent until root
- Return `[{ id, label: name }]` root-first

**`handleDetailClose()`** → `this.detailCapabilityId = null; this.detailCapability = null;`

**`handleDetailSaved(evt)`:**
```js
handleDetailSaved(evt) {
    const { id, ...fields } = evt.detail;
    this.detailIsLoading = true;
    updateCapability({ capability: { Id: id, ...fields } })
        .then(() => {
            this.detailCapability = { ...this.detailCapability, ...fields };
            return this._loadCapabilities();
        })
        .catch(err => { /* surface error to panel */ })
        .finally(() => { this.detailIsLoading = false; });
}
```

**`get detailIsOpen()`** → `return this.detailCapabilityId != null;`

**`get detailCanEdit()`** → `return hasPermission;`

**HTML addition** (alongside `<c-bcm_-context-menu>`):
```html
<c-bcm_-capability-detail
    capability={detailCapability}
    breadcrumb={detailBreadcrumb}
    can-edit={detailCanEdit}
    is-loading={detailIsLoading}
    onclose={handleDetailClose}
    onsaved={handleDetailSaved}>
</c-bcm_-capability-detail>
```

### Step 7 — Apex tests

`bcm_CapabilityControllerTest` additions:
- `getCapabilityDetail_returnsRecord` — valid ID returns record with all fields
- `getCapabilityDetail_nullId_throws` — null ID throws AuraHandledException
- `updateCapability_updatesName` — name change persisted
- `updateCapability_nullCapability_throws` — null throws

`bcm_CapabilityServiceTest`:
- `updateCapability_persists` — DML succeeds
- `updateCapability_respectsUserMode` — runs with sharing

### Step 8 — E2e tests (`tests/e2e/capability-detail.spec.ts`)

Scenarios (from spec):
- `"View detail opens panel with capability name in header"`
- `"Close button dismisses the detail panel"`
- `"Escape key closes the detail panel"`
- `"Switching nodes updates panel content without closing"`
- `"Panel breadcrumb reflects full ancestor path"`
- `"Panel shows correct level badge"`
- `"Editor sees Save and Cancel buttons in detail panel"`
- `"Viewer sees no Save button in detail panel"`
- `"Saving a name change reflects in the diagram"`
- `"Cancel reverts unsaved edits"`

---

## E2e spec file changes

- **New:** `tests/e2e/capability-detail.spec.ts`
- **Modified:** `tests/e2e/diagram.spec.ts` — no structural changes needed; "View detail" scenario already updated in `docs/specs/diagram.md` to reference `capability-detail.spec.ts`
- **Helpers:** `tests/e2e/helpers/` — add `openDetailPanel(page, nodeLabel)` helper if diagram.spec helpers exist; check for existing pattern first

---

## Acceptance checklist

- [ ] "View detail" in context menu visible for L1, L2, and L3 nodes
- [ ] Panel slides in from right on click; slides out on close
- [ ] Breadcrumb correct for L1 (1 segment), L2 (2 segments), L3 (3 segments)
- [ ] Level badge shows 1, 2, or 3
- [ ] All fields displayed: Name, Level, Tags, Definition, Strategy Support, Architectural Nuance, Hide From Diagram
- [ ] Viewer: all fields read-only, no Save/Cancel
- [ ] Editor: all editable fields editable, Save/Cancel visible
- [ ] Save persists to Salesforce, diagram refreshes
- [ ] Cancel reverts to last-saved values
- [ ] Switching nodes updates panel in place
- [ ] X button closes panel
- [ ] Escape key closes panel
- [ ] Apex tests pass (90%+ coverage)
- [ ] E2e tests pass in Playwright
