# Issue #43 — Visual Language Refresh Implementation Plan

> **Status:** Completed 2026-06-10.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refresh the visual treatment of the entire BCM diagram. Replace ad-hoc hex literals scattered across `bcm_CapabilityMap.{js,html,css}`, `bcm_CapabilityDetail.css`, and `bcm_ColourSwatch.js` with a single tokens module (`bcm_VisualTokens`). Choose one of three aesthetic directions via a HITL gate after building static-HTML mockups using the generic capability map. Codify the chosen palette, type scale, focus model, strategy-mark glyph, and cross-cutting band ramp in ADR-0005 plus values doc `docs/design/10-visual-language.md`. Change focus state from dual-channel (fill shift + stroke) to single-channel (stroke ring only). Repurpose `bcm_ColourSwatch.COLOUR_LABELS` as the curated tag-preset dictionary (no data migration). Land everything in a single PR.

**Architecture:**
- New LWC module `bcm_VisualTokens` exporting `BCM_*` JS constants (palette + type scale + glyph metadata) and a companion `bcm_VisualTokens.css` mirroring values as `--bcm-*` custom properties for CSS-only consumers.
- SLDS owns chrome (toolbar buttons, comboboxes, detail-panel form fields). Tokens own the SVG canvas + diagram-specific surfaces only.
- Focus model: single-channel stroke ring (`BCM_FOCUS_RING`, ≥3:1 contrast against every fill in the chosen direction). Fill no longer shifts on focus.
- Strategy mark: per-direction glyph encoded as `BCM_STRATEGY_MARK = { kind, fill, weight }` where `kind ∈ { 'stripe', 'tick', 'corner' }`. Detection logic (`isStrategic`) unchanged.
- Cross-cutting band: ramped 4-step single-hue (`BCM_BAND_RAMP`); index wraps for >4 bands (existing behaviour preserved). Optional `BCM_BAND_DIVIDER` for directions that use hairline separation.
- Tag presets: `bcm_ColourSwatch.COLOUR_LABELS` becomes the curated dictionary; existing `bcm_Tag__c.bcm_Colour__c` values are user data and untouched. Out-of-palette tag colours fall back to raw-hex display label (existing fallback path).
- Verification: dedicated e2e spec `tests/e2e/visual-language.spec.ts` asserts sampled `fill`/`stroke` attributes on canvas-rendered nodes match expected token values (mirrored as constants in the spec, not imported). Reference PNGs captured via a manual-run script `tests/e2e/__visual__/capture.spec.ts` and committed alongside.

**Tech Stack:** LWC (`bcm_CapabilityMap`, `bcm_CapabilityDetail`, `bcm_ColourSwatch`, new `bcm_VisualTokens`), Jest (existing test files updated for new tokens), Playwright (`tests/e2e/visual-language.spec.ts` + `tests/e2e/__visual__/capture.spec.ts`). No Apex changes. No schema changes. No new dependencies.

---

## File Structure

- **Create** `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js` — JS exports for every named token (palette, type scale, focus, strategy mark, band ramp, tag presets).
- **Create** `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.css` — CSS custom properties mirroring the JS values for CSS-only consumers. Imported via `:host` from `bcm_CapabilityMap.css` and `bcm_CapabilityDetail.css`. Note: LWC stylesheets cannot `@import` cross-component, so the CSS mirror is duplicated as a `:host` block that the `bcm_VisualTokens.html` empty template wires through, OR each consuming component declares its own `:host` block referencing the mirror values directly. Implementation chooses the simpler approach (each consumer declares the `--bcm-*` block at the top of its own `.css`, copy-pasted from `bcm_VisualTokens.css`).
- **Create** `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js-meta.xml` — minimal LWC bundle metadata (apiVersion 60.0, isExposed=false).
- **Create** `docs/design/mockups/visual-language-editorial.html` — direction A: editorial monochrome.
- **Create** `docs/design/mockups/visual-language-corporate.html` — direction B: refined corporate.
- **Create** `docs/design/mockups/visual-language-architectural.html` — direction C: architectural / blueprint.
- **Create** `docs/design/mockups/sample-data-slice.json` — extracted minimum-viable surface slice from `docs/sample-generic-bcm.json`. (Inline into HTML or sidecar — implementer's call; sidecar keeps each mockup small.)
- **Create** `docs/adr/0005-visual-language.md` — ADR locking SLDS-chrome / custom-canvas-tokens, chosen direction, focus-model swap, strategy-mark shape, band ramp.
- **Create** `docs/design/10-visual-language.md` — values table: every token with hex/rgb/intended use; type-scale rows; focus-ring contrast notes.
- **Create** `tests/e2e/visual-language.spec.ts` — palette regression spec.
- **Create** `tests/e2e/__visual__/capture.spec.ts` — manual-run reference-PNG capture script (skipped by default via `test.skip` or grep tag).
- **Create** `tests/e2e/__visual__/canvas-baseline.png` (and per-state variants) — committed reference images, captured after deploy.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js` — replace `BAND_PALETTE`, L1 `fill`/`strokeColour`, L2 `fill`/`strokeColour`, L3 `fillColour`/`tagFill` defaults, label fills (`#FFFFFF`, `#222222`) with imports from `bcm_VisualTokens`. Remove fill-shift on L1/L2 focus (single-channel ring). Wire `BCM_STRATEGY_MARK.kind` into stripe vs tick vs corner geometry in `_buildLayout`.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html` — replace inline hex (`#666666`, `#222222`, `#E8F4FF`, `#0070D2`, `#FFFFFF`, `#4A4A4A`, `#333333`, `#0e2342`, `#0070d2`) with token-bound attributes. Remove L2-focus fill-swap rect (now rendered via stroke ring only). Strategy-mark template-block becomes `kind`-driven (template renders one of three glyph shapes).
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css` — top-of-file `:host { --bcm-* }` block mirroring tokens; replace `#f3f3f3`, `#dddbda`, `#fafafa`, `#0070D2`, `#E8A33D` literals with `var(--bcm-*)` references.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js` — update assertions that pin visual-state hex (`#E8F4FF`, `#0070D2`, `#CCCCCC`, `#FFFFFF` for L2 fill, `#0070D2` for stroke) to the new tokens. Tag-fixture hex (`#FF5733`, `#00FF00`, `#3366FF`, `#FF0000`) is data not visual-language, leave alone. Update focus assertions: L2 focus no longer shifts fill; assert stroke matches `BCM_FOCUS_RING` only.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css` — top-of-file `:host` token block; replace `#fff`, `#fafafa`, `#444`, `#222`, `#4A4A4A`, `#555` with `var(--bcm-*)`. Default tag swatch fallback `#ccc` in `bcm_CapabilityDetail.js:109` becomes `BCM_TAG_FALLBACK`.
- **Modify** `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js` — import `BCM_TAG_FALLBACK`, use it in the swatch style fallback.
- **Modify** `force-app/main/default/lwc/bcm_ColourSwatch/bcm_ColourSwatch.js` — replace 10-pair `COLOUR_LABELS` dictionary with curated palette aligned to chosen direction. Source the dictionary from `bcm_VisualTokens.BCM_TAG_PRESETS` (object with `{ hex, label }`) so the swatch and any future picker share one truth.
- **Modify** `tests/e2e/diagram.seed.ts` — if `#B8E0C8` is *not* in the new tag-preset palette, change `DIAGRAM_TAG_COLOUR` to a hex that *is* (and update `tests/e2e/capability-tag.seed.ts` matching comment + value). If `#B8E0C8` is preserved, no change.
- **Modify** `docs/specs/diagram.md` — new "Visual language" subsection with `> Tested by:` lines (one per sampled element class). Existing focus-related scenarios updated to reference the new single-channel behaviour.
- **Modify** `CONTEXT.md` — add `Visual Tokens` glossary term referencing `bcm_VisualTokens` and the per-medium dual-mirror approach.
- **Modify** `docs/design/99-cosmic-function-point-count.md` — add exclusion-table row: `Visual-language refresh (GH #43, 2026-mm-dd) — Tokenised palette + type scale + focus model swap + strategy-mark glyph swap; no data movement crosses the software boundary. Same exclusion class as canvas focus outline suppression.`
- **Edit issue #43 on GitHub** — append AC bullet: `Focus state simplified from fill-shift+stroke to single-channel stroke ring (per ADR-0005); other interaction states (dashed-hidden, tag-highlight, strategy-mark) unchanged.`

**No new functional process — re-coat + token plumbing only.** Same exclusion class as zoom/pan visual state and canvas focus outline suppression.

---

## Function Point Table

No new functional process. Adds an exclusion-table row in `docs/design/99-cosmic-function-point-count.md` §6 covering the visual-language refresh. Total CFP unchanged. [[feedback_mark_complete_fp_table]] — no FP table row to tick because no FP is added; the exclusion-table edit is the equivalent step, ticked with completion date when Task 13 closes.

---

## Locked design decisions (from grilling)

| Decision | Choice |
|---|---|
| Design system stance | SLDS-aligned (chrome owned by SLDS) |
| Token strategy | SLDS for chrome + custom `bcm_VisualTokens` module for canvas |
| Token shape | JS module `bcm_VisualTokens.js` + companion `bcm_VisualTokens.css` (mirrored values, hand-synced) |
| Naming convention | `BCM_*` SCREAMING_SNAKE in JS; `--bcm-*` kebab in CSS |
| Type tokens included | Yes — same module exports L1/L2/L3/band-label size, weight, tracking |
| Mockup format | Static HTML, one file per direction, each self-contained with inline `<style>` + inline SVG |
| Mockup data | Generic capability map (`docs/sample-generic-bcm.json`), minimum-viable surface tour slice |
| Mockup directions | A: Editorial monochrome; B: Refined corporate; C: Architectural / blueprint |
| Mockup includes panel chrome | Yes — toolbar row + detail-panel header rendered alongside canvas |
| Direction selection | HITL gate (Task 4), one direction wins |
| Focus model | Single-channel stroke ring (`BCM_FOCUS_RING`); no fill shift on L1/L2 focus |
| Focus colour | Dedicated token (may resolve to SLDS `#0070D2` or new value, decided per direction; ≥3:1 contrast against every surface) |
| Strategy mark | Per-direction glyph; token shape `{ kind: 'stripe' \| 'tick' \| 'corner', fill, weight }` |
| Cross-cutting band ramp | Ramped single-hue, hardcoded 4-step, index wraps for >4 bands |
| Optional `BCM_BAND_DIVIDER` | Defined; used only by directions that need hairline band separation |
| Tag preset dictionary | Repurpose `bcm_ColourSwatch.COLOUR_LABELS` (sourced from `BCM_TAG_PRESETS`); existing tag data untouched |
| Tag-data migration | None — out-of-palette colours fall back to raw-hex display label |
| Mockups in scope, beyond canvas | Toolbar + detail panel header + tag swatches + strategy-marked node + cross-cutting stack — every visual surface |
| Out of scope | SLDS2/Cosmos migration, layout/geometry, interaction model, data model, dark mode, animation, icon refresh, accessibility audit beyond focus contrast, Strategic Support detection logic |
| Plan shape | One-shot plan, single PR, explicit GATE step |
| Deployment | Once after implementation steps complete, before tests |
| Verification | Committed reference PNGs (no auto-screenshot assert); `visual-language.spec.ts` asserts sampled fills/strokes |
| Reference PNGs | Captured via manual-run `tests/e2e/__visual__/capture.spec.ts` exercising every visual state |
| Spec coverage | New "Visual language" subsection in `docs/specs/diagram.md`; `> Tested by: visual-language.spec.ts — "<scenario>"` per sampled state |
| Existing test impact | Jest visual-state assertions updated to new tokens; tag-fixture hex unchanged; one e2e seed value verified against new palette |
| ADR scope | Single ADR-0005 covering all locked decisions; values live in `docs/design/10-visual-language.md` |
| FP impact | Exclusion-table row only — no countable function point added |
| Issue #43 edit | Append AC bullet calling out focus-model behaviour change |
| Rollback plan | Standard `git revert` on the merged PR; no feature flag |

---

## E2E Test Update Section

**Spec files changed:**
- `tests/e2e/visual-language.spec.ts` (new) — palette regression spec asserting sampled `fill`/`stroke` attributes match expected token values.
- `tests/e2e/__visual__/capture.spec.ts` (new, manual-run) — drives diagram into each state, saves PNGs.
- `tests/e2e/diagram.seed.ts` — change `DIAGRAM_TAG_COLOUR` only if `#B8E0C8` is dropped from new palette.
- `tests/e2e/capability-tag.seed.ts` — same conditional update.

**Helpers changed:** None. Reuses `openDiagram`, `selectMap` from `tests/e2e/fixtures/helpers.ts`.

**New navigation/interaction pattern:**
- Locate a sampled L1 chevron via `page.locator('[data-testid="l1-chevron"]').first()` (or existing equivalent selector — task verifies during implementation).
- Read attribute via `await locator.getAttribute('fill')`.
- Assert against expected hex constants declared at top of spec (mirroring `BCM_*` values, not imported).
- For PNG capture: navigate to a seeded map known to contain every visual state, drive interactions (click L2 to focus, select tag, toggle Strategic Support), `page.screenshot({ path })` per state, write into `tests/e2e/__visual__/`.

**Project routing:** Editor project (default). State coverage doesn't depend on viewer-vs-editor axis.

---

## Task 1: Build mockup direction A — editorial monochrome

**Files:**
- Create: `docs/design/mockups/sample-data-slice.json`
- Create: `docs/design/mockups/visual-language-editorial.html`

- [ ] **Step 1: Extract surface-tour slice** — from `docs/sample-generic-bcm.json`, pick 3–4 L1 capabilities including at least one cross-cutting candidate (or invent one if none flagged). Trim to 1–2 L2 children each, 2–3 L3 grandchildren each. Aim for one full screen of canvas. Save as `docs/design/mockups/sample-data-slice.json`.

- [ ] **Step 2: Use `superpowers:frontend-design` skill** — invoke the skill before drafting any HTML. Apply its principles to direction A.

- [ ] **Step 3: Build editorial monochrome HTML** — single-file `docs/design/mockups/visual-language-editorial.html` with:
  - Inline `<style>` defining all candidate `--bcm-*` values (copy block goes into the tokens module after Task 4 GATE).
  - Inline SVG showing every visual surface in one view: at least one L1 chevron (default + focused), at least one L2 box (default + focused + dashed-hidden + tag-highlighted), at least one L3 bullet (default + focused + dashed-italic + tag-highlighted), the cross-cutting band stack (≥2 bands), one strategy-marked node (showing the chosen glyph for direction A), the toolbar row chrome, the detail-panel header.
  - Greyscale palette + one accent for focus + sparingly used accent for strategy. Type: serif headline for L1, sans for L2/L3.
  - Comments at top: brief description, palette rationale, focus-ring colour + contrast notes against each surface.

- [ ] **Step 4: Visual sanity-check** — open the HTML in a browser. Verify all listed states render. Verify it does not crash SLDS-style chrome.

- [ ] **Step 5: Commit** —
```bash
git add docs/design/mockups/sample-data-slice.json \
        docs/design/mockups/visual-language-editorial.html
git commit -m "docs: add editorial monochrome visual-language mockup (GH #43)"
```

---

## Task 2: Build mockup direction B — refined corporate

**Files:**
- Create: `docs/design/mockups/visual-language-corporate.html`

- [ ] **Step 1: Use `superpowers:frontend-design` skill** — re-invoke for direction B.

- [ ] **Step 2: Build refined corporate HTML** — same structural surface tour as Task 1; palette: cool desaturated (slate/teal/sand). L1 muted hue, L2 ivory, cross-cutting band complementary muted ramp, strategy mark desaturated stripe. SLDS-default sans throughout.

- [ ] **Step 3: Visual sanity-check** — browser open; verify all states.

- [ ] **Step 4: Commit** —
```bash
git add docs/design/mockups/visual-language-corporate.html
git commit -m "docs: add refined corporate visual-language mockup (GH #43)"
```

---

## Task 3: Build mockup direction C — architectural / blueprint

**Files:**
- Create: `docs/design/mockups/visual-language-architectural.html`

- [ ] **Step 1: Use `superpowers:frontend-design` skill** — re-invoke for direction C.

- [ ] **Step 2: Build architectural HTML** — surface tour; off-white canvas, hairline strokes. L1 chevrons low-contrast outlines + thin fill. L2 boxes 1px stroke, near-white fill. Cross-cutting band as a solid base layer + hairline divider (`BCM_BAND_DIVIDER` populated). Strategy mark as a tick mark (`kind: 'tick'`), not a colour-block. Type: tighter weight contrast.

- [ ] **Step 3: Visual sanity-check** — browser open; verify all states.

- [ ] **Step 4: Commit** —
```bash
git add docs/design/mockups/visual-language-architectural.html
git commit -m "docs: add architectural blueprint visual-language mockup (GH #43)"
```

---

## Task 4: GATE — review with user, pick direction, harvest values

**No file changes in this task. Pause for HITL.**

- [ ] **Step 1: Present mockups** — share the three HTML files with the user (filesystem paths or rendered screenshots).

- [ ] **Step 2: Capture decision** — record which direction wins. Note any tweaks the user wants applied to the chosen direction (e.g. "go with corporate but use editorial's strategy stripe").

- [ ] **Step 3: Harvest token values** — from the chosen mockup's inline `<style>` block, extract:
  - L1 fill, L1 stroke, L1 label colour
  - L2 surface, L2 stroke, L2 label colour
  - L3 label, L3 dimmed-label, L3 focus-rect colour
  - Cross-cutting band ramp (4 hex values) and optional divider
  - Strategy mark (`kind`, `fill`, `weight`)
  - Tag presets (10 `{ hex, label }` pairs)
  - Focus ring
  - Toolbar background, canvas backdrop
  - Detail-panel chrome (background, header bg, header text, body text, secondary text, divider)
  - Type scale (size, weight, tracking for each level + band label)
  
- [ ] **Step 4: Write down harvested values** — pin into a scratch note in this plan's working area, ready for Task 5.

- [ ] **Step 5: Commit** — no commit; gate produces no artefacts.

---

## Task 5: Create `bcm_VisualTokens` LWC bundle

**Files:**
- Create: `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js`
- Create: `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.css`
- Create: `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js-meta.xml`

- [ ] **Step 1: Generate meta-xml** — minimal LWC bundle metadata, isExposed=false, apiVersion 60.0. (Bundle is JS-only, no template; an empty `bcm_VisualTokens.html` is required by LWC. Add it.)

- [ ] **Step 2: Author `bcm_VisualTokens.js`** — export every token harvested in Task 4. Group by surface (L1, L2, L3, band, focus, strategy, tags, type, chrome). Strict JSDoc on each export naming the surface it applies to. Example shape:

```javascript
// Surface — Level 1 chevrons
export const BCM_L1_FILL          = '#...';
export const BCM_L1_FILL_FOCUSED  = BCM_L1_FILL; // single-channel focus — fill stable
export const BCM_L1_STROKE        = '#...';
export const BCM_L1_LABEL         = '#...';
// ... etc for L2, L3, band, focus, strategy, tag presets, type ...
export const BCM_TAG_PRESETS = [
    { hex: '#A8C7FF', label: 'Blue' },
    // ...
];
export const BCM_TAG_FALLBACK = '#...';
export const BCM_FOCUS_RING   = '#...';
export const BCM_BAND_RAMP    = ['#...', '#...', '#...', '#...'];
export const BCM_BAND_DIVIDER = '#...' /* or null */;
export const BCM_STRATEGY_MARK = { kind: 'stripe' /* | 'tick' | 'corner' */, fill: '#...', weight: 3 };
// Type scale
export const BCM_TYPE_L1 = { size: 13, weight: 600, tracking: 0 };
// ... etc
```

- [ ] **Step 3: Author `bcm_VisualTokens.css`** — `:host` block mirroring every JS hex/value as `--bcm-*`. Hand-synced with the JS file. Copy this block into consumer `.css` files in later tasks (LWC stylesheets cannot cross-import).

- [ ] **Step 4: Run `npm run lint`** — confirm clean.

- [ ] **Step 5: Commit** —
```bash
git add force-app/main/default/lwc/bcm_VisualTokens/
git commit -m "feat(visualisation): add bcm_VisualTokens module with palette and type scale (GH #43)"
```

---

## Task 6: Write ADR-0005

**Files:**
- Create: `docs/adr/0005-visual-language.md`

- [ ] **Step 1: Read existing ADRs for style** — `docs/adr/0001-capability-map-container-object.md` through `0004-playwright-drag-drop-test-strategy.md`. Match their format.

- [ ] **Step 2: Author ADR-0005** with sections:
  - **Title:** ADR-0005 — Visual language for the capability map.
  - **Status:** Accepted.
  - **Context:** Visual surfaces evolved ad-hoc per-feature (`#1a3d6b–#587bad` band ramp vs `#4A4A4A–#2A2A2A` L1 vs arbitrary tag swatches vs `#E8A33D` strategy stripe). The diagram reads as four unrelated UIs stacked. Issue #43 calls for cohesion.
  - **Decision:** Adopt SLDS-aligned chrome with bespoke canvas tokens. Tokens centralised in `bcm_VisualTokens` LWC module. Chosen aesthetic direction: `<picked>`. Single-channel stroke-ring focus. Per-direction strategy-mark glyph. Ramped 4-step single-hue cross-cutting band. Tag presets curated via `BCM_TAG_PRESETS`; existing tag data untouched.
  - **Alternatives considered:** Pure SLDS tokens (rejected: doesn't accommodate L1 ramp / band ramp); fully bespoke whole-page (rejected: clashes with toolbar/panel SLDS components); hybrid `--bcm-*` overlay referencing SLDS tokens (rejected: expressive but heavy plumbing). Dual-channel focus (rejected: collides with tag highlight; single-channel cleaner across directions and meets WCAG 2.4.7 with 2px ring at 3:1).
  - **Consequences:** Future palette changes happen in one module. SLDS upgrades affect chrome only. Existing tag colours outside the new preset palette display raw-hex labels in the swatch (acceptable soft degradation; no data migration). Focus state visibly different from before — documented in the spec and called out in issue #43 AC.
  - **Verification:** `tests/e2e/visual-language.spec.ts` + reference PNGs in `tests/e2e/__visual__/`. Values listed in `docs/design/10-visual-language.md`.

- [ ] **Step 3: Commit** —
```bash
git add docs/adr/0005-visual-language.md
git commit -m "docs: ADR-0005 visual language for capability map (GH #43)"
```

---

## Task 7: Write design doc `docs/design/10-visual-language.md`

**Files:**
- Create: `docs/design/10-visual-language.md`

- [ ] **Step 1: Author values doc** with sections:
  - **Token table:** every `BCM_*` constant — name, hex/value, rgb (for hexes), intended surface, mapped CSS custom property.
  - **Type scale:** L1/L2/L3/band-label rows — size, weight, tracking, font-family.
  - **Focus model:** stroke-ring spec, ring weight, contrast verification table (focus colour vs each surface).
  - **Strategy mark:** chosen `kind`, geometry parameters.
  - **Band ramp:** 4 values, what wraps mean for >4 bands, optional divider use.
  - **Tag presets:** 10 hex/label pairs; out-of-palette fallback behaviour.
  - **Out of scope:** explicit list per locked decisions.
  - **References:** ADR-0005, issue #43.

- [ ] **Step 2: Cross-link from `docs/design/`** — no index file exists per `ls` of `docs/design/`. Skip.

- [ ] **Step 3: Commit** —
```bash
git add docs/design/10-visual-language.md
git commit -m "docs: visual language values (GH #43)"
```

---

## Task 8: Re-tokenise `bcm_CapabilityMap.js`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`

- [ ] **Step 1: Add token imports** at the top of the file:

```javascript
import {
    BCM_L1_FILL, BCM_L1_FILL_FOCUSED, BCM_L1_STROKE, BCM_L1_LABEL,
    BCM_L2_SURFACE, BCM_L2_SURFACE_FOCUSED, BCM_L2_STROKE, BCM_L2_LABEL,
    BCM_L3_LABEL, BCM_L3_LABEL_DIMMED, BCM_L3_FOCUS_RECT,
    BCM_BAND_RAMP, BCM_BAND_DIVIDER,
    BCM_FOCUS_RING, BCM_STRATEGY_MARK,
    BCM_TAG_FALLBACK
} from 'c/bcm_VisualTokens';
```

- [ ] **Step 2: Replace `BAND_PALETTE`** at line 36 — delete the local constant; reference `BCM_BAND_RAMP` everywhere it's used.

- [ ] **Step 3: Replace L1 fill/stroke literals** at lines 414–415 — `fill` becomes `l1Focused ? BCM_L1_FILL_FOCUSED : BCM_L1_FILL` (note: with single-channel focus, `BCM_L1_FILL_FOCUSED === BCM_L1_FILL` — fill no longer shifts; the focus ring is rendered separately). `strokeColour` becomes `l1Focused ? BCM_FOCUS_RING : BCM_L1_STROKE`.

- [ ] **Step 4: Replace L2 fill/stroke literals** at lines 539–540 — `fill` becomes `l2Focused ? BCM_L2_SURFACE_FOCUSED : tagFill` (where `BCM_L2_SURFACE_FOCUSED === BCM_L2_SURFACE` for single-channel focus). `strokeColour` becomes `l2Focused ? BCM_FOCUS_RING : BCM_L2_STROKE`.

- [ ] **Step 5: Replace L3 literals** at lines 460–463 — `'#FFFFFF'` becomes `BCM_TAG_FALLBACK`. `'#999'` becomes `BCM_L3_LABEL_DIMMED`. `'#222'` becomes `BCM_L3_LABEL`.

- [ ] **Step 6: Replace tag-fill defaults** at lines 636/637/640/643 — `'#FFFFFF'` becomes `BCM_TAG_FALLBACK`.

- [ ] **Step 7: Replace label fills** at lines 974/987/1001 — `'#FFFFFF'` and `'#222222'` become `BCM_BAND_LABEL_LIGHT` and `BCM_BAND_LABEL_DARK` respectively (add these tokens to `bcm_VisualTokens.js` in Task 5 — if missed, return there).

- [ ] **Step 8: Wire `BCM_STRATEGY_MARK.kind`** — in `_buildLayout`, the strategy-stripe geometry currently emits a stripe regardless. Switch on `BCM_STRATEGY_MARK.kind`:
  - `'stripe'`: existing geometry (vertical bar, inset).
  - `'tick'`: short horizontal mark in the top-right corner of the box; for L1/band, a small notch on the chevron's right edge.
  - `'corner'`: small triangular corner badge top-right.
  - Attach the resulting geometry to `node.strategyMark` (rename from `node.strategyStripe` for clarity); update template binding in step 9 of Task 9.

- [ ] **Step 9: Run Jest** — `npx jest force-app/main/default/lwc/bcm_CapabilityMap` will fail (assertions still pin old hex values). Confirm failure mode is "value mismatch" not "import error".

- [ ] **Step 10: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js
git commit -m "refactor(visualisation): replace hex literals in bcm_CapabilityMap.js with tokens (GH #43)"
```

---

## Task 9: Re-tokenise `bcm_CapabilityMap.html`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`

- [ ] **Step 1: Replace inline `fill="#666666"` (line 144) and `fill="#222222"` (line 155)** — bind to JS-side computed values (`{toolbarLabelFill}` getter returning `BCM_L2_LABEL` or similar) — chrome literals.

- [ ] **Step 2: Replace L2-focus rect at lines 171–172** — *remove the focus rect entirely*. Single-channel focus means the focus is the stroke on the existing L2 rect, not a separate rect underlay.

- [ ] **Step 3: Replace `fill="#FFFFFF"` at lines 253, 268, 333** — bind to `{labelFill}` or `BCM_*_LABEL` via getter.

- [ ] **Step 4: Replace `stroke="#0070d2"` at line 287** — bind to `{focusStrokeColour}` getter that resolves `BCM_FOCUS_RING`.

- [ ] **Step 5: Replace ghost shapes at lines 297, 300, 303** — `polygon fill="#4A4A4A" stroke="#333333"` becomes binds to L1 tokens. `rect fill="#FFFFFF" stroke="#0070D2"` becomes binds to L2 tokens (and ring). `rect fill="#E8F4FF"` ghost focus becomes the same L2 surface (single-channel — no fill shift on ghost either; ghost shows by stroke only).

- [ ] **Step 6: Replace `stroke="#0e2342"` at line 320** — band stroke. Add `BCM_BAND_STROKE` token in Task 5 if not present; reference here.

- [ ] **Step 7: Wire strategy-mark template** — replace the existing single `<rect class="bcm-strategy-stripe">` blocks with a conditional switch keyed on `BCM_STRATEGY_MARK.kind`. Practical implementation: add three conditional template blocks (`if:true={node.strategyMark.isStripe}`, `if:true={node.strategyMark.isTick}`, `if:true={node.strategyMark.isCorner}`) — getters on the layout node compute the booleans. This keeps LWC-template compatible (no inline switch).

- [ ] **Step 8: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html
git commit -m "refactor(visualisation): bind capability map template to visual tokens (GH #43)"
```

---

## Task 10: Re-tokenise `bcm_CapabilityMap.css` and `bcm_CapabilityDetail.css`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css`
- Modify: `force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js`

- [ ] **Step 1: Add `:host` token block to `bcm_CapabilityMap.css`** — copy the contents of `bcm_VisualTokens.css` `:host` block to the top of this file (LWC stylesheet boundary).

- [ ] **Step 2: Replace literals in `bcm_CapabilityMap.css`** at lines 33, 34, 42, 71, 119 — `#f3f3f3` → `var(--bcm-toolbar-bg)`, `#dddbda` → `var(--bcm-toolbar-divider)`, `#fafafa` → `var(--bcm-canvas-bg)`, `#0070D2` → `var(--bcm-focus-ring)`, `#E8A33D` → `var(--bcm-strategy-mark-fill)`.

- [ ] **Step 3: Add `:host` token block to `bcm_CapabilityDetail.css`** — copy the same `:host` block to the top.

- [ ] **Step 4: Replace literals in `bcm_CapabilityDetail.css`** at lines 10, 28, 34, 48, 56, 57, 65, 79, 85, 90, 94 — every literal becomes a `var(--bcm-panel-*)` reference. Add the necessary `BCM_PANEL_*` tokens to `bcm_VisualTokens.js` and `.css` in Task 5 if missing.

- [ ] **Step 5: Replace `'#ccc'` fallback in `bcm_CapabilityDetail.js:109`** — import `BCM_TAG_FALLBACK` from `c/bcm_VisualTokens`; change literal to `${BCM_TAG_FALLBACK}`.

- [ ] **Step 6: Run `npm run lint`** — confirm clean.

- [ ] **Step 7: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css \
        force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.css \
        force-app/main/default/lwc/bcm_CapabilityDetail/bcm_CapabilityDetail.js
git commit -m "refactor(visualisation): re-tokenise capability map and detail panel chrome (GH #43)"
```

---

## Task 11: Repurpose `bcm_ColourSwatch.COLOUR_LABELS`

**Files:**
- Modify: `force-app/main/default/lwc/bcm_ColourSwatch/bcm_ColourSwatch.js`

- [ ] **Step 1: Replace `COLOUR_LABELS`** — import `BCM_TAG_PRESETS` from `c/bcm_VisualTokens`. Build the lookup at module scope:

```javascript
import { BCM_TAG_PRESETS } from 'c/bcm_VisualTokens';
const COLOUR_LABELS = Object.fromEntries(BCM_TAG_PRESETS.map(p => [p.hex, p.label]));
```

- [ ] **Step 2: Verify fallback unchanged** — line 42 already reads `COLOUR_LABELS[this._colour] || this._colour || ''`. Out-of-palette tags now display raw hex string. Confirmed acceptable per locked decision.

- [ ] **Step 3: Commit** —
```bash
git add force-app/main/default/lwc/bcm_ColourSwatch/bcm_ColourSwatch.js
git commit -m "refactor(visualisation): source bcm_ColourSwatch presets from bcm_VisualTokens (GH #43)"
```

---

## Task 12: Update Jest tests for new tokens

**Files:**
- Modify: `force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js`

- [ ] **Step 1: Update visual-state assertions** — at lines 570 (`#E8F4FF`), 571 (`#0070D2`), 683 (`#CCCCCC`):
  - Line 570 was the L2-focus *fill*. Single-channel focus removes fill swap. Change assertion: assert focused L2's `fill` equals `tagFill` (or default `BCM_L2_SURFACE`). Remove the `#E8F4FF` expectation entirely.
  - Line 571 was the L2-focus *stroke*. Change to assert stroke equals `BCM_FOCUS_RING` (mirror the value at top of test file).
  - Line 683 was the default L2 stroke. Change to assert stroke equals `BCM_L2_STROKE`.

- [ ] **Step 2: Update tag-highlight default-fill assertions** at lines 1283, 1323, 1506 — `'#FFFFFF'` becomes `BCM_TAG_FALLBACK` (mirrored at top of test file).

- [ ] **Step 3: Leave tag-fixture hex unchanged** — lines 1225, 1226, 1231, 1235, 1276, 1294, 1317, 1467, 1490, 1510, 1513, 1517, 1524, 1527, 1531, 1570–1663. These are *fixture data* (tag records' stored colours), not visual-language assertions. Do not touch.

- [ ] **Step 4: Mirror tokens at top of test file** — define a small constants block with the expected token values, do *not* import from `c/bcm_VisualTokens`. This makes the tests a true regression check.

- [ ] **Step 5: Run Jest** — `npx jest force-app/main/default/lwc/bcm_CapabilityMap`. Expected: PASS.

- [ ] **Step 6: Commit** —
```bash
git add force-app/main/default/lwc/bcm_CapabilityMap/__tests__/bcm_CapabilityMap.test.js
git commit -m "test(visualisation): update Jest visual-state assertions for new tokens (GH #43)"
```

---

## Task 13: Deploy + write e2e spec + capture reference PNGs

**Files:**
- Create: `tests/e2e/visual-language.spec.ts`
- Create: `tests/e2e/__visual__/capture.spec.ts`
- Create: `tests/e2e/__visual__/canvas-baseline.png` (and per-state PNGs)
- Modify: `tests/e2e/diagram.seed.ts` (conditional)
- Modify: `tests/e2e/capability-tag.seed.ts` (conditional)

- [ ] **Step 1: Deploy LWC to dev org** — `sf project deploy start -d force-app/main/default/lwc -o <alias>`. Verify the diagram loads, tokens render, no console errors.

- [ ] **Step 2: Visual sanity-check on org** — open the diagram in the org. Walk every state: default L1, focused L1, default L2, focused L2, dashed-hidden L2, default L3, focused L3, dashed-italic L3, tag-highlighted L2, tag-highlighted L3, cross-cutting band stack, strategy-marked node. Compare side-by-side to the chosen mockup HTML. Note any drift.

- [ ] **Step 3: Conditionally update tag seed** — check if `#B8E0C8` is in `BCM_TAG_PRESETS`. If not, change `DIAGRAM_TAG_COLOUR` in `tests/e2e/diagram.seed.ts:6` to a hex that *is* in the preset palette; update the matching comment + value in `tests/e2e/capability-tag.seed.ts:26,37`.

- [ ] **Step 4: Author `tests/e2e/visual-language.spec.ts`** — single spec file:
  - Top-of-file constants mirroring expected tokens (`const EXPECTED_L1_FILL = '#...'` etc.).
  - One `test('canvas renders with new visual tokens', async ({ page }) => { ... })` that:
    - Calls `openDiagram` + `selectMap` for the seeded test map.
    - Locates one L1 chevron polygon, asserts `fill` matches `EXPECTED_L1_FILL`.
    - Locates one L2 box rect, asserts `fill` matches `EXPECTED_L2_SURFACE`, `stroke` matches `EXPECTED_L2_STROKE`.
    - Locates the cross-cutting band stack first chevron, asserts `fill` matches `EXPECTED_BAND_RAMP[0]`.
    - Selects a tag with a known preset colour, asserts the tagged L2 `fill` matches the tag colour (data assertion, not token).
    - Toggles Strategic Support on, asserts the strategy-marked node has the appropriate marker element (rect/path/polygon depending on `kind`) with `fill` matching `EXPECTED_STRATEGY_MARK_FILL`.
  - One `test('focused L2 stroke matches focus ring token', ...)` clicking an L2 to focus and asserting stroke only (no fill shift).

- [ ] **Step 5: Author `tests/e2e/__visual__/capture.spec.ts`** — same setup as visual-language.spec, but every test is `test.skip` by default (or gated by env var `BCM_CAPTURE=1`). Each `test` drives the diagram into one state and writes `page.screenshot({ path: 'tests/e2e/__visual__/<state>.png' })`. States: default, l1-focused, l2-focused, l2-dashed, l3-focused, tag-highlighted, strategy-on, full-canvas-baseline, detail-panel-open.

- [ ] **Step 6: Run capture script once** — `BCM_CAPTURE=1 npx playwright test tests/e2e/__visual__/capture.spec.ts`. Confirm PNGs land in `tests/e2e/__visual__/`. Eyeball each — verify they match the chosen mockup direction.

- [ ] **Step 7: Run regression spec** — `npx playwright test tests/e2e/visual-language.spec.ts`. Expected: PASS.

- [ ] **Step 8: Run full e2e suite** — `npx playwright test`. Expected: all existing specs PASS.

- [ ] **Step 9: Commit** —
```bash
git add tests/e2e/visual-language.spec.ts \
        tests/e2e/__visual__/ \
        tests/e2e/diagram.seed.ts \
        tests/e2e/capability-tag.seed.ts
git commit -m "test(visualisation): visual-language regression spec + reference PNGs (GH #43)"
```

---

## Task 14: Update spec, glossary, FP exclusion table; edit issue #43

**Files:**
- Modify: `docs/specs/diagram.md`
- Modify: `CONTEXT.md`
- Modify: `docs/design/99-cosmic-function-point-count.md`

- [ ] **Step 1: Add "Visual language" subsection to `docs/specs/diagram.md`** with scenarios:
  - L1 chevron renders with `BCM_L1_FILL` and `BCM_L1_STROKE`. `> Tested by: tests/e2e/visual-language.spec.ts — "canvas renders with new visual tokens"`
  - L2 box renders with `BCM_L2_SURFACE` and `BCM_L2_STROKE`. `> Tested by: tests/e2e/visual-language.spec.ts — "canvas renders with new visual tokens"`
  - Cross-cutting band first chevron renders with `BCM_BAND_RAMP[0]`. `> Tested by: tests/e2e/visual-language.spec.ts — "canvas renders with new visual tokens"`
  - Strategy-marked node renders the configured glyph (`stripe` / `tick` / `corner`). `> Tested by: tests/e2e/visual-language.spec.ts — "canvas renders with new visual tokens"`
  - Focused L2 retains its surface fill and renders `BCM_FOCUS_RING` stroke (single-channel focus). `> Tested by: tests/e2e/visual-language.spec.ts — "focused L2 stroke matches focus ring token"`; `> Tested by: bcm_CapabilityMap.test.js — "L2 focused stroke uses focus ring token"` (renamed from existing test).
  - Out-of-preset tag colour falls back to raw-hex display label in swatch. `> Deferred: presentational, no behaviour change`.

- [ ] **Step 2: Update `CONTEXT.md`** — add a `Visual Tokens` glossary term under a new heading near `LWC Components`:

```markdown
## Visual Tokens
A single source of truth for diagram-specific colours, type scale, focus model, and strategy-mark glyph metadata. Lives in the `bcm_VisualTokens` LWC bundle as JS exports (`BCM_*`) with a hand-synced CSS mirror (`--bcm-*`) for stylesheet consumers. SLDS owns chrome (toolbar, comboboxes, detail-panel form fields); the tokens module owns the SVG canvas and diagram-specific surfaces. See ADR-0005 and `docs/design/10-visual-language.md` for values and rationale.
```

- [ ] **Step 3: Update `docs/design/99-cosmic-function-point-count.md`** — append exclusion-table row at the end of §6 (or wherever the existing exclusion rows live):

```markdown
| Visual-language refresh (GH #43, 2026-mm-dd) | Tokenised palette + type scale + focus-model swap + strategy-mark glyph swap. No data movement crosses the software boundary. Same exclusion class as canvas focus outline suppression. |
```

  Replace `2026-mm-dd` with the actual completion date. [[feedback_mark_complete_fp_table]] — this exclusion-row write IS the FP-table tick for this issue.

- [ ] **Step 4: Edit issue #43 on GitHub** — append AC bullet to the issue body:

```bash
gh issue edit 43 --repo deniskrizanovic/sf_businesscapability \
  --body "$(gh issue view 43 --repo deniskrizanovic/sf_businesscapability --json body -q .body)

- [ ] Focus state simplified from fill-shift+stroke to single-channel stroke ring (per ADR-0005); other interaction states (dashed-hidden, tag-highlight, strategy-mark) unchanged."
```

  (Run interactively if the appended body needs eyeballing; the above is the one-liner equivalent.)

- [ ] **Step 5: Commit** —
```bash
git add docs/specs/diagram.md CONTEXT.md docs/design/99-cosmic-function-point-count.md
git commit -m "docs: spec, context, FP exclusion for visual language refresh (GH #43)"
```

---

## Task 15: Final verification + open PR

**No file changes (other than the plan status flip).**

- [ ] **Step 1: Re-run all tests** — `npx jest && npx playwright test`. All green.

- [ ] **Step 2: Re-run lint** — `npm run lint`. Clean.

- [ ] **Step 3: Side-by-side check** — open the chosen mockup HTML and the live diagram. Compare every visual surface: L1 (default/focused), L2 (default/focused/dashed/tag-highlighted), L3 (default/focused/dashed/tag-highlighted), cross-cutting bands, strategy mark, toolbar, detail panel. Acceptable drift only. Note any drift in PR description.

- [ ] **Step 4: Flip plan status to Completed** — change top-of-file `> **Status:** Draft 2026-06-10.` to `> **Status:** Completed 2026-mm-dd.`.

- [ ] **Step 5: Commit plan status flip + open PR** —
```bash
git add docs/plans/2026-06-10-16:16-issue-43-visual-language-refresh.md
git commit -m "docs(plan): mark visual language refresh plan complete (GH #43)"
git push -u origin sf_businesscapability-43
gh pr create --title "feat(visualisation): refresh visual language with tokens module (GH #43)" --body "$(cat <<'EOF'
## Summary
- Adds `bcm_VisualTokens` LWC module centralising palette, type scale, focus colour, strategy-mark glyph, cross-cutting band ramp, and tag presets.
- Replaces ad-hoc hex literals across `bcm_CapabilityMap.{js,html,css}`, `bcm_CapabilityDetail.{js,css}`, `bcm_ColourSwatch.js` with token references.
- Adopts chosen aesthetic direction (see ADR-0005); single-channel stroke-ring focus model.
- Adds reference PNGs and palette regression spec.

## Test plan
- [ ] All existing Jest tests pass with updated visual-state assertions
- [ ] All existing e2e tests pass
- [ ] New `tests/e2e/visual-language.spec.ts` asserts sampled fills/strokes against new tokens
- [ ] Manual capture script (`tests/e2e/__visual__/capture.spec.ts`) drives diagram through every visual state and writes reference PNGs
- [ ] Side-by-side check against chosen mockup HTML — no unintended drift
- [ ] Out-of-palette tag colour falls back to raw-hex swatch label (visual sanity-check)
EOF
)"
```

---

## Risks

| Risk | Mitigation |
|---|---|
| LWC stylesheet boundary forces `:host` block duplication across consumers | Keep `bcm_VisualTokens.css` as the canonical source; copy block into each consumer with a comment pointing to it. Drift caught by `visual-language.spec.ts` because computed `fill`/`stroke` would no longer match expected tokens. |
| Existing tag records hold colours outside the new preset palette | Acceptable soft degradation — swatch falls back to raw hex display. Documented in ADR + design doc. No data migration. |
| Single-channel focus less prominent than today | `BCM_FOCUS_RING` chosen for ≥3:1 contrast against every surface; ring weight 2px per WCAG 2.4.7. Issue #43 AC edited to call out the change explicitly so it isn't reviewed as a regression. |
| Strategy-mark `kind` swap requires geometry changes in `_buildLayout` + template branches | Constrained: three discrete glyphs with clear geometry. Unit-tested in Jest by asserting one expected output element per kind. |
| Chosen direction tests poorly with stakeholders post-merge | Standard `git revert`. ADR documents alternatives so a re-pick follows the same flow. |
| Reference PNGs go stale as the canvas evolves | Capture script is one command. Re-run on any visual-affecting PR. Document the workflow in the design doc. |
| LWC import path `c/bcm_VisualTokens` must work in Jest | Existing Jest config supports `c/*` LWC imports; verified by Task 12 step 5. If broken, add a Jest path mapping. |

---

## Out of scope (re-asserting locked decisions)

- SLDS / SLDS2 / Cosmos design-system migration
- Layout / geometry changes (chevron / box / bullet shapes; band position)
- Interaction model changes (drag/drop, zoom/pan, click semantics)
- Data model changes; migration of existing `bcm_Tag__c.bcm_Colour__c` values
- Tag colour-picker UI (only `COLOUR_LABELS` repurposed)
- Dark mode
- Accessibility audit beyond focus-ring contrast
- Animation / transitions
- Icon refresh (toolbar icons stay SLDS)
- Strategic Support detection logic (only the visual mark changes)
