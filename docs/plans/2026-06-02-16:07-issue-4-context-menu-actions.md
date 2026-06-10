# Issue #4 — Jest tests: context menu actions (View detail navigation + Hide re-render)

GitHub: https://github.com/deniskrizanovic/sf_businesscapability/issues/4

## New Functional Processes (COSMIC)

| FP   | Functional Process               | E   | X   | R   | W   | CFP |
| ---- | -------------------------------- | --- | --- | --- | --- | --- |
| FP31 | Hide Capability via Context Menu | 1   | 1   | 0   | 1   | 3   |

Running total: **119 → 122 CFP**

`View detail` menu action does not introduce a new FP — the navigation Exit re-uses the existing platform record-page load (FP14 / FP29). Only the new `@AuraEnabled hideCapability` write method crosses the boundary as a new functional process.

## Goal

Acceptance per issue:

1. Jest test asserts `NavigationMixin.Navigate` called with `{ type: 'standard__recordPage', ... }` when "View detail" clicked.
2. Jest test asserts Apex `hideCapability` called and layout rebuild triggered when "Hide" clicked.
3. Replace matching `Deferred:` lines in `docs/specs/diagram.md` with `Tested by: BcmCapabilityMapTest.<method>`.
4. Full Playwright suite still passes.

## Approach

Issue acceptance text drives current impl. Detail panel work is a future issue (will replace NavigationMixin with overlay). Wiring NavigationMixin now is throw-away when panel ships — accepted per user.

### Wiring changes (in scope)

1. **`bcm_CapabilityMap.js`**
    - `import { NavigationMixin } from 'lightning/navigation';`
    - Class declaration: `extends NavigationMixin(LightningElement)`.
    - `handleViewDetail(evt)` reads `evt.detail.id` and calls `this[NavigationMixin.Navigate]({ type:'standard__recordPage', attributes:{ recordId:evt.detail.id, objectApiName:'bcm_Capability__c', actionName:'view' } });` then closes menu.

2. **`bcm_ContextMenu.js`**
    - `handleHide()` dispatches new `hide` CustomEvent with `{ id, level, name }` payload before closing.

3. **`bcm_ContextMenu.html`** — no change (handler signature unchanged).

4. **`bcm_CapabilityMap.html`** — add `onhide={handleHide}` to `<c-bcm_-context-menu>`.

5. **`bcm_CapabilityMap.js`** — `handleHide(evt)`:

    ```
    const id = evt.detail.id;
    hideCapability({ capabilityId: id })
        .then(() => {
            // Optimistic local update + rebuild layout
            const cap = this._capabilities.find(c => c.Id === id);
            if (cap) cap.bcm_HideFromDiagram__c = true;
            this._buildLayout(this._capabilities);
        });
    this.contextMenuVisible = false;
    ```

6. **`bcm_CapabilityController.cls`** — new `@AuraEnabled` static method:

    ```
    public static void hideCapability(Id capabilityId) {
        update new bcm_Capability__c(Id = capabilityId, bcm_HideFromDiagram__c = true);
    }
    ```

    With null guard + WITH USER_MODE / try-catch wrap mirroring `getCapabilities`.

7. **`bcm_CapabilityControllerTest.cls`** — add tests:
    - `shouldHideCapability` — verifies field flips to true.
    - `shouldThrowException_WhenHideCapabilityIdIsNull`.

### Test changes (in scope)

`force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — add new describe block:

```
describe('BcmCapabilityMap context menu — View detail navigation', () => {
    // Mock NavigationMixin.Navigate via Jest mock on lightning/navigation
    // Open menu via two clicks on L2-A1
    // Click 'View detail' menu item
    // Assert mock called once with { type:'standard__recordPage', attributes:{ recordId:'L2-A1', objectApiName:'bcm_Capability__c', actionName:'view' } }
});

describe('BcmCapabilityMap context menu — Hide capability', () => {
    // Mock hideCapability Apex returns Promise.resolve()
    // Open menu on L2-A1
    // Dispatch 'hide' CustomEvent from menu (or click menu Hide item)
    // Assert hideCapability mock called with { capabilityId:'L2-A1' }
    // Await flush; assert _layoutL2 no longer contains L2-A1 (rebuild ran)
});
```

NavigationMixin Jest mock pattern:

```
const mockNavigate = jest.fn();
jest.mock('lightning/navigation', () => ({
    NavigationMixin: (Base) => class extends Base {
        [NavigationMixin.Navigate](...args) { return mockNavigate(...args); }
    },
}), { virtual: true });
// NavigationMixin.Navigate symbol identity must match — use:
// NavigationMixin.Navigate = Symbol('Navigate');  // via factory
```

Actually use `@salesforce/sfdx-lwc-jest` shim — it ships a working mock at `force-app/test/jest-mocks/lightning/navigation.js` if scaffolded. Will check existing `jest.config.js`/`__mocks__` first; otherwise inline a virtual mock.

Hide path in test: dispatch `hide` event on the rendered `c-bcm_-context-menu` directly (avoids needing to click li in shadow DOM of child component), since parent only listens for the event.

### Spec updates

In `docs/specs/diagram.md`:

- Line 415 "View detail opens panel" → keep `capability-detail.spec.ts` reference (deferred to future issue).
- Line 432 `> Deferred: Apex DML + re-render is a JS invariant; integration tested manually` →
  `> Tested by: bcm_CapabilityMap.test.js — "Hide click calls hideCapability Apex and rebuilds layout"`
- Add new scenario for navigation? Issue #4 says "Corresponding `Deferred:` lines... replaced". Existing line 432 is the Hide one. View detail navigation has no current `Deferred:` — but the e2e scenario at line 415 stays unchanged (Detail Panel is future). Will add a Tested by for navigation under Feature: Context menu actions instead — extend existing scenario at line 408 with Jest reference, or add new line.

Plan: insert new scenario "View detail navigates to record page" near line 408 with `Tested by: bcm_CapabilityMap.test.js — "View detail click calls NavigationMixin.Navigate with record page"`.

## E2E test updates

Per memory rule: every plan must include e2e section.

- **No Playwright spec changes required.** Both new behaviours are covered by future e2e specs (`capability-detail.spec.ts`) and existing `diagram.spec.ts` already passes through the menu. Ensure `npx playwright test` still green.
- Manual smoke: deploy to org, two-click an L2 node, click View detail → expect navigation to record page; click Hide → expect node disappears.

## File-by-file checklist

- [ ] `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — NavigationMixin + handleViewDetail + handleHide
- [ ] `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — `onhide={handleHide}`
- [ ] `force-app/main/default/lwc/bcm_ContextMenu/bcm_ContextMenu.js` — emit `hide` event
- [ ] `force-app/main/default/classes/bcm_CapabilityController.cls` — `hideCapability` method
- [ ] `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` — Apex tests for hideCapability
- [ ] `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — 2 new describe blocks
- [ ] `docs/specs/diagram.md` — replace Deferred line for Hide, add Tested by for navigation

## Risks

- NavigationMixin mock setup in Jest is finicky; if no existing `__mocks__/lightning/navigation.js`, will inline virtual mock.
- Hide test mocks Apex but parent does optimistic update before/after promise resolves — assertion timing must `await flushPromises()` before checking `_layoutL2`.
- Apex test counts may shift in CI; ensure new tests run in isolation.
