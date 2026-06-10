# Issue #50 — Refresh "Colour by Tag" combobox on focus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When user focuses the "Colour by Tag" combobox in `bcm_CapabilityMap`, re-query `bcm_Tag__c` so option labels, swatch colours and `_tagColourMap` reflect any edits made in another tab — and if the currently-selected tag's colour changed, recolour highlighted nodes without a full reload.

**Architecture:** Single client-side change. Add `onfocus={handleTagFocus}` on the combobox; in the handler call `refreshApex(this._wiredTags)`. Capture the wire result on the `@wire(getTags)` adapter (mirrors the `_wiredCaps` pattern at `bcm_CapabilityMap.js:104–121`). On every wire emission, rebuild `tagOptions` + `_tagColourMap`, then if `selectedTagId` is set call `_buildLayout(this._capabilities)` so node fills pick up the new colour. If the previously-selected tag is missing from the refreshed list, clear `selectedTagId` so the combobox returns to "None" and nodes unhighlight.

**Tech Stack:** LWC (`bcm_CapabilityMap.js` + `.html`), Jest. No Apex changes.

---

## File Structure

| File                                                                               | Reason                                                                                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`              | Add `onfocus={handleTagFocus}` to the "Colour by Tag" combobox.                                                                                       |
| `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`                | Capture `getTags` wire result, add `handleTagFocus`, rebuild layout on tag emission, clear selection if tag deleted.                                  |
| `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` | Mock `refreshApex`. New tests: focus calls `refreshApex`; second emission updates `tagOptions` / fill colour / clears `selectedTagId` if tag missing. |
| `docs/specs/diagram.md`                                                            | Append acceptance scenarios for "Tag dropdown refreshes on focus".                                                                                    |

No new files. No Apex changes. No Playwright spec changes.

---

## E2e test impact

- **Spec affected:** `docs/specs/diagram.md` — new feature heading "Tag dropdown refreshes on focus" appended after the existing "Tag highlight colourises matching capabilities" feature (after line ~215).
- **Helper change:** None.
- **Interaction pattern change:** None at the Playwright layer. All new scenarios are jest-backed; one e2e-style scenario (cross-tab edit) is marked `> Deferred:` because Playwright cannot cleanly simulate a same-org record edit and return without a costly second-tab fixture.
- **No Playwright file changes.**

---

## Task 1: Capture `getTags` wire result + handle deleted tag

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (lines 123–132 and 170–179)

The wired property currently destructures `{ data, error }` and discards the wire result object. To call `refreshApex` later we need the full result, mirroring the `_wiredCaps` pattern at line 104.

- [x] **Step 1: Add `_wiredTags` field**

Insert near line 172 (next to `_wiredCaps`):

```js
_wiredTags = null;
```

- [x] **Step 2: Replace `wiredTags` to capture the result + handle re-emissions**

Replace lines 123–132 with:

```js
    @wire(getTags)
    wiredTags(result) {
        this._wiredTags = result;
        const { data, error } = result;
        if (data) {
            this.tagOptions = [{ label: 'None', value: '' },
                ...data.map(t => ({ label: t.Name, value: t.Id, colour: t.bcm_Colour__c }))];
            this._tagColourMap = new Map(data.map(t => [t.Id, t.bcm_Colour__c]));
            // If a tag was selected and that tag no longer exists in the refreshed
            // data (deleted on the server), clear the selection so the combobox
            // returns to "None" and highlighted nodes unhighlight.
            if (this.selectedTagId && !this._tagColourMap.has(this.selectedTagId)) {
                this.selectedTagId = '';
            }
            // Rebuild layout so node fills pick up any colour change for the
            // currently selected tag. Cheap when nothing is selected (early
            // returns at top of _getTagFill).
            if (this._capabilities.length) {
                this._buildLayout(this._capabilities);
            }
        } else if (error) {
            this.errorMessage = error?.body?.message || 'Failed to load tags';
        }
    }
```

**Why rebuild layout on every emission, not just colour-changed ones:** `_buildLayout` is already called on every map/tag/zoom change and is fast (no SOQL, pure JS). Diffing old vs new colour map for a marginal speedup adds complexity without measurable gain.

**Why clear `selectedTagId` instead of leaving stale:** `_getTagFill` would silently fall through to white (the lookup misses), but the combobox would still display the deleted tag's label until the user picks again — confusing.

---

## Task 2: Add focus handler to combobox

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` (lines 17–23)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (near line 573 — `handleTagChange`)

- [x] **Step 1: Add `onfocus` binding in the template**

Replace lines 17–23 (`<lightning-combobox label="Colour by Tag" …>`) with:

```html
<lightning-combobox
    label="Colour by Tag"
    placeholder="None"
    options="{tagOptions}"
    value="{selectedTagId}"
    onfocus="{handleTagFocus}"
    onchange="{handleTagChange}"
>
</lightning-combobox>
```

- [x] **Step 2: Add `handleTagFocus` method**

Insert immediately above `handleTagChange` (line 573):

```js
    handleTagFocus() {
        if (!this._wiredTags) return;
        // Fire-and-forget: refresh the wire so any colour edits made in
        // another tab propagate. The wire callback rebuilds tagOptions /
        // _tagColourMap and re-runs _buildLayout if a tag is selected.
        // Errors surface via the wire's `error` branch already.
        refreshApex(this._wiredTags);
    }
```

**Why no throttle:** Lightning Data Service caches wire results; repeated `refreshApex` calls within a few seconds return cached data without server round-trips. Adding a debounce is premature optimisation.

**Why no `await`:** Caller (focus event) does not need the result; the wire emission drives all downstream updates declaratively.

---

## Task 3: Jest tests

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

Existing test file already has `mockGetTags` wire adapter (lines 5, 78, 145). Add a new `describe` block at the bottom of the file for tag-focus refresh.

- [x] **Step 1: Mock `refreshApex` (top of file, near other jest.mock calls)**

`@salesforce/apex` is auto-stubbed by `sfdx-lwc-jest`, but `refreshApex` is exported as a no-op. To assert calls, add an explicit module-level mock near line 100:

```js
jest.mock(
    '@salesforce/apex',
    () => ({
        __esModule: true,
        refreshApex: jest.fn().mockResolvedValue(undefined)
    }),
    { virtual: true }
);
const { refreshApex } = require('@salesforce/apex');
```

Reset between tests by adding `refreshApex.mockClear();` to each affected `beforeEach` (or once at the top of the new `describe`).

- [x] **Step 2: Add new `describe('BcmCapabilityMap tag combobox refresh on focus', …)` block at end of file**

```js
describe('BcmCapabilityMap tag combobox refresh on focus', () => {
    let element;

    beforeEach(async () => {
        refreshApex.mockClear();
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [], error: undefined });
        mockGetTags.emit({
            data: [{ Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#FF0000' }],
            error: undefined
        });
        await flushPromises();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function getTagCombobox() {
        // Second lightning-combobox in the toolbar (first is Map)
        return element.shadowRoot.querySelectorAll('lightning-combobox')[1];
    }

    it('Focusing the tag combobox calls refreshApex on the getTags wire', () => {
        getTagCombobox().dispatchEvent(new CustomEvent('focus'));
        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('Second wire emission with a new colour updates _tagColourMap (tagOptions reflects new colour)', async () => {
        // Initial: red
        expect(
            element.shadowRoot
                .querySelectorAll('lightning-combobox')[1]
                .options.find((o) => o.value === 'TAG-1').colour
        ).toBe('#FF0000');

        // Refresh emits updated colour
        mockGetTags.emit({
            data: [{ Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#00FF00' }],
            error: undefined
        });
        await flushPromises();

        expect(
            element.shadowRoot
                .querySelectorAll('lightning-combobox')[1]
                .options.find((o) => o.value === 'TAG-1').colour
        ).toBe('#00FF00');
    });

    it('Selected L2 fill repaints when refreshed colour map changes', async () => {
        await seedLayout(element);
        // Seed L2-A1 with TAG-1 association so it would highlight
        // (re-emit caps with Tags__r populated for L2-A1)
        const capsWithTag = CAPS_DATA.map((c) =>
            c.Id === 'L2-A1' ? { ...c, Tags__r: [{ bcm_Tag__c: 'TAG-1' }] } : c
        );
        mockGetCapabilities.emit({ data: capsWithTag, error: undefined });
        await flushPromises();

        // Select tag → L2-A1 fill = red
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        await flushPromises();
        const l2 = getNode(element, 'L2-A1');
        const rectBefore = l2.shadowRoot ? null : l2.querySelector('rect, path');
        // (Use whatever pattern existing tag-fill tests use — see existing
        //  "L2 box fill matches selected tag colour" test for the exact selector
        //  to read the fill attribute.)
        // expect(...fill...).toBe('#FF0000');

        // Tag colour edited externally → wire re-emits green
        mockGetTags.emit({
            data: [{ Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#00FF00' }],
            error: undefined
        });
        await flushPromises();

        // expect(...fill...).toBe('#00FF00');
    });

    it('If the selected tag is removed from the refreshed list, selectedTagId clears', async () => {
        await seedLayout(element);
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        await flushPromises();

        // Refresh emits empty tag list (tag was deleted)
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();

        expect(getTagCombobox().value).toBe('');
    });
});
```

**Note:** The fill-repaint test (third one) reuses the existing tag-fill assertion pattern. Before writing it, read the existing "L2 box fill matches selected tag colour" test (search for that name in the file) and copy its selector/attribute approach. The test stub above leaves the assertion lines as comments — fill them in by mirroring the existing test.

---

## Task 4: Update `docs/specs/diagram.md`

**Files:**

- Modify: `docs/specs/diagram.md` (append after the existing "Tag highlight colourises matching capabilities" feature, around line 215)

- [x] **Step 1: Append new feature block**

```md
## Feature: Tag dropdown refreshes on focus

**Scenario: Focusing the dropdown calls refreshApex on the getTags wire**

Given the Map has loaded and the "Colour by Tag" combobox is visible
When the user focuses the combobox
Then `refreshApex` is called against the `getTags` wired result

> Tested by: bcm_CapabilityMap.test.js — "Focusing the tag combobox calls refreshApex on the getTags wire"

**Scenario: Edited tag colour propagates to the dropdown after focus refresh**

Given a tag's `bcm_Colour__c` was changed in another tab since the page loaded
When the user focuses the "Colour by Tag" combobox
Then the wire re-emits and `tagOptions` reflects the new colour value

> Tested by: bcm_CapabilityMap.test.js — "Second wire emission with a new colour updates \_tagColourMap (tagOptions reflects new colour)"

**Scenario: Currently selected tag recolours nodes without a page reload**

Given the user has selected a tag and capabilities are highlighted in its colour
And the tag's colour was changed in another tab
When the user focuses the combobox and the wire re-emits
Then the highlighted L2 boxes (and L3 tag rects) repaint with the new colour without a full page reload

> Tested by: bcm_CapabilityMap.test.js — "Selected L2 fill repaints when refreshed colour map changes"

**Scenario: Selected tag deleted externally clears the selection**

Given the user has a tag selected
And that tag was deleted in another tab
When the user focuses the combobox and the wire re-emits without that tag
Then `selectedTagId` clears and the combobox shows "None"

> Tested by: bcm_CapabilityMap.test.js — "If the selected tag is removed from the refreshed list, selectedTagId clears"

**Scenario: Cross-tab edit verified end-to-end**

Given the diagram is open with a tag selected
When the user edits that tag's colour on its standard record page in another tab
And returns to the diagram and focuses the combobox
Then highlighted nodes recolour to the new value

> Deferred: Playwright cannot cleanly simulate same-org cross-tab record edit + return without a costly second-context fixture; behaviour is jest-covered above and verified manually.
```

---

## Task 5: Self-review + completion bookkeeping

- [x] **Step 1: Run jest** — `npm run test:unit -- --testPathPattern=bcm_CapabilityMap` — all green.
- [x] **Step 2: Run lint** — `npm run lint` if configured; otherwise rely on pre-commit hook.
- [ ] **Step 3: Manual check** — deploy to scratch org, open diagram, edit a tag's colour in another tab, focus the combobox, confirm option list updates and (if selected) nodes recolour. _(pending — manual scratch-org verification not yet performed in this session)_
- [x] **Step 4: Tick all `- [x]` checkboxes in this plan as steps complete.**
- [x] **Step 5: FP table** — No new function point. UI-only refresh of an existing wire; no new data movement crosses the software boundary. [[feedback_mark_complete_fp_table]] — no FP row to tick.
- [x] **Step 6: Placeholder scan** — confirm no TBD/TODO before opening PR.

---

## Self-Review Notes

- **Acceptance coverage (issue #50):**
    - "refreshApex on combobox focus" → Task 2 + jest test 1.
    - "tagOptions reflects latest colour" → Task 1 + jest test 2.
    - "\_tagColourMap rebuilt" → Task 1 wire callback + jest test 2.
    - "Selected tag's colour recolours without page reload" → Task 1 layout rebuild + jest test 3.
    - "Newly-created tags appear" → free side-effect of refreshApex; covered by test 2 (option list assertion mechanism is the same).
    - "Jest test asserts refreshApex called on focus" → test 1.
    - "Spec updated with `> Tested by:`" → Task 4.
- **Why no Apex change:** The fix is entirely client-side; `bcm_TagController.getTags` already returns the data we need.
- **Why `_buildLayout` on every wiredTags emission:** Cheap, deterministic, one code path. Diffing colour maps to skip a no-op rebuild adds complexity without measurable gain.
- **Why clear `selectedTagId` on deletion:** Avoids stale combobox label; matches "None" fallback behaviour the user already expects.
- **Risks:** None substantive. The added refresh is bounded (LDS-cached) and the deleted-tag guard is defensive.

---

## Post-merge fix (2026-06-07)

**Problem:** Manual verification on scratch org showed the dropdown still appeared stale because the original change only refreshed `_wiredTags`. Tag-capability _junctions_ live in `bcm_CapabilityController.getCapabilities` (the `Tags__r` subquery), so editing a junction in another tab did not propagate even after focus.

**Fix:** `handleTagFocus` now also refreshes `_wiredCaps`:

```js
handleTagFocus() {
    if (this._wiredTags) refreshApex(this._wiredTags);
    if (this._wiredCaps) refreshApex(this._wiredCaps);
}
```

**Test additions** (`bcm_CapabilityMap.test.js`, "tag combobox refresh on focus" describe):

- "Focusing the tag combobox refreshes both getTags and getCapabilities wires" — asserts `refreshApex` called twice.
- "Focus refreshes capabilities so junction edits propagate to node fills" — emits a re-fetched `getCapabilities` payload with `Tags__r: []` and asserts the L2 fill returns to white.

**Spec update:** `docs/specs/diagram.md` — replaced the original "Focusing the dropdown calls refreshApex on the getTags wire" scenario with one that covers both wires, and added a "Junction edits propagate to node fills after focus" scenario.
