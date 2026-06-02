# Plan: Clear L2 highlight when clicking off node onto canvas

**Date:** 2026-06-02
**Issue:** [#15](https://github.com/deniskrizanovic/sf_businesscapability/issues/15)

---

## Goal

When an L2 (or L1/L3) capability is focused, clicking on empty SVG canvas should clear the highlight — `isFocused` / `fill` / `strokeColour` / `strokeWidth` revert to defaults and `data-focused` on the previously-focused `<g>` is no longer `"true"`.

Current bug: `handleSvgMouseDown` sets `this.focusedNodeId = null` but never rebuilds the layout, so derived fields on the layout nodes stay stale until the next rebuild (e.g. zoom in, map switch).

---

## Root cause

`force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js:472-482` — handler clears `focusedNodeId` and `_keyNavMode`, starts pan tracking, but does not call `_buildLayout(this._capabilities)`. Other focus transitions (`handleNodeClick`, `_navigateFromKey`, `Escape` in `handleKeyDown`) all rebuild explicitly.

---

## Decisions

| Decision | Choice |
|---|---|
| Where to rebuild | `handleSvgMouseDown`, only if a node was focused before the click — avoids unnecessary rebuild on every pan-start drag |
| Pan still works | Pan state (`_isDragging`, `_dragStartX/Y`, `_panStartX/Y`) set unconditionally as before |
| L1/L3 also benefit | Same fix clears any focused level — no level-specific branching needed |
| Spec marker | New scenario under existing **Feature: Node click UX — focus then menu**. Tested-by jest tests |

---

## Implementation Steps

### 1. `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

Modify `handleSvgMouseDown` (line 472):

```js
handleSvgMouseDown(evt) {
    if (evt.target.closest('.bcm-node')) return;
    const hadFocus = this.focusedNodeId !== null;
    this.focusedNodeId      = null;
    this.contextMenuVisible = false;
    this._keyNavMode = false;
    if (hadFocus) this._buildLayout(this._capabilities);
    this._isDragging = true;
    this._dragStartX = evt.clientX;
    this._dragStartY = evt.clientY;
    this._panStartX  = this.panX;
    this._panStartY  = this.panY;
}
```

### 2. Jest tests — append to `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

New `describe('BcmCapabilityMap canvas click clears focus', ...)` block:

| Test | Assertion |
|---|---|
| Clicking SVG background after focusing L2 clears `data-focused` | Click L2, mousedown SVG bg, `[data-node-id="L2-A1"]` `data-focused !== 'true'` |
| Clicking SVG background after focusing L2 reverts strokeColour | Inspect layout-derived `<rect stroke>` matches default `#CCCCCC` |
| Clicking SVG background while no node focused does not throw | Just dispatch mousedown on bare canvas |
| Pan still works after canvas mousedown | mousedown -> mousemove -> panX changes |

### 3. Spec — `docs/specs/diagram.md`

Add scenario under **Feature: Node click UX — focus then menu**:

```
**Scenario: Clicking empty canvas background clears node focus**

Given a node is focused
When the user clicks on empty SVG canvas (not on any node)
Then focus is cleared and the node returns to its unfocused visual state

> Tested by: bcm_CapabilityMap.test.js — "Canvas mousedown clears L2 highlight", "Canvas mousedown with no focus is a no-op", "Pan still works after canvas mousedown"
```

---

## E2E Test Update Section

**Spec changes:** New scenario in `docs/specs/diagram.md` under **Feature: Node click UX — focus then menu** — Tested-by Jest tests added in this slice.

**Helper changes:** None.

**New navigation/interaction pattern:** Canvas-background click is already a recognised gesture (pan-start). This adds a side-effect (clear focus) that was already present in state but invisible due to missing rebuild. No new e2e helper.

**Playwright file changes:** None — Jest covers the layout invariant. Pan + canvas click in Playwright is deferred (existing scenario for pan in spec is already `> Deferred:`).

---

## Step complete checklist (manual)

- [ ] Focus an L2, click empty area to right of last column — highlight clears immediately
- [ ] Focus an L1 chevron, click empty area below — highlight clears
- [ ] Focus an L3 bullet, click empty area — focus rect disappears
- [ ] Pan still works (drag from empty area)
- [ ] No console errors in unfocused canvas-click
