# Plan: L3 Focus Highlight (Background Rect + Bold Text)

**Date:** 2026-06-02
**Branch:** `sf_businesscapability-12`
**Issue:** [#12](https://github.com/deniskrizanovic/sf_businesscapability/issues/12)
**Parent:** #9

---

## Goal

Make focused L3 bullet visibly distinguishable. Currently `focusedNodeId` + `data-focused` set on click + keyboard nav, but no visual change. Add:

1. Blue-tint background `<rect>` behind the focused bullet text.
2. Bold `font-weight` on focused bullet text.
3. Reuse same palette as L1/L2 focus (`#E8F4FF` fill, `#0070D2` stroke).

Cleared on Escape, on focus moving to sibling/parent, or on clicking a different node.

---

## Decisions

| Decision | Choice |
|---|---|
| Where rect is emitted | Per-bullet in `bulletLines` (a `focusRect` field on the first line of the focused L3) |
| Why per-bullet, not per-L2 | Bullet `y` already known at emit time; keeps geometry localised; avoids `_layoutL3Map` round-trip |
| Continuation lines | Inherit `isFocused` from first line so bold applies to all wrapped lines of the focused bullet |
| Rect dimensions | `x = bulletBaseX - 4`, `y = bulletY - LINE_HEIGHT/2 + 2`, `width = COLUMN_WIDTH - BOX_PADDING*2 - 8`, `height = total wrapped lines * LINE_HEIGHT - 4` |
| Rect colours | Fill `#E8F4FF`, stroke `#0070D2`, stroke-width `1`, `rx=3` |
| Render order | `<rect>` before `<text>` so text sits on top — emit rect at the *first* bullet line of the focused L3 only; text continues to be rendered per line |
| Bold text | `font-weight="bold"` when `bullet.isFocused` truthy, else `"normal"` |

---

## Implementation Steps

### 1. `bcm_CapabilityMap.js` — `_buildLayout`

In the L3 bullet emission loop (around line 281–310):

- Compute `l3Focused` once per L3 (already done).
- For continuation lines (`wIdx > 0`), set `isFocused: l3Focused` (currently hard-coded `false`).
- On the first line only, emit a `focusRect` object when `l3Focused`:
  ```js
  focusRect: l3Focused ? {
    x: bulletBaseX - 4,
    y: bulletY,
    width: COLUMN_WIDTH - BOX_PADDING * 2 - 8,
    height: allLines.length * LINE_HEIGHT - 2,
  } : null,
  ```
  (`bulletY` value captured *before* the inner `forEach` increments it.)
- Add `fontWeight: l3Focused ? 'bold' : 'normal'` on every bullet line.

### 2. `bcm_CapabilityMap.html`

In the bullet `for:each` loop, render rect before text:

```html
<template for:each={node.bulletLines} for:item="bullet">
    <template if:true={bullet.focusRect}>
        <rect
            key={bullet.key}
            x={bullet.focusRect.x}
            y={bullet.focusRect.y}
            width={bullet.focusRect.width}
            height={bullet.focusRect.height}
            rx="3"
            fill="#E8F4FF"
            stroke="#0070D2"
            stroke-width="1"
            class="bcm-l3-focus-rect">
        </rect>
    </template>
    <text
        ...
        font-weight={bullet.fontWeight}>
        {bullet.text}
    </text>
</template>
```

(LWC requires unique `key` per `<template>` child — rect uses `bullet.key + '-rect'` if a sibling collision arises; both sit under the parent `<template for:each>` so the loop key is the bullet line key.)

Wait — LWC restriction: a `<template if:true>` inside a `for:each` must wrap a single keyed root or use the parent loop's key. Solution: emit the rect *outside* the `<template if:true>` by checking truthiness via a CSS-no-op when `null`, OR simpler — use a separate `for:each` over `node.bulletLines` filtered to focused bullets. Cleanest path: emit a sibling `<template if:true={bullet.focusRect}>` and give the rect its own key derived from `bullet.key`.

Actual LWC: `<template if:true>` inside `for:each` is allowed; rect key is `bullet.key + '-focus-rect'`. Both `<template if:true>` and `<text>` live under the loop iteration.

### 3. `docs/specs/diagram.md` line 282

Replace:
```
> Deferred: L3 focus rect is a JS invariant ...
```
with:
```
> Tested by: bcm_CapabilityMap.test.js — "Focused L3 bullet renders highlight rect", "Escape clears L3 focus rect", "ArrowDown moves L3 focus rect to next sibling"
```

### 4. Jest tests in `__tests__/bcm_CapabilityMap.test.js`

New `describe('BcmCapabilityMap L3 focus highlight rect')` block. Tests:

| Test | Assertion |
|---|---|
| Renders rect when L3 focused | After clicking L3-A1a, `shadowRoot.querySelector('rect.bcm-l3-focus-rect')` is not null |
| Rect cleared on Escape | After click + ArrowDown to sibling + Escape, no `rect.bcm-l3-focus-rect` |
| Rect moves on ArrowDown | After click L3-A1a + ArrowDown, rect's `y` attr ≠ original; only one rect rendered |
| Rect cleared when focus moves to L2 (ArrowUp from first L3) | After click L3-A1a + ArrowUp, no `rect.bcm-l3-focus-rect` |
| Bold text on focused bullet | Focused bullet `<text>` has `font-weight="bold"`; siblings have `font-weight="normal"` |

---

## E2E Test Update Section

**Spec changes:**
- `docs/specs/diagram.md` line 276–282: scenario "Focused L3 bullet shows highlight background rect" flipped from `Deferred` to `Tested by:` Jest assertion (LWC unit-level, not Playwright — diagram-level focus invariants are JS-emitted, easier to assert via shadow DOM than via Playwright pixel diff).

**Helper changes:** none. Existing Jest helpers (`getNode`, `clickNode`, `getL3TextNode`, `flushPromises`) cover this work.

**New navigation/interaction pattern:** none — the click-to-focus + arrow-nav flow already exists; this PR only adds visual feedback.

**Playwright impact:** none for now. If we later want screenshot regression on the rect, add to `tests/e2e/diagram.spec.ts` under a `@visual` tag — out of scope for this issue.

---

## Acceptance Criteria Mapping

| Criterion | Covered by |
|---|---|
| Click L3 → blue rect rendered | Test "Renders rect when L3 focused" |
| Bold focused L3 text | Test "Bold text on focused bullet" |
| ArrowDown moves rect | Test "Rect moves on ArrowDown" |
| ArrowUp from first L3 clears rect | Test "Rect cleared when focus moves to L2" |
| Escape clears rect | Test "Rect cleared on Escape" |
| Different L1/L2/L3 click clears prev | Implicit — clicking any other node sets `focusedNodeId`, `_buildLayout` re-runs, only the new focused L3 (if any) gets `focusRect`. Covered by sibling-move test. |
| Jest covers rect render/move/clear | All three tests above |
| Spec marker flipped | Step 3 |
| No L1/L2 regression | Existing tests in describe blocks "node click UX" and "keyboard navigation — L2 level" remain untouched |
| Plan file in `docs/plans/yyyy-mm-dd-HH:mm-l3-focus-highlight.md` | This file |

---

## Function Point Table

No new functional processes. Pure UI affordance on existing focus state. CFP unchanged at **119**.

---

## Sequence

1. Edit `_buildLayout` (JS) — emit `focusRect` + `fontWeight`.
2. Edit template (HTML) — render rect, bind `font-weight`.
3. Add Jest tests.
4. Update spec marker.
5. Run `npx jest force-app/main/default/lwc/bcm_CapabilityMap` — must pass.
6. Manual verify in scratch org (deferred until tests green).

---
