# Plan: "View detail" menu item — wire L1/L2/L3 + viewdetail event

**Date:** 2026-06-02
**Issue:** [#14](https://github.com/deniskrizanovic/sf_businesscapability/issues/14)
**Parent:** Detail Panel work — see `docs/plans/2026-06-02-09:48-capability-detail-panel.md`

---

## Goal

`bcm_ContextMenu` currently gates the "View detail" item behind `<template if:true={isL3}>`, so L1/L2 nodes get a menu with only "Hide". Spec (`docs/specs/diagram.md` Feature: Context menu actions — _View detail opens the Detail Panel_) requires the item on **all three levels**.

This slice only wires the menu item + event. Panel rendering, breadcrumb, field display all live in the follow-up Detail Panel slice.

---

## Decisions

| Decision               | Choice                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop `isL3` gate?      | Yes — render "View detail" unconditionally                                                                                                                                                                                             |
| Event name             | `viewdetail` (lowercase, single word — matches LWC custom-event style used elsewhere, e.g. `close`)                                                                                                                                    |
| Event payload          | `detail: { id, level, name }` sourced from existing `node` prop                                                                                                                                                                        |
| Parent handler         | `handleViewDetail` — no-op stub (closes menu via existing `handleContextMenuClose` flow). Panel wiring is follow-up work.                                                                                                              |
| Menu close after click | Preserve existing behaviour — fire `viewdetail` first, then `_close()`                                                                                                                                                                 |
| Spec marker            | Add new sub-scenario "View detail menu item is rendered for all levels" Tested-by Jest tests added in this slice. The umbrella scenario "View detail opens the Detail Panel" stays Tested-by `capability-detail.spec.ts` (panel work). |

---

## Implementation Steps

### 1. `force-app/main/default/lwc/bcm_ContextMenu/bcm_ContextMenu.html`

- Remove `<template if:true={isL3}>` wrapper around the View detail `<li>`.
- Item is now rendered for every node level.

### 2. `force-app/main/default/lwc/bcm_ContextMenu/bcm_ContextMenu.js`

- Replace stub `handleViewDetail` with:
    ```js
    handleViewDetail() {
        this.dispatchEvent(new CustomEvent('viewdetail', {
            detail: {
                id   : this.node?.id,
                level: this.node?.level,
                name : this.node?.name,
            },
        }));
        this._close();
    }
    ```
- `isL3` getter remains — harmless (may be removed if no other consumer).

### 3. `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- Add `onviewdetail={handleViewDetail}` to `<c-bcm_-context-menu>`.

### 4. `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- Add stub:
    ```js
    handleViewDetail(/* evt */) {
        // Detail panel wired in follow-up issue
        this.contextMenuVisible = false;
    }
    ```

### 5. Jest tests — new file `force-app/main/default/lwc/bcm_ContextMenu/__tests__/bcm_ContextMenu.test.js`

| Test                                                                    | Assertion                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Renders "View detail" item for L1 node                                  | After mount with `node.level=1`, `<li>` text contains "View detail" |
| Renders "View detail" item for L2 node                                  | Same with level=2                                                   |
| Renders "View detail" item for L3 node                                  | Same with level=3 (regression)                                      |
| Click "View detail" with L1 fires `viewdetail` w/ `{id, level:1, name}` | Spy on event; payload matches                                       |
| Click "View detail" with L2 fires event w/ correct payload              | Same with level=2                                                   |
| Click "View detail" with L3 fires event w/ correct payload              | Same with level=3                                                   |
| Click "View detail" also fires `close`                                  | Close listener triggered                                            |
| Click "Hide" still fires `close` for all levels (regression)            | Existing behaviour preserved                                        |

### 6. Spec — `docs/specs/diagram.md`

Add a new scenario under **Feature: Context menu actions** (just before the existing "View detail opens the Detail Panel"):

```
**Scenario: View detail menu item is rendered for L1, L2, and L3 nodes**

Given the context menu is open for any capability node
Then the menu shows a "View detail" item

> Tested by: bcm_ContextMenu.test.js — "Renders View detail for L1", "Renders View detail for L2", "Renders View detail for L3"
```

The existing umbrella scenario ("View detail opens the Detail Panel") is unchanged — its Tested-by points at `capability-detail.spec.ts`, which lands in the follow-up.

---

## E2E Test Update Section

**Spec changes:**

- `docs/specs/diagram.md` — adds one new scenario inside _Feature: Context menu actions_ (item visibility) Tested-by Jest. Umbrella scenario already exists and stays pointed at the panel slice.

**Helper changes:** none. Existing `createElement`/`shadowRoot.querySelector` patterns in `bcm_CapabilityMap.test.js` apply directly to the new `bcm_ContextMenu.test.js` file.

**New navigation/interaction pattern:** none. The double-click → menu → click-item interaction is unchanged; only the rendered item set + an event dispatch are new.

**Playwright impact:** none in this slice. The follow-up Detail Panel slice will add `tests/e2e/capability-detail.spec.ts` and assert the panel opens when the item is clicked — that test will exercise this slice's wiring end-to-end.

---

## Acceptance Criteria Mapping

| Criterion                                                                 | Covered by                                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| "View detail" menu item rendered for L1, L2, L3                           | Step 1 (HTML) + Jest "Renders View detail for L1/L2/L3"                           |
| `handleViewDetail` dispatches `viewdetail` event with payload from `node` | Step 2 + Jest "Click View detail fires viewdetail w/ correct payload"             |
| Menu still closes after click                                             | Step 2 (existing `_close()` retained) + Jest "Click View detail also fires close" |
| Parent `bcm_CapabilityMap` adds `onviewdetail` handler                    | Steps 3–4                                                                         |
| Jest test: L1 fires viewdetail w/ payload                                 | Step 5                                                                            |
| Jest test: L2 fires viewdetail w/ payload                                 | Step 5                                                                            |
| Jest test: L3 fires viewdetail w/ payload (regression)                    | Step 5                                                                            |
| No regression: "Hide" still works                                         | Step 5 ("Click Hide still fires close" test)                                      |
| Plan file in `docs/plans/yyyy-mm-dd-HH:mm-view-detail-menu-item.md`       | This file                                                                         |

---

## Function Point Table

No new functional processes. Slice wires an event so the follow-up panel slice can consume it. CFP unchanged at **99** (Step 7 still in progress).

---

## Sequence

1. Edit `bcm_ContextMenu.html` — drop `if:true={isL3}`.
2. Edit `bcm_ContextMenu.js` — dispatch `viewdetail` then close.
3. Edit `bcm_CapabilityMap.html` — add `onviewdetail`.
4. Edit `bcm_CapabilityMap.js` — add `handleViewDetail` stub.
5. New Jest file `bcm_ContextMenu.test.js` — six tests (3× render, 3× event payload, 1× close after click, 1× hide regression).
6. Update `docs/specs/diagram.md` — add the visibility sub-scenario.
7. Run `npx jest force-app/main/default/lwc/bcm_ContextMenu force-app/main/default/lwc/bcm_CapabilityMap` — all green.
8. Tick acceptance criteria in issue #14.
