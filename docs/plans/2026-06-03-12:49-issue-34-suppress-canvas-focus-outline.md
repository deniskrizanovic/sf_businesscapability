# Issue #34 — Suppress Blue Focus Outline on Capability Map SVG Canvas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the default browser blue focus outline that appears around the `.bcm-canvas` SVG when it gains focus (click, tab, drag), without breaking keyboard navigation handlers.

**Architecture:** Pure CSS change in `bcm_CapabilityMap.css`. Add `outline: none` rule scoped to `.bcm-canvas` and `.bcm-canvas:focus` so the rule applies in all focus states (regular focus + `:focus-visible`). Existing `tabindex="0"` and `handleKeyDown` remain untouched — focus is still acquired so keyboard handlers fire; only the visual outline is suppressed.

**Tech Stack:** LWC CSS (`bcm_CapabilityMap.css`), Playwright e2e (`tests/e2e/diagram.spec.ts`).

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — add `.bcm-canvas:focus` / `:focus-visible` outline rules
- **Modify** `tests/e2e/diagram.spec.ts` — new test asserting computed `outline-style` on focused `.bcm-canvas` is `none`
- **Modify** `docs/specs/diagram.md` — add scenario under existing `Feature: Keyboard navigation` block

**No new FP — purely cosmetic CSS suppression of default browser styling. Same exclusion class as zoom/pan visual state (§6 Excluded Processes).**

---

## Task 1: Suppress canvas outline via CSS

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`

- [x] **Step 1: Add outline-none rules** (2026-06-03)

Append to the existing `.bcm-canvas` selector block (or add new rules immediately after) in `bcm_CapabilityMap.css`:

```css
.bcm-canvas:focus,
.bcm-canvas:focus-visible {
    outline: none;
}
```

Place after the existing `.bcm-canvas:active { cursor: grabbing; }` rule (line 19) and before the test-anchor comment.

- [ ] **Step 2: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css
git commit -m "fix(visualisation): suppress browser focus outline on SVG canvas (GH #34)"
```

---

## Task 2: e2e — assert no visible outline after click

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Add e2e test inside `Keyboard navigation — editor project` describe** (2026-06-03)

Append after the `'Clicking a node sets focus and ArrowRight moves to next column'` test (line 328) and before the closing `});`:

```typescript
test('No visible focus outline on canvas after click', async ({ page }) => {
    await openDiagram(page);
    const svg = page.locator('svg.bcm-canvas');
    await svg.click();                       // gives focus
    await expect(svg).toBeFocused();          // confirm focus acquired
    const outlineStyle = await svg.evaluate(
        (el) => window.getComputedStyle(el).outlineStyle
    );
    const outlineWidth = await svg.evaluate(
        (el) => window.getComputedStyle(el).outlineWidth
    );
    // Either outline-style:none OR outline-width:0px is sufficient
    expect(outlineStyle === 'none' || outlineWidth === '0px').toBe(true);
});
```

- [x] **Step 2: Verify e2e file is syntactically valid** (2026-06-03)

Run: `npx playwright test tests/e2e/diagram.spec.ts --list`
Expected: New test name appears in the list, no compile errors.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): assert no visible focus outline on canvas (GH #34)"
```

---

## Task 3: Update spec — `docs/specs/diagram.md`

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Add new scenario at end of `Feature: Keyboard navigation` block (before the `---` separator that precedes `Feature: Keyboard navigation — L3 level`)** (2026-06-03)

Insert after the "Focused L3 bullet shows highlight background rect" scenario block:

```markdown

**Scenario: SVG canvas does not show a default browser focus outline**

Given the user clicks, tabs to, or drags within the diagram canvas  
When the canvas element gains keyboard focus  
Then no visible blue focus outline is rendered around the canvas  
And keyboard handlers (`handleKeyDown`) still fire normally  

> Tested by: diagram.spec.ts — "No visible focus outline on canvas after click"
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): add no-focus-outline scenario for canvas (GH #34)"
```

---

## Task 4: Note exclusion in COSMIC FP doc

**Files:**
- Modify: `docs/economics/function-point-count.md`

- [x] **Step 1: Add row to §6 Excluded Processes table** (2026-06-03)

Append after the existing "Map selection persistence (sessionStorage)" row in the §6 Excluded Processes table:

```markdown
| Canvas focus outline suppression | Pure CSS visual styling; no data movement crosses the software boundary. Same exclusion class as zoom/pan visual state. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/economics/function-point-count.md
git commit -m "docs(cfp): exclude canvas focus-outline suppression from FP count (GH #34)"
```

---

## Task 5: Final verification + plan completion

- [x] **Step 1: Run full Jest suite** (2026-06-03 — 81/81 passed)

Run: `npm test`
Expected: all existing tests still pass; no Jest changes (CSS-only impl, no JS behaviour change).

- [x] **Step 2: Mark plan steps complete** (2026-06-03)

Tick every `- [ ]` checkbox above to `- [x]`.

- [ ] **Step 3: Push branch**

```bash
git push -u origin sf_businesscapability-34
```

- [ ] **Step 4: Open PR (do NOT auto-merge)**

```bash
gh pr create --title "fix: suppress browser focus outline on capability map canvas (GH #34)" --body "$(cat <<'EOF'
## Summary
- `.bcm-canvas:focus` / `:focus-visible` now declare `outline: none` so the browser default blue ring no longer appears
- Scoped to `.bcm-canvas` only — does not affect any other focusable element
- `tabindex="0"` and `handleKeyDown` remain — keyboard nav still works

## Test plan
- [ ] `npx playwright test tests/e2e/diagram.spec.ts -g "No visible focus outline"` against scratch org
- [ ] Manual: click canvas, tab to canvas, drag inside canvas — no blue ring in any state
- [ ] Manual: arrow-key pan still works after click

Closes #34
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Issue #34 acceptance criteria mapped — outline suppressed in all states (T1 CSS), CSS scoped to `.bcm-canvas` only (T1 selector), keyboard handlers untouched (no JS change), e2e asserts no outline (T2). Spec doc updated (T3).
- **Why both `:focus` and `:focus-visible`:** Some browsers paint outline only on `:focus-visible` (keyboard tab) but not pointer focus; covering both is the safe default. Modern Chrome only paints `:focus-visible`, but older Edge/Safari still honour `:focus`.
- **FP table:** No new FP. Excluded-processes table updated in T4. [[feedback_mark_complete_fp_table]] — no FP row to tick.
- **Placeholder scan:** Clean — no TBD / TODO.
