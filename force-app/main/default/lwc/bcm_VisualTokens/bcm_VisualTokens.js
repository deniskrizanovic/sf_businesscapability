// Visual tokens for the BCM diagram canvas.
// Direction: A — Editorial Monochrome (per ADR-0005).
// JS source of truth for SVG-drawn values. CSS counterparts live in bcm_CapabilityMap.css :host block — keep in sync when changing values here.

// Surface — Level 1 chevrons
export const BCM_L1_FILL = '#ebebeb';
export const BCM_L1_FILL_FOCUSED = BCM_L1_FILL; // single-channel focus — fill stable
export const BCM_L1_STROKE = '#e0e0e0';
export const BCM_L1_LABEL = '#333333';

// Surface — Level 2 boxes
export const BCM_L2_SURFACE = '#ffffff';
export const BCM_L2_SURFACE_FOCUSED = BCM_L2_SURFACE;
export const BCM_L2_GHOST_FILL = '#f0f0f0'; // drag ghost only — lighter tint so ghost reads as displaced
export const BCM_L2_STROKE = '#e0e0e0';
export const BCM_L2_LABEL = '#333333';

// Surface — Level 3 bullets
export const BCM_L3_LABEL = '#333333';
export const BCM_L3_LABEL_DIMMED = '#999999';

// Tag fallback (out-of-preset / dashed-hidden default)
export const BCM_TAG_FALLBACK = '#ffffff';

// Tag swatch fallback (detail panel missing tag colour)
export const BCM_TAG_SWATCH_FALLBACK = '#cccccc';

// Focus
export const BCM_FOCUS_RING = '#0070D2';

// Cross-cutting band
export const BCM_BAND_RAMP = ['#f7f7f7', '#ececec', '#e0e0e0', '#d4d4d4'];
export const BCM_BAND_STROKE = '#0e2342'; // band edge stroke (same as legacy band stroke); kept for back-compat with existing _buildLayout
export const BCM_BAND_LABEL_LIGHT = '#ffffff'; // for darker bands (only used if a band fill < 50% lightness; greyscale ramp always resolves to BCM_BAND_LABEL_DARK)
export const BCM_BAND_LABEL_DARK = '#222222';

// Strategy mark
export const BCM_STRATEGY_MARK = Object.freeze({
    kind: 'stripe',
    fill: '#c29b3d',
    weight: 6,
    l1Variant: 'chevron-edge'
});

// Tag presets surfaced via bcm_ColourSwatch. Hexes match bcm_Tag__c.bcm_Colour__c
// picklist values; this module is the canonical lookup so the swatch and any
// future picker share one source.
// Detail panel — secondary text (imported by bcm_CapabilityMap.js for JS-computed getter)
export const BCM_PANEL_SECONDARY_TEXT = '#6b6b6b';

// Tag presets surfaced via bcm_ColourSwatch. Hexes match bcm_Tag__c.bcm_Colour__c picklist values.
export const BCM_TAG_PRESETS = Object.freeze([
    { hex: '#BDD0EE', label: 'Blue' },
    { hex: '#C8D9CE', label: 'Green' },
    { hex: '#E8C8C8', label: 'Red' },
    { hex: '#D5CEDF', label: 'Purple' },
    { hex: '#EDD9C2', label: 'Orange' },
    { hex: '#C6D5D5', label: 'Teal' },
    { hex: '#EDD0D9', label: 'Pink' },
    { hex: '#EDE0C2', label: 'Amber' },
    { hex: '#C9CCDF', label: 'Indigo' },
    { hex: '#C8D9CC', label: 'Emerald' }
]);
