# Plan — L3 Tag Colourisation

**Date:** 2026-06-05
**Issue:** Tag-by-colour combobox highlights L2 boxes only. L3 bullets ignore the selected tag. L1 chevrons by design stay neutral.
**Scope:** Extend the existing `_getTagFill` mechanism to L3 bullet groups, rendering a tinted background rect behind each tagged L3's wrapped lines (same z-layer as the focus rect, suppressed when focused). Backfill Jest coverage for both L2 and L3 tag highlighting.

> Source interview: this conversation; CONTEXT.md updated to reflect L2/L3 split before plan written.

---

## 1. Background

`bcm_CapabilityMap.js` line 486–495 implements `_getTagFill(capId, tagsRelation)`. It is called once at line 331 and used at line 401 for the L2 fill. L3 bullet groups (built lines 346–382) have no equivalent code path. Apex (`bcm_CapabilityController.getCapabilities`) already returns `Tags__r` on every capability regardless of level, so the data is already on the wire.

**Why no L1:** L1 chevrons are dark grey navigational elements with white text. Tag colours would clash with focus styling and reduce affordance. Confirmed during interview.

---

## 2. Decisions Locked During Interview

| #   | Decision                                                                               |
| --- | -------------------------------------------------------------------------------------- |
| 1   | Symptom: L3 doesn't colourise (L1 stays neutral by design)                             |
| 2   | L3 highlight = tinted background rect behind bullet text                               |
| 3   | Single-select tag — match `selectedTagId` only                                         |
| 4   | Focus rect wins over tag rect when L3 focused                                          |
| 5   | Tag rect spans full bullet column width (matches focus rect geometry)                  |
| 6   | Hidden L3s with selected tag still get the rect                                        |
| 7   | Tag rect z-order: behind bullet text, same layer as focus rect                         |
| 8   | No luminance auto-flip; admin authors light tag colours (document via field help text) |
| 9   | Apex query already returns L3 `Tags__r` — no controller change                         |
| 10  | Add Jest test + new spec scenario                                                      |
| 11  | Also upgrade existing L2 deferred scenarios to Jest-tested                             |
| 12  | Keep full layout rebuild on tag change                                                 |
| 13  | Render in `bcm_CapabilityMap.html` directly, no new component                          |

---

## 3. Implementation Steps

### Step 1 — Compute `tagRect` per L3 bullet group in `_buildLayout`

**File:** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`
**Location:** Inside the `for (const l3 of (l2.children || []))` loop around line 346.

Compute the tag fill for the L3 once per iteration:

```js
const l3TagFill = this._getTagFill(l3.Id, l3.Tags__r);
const showTagRect = !l3Focused && l3TagFill !== '#FFFFFF';
```

Add `tagRect` to the `bulletGroups.push({...})` object alongside `focusRect`:

```js
tagRect: showTagRect ? {
    x     : bulletBaseX - 4,
    y     : focusRectStartY,
    width : COLUMN_WIDTH - BOX_PADDING * 2 - 8,
    height: allLines.length * LINE_HEIGHT - 2,
    fill  : l3TagFill,
} : null,
```

Geometry must match `focusRect` exactly so the two are visually drop-in.

### Step 2 — Render `tagRect` in template

**File:** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`
**Location:** Inside the bulletGroup `<g>` block (around line 130), immediately after the focusRect `<template>` and before the `<text>` lines loop:

```html
<template if:true="{group.tagRect}">
    <rect
        x="{group.tagRect.x}"
        y="{group.tagRect.y}"
        width="{group.tagRect.width}"
        height="{group.tagRect.height}"
        rx="3"
        fill="{group.tagRect.fill}"
        class="bcm-l3-tag-rect"
    >
    </rect>
</template>
```

The mutual exclusion (focus suppresses tag) is enforced in JS at Step 1 (`!l3Focused`), not in the template.

### Step 3 — Document tag colour authoring guidance

**File:** `force-app/main/default/objects/bcm_Tag__c/fields/bcm_Colour__c.field-meta.xml`
**Change:** Update `<inlineHelpText>` (or add if absent) to: _"Hex colour applied as the highlight fill on Level 2 boxes and as a background tint behind Level 3 bullets when this tag is selected in the diagram. Use light/pastel shades — the bullet and box text colours are not auto-adjusted for contrast."_

Use `generating-custom-field` skill for any XML change here.

### Step 4 — Jest test for L2 + L3 tag highlight

**File:** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

Add three tests:

1. **"L2 box fill matches selected tag colour when capability carries the tag"**
   Mock `getCapabilities` to return an L2 with `Tags__r: [{ bcm_Tag__c: 'tagId-1', bcm_Tag__r: { Name: 'NEW', bcm_Colour__c: '#FF5733' } }]`. Mock `getTags` with one tag. Set `selectedTagId = 'tagId-1'`. Assert the rendered L2 `<rect>` has `fill="#FF5733"`.

2. **"L2 box stays white when capability does not carry the selected tag"**
   Same setup but L2's `Tags__r` is empty. Assert L2 fill is `#FFFFFF`.

3. **"L3 bullet group renders tag rect with selected tag colour"**
   Mock an L3 with `Tags__r: [...]` matching `selectedTagId`. Assert a `<rect class="bcm-l3-tag-rect">` exists with the expected `fill` attribute and that its width equals the focus rect width.

4. **"L3 tag rect is suppressed when the L3 is focused"**
   Mock a tagged L3, programmatically focus it (set `focusedNodeId` via the same mechanism existing tests use). Assert no `<rect class="bcm-l3-tag-rect">` is in the DOM, and the `bcm-l3-focus-rect` is.

5. **"Selecting None clears L2 fill and L3 tag rect"**
   Set `selectedTagId = ''`. Assert L2 fills are white and no `bcm-l3-tag-rect` rects exist.

### Step 5 — Update spec markers in `docs/specs/diagram.md`

Lines 165–189, "Feature: Tag highlight colourises matching capabilities":

- "Selecting a tag highlights matching capabilities" — replace `> Deferred: ...` with `> Tested by: bcm_CapabilityMap.test.js — "L2 box fill matches selected tag colour when capability carries the tag"`
- "Capabilities without the selected tag remain white" — replace `> Deferred: ...` with `> Tested by: bcm_CapabilityMap.test.js — "L2 box stays white when capability does not carry the selected tag"`
- "Selecting None clears all highlights" — keep current Playwright "no crash" test and add a second test ref: `> Tested by: diagram.spec.ts — "Selecting None in tag dropdown does not crash the diagram"; bcm_CapabilityMap.test.js — "Selecting None clears L2 fill and L3 tag rect"`

Add **new scenarios** in the same Feature block:

```markdown
**Scenario: L3 bullet renders a tinted background rect when its capability carries the selected tag**

Given a Map is loaded and at least one Level 3 Capability has a Tag applied
When the user selects that Tag in the "Colour by Tag" dropdown
Then the L3 bullet group displays a background rectangle filled with the Tag's colour behind the bullet text

> Tested by: bcm_CapabilityMap.test.js — "L3 bullet group renders tag rect with selected tag colour"

**Scenario: Focused L3 suppresses the tag rect**

Given an L3 bullet carries the currently selected tag
And that L3 bullet is focused
When the diagram renders
Then the focus rect is shown
And the tag rect is not rendered

> Tested by: bcm_CapabilityMap.test.js — "L3 tag rect is suppressed when the L3 is focused"

**Scenario: L1 chevrons remain unaffected by tag selection**

Given a Map with at least one Level 1 Capability carrying the selected Tag
When the user selects that Tag in the dropdown
Then the L1 chevron fill remains the default dark grey

> Deferred: L1 fill is hard-coded in \_buildLayout (lines 309–310) and never reads tag data — invariant by code construction
```

### Step 6 — Update CONTEXT.md

Already done — see commit prior to this plan. The Tag entry now reads: _"highlights matching Capabilities using the Tag's stored colour: Level 2 boxes take the colour as their full fill; Level 3 bullets render a tinted background rectangle behind their text (suppressed when the L3 is focused — focus styling wins). Level 1 chevrons are unaffected by tag selection."_

### Step 7 — COSMIC function point table

No change. Tag colour-highlight rendering is already excluded from the FP count (line 605 of `99-cosmic-function-point-count.md`): _"Client-side filter on already-loaded data (no new Apex call). Data was moved in FP2; re-colouring is internal data manipulation, not a new data movement."_ This work does not introduce a new data movement.

---

## 4. E2E Test Update Section

**No spec file changes for `diagram.spec.ts` or `capability-detail.spec.ts`.**

Reason: Playwright tag-highlight assertions remain deferred per the existing `> Deferred: requires seeding a CapabilityTag junction in Playwright which adds significant setup complexity` rationale. Jest is the right layer because:

- It mocks Apex `getCapabilities` directly (the existing test already does)
- No org-side junction seeding is required
- The renderer logic is the unit under test, not user navigation

**No new helpers** in `tests/`.
**No new navigation patterns** — the toolbar combobox already exists and is wired to `selectedTagId`.

The single Playwright check that survives ("Selecting None in tag dropdown does not crash the diagram") covers the dropdown wiring; Jest covers what it does to the rendered output.

---

## 5. Risk / Open Items

- **Dark tag colours degrade L3 readability.** Mitigated by Step 3 help-text guidance. Not enforced.
- **`_getTagFill` is called once per L2 (line 331) and now once per L3 (Step 1).** For a map with many L3s, this is N additional Map lookups on tag change — negligible.
- **`bcm-l3-tag-rect` CSS class is currently unstyled.** No CSS file change unless we want a stroke; recommend leaving stroke off (cleaner against varied background colours).

---

## 6. Acceptance

- [ ] Selecting a tag highlights both L2 boxes and L3 bullet groups whose capabilities carry that tag.
- [ ] Focused L3 bullets show only the focus rect, not the tag rect.
- [ ] Hidden L3 bullets (Show Hidden = on) still show the tag rect when tagged.
- [ ] Selecting "None" clears both L2 fills and L3 tag rects.
- [ ] L1 chevrons never change colour based on tag selection.
- [ ] Jest tests in §3 Step 4 all pass.
- [ ] Spec scenarios in `docs/specs/diagram.md` are upgraded per §3 Step 5.
- [ ] `bcm_Colour__c` field help-text mentions L2/L3 dual application.
- [ ] CONTEXT.md Tag entry reflects L2/L3 split (already done).
