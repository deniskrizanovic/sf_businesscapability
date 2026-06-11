# Plan: Constrain horizontal pan (issue #72)

**Branch:** `sf_businesscapability-72` (to be created off `main` after #71 merges)
**Date:** 2026-06-11
**Reference plan:** `docs/plans/2026-06-11-10:00-issue-71-vertical-pan-clamp.md`

---

## Context

`bcm_CapabilityMap` has no left/right bounds on `_panX`. Users can drag the map sideways into empty space past the leftmost or rightmost L1 column. All pan code paths — drag, keyboard ArrowLeft/Right, wheel zoom-to-cursor — are unbounded horizontally. Zoom buttons can also strand `_panX` outside any reasonable range when zoom changes shrink the canvas.

The Y clamp landed in #71 with a content-relative formula (clamp on lowest L2 box + 60px peek under the chevron strip), because vertically there is a fixed overlay (L1 chevrons pinned to top) that defines a natural "content edge". Horizontally there is no such overlay — the map is bounded by the SVG container alone — so the X clamp goes back to a **container-relative** model with a small peek so the user always sees a sliver of content past the viewport edge.

L1 chevrons (`l1Transform`) and L2 content (`viewportTransform`) and the cross-cutting band (`bandTransform`) all share `panX`. Clamping `_panX` covers all three layers in one stroke.

---

## Decisions

- **Bound model:** container-relative + peek. `slack = _containerWidth − canvasWidth × _zoom`.
- **Peek:** reuse `PEEK_OFFSET = 60` (viewport-px) — same constant introduced for Y in #71. Promote to module-scope const if not already; share between `_clampPanX` and `_clampPanY`.
- **Unified clamp formula** (handles both content-overflows and content-fits cases):

    ```
    minX = Math.min(0, slack) − PEEK_OFFSET
    maxX = Math.max(0, slack) + PEEK_OFFSET
    ```

    - When content overflows (`slack < 0`): `minX = slack − PEEK`, `maxX = −0 + PEEK = PEEK` → drag right shows up to PEEK px of empty space on the left of canvas; drag left shows up to PEEK px on the right.
    - When content fits (`slack ≥ 0`): `minX = 0 − PEEK = −PEEK`, `maxX = slack + PEEK` → user can move the narrow map within the empty container width plus PEEK on either side.

- **Container width tracking:** ResizeObserver on `.bcm-canvas-container`, stored in `_containerWidth`. Setup in `renderedCallback` (lazy, once). Teardown in `disconnectedCallback`. Width-only — no `_containerHeight` needed since Y stays content-relative.
- **Clamp method:** new private `_clampPanX(panX)` mirroring shape of `_clampPanY`.
- **Clamp sites:** four — drag-to-pan, keyboard ArrowLeft/Right, wheel zoom-to-cursor, zoom in/out buttons. **Skip** `handleFitToWindow` — its centering math `(cw − dw·zoom) / 2` is provably in-bounds (`fitZoom ≤ cw/dw` ⇒ `dw·zoom ≤ cw` ⇒ `panX = slack/2 ∈ [0, slack] ⊂ [−PEEK, slack+PEEK]`). Adding a clamp there could subtly drift the centered position if the `_containerWidth` cache lags `getBoundingClientRect()`.

---

## Clamp formulae

```javascript
_clampPanX(panX) {
    const slack = this._containerWidth - this.canvasWidth * this._zoom;
    const minX = Math.min(0, slack) - PEEK_OFFSET;
    const maxX = Math.max(0, slack) + PEEK_OFFSET;
    return Math.max(minX, Math.min(maxX, panX));
}
```

`_clampPanY` (existing, unchanged from #71):

```javascript
_clampPanY(panY) {
    const PEEK_OFFSET = 60;
    const layoutL2 = this._layoutL2 || [];
    let lowestTop = 0;
    for (const n of layoutL2) {
        if (n.y > lowestTop) lowestTop = n.y;
    }
    const minY = Math.min(0, this.l2ClipY + PEEK_OFFSET - lowestTop * this._zoom);
    return Math.max(minY, Math.min(0, panY));
}
```

If `PEEK_OFFSET` is currently a function-local in `_clampPanY`, promote to module scope so `_clampPanX` shares it.

---

## Implementation tasks

| #   | Change                                                                                                                                      | File                        | Status         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------- |
| 1   | Promote `PEEK_OFFSET = 60` to module-scope const if currently inline in `_clampPanY`                                                        | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 2   | Add `_containerWidth = 0` and `_resizeObserver = null` fields                                                                               | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 3   | In `renderedCallback`, lazily attach ResizeObserver to `.bcm-canvas-container`; seed `_containerWidth` from `getBoundingClientRect().width` | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 4   | In `disconnectedCallback`, disconnect observer and null out the field                                                                       | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 5   | Add `_clampPanX(panX)` private method                                                                                                       | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 6   | Apply clamp in `handleSvgMouseMove` (drag-to-pan, X axis)                                                                                   | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 7   | Apply clamp in `handleKeyDown` ArrowLeft / ArrowRight branches                                                                              | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 8   | Apply clamp in `handleWheel` after zoom-to-cursor `panX` calculation                                                                        | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 9   | Apply clamp in `handleZoomIn` and `handleZoomOut` after zoom update                                                                         | `bcm_CapabilityMap.js`      | [x] 2026-06-11 |
| 10  | Add Jest unit tests for `_clampPanX` formula + each path                                                                                    | `bcm_CapabilityMap.test.js` | [x] 2026-06-11 |
| 11  | Update e2e: rewrite `"ArrowRight pan -> L2 transform translateX increases (no clip on right)"`; add 2 new clamp tests                       | `diagram.spec.ts`           | [x] 2026-06-11 |
| 12  | Update spec `diagram.md`: rewrite line 225 scenario to reflect bounded pan; add 2 new clamp scenarios                                       | `docs/specs/diagram.md`     | [x] 2026-06-11 |

---

## Function Point Table

No new functional process. Horizontal pan clamping is in-memory JS state mutation — same exclusion class as zoom/pan state and the Y clamp landed in #71 (§6 Excluded Processes in `docs/design/99-cosmic-function-point-count.md`). Total CFP unchanged.

---

## Step-by-step implementation

### Step 1 — Promote `PEEK_OFFSET`

If `PEEK_OFFSET = 60` is currently declared inside `_clampPanY`, lift it to the module-level constants block alongside `ZOOM_DEFAULT`, `PAN_STEP`, etc. Both clamp methods reference the same constant.

### Step 2 — `_containerWidth` field + ResizeObserver fields

```javascript
_containerWidth = 0;
_resizeObserver = null;
```

### Step 3 — ResizeObserver setup in `renderedCallback`

```javascript
renderedCallback() {
    if (this._resizeObserver) return;
    const container = this.template.querySelector('.bcm-canvas-container');
    if (!container) return;
    this._resizeObserver = new ResizeObserver((entries) => {
        this._containerWidth = entries[0].contentRect.width;
    });
    this._resizeObserver.observe(container);
    this._containerWidth = container.getBoundingClientRect().width;
}
```

If `renderedCallback` already exists for other purposes, fold the observer setup in — don't duplicate the method.

### Step 4 — Teardown

```javascript
disconnectedCallback() {
    if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
    }
    // ... existing teardown ...
}
```

### Step 5 — `_clampPanX` method

```javascript
_clampPanX(panX) {
    const slack = this._containerWidth - this.canvasWidth * this._zoom;
    const minX = Math.min(0, slack) - PEEK_OFFSET;
    const maxX = Math.max(0, slack) + PEEK_OFFSET;
    return Math.max(minX, Math.min(maxX, panX));
}
```

### Step 6 — Drag-to-pan (`handleSvgMouseMove`)

```javascript
handleSvgMouseMove(evt) {
    if (!this._isDragging) return;
    this._panX = this._clampPanX(this._panStartX + (evt.clientX - this._dragStartX));
    this._panY = this._clampPanY(this._panStartY + (evt.clientY - this._dragStartY));
}
```

### Step 7 — Keyboard (`handleKeyDown`)

```javascript
if (evt.key === 'ArrowLeft') this._panX = this._clampPanX(this._panX + PAN_STEP);
if (evt.key === 'ArrowRight') this._panX = this._clampPanX(this._panX - PAN_STEP);
```

### Step 8 — Wheel zoom-to-cursor (`handleWheel`)

```javascript
this._panX = this._clampPanX(mouseX - (mouseX - this._panX) * (newZoom / this._zoom));
this._panY = this._clampPanY(mouseY - (mouseY - this._panY) * (newZoom / this._zoom));
this._zoom = newZoom;
```

### Step 9 — Zoom buttons (`handleZoomIn`, `handleZoomOut`)

```javascript
handleZoomIn() {
    this._zoom = Math.min(ZOOM_MAX, Math.round((this._zoom + ZOOM_STEP) * 10) / 10);
    this._panX = this._clampPanX(this._panX);
    this._panY = this._clampPanY(this._panY);
}

handleZoomOut() {
    this._zoom = Math.max(ZOOM_MIN, Math.round((this._zoom - ZOOM_STEP) * 10) / 10);
    this._panX = this._clampPanX(this._panX);
    this._panY = this._clampPanY(this._panY);
}
```

### Step 10 — Jest unit tests

Add to `describe('BcmCapabilityMap zoom/pan state machine')`:

- `_clampPanX` returns input when within bounds
- content overflows (`canvasWidth × zoom > containerWidth`) → clamp to `[slack − PEEK, PEEK]`
- content fits (`canvasWidth × zoom ≤ containerWidth`) → clamp to `[−PEEK, slack + PEEK]`
- ArrowLeft past max → clamped to `maxX`
- ArrowRight past min → clamped to `minX`
- drag past either edge → clamped
- wheel zoom-to-cursor → resulting panX within `[minX, maxX]`
- zoom-in re-clamps `_panX`
- zoom-out re-clamps `_panX`

Test setup pattern: set `element._containerWidth` directly to a known value, load a layout with a known `canvasWidth`, set `element._zoom`, then drive the path under test.

### Step 11 — E2e tests (`tests/e2e/diagram.spec.ts`)

Rewrite existing test:

- `"ArrowRight pan -> L2 transform translateX increases (no clip on right)"` →
  rename to `"ArrowRight pan -> L2 transform translateX moves within horizontal bounds"`
  and assert clamp engages once `panX` reaches `maxX`.

Add new tests:

- `"Cannot pan past left edge — panX clamped to PEEK after repeated ArrowRight from origin"`
- `"Cannot pan past right edge — panX clamped after repeated ArrowLeft beyond canvas width"`
- (optional) `"Drag-to-pan respects horizontal bounds"` — drag past left edge, assert SVG transform translateX matches `maxX`.

### Step 12 — Spec update (`docs/specs/diagram.md`)

**Replace** lines 225–232 (current scenario `Pan in any direction updates the L2 viewport transform without clip`) with:

```markdown
**Scenario: Horizontal pan transforms reflect panX within bounds**

Given a map is loaded and the diagram is visible
When the user pans the diagram horizontally within the clamped range
Then the L2 layer `transform` attribute reflects the updated panX offset
And panning past the bound has no effect

> Tested by: diagram.spec.ts — "ArrowRight pan -> L2 transform translateX moves within horizontal bounds"
```

**Add** after the "Cannot pan below the bottom of the map" scenario (around line 248):

```markdown
**Scenario: Cannot pan past the left edge of the map**

Given the diagram is at pan origin (panX = 0)
When the user presses ArrowRight repeatedly
Then panX clamps at the left-peek bound — further right pan is blocked

> Tested by: diagram.spec.ts — "Cannot pan past left edge — panX clamped to PEEK after repeated ArrowRight from origin"; bcm_CapabilityMap.test.js — "ArrowRight at left edge is clamped"

**Scenario: Cannot pan past the right edge of the map**

Given the diagram canvas is wider than the viewport
When the user presses ArrowLeft until the rightmost columns reach the viewport edge
Then further ArrowLeft presses do not move the canvas

> Tested by: diagram.spec.ts — "Cannot pan past right edge — panX clamped after repeated ArrowLeft beyond canvas width"; bcm_CapabilityMap.test.js — "ArrowLeft at right edge is clamped"
```

**Leave alone:** lines 250 ("Zoom + pan compose correctly") and 565 ("ArrowLeft and ArrowRight are inverse operations") — both remain true within the un-clamped middle of the pan range; existing tests should still pass. Re-evaluate during implementation only if a test breaks.

---

## E2e changes summary

| File                        | Change                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `tests/e2e/diagram.spec.ts` | Rewrite 1 existing horizontal-pan test; add 2–3 new clamp tests                       |
| `docs/specs/diagram.md`     | Replace "Pan in any direction... no clip" scenario; add 2 new clamp scenarios for L/R |

Test infrastructure / helpers: no new fixtures required. Reuses existing diagram fixture pattern from #71. Navigation is unchanged — same editor project, same map load, same SVG locators.

---

## Open implementation risks

1. **`renderedCallback` re-entry under Salesforce rerenders.** The lazy guard `if (this._resizeObserver) return` makes the setup idempotent, but if the `.bcm-canvas-container` DOM node is replaced across rerenders, the observer keeps observing a detached node. If symptoms appear, switch to: re-querying the container each render and re-attaching only when `container !== this._observedContainer`.
2. **`_containerWidth` lag at first paint.** First `renderedCallback` runs after the SVG is in the DOM, so initial `_containerWidth` should be valid. If the SVG container starts at width 0 (e.g. parent flex hasn't laid out yet) while content is non-empty, `slack < 0` and the clamp range is the asymmetric `[slack − PEEK, +PEEK]` — over-permissive leftward, tight rightward, until the observer fires. Mitigation: ResizeObserver fires again as soon as layout settles, so this self-corrects within one frame. Acceptable.
3. **Cross-axis interaction with #71 Y clamp.** Both clamps are independent (different inputs, different formulae). Drag and wheel call both. No coupling expected; verify tests still pass for #71 after the X work lands.
