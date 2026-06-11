# Plan: Constrain vertical pan (issue #71)

**Branch:** `sf_businesscapability-71`  
**Date:** 2026-06-11

---

## Context

`bcm_CapabilityMap` has no upper/lower bounds on `_panY`. Users can drag the map into empty space above the top row or below the bottom row. All three pan code paths — drag, keyboard, wheel zoom-to-cursor — are unbounded. Zoom buttons also indirectly break bounds when they shrink the canvas.

L1 chevrons use `l1Transform` (Y always 0) — unaffected by panY. L2/L3 content uses `viewportTransform`. Cross-cutting band uses `bandTransform` (also includes panY) — it scrolls with content, so the same clamp covers it.

---

## Decisions

- Container height tracked via ResizeObserver → stored as `_containerHeight`
- Clamp implemented as private method `_clampPanY(panY)` on the component
- Applied to all four pan code paths: drag, keyboard, wheel, zoom buttons
- `maxY = 0` (map top at viewport top); `minY = containerHeight - canvasHeight * zoom` (map bottom at viewport bottom)
- When content fits in container: both min and max are 0 → panY locked to 0

---

## Clamp formula

```javascript
_clampPanY(panY) {
    const minY = Math.min(0, this._containerHeight - this.canvasHeight * this._zoom);
    return Math.max(minY, Math.min(0, panY));
}
```

---

## Implementation tasks

| #   | Change                                                                                                                                                     | File                        | Status                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------- |
| 1   | Add `_containerHeight = 0` field; set up ResizeObserver in `connectedCallback`, tear down in `disconnectedCallback`                                        | `bcm_CapabilityMap.js`      | [~] superseded — see Deviations |
| 2   | Add `_clampPanY(panY)` private method                                                                                                                      | `bcm_CapabilityMap.js`      | [x] 2026-06-11                  |
| 3   | Apply clamp in `handleSvgMouseMove` (drag-to-pan)                                                                                                          | `bcm_CapabilityMap.js`      | [x] 2026-06-11                  |
| 4   | Apply clamp in `handleKeyDown` ArrowUp/ArrowDown branches                                                                                                  | `bcm_CapabilityMap.js`      | [x] 2026-06-11                  |
| 5   | Apply clamp in `handleWheel` after zoom-to-cursor panY calculation                                                                                         | `bcm_CapabilityMap.js`      | [x] 2026-06-11                  |
| 6   | Apply clamp in `handleZoomIn` and `handleZoomOut` after zoom update                                                                                        | `bcm_CapabilityMap.js`      | [x] 2026-06-11                  |
| 7   | Update Jest unit tests: rename existing `— no clamp` tests; add clamp tests for each code path                                                             | `bcm_CapabilityMap.test.js` | [x] 2026-06-11                  |
| 8   | Update e2e tests: rewrite `ArrowDown pan -> free vertical pan` and `ArrowUp from origin` tests; add cannot-pan-above-top and cannot-pan-below-bottom tests | `diagram.spec.ts`           | [x] 2026-06-11                  |
| 9   | Update spec `diagram.md`: replace "Vertical pan is unrestricted" scenario with clamped scenarios                                                           | `docs/specs/diagram.md`     | [x] 2026-06-11                  |

---

## Function Point Table

No new functional process. Vertical pan clamping is in-memory JS state mutation — same exclusion class as zoom/pan state (§6 Excluded Processes in `docs/design/99-cosmic-function-point-count.md`). Total CFP unchanged.

---

## Step-by-step implementation

### Step 1 — ResizeObserver for container height

In `connectedCallback` (or after first render), query `.bcm-canvas-container` and attach a ResizeObserver:

```javascript
_containerHeight = 0;
_resizeObserver = null;

connectedCallback() {
    // ... existing code ...
}

renderedCallback() {
    if (this._resizeObserver) return;
    const container = this.template.querySelector('.bcm-canvas-container');
    if (!container) return;
    this._resizeObserver = new ResizeObserver((entries) => {
        this._containerHeight = entries[0].contentRect.height;
    });
    this._resizeObserver.observe(container);
    this._containerHeight = container.getBoundingClientRect().height;
}

disconnectedCallback() {
    if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
    }
}
```

### Step 2 — `_clampPanY` method

```javascript
_clampPanY(panY) {
    const minY = Math.min(0, this._containerHeight - this.canvasHeight * this._zoom);
    return Math.max(minY, Math.min(0, panY));
}
```

### Step 3 — Drag-to-pan

```javascript
handleSvgMouseMove(evt) {
    if (!this._isDragging) return;
    this._panX = this._panStartX + (evt.clientX - this._dragStartX);
    this._panY = this._clampPanY(this._panStartY + (evt.clientY - this._dragStartY));
}
```

### Step 4 — Keyboard

```javascript
if (evt.key === 'ArrowUp') this._panY = this._clampPanY(this._panY + PAN_STEP);
if (evt.key === 'ArrowDown') this._panY = this._clampPanY(this._panY - PAN_STEP);
```

### Step 5 — Wheel zoom-to-cursor

```javascript
this._panX = mouseX - (mouseX - this._panX) * (newZoom / this._zoom);
this._panY = this._clampPanY(mouseY - (mouseY - this._panY) * (newZoom / this._zoom));
this._zoom = newZoom;
```

### Step 6 — Zoom buttons

```javascript
handleZoomIn() {
    this._zoom = Math.min(ZOOM_MAX, Math.round((this._zoom + ZOOM_STEP) * 10) / 10);
    this._panY = this._clampPanY(this._panY);
}

handleZoomOut() {
    this._zoom = Math.max(ZOOM_MIN, Math.round((this._zoom - ZOOM_STEP) * 10) / 10);
    this._panY = this._clampPanY(this._panY);
}
```

### Step 7 — Jest unit tests

Update `describe('BcmCapabilityMap zoom/pan state machine')`:

- Rename `'ArrowUp pans diagram down (positive panY) — no clamp'` → verify clamped to 0 when at top
- Rename `'ArrowDown pans diagram up (negative panY) — no clamp'` → verify clamped when at bottom
- Add `_clampPanY` behaviour tests:
    - content taller than container → panY clamped to minY at bottom
    - content fits in container → panY locked to 0
    - drag path respects clamp
    - wheel path respects clamp
    - zoom-in button re-clamps panY

To test clamp, set `element._containerHeight` directly and load a layout with known `canvasHeight`.

### Step 8 — E2e tests (`diagram.spec.ts`)

Replace/update in `describe('Zoom & pan — editor project')`:

- `'ArrowDown pan -> L2 transform translateY decreases (free vertical pan, no clamp)'` → rename and assert clamp applies when canvas fills/exceeds viewport
- `'ArrowUp from origin -> positive panY (was previously clamped to 0)'` → remove or rewrite (panY=0 is now the correct maximum)
- Add: `'Cannot pan above top — panY stays at 0 after ArrowUp from origin'`
- Add: `'Cannot pan below bottom — panY clamped after ArrowDown beyond canvas height'`

### Step 9 — Spec update (`docs/specs/diagram.md`)

Replace lines 234–241 (Scenario: Vertical pan is unrestricted) with:

```markdown
**Scenario: Cannot pan above the top of the map**

Given the diagram is at pan origin (panY = 0)
When the user presses ArrowUp
Then panY remains 0 — further upward pan is blocked

> Tested by: diagram.spec.ts — "Cannot pan above top — panY stays at 0 after ArrowUp from origin"; bcm_CapabilityMap.test.js — "ArrowUp at top is clamped to 0"

**Scenario: Cannot pan below the bottom of the map**

Given the diagram canvas is taller than the viewport
When the user presses ArrowDown until the bottom capabilities reach the viewport edge
Then further ArrowDown presses do not move the canvas

> Tested by: diagram.spec.ts — "Cannot pan below bottom — panY clamped after ArrowDown beyond canvas height"; bcm_CapabilityMap.test.js — "ArrowDown at bottom is clamped to minY"
```

---

## E2e changes summary

| File                        | Change                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `tests/e2e/diagram.spec.ts` | Rewrite 2 existing pan tests; add 2 new clamp tests                   |
| `docs/specs/diagram.md`     | Replace "Vertical pan unrestricted" scenario with 2 clamped scenarios |

---

## Implementation deviations (commit `0178384`, 2026-06-11)

Two parts of the original plan changed during implementation. Recorded here so the plan reflects what shipped.

### 1. Clamp formula is content-relative, not container-relative

**Plan:** `minY = containerHeight − canvasHeight × zoom` (clamp to container edges via ResizeObserver-tracked `_containerHeight`).

**Shipped:** `minY = l2ClipY + PEEK_OFFSET − lowestL2Top × zoom` (clamp to _content geometry_, not the SVG viewport). Where `lowestL2Top` is the largest `n.y` across `_layoutL2`, and `PEEK_OFFSET = 60`.

Why:

- The container-edge clamp at zoom = 1 produced almost zero pan budget — content + container were similar height, so ArrowDown was effectively a no-op. The user reported the keyboard "did not work" until they clicked Zoom+ a few times. Each Zoom+ enlarged the canvas and opened a tiny new pan slice, then re-clamped.
- The user's stated intent was: "stop scrolling before the lowest L2 capability disappears under the L1 chevrons" — i.e. clamp on content edges, not viewport edges.
- A 60px peek offset leaves a small strip of higher content visible at the bottom-most pan position so the user retains a sense of "there's more above". Value chosen interactively.

Consequence: ResizeObserver / `_containerHeight` field is no longer needed (task #1 superseded). `_measureContainerHeight()` was removed.

### 2. Keyboard wiring moved off SVG to shadow-root + window

**Plan:** Pre-existing `tabindex="0"` + `onkeydown={handleKeyDown}` on the SVG element, unchanged.

**Shipped:** `onkeydown` removed from SVG. A bound `_handleRootKeyDown` is registered on both `this.template` and `window` in `connectedCallback`, removed in `disconnectedCallback`. A per-event `__bcmHandled` flag prevents double-processing when the same keydown reaches both listeners. The handler skips events whose `composedPath()` includes `<input>`, `<textarea>`, `<select>`, `<lightning-combobox>`, or `<lightning-input>` so toolbar typing is unaffected, and bails early if the SVG is not in the DOM.

Why:

- Relying on SVG focus was unreliable. After page reload nothing claimed focus → arrows did nothing. After clicking a toolbar button (e.g. Reset View, Zoom+) focus moved to the button and the next rerender could swap the button DOM node, dropping focus again. Symptom: user could only press one arrow per Zoom+ click.
- A short-lived attempt to refocus the SVG on click and via `renderedCallback` did not survive Salesforce's rerenders.
- Listening at the shadow root + window decouples keyboard nav from any one element holding focus; the input-skip guard preserves typing behaviour in toolbar comboboxes.

Consequence: tests dispatch `KeyboardEvent` against the SVG with `bubbles: true` (no `composed: true`), which now reaches the listener via the shadow-root path; behaviour is preserved.
