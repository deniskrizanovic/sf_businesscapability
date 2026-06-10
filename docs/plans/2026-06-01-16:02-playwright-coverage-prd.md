# PRD: bcm_CapabilityMap Test Coverage — Jest + Playwright

## Problem Statement

Commit `2775ad1` added 21 UX scenarios to `docs/specs/diagram.md`, all marked `Deferred: JS invariant; verified manually`. With no automated tests guarding this behavior, regressions in node click UX, keyboard navigation, zoom controls, context menu actions, and viewport management go undetected until manual testing.

## Solution

Add 13 Jest unit tests and 2 Playwright e2e tests covering 15 of the 21 new scenarios. Defer the remaining 3 scenarios that have no stable observable DOM side-effect in any test environment.

## User Stories

1. As a developer, I want a Jest test asserting first click on L1/L2 focuses the node but does not open the context menu, so that I can refactor click handling without silent regressions.
2. As a developer, I want a Jest test asserting second click on the same L1/L2 opens the context menu, so that the two-click UX contract is machine-verified.
3. As a developer, I want a Jest test asserting first click on an L3 bullet focuses it but does not open the context menu, so that L3 click parity with L1/L2 is guarded.
4. As a developer, I want a Jest test asserting second click on the same L3 opens the context menu, so that L3 menu access is covered.
5. As a developer, I want a Jest test asserting clicking a different node moves focus without opening the menu, so that focus-transfer logic is guarded.
6. As a developer, I want a Jest test asserting ArrowDown on a focused L3 moves focus to the next sibling L3, so that keyboard navigation is machine-verified.
7. As a developer, I want a Jest test asserting ArrowUp on a focused L3 moves focus to the previous sibling L3.
8. As a developer, I want a Jest test asserting ArrowUp from the first L3 under an L2 moves focus to that L2.
9. As a developer, I want a Jest test asserting ArrowLeft/Right on a focused L3 does not change focus or pan, so that unsupported keys do not corrupt state.
10. As a developer, I want a Jest test asserting "View detail" in the context menu calls NavigationMixin.Navigate with the correct record page type, so that navigation logic is covered without a live org.
11. As a developer, I want a Jest test asserting hiding a capability via Apex re-triggers the layout build, so that Hide→re-render integration is covered at unit speed.
12. As a developer, I want a Jest test asserting Zoom In increases the zoom state, so that toolbar behavior is verifiable without an org.
13. As a developer, I want a Jest test asserting Zoom Out decreases the zoom state.
14. As a developer, I want a Jest test asserting Zoom In does not exceed 300%, so that the clamp invariant is locked in.
15. As a developer, I want a Jest test asserting Zoom Out does not go below 20%.
16. As a developer, I want a Jest test asserting Reset View returns zoom to 100% and pan to (0,0).
17. As a developer, I want a Jest test asserting switching the selected map resets zoom and pan to defaults.
18. As a Playwright e2e suite maintainer, I want a test asserting the "Hide" button is absent from the context menu when authenticated as a viewer, so that permission gating is verified against a real org permission model.
19. As a Playwright e2e suite maintainer, I want a test asserting clicking "Hide" removes the node from the diagram and the node reappears after toggling Show Hidden, so that the full Apex DML → re-render path is covered.
20. As a spec author, I want `docs/specs/diagram.md` `Deferred:` markers replaced with `Tested by:` references once tests are written, so that spec coverage status is accurate.

## Implementation Decisions

- **New Jest file**: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`. No existing `__tests__/` directory; create it.
- **Jest framework**: `@salesforce/sfdx-lwc-jest` (already in `jest.config.js`). Provides `@wire` mock utilities, NavigationMixin stub, Apex auto-mock.
- **JSDOM SVG geometry**: `getBoundingClientRect()` returns zeros. Tests that require layout geometry (fit-to-window, L3 highlight rect) are deferred or skipped. L3 keyboard nav is feasible because layout constants are numeric (char-width estimation), not DOM-geometry-derived.
- **Focus state detection**: The component stores `focusedNodeId` internally. Tests will assert focus by checking whether `c-bcm_-context-menu` is absent on first click and present on second click on the same node. If a `data-focused` attribute is added to focused SVG elements (small component change), tests can also assert it directly — this decision should be made before writing keyboard nav tests.
- **Context menu selector**: `bcm_CapabilityMap.html` renders `<c-bcm_-context-menu>` inside `<template if:true={contextMenuVisible}>`. Jest queries `shadowRoot.querySelector('c-bcm_-context-menu')` for null/non-null assertion.
- **Seed data for L3 nav tests**: Current `SAMPLE_JSON` in `diagram.spec.ts` has 1 L3 per L2. Jest tests need their own wire mock data with ≥2 L3 siblings under one L2. No change to Playwright seed required for the 2 e2e tests.
- **Playwright tests**: Added to existing `tests/e2e/diagram.spec.ts`. Viewer permission test reuses the existing `viewer` auth fixture. Hide-persistence test reuses `openDiagram()` + `selectMapFromCombobox()` helpers.
- **Deferred scenarios (3)**: L3 focus highlight rect (no stable SVG selector), Fit-to-window zoom clamped at 300% (non-deterministic canvas size), ArrowLeft/Right on L3 ignored (no observable side-effect distinguishable from correct behavior without `data-focused`). These stay `Deferred:` in `docs/specs/diagram.md`.
- **Spec file updates**: After each test is written, replace the corresponding `Deferred:` line with `Tested by: BcmCapabilityMapTest.methodName` (Jest) or `Tested by: diagram.spec.ts:lineNumber` (Playwright). Follow the three-form rule from CLAUDE.md.

## Testing Decisions

- **What makes a good test here**: Assert observable external state — context menu presence/absence, `zoom` value, `panX`/`panY` value, navigation call args. Do not assert internal property names or implementation-private state variables.
- **Jest modules under test**:
    - `bcm_CapabilityMap` — click UX, keyboard nav, zoom/pan state machine, map-switch reset
    - `bcm_ContextMenu` — permission gating ("Hide" visibility) is better tested in `bcm_ContextMenu.__tests__` since `hasPermission` is a prop of that component
- **Prior art**:
    - Playwright: `tests/e2e/diagram.spec.ts` (379 lines, 19 tests) — wire mock pattern, auth fixtures, SVG selector patterns
    - Jest: none yet in this project; `@salesforce/sfdx-lwc-jest` standard patterns apply

## Out of Scope

- Tests for `bcm_ContextMenu` LWC itself (separate component, separate `__tests__` file).
- Tests for any spec file other than `diagram.md`.
- Fit-to-window full centring assertion (real layout geometry required).
- L3 focus highlight rect (no stable DOM selector).
- Any new Apex logic or Salesforce metadata changes.

## Further Notes

- Run Jest with `npx jest` (or `npm run test:unit` if script exists). Jest config at `jest.config.js` already set up.
- Run Playwright with `npx playwright test tests/e2e/diagram.spec.ts` for targeted execution.
- The `data-focused` attribute decision (add to SVG elements or test focus indirectly) must be resolved before starting keyboard nav Jest tests. If added, it's a one-line change to `bcm_CapabilityMap.js` template binding — low risk.
