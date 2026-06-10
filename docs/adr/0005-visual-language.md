# ADR 0005: Visual language for the capability map

## Status

Accepted

## Context

Visual surfaces in the BCM diagram evolved ad-hoc per feature. The cross-cutting band ramp used `#1a3d6b–#587bad`. L1 chevrons used `#4A4A4A–#2A2A2A`. Tag swatches held arbitrary user-picked colours. The strategy stripe used `#E8A33D`. No single visual system connected these choices. The diagram read as four unrelated UIs stacked.

Issue #43 called for cohesion: a unified palette, focus model, strategy mark, and cross-cutting band ramp that presents as one diagram, not disconnected surfaces.

## Decision

Adopt an **SLDS-aligned chrome** + **bespoke canvas tokens** stance. SLDS owns toolbar buttons, comboboxes, and detail-panel form fields. Custom tokens own the SVG canvas and diagram-specific surfaces. Tokens are centralised in `bcm_VisualTokens` LWC module (`BCM_*` JS exports). CSS counterparts live as `--bcm-*` custom properties in `bcm_CapabilityMap.css :host` — CSS vars inherit through LWC shadow boundaries, so child components (e.g. `bcm_CapabilityDetail`) consume them without redeclaration.

**Chosen aesthetic direction: A — Editorial Monochrome.** Greyscale base with Georgia serif for L1 labels, system sans for L2/L3, SLDS blue focus ring, and muted gold strategy accent.

**Single-channel stroke-ring focus.** L1 and L2 no longer shift fill on focus. Focus is visible only via stroke (`BCM_FOCUS_RING`). Ring weight is 3px, meeting WCAG 2.4.7 at ≥4.5:1 contrast against every surface (L1 fill, L2 fill, canvas background).

**Per-direction strategy-mark glyph.** Direction A uses `kind: 'stripe'` with an **L1 variant `chevron-edge`**: the strategy mark hugs the chevron's left arrow shape on L1; L2/L3 use a simple vertical stripe at the left edge of the box/bullet. Metadata encoded in `BCM_STRATEGY_MARK = { kind, fill, weight, l1Variant }`.

**Ramped 4-step single-hue greyscale cross-cutting band.** `BCM_BAND_RAMP = ['#f7f7f7', '#ececec', '#e0e0e0', '#d4d4d4']`. Index wraps for >4 bands (existing behaviour preserved). Optional `BCM_BAND_DIVIDER` defined (`#c0c0c0`) but not rendered in direction A.

**Tag presets curated via `BCM_TAG_PRESETS`.** Repurposed `bcm_ColourSwatch.COLOUR_LABELS` to source from the tokens module. Existing `bcm_Tag__c.bcm_Colour__c` records are user data and untouched. Out-of-palette tag colours fall back to raw-hex display labels in the swatch (acceptable soft degradation, no data migration).

## Alternatives considered

**Pure SLDS tokens for everything.** Rejected because SLDS does not accommodate the L1 chevron greyscale ramp or the cross-cutting band ramp. Forcing every diagram surface into SLDS colour slots would eliminate the visual hierarchy that distinguishes L1 from L2 from cross-cutting.

**Fully bespoke whole-page design.** Rejected because the toolbar and detail panel use SLDS components (comboboxes, lightning-input, lightning-button). A fully bespoke palette would clash with SLDS chrome. The hybrid stance preserves SLDS component familiarity while giving the diagram its own identity.

**Hybrid `--bcm-*` CSS overlay referencing SLDS tokens.** Expressive (e.g. `--bcm-l1-fill: var(--slds-c-background-neutral-1)`) but heavy plumbing: every token would need a semantic mapping to an SLDS slot, and SLDS slots shift per theme. Rejected in favour of direct hex values in `bcm_VisualTokens.js` + `.css` for simplicity. If SLDS upgrades affect chrome, only the toolbar/panel components see the change — the canvas stays pinned.

**Dual-channel focus (fill shift + stroke ring).** Rejected because it collides with tag highlight (L2 fill changes colour when a tag is selected). Single-channel stroke-ring focus is cleaner across all interaction states (default, focused, tag-highlighted, dashed-hidden) and meets WCAG 2.4.7 with a 3px ring at ≥4.5:1.

**Direction B (refined corporate) and Direction C (architectural / blueprint).** Presented at the HITL gate in Task 4. Rejected in favour of Direction A.

## Consequences

**Future palette changes happen in two places.** If the product evolves to a coloured palette, update `bcm_VisualTokens.js` (JS constants) and `bcm_CapabilityMap.css :host` (CSS custom properties) together. No other component needs changes.

**SLDS upgrades affect chrome only.** If SLDS ships a new Lightning Input style, the detail panel reflects it. The canvas remains stable because it sources no SLDS tokens.

**Existing tag colours outside the new preset palette display raw-hex labels in the swatch.** Acceptable soft degradation. No data migration. Tags with out-of-palette colours still render correctly on the canvas (L2 fill, L3 bullet fill); only the swatch label falls back to the hex string. Documented in the spec and the design doc.

**Focus state visibly different from before.** The L2 focus rect underlay is removed. Focus is stroke-only. Documented in the spec and called out in issue #43 AC. Visual regression testing catches unintended drift.

**Strategy-mark glyph shape is direction-specific.** Direction A uses `kind: 'stripe'` with L1 variant `chevron-edge`. If the product later adopts a different direction, `BCM_STRATEGY_MARK` must be updated and the layout code must handle the new `kind` (e.g. `tick`, `corner`). Task 8 wired the switch logic into `_buildLayout`.

**CSS custom properties inherit through LWC shadow boundaries** — no duplication needed. `bcm_CapabilityMap.css :host` is the single CSS definition. Child components consume `--bcm-*` vars via inheritance. `bcm_VisualTokens.css` was deleted; `bcm_VisualTokens.js` remains the JS source of truth. Drift between JS constants and CSS vars is caught by `tests/e2e/visual-language.spec.ts`.

## Verification

**Playwright e2e spec:** `tests/e2e/visual-language.spec.ts` asserts sampled `fill`/`stroke` attributes on L1 chevrons, L2 boxes, L3 bullets, cross-cutting bands, and strategy-marked nodes match expected token values. Test constants mirror `BCM_*` values but do not import them — this makes the spec a true regression check.

**Reference PNGs:** `tests/e2e/__visual__/` contains committed baseline PNGs captured via manual-run `tests/e2e/__visual__/capture.spec.ts`. States: default, L1-focused, L2-focused, L2-dashed, L3-focused, tag-highlighted, strategy-on, full-canvas-baseline, detail-panel-open. Re-run the capture script on any visual-affecting change.

**Token values:** listed in `docs/design/10-visual-language.md` with hex, rgb, intended surface, and CSS custom property mapping.
