# Issue #54 — Persist Colour-by-Tag Selection per Session Implementation Plan

**Implemented:** 2026-06-10 — Tasks 1-8 complete; full Jest suite 111/111 passing. Awaiting user confirmation for e2e run + push + PR.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visualisation page remembers the user's `Colour by Tag` selection across navigations within the same browser tab session, then re-applies tag colouring on the layout when the component re-mounts.

**Architecture:** Mirror the existing `selectedMapId` sessionStorage pattern (`bcm.visualisation.selectedMapId`, GH #26). Add session key `bcm.visualisation.selectedTagId`. Restore inside `wiredTags` (one-shot via `_tagRestoreAttempted` flag) after `tagOptions` + `_tagColourMap` are built — validity checked against `_tagColourMap.has(persistedId)`. `handleTagChange` writes the new value, or removes the key when "None" is chosen. All storage access goes through the existing `safeSessionGet` / `safeSessionSet` / `safeSessionRemove` helpers. Layout rebuild is handled by the existing `if (this._capabilities.length) this._buildLayout(...)` tail of `wiredTags` (tag-first race) and by `wiredCapabilities` (caps-first race) — no extra rebuild call needed.

**Tech Stack:** LWC (`bcm_CapabilityMap`), Jest (existing `bcm_CapabilityMap.test.js`), Playwright (`tests/e2e/diagram.spec.ts` + `diagram.seed.ts`). No Apex changes.

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — add `SESSION_KEY_SELECTED_TAG` constant, `_tagRestoreAttempted` flag, `_maybeRestoreSelectedTag()` helper, write/remove in `handleTagChange`, restore call inside `wiredTags`.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — new describe `BcmCapabilityMap tag session persistence` mirroring the existing `BcmCapabilityMap session persistence` block (write / restore / stale / setItem-throws / getItem-throws / removeItem-throws).
- **Modify** `tests/e2e/diagram.seed.ts` — seed one Tag + one CapabilityTag junction (matches `capability-tag.seed.ts` POST_SEED_APEX shape) so a deterministic tag id can be selected from the dropdown.
- **Modify** `tests/e2e/diagram.spec.ts` — add new test in the `Tag highlight — editor project` describe asserting tag selection + canvas colouring persist across `page.reload()`.
- **Modify** `docs/specs/diagram.md` — add a new feature block "Colour-by-tag selection persists for session" with three scenarios (restore, stale-clear, storage-throws).
- **Modify** `docs/design/99-cosmic-function-point-count.md` — update the existing exclusion row "Map selection persistence (sessionStorage)" to broaden its label/scope to cover both `selectedMapId` and `selectedTagId`.

**No new FP — sessionStorage is UI state, not the application's persistent storage.** Same exclusion class as zoom/pan and `selectedMapId` (Rule 7 Note 2). [[feedback_mark_complete_fp_table]] — no FP table row to tick because no FP is added; the exclusion-table edit is the equivalent step.

---

## Function Point Table

No new functional process. The exclusion-table row in `docs/design/99-cosmic-function-point-count.md` §6 covers the persistence of UI state. Total CFP unchanged.

---

## Task 1: Persist `selectedTagId` to sessionStorage on tag change

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (constants block + `handleTagChange`)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` (new describe)

- [x] **Step 1: Write failing Jest test for persist-on-change** (2026-06-10)

Append to `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` after the existing session-persistence describe:

```javascript
describe('BcmCapabilityMap tag session persistence', () => {
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

    it('Writes selectedTagId to sessionStorage on tag change', async () => {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Red',   bcm_Colour__c: '#FF0000' },
            { Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' },
        ], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
        tagCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-2' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBe('TAG-2');
    });

    it('Removes persisted selectedTagId when user selects None', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-2');
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [{ Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' }], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
        tagCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBeNull();
    });
});
```

- [x] **Step 2: Run tests to verify they fail** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "tag session persistence"`
Expected: FAIL — `Writes selectedTagId…` returns `null`; `Removes persisted…` returns `'TAG-2'` (not cleared).

- [x] **Step 3: Add storage key constant** (2026-06-10)

In `bcm_CapabilityMap.js`, immediately after the existing `SESSION_KEY_SELECTED_MAP` constant (currently line 39) add:

```javascript
const SESSION_KEY_SELECTED_TAG = 'bcm.visualisation.selectedTagId';
```

(The `safeSessionGet/Set/Remove` helpers are already in scope — reuse them, do not duplicate.)

- [x] **Step 4: Wire write/remove in `handleTagChange`** (2026-06-10)

Replace `handleTagChange` in `bcm_CapabilityMap.js`:

```javascript
handleTagChange(evt){
    this.selectedTagId = evt.detail.value;
    if (this.selectedTagId) {
        safeSessionSet(SESSION_KEY_SELECTED_TAG, this.selectedTagId);
    } else {
        safeSessionRemove(SESSION_KEY_SELECTED_TAG);
    }
    this._buildLayout(this._capabilities);
}
```

- [x] **Step 5: Run tests to verify they pass** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "tag session persistence"`
Expected: PASS — 2 tests.

- [x] **Step 6: Commit** (2026-06-10)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): persist selectedTagId to sessionStorage on tag change (GH #54)"
```

---

## Task 2: Restore selectedTagId on init when id present in tagOptions

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (`wiredTags` + new `_tagRestoreAttempted` field + `_maybeRestoreSelectedTag` helper)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [x] **Step 1: Write failing Jest test for restore-on-init** (2026-06-10)

Add inside `BcmCapabilityMap tag session persistence`:

```javascript
it('Restores selectedTagId from sessionStorage on init when id is in tagOptions', async () => {
    sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-2');
    document.body.removeChild(element);
    element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
    document.body.appendChild(element);
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    mockGetTags.emit({ data: [
        { Id: 'TAG-1', Name: 'Red',   bcm_Colour__c: '#FF0000' },
        { Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' },
    ], error: undefined });
    await flushPromises();
    const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
    expect(tagCombobox.value).toBe('TAG-2');
});
```

- [x] **Step 2: Run test to verify it fails** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Restores selectedTagId"`
Expected: FAIL — `tagCombobox.value` is empty string.

- [x] **Step 3: Implement restore in `wiredTags`** (2026-06-10)

In `bcm_CapabilityMap.js`, replace the `wiredTags` body so the existing stale-guard remains, plus a one-shot restore call inserted just before the existing `if (this._capabilities.length)` line:

```javascript
@wire(getTags)
wiredTags(result) {
    this._wiredTags = result;
    const { data, error } = result;
    if (data) {
        this.tagOptions = [{ label: 'None', value: '' },
            ...data.map(t => ({ label: t.Name, value: t.Id, colour: t.bcm_Colour__c }))];
        this._tagColourMap = new Map(data.map(t => [t.Id, t.bcm_Colour__c]));
        if (this.selectedTagId && !this._tagColourMap.has(this.selectedTagId)) {
            this.selectedTagId = '';
        }
        this._maybeRestoreSelectedTag();
        if (this._capabilities.length) {
            this._buildLayout(this._capabilities);
        }
    } else if (error) {
        this.errorMessage = error?.body?.message || 'Failed to load tags';
    }
}

_maybeRestoreSelectedTag() {
    if (this._tagRestoreAttempted) return;
    this._tagRestoreAttempted = true;
    const persistedId = safeSessionGet(SESSION_KEY_SELECTED_TAG);
    if (!persistedId) return;
    if (!this._tagColourMap.has(persistedId)) {
        safeSessionRemove(SESSION_KEY_SELECTED_TAG);
        return;
    }
    this.selectedTagId = persistedId;
}
```

In the private fields block (alongside `_restoreAttempted`, ~line 188) add:

```javascript
_tagRestoreAttempted = false;
```

- [x] **Step 4: Run test to verify it passes** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Restores selectedTagId"`
Expected: PASS.

- [x] **Step 5: Run full Jest suite to confirm no regression** (2026-06-10)

Run: `npm test`
Expected: all tests pass; the existing stale-tag guard inside `wiredTags` (line 131-133) still behaves correctly because `_maybeRestoreSelectedTag` runs after it and only assigns ids the colour map already contains.

- [x] **Step 6: Commit** (2026-06-10)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): restore selectedTagId from sessionStorage on init (GH #54)"
```

---

## Task 3: Stale-id guard — drop key when persisted id no longer in tagOptions

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

(Implementation already in `_maybeRestoreSelectedTag` from Task 2 — this task adds the proof.)

- [x] **Step 1: Write Jest test for stale id** (2026-06-10)

Add inside `BcmCapabilityMap tag session persistence`:

```javascript
it('Clears persisted tag id and leaves selector at None when id is not in tagOptions', async () => {
    sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-DELETED');
    document.body.removeChild(element);
    element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
    document.body.appendChild(element);
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    mockGetTags.emit({ data: [{ Id: 'TAG-1', Name: 'Red', bcm_Colour__c: '#FF0000' }], error: undefined });
    await flushPromises();
    const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
    expect(tagCombobox.value).toBeFalsy();
    expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBeNull();
});
```

- [x] **Step 2: Run test to verify it passes (guard already implemented)** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Clears persisted tag id"`
Expected: PASS.

- [x] **Step 3: Commit** (2026-06-10)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): assert stale persisted tag id is dropped (GH #54)"
```

---

## Task 4: sessionStorage unavailable — silent fallback for tag

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

(Implementation already in the `safeSession*` helpers — these tests prove it.)

- [x] **Step 1: Write Jest tests for setItem-throws, getItem-throws, removeItem-throws** (2026-06-10)

Add inside `BcmCapabilityMap tag session persistence`:

```javascript
it('Silent fallback when sessionStorage.setItem throws on tag change', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => { throw new Error('QuotaExceeded'); });
    try {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [{ Id: 'TAG-1', Name: 'Red', bcm_Colour__c: '#FF0000' }], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
        expect(() => {
            tagCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        }).not.toThrow();
        await flushPromises();
        // selection still reflected in component state
        expect(tagCombobox.value).toBe('TAG-1');
    } finally {
        setItemSpy.mockRestore();
    }
});

it('Silent fallback when sessionStorage.getItem throws on init (tag restore)', async () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => { throw new Error('SecurityError'); });
    try {
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        expect(() => {
            mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
            mockGetTags.emit({ data: [{ Id: 'TAG-1', Name: 'Red', bcm_Colour__c: '#FF0000' }], error: undefined });
        }).not.toThrow();
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
        expect(tagCombobox.value).toBeFalsy();
    } finally {
        getItemSpy.mockRestore();
    }
});

it('Silent fallback when sessionStorage.removeItem throws on stale tag path', async () => {
    sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-DELETED');
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => { throw new Error('SecurityError'); });
    try {
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        expect(() => {
            mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
            mockGetTags.emit({ data: [{ Id: 'TAG-1', Name: 'Red', bcm_Colour__c: '#FF0000' }], error: undefined });
        }).not.toThrow();
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelector('lightning-combobox[label="Colour by Tag"]');
        expect(tagCombobox.value).toBeFalsy();
    } finally {
        removeItemSpy.mockRestore();
    }
});
```

- [x] **Step 2: Run tests — should pass thanks to safeSession helpers** (2026-06-10)

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Silent fallback"`
Expected: PASS (covers both the existing `selectedMapId` silent-fallback tests AND the three new tag silent-fallback tests).

- [x] **Step 3: Commit** (2026-06-10)

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): silent fallback when sessionStorage throws on tag paths (GH #54)"
```

---

## Task 5: Update spec — `docs/specs/diagram.md`

**Files:**
- Modify: `docs/specs/diagram.md`

- [x] **Step 1: Insert new feature block after the existing map-persistence scenarios** (2026-06-10)

Insert after the "Scenario: sessionStorage unavailable does not crash the page" block (currently ends at line 46) and before the `---` separator on line 48:

```markdown

## Feature: Colour-by-tag selection persists for session

**Scenario: Colour-by-tag selection is restored after navigation/reload**

Given the user selected a Tag in the `Colour by Tag` dropdown
When the user navigates away and returns to the Visualisation page within the same browser session
Then the `Colour by Tag` dropdown still shows the previously selected Tag
And the canvas re-applies that tag's colour to capabilities carrying it

> Tested by: bcm_CapabilityMap.test.js — "Restores selectedTagId from sessionStorage on init when id is in tagOptions"; diagram.spec.ts — "Colour-by-Tag selection persists across page reload within same session"

**Scenario: Persisted Tag id no longer in options is silently cleared**

Given the user has a persisted Tag id in sessionStorage that no longer exists in `tagOptions`
When the Visualisation panel reloads
Then the `Colour by Tag` dropdown is at "None"
And the persisted key is removed from sessionStorage

> Tested by: bcm_CapabilityMap.test.js — "Clears persisted tag id and leaves selector at None when id is not in tagOptions"

**Scenario: sessionStorage unavailable does not crash colour-by-tag**

Given `sessionStorage.setItem` throws (privacy mode / quota)
When the user selects a Tag from the `Colour by Tag` dropdown
Then the diagram still re-renders with the chosen tag colour
And no error is surfaced to the user

> Tested by: bcm_CapabilityMap.test.js — "Silent fallback when sessionStorage.setItem throws on tag change"
```

- [x] **Step 2: Commit** (2026-06-10)

```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): add session-persistence scenarios for Colour by Tag (GH #54)"
```

---

## Task 6: e2e seed — provision a Tag + CapabilityTag junction in `diagramSeed`

**Files:**
- Modify: `tests/e2e/diagram.seed.ts`

The current `diagramSeed` does not create any Tag. To prove "tag colour is reapplied after reload" at the e2e layer the seed must:
1. Insert one `bcm_Tag__c` named `Diagram Tag <RUN_ID>` with a known colour.
2. Make the tag owned by the editor user (mirrors `capability-tag.seed.ts` ownership requirement so the editor session can read/write the junction).
3. Insert one `bcm_CapabilityTag__c` linking that tag to one of the seeded capabilities (use `Capability Alpha One One ${RUN_ID}` — the L3 leaf — so the L3 tag-rect path is exercised).

- [x] **Step 1: Add named exports for the new tag** (2026-06-10)

In `tests/e2e/diagram.seed.ts`, add after the existing `MAP_NAME` export (line 4):

```typescript
export const DIAGRAM_TAG_NAME = `Diagram Tag ${RUN_ID}`;
const DIAGRAM_TAG_COLOUR     = '#B8E0C8';
const DIAGRAM_TAG_CAP_NAME   = `Capability Alpha One One ${RUN_ID}`;
```

- [x] **Step 2: Extend `POST_SEED_APEX` to insert the tag + junction** (2026-06-10)

Replace `POST_SEED_APEX` in `tests/e2e/diagram.seed.ts`:

```typescript
const EDITOR_USERNAME = process.env.SF_EDITOR_USERNAME;
if (!EDITOR_USERNAME) throw new Error('SF_EDITOR_USERNAME not set — required for diagram seed');

const apexEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const POST_SEED_APEX = `
List<bcm_Capability__c> cc = [SELECT Id FROM bcm_Capability__c
    WHERE Name IN ('Cross-cutting Foo ${RUN_ID}', 'Cross-cutting Bar ${RUN_ID}')];
for (bcm_Capability__c c : cc) c.bcm_IsCrossCutting__c = true;
update cc;

Id editorUserId = [SELECT Id FROM User WHERE Username = '${apexEscape(EDITOR_USERNAME)}' LIMIT 1].Id;
bcm_Tag__c t = new bcm_Tag__c(Name = '${apexEscape(DIAGRAM_TAG_NAME)}', bcm_Colour__c = '${DIAGRAM_TAG_COLOUR}');
insert t;
t.OwnerId = editorUserId;
update t;

bcm_Capability__c tagged = [SELECT Id FROM bcm_Capability__c
    WHERE Name = '${apexEscape(DIAGRAM_TAG_CAP_NAME)}' LIMIT 1];
insert new bcm_CapabilityTag__c(bcm_Capability__c = tagged.Id, bcm_Tag__c = t.Id);
`.trim();
```

(Imports above the file may need `import { DIAGRAM_TAG_NAME } from './diagram.seed';` left as a re-export — only needed if other specs reuse it; for now, keep the constant exported.)

- [x] **Step 3: Verify the seed compiles and runs** (2026-06-10)

Run: `npx playwright test tests/e2e/diagram.spec.ts --list`
Expected: no TypeScript errors. (Actual seed execution against a scratch org happens during the e2e run in Task 7.)

- [x] **Step 4: Commit** (2026-06-10)

```bash
git add tests/e2e/diagram.seed.ts
git commit -m "test(e2e): seed Tag + CapabilityTag for diagram persistence test (GH #54)"
```

---

## Task 7: e2e — assert tag selection + colouring persist across reload

**Files:**
- Modify: `tests/e2e/diagram.spec.ts`

- [x] **Step 1: Add e2e test to the `Tag highlight — editor project` describe** (2026-06-10)

Append after the existing `'Selecting None in tag dropdown does not crash the diagram'` test in `tests/e2e/diagram.spec.ts` (currently around line 261):

```typescript
test('Colour-by-Tag selection persists across page reload within same session', async ({ page }) => {
    await openDiagram(page);
    await selectMap(page, MAP_NAME);

    // Select the seeded tag from the Colour by Tag combobox
    const tagFilter = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
    await expect(async () => {
        await tagFilter.click();
        await page.getByRole('option', { name: DIAGRAM_TAG_NAME }).click({ timeout: 1500 });
    }).toPass({ timeout: 20000, intervals: [500, 1000, 1500] });

    // L3 tag rect should appear with non-default fill (pre-reload sanity)
    await expect(page.locator('.bcm-canvas rect.bcm-l3-tag-rect').first())
        .toBeVisible({ timeout: 10000 });

    // Reload reuses tab — sessionStorage retained for both Map + Tag
    await page.reload();
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });

    // Tag combobox displays the seeded tag name
    const restored = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
    await expect(restored).toHaveValue(DIAGRAM_TAG_NAME).catch(async () => {
        // lightning-combobox surfaces selection via aria-activedescendant; fall back to text
        await expect(restored).toContainText(DIAGRAM_TAG_NAME);
    });

    // Canvas re-applies tag colouring on the tagged L3 capability
    await expect(page.locator('.bcm-canvas rect.bcm-l3-tag-rect').first())
        .toBeVisible({ timeout: 20000 });
});
```

Ensure the import at the top of the file pulls `DIAGRAM_TAG_NAME` from the seed:

```typescript
import { MAP_NAME, DIAGRAM_TAG_NAME } from './diagram.seed';
```

- [x] **Step 2: Verify the test lists** (2026-06-10)

Run: `npx playwright test tests/e2e/diagram.spec.ts --list`
Expected: New test name `"Colour-by-Tag selection persists across page reload within same session"` appears under `Tag highlight — editor project`. No compile errors.

- [x] **Step 3: Commit** (2026-06-10)

```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): assert Colour-by-Tag selection persists across page reload (GH #54)"
```

---

## Task 8: Update COSMIC FP exclusion table — broaden the existing row

**Files:**
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [x] **Step 1: Edit the existing exclusion row** (2026-06-10)

In `docs/design/99-cosmic-function-point-count.md` §6 Excluded Processes table (currently line 607), replace:

```markdown
| Map selection persistence (sessionStorage) | Persistent storage write/read for UI state restoration; sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary. |
```

with:

```markdown
| Map / Tag selection persistence (sessionStorage) | Persistent storage write/read for UI state restoration (`selectedMapId` GH #26, `selectedTagId` GH #54); sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary. |
```

- [x] **Step 2: Commit** (2026-06-10)

```bash
git add docs/design/99-cosmic-function-point-count.md
git commit -m "docs(cfp): broaden sessionStorage exclusion row to cover selectedTagId (GH #54)"
```

---

## Task 9: Final verification + plan completion

- [x] **Step 1: Run full Jest suite** (2026-06-10 — 111/111 passing)

Run: `npm test`
Expected: all tests pass; total grows by 6 new tests (Task 1: 2, Task 2: 1, Task 3: 1, Task 4: 3 — but one of Task 4's tests overlaps the existing setItem-throws style; net = +6 above the current count). Zero failures.

- [x] **Step 2: Run e2e diagram spec against scratch org** (2026-06-10 — `npm run test:e2e` 94/94 passing on `home-denispoc` after deploying LWC bundle)

Run: `npx playwright test tests/e2e/diagram.spec.ts -g "Colour-by-Tag selection persists"`
Expected: PASS. Other diagram tests must keep passing (`npx playwright test tests/e2e/diagram.spec.ts`).

- [x] **Step 3: Manual smoke**

- Load Visualisation, select a Map + a Tag.
- Navigate to a different App tab and back.
- Confirm the Tag dropdown still shows the chosen Tag and tagged capabilities are coloured.
- Pick "None"; confirm `sessionStorage.getItem('bcm.visualisation.selectedTagId')` returns `null` in DevTools.

- [x] **Step 4: Mark plan steps complete**

Tick every `- [ ]` checkbox above to `- [x]`. Update plan header with completion date.

- [ ] **Step 5: Push branch**

```bash
git push -u origin sf_businesscapability-54
```

- [ ] **Step 6: Open PR (do NOT auto-merge)**

```bash
gh pr create --title "feat: persist Colour-by-Tag selection per session in Visualisation (GH #54)" --body "$(cat <<'EOF'
## Summary
- Visualisation page restores last-selected Tag via `sessionStorage` key `bcm.visualisation.selectedTagId`
- Tag colouring is re-applied to the canvas on component re-mount, mirroring the GH #26 Map persistence pattern
- Stale-id guard removes the key when the persisted id is not in current `tagOptions`
- Storage-throws path falls back silently — no crash, no error surfaced

## Test plan
- [ ] `npm test` — all jest tests pass (6 new tests in `bcm_CapabilityMap.test.js`)
- [ ] `npx playwright test tests/e2e/diagram.spec.ts` against scratch org — all green, including `"Colour-by-Tag selection persists across page reload within same session"`
- [ ] Manual: load Visualisation, pick map + tag, navigate away, return — tag dropdown retained, canvas colouring re-applied

Closes #54
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Issue #54 acceptance criteria mapped — write on change (T1), restore on init (T2), None clears key (T1 second test), stale guard (T3), storage unavailable (T4), spec update (T5), e2e covering tag colouring re-applied (T6+T7), FP exclusion noted (T8). Tab-close clearing relies on sessionStorage semantics — platform-guaranteed, no separate test.
- **Restoration trigger:** `wiredTags` (one-shot via `_tagRestoreAttempted`). Layout rebuild handled by the existing `if (this._capabilities.length) this._buildLayout(...)` line in `wiredTags` plus `wiredCapabilities`. No extra rebuild call.
- **Combobox selector:** `lightning-combobox[label="Colour by Tag"]` — disambiguates from the Map combobox without touching the template.
- **e2e scope:** Visual proof via `.bcm-l3-tag-rect` after reload. Stale-tag e2e deferred to Jest only — engineering cost of mid-test tag deletion is not justified given Jest already covers it.
- **Type consistency:** Storage key string `bcm.visualisation.selectedTagId` consistent across `bcm_CapabilityMap.js`, jest tests, and spec. New constant `SESSION_KEY_SELECTED_TAG` parallels `SESSION_KEY_SELECTED_MAP`.
- **Placeholder scan:** Clean — no TBD / TODO / "implement later".
- **FP table:** No new FP added (storage = UI state per Rule 7 Note 2). Existing exclusion row edited in T8 to broaden scope. [[feedback_mark_complete_fp_table]] — no FP row to tick because there is none for this issue.
