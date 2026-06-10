# Issue #49 — Strategic Support Toggle Implementation Plan

> **Status:** Completed 2026-06-10.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a `Strategic Support` toggle button to the diagram toolbar in `bcm_CapabilityMap`. When on, every capability node whose `bcm_StrategySupport__c` has non-empty content (after HTML strip + entity unescape + trim) renders an amber left-edge stripe at every level (L1 chevron, L2 box, L3 bullet, cross-cutting band chevron). When off, no stripes render. Toggle state persists across reload via `sessionStorage`. Switching maps resets the visible toggle to off; sessionStorage value is untouched (so reload after a switch restores the user's last preference).

**Architecture:** Mirror the existing `selectedTagId` sessionStorage pattern (GH #54). Add session key `bcm.visualisation.strategicSupportOn`. Restore on `connectedCallback` (one-shot via `_strategyRestoreAttempted` flag) — restore is independent of map/tag wires because it stores a primitive boolean, not an id that needs validation. `handleToggleStrategicSupport` flips `showStrategicSupport`, writes/removes the key, and calls `_buildLayout(this._capabilities)` so stripe geometry is recomputed (mirrors `handleToggleHidden`). Stripe geometry is precomputed in `_buildLayout` and attached to each layout node as `node.strategyStripe = { x, y, width, height } | null`, mirroring the existing `focusRect`/`tagRect` pattern. Empty-content detection uses a module-scope pure function `isStrategic(html)` that strip-tags via regex, replaces `&nbsp;`, trims, and tests `length > 0`.

**Tech Stack:** LWC (`bcm_CapabilityMap`), Jest (existing `bcm_CapabilityMap.test.js`), Playwright (`tests/e2e/diagram.spec.ts` + `diagram.seed.ts`). No Apex changes. No schema changes.

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — add `SESSION_KEY_STRATEGIC` constant, module-scope `isStrategic(html)` helper, `@track showStrategicSupport`, `_strategyRestoreAttempted` flag, `strategicSupportVariant` getter, `handleToggleStrategicSupport` handler, `_maybeRestoreStrategicSupport` restore call in `connectedCallback`, stripe geometry in `_buildLayout` for L1 / L2 / L3 / band nodes.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — add toolbar button (rightmost), four `<rect class="bcm-strategy-stripe">` template blocks (L1, L2, L3, band).
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — add `.bcm-strategy-stripe { fill: #E8A33D; pointer-events: none; }` rule.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — new describe `BcmCapabilityMap strategic support highlight` with 6 tests.
- **Modify** `tests/e2e/diagram.seed.ts` — extend `POST_SEED_APEX` to set `bcm_StrategySupport__c` on `Capability Alpha One One ${RUN_ID}`. Export new `STRATEGY_CAP_NAME` constant if needed by the spec.
- **Modify** `tests/e2e/diagram.spec.ts` — new test in a new `Strategic Support — viewer project` describe (or existing diagram describe) asserting button toggles stripes + persists across reload.
- **Modify** `docs/specs/diagram.md` — add `Feature: Strategic Support highlight` section with 5 scenarios.
- **Modify** `CONTEXT.md` — add `Strategic Support` glossary term.
- **Modify** `docs/design/99-cosmic-function-point-count.md` — broaden the existing sessionStorage exclusion row to cover `strategicSupportOn`.

**No new FP — toggle persistence + stripe render are UI state and a display option, not a new functional process.** Same exclusion class as zoom/pan and `selectedMapId` / `selectedTagId` (Rule 7 Note 2). [[feedback_mark_complete_fp_table]] — no FP table row to tick because no FP is added; the exclusion-table edit is the equivalent step.

---

## Function Point Table

No new functional process. The exclusion-table row in `docs/design/99-cosmic-function-point-count.md` §6 covers persistence of UI toggle state. Total CFP unchanged.

---

## Locked design decisions (from grilling)

| Decision | Choice |
|---|---|
| Marker style | Left-edge amber stripe (`#E8A33D`) |
| Levels | All (L1 chevron, L2 box, L3 bullet, cross-cutting band) |
| L1 stripe geometry | Vertical 3px bar inside chevron, just right of left edge, with 4px top/bottom inset |
| L2 stripe geometry | Vertical 3px bar at left edge of box, full height minus 4px inset |
| L3 stripe geometry | 3px vertical bar in indent gutter (`x = bulletBaseX - 8`, height = bullet group height) |
| Band stripe geometry | Same pattern as L1 (3px vertical bar, inset from left edge) |
| Toolbar button | `utility:strategy`, title `Strategic Support`, neutral→brand variant, rightmost |
| Visibility | Viewers + Editors |
| Empty detection | Regex strip + `&nbsp;` replace + trim + `length > 0` |
| sessionStorage key | `bcm.visualisation.strategicSupportOn` (value `'true'`, removed when off) |
| Map switch | Visible toggle resets to off, sessionStorage untouched |
| Hidden interaction | Stripe respects existing visibility rules (no override) |
| Compute timing | In `_buildLayout`, attached as `node.strategyStripe` |
| Helper location | Module-scope `isStrategic(html)`, near `wrapText` |
| E2E selector | `.bcm-strategy-stripe` CSS class |

---

## E2E Test Update Section

**Spec files changed:** `tests/e2e/diagram.spec.ts` (new test), `tests/e2e/diagram.seed.ts` (extend POST_SEED_APEX).

**Helpers changed:** None — reuses `openDiagram`, `selectMap` from `tests/e2e/fixtures/helpers.ts`.

**New navigation/interaction pattern:** Locate strategic-support toggle via `page.getByRole('button', { name: 'Strategic Support' })`. Assert stripes via `page.locator('.bcm-strategy-stripe')`.

**Project routing:** Test runs in the **viewer project** (toggle is Viewers + Editors) to lock-in the read-only-friendly behaviour. If the existing diagram suite has only an editor project, add the test under the existing project — viewer-vs-editor is not the asserted axis.

---

## Task 1: Module-scope `isStrategic` helper + Jest unit tests

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Add the helper** — in `bcm_CapabilityMap.js`, immediately above `wrapText` (currently line 55), insert:

```javascript
function isStrategic(html) {
    return String(html || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim().length > 0;
}
```

- [x] **Step 2: Add `SESSION_KEY_STRATEGIC` constant** — after line 40 (`SESSION_KEY_SELECTED_TAG`):

```javascript
const SESSION_KEY_STRATEGIC = 'bcm.visualisation.strategicSupportOn';
```

- [x] **Step 3: Add Jest test for normalisation cases** — inside `bcm_CapabilityMap.test.js`, in the new describe `BcmCapabilityMap strategic support highlight`:

```javascript
it('isStrategic normalisation — empty / whitespace / bare-tag inputs', () => {
    [null, undefined, '', '   ', '<p></p>', '<p><br></p>', '<p>&nbsp;</p>', '<p>   </p>', '<div><br/></div>']
        .forEach(v => expect(isStrategic(v)).toBe(false));
    ['x', '<p>x</p>', '<p>Strategy text</p>', '<p>&nbsp;Strategy</p>']
        .forEach(v => expect(isStrategic(v)).toBe(true));
});
```

`isStrategic` must be importable — export it from the LWC module:
```javascript
export { isStrategic };
```

- [x] **Step 4: Run test** — `npx jest -t "isStrategic normalisation"`. Expected: PASS.

- [x] **Step 5: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): add isStrategic helper for strategic support detection (GH #49)"
```

---

## Task 2: Toggle state, button, sessionStorage write/restore

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Add state + private flag** — in the State block (around lines 156–203):

```javascript
@track showStrategicSupport = false;
// ...
_strategyRestoreAttempted = false;
```

- [x] **Step 2: Add variant getter** — alongside `crossCuttingVariant`:

```javascript
get strategicSupportVariant() {
    return this.showStrategicSupport ? 'brand' : 'border';
}
```

- [x] **Step 3: Add toggle handler** — alongside `handleToggleCrossCutting`:

```javascript
handleToggleStrategicSupport() {
    this.showStrategicSupport = !this.showStrategicSupport;
    if (this.showStrategicSupport) {
        safeSessionSet(SESSION_KEY_STRATEGIC, 'true');
    } else {
        safeSessionRemove(SESSION_KEY_STRATEGIC);
    }
    this._buildLayout(this._capabilities);
}
```

- [x] **Step 4: Add restore helper** — anywhere in the class (e.g. after `_maybeRestoreSelectedTag`):

```javascript
_maybeRestoreStrategicSupport() {
    if (this._strategyRestoreAttempted) return;
    this._strategyRestoreAttempted = true;
    if (safeSessionGet(SESSION_KEY_STRATEGIC) === 'true') {
        this.showStrategicSupport = true;
    }
}
```

- [x] **Step 5: Wire restore to `connectedCallback`** — if `connectedCallback` already exists, append the call; otherwise add:

```javascript
connectedCallback() {
    this._maybeRestoreStrategicSupport();
}
```

- [x] **Step 6: Reset on map switch** — in `handleMapChange`, after `this.showCrossCutting = false;`:

```javascript
this.showStrategicSupport = false;
// sessionStorage value intentionally untouched — reload restores user's preference
```

- [x] **Step 7: Add toolbar button** — in `bcm_CapabilityMap.html`, append after the cross-cutting button block (around line 72):

```html
<div class="slds-col">
    <lightning-button-icon
        data-id="strategic-support-toggle"
        icon-name="utility:strategy"
        title="Strategic Support"
        variant={strategicSupportVariant}
        onclick={handleToggleStrategicSupport}>
    </lightning-button-icon>
</div>
```

- [x] **Step 8: Jest test — write 'true' on toggle on, remove on toggle off** —

```javascript
describe('BcmCapabilityMap strategic support highlight', () => {
    let element;
    beforeEach(() => {
        sessionStorage.clear();
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
    });
    afterEach(() => {
        document.body.removeChild(element);
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    it('Toggle on writes "true"; toggle off removes the key', async () => {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        const btn = element.shadowRoot.querySelector('[data-id="strategic-support-toggle"]');
        btn.click();
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.strategicSupportOn')).toBe('true');
        btn.click();
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.strategicSupportOn')).toBeNull();
    });
});
```

- [x] **Step 9: Jest test — restore on init** —

```javascript
it('Restores showStrategicSupport from sessionStorage on init', async () => {
    sessionStorage.setItem('bcm.visualisation.strategicSupportOn', 'true');
    document.body.removeChild(element);
    element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
    document.body.appendChild(element);
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    mockGetTags.emit({ data: [], error: undefined });
    await flushPromises();
    const btn = element.shadowRoot.querySelector('[data-id="strategic-support-toggle"]');
    expect(btn.variant).toBe('brand');
});
```

- [x] **Step 10: Jest test — map switch resets visible toggle, leaves key intact** —

```javascript
it('Map switch resets toggle to off but keeps sessionStorage key', async () => {
    sessionStorage.setItem('bcm.visualisation.strategicSupportOn', 'true');
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }, { Id: 'MAP-2', Name: 'Map 2' }], error: undefined });
    mockGetTags.emit({ data: [], error: undefined });
    await flushPromises();
    const btn = element.shadowRoot.querySelector('[data-id="strategic-support-toggle"]');
    expect(btn.variant).toBe('brand');
    const mapCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Map"]');
    mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-2' } }));
    await flushPromises();
    expect(btn.variant).toBe('border');
    expect(sessionStorage.getItem('bcm.visualisation.strategicSupportOn')).toBe('true');
});
```

- [x] **Step 11: Jest test — silent fallback when sessionStorage throws** —

```javascript
it('Silent fallback when sessionStorage.setItem throws on toggle', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => { throw new Error('QuotaExceeded'); });
    try {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        const btn = element.shadowRoot.querySelector('[data-id="strategic-support-toggle"]');
        expect(() => btn.click()).not.toThrow();
        await flushPromises();
        expect(btn.variant).toBe('brand');
    } finally {
        setItemSpy.mockRestore();
    }
});
```

- [x] **Step 12: Run jest** — `npx jest -t "strategic support highlight"`. Expected: 4 tests PASS.

- [x] **Step 13: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): add Strategic Support toolbar toggle with session persistence (GH #49)"
```

---

## Task 3: Stripe geometry in `_buildLayout` (L1, L2, L3, band) + render

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

Stripe constants (top of file, near layout constants):

```javascript
const STRATEGY_STRIPE_W       = 3;
const STRATEGY_STRIPE_INSET_Y = 4;
const STRATEGY_STRIPE_INSET_X = 4;  // distance from left edge / left notch tip
```

- [x] **Step 1: L1 chevron stripe** — inside `_buildLayout` L1 push block, compute and attach:

```javascript
const l1Strategy = (this.showStrategicSupport && isStrategic(l1.bcm_StrategySupport__c))
    ? {
        x      : x + STRATEGY_STRIPE_INSET_X,
        y      : y + STRATEGY_STRIPE_INSET_Y,
        width  : STRATEGY_STRIPE_W,
        height : h - STRATEGY_STRIPE_INSET_Y * 2,
    }
    : null;
// then, in the pushed l1 object:
strategyStripe: l1Strategy,
```

- [x] **Step 2: L2 box stripe** —

```javascript
const l2Strategy = (this.showStrategicSupport && isStrategic(l2.bcm_StrategySupport__c))
    ? {
        x      : colX + STRATEGY_STRIPE_INSET_X,
        y      : boxY + STRATEGY_STRIPE_INSET_Y,
        width  : STRATEGY_STRIPE_W,
        height : boxHeight - STRATEGY_STRIPE_INSET_Y * 2,
    }
    : null;
// in pushed l2 object:
strategyStripe: l2Strategy,
```

- [x] **Step 3: L3 bullet stripe** — inside the `bulletGroups.push({...})` block:

```javascript
strategyStripe: (this.showStrategicSupport && isStrategic(l3.bcm_StrategySupport__c))
    ? {
        x      : bulletBaseX - 8,
        y      : focusRectStartY,
        width  : STRATEGY_STRIPE_W,
        height : allLines.length * LINE_HEIGHT - 2,
    }
    : null,
```

- [x] **Step 4: Band chevron stripe** — inside the `bandNodes.push({...})` block:

```javascript
strategyStripe: (this.showStrategicSupport && isStrategic(cc.bcm_StrategySupport__c))
    ? {
        x      : bandX + STRATEGY_STRIPE_INSET_X,
        y      : y + STRATEGY_STRIPE_INSET_Y,
        width  : STRATEGY_STRIPE_W,
        height : h - STRATEGY_STRIPE_INSET_Y * 2,
    }
    : null,
```

- [x] **Step 5: Render in HTML — L1 chevron** — inside the `<g>` for L1 (around line 211, after `<polygon>`):

```html
<template if:true={node.strategyStripe}>
    <rect class="bcm-strategy-stripe"
          x={node.strategyStripe.x}
          y={node.strategyStripe.y}
          width={node.strategyStripe.width}
          height={node.strategyStripe.height}>
    </rect>
</template>
```

- [x] **Step 6: Render in HTML — L2 box** — inside the L2 `<g>` (after the box `<rect>`, around line 117):

```html
<template if:true={node.strategyStripe}>
    <rect class="bcm-strategy-stripe"
          x={node.strategyStripe.x}
          y={node.strategyStripe.y}
          width={node.strategyStripe.width}
          height={node.strategyStripe.height}>
    </rect>
</template>
```

- [x] **Step 7: Render in HTML — L3 bullet group** — inside the `<g class="bcm-l3-group">` (e.g. after `tagRect` template, before `lines` template):

```html
<template if:true={group.strategyStripe}>
    <rect class="bcm-strategy-stripe"
          x={group.strategyStripe.x}
          y={group.strategyStripe.y}
          width={group.strategyStripe.width}
          height={group.strategyStripe.height}>
    </rect>
</template>
```

- [x] **Step 8: Render in HTML — band chevron** — inside the band `<g>` (after `<polygon>`, around line 287):

```html
<template if:true={node.strategyStripe}>
    <rect class="bcm-strategy-stripe"
          x={node.strategyStripe.x}
          y={node.strategyStripe.y}
          width={node.strategyStripe.width}
          height={node.strategyStripe.height}>
    </rect>
</template>
```

- [x] **Step 9: CSS rule** — append to `bcm_CapabilityMap.css`:

```css
.bcm-strategy-stripe {
    fill: #E8A33D;
    pointer-events: none;
}
```

- [x] **Step 10: Jest test — marker present when toggle on + cap has content** —

```javascript
it('Marker present when toggle on and capability has strategy support content', async () => {
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    mockGetTags.emit({ data: [], error: undefined });
    mockGetCapabilities.emit({ data: [
        { Id: 'L2-A', Name: 'L2 A', bcm_Level__c: 2, bcm_SortOrder__c: 1, bcm_Parent__c: 'L1-A',
          bcm_StrategySupport__c: '<p>Real content</p>' },
        { Id: 'L1-A', Name: 'L1 A', bcm_Level__c: 1, bcm_SortOrder__c: 1, bcm_Parent__c: null,
          bcm_StrategySupport__c: '' },
    ], error: undefined });
    await flushPromises();
    const mapCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Map"]');
    mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-1' } }));
    await flushPromises();
    const btn = element.shadowRoot.querySelector('[data-id="strategic-support-toggle"]');
    btn.click();
    await flushPromises();
    expect(element.shadowRoot.querySelectorAll('rect.bcm-strategy-stripe').length).toBeGreaterThan(0);
});
```

- [x] **Step 11: Jest test — marker absent when toggle off** —

```javascript
it('Marker absent when toggle off even if capabilities have content', async () => {
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    mockGetTags.emit({ data: [], error: undefined });
    mockGetCapabilities.emit({ data: [
        { Id: 'L1-A', Name: 'L1 A', bcm_Level__c: 1, bcm_SortOrder__c: 1, bcm_Parent__c: null,
          bcm_StrategySupport__c: '<p>Real content</p>' },
    ], error: undefined });
    await flushPromises();
    expect(element.shadowRoot.querySelectorAll('rect.bcm-strategy-stripe').length).toBe(0);
});
```

(Note: the `mockGetCapabilities` mock + adapter-mock already exist in the test file — confirm the import block before writing these tests.)

- [x] **Step 12: Run jest** — `npm test`. Expected: full suite green; new strategic support describe = 6 tests PASS.

- [x] **Step 13: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html \
        force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): render amber strategic-support stripe on L1/L2/L3/band nodes (GH #49)"
```

---

## Task 4: e2e seed — set strategy support on one seeded capability

**Files:**
- Modify: `tests/e2e/diagram.seed.ts`

- [x] **Step 1: Add export for the capability name reused by the test** — add near the existing `DIAGRAM_TAG_CAP_NAME`:

```typescript
export const STRATEGY_CAP_NAME = `Capability Alpha One One ${RUN_ID}`;
```

(May reuse `DIAGRAM_TAG_CAP_NAME` — same node — but exporting under the strategic name keeps the spec readable.)

- [x] **Step 2: Extend `POST_SEED_APEX`** — inside `buildPostSeedApex`, append before the closing `}`:

```typescript
bcm_Capability__c sc = [SELECT Id FROM bcm_Capability__c
    WHERE Name = '${apexEscape(STRATEGY_CAP_NAME)}' LIMIT 1];
sc.bcm_StrategySupport__c = '<p>Strategy rationale ${RUN_ID}</p>';
update sc;
```

- [x] **Step 3: Verify compile** — `npx playwright test tests/e2e/diagram.spec.ts --list`. Expected: no TS errors.

- [x] **Step 4: Commit** —
```bash
git add tests/e2e/diagram.seed.ts
git commit -m "test(e2e): seed strategy support content on one diagram capability (GH #49)"
```

---

## Task 5: e2e — assert toggle visible state + persist across reload

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Add e2e test** — append to the existing diagram describe (or add a new `Strategic Support` describe parallel to the tag one):

```typescript
test('Strategic Support toggle reveals stripes and persists across reload', async ({ page }) => {
    await openDiagram(page);
    await selectMap(page, MAP_NAME);

    // Stripes hidden before toggle
    await expect(page.locator('.bcm-canvas')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('rect.bcm-strategy-stripe')).toHaveCount(0);

    // Click the toolbar button
    const btn = page.getByRole('button', { name: 'Strategic Support' }).first();
    await btn.click();

    // Stripes visible
    await expect(page.locator('rect.bcm-strategy-stripe').first())
        .toBeVisible({ timeout: 5000 });

    // Reload — stripe state restored from sessionStorage
    await page.reload();
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('rect.bcm-strategy-stripe').first())
        .toBeVisible({ timeout: 20000 });
});
```

Imports — `MAP_NAME` already imported; `STRATEGY_CAP_NAME` only needed if asserting per-cap.

- [x] **Step 2: Verify list** — `npx playwright test tests/e2e/diagram.spec.ts --list`. Expected: new test name appears.

- [x] **Step 3: Commit** —
```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): assert Strategic Support toggle reveals stripes and persists across reload (GH #49)"
```

---

## Task 6: spec — `docs/specs/diagram.md`

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Insert new feature block** — after the existing `Feature: Colour-by-tag selection persists for session` (currently ends ~line 75), before the `---` separator:

```markdown

## Feature: Strategic Support highlight

**Scenario: Toggle on shows amber stripe on capabilities with non-empty strategy support**

Given the user is on the Visualisation page with a Map selected
And at least one capability has non-empty `bcm_StrategySupport__c`
When the user clicks the Strategic Support toolbar button
Then every capability with non-empty content renders an amber left-edge stripe
And the button shows the brand variant

> Tested by: bcm_CapabilityMap.test.js — "Marker present when toggle on and capability has strategy support content"; diagram.spec.ts — "Strategic Support toggle reveals stripes and persists across reload"

**Scenario: Toggle off hides all strategic support stripes**

Given Strategic Support is on
When the user clicks the toolbar button again
Then no strategic-support stripes render
And the button returns to the neutral variant

> Tested by: bcm_CapabilityMap.test.js — "Marker absent when toggle off even if capabilities have content"

**Scenario: Empty / whitespace / bare-tag content does not produce a stripe**

Given Strategic Support is on
And a capability's `bcm_StrategySupport__c` is null, empty, `<p></p>`, `<p><br></p>`, `<p>&nbsp;</p>`, or whitespace-only
Then no stripe is rendered for that capability

> Tested by: bcm_CapabilityMap.test.js — "isStrategic normalisation — empty / whitespace / bare-tag inputs"

**Scenario: Switching maps resets the visible toggle to off**

Given Strategic Support is on
When the user picks a different Map from the Map combobox
Then the Strategic Support button returns to the neutral variant
And no stripes render until the user toggles again
And the persisted `bcm.visualisation.strategicSupportOn` value is unchanged

> Tested by: bcm_CapabilityMap.test.js — "Map switch resets toggle to off but keeps sessionStorage key"

**Scenario: Toggle state survives page reload within the same session**

Given the user toggled Strategic Support on
When the user reloads the page within the same browser session
Then the toolbar button is in the brand variant
And stripes are rendered on capabilities with non-empty strategy support

> Tested by: bcm_CapabilityMap.test.js — "Restores showStrategicSupport from sessionStorage on init"; diagram.spec.ts — "Strategic Support toggle reveals stripes and persists across reload"
```

- [x] **Step 2: Commit** —
```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): add Strategic Support highlight feature scenarios (GH #49)"
```

---

## Task 7: glossary — `CONTEXT.md`

**Files:**
- Modify: `CONTEXT.md`

- [x] **Step 1: Add glossary term** — append a new section (alphabetically near `Sort Order` / before `Tag`):

```markdown
## Strategic Support
Free-text rationale stored on `bcm_Capability__c` (`bcm_StrategySupport__c`) explaining how a capability supports business strategy. The diagram offers a Strategic Support toolbar toggle that, when on, marks every capability whose Strategic Support content is non-empty (after stripping HTML and whitespace) with a visual highlight. The highlight is a display option only — it does not change underlying data.
```

- [x] **Step 2: Commit** —
```bash
git add CONTEXT.md
git commit -m "docs(context): add Strategic Support glossary term (GH #49)"
```

---

## Task 8: COSMIC FP exclusion — broaden existing row

**Files:**
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Replace the existing exclusion row** — currently:

```markdown
| Map / Tag selection persistence (sessionStorage) | Persistent storage write/read for UI state restoration (`selectedMapId` GH #26, `selectedTagId` GH #54); sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary. |
```

with:

```markdown
| Map / Tag / Strategic-Support toggle persistence (sessionStorage) | Persistent storage write/read for UI state restoration (`selectedMapId` GH #26, `selectedTagId` GH #54, `strategicSupportOn` GH #49); sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary. |
```

- [x] **Step 2: Commit** —
```bash
git add docs/design/99-cosmic-function-point-count.md
git commit -m "docs(cfp): broaden sessionStorage exclusion row to cover strategicSupportOn (GH #49)"
```

---

## Task 9: Final verification + plan completion

- [x] **Step 1: Full Jest suite** — `npm test`. Expected: all PASS, ≥ 6 new tests in the strategic support describe.

- [x] **Step 2: e2e diagram spec** — `npx playwright test tests/e2e/diagram.spec.ts -g "Strategic Support"`. Expected: PASS. Re-run full diagram suite: `npx playwright test tests/e2e/diagram.spec.ts`.

- [x] **Step 3: Manual smoke** —
- Load Visualisation, select a Map.
- Click `Strategic Support` button — capabilities with content show amber stripe; button turns brand.
- Reload — toggle still on, stripes still rendered.
- Switch Map — button goes neutral, stripes gone.
- Reload — button brand again (sessionStorage retained), stripes reappear on the new map's capabilities with content.
- Pick a capability with `<p></p>` content via the detail panel; confirm no stripe.

- [x] **Step 4: Mark plan complete** — tick every `- [x]` above to `- [x]` and update header with completion date.

- [x] **Step 5: Push branch** —
```bash
git push -u origin sf_businesscapability-49
```

- [x] **Step 6: Open PR (do NOT auto-merge)** —
```bash
gh pr create --title "feat: Strategic Support toggle on diagram toolbar (GH #49)" --body "$(cat <<'EOF'
## Summary
- Adds a `Strategic Support` toolbar toggle that highlights every capability whose `bcm_StrategySupport__c` has non-empty content (HTML-stripped + trimmed)
- Stripes rendered on L1 chevrons, L2 boxes, L3 bullets, and cross-cutting band chevrons (amber `#E8A33D`)
- Toggle state persists across reload via `sessionStorage` key `bcm.visualisation.strategicSupportOn`
- Switching maps resets the visible toggle to off while leaving the persisted preference intact
- No Apex / schema changes — `bcm_StrategySupport__c` already returned by `getCapabilities`

## Test plan
- [x] `npm test` — all jest tests pass (6 new tests in `bcm_CapabilityMap.test.js`)
- [x] `npx playwright test tests/e2e/diagram.spec.ts` — all green, including `"Strategic Support toggle reveals stripes and persists across reload"`
- [x] Manual: Visualisation, toggle on, reload → still on; switch map → off; reload → on again

Closes #49
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Issue #49 acceptance criteria mapped — UX decisions captured in this plan (preamble + Locked design decisions table) before implementation; toolbar button added; brand/neutral variant flip; markers shown on caps with content; markers hidden on empty/`<p></p>`/whitespace; map-switch resets visible toggle; reload restores from sessionStorage; silent fallback when storage throws (covered by existing `safeSession*` helpers); jest covers all six scenarios; playwright covers toggle + reload; spec doc updated.
- **Persistence vs. reset semantics:** Map-switch resets *visible* state but not the persisted key — chosen explicitly during grilling (Q "Map-switch reset"). Reload after a switch will turn the toggle back on. The Jest `Map switch resets toggle to off but keeps sessionStorage key` test pins this behaviour.
- **Cross-cutting parity:** Band chevrons get the stripe per design — keeps semantics consistent across layout layers.
- **No FP added:** Pure UI display + sessionStorage UI state. Rule 7 Note 2 exclusion broadened (Task 8). [[feedback_mark_complete_fp_table]] — no FP row to tick because there is none for this issue.
- **Placeholder scan:** Clean — no TBD / TODO / "implement later".
- **Skill alignment:** No `*-meta.xml` work; no Apex; no schema. Plan stays inside LWC + Jest + Playwright + docs.
