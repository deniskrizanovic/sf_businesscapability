# Issue #61 — Toolbar Dropdown Clipping Fix

> **Status:** Complete (2026-06-10).

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Stop the diagram toolbar comboboxes (`Map`, `Colour by Tag`) from being visually clipped when their dropdown panels extend below the toolbar — most visible on first load when no map is selected and the canvas area is short.

**Root cause:** `.bcm-root` carries `overflow: hidden` so the right-anchored `<c-bcm_-capability-detail>` slide-out panel doesn't bleed past the LWC bounds when closed (`transform: translateX(100%)`). That same overflow clip also crops any SLDS-rendered overlay rooted under `.bcm-toolbar`.

**Fix shape (decision C from grilling):** Drop `overflow: hidden` from `.bcm-root`. Wrap the detail panel — and only the detail panel — in a new sibling `.bcm-panel-clip` div that fills `.bcm-root` (`position: absolute; inset: 0; overflow: hidden; pointer-events: none`). The detail panel keeps its own `pointer-events: auto`. Toolbar combobox dropdowns now escape downward freely; the detail panel's parked-off-screen state stays clipped exactly as before.

**Tech Stack:** LWC (`bcm_CapabilityMap` HTML/CSS only). Playwright (`tests/e2e/diagram.spec.ts` + `tests/e2e/fixtures/helpers.ts`). No JS, Apex, or schema changes. No ADR.

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — wrap `<c-bcm_-capability-detail>` in a new `<div class="bcm-panel-clip">`.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — change `.bcm-root` from `overflow: hidden` to `overflow: visible`; add `.bcm-panel-clip` rule.
- **Modify** `tests/e2e/fixtures/helpers.ts` — add `expectNotClippedByAncestor(locator)` helper.
- **Modify** `tests/e2e/diagram.spec.ts` — add 2 tests under a new `Toolbar dropdown clipping` describe.
- **Modify** `docs/specs/diagram.md` — add `Feature: Toolbar comboboxes render unclipped` with 2 scenarios.

**No new FP** — purely a layout-bug fix. CSS regrouping is not a CFP-countable functional process.

---

## Function Point Table

No new functional process. Total CFP unchanged.

---

## Locked design decisions (from grilling)

| Decision | Choice |
|---|---|
| Restructure approach | Option C — keep `.bcm-root` structure; introduce a panel-only clip wrapper |
| Clip wrapper placement | Sibling under `.bcm-root`, after `.bcm-canvas-container`, wrapping only the detail panel |
| Wrapper positioning | `position: absolute; inset: 0; overflow: hidden; pointer-events: none` |
| Wrapper z-index | None (auto). Detail panel keeps `z-index: 100`. Combobox dropdowns transparent-pass through wrapper. |
| `.bcm-root` overflow | Explicit `overflow: visible` (intent-readable) |
| Spec home | `docs/specs/diagram.md` — new `Feature: Toolbar comboboxes render unclipped` block |
| E2e clip detection | DOM-level helper that walks ancestors, asserts panel rect lies within every `overflow: hidden\|auto\|scroll` ancestor's rect |
| Helper location | `tests/e2e/fixtures/helpers.ts` (`expectNotClippedByAncestor(locator)`) |
| Test home | `tests/e2e/diagram.spec.ts` — 2 tests, no new file |
| Test target | First `role=option` inside the open listbox; assert the option, not the listbox container |
| ADR | Skipped — change is small, intent captured in plan + spec |

---

## E2E Test Update Section

**Spec files changed:** `tests/e2e/diagram.spec.ts` (2 new tests).

**Helpers changed:** `tests/e2e/fixtures/helpers.ts` — add `expectNotClippedByAncestor(locator)`.

**New navigation/interaction pattern:**
- Open the diagram WITHOUT calling `selectMap()` (the bug surfaces with no map selected).
- Locate combobox: `page.getByRole('combobox', { name: 'Map' }).first()` / `… { name: 'Colour by Tag' }`.
- Click to open. Locate option: `page.getByRole('option').first()`.
- Assert with `expectNotClippedByAncestor(option)`.

**Project routing:** Reuse the existing diagram describe's project — viewer-vs-editor is not the asserted axis. Both options exist on first load for both projects (Map options seeded via globalSetup, Colour-by-Tag has at least the `None` option).

---

## Task 1: HTML restructure — wrap detail panel in clip div

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- [x] **Step 1: Wrap `<c-bcm_-capability-detail>` in `<div class="bcm-panel-clip">`** — at the bottom of `.bcm-root` (currently lines 346–355), wrap the detail panel:

  ```html
  <!-- Panel-only clip wrapper — keeps the off-screen (translateX(100%)) detail panel
       from bleeding outside the LWC, without clipping toolbar overlays. -->
  <div class="bcm-panel-clip">
      <c-bcm_-capability-detail
          capability={detailCapability}
          breadcrumb={detailBreadcrumb}
          is-loading={detailIsLoading}
          error-message={detailErrorMessage}
          can-edit={canEdit}
          onclose={handleDetailClose}
          onsaved={handleDetailSaved}>
      </c-bcm_-capability-detail>
  </div>
  ```

- [x] **Step 2: Verify** — render the page; canvas, toolbar, and detail panel slide-out behaviour unchanged. The panel still opens over the toolbar visually (issue #41 design preserved).

---

## Task 2: CSS — drop root overflow, add wrapper

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`

- [x] **Step 1: Update `.bcm-root`** — change `overflow: hidden;` to `overflow: visible;`. Keep `position: relative` (the wrapper resolves `inset: 0` against it).

- [x] **Step 2: Add `.bcm-panel-clip` rule** — directly after the `.bcm-root` block:

  ```css
  /* Clip wrapper for the detail panel only. Keeps the parked-off-screen
     translateX(100%) state from leaking past the LWC right edge while
     leaving toolbar combobox overlays free to paint outside the root. */
  .bcm-panel-clip {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
  }

  .bcm-panel-clip > c-bcm_-capability-detail {
      pointer-events: auto;
  }
  ```

- [x] **Step 3: Manual verify in browser** —
  - With no map selected: open `Map` combobox; full options panel visible.
  - With no map selected: open `Colour by Tag` combobox; full options panel visible.
  - Select a map, open detail panel: still slides over the toolbar, still clipped to LWC bounds horizontally.
  - Pan/scroll the canvas: still self-clipped to canvas-container.

---

## Task 3: Spec — Toolbar comboboxes render unclipped

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Add feature block** — insert after the existing `Feature: Map selector loads available Maps` (or grouped near the toolbar features):

  ```markdown
  ## Feature: Toolbar comboboxes render unclipped

  **Scenario: Map combobox option panel is fully visible with no map selected**

  Given the user opens the Visualisation page
  And no Map is selected
  When the user opens the `Map` combobox
  Then the option list renders fully — no ancestor element with `overflow: hidden`, `auto`, or `scroll` clips the panel below its bottom edge

  > Tested by: diagram.spec.ts — "Map combobox option panel is not clipped when no map selected"

  **Scenario: Colour-by-Tag combobox option panel is fully visible with no map selected**

  Given the user opens the Visualisation page
  And no Map is selected
  When the user opens the `Colour by Tag` combobox
  Then the option list renders fully — no ancestor element with `overflow: hidden`, `auto`, or `scroll` clips the panel below its bottom edge

  > Tested by: diagram.spec.ts — "Colour by Tag combobox option panel is not clipped when no map selected"
  ```

---

## Task 4: E2e helper — `expectNotClippedByAncestor`

**Files:**
- Modify: `tests/e2e/fixtures/helpers.ts`

- [x] **Step 1: Add helper** — append at the end of the file:

  ```typescript
  /**
   * Assert that the given element's bounding rect lies within the bounding rect
   * of every ancestor that uses `overflow: hidden | auto | scroll`. Catches the
   * specific bug where SLDS overlays render under an `overflow: hidden`
   * container that visually crops them even though `getBoundingClientRect()`
   * returns the full layout rect (so `toBeVisible()` would lie).
   *
   * Walks up to `document.documentElement`. Reports the first violation with
   * tag, classes, and both rects to make the failure debuggable.
   */
  export async function expectNotClippedByAncestor(locator: Locator): Promise<void> {
      const violation = await locator.evaluate((el: Element) => {
          const elRect = el.getBoundingClientRect();
          let parent: Element | null = el.parentElement;
          while (parent && parent !== document.documentElement) {
              const cs = getComputedStyle(parent);
              const ovX = cs.overflowX;
              const ovY = cs.overflowY;
              const clips = (v: string) => v === 'hidden' || v === 'auto' || v === 'scroll';
              if (clips(ovX) || clips(ovY)) {
                  const aRect = parent.getBoundingClientRect();
                  const overflowsBottom = elRect.bottom > aRect.bottom + 0.5;
                  const overflowsTop    = elRect.top    < aRect.top    - 0.5;
                  const overflowsRight  = elRect.right  > aRect.right  + 0.5;
                  const overflowsLeft   = elRect.left   < aRect.left   - 0.5;
                  if (overflowsBottom || overflowsTop || overflowsRight || overflowsLeft) {
                      return {
                          tag: parent.tagName.toLowerCase(),
                          className: (parent as HTMLElement).className || '',
                          elRect: { top: elRect.top, bottom: elRect.bottom, left: elRect.left, right: elRect.right },
                          ancestorRect: { top: aRect.top, bottom: aRect.bottom, left: aRect.left, right: aRect.right },
                          overflow: { x: ovX, y: ovY },
                      };
                  }
              }
              parent = parent.parentElement;
          }
          return null;
      });
      expect(violation, `Element clipped by ancestor: ${JSON.stringify(violation)}`).toBeNull();
  }
  ```

  Add `Locator` import from `@playwright/test` if not already imported. Add `expect` import too if missing.

---

## Task 5: E2e tests — toolbar dropdown clipping

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Add `Toolbar dropdown clipping` describe** — within the existing diagram suite:

  ```typescript
  test.describe('Toolbar dropdown clipping', () => {
      test('Map combobox option panel is not clipped when no map selected', async ({ page }) => {
          await openDiagram(page); // do NOT call selectMap — bug only surfaces with short canvas
          const combo = page.getByRole('combobox', { name: 'Map' }).first();
          await combo.click();
          const option = page.getByRole('option').first();
          await expect(option).toBeVisible();
          await expectNotClippedByAncestor(option);
      });

      test('Colour by Tag combobox option panel is not clipped when no map selected', async ({ page }) => {
          await openDiagram(page);
          const combo = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
          await combo.click();
          const option = page.getByRole('option').first();
          await expect(option).toBeVisible();
          await expectNotClippedByAncestor(option);
      });
  });
  ```

  Update imports at top of file: add `expectNotClippedByAncestor` to the helpers import.

- [x] **Step 2: Run e2e** — both tests should fail on `main` (regression confirmed), pass after Tasks 1–2 are applied.

---

## Verification

- [x] `npx playwright test diagram.spec.ts -g "Toolbar dropdown clipping"` — both tests pass.
- [x] Full diagram suite still passes: `npx playwright test diagram.spec.ts`.
- [x] LWC Jest still passes: `npm run test:unit -- bcm_CapabilityMap`.
- [x] Manual smoke: load the Visualisation page; toolbar dropdowns open fully; detail panel still slides in/out cleanly; canvas pan/zoom still clipped within canvas area.

---

## Out of scope

- Detail-panel z-index, layout, or animation changes.
- Any toolbar layout/spacing changes.
- Refactoring `.bcm-root` into multi-region (Option A from grilling).
