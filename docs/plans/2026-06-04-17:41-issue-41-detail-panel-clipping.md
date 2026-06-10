# Issue #41 — Edit Panel Chopped When Diagram Is Small

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detail Panel always renders fully inside the LWC bounds regardless of how few capabilities the diagram contains. Today the panel is `position: absolute` inside `.bcm-canvas-container`, and that container shrinks to fit the SVG content. When the SVG is small (e.g. one column / few rows), the container becomes smaller than the 400px-wide panel and the panel is visually clipped.

**Root cause:** the panel's positioning context is the SVG-sized canvas container, not the LWC host. The fix is to anchor the panel to the LWC host so its bounds are independent of diagram size.

**Architecture:**

1. **HTML restructure (`bcm_CapabilityMap.html`)** — wrap toolbar + canvas-container + detail panel in a new `.bcm-root` `<div>`. Move `<c-bcm_-capability-detail>` out of `.bcm-canvas-container` so it becomes a sibling of canvas-container under `.bcm-root`.
2. **CSS (`bcm_CapabilityMap.css`)** — make `:host` and `.bcm-root` fill the FlexiPage region:
    - `:host { display: flex; flex-direction: column; height: 100%; }`
    - `.bcm-root { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }`
    - `.bcm-canvas-container { flex: 1; min-height: 0; overflow: auto; }` (keep existing `position: relative` removed — positioning context now lives on `.bcm-root`)
3. **No JS change.** `bcm_CapabilityMap.js` still queries `.bcm-canvas-container.getBoundingClientRect()` in `handleFitToWindow`. After restructure that container fills the remaining LWC area, which only improves fit-to-window behaviour. The panel CSS itself (`bcm_CapabilityDetail.css`) is unchanged — `position: absolute; right: 0; top: 0; width: 400px; max-height: 100%` now resolves against `.bcm-root`.

**Tech Stack:** LWC HTML + CSS (`bcm_CapabilityMap`), Jest (`__tests__/bcm_CapabilityMap.test.js`), Playwright (`tests/e2e/capability-detail.spec.ts`), spec doc (`docs/specs/diagram.md`), CFP doc (`docs/design/99-cosmic-function-point-count.md`).

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — wrap in `.bcm-root`, move panel out of `.bcm-canvas-container`
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — add `:host` + `.bcm-root` rules; adjust `.bcm-canvas-container`
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — add structural assertion: panel is NOT a descendant of `.bcm-canvas-container`
- **Modify** `tests/e2e/capability-detail.spec.ts` — add bounding-box containment test
- **Modify** `docs/specs/diagram.md` — new scenario under Detail Panel area
- **Modify** `docs/design/99-cosmic-function-point-count.md` — new row in §6 Excluded Processes

**No new FP — pure CSS/HTML layout fix. Same exclusion class as GH #35 (visual layout).**

---

## Task 1: LWC restructure — DOM + CSS

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`

- [x] **Step 1: Wrap template in `.bcm-root` and relocate the detail panel**

In `bcm_CapabilityMap.html`, change the top-level structure from:

```html
<template>
    <div class="bcm-toolbar">…</div>
    <template if:true="{errorMessage}">…</template>
    <template if:true="{isLoading}">…</template>
    <div class="bcm-canvas-container">
        <svg …>…</svg>
        <c-bcm_-capability-detail …></c-bcm_-capability-detail>
    </div>
</template>
```

to:

```html
<template>
    <div class="bcm-root">
        <div class="bcm-toolbar">…</div>
        <template if:true="{errorMessage}">…</template>
        <template if:true="{isLoading}">…</template>
        <div class="bcm-canvas-container">
            <svg …>…</svg>
        </div>
        <c-bcm_-capability-detail
            capability="{detailCapability}"
            breadcrumb="{detailBreadcrumb}"
            is-loading="{detailIsLoading}"
            error-message="{detailErrorMessage}"
            can-edit="{canEdit}"
            onclose="{handleDetailClose}"
            onsaved="{handleDetailSaved}"
        >
        </c-bcm_-capability-detail>
    </div>
</template>
```

The panel is now a **sibling** of `.bcm-canvas-container`, both children of `.bcm-root`.

- [x] **Step 2: Update `bcm_CapabilityMap.css`**

Replace the existing rules (keep `.bcm-toolbar`, `.bcm-canvas`, `.bcm-canvas:active`, `.bcm-canvas:focus*`, `.bcm-node`, `.bcm-band-node`, and the `g[data-l3-group]` selector unchanged) with these adjustments:

```css
:host {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.bcm-root {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
}

.bcm-canvas-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: #fafafa;
}
```

Notes:

- Remove `position: relative` from `.bcm-canvas-container` if present — the panel's positioning context is now `.bcm-root`.
- The existing `.bcm-toolbar` background/border rule stays as-is. It is now a fixed-height flex item at the top of `.bcm-root`.
- The detail panel's own CSS (`bcm_CapabilityDetail.css`) is **not** changed — `position: absolute; right: 0; top: 0; max-height: 100%` resolves against `.bcm-root` after the restructure.

- [x] **Step 3: Manually verify in scratch org** (2026-06-05 — deployed to home-denispoc + verified bounds via Playwright editor project)

Deploy and open a Map containing a single L1 with one L2. Open the detail panel via second-click. Confirm:

- Panel right edge is flush with the LWC right edge.
- Panel top is at the LWC body top (just under the toolbar) — not floating over the SVG bounds.
- Panel full height equals the available LWC body height.
- In edit mode, Save and Cancel buttons are visible without internal panel scrolling on a normal-height viewport.

- [x] **Step 4: Commit** (2026-06-05)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html \
        force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css
git commit -m "fix(visualisation): anchor detail panel to LWC root, not canvas container (GH #41)"
```

---

## Task 2: Jest — structural regression guard

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Add a single test asserting the detail panel is NOT inside `.bcm-canvas-container`**

Add inside an existing `describe` covering the diagram structure (or add a new `describe('Detail panel anchoring')` block). The test asserts both:

1. `<c-bcm_-capability-detail>` exists in the shadow DOM.
2. `.bcm-canvas-container` does NOT contain it.

```js
it('Detail panel is anchored outside the canvas container', () => {
    // …existing element setup…
    const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
    const canvasContainer = element.shadowRoot.querySelector('.bcm-canvas-container');
    expect(panel).not.toBeNull();
    expect(canvasContainer).not.toBeNull();
    expect(canvasContainer.contains(panel)).toBe(false);
});
```

- [x] **Step 2: Run Jest**

```bash
npm run test:unit -- --testPathPattern=bcm_CapabilityMap
```

Confirm all existing tests still pass and the new test passes.

- [x] **Step 3: Commit** (2026-06-05)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): assert detail panel sits outside canvas container (GH #41)"
```

---

## Task 3: e2e — bounding-box containment

**Files:**

- Modify: `tests/e2e/capability-detail.spec.ts`

- [x] **Step 1: Add a new `test.describe` block "Detail panel — layout — editor project"**

Place it after the existing "Detail panel — edit + save — editor project" block. Use the existing seeded fixture (the seed for editor project guarantees at least one capability). The test should:

1. Open the diagram page.
2. Open the detail panel via the existing helper (second-click on a focused node, same pattern as other tests in this file).
3. Read the bounding box of the LWC root (`c-bcm_-capability-map`) and the bounding box of the detail panel (`c-bcm_-capability-detail .bcm-detail-panel[data-open="true"]`).
4. Assert `panel.right <= root.right + 1` and `panel.bottom <= root.bottom + 1` (1px tolerance for sub-pixel rounding).
5. Click the Edit button. Assert the Save and Cancel buttons are visible (`expect(saveBtn).toBeVisible()`).

Test name suggestion: `Panel stays inside LWC bounds and Save/Cancel are visible in edit mode`.

- [x] **Step 2: Run the e2e test locally**

```bash
npx playwright test tests/e2e/capability-detail.spec.ts -g "Panel stays inside LWC bounds"
```

Confirm it passes against the current branch (after Task 1 + 2 deployed to scratch).

- [x] **Step 3: Commit** (2026-06-05)

```bash
git add tests/e2e/capability-detail.spec.ts
git commit -m "test(e2e): assert detail panel within LWC bounds + Save/Cancel visible (GH #41)"
```

---

## Task 4: Spec — `docs/specs/diagram.md`

**Files:**

- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Add a new scenario under the existing Detail Panel area**

Place it adjacent to the "Second click opens Detail Panel" feature. Use the standard format already in the file:

```markdown
**Scenario: Detail Panel renders fully within the LWC bounds even when the diagram is small**

Given a Map containing a single L1 capability with one L2 child  
When the user opens the Detail Panel via second-click  
Then the panel's right edge does not extend past the LWC right edge  
And the panel's bottom edge does not extend past the LWC bottom edge  
And in edit mode the Save and Cancel buttons are visible without scrolling on a normal-height viewport

> Tested by: capability-detail.spec.ts — "Panel stays inside LWC bounds and Save/Cancel are visible in edit mode"; bcm_CapabilityMap.test.js — "Detail panel is anchored outside the canvas container"
```

- [x] **Step 2: Commit**

```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): add detail-panel containment scenario (GH #41)"
```

---

## Task 5: COSMIC FP doc — note exclusion

**Files:**

- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Add row to §6 Excluded Processes**

Append:

```markdown
| Detail panel anchored to LWC root (GH #41) | Pure CSS/HTML layout restructure. Panel is moved out of the SVG-sized canvas container into a host-anchored wrapper so it never visually clips on small diagrams. No new Entry, Exit, Read, or Write — same data movement as FP29 / FP30. |
```

- [x] **Step 2: Commit**

```bash
git add docs/design/99-cosmic-function-point-count.md
git commit -m "docs(cfp): exclude detail-panel anchoring fix from FP count (GH #41)"
```

---

## Task 6: Final verification + plan completion

- [x] **Step 1: Run full Jest suite** — `npm run test:unit`
- [x] **Step 2: Run full Playwright suite** — `npx playwright test`
- [x] **Step 3: Visually verify in scratch org** — small map (1 L1, 1 L2), open panel, enter edit mode, confirm right/bottom edges and Save/Cancel visibility (2026-06-05 — Playwright e2e in home-denispoc asserts both bounds)
- [x] **Step 4: Mark all checkboxes above complete with the date `(2026-06-05)`**
- [x] **Step 5: Tick the FP table row** — see [[feedback_mark_complete_fp_table]]; this fix has no FP row (excluded), so confirm the §6 row is in place and dated (2026-06-04)

---

## E2E Test Update Section

- **Spec files changed:** `docs/specs/diagram.md` — one new scenario under Detail Panel area.
- **Helpers changed:** none. Reuses existing second-click helper in `capability-detail.spec.ts`.
- **New navigation/interaction pattern:** none. Existing "open panel via second-click" + "click Edit button" flows. Only new e2e behaviour is bounding-box assertion via `boundingBox()` on `c-bcm_-capability-map` and `.bcm-detail-panel[data-open="true"]`.
- **New Jest behaviour:** structural assertion that the panel is not a descendant of `.bcm-canvas-container`.

---

## Function Point Table

No FP row. Layout-only fix; recorded in §6 Excluded Processes of `docs/design/99-cosmic-function-point-count.md` per Task 5.
