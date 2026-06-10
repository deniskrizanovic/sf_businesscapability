# Visual Language Token Harvest — Direction A: Editorial Monochrome

Generated: 2026-06-10  
Source: `docs/design/mockups/visual-language-editorial.html` (post-HITL tweak)  
Plan: `docs/plans/2026-06-10-16:16-issue-43-visual-language-refresh.md`

## Token Table

| Token                              | Hex/Value                                                                                                             | Surface                   | Notes                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| **L1 Chevron**                     |                                                                                                                       |                           |                                                                      |
| BCM_L1_FILL                        | `#f7f7f7`                                                                                                             | L1 polygon                | Greyscale light                                                      |
| BCM_L1_FILL_FOCUSED                | `#f7f7f7`                                                                                                             | L1 polygon                | Same fill — single-channel focus (no fill shift)                     |
| BCM_L1_STROKE                      | `#e0e0e0`                                                                                                             | L1 polygon                | Default border                                                       |
| BCM_L1_LABEL                       | `#333333`                                                                                                             | L1 text                   | Dark text on light fill                                              |
| **L2 Box**                         |                                                                                                                       |                           |                                                                      |
| BCM_L2_SURFACE                     | `#f0f0f0`                                                                                                             | L2 rect                   | Greyscale mid-light                                                  |
| BCM_L2_SURFACE_FOCUSED             | `#f0f0f0`                                                                                                             | L2 rect                   | Same fill — single-channel focus                                     |
| BCM_L2_STROKE                      | `#e0e0e0`                                                                                                             | L2 rect                   | Default border                                                       |
| BCM_L2_LABEL                       | `#333333`                                                                                                             | L2 text                   | Dark text on light fill                                              |
| **L3 Bullet**                      |                                                                                                                       |                           |                                                                      |
| BCM_L3_LABEL                       | `#333333`                                                                                                             | L3 text                   | Dark text                                                            |
| BCM_L3_LABEL_DIMMED                | `#999999`                                                                                                             | L3 text                   | Dashed-italic muted text                                             |
| BCM_L3_FOCUS_RECT                  | `#0070D2`                                                                                                             | L3 circle stroke          | Same as focus ring                                                   |
| **Tag Fallback**                   |                                                                                                                       |                           |                                                                      |
| BCM_TAG_FALLBACK                   | `#ffffff`                                                                                                             | L2 dashed-hidden fill     | White default when tag has no preset                                 |
| **Focus**                          |                                                                                                                       |                           |                                                                      |
| BCM_FOCUS_RING                     | `#0070D2`                                                                                                             | All shapes                | SLDS blue, 4.6:1 vs white                                            |
| BCM_FOCUS_RING_WIDTH               | `3px`                                                                                                                 | All shapes                | Ring thickness                                                       |
| **Cross-Cutting Band**             |                                                                                                                       |                           |                                                                      |
| BCM_BAND_RAMP                      | `["#f7f7f7", "#ececec", "#e0e0e0", "#d4d4d4"]`                                                                        | Band fills                | 4-step greyscale ramp, lightest → darkest                            |
| BCM_BAND_DIVIDER                   | `#c0c0c0`                                                                                                             | Band stroke               | Thick border between bands                                           |
| **Strategy Mark**                  |                                                                                                                       |                           |                                                                      |
| BCM_STRATEGY_MARK                  | `{ kind: 'stripe', fill: '#c29b3d', weight: 6, l1Variant: 'chevron-edge' }`                                           | Overlay                   | Gold accent; L1 uses chevron-edge polygon, L2/L3 use vertical stripe |
| **Tag Presets (10 curated pairs)** |                                                                                                                       |                           |                                                                      |
| BCM_TAG_PRESETS                    | `[`                                                                                                                   |                           | Harmonious with greyscale base                                       |
|                                    | `{ hex: "#e8e8e8", label: "Soft Slate" },`                                                                            |                           | Light neutral                                                        |
|                                    | `{ hex: "#f5f1e8", label: "Muted Sand" },`                                                                            |                           | Warm beige tint                                                      |
|                                    | `{ hex: "#e8f0e8", label: "Pale Sage" },`                                                                             |                           | Soft green                                                           |
|                                    | `{ hex: "#f0e8e8", label: "Desaturated Rose" },`                                                                      |                           | Muted pink                                                           |
|                                    | `{ hex: "#e8eff5", label: "Faint Sky" },`                                                                             |                           | Pale blue                                                            |
|                                    | `{ hex: "#d0d0d0", label: "Mid Grey" },`                                                                              |                           | Mid neutral                                                          |
|                                    | `{ hex: "#b8b8b8", label: "Darker Slate" },`                                                                          |                           | Deeper grey                                                          |
|                                    | `{ hex: "#ede8e0", label: "Warm Beige" },`                                                                            |                           | Warmer neutral                                                       |
|                                    | `{ hex: "#e8dcd0", label: "Muted Terracotta" },`                                                                      |                           | Soft earthy                                                          |
|                                    | `{ hex: "#ece8f0", label: "Pale Lilac" }`                                                                             |                           | Light purple                                                         |
|                                    | `]`                                                                                                                   |                           |                                                                      |
| **Type Scale**                     |                                                                                                                       |                           |                                                                      |
| BCM_TYPE_L1                        | `{ size: 16, weight: 600, tracking: 0, family: "Georgia, serif" }`                                                    | L1 text                   | Editorial serif                                                      |
| BCM_TYPE_L2                        | `{ size: 14, weight: 400, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }` | L2 text                   | Sans-serif                                                           |
| BCM_TYPE_L3                        | `{ size: 12, weight: 400, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }` | L3 text                   | Smaller sans                                                         |
| BCM_TYPE_BAND_LABEL                | `{ size: 14, weight: 500, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }` | Band text                 | Medium weight sans                                                   |
| **Chrome (Toolbar + Canvas)**      |                                                                                                                       |                           |                                                                      |
| BCM_TOOLBAR_BG                     | `#ffffff`                                                                                                             | Toolbar row               | White bg                                                             |
| BCM_TOOLBAR_DIVIDER                | `#e0e0e0`                                                                                                             | Toolbar border            | Bottom border                                                        |
| BCM_CANVAS_BG                      | `#fafafa`                                                                                                             | Canvas fill               | Very light grey                                                      |
| BCM_BAND_LABEL_LIGHT               | `#333333`                                                                                                             | Band text (darker bands)  | Dark text for contrast on darker bands                               |
| BCM_BAND_LABEL_DARK                | `#333333`                                                                                                             | Band text (lighter bands) | Same as light; all bands light enough for dark text                  |
| **Detail Panel**                   |                                                                                                                       |                           |                                                                      |
| BCM_PANEL_BG                       | `#ffffff`                                                                                                             | Panel bg                  | White                                                                |
| BCM_PANEL_HEADER_BG                | `#f7f7f7`                                                                                                             | Panel header              | Light grey                                                           |
| BCM_PANEL_HEADER_TEXT              | `#333333`                                                                                                             | Panel h2                  | Dark                                                                 |
| BCM_PANEL_BODY_TEXT                | `#333333`                                                                                                             | Panel p                   | Dark                                                                 |
| BCM_PANEL_SECONDARY_TEXT           | `#6b6b6b`                                                                                                             | Panel muted p             | Muted grey, 5.7:1 vs white                                           |
| BCM_PANEL_DIVIDER                  | `#e0e0e0`                                                                                                             | Panel border              | Bottom border                                                        |

## Decision Summary

**Direction:** A — Editorial Monochrome  
**Palette:** Greyscale base with SLDS blue focus ring (#0070D2, 4.6:1 vs white) and muted gold strategy accent (#c29b3d).  
**Typography:** Serif (Georgia) for L1, sans-serif system stack for L2/L3/bands/chrome.  
**Focus Model:** Single-channel stroke ring only; no fill shift on focus.  
**Strategy Kind:** `stripe` (vertical bar for L2/L3; **chevron-edge polygon for L1** per HITL tweak).  
**L1 Strategy Geometry:** 6px-thick polygon hugging the left arrow edge of the chevron, filling the arrow tip region.  
**L2 Strategy Geometry:** 6px-wide vertical rect on left edge (no rx to avoid invalid multi-value syntax).  
**L3 Strategy Geometry:** 3px-wide vertical rect next to bullet.  
**Tag Presets:** 10 harmonious values (greyscale + muted accents) for curated tag picker.

## Next Steps

Task 5: Define `bcm_VisualTokens.js` module exporting the token constants above.  
Task 8: Update `_buildLayout` to branch on level when strategy kind is `stripe` + l1Variant is `chevron-edge`.
