# LWC Architecture

## Component Overview

| Component                 | Type                       | Purpose                                                                                                                                                                                             |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bcm_CapabilityMap`       | Lightning App Page LWC     | Container — owns data, layout, SVG viewport, zoom/pan, toolbar, all Apex interaction                                                                                                                |
| `bcm_CapabilityNode`      | Child LWC                  | Renders a single capability node (chevron, box, or bullet)                                                                                                                                          |
| `bcm_CapabilityDetail`    | Child LWC (presentational) | Slide-out detail panel for the selected capability; read-only by default, inline edit (Save / Cancel) when `canEdit` is true; opened directly by 2nd click on a focused node in `bcm_CapabilityMap` |
| `bcm_ColourSwatch`        | Child LWC (presentational) | Renders a single tag colour swatch on Tag record page                                                                                                                                               |
| `bcm_ImportButton`        | Quick-action / utility LWC | Launches the JSON import flow from a Map record context                                                                                                                                             |
| `bcm_VisualisationButton` | Quick-action / utility LWC | Navigates the user to the Visualisation tab                                                                                                                                                         |

---

## bcm_CapabilityMap

### Responsibilities

- Load available Maps for the selector combobox
- Load all Capabilities and CapabilityTags for the selected Map
- Assemble the flat list into a tree structure
- Calculate SVG layout coordinates for every node
- Render the SVG viewport with zoom/pan `<g transform>` wrapper
- Manage drag-drop state (dragged node, ghost position, drop target)
- Dispatch Apex calls for reorder and reparent
- Manage tag colourisation state (selected tag, highlighted node set)
- Show/hide drag handles based on `bcm_CanEdit` custom permission

### Apex Wire / Imperative Calls

```js
// Load maps for selector
import getMaps from '@salesforce/apex/bcm_MapController.getMaps';

// Load capabilities for selected map (imperative, called on map selection change)
import getCapabilities from '@salesforce/apex/bcm_CapabilityController.getCapabilities';

// Load tags for toolbar combobox
import getTags from '@salesforce/apex/bcm_TagController.getTags';

// Reorder siblings
import reorderCapabilities from '@salesforce/apex/bcm_DragDropController.reorderCapabilities';

// Reparent node
import reparentCapability from '@salesforce/apex/bcm_DragDropController.reparentCapability';

// Fetch full capability record for detail panel (imperative, called on viewdetail event)
import getCapabilityDetail from '@salesforce/apex/bcm_CapabilityController.getCapabilityDetail';

// Save capability edits from detail panel
import updateCapability from '@salesforce/apex/bcm_CapabilityController.updateCapability';
```

### Tracked State

```js
selectedMapId; // Id of the currently selected map
capabilities; // flat array from Apex
tree; // assembled tree (computed from capabilities)
layoutNodes; // flat array of { id, x, y, width, height, type, ... } for rendering
zoom; // number, default 1.0
panX; // number, default 0
panY; // number, default 0
isDragging; // boolean
draggedNodeId; // Id
(ghostX, ghostY); // number, ghost position during drag
dropTargetInfo; // { parentId, position } or null
selectedTagId; // Id of tag selected in toolbar, null = no highlight
highlightedNodeIds; // Set<Id> — capabilities with selected tag
isLoading; // boolean — spinner state
errorMessage; // string or null
canEdit; // boolean from custom permission
detailCapabilityId; // Id | null — null = panel closed
detailCapability; // full record object | null
detailBreadcrumb; // [{ id, label }] array, root-first
detailIsLoading; // boolean — spinner while getCapabilityDetail in flight
```

### Template Structure

```html
<template>
    <!-- Toolbar -->
    <div class="bcm-toolbar">
        <lightning-combobox label="Map" options="{mapOptions}" onchange="{handleMapChange}" />
        <lightning-combobox
            label="Colour by Tag"
            options="{tagOptions}"
            onchange="{handleTagChange}"
        />
        <lightning-button-icon icon-name="utility:add" title="Zoom In" onclick="{handleZoomIn}" />
        <lightning-button-icon
            icon-name="utility:dash"
            title="Zoom Out"
            onclick="{handleZoomOut}"
        />
        <lightning-button-icon
            icon-name="utility:refresh"
            title="Reset View"
            onclick="{handleResetView}"
        />
    </div>

    <!-- Loading spinner -->
    <template if:true="{isLoading}">
        <lightning-spinner />
    </template>

    <!-- SVG Canvas -->
    <svg
        class="bcm-canvas"
        width="{canvasWidth}"
        height="{canvasHeight}"
        onmousedown="{handleSvgMouseDown}"
        onmousemove="{handleSvgMouseMove}"
        onmouseup="{handleSvgMouseUp}"
        onwheel="{handleWheel}"
    >
        <g transform="{viewportTransform}">
            <!-- Render each layout node via bcm_CapabilityNode -->
            <template for:each="{layoutNodes}" for:item="node">
                <c-bcm_-capability-node
                    key="{node.id}"
                    node="{node}"
                    can-edit="{canEdit}"
                    is-highlighted="{node.isHighlighted}"
                    onnodeclick="{handleNodeClick}"
                    onnodedragstart="{handleNodeDragStart}"
                ></c-bcm_-capability-node>
            </template>

            <!-- Drag ghost (rendered during drag) -->
            <template if:true="{isDragging}">
                <!-- ghost SVG elements at ghostX, ghostY -->
            </template>

            <!-- Drop indicator line -->
            <template if:true="{dropTargetInfo}">
                <line class="bcm-drop-indicator" ... />
            </template>
        </g>
    </svg>

    <!-- Detail panel (read-only) -->
    <c-bcm_-capability-detail
        capability="{detailCapability}"
        breadcrumb="{detailBreadcrumb}"
        is-loading="{detailIsLoading}"
        onclose="{handleDetailClose}"
    >
    </c-bcm_-capability-detail>
</template>
```

---

## bcm_CapabilityNode

### Responsibilities

- Receive a `node` property containing layout coordinates, capability data, level, highlight state
- Render the correct SVG shape based on `node.level` (chevron, box, or bullet list)
- Render drag handle icon if `canEdit` is true
- Emit `nodeclick` event on left-click (not on drag handle)
- Emit `nodedragstart` event on mousedown on drag handle

### Properties (Public `@api`)

```js
@api node;        // { id, x, y, width, height, level, name, children, isHighlighted, ... }
@api canEdit;     // boolean
@api isHighlighted; // boolean
```

### Events Emitted

```js
// Left-click on node body
this.dispatchEvent(
    new CustomEvent('nodeclick', {
        detail: { nodeId: this.node.id, x: clickX, y: clickY },
        bubbles: true,
        composed: true
    })
);

// Mousedown on drag handle
this.dispatchEvent(
    new CustomEvent('nodedragstart', {
        detail: { nodeId: this.node.id, offsetX, offsetY },
        bubbles: true,
        composed: true
    })
);
```

### Template

The component renders SVG fragments using `<template>` conditionals on `node.level`. Since LWC SVG rendering requires elements to be in the SVG namespace, `bcm_CapabilityNode` renders as an SVG `<g>` element.

**Note on LWC SVG constraints:** Child LWC components cannot directly return SVG fragments into a parent SVG. The standard workaround is to have `bcm_CapabilityMap` calculate all layout coordinates and pass them down, then render SVG elements directly in `bcm_CapabilityMap`'s template using `for:each`, using `bcm_CapabilityNode` as a logical JS class rather than a rendered template component. This is a known LWC limitation.

**Alternative approach:** `bcm_CapabilityNode` is implemented as a pure JS module (not an LWC component) that returns SVG element descriptors, and `bcm_CapabilityMap` renders them. This avoids the SVG-in-shadow-DOM issue entirely.

**Decision required before build:** Confirm whether to use LWC child components with `<foreignObject>` workarounds, or pure JS node renderers called from the parent. Recommendation: **pure JS node renderer classes**, keeping all SVG rendering inside `bcm_CapabilityMap`'s single template.

---

## bcm_CapabilityDetail

### Responsibilities

- Render 400px slide-in panel over the right edge of the canvas
- Display breadcrumb, level badge, tag swatches, and all capability fields read-only
- Fire `close` on X button click or Escape key
- When `canEdit` is true: show Edit affordance; in edit mode, render `lightning-input` (Name) and `lightning-input-rich-text` (Definition / Strategy Support / Architectural Nuance) plus Save / Cancel buttons in the footer
- Fire `saved` with `{ id, name, definition, strategySupport, architecturalNuance }` on Save; container persists via `updateCapability` and reloads the diagram

### Properties (Public `@api`)

```js
@api capability;   // bcm_Capability__c record object | null
@api breadcrumb;   // [{ id, label }] array, root-first
@api isLoading;    // boolean — shows spinner while parent fetches
@api errorMessage; // string | null — surfaced inside panel error region
@api canEdit;      // boolean — gates Edit / Save / Cancel affordances
```

### Events Emitted

```js
this.dispatchEvent(new CustomEvent('close'));
this.dispatchEvent(
    new CustomEvent('saved', {
        detail: { id, name, definition, strategySupport, architecturalNuance }
    })
);
```

### CSS

```css
.bcm-detail-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    transform: translateX(100%);
    transition: transform 250ms ease;
    z-index: 100;
    background: #fff;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
    overflow-y: auto;
}
.bcm-detail-panel--open {
    transform: translateX(0);
}
```

`.bcm-canvas-container` requires `position: relative` for the absolute-positioned panel to anchor correctly.

---

## Apex Controllers

| Class                      | Methods                                                                                                                                                  | Called By                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bcm_MapController`        | `getMaps()`                                                                                                                                              | `bcm_CapabilityMap`                                                                                                                         |
| `bcm_CapabilityController` | `getCapabilities(Id mapId)`, `getCapabilityDetail(Id capabilityId)`, `updateCapability(bcm_Capability__c capability)`, `hideCapability(Id capabilityId)` | `bcm_CapabilityMap` (note: `hideCapability` retained for Apex coverage; no current LWC consumer — Hide UX flows through `updateCapability`) |
| `bcm_TagController`        | `getTags()`                                                                                                                                              | `bcm_CapabilityMap`                                                                                                                         |
| `bcm_DragDropController`   | `reorderCapabilities(List<Id>)`, `reparentCapability(Id, Id, List<Id>, List<Id>)`                                                                        | `bcm_CapabilityMap`                                                                                                                         |
| `bcm_ImportController`     | `importCapabilities(String json)`                                                                                                                        | `bcm_ImportButton` (Import flow)                                                                                                            |

All controllers are `with sharing` — respects Salesforce record-level sharing rules.

## SOQL Queries

### getCapabilities

```soql
SELECT Id, Name, bcm_Parent__c, bcm_Level__c, bcm_SortOrder__c,
       bcm_ExternalId__c, bcm_Definition__c, bcm_StrategySupport__c,
       bcm_ArchitecturalNuance__c,
       (SELECT bcm_Tag__r.Name, bcm_Tag__r.bcm_Colour__c
        FROM bcm_CapabilityTags__r)
FROM bcm_Capability__c
WHERE bcm_Map__c = :mapId
ORDER BY bcm_Level__c ASC, bcm_SortOrder__c ASC
```

### getTags

```soql
SELECT Id, Name, bcm_Colour__c
FROM bcm_Tag__c
ORDER BY Name ASC
```

### getMaps

```soql
SELECT Id, Name, bcm_Description__c
FROM bcm_Map__c
ORDER BY Name ASC
```
