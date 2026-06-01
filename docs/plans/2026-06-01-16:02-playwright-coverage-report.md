# Report: Playwright Coverage Practicality — Commit 2775ad1 (diagram.md UX scenarios)

## Context

Commit `2775ad1` added 203 lines to `docs/specs/diagram.md`, covering 9 feature sections and **21 new scenarios** for UX improvements to the `bcm_CapabilityMap` LWC. Almost all are currently marked `Deferred: JS invariant; verified manually`. This report assesses whether each could realistically be covered by Playwright e2e tests in `tests/e2e/diagram.spec.ts`.

---

## Baseline

Existing `diagram.spec.ts` (379 lines, 19 tests) already provides:
- Map seed/teardown via JSON import
- `openDiagram()` + `selectMapFromCombobox()` helpers
- `getViewportTransform()` — reads `<g transform="...">` attribute from SVG
- `.bcm-node` selector for L1/L2 clickable nodes
- Auth fixtures for editor + viewer roles

---

## Scenario-by-Scenario Assessment

### Feature: L3 focus highlight rect (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Focused L3 shows blue-tint background rect | **Hard** | Would need to query SVG `<rect>` behind text element and assert fill. No stable selector exists for this rect; would require fragile coordinate-based lookup or adding a `data-*` attribute to the component. |

### Feature: Node click UX — focus then menu (5 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| First click L1/L2 → focus, no menu | **Feasible** | Click `.bcm-node`, assert context menu selector absent. Need to know context menu component selector (likely `bcm_ContextMenu` rendered element). |
| Second click L1/L2 → menu opens | **Feasible** | Double-click or two sequential clicks; assert context menu becomes visible. |
| First click L3 → focus, no menu | **Feasible** | Same pattern but targeting `text` element with bullet char. Selector is trickier (SVG text, no class). |
| Second click L3 → menu opens | **Feasible** | Same as above. |
| Click different node → focus moves, no menu | **Feasible** | Click A, click B, assert menu absent and focus state on B. Focus state is detectable if component adds `stroke` attribute or `data-focused` — needs inspection. |

**Blocker for all 5**: The context menu selector is unknown without reading the component HTML. The LWC likely renders a child `<c-bcm_-context-menu>` element — this needs verification before writing tests.

### Feature: Keyboard navigation — L3 level (4 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| ArrowDown moves to next L3 | **Feasible but complex** | Click L3 bullet to focus, press ArrowDown, assert new focus. Detecting L3 focus requires knowing what attribute changes (fill, stroke, or `data-*`). Seed data needs ≥2 L3 bullets under one L2. |
| ArrowUp moves to prev L3 | **Feasible but complex** | Same setup. |
| ArrowUp from first L3 → parent L2 | **Feasible but complex** | Same. |
| ArrowLeft/Right ignored on focused L3 | **Feasible** | Click L3, press ArrowLeft, assert transform unchanged (no pan) and focus same — but focus assertion is the hard part. Simpler: assert context menu still absent. |

**Blocker**: Current seed data has only 1 L3 bullet per L2. Tests for L3 nav would need seed data with ≥2 L3 siblings.

### Feature: Context menu actions (3 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| "View detail" navigates to record page | **Feasible** | Open menu, click "View detail", assert URL contains `/bcm_Capability__c/`. Requires context menu to be openable via test clicks. |
| "Hide" not visible for viewer | **Feasible** | Open context menu as viewer (auth fixture exists), assert "Hide" button absent. |
| "Hide" persists via Apex + re-renders | **Feasible but slow** | Click Hide, assert node disappears from diagram; node re-appears after Show Hidden toggle. Requires Apex callout in the test path — adds ~5-10s per test. |

### Feature: Toolbar zoom buttons (4 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| Zoom In changes transform | **Already tested** ✓ | `diagram.spec.ts:152` |
| Zoom Out changes transform | **Already tested** ✓ | `diagram.spec.ts:160` |
| Zoom In clamped at 300% | **Feasible** | Click Zoom In 30+ times, extract scale from transform string (regex `scale\(([\d.]+)\)`), assert ≤ 3.0. |
| Zoom Out clamped at 20% | **Feasible** | Same pattern, assert ≥ 0.2. |

### Feature: Fit to window (2 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| Fit to Window scales and centres | **Partially covered** — button presence only at `diagram.spec.ts:444`; behavior not tested | Could add: record transform before, click Fit, assert transform changed. Full centring assertion (panX = computed centring offset) is hard without knowing canvas dimensions. |
| Fit zoom clamped at 300% | **Hard** | Requires a map tiny enough to trigger >300% fit zoom. Deterministic setup is difficult. Correctly deferred. |

### Feature: Reset view (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Reset returns zoom=100%, pan=(0,0) | **Already tested** ✓ | `diagram.spec.ts:168` — asserts `scale(1)` after zoom. Pan reset to `translate(0, 0)` not explicitly asserted but covered by the same transform string. |

### Feature: Zoom/pan reset on map switch (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Selecting new map resets viewport | **Feasible** | Zoom in, select different map from combobox, assert `getViewportTransform()` contains `scale(1)`. Needs ≥2 seeded maps. |

---

## Summary Table

| Feature | Scenarios | Already tested | Feasible to add | Hard/Deferred OK |
|---|---|---|---|---|
| L3 focus highlight rect | 1 | 0 | 0 | 1 |
| Node click UX | 5 | 0 | 5* | 0 |
| L3 keyboard nav | 4 | 0 | 3* | 1 |
| Context menu actions | 3 | 0 | 3 | 0 |
| Toolbar zoom buttons | 4 | 2 | 2 | 0 |
| Fit to window | 2 | 0 (presence only) | 1 | 1 |
| Reset view | 1 | 1 | 0 | 0 |
| Zoom/pan reset on map switch | 1 | 0 | 1 | 0 |
| **Total** | **21** | **3** | **15*** | **3** |

*Feasible but require one prerequisite (see blockers below).

---

## Key Blockers to Resolve Before Writing Tests

1. **Context menu selector** — Need to read `bcm_CapabilityMap.html` to find the rendered selector for the context menu. Likely `c-bcm_-context-menu` or a div with a data attribute.

2. **Focus state detection** — The component uses `isFocused` flag to change SVG stroke/fill. Tests need a stable way to detect which node has focus. Options:
   - Read `stroke` attribute of polygon/rect (fragile to color changes)
   - Add `data-focused="true"` to focused SVG elements (requires small component change)

3. **Seed data for L3 nav** — Current seed JSON has 1 L3 per L2. L3 keyboard nav tests need ≥2 siblings. Can extend `SAMPLE_JSON` in `diagram.spec.ts` without component changes.

4. **Second map for reset-on-switch** — Needs a second map in seed data.

---

## Verdict

**15 of 21 scenarios are practically testable with Playwright.** The 3 correctly deferred scenarios (L3 highlight rect, fit clamp, ArrowLeft/Right ignored detection) involve either pure JS invariants with no observable DOM side-effect, or test setup that is hard to make deterministic.

The main precondition before writing the 15 new tests: confirm context menu selector and decide whether to add `data-focused` to SVG nodes, or test focus indirectly via context-menu-not-open assertion.

---

## Jest (LWC Unit Test) Coverage Analysis

### Baseline

Jest config exists at `jest.config.js` using `@salesforce/sfdx-lwc-jest`. No `__tests__/` directory exists under `bcm_CapabilityMap/`. Zero unit tests written today.

`@salesforce/sfdx-lwc-jest` provides:
- JSDOM environment — no real browser, no SVG layout geometry
- `@wire` mock utilities (`registerApexTestWireAdapter`)
- Stubs for `lightning-*` components
- `@salesforce/apex/*` auto-mocked
- `NavigationMixin` mockable via `@salesforce/sfdx-lwc-jest/stubs`

Critical limitation: **JSDOM does not implement SVG layout**. `getBoundingClientRect()`, `getComputedStyle()`, measured text width, scroll dimensions all return zeros. The entire `_buildLayout()` engine in `bcm_CapabilityMap.js` produces coordinates based on these measurements — so rendered SVG node positions are meaningless in Jest.

### Scenario-by-Scenario Assessment

#### Feature: L3 focus highlight rect (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Focused L3 shows blue-tint background rect | **Not feasible** | Depends on layout coordinates from `_buildLayout()` which requires real SVG geometry. JSDOM returns 0 for all dimensions → layout produces degenerate output. |

#### Feature: Node click UX — focus then menu (5 scenarios)

Context menu in HTML is `<c-bcm_-context-menu>` inside `<template if:true={contextMenuVisible}>`.

| Scenario | Verdict | Reason |
|---|---|---|
| First click L1/L2 → focus, no menu | **Feasible** | Dispatch click event on `.bcm-node` element; assert `contextMenuVisible` state false. Can read via `shadowRoot.querySelector('c-bcm_-context-menu')` being null. |
| Second click L1/L2 → menu opens | **Feasible** | Two sequential click dispatches on same node; assert `c-bcm_-context-menu` present in shadow DOM. |
| First click L3 → focus, no menu | **Feasible** | Dispatch click on SVG `text` element with `data-node-level="3"`; assert menu absent. |
| Second click L3 → menu opens | **Feasible** | Same, second click; assert menu present. |
| Click different node → focus moves, no menu | **Feasible** | Click node A then node B; assert menu absent and `focusedNodeId` equals B's id (if exposed, else assert via stroke attribute). |

**All 5 feasible** — click UX is pure state machine logic with no geometry dependency.

#### Feature: Keyboard navigation — L3 level (4 scenarios)

Keyboard nav reads `_layoutL3Map`, `_colMap`, `_l2ByCol` — all populated by `_buildLayout()`. Since JSDOM returns zero dimensions, the layout maps will be empty or produce wrong data unless wire adapters are mocked with a meaningful capabilities tree.

| Scenario | Verdict | Reason |
|---|---|---|
| ArrowDown moves to next L3 | **Feasible with effort** | Mock `getCapabilities` wire with seeded data; call `_buildLayout()` implicitly via wire; dispatch keydown on SVG. Focus assertion: check `focusedNodeId` changed to expected L3 id. Requires L3 entries to be present in `_layoutL3Map` — layout math uses constants not geometry so **text wrapping works** (uses char-width estimation, not DOM). |
| ArrowUp moves to prev L3 | **Feasible with effort** | Same. |
| ArrowUp from first L3 → parent L2 | **Feasible with effort** | Same; assert `focusedNodeId` equals the L2 id. |
| ArrowLeft/Right ignored on L3 | **Feasible** | Simpler — dispatch ArrowLeft, assert `focusedNodeId` unchanged and `panX` unchanged. |

**All 4 feasible** — layout constants are numeric (not geometry-derived), so `_buildLayout()` produces valid coordinate maps in JSDOM.

#### Feature: Context menu actions (3 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| "View detail" navigates to record page | **Feasible** | Mock `NavigationMixin.Navigate`; open menu, dispatch click on "View detail"; assert mock called with `{ type: 'standard__recordPage', ... }`. |
| "Hide" not visible for viewer | **Feasible** | Mock `hasPermission` (`@salesforce/customPermission/bcm_CanEdit`) to return false; open menu; assert "Hide" button absent from `c-bcm_-context-menu` props (or child shadow). Note: this test lives better in `bcm_ContextMenu`'s own `__tests__`. |
| "Hide" persists via Apex + re-renders | **Feasible** | Mock `hideCapability` Apex call; dispatch hide action; assert wire adapter for `getCapabilities` is re-called (or `_buildLayout()` re-runs). Apex mock resolves synchronously in Jest → no 5-10s wait. |

#### Feature: Toolbar zoom buttons (4 scenarios)

| Scenario | Verdict | Reason |
|---|---|---|
| Zoom In changes transform | **Ideal for Jest** | Dispatch click on `[title="Zoom In"]`; read `zoom` property or `viewportTransform` getter; assert increased. No org needed. |
| Zoom Out changes transform | **Ideal for Jest** | Same. |
| Zoom In clamped at 300% | **Ideal for Jest** | Set `zoom = 3.0` directly on component; dispatch Zoom In; assert `zoom` still `3.0`. Much faster than clicking 30 times in Playwright. |
| Zoom Out clamped at 20% | **Ideal for Jest** | Same pattern. |

**All 4 are better in Jest than Playwright** — pure state logic, no org, instant.

#### Feature: Fit to window (2 scenarios)

`handleFitToWindow()` reads `this.template.querySelector('.bcm-canvas-container').getBoundingClientRect()` and `this.template.querySelector('svg.bcm-canvas').getBoundingClientRect()` — both return `{width:0, height:0}` in JSDOM.

| Scenario | Verdict | Reason |
|---|---|---|
| Fit to Window scales and centres | **Not feasible** | Fit calculation divides by container dimensions → 0/0 = NaN → zoom/pan state undefined. Would need to mock `getBoundingClientRect` on two elements, which is possible but brittle. |
| Fit zoom clamped at 300% | **Feasible with mocking** | Mock `getBoundingClientRect` to return tiny canvas; dispatch Fit; assert `zoom === 3.0`. Viable but requires careful mock setup. |

#### Feature: Reset view (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Reset returns zoom=100%, pan=(0,0) | **Ideal for Jest** | Set `zoom=2`, `panX=50`; dispatch click on Reset View; assert `zoom===1`, `panX===0`, `panY===0`. Trivial state assertion. |

#### Feature: Zoom/pan reset on map switch (1 scenario)

| Scenario | Verdict | Reason |
|---|---|---|
| Selecting new map resets viewport | **Ideal for Jest** | Set zoom/pan; emit change event on Map combobox; assert `zoom===1`, `panX===0`. Pure state machine, no org. |

---

### Jest Summary Table

| Feature | Scenarios | Ideal for Jest | Feasible with effort | Not feasible |
|---|---|---|---|---|
| L3 focus highlight rect | 1 | 0 | 0 | 1 |
| Node click UX | 5 | 5 | 0 | 0 |
| L3 keyboard nav | 4 | 0 | 4 | 0 |
| Context menu actions | 3 | 2 | 1 | 0 |
| Toolbar zoom buttons | 4 | 4 | 0 | 0 |
| Fit to window | 2 | 0 | 1 | 1 |
| Reset view | 1 | 1 | 0 | 0 |
| Zoom/pan reset on map switch | 1 | 1 | 0 | 0 |
| **Total** | **21** | **13** | **6** | **2** |

---

### Jest vs Playwright — Which to Prefer Per Feature

| Feature | Recommendation | Reason |
|---|---|---|
| Toolbar zoom (clamp + behavior) | **Jest** | Pure state; no org; runs in ms |
| Reset view | **Jest** | Trivial state assertion |
| Zoom/pan reset on map switch | **Jest** | State only; Playwright needs ≥2 seeded maps |
| Node click UX (focus/menu) | **Jest** | State machine; Playwright needs context menu selector investigation |
| L3 keyboard nav | **Jest** | Constants-based layout works in JSDOM; no seed data overhead |
| Context menu "View detail" nav | **Jest** | NavigationMixin mock cleaner than URL assertion |
| Context menu "Hide" permission | **Playwright** (viewer project) | Real permission model; Jest mock of `hasPermission` is less trustworthy |
| Context menu "Hide" persist | **Playwright** | End-to-end Apex DML + re-render trust; Jest Apex mock too shallow |
| Fit to window behavior | **Playwright** | Real layout required; JSDOM mock too fragile |
| L3 focus highlight rect | **Neither** (defer) | No stable selector in either environment |

### Jest Verdict

**19 of 21 scenarios testable in Jest** (13 ideal, 6 with effort, 2 not feasible). For the 15 scenarios identified as Playwright-feasible, **13 are better suited to Jest** — faster, no org dependency, precise state assertions. Only "Hide" permission gating and "Hide" Apex persistence genuinely benefit from Playwright's real browser + real org context.

**Recommended split:**
- Write 13 Jest unit tests in `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`
- Write 2 Playwright tests (viewer permission gate + Hide-persists flow) in `diagram.spec.ts`
- Defer L3 highlight rect (both frameworks)
