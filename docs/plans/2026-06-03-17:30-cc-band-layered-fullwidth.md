# Cross-cutting band — full-width layered chevrons

> **Status:** Completed 2026-06-03 — refines the band visual delivered by issue #30. No new FP (re-layout only). Manual smoke + deploy still required by user.

> **Design source:** `docs/prototypes/2026-06-03-cross-cutting-band.html` variant D — overlapping layered full-width chevrons with bottom-aligned, left-aligned uppercase labels.

## Context

Issue #30 landed the band layer (cross-cutting L1s pinned to bottom of canvas). Initial render used a row of column-width chevrons. Prototype variant D wins: each cc L1 spans full diagram width (first column → last column), rows stack with vertical overlap so each row's bottom strip is visible below the next, label sits bottom-left in uppercase. SortOrder 1 renders on top of the stack.

Out of scope: any change to band click behaviour, focus / nav, or column-area layout.

---

## Architecture

**Band geometry** (replace logic at `bcm_CapabilityMap.js` lines ~441-476):

- Width: each band chevron spans `COL_AREA_W = colCount*COLUMN_WIDTH + (colCount-1)*COLUMN_GAP`, anchored at `x = DIAGRAM_PADDING`.
- Height per row: reuse `CHEVRON_HEIGHT`.
- Overlap: new constant `BAND_ROW_OVERLAP = 12`.
- Notch: `BAND_NOTCH = CHEVRON_NOTCH * 2 = 32` (deeper because chevron is wider).
- Stack order: `ccRoots[0]` (smallest SortOrder) renders on top; iterate ccRoots in reverse when pushing so bandNodes[0] is bottom-most (drawn first → painted behind).
- Palette per row: `['#1a3d6b','#2b4f7a','#3f6492','#587bad']` indexed by original cc position; cycles past 4.
- Label: single line, full Name uppercased, left-aligned 18px from chevron start, baseline 8px above row bottom (`y + h - 8`), font-size 13, font-weight 700, letter-spacing 0.4, fill `#fff`.

**canvasHeight** (line ~177) — band reserved height becomes `nrows*CHEVRON_HEIGHT - (nrows-1)*BAND_ROW_OVERLAP + BOX_GAP` instead of single-row reservation.

**canvasWidth** — band naturally fits inside `colWidth`; remove the per-cc-col bandWidth calc, keep `Math.max(colWidth, 600)`.

**Template** — replace band `<g>` block in `bcm_CapabilityMap.html` (lines 180-204):
- Polygon `fill={node.fill}` and `stroke="#0e2342"` `stroke-width="1.2"`.
- Single `<text>` (no inner `for:each`) with `x={node.labelX}` `y={node.labelY}` `dominant-baseline="alphabetic"` `font-size="13"` `font-weight="700"` `letter-spacing="0.4"` `fill="#FFFFFF"`. No `text-anchor` (default = start = left).
- Text content `{node.label}` (already uppercased in JS).

**No CSS change required.**

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — new constants, rewrite `_layoutBand` block.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — band template `<text>` attrs + single-line label.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — assertion that band polygon spans canvasWidth area; SortOrder 1 is last in band DOM (top of stack).
- **Modify** `tests/e2e/diagram.spec.ts` — extend cross-cutting test to seed two cc L1s and assert both render, plus the polygon `points` attribute width spans full column area.
- **Modify** `docs/specs/diagram.md` — extend Cross-cutting band section: full-width spans, stacked overlap, sort order on top.

E2e: existing `Cross-cutting Foo ${RUN_ID}` already created; add a second `Cross-cutting Bar ${RUN_ID}` with sort order 100 to verify stacking. New test asserts:
- both `g.bcm-band-node` rendered.
- the second-rendered (DOM-last) band node's `data-node-name` matches the lowest-sort-order cc (rendered on top of stack).

---

## Task 1: JS layout

**Files:** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- [x] Add constants `BAND_ROW_OVERLAP = 12`, `BAND_NOTCH = CHEVRON_NOTCH * 2`, `BAND_PALETTE = ['#1a3d6b','#2b4f7a','#3f6492','#587bad']`, `BAND_LABEL_PAD_X = 18`, `BAND_LABEL_PAD_BOTTOM = 8` near other layout constants.
- [x] Rewrite the `// Build cross-cutting band` section: compute `bandFullWidth = (this._l1Roots?.length ? this._l1Roots.length * COLUMN_WIDTH + (this._l1Roots.length - 1) * COLUMN_GAP : COLUMN_WIDTH)` (use regularRoots count post-hidden filter if needed; simplest = total regularRoots, since hidden cols still consume space when showHidden is on — match what `canvasWidth` uses by deriving from `COL_AREA_W`).
- [x] Iterate ccRoots in reverse, push entries with `id, name, label = name.toUpperCase(), points, fill, labelX = x + BAND_LABEL_PAD_X, labelY = y + h - BAND_LABEL_PAD_BOTTOM` so bandNodes[0] = bottom row.
- [x] Update `canvasHeight` getter band reservation: `nrows > 0 ? nrows*CHEVRON_HEIGHT - (nrows-1)*BAND_ROW_OVERLAP + BOX_GAP : 0`.
- [x] Simplify `canvasWidth` band term: `bandWidth = ccRoots > 0 ? colWidth : 0` (band rides on column area width); the `Math.max(colWidth, bandWidth)` collapse means just keep `colWidth`. Drop unused `_ccRootCount`-based extra-cols arithmetic.

## Task 2: Template

**Files:** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- [x] Replace inner `<polygon>` with `fill={node.fill}` (was hardcoded `#4A4A4A`).
- [x] Update polygon stroke to `#0e2342`, stroke-width `1.2`.
- [x] Replace `<template for:each={node.labelLines}>` with single `<text>` using `x={node.labelX}` `y={node.labelY}` `dominant-baseline="alphabetic"` `font-size="13"` `font-weight="700"` `letter-spacing="0.4"` `fill="#FFFFFF"` containing `{node.label}`.

## Task 3: Jest test

**Files:** `__tests__/bcm_CapabilityMap.test.js`

- [x] Extend existing `CAPS_DATA_WITH_CC` fixture with a second cc L1 `L1-CC2` with `bcm_SortOrder__c: 100` (lower priority). Keep `L1-CC` at sort 99.
- [x] Add test "Lowest-SortOrder cross-cutting renders on top of band stack": query `.bcm-band-node`, assert last in DOM order is `L1-CC` (sort 99).
- [x] Add test "Band chevron spans full diagram width": parse the polygon `points` attribute, first vertex x = `DIAGRAM_PADDING`, last `x` value reaches `canvasWidth - DIAGRAM_PADDING`.

## Task 4: Playwright

**Files:** `tests/e2e/diagram.spec.ts`

- [x] Extend the cross-cutting Apex flag step to also flag `Cross-cutting Bar ${RUN_ID}` (seed it as a regular L1 first if not already present; reuse existing JSON shape).
- [x] Add test "Cross-cutting band renders with overlap and sort order": assert two `g.bcm-band-node` exist; the DOM-last one has `data-node-name` = the lowest sort-order cc name.

## Task 5: Spec update

**Files:** `docs/specs/diagram.md`

- [x] Update Cross-cutting band section with two new scenarios: "Band chevrons span the full diagram width (first column to last column)" and "Lowest-SortOrder cross-cutting capability renders on top of the layered stack". Both with `> Tested by:` markers referencing the new tests.

## Task 6: Verification

- [x] `npm test` — 90/90 passing
- [ ] `sf project deploy start` — to be run by user
- [ ] Manual: load map with ≥2 cc L1s → verify full-width spans, stacking, label readable.
- [x] Tick all `- [x]` and add completion date; FP table unchanged (re-layout only, no new movement).

---

## Self-Review Notes

- No new FP — pure SVG re-layout of band data already loaded via `getCapabilities` (FP2). Existing FP exclusion row in §6 covers this.
- No data-model change. No Apex change. No new permission.
- Stack order: drawing reverse-order ensures sort-order 1 paints last → on top. Palette index keeps the darkest shade on top regardless of stack count.
- Width: band width tracks `canvasWidth - 2*DIAGRAM_PADDING`; if regular columns expand, band expands with them; if zero regular columns (cc-only), band falls back to canvas floor (600 - 2*pad).
