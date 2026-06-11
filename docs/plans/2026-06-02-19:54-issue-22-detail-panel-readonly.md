# Plan: Read-only Capability Detail Panel (Issue #22 — FP29)

**Date:** 2026-06-02
**Branch:** feature/sf_businesscapability-22
**Tracks:** GH issue #22 — Read-only Capability Detail Panel (FP29)
**Supersedes (for read-only slice):** `docs/plans/2026-06-02-09:48-capability-detail-panel.md` — that plan covers FP29 + FP30; this plan ships only FP29. FP30 (edit) is deferred to GH issue #3.

---

## Goal

Vertical end-to-end slice: "View detail" context-menu action on any L1/L2/L3 node opens a 400px slide-out panel that shows the full capability record read-only. Apex query, LWC, container wiring, Apex tests, Jest tests, Playwright e2e tests.

**Out of scope (#3):**
- Save / Cancel buttons
- Inline edit fields
- `bcm_CapabilityService` class
- `updateCapability` Apex method
- Post-save diagram refresh
- `canEdit` prop on `bcm_CapabilityDetail`

---

## Decisions

| Decision | Choice |
|---|---|
| Layout | Overlay (fixed 400px, right edge, full canvas height) |
| Levels that trigger panel | L1, L2, L3 |
| Data source | Fresh Apex call (`getCapabilityDetail`), not cacheable, USER_MODE |
| Apex method location | Add to existing `bcm_CapabilityController` |
| LWC | New `bcm_CapabilityDetail` (presentational; no Apex imports) |
| ID flow | `viewdetail` event payload `{id, level, name}` already fired by `bcm_ContextMenu`; container reads `evt.detail.id` |
| Close gestures | X button + Escape key |
| Panel-already-open behaviour | Update in place (same handler reassigns state) |
| Edit affordances | None in this slice (FP30 deferred to #3) |
| Breadcrumb | Built client-side from `_capabilities` parent chain in container |
| Animation | CSS `transform: translateX(100%)` → `translateX(0)`, 250ms ease |
| Rich text display | `lightning-formatted-rich-text` (read-only render of HTML fields) |
| Hide From Diagram display | Plain "Yes" / "No" text |
| Existing `handleViewDetail` (NavigationMixin) | Replaced — panel supersedes record-page navigation |
| Spec scenario "View detail navigates to record page" | Removed from `docs/specs/diagram.md` (was a stop-gap) |
| Edit-mode spec scenarios | Marked `> Deferred: edit affordances out of scope for #22; FP30 in #3` |

---

## Function Points (COSMIC)

| FP | Process | CFP | Status this slice |
|---|---|---|---|
| FP29 | View Capability Detail via Panel | 5 | **Delivered in #22 (2026-06-02)** |
| FP30 | Edit Capability via Panel — Save | 3 | Deferred (#3) |

`docs/economics/function-point-count.md` already enumerates FP29 + FP30 + FP31 with running total **122 CFP** — no arithmetic change in this slice.

---

## Architecture

```
bcm_CapabilityMap (container)
├── owns: detailCapabilityId, detailCapability, detailBreadcrumb,
│         detailIsLoading, detailErrorMessage
├── on viewdetail (from c-bcm_-context-menu)
│     → set state, call getCapabilityDetail(id) imperatively,
│       compute breadcrumb from _capabilities tree
└── c-bcm_-capability-detail (presentational, no Apex)
    ├── @api capability   ← record or null
    ├── @api breadcrumb   ← [{id, label}] root-first
    ├── @api isLoading    ← boolean
    └── fires: close       (X click or Escape key)
```

---

## Files to create

| File | Purpose |
|---|---|
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js` | Panel JS (props + close + Escape handler) |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.html` | Panel template |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css` | Slide-in animation + layout |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js-meta.xml` | LWC metadata (`isExposed` false; matches existing LWCs) |
| `force-app/main/default/lwc/bcm_CapabilityDetail/__tests__/bcm_CapabilityDetail.test.js` | Jest unit tests for the new LWC |
| `tests/e2e/capability-detail.spec.ts` | Playwright e2e tests for FP29 |

## Files to modify

| File | Change |
|---|---|
| `force-app/main/default/classes/bcm_CapabilityController.cls` | Add `getCapabilityDetail(Id capabilityId)` (USER_MODE, not cacheable) |
| `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` | Add `getCapabilityDetail_returnsRecord` and `getCapabilityDetail_nullId_throws` |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` | Replace `handleViewDetail` (NavigationMixin → state + Apex); add detail state, `_buildBreadcrumb`, `handleDetailClose`; import `getCapabilityDetail`; remove `NavigationMixin` import if unused elsewhere |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` | Add `<c-bcm_-capability-detail>` alongside context menu |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` | Verify canvas container has `position: relative` (add if missing — required for overlay panel positioning) |
| `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` | Drop "View detail click calls NavigationMixin.Navigate with record page"; add "View detail loads capability and opens panel" |
| `docs/specs/diagram.md` | Remove "View detail navigates to the Capability record page" scenario; mark edit scenarios as Deferred (#3) |
| `docs/design/05-lwc-architecture.md` | Add `bcm_CapabilityDetail` row; add `getCapabilityDetail` import + `detail*` state in container; rewrite `bcm_ContextMenu` "View detail" target from NavigationMixin to panel |

No change required in `docs/economics/function-point-count.md` (FP29/FP30/FP31 already enumerated; total 122 unchanged).

---

## Build sequence

### Step 1 — Apex: `getCapabilityDetail`

Add to `bcm_CapabilityController`. Implements **FP29** (Entry: capabilityId; Reads: Capability, CapabilityTag, Tag; Exit: detail to UI).

```apex
@AuraEnabled
public static bcm_Capability__c getCapabilityDetail(Id capabilityId) {
    if (capabilityId == null) {
        throw new AuraHandledException('capabilityId is required');
    }
    try {
        return [
            SELECT Id, Name, bcm_Parent__c, bcm_Level__c,
                   bcm_Definition__c, bcm_StrategySupport__c,
                   bcm_ArchitecturalNuance__c, bcm_HideFromDiagram__c,
                   (SELECT bcm_Tag__c, bcm_Tag__r.Name, bcm_Tag__r.bcm_Colour__c
                      FROM Tags__r)
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

**Apex tests** (`bcm_CapabilityControllerTest`):

- `getCapabilityDetail_returnsRecord` — seed Map + L1 + L2 + L3 capabilities with definition / strategy / nuance values; assert returned record contains all fields.
- `getCapabilityDetail_nullId_throws` — call with `null`; assert `AuraHandledException` thrown.

> Tag-junction sub-query path verified at controller level only — full Tags__r subquery path is part of the SOQL signature; e2e/Jest do not cover tag swatches in this slice (already deferred in spec).

### Step 2 — LWC: `bcm_CapabilityDetail`

**JS (`bcm_CapabilityDetail.js`):**

```js
import { LightningElement, api } from 'lwc';

export default class BcmCapabilityDetail extends LightningElement {
    @api capability = null;
    @api breadcrumb = [];
    @api isLoading = false;

    get isOpen() {
        return this.isLoading || this.capability != null;
    }

    get level() {
        return this.capability?.bcm_Level__c;
    }

    get hideFromDiagramText() {
        return this.capability?.bcm_HideFromDiagram__c ? 'Yes' : 'No';
    }

    get tags() {
        const junctions = this.capability?.Tags__r || [];
        return junctions.map(j => ({
            id: j.bcm_Tag__c,
            name: j.bcm_Tag__r?.Name,
            colour: j.bcm_Tag__r?.bcm_Colour__c,
            style: `background-color:${j.bcm_Tag__r?.bcm_Colour__c || '#ccc'};`,
        }));
    }

    connectedCallback() {
        this._handleDocKeyDown = this._onDocumentKeyDown.bind(this);
        document.addEventListener('keydown', this._handleDocKeyDown);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._handleDocKeyDown);
    }

    _onDocumentKeyDown(evt) {
        if (evt.key === 'Escape' && this.isOpen) {
            this.handleClose();
        }
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
```

**HTML (`bcm_CapabilityDetail.html`):** breadcrumb, level badge, tag swatches, field list (Name / Definition / Strategy / Nuance / Hide), spinner while loading, X close button. Definition / Strategy / Nuance render via `lightning-formatted-rich-text`.

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
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
    overflow-y: auto;
}
.bcm-detail-panel[data-open="true"] {
    transform: translateX(0);
}
```

**Meta XML:** `isExposed=false` matching `bcm_ContextMenu`.

### Step 3 — Wire into `bcm_CapabilityMap`

Replace existing `handleViewDetail` (currently calls `NavigationMixin.Navigate`):

```js
import getCapabilityDetail from '@salesforce/apex/bcm_CapabilityController.getCapabilityDetail';
// ... existing tracked state ...

detailCapabilityId   = null;
detailCapability     = null;
detailBreadcrumb     = [];
detailIsLoading      = false;
detailErrorMessage   = null;

handleViewDetail(evt) {
    const id = evt?.detail?.id;
    this.contextMenuVisible = false;
    if (!id) return;
    this.detailCapabilityId = id;
    this.detailIsLoading    = true;
    this.detailCapability   = null;
    this.detailBreadcrumb   = this._buildBreadcrumb(id);
    this.detailErrorMessage = null;
    getCapabilityDetail({ capabilityId: id })
        .then(rec => { this.detailCapability = rec; })
        .catch(err => {
            this.detailErrorMessage =
                err?.body?.message || 'Failed to load capability detail';
        })
        .finally(() => { this.detailIsLoading = false; });
}

handleDetailClose() {
    this.detailCapabilityId = null;
    this.detailCapability   = null;
    this.detailBreadcrumb   = [];
    this.detailIsLoading    = false;
    this.detailErrorMessage = null;
}

_buildBreadcrumb(id) {
    const byId = new Map();
    (this._capabilities || []).forEach(c => byId.set(c.Id, c));
    const chain = [];
    let cur = byId.get(id);
    while (cur) {
        chain.unshift({ id: cur.Id, label: cur.Name });
        cur = cur.bcm_Parent__c ? byId.get(cur.bcm_Parent__c) : null;
    }
    return chain;
}
```

Drop `NavigationMixin` import + class wrap if no other handler uses it (verify by grep before removing).

**Template addition (sibling of `<c-bcm_-context-menu>`):**

```html
<c-bcm_-capability-detail
    capability={detailCapability}
    breadcrumb={detailBreadcrumb}
    is-loading={detailIsLoading}
    onclose={handleDetailClose}>
</c-bcm_-capability-detail>
```

**Container CSS guard:** ensure the canvas container that the panel positions against has `position: relative`. Add to `bcm_CapabilityMap.css` if not already present.

### Step 4 — Jest tests

**`bcm_CapabilityDetail/__tests__/bcm_CapabilityDetail.test.js` (new):**

- Renders header breadcrumb segments from `breadcrumb` prop.
- Renders level badge `L{capability.bcm_Level__c}`.
- Renders Name + Definition + Strategy + Nuance + Hide fields.
- `isLoading=true` → spinner visible, fields not rendered.
- `capability=null` and `isLoading=false` → panel content empty (no fields).
- Click X → fires `close` event.
- Document Escape keydown while open → fires `close`.
- No Save / Cancel buttons rendered (regression guard for #22 scope).

**`bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` (modify):**

- Drop `"View detail click calls NavigationMixin.Navigate with record page"`.
- Add `"View detail loads capability via Apex and opens panel"` — seed `_capabilities` (so `_buildBreadcrumb` has data to walk), mock `getCapabilityDetail` to resolve, dispatch `viewdetail` event, assert `<c-bcm_-capability-detail>` rendered with `capability` and `breadcrumb` props populated.

### Step 5 — Playwright e2e (`tests/e2e/capability-detail.spec.ts`)

Scenarios (mirroring `docs/specs/diagram.md` §"Detail Panel — open and close" + "Detail Panel — field display"):

- `"View detail opens panel with capability name in header"`
- `"Close button dismisses the detail panel"`
- `"Escape key closes the detail panel"`
- `"Switching nodes updates panel content without closing"`
- `"Panel breadcrumb reflects full ancestor path"` (L3 case)
- `"Panel breadcrumb shows one segment for L1"`
- `"Panel breadcrumb shows two segments for L2"`
- `"Panel shows correct level badge"`
- `"Panel displays all expected fields"` (Name, Definition, Strategy Support, Architectural Nuance, Hide From Diagram)
- `"Viewer sees no Save button in detail panel"` (regression guard — locator counts Save buttons inside the panel and expects zero)

**Helpers:** add `openDetailPanel(page, nodeLabel)` to `tests/e2e/helpers/` if a similar helper module exists; otherwise inline the open sequence and refactor only when a second spec needs it.

### Step 6 — Spec + design doc updates

**`docs/specs/diagram.md`:**

- Remove scenario "View detail navigates to the Capability record page" (the NavigationMixin path is replaced by the panel).
- Keep existing "View detail opens the Detail Panel" scenario (already points to `capability-detail.spec.ts`).
- Update the open/close + field-display scenarios' `> Tested by:` lines to the actual Playwright titles produced in Step 5.
- For each "Detail Panel — inline edit" scenario, replace `> Tested by: …` with `> Deferred: edit affordances out of scope for #22; FP30 in #3`.

**`docs/design/05-lwc-architecture.md`:**

- Add `bcm_CapabilityDetail` component row.
- Add `getCapabilityDetail` Apex import + `detail*` state in container section.
- Rewrite `bcm_ContextMenu` "View detail" target — was `NavigationMixin`; now `viewdetail` event handled by container, opens panel.

**`docs/economics/function-point-count.md`:** no change — FP29 already in summary table; total 122 unchanged.

### Step 7 — Acceptance pass + deploy

- `sf project deploy start --source-dir force-app/main/default/classes/bcm_CapabilityController.cls --source-dir force-app/main/default/classes/bcm_CapabilityControllerTest.cls --source-dir force-app/main/default/lwc/bcm_CapabilityDetail --source-dir force-app/main/default/lwc/bcm_CapabilityMap`
- Run Apex tests: `sf apex run test -n bcm_CapabilityControllerTest -w 5`
- Run Jest: `npm run test:unit -- bcm_CapabilityDetail bcm_CapabilityMap`
- Run Playwright: `npx playwright test tests/e2e/capability-detail.spec.ts`
- Walk acceptance checklist in this plan + on issue #22.

---

## E2e test plan (per project rule)

- **New:** `tests/e2e/capability-detail.spec.ts` (10 scenarios listed in Step 5).
- **Modified:** `tests/e2e/diagram.spec.ts` — none structurally; existing "View detail" scenario already points to `capability-detail.spec.ts`. If the current `diagram.spec.ts` asserts a record-page navigation, that assertion is removed.
- **Helpers:** add `openDetailPanel(page, nodeLabel)` if `tests/e2e/helpers/` already follows that pattern; otherwise keep inline.
- **Navigation/interaction pattern:** right-click L1/L2/L3 chevron/box/bullet → context menu → click "View detail" → assert `[data-open="true"]` on `.bcm-detail-panel` within 500ms (250ms animation + slack).

---

## Acceptance checklist (matches issue #22)

- [x] "View detail" context-menu item visible on L1, L2, and L3 nodes
- [x] Click opens panel; slides in from right ~250ms
- [x] Header shows breadcrumb (root-first ancestor path) + close (X) button
- [x] Level badge shows 1, 2, or 3
- [x] Tag swatches render (read-only) — render code present in `bcm_CapabilityDetail`; e2e seeded coverage deferred per spec
- [x] All fields displayed read-only: Name, Definition, Strategy Support, Architectural Nuance, Hide From Diagram
- [x] Loading spinner while Apex call in flight
- [x] X button closes panel
- [x] Escape key closes panel
- [x] Selecting another node updates panel content in place (no close + reopen)
- [x] No Save / Cancel buttons rendered for any user (FP30 deferred to #3)
- [x] Apex unit tests for `getCapabilityDetail` pass (valid id; null id throws)
- [x] Playwright e2e covers: open, close-X, close-Escape, switch nodes, breadcrumb (L1/L2/L3), level badge, fields, viewer-no-save
- [x] `docs/specs/diagram.md` coverage markers conform to project rules (Tested-by or Deferred only)
- [x] FP29 row in `docs/economics/function-point-count.md` annotated **delivered in #22** (or completion-date column added when merged)
