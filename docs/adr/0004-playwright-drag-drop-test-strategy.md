# ADR 0004: Playwright drag-drop test strategy — hybrid (1 gesture + outcome-only)

See also: [ADR 0003](0003-playwright-e2e-testing.md), [drag-drop spec](../specs/drag-drop.md), [step 8 plan](../plans/2026-06-06-11:47-step8-drag-drop.md).

## Decision

For the drag-drop scenarios in `docs/specs/drag-drop.md`, Playwright e2e tests use a **hybrid strategy**:

- **One full-mouse-simulation test** drives a real drag gesture from handle → target gap (`page.mouse.down()` → `move()` in 8 steps → `up()`). Scope: L2 reorder within a column, the simplest representative case.
- **All other reorder / reparent scenarios** (L2 reparent across columns, L1 reorder, L3 reorder, L3 reparent across L2s) are tested **outcome-only**: a Salesforce CLI `data update record` call mutates `bcm_Parent__c` / `bcm_SortOrder__c`, then the page is reloaded and the diagram structure is asserted.
- **Cancel paths and Apex-error revert** are tested in Jest only — they do not appear in the Playwright suite.

The single gesture test proves the drag interaction works end-to-end. Outcome-only tests prove the persistence semantics for each level / parent combination.

## Considered Options

**A. Full mouse simulation for every scenario.** Each spec scenario drives a real gesture against the SVG canvas. Highest fidelity. Rejected because:
- SVG hit-testing inside Lightning Experience requires precise coordinate math against handle bounding boxes that shift with viewport size, zoom, and dynamic layout. Coordinate fragility makes tests flaky in CI.
- Each gesture test must reset zoom/pan/focus state before running; the per-test setup cost adds up across 5+ scenarios.
- Drag-drop combinatorics (5 scenarios × 2 directions × ghost/indicator assertions) double or triple the test surface for diminishing fidelity gain — the same gesture is being re-driven against different node coordinates.

**B. Outcome-only for every scenario.** Skip gestures entirely; all tests use CLI record updates and assert the diagram reflects the new state. Lowest cost. Rejected because:
- Spec language is explicitly "the user drags...". Asserting the persistence layer without ever exercising the gesture leaves the gesture untested in CI. A regression in `mousedown` → drop-target hit-test → optimistic update would not be caught.
- Sets a precedent that "we don't test gestures" — wrong message for future interactive features.

**C. Hybrid (chosen).** One gesture test proves the interaction; outcome-only tests prove the persistence permutations. Best fidelity-per-test-cost ratio for a 9-scenario spec.

## Consequences

- `tests/e2e/drag-drop.spec.ts` contains exactly one `page.mouse.down/move/up` sequence. New contributors reading the file will see most tests skip the gesture and may wonder why — this ADR is the explanation, and the test file should reference it.
- The gesture test is the canary for SVG drag-drop regressions. If it flakes repeatedly, the response is to stabilise it (add `boundingBox()` polling, reduce step count, or reset zoom before the test) — **not** to delete it and fall back to outcome-only.
- Cancel-on-invalid-target and Apex-error-revert paths are covered by Jest, not Playwright. The plan must call out which Jest tests cover which spec scenarios so coverage is auditable.
- If a future feature reuses drag-drop (e.g. dragging Tags onto Capabilities), the same hybrid pattern applies: one gesture test, outcome-only for permutations.
- Adopted convention: outcome-only tests use `sf data update record --use-tooling-api` (or equivalent) to mutate state, then `page.reload()` before asserting. They do **not** call Apex methods directly via REST — that would test the Apex method, which is already covered by `bcm_DragDropControllerTest`. The mutation must mimic what the LWC would persist (parent + sortOrder), not invoke the controller.
