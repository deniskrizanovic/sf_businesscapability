# Plan 03: Diagram Layout

## Overview
The diagram is a pure SVG rendered inside the `bcm_CapabilityMap` LWC. Layout is calculated entirely in JavaScript from a flat list of `bcm_Capability__c` records. No DOM measurement is required — all dimensions are derived from record counts and fixed constants.

## Layout Constants
Defined at the top of the `bcm_CapabilityMap` JS controller:

```js
const COLUMN_WIDTH       = 220;   // px, all columns equal width
const COLUMN_GAP         = 16;    // px, horizontal gap between columns
const CHEVRON_HEIGHT     = 60;    // px, height of L1 chevron row
const CHEVRON_NOTCH      = 16;    // px, depth of right-pointing arrow notch
const BOX_PADDING        = 12;    // px, internal padding inside L2 boxes
const BOX_HEADER_HEIGHT  = 40;    // px, minimum height of L2 box before L3 items
const LINE_HEIGHT        = 20;    // px, height per L3 bullet line
const BOX_GAP            = 12;    // px, vertical gap between L2 boxes in a column
const DIAGRAM_PADDING    = 24;    // px, outer padding around entire diagram
const FONT_SIZE_L1       = 13;    // px
const FONT_SIZE_L2       = 12;    // px
const FONT_SIZE_L3       = 11;    // px
```

## Tree Assembly (Client-Side JS)
After the flat list of capabilities arrives from Apex:

1. Build a `Map<Id, node>` where each node is `{ ...record, children: [] }`
2. Walk the flat list; for each record with a `bcm_Parent__c`, push it onto its parent's `children` array
3. Collect root nodes (no parent) sorted by `bcm_SortOrder__c` — these are the L1 columns
4. Sort children at each level by `bcm_SortOrder__c`

## Column Layout Calculation

Each L1 Capability defines one column. For each column:

```
columnX = DIAGRAM_PADDING + (columnIndex × (COLUMN_WIDTH + COLUMN_GAP))
```

For each L2 box within a column:

```
boxHeight = BOX_HEADER_HEIGHT + (l3ChildCount × LINE_HEIGHT) + (BOX_PADDING × 2)
boxY = CHEVRON_HEIGHT + BOX_GAP + sum of (previous sibling boxHeights + BOX_GAP)
```

Total SVG canvas dimensions:

```
canvasWidth  = DIAGRAM_PADDING × 2 + (columnCount × COLUMN_WIDTH) + ((columnCount - 1) × COLUMN_GAP)
canvasHeight = DIAGRAM_PADDING × 2 + CHEVRON_HEIGHT + BOX_GAP + tallestColumnHeight
```

Where `tallestColumnHeight` = sum of all L2 box heights + gaps in the tallest column.

## SVG Element Types

### L1 Chevron
A `<polygon>` with 6 points forming a right-pointing arrow:

```
(x, y)                         → top-left
(x + COLUMN_WIDTH - NOTCH, y)  → top before notch
(x + COLUMN_WIDTH, y + h/2)    → right point
(x + COLUMN_WIDTH - NOTCH, y + h) → bottom before notch
(x, y + h)                     → bottom-left
(x, y)                         → close
```

Fill: `#4A4A4A` (dark grey, all L1 chevrons same colour).
Text: `<text>` centered in the chevron bounding box, white, `FONT_SIZE_L1`, wrapped if needed.

### L2 Box
A `<rect>` with `rx="6"` (rounded corners).

```
x      = columnX
y      = calculated boxY
width  = COLUMN_WIDTH
height = calculated boxHeight
fill   = white (default) or tag highlight colour
stroke = #CCCCCC
```

Text: `<text>` at `(x + BOX_PADDING, y + BOX_PADDING)`, `FONT_SIZE_L2`, bold, wraps to 2 lines max.

### L3 Bullet Items
For each L3 child of an L2 box, a `<text>` element:

```
x    = boxX + BOX_PADDING + 8   (indent for bullet)
y    = boxY + BOX_HEADER_HEIGHT + (index × LINE_HEIGHT)
text = "• " + capability name
font-size = FONT_SIZE_L3
fill = #444444
```

No separate box — bullets are rendered inside the parent L2 box's allocated height.

## Text Wrapping
SVG has no native text wrapping. Strategy:

- L1 and L2 labels: split on spaces, measure character width using a fixed character width estimate (`charWidth = fontSize × 0.6`), break into lines when line exceeds `COLUMN_WIDTH - (BOX_PADDING × 2)`
- Maximum 3 lines for L1, 3 lines for L2 header
- L3 bullet text: single line, truncated with `…` if it exceeds available width

## Zoom and Pan
A single `<g id="viewport">` wraps all diagram content:

```svg
<svg>
  <g id="viewport" transform="translate(panX, panY) scale(zoom)">
    <!-- all diagram content -->
  </g>
</svg>
```

**Zoom:**
- Mouse wheel: increment/decrement `zoom` by `0.1`, clamped between `0.2` and `3.0`
- Zoom origin: cursor position (transform adjusted to zoom toward cursor)
- `+` / `-` buttons: same increment/decrement, zoom origin = canvas centre

**Pan:**
- Click-drag on SVG background (not on a node): update `panX`, `panY` on mousemove
- Cursor changes to `grab` on hover over background, `grabbing` during drag

**State:** `zoom`, `panX`, `panY` are tracked JS properties. The `transform` attribute is recomputed reactively.

## Tag Highlight Rendering
When a tag is selected in the toolbar combobox:

1. Collect all Capability Ids carrying that tag (available in the loaded dataset)
2. When rendering each L2 `<rect>`, check if its Id is in the highlighted set
3. If yes: fill = tag's `bcm_Colour__c` value; if no: fill = `#FFFFFF`
4. L3 bullet text colour changes to `#000000` (bold) when its parent L2 is highlighted

Re-render is triggered by changing the selected tag — no new Apex call needed, data is already loaded.

## Rendering Mode Override
Default rendering by level: L1 = chevron, L2 = box, L3 = bullet list.

A future `bcm_RenderMode__c` picklist field on `bcm_Capability__c` (values: `Default`, `Box`, `List`) on an L2 record controls whether its L3 children render as bullets or as individual boxes. Not implemented in v1 — architecture accommodates it by checking this field before choosing the renderer.
