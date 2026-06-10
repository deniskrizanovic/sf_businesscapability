# Issue #26 — Persist Selected Map per Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visualisation page remembers the user's selected Map across navigations within the same browser tab session.

**Architecture:** Add `connectedCallback` to `bcm_CapabilityMap` LWC that reads `bcm.visualisation.selectedMapId` from `sessionStorage`. After the `getMaps` wire resolves, if the persisted id is present in `mapOptions`, restore selection and call `_loadCapabilities()`. `handleMapChange` writes the id; selecting the empty value clears the key. All storage access wrapped in try/catch so quota / privacy-mode failures stay silent.

**Tech Stack:** LWC (`bcm_CapabilityMap`), Jest, Playwright, Salesforce Apex (no Apex changes).

---

## File Structure

- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — add storage helpers + restore logic
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — new describe block for persistence
- **Modify** `docs/specs/diagram.md` — add scenarios under a new "Map selection persists for session" feature
- **Modify** `tests/e2e/diagram.spec.ts` — add new test in `Map selector` suite (reload + assert dropdown retained, polygon present)
- **Modify** `docs/design/99-cosmic-function-point-count.md` — add row to §6 "Excluded Processes" (sessionStorage = persistent UI state, not a functional user per Rule 7 Note 2)

**No new FP — sessionStorage is UI state, not the application's persistent storage. Same exclusion class as zoom/pan.**

---

## Task 1: Persist `selectedMapId` to sessionStorage on map change

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (top constants + `handleMapChange`)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` (new describe)

- [ ] **Step 1: Write failing Jest test for persist-on-change**

Append to `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`:

```javascript
describe('BcmCapabilityMap session persistence', () => {
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

    it('Writes selectedMapId to sessionStorage on map change', async () => {
        mockGetMaps.emit({
            data: [
                { Id: 'MAP-1', Name: 'Map 1' },
                { Id: 'MAP-2', Name: 'Map 2' }
            ],
            error: undefined
        });
        await flushPromises();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-2' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedMapId')).toBe('MAP-2');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "session persistence"`
Expected: FAIL — `expect(received).toBe(expected) // Object.is equality` (received `null`, expected `'MAP-2'`).

- [ ] **Step 3: Add storage key constant + write helper**

In `bcm_CapabilityMap.js`, after the `ZOOM_DEFAULT` constant (~line 26) add:

```javascript
const SESSION_KEY_SELECTED_MAP = 'bcm.visualisation.selectedMapId';

function safeSessionGet(key) {
    try {
        return sessionStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

function safeSessionSet(key, value) {
    try {
        sessionStorage.setItem(key, value);
    } catch (_) {
        /* silent */
    }
}

function safeSessionRemove(key) {
    try {
        sessionStorage.removeItem(key);
    } catch (_) {
        /* silent */
    }
}
```

- [ ] **Step 4: Wire write in `handleMapChange`**

Modify `handleMapChange` in `bcm_CapabilityMap.js`:

```javascript
handleMapChange(evt) {
    this.selectedMapId      = evt.detail.value;
    this.contextMenuVisible = false;
    this.zoom = ZOOM_DEFAULT;
    this.panX = 0;
    this.panY = 0;
    if (this.selectedMapId) {
        safeSessionSet(SESSION_KEY_SELECTED_MAP, this.selectedMapId);
    } else {
        safeSessionRemove(SESSION_KEY_SELECTED_MAP);
    }
    this._loadCapabilities();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "session persistence"`
Expected: PASS — 1 test.

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): persist selectedMapId to sessionStorage on map change (GH #26)"
```

---

## Task 2: Restore selection on component init when id present in mapOptions

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` (`wiredMaps` + new private flag)
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [ ] **Step 1: Write failing Jest test for restore-on-init**

Add inside the `BcmCapabilityMap session persistence` describe:

```javascript
it('Restores selectedMapId from sessionStorage on init when id is in mapOptions', async () => {
    sessionStorage.setItem('bcm.visualisation.selectedMapId', 'MAP-2');
    document.body.removeChild(element);
    mockCapabilitiesImpl.mockClear();
    element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
    document.body.appendChild(element);
    mockGetMaps.emit({
        data: [
            { Id: 'MAP-1', Name: 'Map 1' },
            { Id: 'MAP-2', Name: 'Map 2' }
        ],
        error: undefined
    });
    await flushPromises();
    const combobox = element.shadowRoot.querySelector('lightning-combobox');
    expect(combobox.value).toBe('MAP-2');
    expect(mockCapabilitiesImpl).toHaveBeenCalledWith({ mapId: 'MAP-2' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Restores selectedMapId"`
Expected: FAIL — `combobox.value` is empty / undefined; `mockCapabilitiesImpl` not called.

- [ ] **Step 3: Implement restore in `wiredMaps`**

Replace `wiredMaps` in `bcm_CapabilityMap.js`:

```javascript
@wire(getMaps)
wiredMaps({ data, error }) {
    if (data) {
        this.mapOptions = data.map(m => ({ label: m.Name, value: m.Id }));
        this._maybeRestoreSelectedMap();
    } else if (error) {
        this.errorMessage = error?.body?.message || 'Failed to load maps';
    }
}

_maybeRestoreSelectedMap() {
    if (this._restoreAttempted) return;
    this._restoreAttempted = true;
    const persistedId = safeSessionGet(SESSION_KEY_SELECTED_MAP);
    if (!persistedId) return;
    const isValid = this.mapOptions.some(opt => opt.value === persistedId);
    if (!isValid) {
        safeSessionRemove(SESSION_KEY_SELECTED_MAP);
        return;
    }
    this.selectedMapId = persistedId;
    this._loadCapabilities();
}
```

Also add to the private fields block (~line 107 alongside `_isDragging`):

```javascript
_restoreAttempted = false;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Restores selectedMapId"`
Expected: PASS — 1 test.

- [ ] **Step 5: Run all jest tests to confirm no regression**

Run: `npm test`
Expected: all tests pass (≥66 now, was 64).

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js \
        force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "feat(visualisation): restore selectedMapId from sessionStorage on init (GH #26)"
```

---

## Task 3: Stale-id guard — drop key if persisted id not in mapOptions

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

(Implementation already in `_maybeRestoreSelectedMap` from Task 2 — this task adds the test that proves the guard.)

- [ ] **Step 1: Write failing Jest test for stale id**

Add inside the `BcmCapabilityMap session persistence` describe:

```javascript
it('Clears persisted id and leaves selector empty when id is not in mapOptions', async () => {
    sessionStorage.setItem('bcm.visualisation.selectedMapId', 'MAP-DELETED');
    document.body.removeChild(element);
    mockCapabilitiesImpl.mockClear();
    element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
    document.body.appendChild(element);
    mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
    await flushPromises();
    const combobox = element.shadowRoot.querySelector('lightning-combobox');
    expect(combobox.value).toBeFalsy();
    expect(sessionStorage.getItem('bcm.visualisation.selectedMapId')).toBeNull();
    expect(mockCapabilitiesImpl).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it passes (guard already implemented)**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Clears persisted id"`
Expected: PASS — proves Task 2's implementation.

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): assert stale persisted mapId is dropped (GH #26)"
```

---

## Task 4: sessionStorage unavailable — silent fallback

**Files:**

- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

(Implementation already in `safeSession*` helpers from Task 1 — this task proves it.)

- [ ] **Step 1: Write failing Jest test for storage-throws case**

Add inside the `BcmCapabilityMap session persistence` describe:

```javascript
it('Silent fallback when sessionStorage.setItem throws (no crash, no abort)', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
    });
    try {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        await flushPromises();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        // Should not throw — assertion is reaching this line
        expect(() => {
            combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-1' } }));
        }).not.toThrow();
        await flushPromises();
        // _loadCapabilities was still called despite write failure
        expect(mockCapabilitiesImpl).toHaveBeenCalledWith({ mapId: 'MAP-1' });
    } finally {
        setItemSpy.mockRestore();
    }
});
```

- [ ] **Step 2: Run test — should pass thanks to safeSessionSet**

Run: `npx jest force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js -t "Silent fallback"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): silent fallback when sessionStorage throws (GH #26)"
```

---

## Task 5: Update spec — `docs/specs/diagram.md`

**Files:**

- Modify: `docs/specs/diagram.md`

- [ ] **Step 1: Insert new feature block after the existing `Feature: Map selector loads available Maps` section (line 21, before `---`)**

Insert this content immediately after the "No map is selected on initial load" `> Tested by:` line and before the `---` separator on line 21:

```markdown
**Scenario: Map selection persists for session — restore after navigation**

Given the user selected a Map in the Visualisation page  
When the user navigates to another tab and returns within the same browser session  
Then the Map dropdown still shows the previously selected Map  
And the canvas renders the capabilities for that Map

> Tested by: bcm_CapabilityMap.test.js — "Restores selectedMapId from sessionStorage on init when id is in mapOptions"; diagram.spec.ts — "Selected map persists across page reload within same session"

**Scenario: Persisted Map id no longer in options is silently cleared**

Given the user has a persisted Map id in sessionStorage that no longer exists in `mapOptions`  
When the Visualisation panel reloads  
Then the dropdown is empty  
And the persisted key is removed from sessionStorage

> Tested by: bcm_CapabilityMap.test.js — "Clears persisted id and leaves selector empty when id is not in mapOptions"

**Scenario: sessionStorage unavailable does not crash the page**

Given `sessionStorage.setItem` throws (privacy mode / quota)  
When the user selects a Map  
Then the diagram still loads capabilities for that map  
And no error is surfaced to the user

> Tested by: bcm_CapabilityMap.test.js — "Silent fallback when sessionStorage.setItem throws (no crash, no abort)"
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/diagram.md
git commit -m "docs(specs): add session-persistence scenarios for Map selector (GH #26)"
```

---

## Task 6: e2e — assert dropdown retained across reload

**Files:**

- Modify: `tests/e2e/diagram.spec.ts`

- [ ] **Step 1: Add e2e test inside the `Map selector — editor project` describe**

Append after the `'Canvas shows no chevrons before a map is selected'` test (line 121) and before the closing `});` of `Map selector — editor project`:

```typescript
test('Selected map persists across page reload within same session', async ({ page }) => {
    await openDiagram(page);
    await selectMapFromCombobox(page);
    // Reload reuses tab — sessionStorage retained
    await page.reload();
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
    // Polygon must render without re-selecting from dropdown
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
    // Combobox displays the seeded map name
    const combobox = page.getByRole('combobox', { name: 'Map' }).first();
    await expect(combobox)
        .toHaveValue(MAP_NAME)
        .catch(async () => {
            // lightning-combobox surfaces selection via aria-activedescendant; fall back to text
            await expect(combobox).toContainText(MAP_NAME);
        });
});
```

- [ ] **Step 2: Verify e2e file is syntactically valid (TypeScript compile via Playwright)**

Run: `npx playwright test tests/e2e/diagram.spec.ts --list`
Expected: New test name appears in the list, no compile errors. (Do not actually execute against an org during plan execution — that's a separate manual run.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): assert selected map persists across page reload (GH #26)"
```

---

## Task 7: Note exclusion in COSMIC FP doc

**Files:**

- Modify: `docs/design/99-cosmic-function-point-count.md`

- [ ] **Step 1: Add row to §6 Excluded Processes table**

Append after the existing "Context menu display" row in the §6 Excluded Processes table (~line 624):

```markdown
| Map selection persistence (sessionStorage) | Persistent storage write/read for UI state restoration; sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/99-cosmic-function-point-count.md
git commit -m "docs(cfp): exclude session-persistence from FP count (GH #26)"
```

---

## Task 8: Final verification + plan completion

- [ ] **Step 1: Run full Jest suite**

Run: `npm test`
Expected: all tests pass; total = 64 + 4 (Task 1, 2, 3, 4 each add 1 test) = **68 tests, 0 failures**.

- [ ] **Step 2: Mark plan steps complete**

Tick every `- [ ]` checkbox above to `- [x]`. Update this plan's header with completion date if not already done by template.

- [ ] **Step 3: Push branch**

```bash
git push -u origin sf_businesscapability-26
```

- [ ] **Step 4: Open PR (do NOT auto-merge)**

```bash
gh pr create --title "feat: persist selected Map per session in Visualisation (GH #26)" --body "$(cat <<'EOF'
## Summary
- Visualisation page restores last-selected Map via `sessionStorage` key `bcm.visualisation.selectedMapId`
- Stale-id guard removes key when persisted id is not in current `mapOptions`
- Storage-throws path falls back silently — no crash, no error surfaced

## Test plan
- [ ] `npm test` — 68 tests, 0 failures (4 new in `bcm_CapabilityMap.test.js`)
- [ ] `npx playwright test tests/e2e/diagram.spec.ts -g "persists across page reload"` against scratch org
- [ ] Manual: load Visualisation, pick map, navigate to another tab, return — dropdown retained, canvas rendered

Closes #26
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Issue #26 acceptance criteria mapped — write on change (T1), restore on init (T2), stale guard (T3), storage unavailable (T4), spec update (T5), e2e (T6). Tab-close clearing relies on sessionStorage semantics (no separate test — platform-guaranteed).
- **Type consistency:** Storage key string `bcm.visualisation.selectedMapId` consistent across `bcm_CapabilityMap.js`, jest tests, and spec. Helper names `safeSessionGet` / `safeSessionSet` / `safeSessionRemove` consistent.
- **Placeholder scan:** Clean — no TBD / TODO / "implement later".
- **FP table:** No new FP added (storage = UI state per Rule 7 Note 2). Excluded-processes table updated in T7. [[feedback_mark_complete_fp_table]] — no FP row to tick because there is none for this issue.
