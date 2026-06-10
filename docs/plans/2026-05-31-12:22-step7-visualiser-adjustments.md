# Step 7 Visualiser Adjustments

## Context

Four targeted adjustments to `bcm_CapabilityMap` LWC after initial Step 7 delivery. All changes are JS + HTML + CSS only — no new Apex, no metadata changes. One new custom field required for Adjustment 1.

---

## Adjustment 1 — Hide From Diagram flag

### What

New checkbox field `bcm_HideFromDiagram__c` on `bcm_Capability__c`. JS filters hidden nodes from layout. "Show Hidden" toggle in toolbar reveals them with dashed border.

### Field

- Skill: `generating-custom-field`
- Object: `bcm_Capability__c`
- Type: Checkbox, default `false`
- API name: `bcm_HideFromDiagram__c`
- Label: "Hide From Diagram"
- Add to `bcm_CapabilityController.getCapabilities()` SOQL SELECT list

### Behaviour

- Default: toggle OFF — hidden capabilities not rendered
- Toggle ON: hidden capabilities rendered with dashed border (`stroke-dasharray="4 2"`) on both L1 polygon and L2 rect; normal nodes keep solid border
- Cascade: node hidden → entire subtree hidden. Implemented two-pass in `_buildLayout`:
    1. Collect all IDs where `bcm_HideFromDiagram__c = true`
    2. Walk tree; mark any node as hidden if itself OR any ancestor is hidden
    3. Skip hidden nodes from `l1Nodes` / `l2Nodes` / `bulletLines` when toggle is OFF
- Toggle available to both Editor and Viewer roles (no `canEdit` gate)
- Toggle state: `@track showHidden = false`

### Template changes

- Toolbar: add `lightning-button-icon` (or `lightning-button`) for "Show Hidden" toggle, right side of toolbar
- L1 polygon `stroke-dasharray`: conditional on `node.isHidden && showHidden`
- L2 rect `stroke-dasharray`: conditional on `node.isHidden && showHidden`
- Pass `isHidden` flag through layout node objects

### JS changes (`bcm_CapabilityMap.js`)

- Add `@track showHidden = false`
- Add `handleToggleHidden()` → flips `showHidden`, calls `_buildLayout(this._capabilities)`
- `_buildLayout`: two-pass hidden cascade (see above); attach `isHidden` to each layout node
- `_getTagFill`: hidden nodes when visible → still apply tag fill (or white if no tag match)

---

## Adjustment 2 — Keyboard navigation

### What

Arrow keys pan viewport when no node focused; column-aware navigation between nodes when a node is focused. Focused node shows ring + fill highlight.

### Behaviour

**No node focused (pan mode):**

- Arrow keys pan `panX`/`panY` by ±50px per keypress
- SVG element must be `tabIndex="0"` and `onkeydown={handleKeyDown}`

**Node focused (navigate mode):**

- `focusedNodeId` tracked as `@track focusedNodeId = null`
- Left/Right: move between L1 columns (change focused L1, focus its first L2 child)
- Up/Down: move between L2 boxes within current column
- Escape: clear focus → return to pan mode

**Focus indicator:**

- Ring: `stroke="#0070D2" stroke-width="3"` on focused node's rect/polygon
- Fill: L1 chevron fill darkens (`#2A2A2A` instead of `#4A4A4A`); L2 box fill lightens to `#E8F4FF`
- Both computed in layout node: `node.isFocused` flag

### JS changes

- Add `@track focusedNodeId = null`
- Add `handleKeyDown(evt)`:
    ```js
    handleKeyDown(evt) {
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(evt.key)) {
            evt.preventDefault();
        }
        if (!this.focusedNodeId) {
            // pan mode
            const PAN_STEP = 50;
            if (evt.key === 'ArrowLeft')  this.panX += PAN_STEP;
            if (evt.key === 'ArrowRight') this.panX -= PAN_STEP;
            if (evt.key === 'ArrowUp')    this.panY += PAN_STEP;
            if (evt.key === 'ArrowDown')  this.panY -= PAN_STEP;
        } else {
            this._navigateFromKey(evt.key);
        }
    }
    ```
- `_navigateFromKey(key)`: resolves next node ID from column/row index maps built in `_buildLayout`
- `_buildLayout`: attach `colIdx` to L1 nodes, `rowIdx` to L2 nodes; build `_colMap` (colIdx → L1 id) and `_l2ByCol` (colIdx → [L2 ids]) for navigation lookup
- Node click (`handleNodeClick`) → sets `focusedNodeId = nodeId`
- `_buildLayout` passes `isFocused: node.id === this.focusedNodeId` to each layout node

### Template changes

- SVG: add `tabindex="0"` and `onkeydown={handleKeyDown}`
- L1 polygon: conditional `stroke` and `fill` from `node.isFocused`
- L2 rect: conditional `stroke` and `fill` from `node.isFocused`
- L1/L2 nodes pass `strokeColour`, `strokeWidth`, `fillColour` as computed properties from layout

---

## Adjustment 3 — Pinned L1 chevrons

### What

L1 chevrons stay visible at top when user pans vertically. SVG splits into two `<g>` layers with different transforms.

### Implementation

**SVG structure change:**

```html
<!-- L1 layer: pan horizontally, not vertically -->
<g transform="{l1Transform}">
    <!-- L1 chevrons -->
</g>

<!-- L2 layer: full pan + zoom, clipped -->
<clipPath id="bcm-l2-clip">
    <rect x="0" y="{l2ClipY}" width="{canvasWidth}" height="9999"></rect>
</clipPath>
<g transform="{viewportTransform}" clip-path="url(#bcm-l2-clip)">
    <!-- L2 boxes -->
</g>
```

**Computed properties:**

```js
get l1Transform() {
    return `translate(${this.panX}, 0) scale(${this.zoom})`;
}
get l2ClipY() {
    // top of L2 area in screen coords = chevron height × zoom
    return (DIAGRAM_PADDING + CHEVRON_HEIGHT) * this.zoom;
}
```

- `viewportTransform` unchanged (used for L2 layer)
- `l1Transform` uses `panX` only — no `panY`
- `l2ClipY` clips L2 `<g>` so content doesn't render behind pinned chevrons

### Constraint

Horizontal pan (`panX`) still applies to both layers so columns stay aligned. Only `panY` is suppressed for L1.

---

## Adjustment 4 — Text wrapping for L2 + L3

### What

L2 header and L3 bullets wrap to fit content. Box heights grow dynamically. L1 unchanged.

### L2 header

- Remove `maxLines=2` cap → use uncapped `wrapText` (or large cap like 10)
- `BOX_HEADER_HEIGHT` becomes variable: `lines.length * (FONT_SIZE_L2 + 4) + BOX_PADDING * 2`

### L3 bullets

- Replace `truncateText` → `wrapText(raw, maxBullet, FONT_SIZE_L3, 5)` (cap at 5 lines)
- Each L3 item now produces array of lines, not single string
- `bulletLines` structure changes: each entry has `lines: [{text, x, y}]` instead of flat `{text, x, y}`
- Y position for each bullet group starts at previous bullet's end

### Box height recalculation

```js
// Per L3 item: count wrapped lines
const l3Lines = l2.children.map((l3) => wrapText('• ' + l3.Name, maxBullet, FONT_SIZE_L3, 5));
const l3TotalLines = l3Lines.reduce((sum, lines) => sum + lines.length, 0);

// L2 header height
const l2HeaderLines = wrapText(l2.Name, l2MaxW, FONT_SIZE_L2, 10);
const headerHeight = l2HeaderLines.length * (FONT_SIZE_L2 + 4) + BOX_PADDING * 2;

const boxHeight = headerHeight + l3TotalLines * LINE_HEIGHT + BOX_PADDING;
```

### Template changes

- L3 section: `for:each` over `node.bulletLines` (array of line arrays) → nested `for:each` per bullet item lines
- Or flatten all bullet lines into single array with precomputed `y` values — simpler template

Recommended: flatten in JS, keep template simple. Each entry in `bulletLines`: `{ key, text, x, y }` as before — just more entries per L3 item.

---

## File Inventory

| Action                | Path                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| NEW field (via skill) | `force-app/main/default/objects/bcm_Capability__c/fields/bcm_HideFromDiagram__c.field-meta.xml`        |
| EDIT                  | `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js`                                    |
| EDIT                  | `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.html`                                  |
| EDIT                  | `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.css`                                   |
| EDIT                  | `force-app/main/default/classes/bcm_CapabilityController.cls` — add `bcm_HideFromDiagram__c` to SELECT |
| EDIT                  | `tests/e2e/diagram.spec.ts` — add tests for toggle + keyboard nav                                      |
| EDIT                  | `docs/specs/diagram.md` — add acceptance criteria + Tested by markers                                  |

---

## Build Sequence

1. Invoke `generating-custom-field` → `bcm_HideFromDiagram__c` on `bcm_Capability__c`
2. Deploy field: `sf project deploy start --source-dir force-app/main/default/objects`
3. Edit `bcm_CapabilityController.cls` — add field to SELECT
4. Deploy Apex: `sf project deploy start --source-dir force-app/main/default/classes`
5. Implement Adjustment 4 (text wrapping) — foundational, other adjustments build on stable box heights
6. Implement Adjustment 3 (pinned L1) — SVG layer split
7. Implement Adjustment 1 (hide flag) — `_buildLayout` two-pass, toggle, dashed border
8. Implement Adjustment 2 (keyboard nav) — `handleKeyDown`, focus state, column maps
9. Deploy LWC: `sf project deploy start --source-dir force-app/main/default/lwc`
10. Update `tests/e2e/diagram.spec.ts`
11. Run: `npx playwright test tests/e2e/diagram.spec.ts`
12. Update `docs/specs/diagram.md` — add new scenarios + Tested by markers

---

## Verification

- Hidden capability not rendered by default; toggle reveals it with dashed border; subtree hidden when parent hidden
- Arrow keys pan diagram 50px per press when no node focused
- Click L1/L2 node → focus ring + fill highlight; Left/Right moves between columns; Up/Down moves between L2 boxes in column; Escape clears focus
- L1 chevrons stay pinned at top during vertical pan; horizontal pan keeps columns aligned
- L2 header text wraps to fit; L3 bullets wrap (no truncation); box heights accommodate full text
- Playwright suite passes

---

## Execution Notes

### One Agent Per Adjustment

Spawn a fresh agent for each adjustment step (5–8 in build sequence). Sequential order enforced — do not parallelise:

1. Adjustment 4 — Text wrapping (foundational; box heights must be stable before other adjustments)
2. Adjustment 3 — Pinned L1 chevrons
3. Adjustment 1 — Hide From Diagram flag
4. Adjustment 2 — Keyboard navigation

Each agent reads current file state from disk before starting. Do not reuse context from a prior agent.

### E2E Gate (required before agent completes)

Before marking adjustment done, run:

```sh
npx playwright test tests/e2e/diagram.spec.ts
```

Fix any failures before handing off. Do not progress to next adjustment with a broken suite.

### Status Tracking

After completing each adjustment, append a row to `docs/plans/2026-05-31-step7-status.md`:

| Adjustment        | Status               | Notes |
| ----------------- | -------------------- | ----- |
| 4 — Text wrapping | ✅ done / 🔴 blocked | …     |

Create file if absent. Include: what changed, deviations from plan, Playwright result (pass/fail count), open issues.
