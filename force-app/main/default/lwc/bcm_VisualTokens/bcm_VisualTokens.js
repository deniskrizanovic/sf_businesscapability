// SPDX: Visual tokens for the BCM diagram canvas.
// Direction: A — Editorial Monochrome (per ADR-0005).
// CSS mirror: bcm_VisualTokens.css (hand-synced; LWC stylesheets cannot cross-import).

// Surface — Level 1 chevrons
export const BCM_L1_FILL = '#f7f7f7';
export const BCM_L1_FILL_FOCUSED = BCM_L1_FILL; // single-channel focus — fill stable
export const BCM_L1_STROKE = '#e0e0e0';
export const BCM_L1_LABEL = '#333333';

// Surface — Level 2 boxes
export const BCM_L2_SURFACE = '#f0f0f0';
export const BCM_L2_SURFACE_FOCUSED = BCM_L2_SURFACE;
export const BCM_L2_STROKE = '#e0e0e0';
export const BCM_L2_LABEL = '#333333';

// Surface — Level 3 bullets
export const BCM_L3_LABEL = '#333333';
export const BCM_L3_LABEL_DIMMED = '#999999';
export const BCM_L3_FOCUS_RECT = '#0070D2';

// Tag fallback (out-of-preset / dashed-hidden default)
export const BCM_TAG_FALLBACK = '#ffffff';

// Tag swatch fallback (detail panel missing tag colour)
export const BCM_TAG_SWATCH_FALLBACK = '#cccccc';

// Focus
export const BCM_FOCUS_RING = '#0070D2';
export const BCM_FOCUS_RING_WIDTH = 3; // px

// Cross-cutting band
export const BCM_BAND_RAMP = ['#f7f7f7', '#ececec', '#e0e0e0', '#d4d4d4'];
export const BCM_BAND_DIVIDER = '#c0c0c0';
export const BCM_BAND_STROKE = '#0e2342'; // band edge stroke (same as legacy band stroke); kept for back-compat with existing _buildLayout

// Strategy mark
export const BCM_STRATEGY_MARK = Object.freeze({
    kind: 'stripe',
    fill: '#c29b3d',
    weight: 6,
    l1Variant: 'chevron-edge'
});

// Tag presets (curated dictionary surfaced via bcm_ColourSwatch)
export const BCM_TAG_PRESETS = Object.freeze([
    { hex: '#e8e8e8', label: 'Soft Slate' },
    { hex: '#f5f1e8', label: 'Muted Sand' },
    { hex: '#e8f0e8', label: 'Pale Sage' },
    { hex: '#f0e8e8', label: 'Desaturated Rose' },
    { hex: '#e8eff5', label: 'Faint Sky' },
    { hex: '#d0d0d0', label: 'Mid Grey' },
    { hex: '#b8b8b8', label: 'Darker Slate' },
    { hex: '#ede8e0', label: 'Warm Beige' },
    { hex: '#e8dcd0', label: 'Muted Terracotta' },
    { hex: '#ece8f0', label: 'Pale Lilac' }
]);

// Type scale
export const BCM_TYPE_L1 = Object.freeze({ size: 16, weight: 600, tracking: 0, family: 'Georgia, serif' });
export const BCM_TYPE_L2 = Object.freeze({ size: 14, weight: 400, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" });
export const BCM_TYPE_L3 = Object.freeze({ size: 12, weight: 400, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" });
export const BCM_TYPE_BAND_LABEL = Object.freeze({ size: 14, weight: 500, tracking: 0, family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" });

// Chrome — toolbar + canvas
// Note: BCM_BAND_LABEL_LIGHT = #ffffff preserves future contrast logic for darker ramps.
// Current greyscale ramp (all > 50% lightness) uses BCM_BAND_LABEL_DARK = #222222 for all bands.
export const BCM_TOOLBAR_BG = '#ffffff';
export const BCM_TOOLBAR_DIVIDER = '#e0e0e0';
export const BCM_CANVAS_BG = '#fafafa';
export const BCM_BAND_LABEL_LIGHT = '#ffffff'; // for darker bands (only used if a band fill < 50% lightness; in greyscale ramp every step is light enough that BCM_BAND_LABEL_DARK is used)
export const BCM_BAND_LABEL_DARK = '#222222';

// Chrome — detail panel
export const BCM_PANEL_BG = '#ffffff';
export const BCM_PANEL_HEADER_BG = '#f7f7f7';
export const BCM_PANEL_HEADER_TEXT = '#333333';
export const BCM_PANEL_BODY_TEXT = '#333333';
export const BCM_PANEL_SECONDARY_TEXT = '#6b6b6b';
export const BCM_PANEL_DIVIDER = '#e0e0e0';
