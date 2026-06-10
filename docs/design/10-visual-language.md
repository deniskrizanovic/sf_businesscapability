# Design 10: Visual Language

Canonical token definitions for the Business Capability Map diagram. Direction A — Editorial Monochrome (per ADR-0005).

**Source:** `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js`  
**References:** [ADR-0005](../adr/0005-visual-language.md), [GH #43](https://github.com/deniskrizanovic/businesscapabilitymap/issues/43)

## Token Table

### Surface — Level 1 Chevrons

| Token                 | Hex/Value | RGB           | Surface                   | CSS custom property     |
| --------------------- | --------- | ------------- | ------------------------- | ----------------------- |
| `BCM_L1_FILL`         | `#ebebeb` | 235, 235, 235 | L1 polygon fill           | `--bcm-l1-fill`         |
| `BCM_L1_FILL_FOCUSED` | `#ebebeb` | 235, 235, 235 | L1 polygon fill (focused) | `--bcm-l1-fill-focused` |
| `BCM_L1_STROKE`       | `#e0e0e0` | 224, 224, 224 | L1 polygon border         | `--bcm-l1-stroke`       |
| `BCM_L1_LABEL`        | `#333333` | 51, 51, 51    | L1 text                   | `--bcm-l1-label`        |

### Surface — Level 2 Boxes

| Token                    | Hex/Value | RGB           | Surface                | CSS custom property        |
| ------------------------ | --------- | ------------- | ---------------------- | -------------------------- |
| `BCM_L2_SURFACE`         | `#ffffff` | 255, 255, 255 | L2 rect fill           | `--bcm-l2-surface`         |
| `BCM_L2_SURFACE_FOCUSED` | `#ffffff` | 255, 255, 255 | L2 rect fill (focused) | `--bcm-l2-surface-focused` |
| `BCM_L2_GHOST_FILL`      | `#f0f0f0` | 240, 240, 240 | L2 drag ghost fill     | `--bcm-l2-ghost-fill`      |
| `BCM_L2_STROKE`          | `#e0e0e0` | 224, 224, 224 | L2 rect border         | `--bcm-l2-stroke`          |
| `BCM_L2_LABEL`           | `#333333` | 51, 51, 51    | L2 text                | `--bcm-l2-label`           |

### Surface — Level 3 Bullets

| Token                 | Hex/Value | RGB           | Surface                       | CSS custom property     |
| --------------------- | --------- | ------------- | ----------------------------- | ----------------------- |
| `BCM_L3_LABEL`        | `#333333` | 51, 51, 51    | L3 text                       | `--bcm-l3-label`        |
| `BCM_L3_LABEL_DIMMED` | `#999999` | 153, 153, 153 | L3 text (dashed-italic muted) | `--bcm-l3-label-dimmed` |
| `BCM_L3_FOCUS_RECT`   | `#0070D2` | 0, 112, 210   | L3 circle stroke (focus)      | `--bcm-l3-focus-rect`   |

### Tag Fallback

| Token              | Hex/Value | RGB           | Surface                                    | CSS custom property  |
| ------------------ | --------- | ------------- | ------------------------------------------ | -------------------- |
| `BCM_TAG_FALLBACK` | `#ffffff` | 255, 255, 255 | L2 dashed-hidden fill (no preset assigned) | `--bcm-tag-fallback` |

### Focus

| Token                  | Hex/Value | RGB         | Surface    | CSS custom property      |
| ---------------------- | --------- | ----------- | ---------- | ------------------------ |
| `BCM_FOCUS_RING`       | `#0070D2` | 0, 112, 210 | All shapes | `--bcm-focus-ring`       |
| `BCM_FOCUS_RING_WIDTH` | `3px`     | n/a         | All shapes | `--bcm-focus-ring-width` |

### Cross-Cutting Band

| Token              | Hex/Value | RGB           | Surface             | CSS custom property |
| ------------------ | --------- | ------------- | ------------------- | ------------------- |
| `BCM_BAND_RAMP[0]` | `#f7f7f7` | 247, 247, 247 | Band fill (index 0) | `--bcm-band-0`      |
| `BCM_BAND_RAMP[1]` | `#ececec` | 236, 236, 236 | Band fill (index 1) | `--bcm-band-1`      |
| `BCM_BAND_RAMP[2]` | `#e0e0e0` | 224, 224, 224 | Band fill (index 2) | `--bcm-band-2`      |
| `BCM_BAND_RAMP[3]` | `#d4d4d4` | 212, 212, 212 | Band fill (index 3) | `--bcm-band-3`      |

**Note:** Band index wraps for >4 bands via `index % 4`.

### Strategy Mark

| Token                         | Value                        | Surface                | CSS custom property     |
| ----------------------------- | ---------------------------- | ---------------------- | ----------------------- |
| `BCM_STRATEGY_MARK.kind`      | `'stripe'`                   | Overlay kind           | n/a                     |
| `BCM_STRATEGY_MARK.fill`      | `#c29b3d` (RGB 194, 155, 61) | Strategy accent colour | `--bcm-strategy-fill`   |
| `BCM_STRATEGY_MARK.weight`    | `6`                          | Stripe thickness (px)  | `--bcm-strategy-weight` |
| `BCM_STRATEGY_MARK.l1Variant` | `'chevron-edge'`             | L1 geometry variant    | n/a                     |

### Chrome — Toolbar + Canvas

| Token                  | Hex/Value | RGB           | Surface                   | CSS custom property      |
| ---------------------- | --------- | ------------- | ------------------------- | ------------------------ |
| `BCM_TOOLBAR_BG`       | `#ffffff` | 255, 255, 255 | Toolbar row bg            | `--bcm-toolbar-bg`       |
| `BCM_TOOLBAR_DIVIDER`  | `#e0e0e0` | 224, 224, 224 | Toolbar bottom border     | `--bcm-toolbar-divider`  |
| `BCM_CANVAS_BG`        | `#fafafa` | 250, 250, 250 | Canvas fill               | `--bcm-canvas-bg`        |
| `BCM_BAND_LABEL_LIGHT` | `#ffffff` | 255, 255, 255 | Band text (darker bands)  | `--bcm-band-label-light` |
| `BCM_BAND_LABEL_DARK`  | `#222222` | 34, 34, 34    | Band text (lighter bands) | `--bcm-band-label-dark`  |

**Note:** Current greyscale ramp (all > 50% lightness) uses `BCM_BAND_LABEL_DARK` for all bands. `BCM_BAND_LABEL_LIGHT` reserved for future darker ramps.

### Chrome — Detail Panel

| Token                      | Hex/Value | RGB           | Surface             | CSS custom property          |
| -------------------------- | --------- | ------------- | ------------------- | ---------------------------- |
| `BCM_PANEL_BG`             | `#ffffff` | 255, 255, 255 | Panel bg            | `--bcm-panel-bg`             |
| `BCM_PANEL_HEADER_BG`      | `#f7f7f7` | 247, 247, 247 | Panel header bg     | `--bcm-panel-header-bg`      |
| `BCM_PANEL_HEADER_TEXT`    | `#333333` | 51, 51, 51    | Panel h2 text       | `--bcm-panel-header-text`    |
| `BCM_PANEL_BODY_TEXT`      | `#333333` | 51, 51, 51    | Panel p text        | `--bcm-panel-body-text`      |
| `BCM_PANEL_SECONDARY_TEXT` | `#6b6b6b` | 107, 107, 107 | Panel muted p text  | `--bcm-panel-secondary-text` |
| `BCM_PANEL_DIVIDER`        | `#e0e0e0` | 224, 224, 224 | Panel bottom border | `--bcm-panel-divider`        |

## Type Scale

| Level      | Size | Weight | Tracking | Family                                                            | CSS custom property       |
| ---------- | ---- | ------ | -------- | ----------------------------------------------------------------- | ------------------------- |
| L1         | 16px | 600    | 0        | Georgia, serif                                                    | `--bcm-type-l1-*`         |
| L2         | 14px | 400    | 0        | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif | `--bcm-type-l2-*`         |
| L3         | 12px | 400    | 0        | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif | `--bcm-type-l3-*`         |
| Band Label | 14px | 500    | 0        | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif | `--bcm-type-band-label-*` |

## Focus Model

**Implementation:** Stroke-ring only. Single-channel focus — no fill shift on :focus state.

**Ring specification:**

- **Weight:** 3px
- **Colour:** `#0070D2` (SLDS blue)
- **Fill:** Stable — `BCM_L1_FILL_FOCUSED = BCM_L1_FILL`, `BCM_L2_SURFACE_FOCUSED = BCM_L2_SURFACE`

### Contrast Verification

| Surface         | Hex           | Focus Ring (`#0070D2`)        | Approx Contrast Ratio | WCAG 2.4.7 Non-Text (≥3:1) | WCAG 1.4.3 AA Body Text vs White (≥4.5:1) |
| --------------- | ------------- | ----------------------------- | --------------------- | -------------------------- | ----------------------------------------- |
| L1 fill         | `#ebebeb`     | `#0070D2`                     | ~4.9:1                | ✅ Pass                    | ✅ Pass                                   |
| L2 surface      | `#ffffff`     | `#0070D2`                     | ~4.6:1                | ✅ Pass                    | ✅ Pass                                   |
| L3 default fill | (transparent) | `#0070D2` on canvas `#fafafa` | ~4.5:1                | ✅ Pass                    | ✅ Pass                                   |
| Canvas bg       | `#fafafa`     | `#0070D2`                     | ~4.5:1                | ✅ Pass                    | ✅ Pass                                   |
| Tag fallback    | `#ffffff`     | `#0070D2`                     | ~4.6:1                | ✅ Pass                    | ✅ Pass                                   |

**Note:** Contrast ratios are approximate; calculated via relative luminance formula. All surfaces pass WCAG 2.4.7 for non-text UI components (3:1 threshold). Focus ring vs white (~4.6:1) also passes WCAG 1.4.3 AA threshold (4.5:1) for body text, providing bonus legibility for any text overlaid on the ring.

## Strategy Mark

**Kind:** `stripe`

**Variants by level:**

- **L1:** `chevron-edge` — 6px-thick polygon hugging the left arrow edge of the chevron, filling the arrow tip region
- **L2:** 6px-wide vertical rect on left edge (no border-radius to avoid invalid multi-value SVG `rx` syntax)
- **L3:** 3px-wide vertical rect adjacent to bullet

**Token:**

```javascript
BCM_STRATEGY_MARK = {
    kind: 'stripe',
    fill: '#c29b3d', // muted gold
    weight: 6, // px
    l1Variant: 'chevron-edge'
};
```

## Band Ramp

**Values:** 4-step greyscale ramp, lightest → darkest.

| Index | Hex       | RGB           | Use            |
| ----- | --------- | ------------- | -------------- |
| 0     | `#f7f7f7` | 247, 247, 247 | Lightest band  |
| 1     | `#ececec` | 236, 236, 236 | Light-mid band |
| 2     | `#e0e0e0` | 224, 224, 224 | Mid-dark band  |
| 3     | `#d4d4d4` | 212, 212, 212 | Darkest band   |

**Wrapping:** For diagrams with >4 bands, band index wraps via `index % 4`.

## Tag Presets

10 hex/label pairs surfaced via `bcm_ColourSwatch`. Hexes match the `bcm_Tag__c.bcm_Colour__c` picklist exactly so the swatch lookup, the picklist values, and any future picker share one source of truth.

| Hex       | Label   | RGB           |
| --------- | ------- | ------------- |
| `#BDD0EE` | Blue    | 189, 208, 238 |
| `#C8D9CE` | Green   | 200, 217, 206 |
| `#E8C8C8` | Red     | 232, 200, 200 |
| `#D5CEDF` | Purple  | 213, 206, 223 |
| `#EDD9C2` | Orange  | 237, 217, 194 |
| `#C6D5D5` | Teal    | 198, 213, 213 |
| `#EDD0D9` | Pink    | 237, 208, 217 |
| `#EDE0C2` | Amber   | 237, 224, 194 |
| `#C9CCDF` | Indigo  | 201, 204, 223 |
| `#C8D9CC` | Emerald | 200, 217, 204 |

**Out-of-palette behaviour:** Tags with `bcm_Colour__c` values not in the preset list render a raw-hex display label in the colour swatch. No migration of existing `bcm_Tag__c` records.

## Out of Scope

The following changes are explicitly **not** part of this visual language refresh:

- **Design system migration:** SLDS / SLDS2 / Cosmos tokens not adopted; values are project-defined
- **Layout / geometry changes:** Chevron / box / bullet shapes, band position remain unchanged
- **Interaction model changes:** Selection / focus / keyboard nav behaviour unchanged
- **Data model changes:** No migration of existing `bcm_Tag__c.bcm_Colour__c` values; out-of-preset colours remain valid
- **Tag colour-picker UI:** `COLOUR_LABELS` repurposed for display only; picker component unchanged (future work)
- **Dark mode:** Light-only palette
- **Accessibility audit beyond focus ring contrast:** No full WCAG audit; only focus-ring contrast verified
- **Animation / transitions:** Static rendering only
- **Icon refresh:** Toolbar icons remain SLDS; no custom iconography
- **Strategic Support detection logic:** Strategy mark detection unchanged — only visual rendering updated

## References

- **ADR-0005:** [docs/adr/0005-visual-language.md](../adr/0005-visual-language.md) — Decision record for Direction A (Editorial Monochrome)
- **GH #43:** Visual language refresh issue
- **Harvest doc:** `docs/plans/2026-06-10-16:16-issue-43-visual-language-refresh-harvest.md` — Token extraction from mockup
- **JS module:** `force-app/main/default/lwc/bcm_VisualTokens/bcm_VisualTokens.js` — Canonical source
