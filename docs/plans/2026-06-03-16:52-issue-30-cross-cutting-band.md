# Issue #30 — Render cross-cutting capabilities as bottom chevron band

> **Status:** Completed 2026-06-03 — all tasks ticked; FP exclusion row added (no new FP).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

## Context

Issue #29 introduced the `bcm_IsCrossCutting__c` flag on `bcm_Capability__c`. Selectors already return it; FLS already grants both Editor and Viewer the read. This issue is purely a Visualisation slice: cross-cutting L1s (and their descendants) are removed from the regular column layout and rendered as a single horizontal chevron band pinned to the bottom of the canvas. Clicking a band chevron opens the existing Detail Panel via the `viewdetail` flow.

Out of scope (separate slices):
- Toolbar toggle to hide / show the band
- Visual styling of the band beyond the chevron strip required by the AC
- Children of cross-cutting L1s in any form

---

## Architecture

The diagram already separates two transform layers:

- **L1 layer** — `<g transform={l1Transform}>` with `translate(panX, 0) scale(zoom)` (horizontally panned, vertically pinned to top).
- **L2 layer** — `<g transform={viewportTransform}>` with `translate(panX, panY) scale(zoom)` (full pan + zoom).

Add a third layer for cross-cutting L1s, mirroring the L1 layer's pinning behaviour but anchored to the bottom of the SVG canvas:

- **Band layer** — `<g transform={bandTransform}>` with `translate(panX, 0) scale(zoom)`.
  Each band chevron is laid out at SVG Y `canvasHeight - DIAGRAM_PADDING - CHEVRON_HEIGHT`. Because `panY` is not applied, it stays in the same SVG position regardless of vertical pan — analogous to the top L1 row.

Layout split inside `_buildLayout`:

1. After building `nodeMap` and parent-child wiring, partition the L1 roots: `regularRoots = roots.filter(r => !r.bcm_IsCrossCutting__c)` and `ccRoots = roots.filter(r => r.bcm_IsCrossCutting__c)`.
2. The existing column-layout loop walks `regularRoots` only. Children of `ccRoots` are never visited — they implicitly drop out of `_layoutL2`.
3. New computation: `_layoutBand` — array of `{ id, name, points, labelLines }` chevron descriptors. Use `CHEVRON_HEIGHT`, `CHEVRON_NOTCH`, and `wrapText` exactly as the top L1 chevrons do.
4. `_l1Roots` continues to mean *regular* L1 roots (drives `canvasWidth` for the column area) — keyboard nav state (`_colMap`, `_l2ByCol`) is unaffected because cc L1s are absent from those maps.

Width / height derivation:

- `canvasWidth` = max of the regular-column width and the band's natural width (`padding*2 + ccCols*COLUMN_WIDTH + (ccCols-1)*COLUMN_GAP`), with the existing `600` floor.
- `canvasHeight` += `BAND_RESERVED = ccRoots.length ? CHEVRON_HEIGHT + BOX_GAP : 0`.
- Band cell width = `(canvasWidth - 2*DIAGRAM_PADDING - (ccCols-1)*COLUMN_GAP) / ccCols` — chevrons span the full diagram width as the AC requires.

Click flow:

- `<g class="bcm-band-node" data-node-id={node.id} data-node-name={node.name} data-node-level="1" onclick={handleBandClick}>`.
- `handleBandClick(evt)` — closes any open context menu, then calls `this.handleViewDetail({ detail: { id } })`. No focus / menu UX on the band; single click opens the panel as the AC dictates.

`bcm-node` class deliberately not reused on band nodes to keep `handleSvgMouseDown`'s "click on bcm-node" guard untouched and avoid the focus-then-menu state machine intercepting band clicks.

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — partition roots; build band layout; add `bandTransform` getter; widen `canvasWidth`/`canvasHeight`; add `handleBandClick`.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — render `<g transform={bandTransform}>` after the L1 layer.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — new describe block with cross-cutting seeded data.
- **Modify** `tests/e2e/diagram.spec.ts` — seed JSON gains an `isCrossCutting: true` L1; new test asserts band rendering and column exclusion.
- **Modify** `docs/specs/diagram.md` — new "Cross-cutting band" feature section.
- **Modify** `docs/design/99-cosmic-function-point-count.md` — exclusion row for the new render path (UI-only, no data movement).

> e2e seed JSON shape: `bcm_DataImportService` already accepts a `isCrossCutting` field if forwarded — verify before adding the field. If the import service does not yet know the field, add a small mapping line in `bcm_DataImportService` (single token addition; same shape as `hideFromDiagram`); otherwise the e2e test must mark the L1 cross-cutting via Apex post-import. Plan assumes the latter as the safer default.

---

## Task 1: Layout — partition roots and build band descriptors

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- [x] **Step 1: Add `BAND_RESERVED_HEIGHT` derivation inline**

  No new top-level constants are necessary — reuse `CHEVRON_HEIGHT`, `CHEVRON_NOTCH`, `BOX_GAP`, `COLUMN_WIDTH`, `COLUMN_GAP`, `DIAGRAM_PADDING`.

- [x] **Step 2: Partition roots after the existing sort**

  Inside `_buildLayout`, after `sortByOrder(roots)` runs, split:

  ```js
  const ccRoots      = roots.filter(r => r.bcm_IsCrossCutting__c);
  const regularRoots = roots.filter(r => !r.bcm_IsCrossCutting__c);
  ```

  Drive the column loop from `regularRoots`. Set `this._l1Roots = regularRoots` so `canvasWidth` (which reads `_l1Roots`) keeps the existing meaning.

- [x] **Step 3: Build `_layoutBand`**

  After the column loop, compute band geometry:

  ```js
  const ccCols   = ccRoots.length;
  const bandY    = this.canvasHeightInternal - DIAGRAM_PADDING - CHEVRON_HEIGHT;
  // canvasHeightInternal: same calc as canvasHeight, repeated locally to avoid getter call
  // before _layoutBand is set (or compute inline)
  ```

  For each cc root, compute polygon points using `bandCellW` such that all chevrons together span the usable width. Push `{ id, name, points, labelLines }` to `bandNodes`. Assign `this._layoutBand = bandNodes`.

- [x] **Step 4: Update `canvasWidth` and `canvasHeight` getters**

  - `canvasWidth`: take `Math.max(regularWidth, bandNaturalWidth, 600)` where `bandNaturalWidth = ccRoots > 0 ? padding*2 + ccCols*COLUMN_WIDTH + (ccCols-1)*COLUMN_GAP : 0`.
  - `canvasHeight`: add `(this._layoutBand?.length ? CHEVRON_HEIGHT + BOX_GAP : 0)`.

  Cache `_ccCols` on `this` if needed for `canvasWidth`.

- [x] **Step 5: Add `bandTransform` getter**

  ```js
  get bandTransform() { return `translate(${this.panX}, 0) scale(${this.zoom})`; }
  ```

  And `get bandNodes() { return this._layoutBand || []; }`.

---

## Task 2: Template — render the band

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- [x] **Step 1: Add a new `<g>` after the L1 layer**

  Mirror the L1 layer's structure but wire `onclick={handleBandClick}` and use a distinct CSS class `bcm-band-node`:

  ```html
  <!-- Cross-cutting band: pans horizontally with L1 layer; pinned to bottom -->
  <g transform={bandTransform}>
      <template for:each={bandNodes} for:item="node">
          <g key={node.id}
             class="bcm-band-node"
             data-node-id={node.id}
             data-node-name={node.name}
             data-node-level="1"
             onclick={handleBandClick}>
              <polygon points={node.points} fill="#4A4A4A" stroke="#333333" stroke-width="1"></polygon>
              <template for:each={node.labelLines} for:item="line">
                  <text key={line.key}
                        x={line.x}
                        y={line.y}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="#FFFFFF"
                        font-size="13"
                        font-weight="bold">{line.text}</text>
              </template>
          </g>
      </template>
  </g>
  ```

  Keep this group AFTER the L1 layer so it draws on top in case of overlap; both share the `panX` translation so they cannot horizontally drift apart.

- [x] **Step 2: Add minimal CSS**

  Append to `bcm_CapabilityMap.css`:

  ```css
  .bcm-band-node { cursor: pointer; }
  ```

---

## Task 3: Click handler — open Detail Panel

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- [x] **Step 1: Add `handleBandClick`**

  ```js
  handleBandClick(evt) {
      evt.stopPropagation();
      const id = evt.currentTarget.dataset.nodeId;
      if (!id) return;
      this.contextMenuVisible = false;
      this.handleViewDetail({ detail: { id } });
  }
  ```

  No focus toggle, no two-click pattern. Click → load detail, panel opens.

- [x] **Step 2: Verify `handleSvgMouseDown` does not fire on band clicks**

  `handleSvgMouseDown` early-returns when `evt.target.closest('.bcm-node')` matches. Band uses `.bcm-band-node`, so the guard is bypassed and a band click also triggers a `mousedown` on the SVG → `_isDragging = true`. `handleBandClick` calls `evt.stopPropagation()`, but `mousedown` fires before click. Add `.bcm-band-node` to the same guard:

  ```js
  if (evt.target.closest('.bcm-node, .bcm-band-node')) return;
  ```

  This prevents a band click from clearing focus or starting a drag.

---

## Task 4: Jest test

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Extend seed data**

  Add a new fixture `CAPS_DATA_WITH_CC` adjacent to `CAPS_DATA` that adds an L1 with `bcm_IsCrossCutting__c: true` plus an L2 child. Keep the original `CAPS_DATA` unchanged — existing tests must remain green.

  ```js
  const CAPS_DATA_WITH_CC = [
      ...CAPS_DATA,
      { Id: 'L1-CC', Name: 'Security', bcm_Parent__c: null, bcm_SortOrder__c: 99,
        bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: true },
      { Id: 'L2-CC1', Name: 'Encryption', bcm_Parent__c: 'L1-CC', bcm_SortOrder__c: 1,
        bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: false, Tags__r: [] },
  ];
  ```

- [x] **Step 2: Add describe block**

  ```js
  describe('BcmCapabilityMap cross-cutting band', () => {
      let element;

      beforeEach(async () => {
          mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA_WITH_CC);
          element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
          document.body.appendChild(element);
          mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
          mockGetTags.emit({ data: [], error: undefined });
          await flushPromises();
          await seedLayout(element);
      });

      afterEach(() => {
          while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
      });

      it('Cross-cutting L1 renders as band node, not as column chevron', () => {
          const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
          expect(band).not.toBeNull();
          // Not in the regular L1 layer — there should be no .bcm-node with the cc id
          const column = element.shadowRoot.querySelector(
              '.bcm-node[data-node-id="L1-CC"][data-node-level="1"]'
          );
          expect(column).toBeNull();
      });

      it('Cross-cutting L1 child (L2) is excluded from the diagram', () => {
          const l2 = element.shadowRoot.querySelector('[data-node-id="L2-CC1"]');
          expect(l2).toBeNull();
      });

      it('Non-cross-cutting L1 still renders as a regular column chevron', () => {
          const regular = element.shadowRoot.querySelector(
              '.bcm-node[data-node-id="L1-A"][data-node-level="1"]'
          );
          expect(regular).not.toBeNull();
      });

      it('Click on band chevron triggers viewdetail Apex call', async () => {
          const detailRecord = { Id: 'L1-CC', Name: 'Security', bcm_Level__c: 1, Tags__r: [] };
          mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue(detailRecord);
          const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
          band.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
          await flushPromises();
          expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L1-CC' });
      });
  });
  ```

---

## Task 5: Playwright e2e

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Promote one of the existing seeded L1s OR seed a third**

  The seed JSON already creates `Domain Alpha` (L1 with children) and `Domain Beta` (L1 with one L2). Add a third L1 named `Cross-cutting Foo ${RUN_ID}` with no children. Mark it cross-cutting via Apex inside the `beforeAll` block (after the JSON import succeeds), to avoid coupling this slice to a possible `bcm_DataImportService` change.

  ```ts
  // After the import + Close button, before ctx.close():
  const apex = `
  bcm_Capability__c cc = [SELECT Id FROM bcm_Capability__c
                          WHERE Name = 'Cross-cutting Foo ${RUN_ID}' LIMIT 1];
  cc.bcm_IsCrossCutting__c = true;
  update cc;
  `.trim();
  const apexFile = path.resolve(`tests/e2e/.cc_${RUN_ID}.apex`);
  fs.writeFileSync(apexFile, apex, 'utf-8');
  try {
      execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias!],
                   { stdio: 'inherit' });
  } finally {
      fs.unlinkSync(apexFile);
  }
  ```

  Add a helper at the top of `beforeAll` to read `SF_ORG_ALIAS` once.

- [x] **Step 2: Add a test in the "Diagram structure — editor project" describe block**

  ```ts
  test('Cross-cutting L1 renders as band chevron at bottom; non-cross-cutting still in column', async ({ page }) => {
      await openDiagram(page);
      await selectMapFromCombobox(page);

      const ccName = `Cross-cutting Foo ${RUN_ID}`;
      const ccBand = page.locator(`g.bcm-band-node[data-node-name="${ccName}"]`);
      await expect(ccBand).toHaveCount(1);

      // Non-cross-cutting L1 still renders as a regular column chevron
      const regularName = `Domain Alpha ${RUN_ID}`;
      const regularCol = page.locator(
          `g.bcm-node[data-node-level="1"][data-node-name="${regularName}"]`
      );
      await expect(regularCol).toHaveCount(1);

      // Cross-cutting L1 is NOT in the regular column layer
      const ccColumn = page.locator(
          `g.bcm-node[data-node-level="1"][data-node-name="${ccName}"]`
      );
      await expect(ccColumn).toHaveCount(0);
  });

  test('Clicking a cross-cutting band chevron opens the Detail Panel', async ({ page }) => {
      await openDiagram(page);
      await selectMapFromCombobox(page);

      const ccName = `Cross-cutting Foo ${RUN_ID}`;
      await page.locator(`g.bcm-band-node[data-node-name="${ccName}"]`).click();
      const panel = page.locator('c-bcm_-capability-detail, [data-id="bcm-detail-panel"]');
      // Re-use existing detail-panel selector pattern from capability-detail.spec.ts
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });
  ```

  Verify the detail-panel selector matches whatever `capability-detail.spec.ts` already uses; reuse that exact selector to avoid drift.

- [x] **Step 3: Update the teardown apex to also clear the cross-cutting flag (defensive)**

  Not strictly required — the teardown deletes all capabilities created with this `RUN_ID`. No additional cleanup needed.

---

## Task 6: Spec doc

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Add a new feature section**

  Append after "Feature: L1 chevrons stay pinned during vertical pan":

  ```markdown
  ---

  ## Feature: Cross-cutting band

  **Scenario: Cross-cutting L1 capabilities render as a chevron band at the bottom**

  Given a Map contains at least one Level 1 Capability with `bcm_IsCrossCutting__c = true`
  When the diagram renders
  Then those L1s appear as a single horizontal chevron strip at the bottom of the canvas
  And the chevrons are arranged left-to-right in `bcm_SortOrder__c` order

  > Tested by: bcm_CapabilityMap.test.js — "Cross-cutting L1 renders as band node, not as column chevron"; diagram.spec.ts — "Cross-cutting L1 renders as band chevron at bottom; non-cross-cutting still in column"

  **Scenario: Cross-cutting L1 is excluded from the regular column layout**

  Given an L1 Capability with `bcm_IsCrossCutting__c = true`
  When the diagram renders
  Then that L1 does not appear as a column chevron in the top L1 row
  And no L2 or L3 descendant of that L1 is rendered anywhere on the diagram

  > Tested by: bcm_CapabilityMap.test.js — "Cross-cutting L1 child (L2) is excluded from the diagram", "Non-cross-cutting L1 still renders as a regular column chevron"

  **Scenario: Clicking a cross-cutting band chevron opens the Detail Panel**

  Given the cross-cutting band is rendered
  When the user clicks one of its chevrons
  Then the Detail Panel opens populated with that capability via the existing `viewdetail` flow

  > Tested by: bcm_CapabilityMap.test.js — "Click on band chevron triggers viewdetail Apex call"; diagram.spec.ts — "Clicking a cross-cutting band chevron opens the Detail Panel"

  **Scenario: Band stays pinned to the bottom during vertical pan**

  Given the diagram is taller than the viewport and the user pans vertically
  When the L2 layer's translateY changes
  Then the band layer's translateY remains 0 (mirrors the L1 top-row pinning)

  > Deferred: visual invariant — band layer transform shares the L1-pin pattern (`translate(panX, 0)`); covered by the existing L1-pin test ("L1 chevron band stays at translateY=0 even when L2 panY is non-zero") which exercises the same mechanism
  ```

---

## Task 7: COSMIC FP exclusion note

**Files:**
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Append a row to §6 Excluded Processes**

  ```markdown
  | Cross-cutting band rendering (GH #30) | Pure SVG re-layout of already-loaded capability data; the read of `bcm_IsCrossCutting__c` is part of the existing `getCapabilities` payload (FP2). No new Entry, Exit, Read, or Write. The click-to-open-detail action reuses FP29 (View Capability Detail via Panel) — same data movement, different invocation surface. |
  ```

---

## Task 8: Final verification

- [x] **Step 1: Jest**

  ```bash
  npm test
  ```

  Expected: existing tests stay green; new "cross-cutting band" describe block passes.

- [x] **Step 2: Deploy + Apex suite**

  No Apex change in this slice, but redeploy LWC + run a smoke pass:

  ```bash
  sf project deploy start
  ```

- [x] **Step 3: Manual smoke**

  - Tick `bcm_IsCrossCutting__c` on an L1 in any seeded map → reload Visualisation → verify L1 disappears from columns, appears as bottom band chevron, panel opens on click.
  - Pan vertically → band stays pinned to bottom of SVG.
  - Untick the flag → L1 returns to column layout.

- [x] **Step 4: Mark plan steps complete**

  Tick every `- [x]` to `- [x]` with completion date. Update FP table per [[feedback_mark_complete_fp_table]] (no new FP — FP exclusion row added in T7).

- [x] **Step 5: Push branch + open PR (do NOT auto-merge)**

  ```bash
  git push -u origin sf_businesscapability-30
  gh pr create --title "feat(viz): render cross-cutting L1s as bottom chevron band (GH #30)" --body "$(cat <<'EOF'
  ## Summary
  - Cross-cutting L1s (`bcm_IsCrossCutting__c = true`) skip the regular column layout
  - New band layer renders them as a chevron strip pinned to the bottom of the canvas
  - L2/L3 descendants of cross-cutting L1s are excluded from the diagram
  - Clicking a band chevron reuses the `viewdetail` flow → Detail Panel opens
  - Band shares the L1 layer's `translate(panX, 0) scale(zoom)` so it stays pinned vertically

  ## Test plan
  - [x] `npm test` — new Jest describe block + existing tests
  - [x] Playwright `tests/e2e/diagram.spec.ts` — band rendering + column exclusion + click → panel
  - [x] Manual: toggle flag on/off; verify column ↔ band migration; verify pan behaviour

  Closes #30
  EOF
  )"
  ```

---

## Self-Review Notes

- **Acceptance criteria coverage:**
  - ☑ Cross-cutting L1 not in normal column — Task 1 (partition) + Task 4 Jest
  - ☑ Renders as bottom horizontal chevron strip in `bcm_SortOrder__c` order — Task 1 (band layout uses already-sorted `roots`) + Task 2 template
  - ☑ L2/L3 descendants excluded — Task 1 (column loop only walks regularRoots; cc subtree never visited)
  - ☑ Click fires existing `viewdetail` and opens Detail Panel — Task 3 + Task 4/5 tests
  - ☑ Zoom, pan, Show Hidden continue to work — band reuses `bandTransform = translate(panX, 0) scale(zoom)`; Show Hidden semantics unchanged for regular columns
  - ☑ Band pinned to bottom during vertical pan — Task 1/2 (no panY in `bandTransform`)
  - ☑ Jest test verifies band membership and column exclusion — Task 4
  - ☑ Playwright e2e verifies band + non-cc column — Task 5
  - ☑ Spec gains "Cross-cutting band" — Task 6 with all three accepted markers
- **Scope discipline:** No toolbar toggle, no styling beyond chevron strip, no behaviour for cc-L1 children — all out of scope per the issue body.
- **FP table:** No new FP — UI re-layout of already-loaded data + reuse of FP29 click path. Excluded-processes row added in Task 7.
- **Placeholder scan:** Clean — no TBD / TODO.
- **e2e notes:** New tests in `diagram.spec.ts`; seed gains a third L1 + Apex flag-flip in `beforeAll`; teardown unchanged (deletes by `RUN_ID`).
