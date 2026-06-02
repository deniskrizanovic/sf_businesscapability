# Hide button — viewer gate + Playwright coverage

Status: **Implemented 2026-06-02.** No new FP — permission gate fix. CFP unchanged at 122.

GitHub issue: https://github.com/deniskrizanovic/sf_businesscapability/issues/5

## Problem

The diagram context menu currently renders a **Hide** action for every user, regardless of permission. Clicking it as a viewer fails server-side (Apex controller checks `bcm_CanEdit`), but the button itself is visible. The Acceptance Criteria spec already documents the intended behaviour:

> Hide action is visible only to Editors — `> Deferred: canEdit permission gate is a JS invariant; verified manually`

The gate does not exist in the JS. The "Deferred" marker is incorrect.

Issue 5 asks for a Playwright e2e test that asserts the Hide button is absent from the rendered context menu when authenticated as a viewer. That test will fail until the gate is added.

## Scope

1. Add a `canEdit` prop to `bcm_ContextMenu` that conditionally renders the Hide `<li>`.
2. Wire the parent `bcm_CapabilityMap` to pass its existing `canEdit` getter (backed by `@salesforce/customPermission/bcm_CanEdit`) into the menu.
3. Update the existing Jest test that asserts "Renders Hide item for all levels" to reflect the new behaviour (Hide visible iff `canEdit=true`).
4. Add a Playwright e2e test in `tests/e2e/diagram.spec.ts` under the **viewer project** that asserts the Hide menu item is absent.
5. Replace the `Deferred:` marker on the corresponding spec scenario with a `Tested by:` line pointing at the new Playwright test.

Out of scope: server-side enforcement (already exists in `bcm_CapabilityController.hideCapability` and is covered by `bcm_CapabilityControllerTest`).

## Design

### Component change — `bcm_ContextMenu`

Add a single `@api canEdit = false;` field. Wrap the Hide `<li>` in `<template if:true={canEdit}>`. View detail stays unconditional. Default `false` (closed by default — viewer behaviour) so any consumer that forgets to pass the prop still hides the action.

### Parent change — `bcm_CapabilityMap`

`bcm_CapabilityMap.html` already binds the menu instance:

```html
<c-bcm_-context-menu
    anchor-x={contextMenuX}
    anchor-y={contextMenuY}
    node={contextMenuNode}
    onclose={handleContextMenuClose}
    onviewdetail={handleViewDetail}
    onhide={handleHide}>
</c-bcm_-context-menu>
```

Add `can-edit={canEdit}`. The `canEdit` getter (line 112-114) already returns the imported `bcm_CanEdit` custom permission boolean.

### Jest test update — `bcm_ContextMenu.test.js`

The current case `it('Renders Hide item for all levels', …)` asserts `getHideItem(element)` is non-null after mounting at every level. Replace with two cases:

1. `'Renders Hide item when canEdit is true'` — set `element.canEdit = true`, assert `getHideItem(element)` is non-null.
2. `'Hides Hide item when canEdit is false'` — leave `canEdit` at its default `false`, assert `getHideItem(element)` is `null`.

The "Hide regression" describe block (`it.each([1, 2, 3])('Click Hide at level %i still fires close')`) must set `element.canEdit = true` before clicking, otherwise the item won't exist.

### Playwright test — `tests/e2e/diagram.spec.ts`

Add to the existing `Permission — viewer project` describe block:

```ts
test('Viewer cannot see Hide button in context menu', async ({ page }) => {
    await openDiagram(page);
    await selectMapFromCombobox(page);
    const node = page.locator('.bcm-canvas .bcm-node').first();
    await node.click();   // first click → focus
    await node.click();   // second click → opens context menu
    const menu = page.locator('.bcm-menu-card');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('View detail', { exact: true })).toBeVisible();
    await expect(menu.getByText('Hide', { exact: true })).toHaveCount(0);
});
```

Notes:
- Reuses `openDiagram` and `selectMapFromCombobox` helpers already in the file.
- `selectMapFromCombobox` waits for polygons → confirms map loaded.
- The viewer project picks up the `viewer.json` storage state automatically because the test name matches `/viewer project/`.
- The first-click-focuses, second-click-opens-menu UX is already covered by Jest tests; reusing it is intentional and matches the spec.
- `.bcm-menu-card` is the public class on the menu container (`bcm_ContextMenu.html` line 4).

### Spec update — `docs/specs/diagram.md`

Replace lines 426–432:

```
**Scenario: Hide action is visible only to Editors**

Given the context menu is open  
When the user has only the bcm_Viewer permission set  
Then the "Hide" menu item is not rendered  

> Tested by: diagram.spec.ts — "Viewer cannot see Hide button in context menu"
```

## Risks

- **Map seed dependency.** The viewer test requires the same seeded map the editor suite imports. The `Map selector — editor project` `beforeAll` runs first because Playwright projects share global setup; `fullyParallel: false` in `playwright.config.ts` plus the `viewer` project running serially after `editor` mean the map is present when the viewer test runs. Confirm by running the full suite (`npx playwright test`) end-to-end. If ordering is unreliable, the viewer test can fall back to seeding its own map via the same JSON-import flow (verbose but self-contained).
- **First-click-focuses UX coupling.** The two-click pattern is currently a JS invariant. If that UX changes, this test will silently start clicking through to navigation. Acceptable — the Jest tests guard the UX itself; the e2e test guards the visibility gate.
- **Default-`false` for `canEdit`.** Any future consumer of `bcm_ContextMenu` must remember to set this prop to allow Hide. Acceptable trade-off: fail closed.

## Acceptance

- `npx jest force-app/main/default/lwc/bcm_ContextMenu` passes with the updated cases.
- `npx playwright test --project=viewer --grep "Hide button"` passes against a seeded org.
- `npx playwright test` (full suite) passes.
- `docs/specs/diagram.md` shows `Tested by: diagram.spec.ts — "Viewer cannot see Hide button in context menu"` for the corresponding scenario; no `Deferred:` line remains for that scenario.
