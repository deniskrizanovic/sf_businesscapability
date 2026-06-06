# PR #51 Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 2 blocking review items + 4 optional follow-ups on PR #51 (drag-drop L1/L2/L3 reorder + reparent).

**Architecture:** Strengthen Playwright gesture test to assert order changed (not just names persist). Replace fixed `waitForTimeout(1500)` with `data-bcm-saving` attribute polled by Playwright. Refactor `_handleDragMouseUp` (extract `_dispatchSaveApex`). Fix `_ghostX`/`_ghostY` reactivity hack by moving coords inside `ghost`. Clear `_capabilities` when map combobox cleared. Reconcile ADR/plan SOQL wording (`WITH SECURITY_ENFORCED` → `WITH USER_MODE`).

**Tech Stack:** LWC (`bcm_CapabilityMap.js` + `.html`), Playwright (`tests/e2e/drag-drop.spec.ts`), Apex docs.

---

## File Structure

| File | Reason |
|------|--------|
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` | Add `data-bcm-saving` attr on root for Playwright wait condition. |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` | Move `_ghostX/_ghostY` into `this.ghost`. Extract `_dispatchSaveApex`. Clear `_capabilities` on combobox unselect. |
| `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` | Update Jest expectations matching new ghost shape + new helper boundary. |
| `tests/e2e/drag-drop.spec.ts` | Replace `waitForTimeout(1500)` w/ wait on `data-bcm-saving`. Capture pre-drag SortOrder. Parse `DRAG_DROP_RESULT:` and assert order changed. |
| `docs/plans/2026-06-06-11:47-step8-drag-drop.md` | Reconcile `WITH SECURITY_ENFORCED` → `WITH USER_MODE` (matches code). |

No new files. No Apex code changes.

---

## E2e test impact

- **Spec affected:** `docs/specs/drag-drop.md` — no marker changes (test names stay).
- **Helper change:** Add `waitForDragDropSettled(page)` to `tests/e2e/drag-drop.spec.ts` (local helper, not shared yet — only one caller). Polls `[data-bcm-saving="false"]` on the canvas root.
- **Interaction pattern change:** Gesture test now (a) parses `DRAG_DROP_RESULT:` from apex output and asserts `L2A2|L2A1|` (swap), (b) replaces `page.waitForTimeout(1500)` with `waitForDragDropSettled(page)`.
- **No new spec scenarios.** This is hardening of existing `L2 reorder within column (gesture)` test only.

---

## Task 1: Add `data-bcm-saving` attribute to canvas root

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` (around line 88-99 — `.bcm-canvas-container` wrapper)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (add `savingAttr` getter)

The Playwright gesture test needs a deterministic signal that the optimistic update + Apex save completed. `isSavingDragDrop` already exists on the LWC; we just need to surface it as a DOM attribute.

- [ ] **Step 1: Add `savingAttr` getter to `bcm_CapabilityMap.js`**

Add right after `get canEdit()` (around line 192):

```js
    get savingAttr() {
        return this.isSavingDragDrop ? 'true' : 'false';
    }
```

- [ ] **Step 2: Bind `data-bcm-saving` on `.bcm-canvas-container`**

In `bcm_CapabilityMap.html`, change line 88 from:

```html
    <div class="bcm-canvas-container">
```

to:

```html
    <div class="bcm-canvas-container" data-bcm-saving={savingAttr}>
```

- [ ] **Step 3: Run Jest to verify nothing broke**

Run: `npm run test:unit -- bcm_CapabilityMap`
Expected: PASS (no test references `bcm-canvas-container` attrs yet).

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js
git commit -m "feat(drag-drop): expose data-bcm-saving for e2e wait condition (PR #51)"
```

---

## Task 2: Strengthen Playwright gesture test (blockers #1 + #2)

**Files:**
- Modify: `tests/e2e/drag-drop.spec.ts` (the `L2 reorder within column (gesture)` test — currently lines 166-217)

Two blockers fold together because they touch the same test. We:
1. Capture pre-drag SortOrder via apex (so we have a baseline).
2. Replace `page.waitForTimeout(1500)` with `waitForDragDropSettled(page)` polling `[data-bcm-saving="false"]`.
3. Parse the post-drag `DRAG_DROP_RESULT:` line and assert it differs from pre-drag (i.e. swap actually happened, not just names persisted).

- [ ] **Step 1: Add `waitForDragDropSettled` helper at top of `tests/e2e/drag-drop.spec.ts`**

Add right after `selectMap` helper (around line 110):

```ts
async function waitForDragDropSettled(page: import('@playwright/test').Page) {
    await page.locator('.bcm-canvas-container[data-bcm-saving="false"]').waitFor({ state: 'attached', timeout: 15000 });
}
```

- [ ] **Step 2: Add `parseDragDropOrder` helper to read SortOrder via apex**

Add right after `waitForDragDropSettled`:

```ts
function parseDragDropOrder(orgAlias: string, mapName: string, parentName: string): string {
    const apex = `
List<bcm_Capability__c> caps = [
    SELECT Name, bcm_SortOrder__c
    FROM bcm_Capability__c
    WHERE bcm_Map__r.Name = '${mapName}'
      AND bcm_Level__c = 2
      AND bcm_Parent__r.Name = '${parentName}'
    ORDER BY bcm_SortOrder__c ASC
];
String result = '';
for (bcm_Capability__c c : caps) result += c.Name + '|';
System.debug('DRAG_DROP_RESULT:' + result);
`.trim();
    const apexFile = path.resolve(`tests/e2e/.dd_order_${RUN_ID}_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');
    try {
        const out = execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { encoding: 'utf-8' });
        const match = out.match(/DRAG_DROP_RESULT:([^\n]*)/);
        if (!match) throw new Error('DRAG_DROP_RESULT marker not found in apex output');
        return match[1].trim();
    } finally {
        fs.unlinkSync(apexFile);
    }
}
```

- [ ] **Step 3: Rewrite the gesture test body**

Replace the entire `L2 reorder within column (gesture)` test (lines 166-217) with:

```ts
    test('L2 reorder within column (gesture)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        await openDiagram(page);
        await selectMap(page);

        // Baseline: capture order BEFORE the drag
        const orderBefore = parseDragDropOrder(orgAlias, MAP_NAME, L1A_NAME);
        expect(orderBefore).toContain(L2A1_NAME);
        expect(orderBefore).toContain(L2A2_NAME);

        // Locate L2A1 + L2A2 handles
        const l2a1 = page.locator(`[data-bcm-drag-handle="true"][data-node-level="2"]`).nth(0);
        const l2a2 = page.locator(`[data-bcm-drag-handle="true"][data-node-level="2"]`).nth(1);
        const a1Box = await l2a1.boundingBox();
        const a2Box = await l2a2.boundingBox();
        if (!a1Box || !a2Box) throw new Error('Could not locate L2 handle bounding boxes');

        // Drag L2A1 down past L2A2's midpoint to swap order
        await page.mouse.move(a1Box.x + a1Box.width / 2, a1Box.y + a1Box.height / 2);
        await page.mouse.down();
        const targetY = a2Box.y + a2Box.height + 10;
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
            const yi = a1Box.y + ((targetY - a1Box.y) * i) / steps;
            await page.mouse.move(a1Box.x + a1Box.width / 2, yi);
        }
        await page.mouse.up();

        // Wait for the optimistic re-layout + Apex round-trip to settle
        await waitForDragDropSettled(page);

        // Verify the order CHANGED — gesture must have swapped L2A1 ↔ L2A2
        const orderAfter = parseDragDropOrder(orgAlias, MAP_NAME, L1A_NAME);
        expect(orderAfter).not.toBe(orderBefore);
        expect(orderAfter).toContain(L2A1_NAME);
        expect(orderAfter).toContain(L2A2_NAME);
    });
```

- [ ] **Step 4: Run the gesture test in isolation**

Run: `npx playwright test tests/e2e/drag-drop.spec.ts -g "L2 reorder within column"`
Expected: PASS. If FAIL, inspect Playwright trace for whether `[data-bcm-saving="false"]` is ever observed (Task 1 must be deployed to the org).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/drag-drop.spec.ts
git commit -m "test(drag-drop): strengthen gesture test - assert order changed, replace waitForTimeout (PR #51)"
```

---

## Task 3: Fix `_ghostX`/`_ghostY` reactivity hack

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (around lines 162-163, 640-643, 665-668, 682-688, 835-882)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` (no change expected — already binds `ghostTransform`)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` (only if it references `_ghostX/_ghostY` directly)

Move coords inside the `@track ghost` object so updates are naturally reactive — no spread hack required. The existing `_ghostX/_ghostY` private fields are removed.

- [ ] **Step 1: Check Jest test for direct field references**

Run: `grep -n "_ghostX\|_ghostY" force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`
Expected: no matches (Jest checks DOM via `ghostTransform`, not private fields). If matches found, those tests must be updated in Step 5.

- [ ] **Step 2: Remove `_ghostX`/`_ghostY` private fields**

In `bcm_CapabilityMap.js`, around lines 162-163, delete:

```js
    _ghostX             = 0;
    _ghostY             = 0;
```

- [ ] **Step 3: Update `ghostTransform` getter to read from `this.ghost`**

Replace lines 640-643:

```js
    get ghostTransform() {
        if (!this.ghost) return '';
        return `translate(${this._ghostX}, ${this._ghostY})`;
    }
```

with:

```js
    get ghostTransform() {
        if (!this.ghost) return '';
        return `translate(${this.ghost.x}, ${this.ghost.y})`;
    }
```

- [ ] **Step 4: Update ghost initialisation in `handleHandleMouseDown`**

Replace lines 665-669:

```js
        this._ghostOffsetX     = viewportPoint.x - ghost.originX;
        this._ghostOffsetY     = viewportPoint.y - ghost.originY;
        this._ghostX           = ghost.originX;
        this._ghostY           = ghost.originY;
        this.ghost             = ghost;
```

with:

```js
        this._ghostOffsetX     = viewportPoint.x - ghost.originX;
        this._ghostOffsetY     = viewportPoint.y - ghost.originY;
        ghost.x                = ghost.originX;
        ghost.y                = ghost.originY;
        this.ghost             = ghost;
```

- [ ] **Step 5: Update `_handleDragMouseMove` to mutate-and-reassign reactively**

Replace lines 682-691:

```js
    _handleDragMouseMove(evt) {
        if (!this.isDragging) return;
        const point = this._clientToViewport(evt.clientX, evt.clientY);
        this._ghostX = point.x - this._ghostOffsetX;
        this._ghostY = point.y - this._ghostOffsetY;
        // Force ghost reactive read
        this.ghost = { ...this.ghost };
        this._dropTargetInfo = this._hitTest(point.x, point.y, this._draggedNodeLevel);
        this.dropIndicator = this._buildDropIndicator(this._dropTargetInfo);
    }
```

with:

```js
    _handleDragMouseMove(evt) {
        if (!this.isDragging) return;
        const point = this._clientToViewport(evt.clientX, evt.clientY);
        this.ghost = {
            ...this.ghost,
            x: point.x - this._ghostOffsetX,
            y: point.y - this._ghostOffsetY,
        };
        this._dropTargetInfo = this._hitTest(point.x, point.y, this._draggedNodeLevel);
        this.dropIndicator = this._buildDropIndicator(this._dropTargetInfo);
    }
```

(We still reassign `this.ghost`, but now `x`/`y` live inside the tracked object — future refactors removing the spread won't silently break ghost movement, because the coords ARE the tracked value.)

- [ ] **Step 6: Run Jest**

Run: `npm run test:unit -- bcm_CapabilityMap`
Expected: PASS. If FAIL on a test referencing private `_ghostX`/`_ghostY`, update that test to read `this.ghost.x`/`this.ghost.y` or drop the assertion in favour of the rendered `transform` attribute.

- [ ] **Step 7: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "refactor(drag-drop): inline ghost coords into tracked object (PR #51)"
```

---

## Task 4: Extract `_dispatchSaveApex` from `_handleDragMouseUp`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (lines 693-797)

Goal: split out the Apex-call + revert-on-error path so `_handleDragMouseUp` reads as `compute → optimistic update → dispatch save`.

- [ ] **Step 1: Add `_dispatchSaveApex` method**

Insert immediately AFTER `_handleDragMouseUp` ends (after line 797), as a new method:

```js
    _dispatchSaveApex(movedId, sameParent, newSiblings, oldSiblings) {
        const apexCall = sameParent
            ? reorderCapabilities({ orderedIds: newSiblings })
            : reparentCapability({
                capabilityId : movedId,
                newParentId  : this._capabilities.find(c => c.Id === movedId)?.bcm_Parent__c || null,
                newSiblingIds: newSiblings,
                oldSiblingIds: oldSiblings,
            });

        return apexCall
            .then(() => this._refreshCapabilities())
            .then(() => {
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
            })
            .catch(err => {
                this._capabilities = this._preDragSnapshot;
                this._buildLayout(this._capabilities);
                if (this.detailCapability) {
                    this.detailBreadcrumb = this._buildBreadcrumb(this.detailCapability.Id);
                }
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
                this.dispatchEvent(new ShowToastEvent({
                    title  : 'Drag-drop save failed',
                    message: 'Failed to save changes. Your changes have been reverted.',
                    variant: 'error',
                    mode   : 'dismissable',
                }));
                // eslint-disable-next-line no-console
                console.warn('bcm drag-drop save failed', err);
            });
    }
```

Note: `newParentId` derivation reads from current optimistic state (post-`_applyOptimisticReorder`), which already has the new parent. This matches the pre-refactor behaviour where `target.parentId` was used directly.

**Wait** — re-read the existing code. The pre-refactor passes `newParentId = target.parentId` (a local). The optimistic state also has it. To keep the helper signature small and avoid recomputing, pass `newParentId` explicitly:

```js
    _dispatchSaveApex(movedId, newParentId, sameParent, newSiblings, oldSiblings) {
        const apexCall = sameParent
            ? reorderCapabilities({ orderedIds: newSiblings })
            : reparentCapability({
                capabilityId : movedId,
                newParentId  : newParentId,
                newSiblingIds: newSiblings,
                oldSiblingIds: oldSiblings,
            });

        return apexCall
            .then(() => this._refreshCapabilities())
            .then(() => {
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
            })
            .catch(err => {
                this._capabilities = this._preDragSnapshot;
                this._buildLayout(this._capabilities);
                if (this.detailCapability) {
                    this.detailBreadcrumb = this._buildBreadcrumb(this.detailCapability.Id);
                }
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
                this.dispatchEvent(new ShowToastEvent({
                    title  : 'Drag-drop save failed',
                    message: 'Failed to save changes. Your changes have been reverted.',
                    variant: 'error',
                    mode   : 'dismissable',
                }));
                // eslint-disable-next-line no-console
                console.warn('bcm drag-drop save failed', err);
            });
    }
```

(Use this version — explicit signature is clearer for jest seams.)

- [ ] **Step 2: Replace the trailing block of `_handleDragMouseUp` to call the new helper**

In `_handleDragMouseUp`, replace lines 765-797 (everything from `const apexCall = sameParent` through the `console.warn(...)` end of `.catch`) with:

```js
        this._dispatchSaveApex(movedId, newParentId, sameParent, newSiblings, oldSiblings);
```

Result: `_handleDragMouseUp` ends with the `cleanup()` call (already present) and then the dispatch line.

- [ ] **Step 3: Run Jest**

Run: `npm run test:unit -- bcm_CapabilityMap`
Expected: PASS — error revert path test must still cover the same flow (it now exercises `_dispatchSaveApex` indirectly).

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js
git commit -m "refactor(drag-drop): extract _dispatchSaveApex helper (PR #51)"
```

---

## Task 5: Clear `_capabilities` on combobox unselect

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (lines 555-567 — `handleMapChange`)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` (add a test)

When the user clears the map combobox, the prior diagram lingers because `_capabilities` is not reset. Wire migration noted this in review — fix it cheaply here.

- [ ] **Step 1: Write Jest test for empty selection clearing the diagram**

Add to `bcm_CapabilityMap.test.js` inside the existing describe block:

```js
    it('clears diagram when map combobox is unselected', async () => {
        const element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        // Simulate already-loaded map with capabilities
        element.selectedMapId = 'a01xxx';
        element._capabilities = [{ Id: 'a02xxx', Name: 'Foo', bcm_Level__c: 1, bcm_SortOrder__c: 1 }];
        await Promise.resolve();

        const combobox = element.shadowRoot.querySelector('lightning-combobox[label="Map"]');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await Promise.resolve();

        expect(element._capabilities).toEqual([]);
        expect(element._layoutL1).toEqual([]);
    });
```

(If the existing Jest file uses different conventions for the imports / describe structure, follow those — the assertion content is what matters.)

- [ ] **Step 2: Run test to verify it FAILS**

Run: `npm run test:unit -- bcm_CapabilityMap -t "clears diagram"`
Expected: FAIL — `_capabilities` still has `[{Id: 'a02xxx', ...}]` after combobox clear.

- [ ] **Step 3: Update `handleMapChange` to clear state when unselected**

Replace the body of `handleMapChange` (lines 555-567):

```js
    handleMapChange(evt) {
        this.selectedMapId      = evt.detail.value;
        this.zoom = ZOOM_DEFAULT;
        this.panX = 0;
        this.panY = 0;
        this.showCrossCutting = false;
        if (this.selectedMapId) {
            safeSessionSet(SESSION_KEY_SELECTED_MAP, this.selectedMapId);
        } else {
            safeSessionRemove(SESSION_KEY_SELECTED_MAP);
            this._capabilities = [];
            this._buildLayout([]);
        }
        this.isLoading = !!this.selectedMapId;
    }
```

(`_buildLayout([])` covers the empty-array branch which clears `_layoutL1`/`_layoutL2`/`_layoutBand` per existing logic at lines 249-259.)

- [ ] **Step 4: Run test to verify it PASSES**

Run: `npm run test:unit -- bcm_CapabilityMap -t "clears diagram"`
Expected: PASS.

- [ ] **Step 5: Run full Jest suite to catch regressions**

Run: `npm run test:unit -- bcm_CapabilityMap`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "fix(drag-drop): clear capabilities when map unselected (PR #51)"
```

---

## Task 6: Reconcile ADR/plan SOQL wording

**Files:**
- Modify: `docs/plans/2026-06-06-11:47-step8-drag-drop.md` (lines 22, 78)

Code uses `WITH USER_MODE` (Apex 56+ idiom). Plan still says `WITH SECURITY_ENFORCED` in two spots. Update plan to match code; add a one-line note explaining the equivalence.

- [ ] **Step 1: Replace SOQL guard wording in step8 plan**

In `docs/plans/2026-06-06-11:47-step8-drag-drop.md`, replace line 22:

```
| 6 | Two Apex methods: `reorderCapabilities`, `reparentCapability`. Custom-permission gate first line. `with sharing`. `WITH SECURITY_ENFORCED` on descendant SOQL. Same-map guard. Empty-list no-op. Single-transaction `update`. Returns `void`. |
```

with:

```
| 6 | Two Apex methods: `reorderCapabilities`, `reparentCapability`. Custom-permission gate first line. `with sharing`. `WITH USER_MODE` on SOQL + `update as user` on DML (newer Apex 56+ idiom for what was historically `WITH SECURITY_ENFORCED`). Same-map guard. Empty-list no-op. Single-transaction `update`. Returns `void`. |
```

And replace line 78:

```
- Queries descendants of moved node `WITH SECURITY_ENFORCED` (SOQL up to one level given the L3 cap; safe loop covers any future depth change).
```

with:

```
- Queries descendants of moved node `WITH USER_MODE` (SOQL up to one level given the L3 cap; safe loop covers any future depth change). `WITH USER_MODE` is the Apex 56+ replacement for `WITH SECURITY_ENFORCED` and gives the same FLS/CRUD enforcement.
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-06-06-11:47-step8-drag-drop.md
git commit -m "docs(plans): reconcile step8 SOQL wording with code (USER_MODE) (PR #51)"
```

---

## Task 7: Run full Jest + a Playwright smoke before pushing

**Files:** none (verification only).

- [ ] **Step 1: Run full Jest suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 2: Run the gesture test against the org**

Run: `npx playwright test tests/e2e/drag-drop.spec.ts -g "L2 reorder within column"`
Expected: PASS. Confirm: orderBefore !== orderAfter, and `data-bcm-saving="false"` is observed within timeout (no fixed sleep).

- [ ] **Step 3: Push branch + reply on PR**

```bash
git push origin sf_businesscapability-48
```

Reply on the PR review thread (top-level reply to comment 4640472694) summarising:
- Blockers fixed: gesture test now asserts swap; `data-bcm-saving` replaces `waitForTimeout`.
- Optional follow-ups all done: ghost reactivity, helper extracted, combobox-clear bug fixed, plan wording reconciled.

---

## Self-Review

Spec coverage: only `docs/specs/drag-drop.md` is touched indirectly via the gesture test. No new Tested-by markers needed; existing markers stay valid.

Placeholder scan: every step has explicit code. No `// TODO`, no `similar to Task N`.

Type consistency:
- `data-bcm-saving` written in HTML, `savingAttr` getter on JS — names consistent.
- `waitForDragDropSettled`, `parseDragDropOrder` defined once each, called once each.
- `_dispatchSaveApex(movedId, newParentId, sameParent, newSiblings, oldSiblings)` — signature matches the call site in `_handleDragMouseUp`.
- Ghost coord rename: `_ghostX/_ghostY` removed everywhere; `this.ghost.x/y` used in `ghostTransform`, `handleHandleMouseDown`, `_handleDragMouseMove`. Three call sites all rewritten.
