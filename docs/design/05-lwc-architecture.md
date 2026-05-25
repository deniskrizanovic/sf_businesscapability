# Plan 05: LWC Architecture

## Component Overview

| Component | Type | Purpose |
|---|---|---|
| `bcm_CapabilityMap` | Lightning App Page LWC | Parent — owns data, layout, SVG viewport, zoom/pan, toolbar |
| `bcm_CapabilityNode` | Child LWC | Renders a single capability node (chevron, box, or bullet) |
| `bcm_ContextMenu` | Child LWC | Left-click context menu shell, no actions in v1 |
| `bcm_ImportUtility` | Lightning App Page LWC | Admin JSON import tool, standalone page |

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
```

### Tracked State
```js
selectedMapId       // Id of the currently selected map
capabilities        // flat array from Apex
tree                // assembled tree (computed from capabilities)
layoutNodes         // flat array of { id, x, y, width, height, type, ... } for rendering
zoom                // number, default 1.0
panX                // number, default 0
panY                // number, default 0
isDragging          // boolean
draggedNodeId       // Id
ghostX, ghostY      // number, ghost position during drag
dropTargetInfo      // { parentId, position } or null
selectedTagId       // Id of tag selected in toolbar, null = no highlight
highlightedNodeIds  // Set<Id> — capabilities with selected tag
isLoading           // boolean — spinner state
errorMessage        // string or null
canEdit             // boolean from custom permission
```

### Template Structure
```html
<template>
  <!-- Toolbar -->
  <div class="bcm-toolbar">
    <lightning-combobox label="Map" options={mapOptions} onchange={handleMapChange} />
    <lightning-combobox label="Colour by Tag" options={tagOptions} onchange={handleTagChange} />
    <lightning-button-icon icon-name="utility:add" title="Zoom In" onclick={handleZoomIn} />
    <lightning-button-icon icon-name="utility:dash" title="Zoom Out" onclick={handleZoomOut} />
    <lightning-button-icon icon-name="utility:refresh" title="Reset View" onclick={handleResetView} />
  </div>

  <!-- Loading spinner -->
  <template if:true={isLoading}>
    <lightning-spinner />
  </template>

  <!-- SVG Canvas -->
  <svg class="bcm-canvas"
       width={canvasWidth}
       height={canvasHeight}
       onmousedown={handleSvgMouseDown}
       onmousemove={handleSvgMouseMove}
       onmouseup={handleSvgMouseUp}
       onwheel={handleWheel}>

    <g transform={viewportTransform}>
      <!-- Render each layout node via bcm_CapabilityNode -->
      <template for:each={layoutNodes} for:item="node">
        <c-bcm_-capability-node
          key={node.id}
          node={node}
          can-edit={canEdit}
          is-highlighted={node.isHighlighted}
          onnodeclick={handleNodeClick}
          onnodedragstart={handleNodeDragStart}>
        </c-bcm_-capability-node>
      </template>

      <!-- Drag ghost (rendered during drag) -->
      <template if:true={isDragging}>
        <!-- ghost SVG elements at ghostX, ghostY -->
      </template>

      <!-- Drop indicator line -->
      <template if:true={dropTargetInfo}>
        <line class="bcm-drop-indicator" ... />
      </template>
    </g>
  </svg>

  <!-- Context menu -->
  <c-bcm_-context-menu
    if:true={contextMenuVisible}
    x={contextMenuX}
    y={contextMenuY}
    node={contextMenuNode}
    onclose={handleContextMenuClose}>
  </c-bcm_-context-menu>
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
this.dispatchEvent(new CustomEvent('nodeclick', {
  detail: { nodeId: this.node.id, x: clickX, y: clickY },
  bubbles: true, composed: true
}));

// Mousedown on drag handle
this.dispatchEvent(new CustomEvent('nodedragstart', {
  detail: { nodeId: this.node.id, offsetX, offsetY },
  bubbles: true, composed: true
}));
```

### Template
The component renders SVG fragments using `<template>` conditionals on `node.level`. Since LWC SVG rendering requires elements to be in the SVG namespace, `bcm_CapabilityNode` renders as an SVG `<g>` element.

**Note on LWC SVG constraints:** Child LWC components cannot directly return SVG fragments into a parent SVG. The standard workaround is to have `bcm_CapabilityMap` calculate all layout coordinates and pass them down, then render SVG elements directly in `bcm_CapabilityMap`'s template using `for:each`, using `bcm_CapabilityNode` as a logical JS class rather than a rendered template component. This is a known LWC limitation.

**Alternative approach:** `bcm_CapabilityNode` is implemented as a pure JS module (not an LWC component) that returns SVG element descriptors, and `bcm_CapabilityMap` renders them. This avoids the SVG-in-shadow-DOM issue entirely.

**Decision required before build:** Confirm whether to use LWC child components with `<foreignObject>` workarounds, or pure JS node renderers called from the parent. Recommendation: **pure JS node renderer classes**, keeping all SVG rendering inside `bcm_CapabilityMap`'s single template.

---

## bcm_ContextMenu

### Responsibilities
- Render a floating menu panel at a given (x, y) position relative to the SVG canvas
- In v1: display a "No actions available" placeholder item
- Emit `close` event when dismissed (click outside, Escape key)

### Properties (Public `@api`)
```js
@api x;     // number, position
@api y;     // number, position
@api node;  // the capability node that was clicked
```

### Template Structure
```html
<div class="bcm-context-menu" style={menuPositionStyle}>
  <ul>
    <li class="bcm-menu-placeholder">No actions available</li>
    <!-- Future actions added here -->
  </ul>
</div>
```

### Positioning
The menu renders as an HTML `<div>` overlaid on the SVG using absolute positioning. Position is calculated from the SVG click coordinates transformed to page coordinates.

---

## bcm_ImportUtility

### Responsibilities
- Provide a textarea for JSON paste
- Validate that input is not empty before submitting
- Call `bcm_ImportController.importCapabilities` imperatively
- Display spinner during import
- Display success summary or error message

### Template Structure
```html
<template>
  <lightning-card title="Capability Map Import" icon-name="utility:upload">
    <div class="slds-p-around_medium">
      <lightning-textarea
        label="Paste JSON"
        value={jsonInput}
        onchange={handleJsonChange}
        rows="20"
        placeholder='{ "mapName": "...", "capabilities": [...] }'>
      </lightning-textarea>

      <div class="slds-m-top_medium">
        <lightning-button
          label="Import"
          variant="brand"
          onclick={handleImport}
          disabled={isLoading}>
        </lightning-button>
      </div>

      <template if:true={isLoading}>
        <lightning-spinner alternative-text="Importing..." />
      </template>

      <template if:true={result}>
        <div class={resultClass}>
          <p>{resultMessage}</p>
        </div>
      </template>
    </div>
  </lightning-card>
</template>
```

---

## Apex Controllers

| Class | Methods | Called By |
|---|---|---|
| `bcm_MapController` | `getMaps()` | `bcm_CapabilityMap` |
| `bcm_CapabilityController` | `getCapabilities(Id mapId)` | `bcm_CapabilityMap` |
| `bcm_TagController` | `getTags()` | `bcm_CapabilityMap` |
| `bcm_DragDropController` | `reorderCapabilities(List<Id>)`, `reparentCapability(Id, Id, List<Id>, List<Id>)` | `bcm_CapabilityMap` |
| `bcm_ImportController` | `importCapabilities(String json)` | `bcm_ImportUtility` |

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
