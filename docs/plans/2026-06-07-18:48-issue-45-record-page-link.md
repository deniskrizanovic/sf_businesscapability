# Issue #45 — Detail Panel link to Salesforce record page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Open record page ↗" text link to the `bcm_CapabilityDetail` panel header. Visible to Viewers and Editors in both read and edit mode. Click opens the standard `bcm_Capability__c` record page in a new browser tab; diagram + panel state untouched.

**Architecture:** Single LWC change. `bcm_CapabilityDetail` extends `NavigationMixin(LightningElement)`. Capability setter detects id change; calls `this[NavigationMixin.GenerateUrl]({ type: 'standard__recordPage', attributes: { recordId, objectApiName: 'bcm_Capability__c', actionName: 'view' } })` and stores the resolved URL on a tracked `recordPageUrl` field. Header renders a plain `<a href={recordPageUrl} target="_blank" rel="noopener">` outside the read/edit mode templates so it appears identically in both. Link is gated by `if:true={recordPageUrl}` — auto-hides during empty/loading/error and during the async URL-fetch gap. No new Apex. No new FP (URL generation is client-side; click triggers FP14, already counted).

**Tech Stack:** LWC (`bcm_CapabilityDetail.js` + `.html` + `.css`), Jest, Playwright.

---

## File Structure

| File | Reason |
|------|--------|
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js` | Mix in `NavigationMixin`; add `recordPageUrl` tracked field; recompute URL in `capability` setter on id change; clear URL on `GenerateUrl` rejection. |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.html` | Add `<a class="bcm-detail-record-link slds-text-link">Open record page <lightning-icon icon-name="utility:new_window" size="xx-small"></lightning-icon></a>` block in `<header>`, after the read/edit title-row blocks, gated by `if:true={recordPageUrl}`. |
| `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css` | Minor: spacing for the link row and inline icon alignment. |
| `force-app/main/default/lwc/bcm_CapabilityDetail/__tests__/bcm_CapabilityDetail.test.js` | Mock `lightning/navigation`'s `GenerateUrl` to resolve a known URL; assert link renders / hidden / target+rel / href updates on capability change / visible in edit mode / visible without canEdit. |
| `tests/e2e/capability-detail.spec.ts` | Add one scenario: click "Open record page" link, capture new tab via `context.waitForEvent('page')`, assert URL contains `/lightning/r/bcm_Capability__c/` + the open capability's Id. |
| `docs/specs/diagram.md` | New feature heading "Detail Panel — record page link" with six scenarios, `> Tested by:` markers. |
| `docs/design/99-cosmic-function-point-count.md` | Add an exclusions-section note: GH #45 link adds no new FP — click triggers FP14. |

No new files in `force-app`. No Apex. No `js-meta.xml` changes (NavigationMixin is a pure JS mix-in).

---

## E2e test impact

- **Spec affected:** `docs/specs/diagram.md` — new feature heading **"Detail Panel — record page link"** appended after the existing "Detail Panel — inline edit (Editors only)" feature.
- **Helper change:** None. Reuse `openDetailPanelOnL2` already present in `tests/e2e/capability-detail.spec.ts`.
- **New navigation/interaction pattern:** First Playwright assertion in this repo on a `target="_blank"` anchor. Pattern: `const [newPage] = await Promise.all([context.waitForEvent('page'), link.click()]); expect(newPage.url()).toContain('/lightning/r/bcm_Capability__c/'); expect(newPage.url()).toContain(capabilityId); await newPage.close();` — do **not** wait for `loadstate('networkidle')` on the new page; record-page render is slow and out of scope.
- **Playwright file changes:** one new test in `capability-detail.spec.ts`.

---

## Task 1: Mix in `NavigationMixin` and track `recordPageUrl`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js`

- [x] **Step 1: Import `NavigationMixin` and extend the class**

Replace the import and class line (lines 1–3):

```js
import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class BcmCapabilityDetail extends NavigationMixin(LightningElement) {
```

- [x] **Step 2: Add tracked `recordPageUrl` field**

Insert near the existing `@track` block (around line 30):

```js
    @track recordPageUrl = null;
```

- [x] **Step 3: Recompute URL in the `capability` setter**

Modify the `set capability(val)` block (lines 8–24) so that, after the existing edit-mode bookkeeping, the URL is refreshed when the id changes or capability clears:

```js
    set capability(val) {
        const prev = this._capability;
        this._capability = val;
        const idChanged = val?.Id !== prev?.Id;
        if (idChanged) {
            this.editMode    = false;
            this._savePending = false;
        } else if (this._savePending && val && prev && !this.errorMessage) {
            this.editMode    = false;
            this._savePending = false;
        }
        if (idChanged) {
            this._refreshRecordPageUrl(val?.Id);
        }
    }
```

- [x] **Step 4: Add `_refreshRecordPageUrl` private method**

Insert near the bottom of the class (before the closing `}`):

```js
    _refreshRecordPageUrl(recordId) {
        if (!recordId) {
            this.recordPageUrl = null;
            return;
        }
        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: { recordId, objectApiName: 'bcm_Capability__c', actionName: 'view' },
        })
            .then(url => {
                // Guard against late resolution after the panel switched again
                if (this._capability?.Id === recordId) {
                    this.recordPageUrl = url;
                }
            })
            .catch(err => {
                // Auxiliary link — swallow rather than poisoning panel error state
                // eslint-disable-next-line no-console
                console.warn('GenerateUrl failed for record page link', err);
                if (this._capability?.Id === recordId) {
                    this.recordPageUrl = null;
                }
            });
    }
```

---

## Task 2: Render the link in the panel header

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.html`
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css`

- [x] **Step 1: Add the link block to the header**

Inside the existing `<header>` (after the `if:true={isEditMode}` block, before `</header>`, around line 53):

```html
            <template if:true={recordPageUrl}>
                <div class="bcm-detail-record-link slds-m-top_x-small">
                    <a href={recordPageUrl}
                       target="_blank"
                       rel="noopener"
                       class="slds-text-link">
                        Open record page
                        <lightning-icon
                            icon-name="utility:new_window"
                            size="xx-small"
                            alternative-text="Opens in new tab"
                            class="slds-m-left_xx-small">
                        </lightning-icon>
                    </a>
                </div>
            </template>
```

- [x] **Step 2: CSS — keep the icon vertically aligned with the link text**

Append to `bcm_CapabilityDetail.css`:

```css
.bcm-detail-record-link a {
    display: inline-flex;
    align-items: center;
}
.bcm-detail-record-link lightning-icon {
    margin-left: 0.25rem;
}
```

---

## Task 3: Jest tests

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/__tests__/bcm_CapabilityDetail.test.js`

- [x] **Step 1: Mock `lightning/navigation` so `GenerateUrl` resolves to a deterministic URL**

At the top of the test file:

```js
jest.mock('lightning/navigation', () => {
    return {
        NavigationMixin: (Base) => class extends Base {
            [NavigationMixin.GenerateUrl] = jest.fn();
        },
        // The mixin uses a Symbol key — re-export it for the test mock to reuse.
        // sfdx-lwc-jest's default stub already does this; keep behaviour consistent.
    };
}, { virtual: true });
```

If the existing `sfdx-lwc-jest` default stub for `lightning/navigation` is sufficient (it returns a Promise), prefer using it and only override `GenerateUrl` per-test via `jest.spyOn` on the component instance to resolve a chosen URL. Concretely: in each test that needs an href, do:

```js
const URL_FOR = (id) => `/lightning/r/bcm_Capability__c/${id}/view`;
// before connecting:
jest.spyOn(element, NavigationMixin.GenerateUrl)
    .mockImplementation(({ attributes }) => Promise.resolve(URL_FOR(attributes.recordId)));
```

(Pick whichever variant the existing test scaffolding cleanly supports — both achieve the same assertion target.)

- [x] **Step 2: Test — link renders with correct href in read mode**

```js
it('Record page link is rendered with correct href in read mode', async () => {
    // ...mount with capability { Id: 'a01...AAA', ... }...
    await flushPromises();
    const link = element.shadowRoot.querySelector('.bcm-detail-record-link a');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/lightning/r/bcm_Capability__c/a01...AAA/view');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
});
```

- [x] **Step 3: Test — link is rendered in edit mode**

```js
it('Record page link is rendered in edit mode', async () => {
    // ...mount, set canEdit=true, click edit button, flush...
    const link = element.shadowRoot.querySelector('.bcm-detail-record-link a');
    expect(link).not.toBeNull();
});
```

- [x] **Step 4: Test — link renders when canEdit is false (Viewer)**

```js
it('Record page link renders when canEdit is false', async () => {
    // ...mount with canEdit=false...
    expect(element.shadowRoot.querySelector('.bcm-detail-record-link a')).not.toBeNull();
});
```

- [x] **Step 5: Test — link is hidden when no capability loaded**

```js
it('Record page link is hidden when no capability loaded', async () => {
    // ...mount without setting capability...
    expect(element.shadowRoot.querySelector('.bcm-detail-record-link a')).toBeNull();
});
```

- [x] **Step 6: Test — href updates when capability changes**

```js
it('Record page link updates when capability changes', async () => {
    // ...mount with capability A, flush, capture href...
    // ...set capability B, flush...
    const link = element.shadowRoot.querySelector('.bcm-detail-record-link a');
    expect(link.getAttribute('href')).toBe('/lightning/r/bcm_Capability__c/<idB>/view');
});
```

---

## Task 4: Playwright e2e

**Files:**
- Modify: `tests/e2e/capability-detail.spec.ts`

- [x] **Step 1: Add a new test inside the appropriate `test.describe` block**

```ts
test('Record page link opens record page in a new tab', async ({ page, context }) => {
    await page.goto('/lightning/n/bcm_CapabilityMap');
    await openDetailPanelOnL2(page);

    const link = page.locator('.bcm-detail-record-link a');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');

    const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        link.click(),
    ]);
    expect(newPage.url()).toContain('/lightning/r/bcm_Capability__c/');
    // Diagram tab unaffected
    await expect(page.locator('.bcm-detail-panel[data-open="true"]')).toBeVisible();
    await newPage.close();
});
```

(Adjust `openDetailPanelOnL2` invocation + capability-id assertion to whichever seeded L2 the spec already exercises.)

---

## Task 5: Spec coverage

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Append a new feature section after "Detail Panel — inline edit (Editors only)"**

```markdown
## Feature: Detail Panel — record page link

**Scenario: Link to standard record page is shown in read mode**
Given a Viewer or Editor has the Detail Panel open for a capability
Then a text link "Open record page" is rendered in the panel header below the title row
And the link's `href` is the standard `bcm_Capability__c` record page URL for that capability

> Tested by: bcm_CapabilityDetail.test.js — "Record page link is rendered with correct href in read mode"

**Scenario: Link is shown in edit mode**
Given an Editor has the Detail Panel open and has switched to edit mode
Then the "Open record page" link is still rendered in the panel header

> Tested by: bcm_CapabilityDetail.test.js — "Record page link is rendered in edit mode"

**Scenario: Link is shown to Viewers (no canEdit gating)**
Given a Viewer has the Detail Panel open
Then the "Open record page" link is rendered

> Tested by: bcm_CapabilityDetail.test.js — "Record page link renders when canEdit is false"

**Scenario: Clicking the link opens the record page in a new tab**
Given the Detail Panel is open for a capability
When the user clicks "Open record page"
Then a new browser tab opens at the standard `bcm_Capability__c` record page URL for that capability
And the diagram + panel in the original tab are unchanged
And the new tab cannot manipulate the opener (`target="_blank"` + `rel="noopener"`)

> Tested by: capability-detail.spec.ts — "Record page link opens record page in a new tab"

**Scenario: No link rendered while panel is empty/loading/error**
Given the Detail Panel has no capability loaded (or is loading or showing an error)
Then no "Open record page" link is rendered

> Tested by: bcm_CapabilityDetail.test.js — "Record page link is hidden when no capability loaded"

**Scenario: Link href updates when the panel switches capability**
Given the Detail Panel has been showing capability A
When the panel is switched to capability B
Then the "Open record page" link's `href` updates to B's record page URL

> Tested by: bcm_CapabilityDetail.test.js — "Record page link updates when capability changes"
```

---

## Task 6: COSMIC function-point note

**Files:**
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Add an exclusions note near the existing "Hide via Context Menu removed" note (around line 613)**

```markdown
| Detail Panel record-page link added (GH #45) | New "Open record page" anchor in `bcm_CapabilityDetail` header. URL is generated client-side via `lightning/navigation` `GenerateUrl`; clicking the link triggers FP14 (standard `bcm_Capability__c` record page), already counted. No data movement crosses the software boundary in a new way — no new functional process. |
```

(Place in whichever exclusions/notes table the existing GH #32 entry sits under; match its row format.)

---

## Function point delta

No FP added or removed. Net change: **0 CFP**.

---

## Definition of Done

- [x] All Jest tests pass: `npm test -- --testPathPattern=bcm_CapabilityDetail` (104/104, 2026-06-07)
- [ ] Playwright spec passes: `npx playwright test capability-detail.spec.ts`
- [x] `docs/specs/diagram.md` includes the new feature with `> Tested by:` markers in accepted forms (2026-06-07)
- [x] `docs/design/99-cosmic-function-point-count.md` includes the GH #45 exclusion note (2026-06-07)
- [ ] Manual smoke: open panel on L1/L2/L3, click link → new tab opens at correct record page; close new tab → diagram + panel intact; switch capability in panel → link updates; close panel → link disappears

**Completed:** 2026-06-07 (Jest + spec + FP note). Playwright + manual smoke pending org deploy.
