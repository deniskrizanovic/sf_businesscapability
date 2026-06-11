# Issue #32 — Replace 2nd-click context menu with Detail Panel slide-in

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

The `bcm_ContextMenu` LWC currently sits between focus and any node-level action (View detail, Hide). With FP29 (Detail Panel) and FP30 (Detail Panel edit mode) shipped, the only menu actions are "View detail" — which the panel already does — and "Hide", which the panel's edit mode also does (via `bcm_HideFromDiagram__c` toggle, Editor-only).

Therefore the menu is now a redundant click. Issue #32 strips it: 2nd click on an already-focused node opens the Detail Panel directly. 1st click still focuses (existing rule). Hide stays in panel edit mode.

End-to-end:

- Click node A → focused
- Click node A again → Detail Panel opens, capability A loaded
- Click node B (already focused) once → panel updates in place to capability B (panel-open code path already handles this)

Out of scope:

- Visual changes to the panel
- Changes to keyboard nav (Esc, arrows, focus-clear) — they keep their current semantics
- Hide UX (already in panel edit mode)

---

## Architecture

**Delete:** `force-app/main/default/lwc/bcm_ContextMenu/` bundle (html/js/css/meta + `__tests__`).

**Rewire `bcm_CapabilityMap.js` `handleNodeClick`** (file `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js:621`):

Current 2nd-click branches all open the menu by setting `contextMenuVisible/X/Y/Node`. New behaviour: 2nd click on the same node calls `this.handleViewDetail({ detail: { id: nodeId } })` directly. The existing panel-open branch (line 634) already does this when `detailCapability || detailIsLoading` — it just becomes the _only_ path.

State to remove from `bcm_CapabilityMap.js`:

- `@track contextMenuVisible`, `contextMenuX`, `contextMenuY`, `contextMenuNode`
- `handleContextMenuClose`
- All `this.contextMenuVisible = …` assignments scattered across `handleMapChange`, `handleSvgMouseDown`, `_navigateFromKey`, `handleHide`, `handleViewDetail`, `handleBandClick`, `handleNodeClick`

Removed from template (`bcm_CapabilityMap.html:217-227`): the `<template if:true={contextMenuVisible}>` block hosting `<c-bcm_-context-menu>`.

`handleHide` stays (the panel edit-mode save path calls it indirectly via `handleDetailSaved` → `updateCapability` with `bcm_HideFromDiagram__c=true`); but the `bcm_ContextMenu`-emitted `onhide` event no longer fires, so the `handleHide(evt)` method becomes dead code. Delete it. The `hideCapability` Apex import is also unused now (panel saves via `updateCapability`, never `hideCapability`). Delete the import.

**`handleViewDetail` simplification:** the line `this.contextMenuVisible = false;` becomes a no-op once the field is gone. Drop it. Same for `handleBandClick`.

**`handleSvgMouseDown` simplification:** drop the `this.contextMenuVisible = false;` line. Canvas focus-clear stays.

**`handleMapChange` simplification:** drop `this.contextMenuVisible = false;` line.

**Why no separate "is focused" recheck path:** the existing `if (this.detailCapability || this.detailIsLoading)` branch at line 634 handles "panel already open → switch capability". For "panel not open + 2nd click", we need the same payload but without the panel-open precondition. Easiest unified path: collapse the two branches — _whenever_ a node is clicked and is already focused, call `handleViewDetail`. Simpler than tracking a separate "second click" flag.

**Resolved L3 path:** the L3 branch at line 649 currently anchors a menu. Replace with: focus first; if already focused, call `handleViewDetail({ detail: { id: targetId } })`. Reuses the same payload contract.

**Resolved L1/L2 path:** the L1/L2 branch at line 668 currently anchors a menu. Replace with: focus first; if already focused, call `handleViewDetail({ detail: { id: nodeId } })`.

**Fallback path** (line 681 — geometry not in layout): same simplification. The panel works without geometry — the only thing that needed geometry was the menu anchor.

---

## File Structure

- **Delete** `force-app/main/default/lwc/bcm_ContextMenu/` (entire bundle including `__tests__`)
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — remove menu state, simplify `handleNodeClick`, drop `handleHide` + `hideCapability` import + `handleContextMenuClose`
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — remove `<c-bcm_-context-menu>` block
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — replace menu assertions with panel-open assertions
- **Modify** `tests/e2e/capability-detail.spec.ts` — drop the menu helper step from `openDetailPanelOnL1/L2/L3` (just two clicks on the node, expect panel)
- **Modify** `tests/e2e/diagram.spec.ts` — drop the "Hide menu action" test; drop the "Viewer cannot see Hide button in context menu" test (Hide is panel-edit-mode-only, gated elsewhere); fix the unhide-cleanup `afterEach` accordingly
- **Modify** `docs/specs/diagram.md` — remove "Feature: Context menu actions" section + "Feature: Context menu appears on node click" section; replace second-click scenarios under "Feature: Node click UX — focus then menu" with "Second click opens Detail Panel" wording
- **Modify** `docs/economics/function-point-count.md` — update FP31 row (Hide via context menu → no longer applies; Hide is now part of FP30 panel save)

---

## Task 1: Strip context menu from `bcm_CapabilityMap`

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- [x] **Step 1: Remove menu state declarations**

    In `bcm_CapabilityMap.js`, delete lines:

    ```js
    @track contextMenuVisible    = false;
    @track contextMenuX          = 0;
    @track contextMenuY          = 0;
    @track contextMenuNode       = null;
    ```

- [x] **Step 2: Drop `hideCapability` import + `handleHide` method**

    Delete the Apex import:

    ```js
    import hideCapability from '@salesforce/apex/bcm_CapabilityController.hideCapability';
    ```

    Delete the entire `handleHide(evt) { … }` method.

- [x] **Step 3: Delete `handleContextMenuClose`**

    Remove the method entirely.

- [x] **Step 4: Strip `contextMenuVisible = false` lines**

    In `handleMapChange`, `handleSvgMouseDown`, `handleViewDetail`, `handleBandClick`, `_navigateFromKey`. Each `this.contextMenuVisible = false;` line: delete. Surrounding logic stays.

- [x] **Step 5: Rewrite `handleNodeClick`**

    Replace the body (keeping the dataset extraction at the top) so that:

    ```js
    handleNodeClick(evt) {
        evt.stopPropagation();
        const targetLevel = evt.target.dataset?.nodeLevel;
        const targetId    = evt.target.dataset?.nodeId;
        const targetName  = evt.target.dataset?.nodeName;

        const nodeId    = evt.currentTarget.dataset.nodeId;
        const nodeLevel = targetLevel || evt.currentTarget.dataset.nodeLevel;
        if (!nodeId) return;

        // Resolve clicked id (L3 may sit inside a group)
        const l3Group = evt.target.closest && evt.target.closest('[data-l3-group]');
        const resolvedId = (nodeLevel === '3' && targetId)
            ? targetId
            : (l3Group ? l3Group.dataset.l3Group : nodeId);

        // Panel open -> single click on any node refreshes panel directly (existing behaviour)
        if (this.detailCapability || this.detailIsLoading) {
            this.focusedNodeId = resolvedId;
            this._keyNavMode   = true;
            this._buildLayout(this._capabilities);
            this.handleViewDetail({ detail: { id: resolvedId } });
            return;
        }

        // Panel closed: 1st click focuses, 2nd click on already-focused opens panel
        const alreadyFocused = this.focusedNodeId === resolvedId;
        this.focusedNodeId = resolvedId;
        this._keyNavMode   = true;
        this._buildLayout(this._capabilities);
        if (!alreadyFocused) return;
        this.handleViewDetail({ detail: { id: resolvedId } });
    }
    ```

    This replaces three branches (panel-open / L3 menu / L1-L2 menu / fallback) with two: panel-open (refresh) vs panel-closed (focus then open). All menu-anchor geometry (svgRightX, svgMidY, points-parsing) is gone.

- [x] **Step 6: Remove menu element from template**

    In `bcm_CapabilityMap.html`, delete the block:

    ```html
    <!-- Context menu overlay -->
    <template if:true="{contextMenuVisible}">
        <c-bcm_-context-menu …> </c-bcm_-context-menu>
    </template>
    ```

    Adjacent comment line `<!-- Context menu overlay -->` deletes too. Detail panel block below stays untouched.

---

## Task 2: Delete `bcm_ContextMenu` bundle

**Files:**

- Delete: `force-app/main/default/lwc/bcm_ContextMenu/` (entire directory)

- [x] **Step 1: Remove the bundle**

    ```bash
    rm -rf force-app/main/default/lwc/bcm_ContextMenu
    ```

    Verify no orphans: `grep -rn 'bcm_ContextMenu\|bcm_-context-menu' force-app/ tests/`.

---

## Task 3: Update Jest tests

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Replace menu-presence assertions with panel-presence assertions**

    All `element.shadowRoot.querySelector('c-bcm_-context-menu')` → `element.shadowRoot.querySelector('c-bcm_-capability-detail')`. The detail panel is always mounted (open state controlled by `data-open` attribute / `capability` prop). Adjust assertions: instead of `expect(menu).not.toBeNull()`, assert the panel's `capability` prop matches the clicked node's id.

    For the `mockGetCapabilityDetailImpl` calls — many tests need a stubbed detail record. Add a default jest mock at the top of `describe('node click UX — focus then menu')` that returns a minimal record matching the clicked id.

    Specifically:
    - `First click L1/L2/L3 node focuses it but does not open …` → assert `panel.capability` is null (detailCapability stays null after just one click).
    - `Second click on same L1/L2/L3 node opens …` → rename to `Second click on same L1/L2/L3 node opens detail panel`. Assert `mockGetCapabilityDetailImpl` was called with the right id; assert `panel.capability` set.
    - `Clicking a different node after first focus does not open …` → assert `panel.capability` is null after switching focus; the request was never made.

- [x] **Step 2: Drop `BcmCapabilityMap context menu — Hide capability` describe**

    Hide is no longer a direct action in this component. The `hideCapability` Apex is unused. Delete the entire describe block.

- [x] **Step 3: Update `BcmCapabilityMap context menu actions` describe**

    Rename to `BcmCapabilityMap second-click → detail panel`. Replace the helper:

    ```js
    async function clickTwice(nodeId) {
        const node = getNode(element, nodeId);
        clickNode(node);
        await flushPromises();
        clickNode(node);
        await flushPromises();
    }
    ```

    Tests inside:
    - `Context menu renders with correct node prop when opened` → delete (no menu).
    - `Context menu close event hides the menu` → delete (no menu).
    - `Context menu is hidden when canEdit is false …` → delete (Hide gating moved out of this component).
    - `View detail loads capability via Apex and opens panel` → adjust to use `clickTwice` directly (no menu hop). The Apex assertion + panel assertion stay.

- [x] **Step 4: Remove `hideCapability` mock setup**

    Drop `mockHideCapabilityImpl` and the `jest.mock('@salesforce/apex/bcm_CapabilityController.hideCapability', …)` block.

- [x] **Step 5: Update keyboard-nav tests where they assert menu state**

    In `BcmCapabilityMap keyboard navigation — L2 level`:
    - `ArrowDown from focused L2 …`: drop the post-arrow `expect(menu).toBeNull();` (no menu); the second-click-opens-panel sub-assertion changes to "second click opens panel" and asserts `panel.capability` is set.
    - `ArrowUp from focused L2 …`: same treatment.
    - `ArrowUp from first L2 …`: same.
    - `ArrowLeft/Right on focused L2 does not open …`: assert `panel.capability` stays null.

- [x] **Step 6: Update L3 click test**

    `Second click on same L3 bullet opens context menu` → `Second click on same L3 bullet opens detail panel`. Mock `mockGetCapabilityDetailImpl`, assert it was called with the L3 id.

---

## Task 4: Update Playwright e2e

**Files:**

- Modify: `tests/e2e/capability-detail.spec.ts`
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Simplify `openDetailPanelOnL1/L2/L3` helpers**

    In `capability-detail.spec.ts`, each helper currently does: click, click, find `.bcm-menu-card`, click `View detail`, expect panel.

    New flow: click, click, expect panel directly.

    ```ts
    async function openDetailPanelOnL2(page: Page) {
        const label = page
            .locator(
                `svg.bcm-canvas g.bcm-node[data-node-level="2"][data-node-name="${L2_NAME}"] > text`
            )
            .first();
        await label.click();
        await label.click();
        const panel = page.locator('.bcm-detail-panel[data-open="true"]');
        await expect(panel).toBeVisible({ timeout: 5000 });
        return panel;
    }
    ```

    Same shape for L1 and L3.

- [x] **Step 2: Drop `Hide menu action removes node and Show Hidden restores it` test**

    In `diagram.spec.ts:432`, delete the entire test (Hide is now a panel-edit-mode action, covered in `capability-detail.spec.ts` Editor-edit scenarios). Drop the inline `unhide` Apex teardown that was scoped to this test (lines 456–471) since no test hides anything in this spec anymore.

- [x] **Step 3: Drop `Viewer cannot see Hide button in context menu` test**

    In `diagram.spec.ts:541`, delete the entire test. Viewer Hide gating now lives in `capability-detail.spec.ts` (panel edit-mode is gated by `canEdit`).

- [x] **Step 4: Verify nothing else in `tests/e2e/` references `.bcm-menu-card`**

    ```bash
    grep -rn 'bcm-menu-card\|bcm-context-menu' tests/e2e/
    ```

    Expected: no matches.

---

## Task 5: Update spec doc

**Files:**

- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Remove "Feature: Context menu appears on node click" section** (lines ~193-209)

- [x] **Step 2: Replace "Feature: Context menu actions" with "Feature: Second click opens Detail Panel"**

    New body:

    ```markdown
    ## Feature: Second click opens Detail Panel

    **Scenario: Second click on focused L1, L2, or L3 node opens the Detail Panel directly**

    Given a node is focused and the Detail Panel is closed
    When the user clicks that same node a second time
    Then the Detail Panel slides in populated with that capability
    And no intermediate context menu is shown

    > Tested by: bcm_CapabilityMap.test.js — "Second click on same L1 node opens detail panel", "Second click on same L2 node opens detail panel", "Second click on same L3 bullet opens detail panel"; capability-detail.spec.ts — "View detail opens panel with capability name in header"

    **Scenario: Clicking a different already-focused node updates the panel in place**

    Given the Detail Panel is open for capability A
    When the user clicks any other node
    Then the panel content updates to show that capability
    And the panel does not close and reopen

    > Tested by: capability-detail.spec.ts — "Switching nodes updates panel content without closing"

    **Scenario: Hide remains available to Editors via the Detail Panel**

    Given an Editor opens the Detail Panel for any capability
    When the Editor toggles "Hide From Diagram" in edit mode and saves
    Then the capability is hidden on the diagram (existing FP30 path)

    > Tested by: bcm_CapabilityServiceTest.updateCapability_persists_hideFromDiagram; bcm_CapabilityMap.test.js — "saved event calls updateCapability and rebuilds diagram with new name" (path covers `bcm_HideFromDiagram__c` save)
    ```

- [x] **Step 3: Update "Feature: Node click UX — focus then menu" section title and 2nd-click scenarios**

    Rename the section title to `## Feature: Node click UX — focus then panel`. Update the second-click scenarios (lines ~458-481) so the wording says "opens Detail Panel" instead of "opens context menu". Update the `Tested by:` markers to point to the renamed Jest tests.

    Specifically:
    - "Second click on already-focused L1 or L2 node opens context menu" → "… opens Detail Panel"
    - "Second click on already-focused L3 bullet opens context menu" → "… opens Detail Panel"
    - The `Clicking a different node switches focus without opening menu` scenario stays (still true: a different unfocused node first focuses, doesn't open panel) — but reword the trailing assertion to "the Detail Panel does not open".

---

## Task 6: Update FP table

**Files:**

- Modify: `docs/economics/function-point-count.md`

- [x] **Step 1: Mark FP31 obsolete**

    Strike `FP31 Hide Capability via Context Menu` row from the count table — Hide is no longer triggered via a dedicated process, it's a field write within FP30 (Edit Capability via Panel — Save). Adjust the **Total** row accordingly: subtract `1 + 1 + 0 + 1 = 3 CFP`. New total drops from 122 to 119.

    In §6 "Excluded Processes", append:

    ```markdown
    | Hide via context menu removed (GH #32) | FP31 (Hide via Context Menu) deleted alongside the menu LWC. The Hide action remains available to Editors as a field within FP30 (Edit Capability via Panel — Save) — same Entry/Write footprint, no new functional process. |
    ```

    Update the "Delivery status" line under the table to note GH #32 reduced the count.

---

## Task 7: Verification

- [x] **Step 1: Jest**

    ```bash
    npm test
    ```

    Expected: all suites green; menu describes gone; new panel-open assertions pass.

- [x] **Step 2: Deploy**

    ```bash
    sf project deploy start --ignore-conflicts
    ```

    Watch for `bcm_ContextMenu` destructive change to apply.

    > **Heads up:** deleting an LWC bundle from source-tracked deploy will require a `destructiveChanges.xml` if the bundle exists in the org. If `sf project deploy start` does not handle the deletion automatically, run `sf project delete source --metadata LightningComponentBundle:bcm_ContextMenu` instead.

- [x] **Step 3: Manual smoke (Editor + Viewer)**
    - Editor: load map → click L1 → focused → click again → panel opens with that L1.
    - Click L2 (already-focused L1 was different) → focus moves to L2 (no panel? — wait, panel was open from prior click. Re-test: close panel via X, then click new L1 → focused, click again → panel opens.)
    - With panel open, click another L1 / L2 / L3 in turn → panel content updates in place, no flicker.
    - Editor: open panel for any capability → enter edit mode → tick Hide From Diagram → Save → diagram hides that node.
    - Show Hidden toggle reveals hidden node with dashed border.
    - Viewer: load map → click any node twice → panel opens read-only (no Edit button). No menu appears anywhere.

- [x] **Step 4: Mark plan steps + FP table**

    Tick all `- [ ]` to `- [x]`. Add completion date to the FP31-removal row.

- [x] **Step 5: Push branch + open PR (do NOT auto-merge)**

    ```bash
    git push -u origin sf_businesscapability-32
    gh pr create --title "feat(viz): replace context menu with direct Detail Panel slide-in (GH #32)" --body "$(cat <<'EOF'
    ## Summary
    - Delete `bcm_ContextMenu` LWC bundle (html/js/css/meta + __tests__)
    - 2nd click on focused L1/L2/L3 now opens the Detail Panel directly
    - Hide UX preserved via Detail Panel edit mode (Editors only)
    - Spec, Jest, Playwright, and FP table updated

    ## Test plan
    - [x] `npm test` — menu describes removed, panel-open assertions added
    - [x] Playwright `tests/e2e/capability-detail.spec.ts` — direct 2-click → panel
    - [x] Manual: Editor + Viewer flows unchanged from user perspective; one fewer click
    - [x] FP table: FP31 removed, total 122 → 119

    Closes #32
    EOF
    )"
    ```

---

## Self-Review Notes

- **Acceptance criteria coverage:**
    - ☑ Second click on focused L1/L2/L3 node opens Detail Panel directly — Task 1 Step 5 + Task 3 Step 1
    - ☑ First click still focuses without opening panel (existing rule preserved) — Task 1 Step 5 (early-return on `!alreadyFocused`)
    - ☑ Clicking a different already-focused node updates panel content in place — Task 1 Step 5 (panel-open branch handles refresh)
    - ☑ `bcm_ContextMenu` bundle deleted — Task 2
    - ☑ `contextMenuVisible/X/Y/Node` state and handlers removed — Task 1 Steps 1, 3, 4
    - ☑ `<c-bcm_-context-menu>` removed from HTML — Task 1 Step 6
    - ☑ Spec updated with no `not yet covered` / `UI only` markers — Task 5
    - ☑ Jest assertions replaced — Task 3
    - ☑ Playwright helpers + Hide-via-menu test dropped — Task 4
    - ☑ Viewer flow unaffected (panel still read-only); Editor Hide path still works via panel edit — Task 7 Step 3 manual smoke
- **Scope discipline:** No panel UI changes, no keyboard-nav changes, no Hide gating changes (panel already gates).
- **Risk:** the `handleHide(evt)` method removal removes the only consumer of `hideCapability` Apex. Verify no other LWC imports it: `grep -rn "hideCapability" force-app/`. Apex method itself stays (covered by `bcm_CapabilityControllerTest.shouldHideCapability` — leave Apex intact for now; FP delta is documented).
- **Placeholder scan:** Clean — no TBD / TODO.
