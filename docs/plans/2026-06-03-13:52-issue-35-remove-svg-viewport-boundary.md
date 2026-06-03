# Issue #35 — Remove SVG Viewport Boundary so Pan/Zoom Doesn't Clip

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capability map diagram remains fully visible regardless of pan or zoom. Drop the implicit `<svg>` clipping rectangle (it's bound to `canvasWidth`/`canvasHeight` which are sized for the *initial* layout, not for translated/scaled content). Also remove the asymmetric `panY <= 0` clamp so users can pan in all four directions.

**Architecture:**
1. **CSS** — add `overflow: visible` to `.bcm-canvas`. The SVG element retains its `width`/`height` attributes (so the surrounding container still allocates layout space and `Fit to Window` math is unchanged), but content drawn past those bounds is no longer clipped.
2. **JS** — drop the three `Math.min(0, …)` clamps on `panY` (in `handleSvgMouseMove`, `handleWheel`, `handleKeyDown`). After this change pan can go positive and negative in Y. `panX` had no clamp; remains unchanged.

The L1 chevron `<g>` keeps `translate(panX, 0)` (no Y component) so the chevron band still does NOT move vertically — that behaviour is independent of the panY clamp.

**Tech Stack:** LWC CSS (`bcm_CapabilityMap.css`), LWC JS (`bcm_CapabilityMap.js`), Jest (`__tests__/bcm_CapabilityMap.test.js`), Playwright (`tests/e2e/diagram.spec.ts`).

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — add `overflow: visible` to `.bcm-canvas`
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — drop three `Math.min(0, …)` panY clamps
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — replace existing `Math.min(0, …)` assertions with free-pan assertions; add a new test for ArrowUp at panY=0 going positive
- **Modify** `tests/e2e/diagram.spec.ts` — add three pan/zoom visibility tests
- **Modify** `docs/specs/diagram.md` — update the existing pan section + add new scenarios

**No new FP — purely visual / pan-state changes. Same exclusion class as zoom/pan visual state (§6 Excluded Processes).**

---

## Task 1: CSS — drop SVG clip

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`

- [x] **Step 1: Add `overflow: visible` to `.bcm-canvas`** (2026-06-03)

Update the existing `.bcm-canvas` selector block:

```css
.bcm-canvas {
    display: block;
    overflow: visible;
    cursor: grab;
}
```

The container `.bcm-canvas-container` keeps its `overflow: auto` so the user can still scroll if the page-level layout makes the diagram exceed the visible area.

- [ ] **Step 2: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css
git commit -m "fix(visualisation): allow SVG content past canvas bounds (GH #35)"
```

---

## Task 2: JS — free vertical pan

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- [x] **Step 1: Drop panY clamp in `handleSvgMouseMove`** (2026-06-03)

Replace:
```js
this.panY = Math.min(0, this._panStartY + (evt.clientY - this._dragStartY));
```
with:
```js
this.panY = this._panStartY + (evt.clientY - this._dragStartY);
```

- [x] **Step 2: Drop panY clamp in `handleWheel`** (2026-06-03)

Replace:
```js
this.panY    = Math.min(0, mouseY - (mouseY - this.panY) * (newZoom / this.zoom));
```
with:
```js
this.panY    = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
```

- [x] **Step 3: Drop panY clamp in `handleKeyDown`** (2026-06-03)

Replace:
```js
if (evt.key === 'ArrowUp')    this.panY = Math.min(0, this.panY + PAN_STEP);
if (evt.key === 'ArrowDown')  this.panY += -PAN_STEP;
```
with:
```js
if (evt.key === 'ArrowUp')    this.panY += PAN_STEP;
if (evt.key === 'ArrowDown')  this.panY -= PAN_STEP;
```

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js
git commit -m "fix(visualisation): drop panY<=0 clamp -> free vertical pan (GH #35)"
```

---

## Task 3: Jest — adjust pan tests

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Add new test asserting ArrowUp from origin moves panY positive** (2026-06-03)

Inside the `describe` that owns the `'Pan still works after canvas mousedown'` test (BcmCapabilityMap node click UX block, around line 624), add:

```js
it('ArrowUp pans diagram down (positive panY) — no clamp', async () => {
    expect(element.panY).toBe(0);
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await flushPromises();
    expect(element.panY).toBe(50);
});

it('ArrowDown pans diagram up (negative panY) — no clamp', async () => {
    expect(element.panY).toBe(0);
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flushPromises();
    expect(element.panY).toBe(-50);
});
```

(Use the same `svg` and `element` references already wired in that describe block. If `svg` isn't bound in this scope, dispatch via `element.shadowRoot.querySelector('svg.bcm-canvas')`.)

- [x] **Step 2: Run Jest suite** (2026-06-03 — 83/83 passed)

```
npm test
```

Expected: all existing tests still pass; two new tests pass.

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(unit): assert free vertical pan no longer clamped (GH #35)"
```

---

## Task 4: e2e — pan visibility specs

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Add three new tests inside `Zoom & pan — editor project` describe** (around line 167) (2026-06-03)

Append after the `'Reset View restores default scale(1)'` test, before the closing `});`:

```typescript
test('Pan right past initial canvas keeps far-right L1 in viewport', async ({ page }) => {
    await openDiagram(page);
    await selectMapFromCombobox(page);
    const svg = page.locator('svg.bcm-canvas');
    const farRight = page.locator('.bcm-canvas g.bcm-node[data-node-level="1"]').last();
    await expect(farRight).toBeVisible();

    // Drag-pan right by 400px
    const box = await svg.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    const startX = box.x + 50;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 400, startY, { steps: 10 });
    await page.mouse.up();

    // Far-right L1 chevron is still in the rendered DOM and has positive bounding-box width
    const rect = await farRight.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBeGreaterThan(0);
});

test('Pan down keeps bottom L2 box in viewport (no clip)', async ({ page }) => {
    await openDiagram(page);
    await selectMapFromCombobox(page);
    const svg = page.locator('svg.bcm-canvas');

    const box = await svg.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height - 50;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 300, { steps: 10 });
    await page.mouse.up();

    const lastL2 = page.locator('.bcm-canvas g.bcm-node[data-node-level="2"]').last();
    const rect = await lastL2.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.height).toBeGreaterThan(0);
});

test('Zoom in then pan right keeps far-right L1 visible', async ({ page }) => {
    await openDiagram(page);
    await selectMapFromCombobox(page);
    // Zoom in twice
    await page.getByTitle('Zoom In').click();
    await page.getByTitle('Zoom In').click();

    const svg = page.locator('svg.bcm-canvas');
    const box = await svg.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    const startX = box.x + box.width - 50;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 500, startY, { steps: 10 });
    await page.mouse.up();

    const farRight = page.locator('.bcm-canvas g.bcm-node[data-node-level="1"]').last();
    const rect = await farRight.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBeGreaterThan(0);
});
```

- [x] **Step 2: Verify e2e file is syntactically valid** (2026-06-03 — 3 new tests listed)

```
npx playwright test tests/e2e/diagram.spec.ts --list
```

Expected: three new test names appear in the list, no compile errors.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): pan/zoom visibility regression coverage (GH #35)"
```

---

## Task 5: Spec — update `docs/specs/diagram.md`

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Replace the existing "Click-drag on the background pans the diagram" Deferred row + add new scenarios in `Feature: Zoom and pan work correctly`** (2026-06-03)

Replace the single deferred scenario with three Tested-by scenarios:

```markdown
**Scenario: Click-drag on the background pans the diagram in any direction**

Given a map is loaded and the diagram is visible  
When the user clicks and drags on the diagram background (not on a node)  
Then the diagram content moves in the direction of the drag  
And content beyond the initial canvas bounds remains visible (no clip at SVG edge)  

> Tested by: diagram.spec.ts — "Pan right past initial canvas keeps far-right L1 in viewport", "Pan down keeps bottom L2 box in viewport (no clip)"

**Scenario: Vertical pan is unrestricted in both directions**

Given the diagram is at pan origin (panY = 0)  
When the user presses ArrowUp or drags the diagram downward  
Then the diagram pans freely in the positive-Y direction  
And no clamp pins panY to ≤ 0  

> Tested by: bcm_CapabilityMap.test.js — "ArrowUp pans diagram down (positive panY) — no clamp", "ArrowDown pans diagram up (negative panY) — no clamp"

**Scenario: Zooming in then panning keeps content visible across the canvas bounds**

Given the user has zoomed in and parts of the diagram extend past the initial canvas right edge  
When the user pans right  
Then the previously off-screen rightmost L1 / L2 / L3 nodes become visible  

> Tested by: diagram.spec.ts — "Zoom in then pan right keeps far-right L1 visible"
```

Also update the existing "L1 chevrons stay pinned during vertical pan" scenario coverage to reflect that the L1 layer still uses `translate(panX, 0)` (no Y component) — no change needed, just verify the scenario still reads correctly after task 2.

- [ ] **Step 2: Commit**

```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): document free pan + no-clip behaviour (GH #35)"
```

---

## Task 6: Note exclusion in COSMIC FP doc

**Files:**
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Add row to §6 Excluded Processes table** (2026-06-03)

Append after the "Canvas focus outline suppression" row in the §6 Excluded Processes table:

```markdown
| SVG viewport boundary removal / free pan | CSS overflow change + removal of pan clamps; no data movement crosses the software boundary. Same exclusion class as zoom/pan visual state. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/99-cosmic-function-point-count.md
git commit -m "docs(cfp): exclude svg-viewport-boundary removal from FP count (GH #35)"
```

---

## Task 7: Final verification + plan completion

- [x] **Step 1: Run full Jest suite** (2026-06-03 — 83/83 passed)

```
npm test
```

Expected: all existing tests still pass; two new tests pass; total count = previous total + 2.

- [x] **Step 2: Mark plan steps complete** (2026-06-03)

Tick every `- [ ]` checkbox above to `- [x]` (with completion date).

- [ ] **Step 3: Push branch**

```bash
git push -u origin sf_businesscapability-35
```

- [ ] **Step 4: Open PR (do NOT auto-merge)**

```bash
gh pr create --title "fix: remove SVG viewport boundary, free pan in all directions (GH #35)" --body "$(cat <<'EOF'
## Summary
- Add `overflow: visible` to `.bcm-canvas` -> SVG no longer clips translated/scaled content
- Drop three `Math.min(0, …)` clamps on `panY` (mouse drag, wheel zoom, ArrowUp keydown) -> free vertical pan
- L1 chevron band still pans X-only (independent of panY clamp removal)

## Test plan
- [ ] `npx playwright test tests/e2e/diagram.spec.ts -g "Pan right past initial"` against scratch org
- [ ] `npx playwright test tests/e2e/diagram.spec.ts -g "Pan down keeps bottom L2"` against scratch org
- [ ] `npx playwright test tests/e2e/diagram.spec.ts -g "Zoom in then pan right"` against scratch org
- [ ] Manual: pan in all four directions; no clip, no rubber-band on panY

Closes #35
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** All issue-#35 acceptance criteria mapped — pan right (T4 e2e), pan down (T4 e2e), pan up past origin (T3 unit + T5 spec), zoom-in pan-right (T4 e2e), Reset/Fit unchanged (no JS in those handlers touched), L1 horizontal-only pan unchanged (still `translate(panX, 0)` — no code change needed).
- **Why not change `canvasWidth`/`canvasHeight`:** keeping them stable means `Fit to Window` math (`cw / dw`, `ch / dh`) and the container scrollbars all keep working; only the *clip* changes.
- **Why kill all three clamps:** issue spec calls them out by name (`handleSvgMouseMove`, `handleWheel`, `handleKeyDown`). The wheel-zoom clamp also produced a subtle bug — zoom-toward-cursor moved panY into the negative band, then snapped back to 0, jittering the diagram.
- **FP table:** No new FP. Excluded-processes table updated in T6. [[feedback_mark_complete_fp_table]] — no FP row to tick.
- **Placeholder scan:** Clean — no TBD / TODO.
