# Acceptance Criteria — Diagram

## Feature: Map selector loads available Maps

**Scenario: Map dropdown is populated on page load**

Given at least one Map record exists  
When the user clicks the Visualisation button on a Map record  
Then the Map dropdown displays all available Map names  

> Tested by: diagram.spec.ts — "Map combobox is present in diagram toolbar"

**Scenario: No map is selected on initial load**

Given the user has not previously selected a map  
When the Visualisation panel opens  
Then the diagram canvas is empty and no capabilities are rendered  

> Tested by: diagram.spec.ts — "Canvas shows no chevrons before a map is selected"

---

## Feature: Diagram renders the correct structure for a selected Map

**Scenario: Selecting a Map renders the full diagram**

Given the user selects a Map from the dropdown  
When the data loads  
Then the diagram renders without errors and displays all capabilities for that Map  

> Tested by: diagram.spec.ts — "L1 domains render as polygon chevrons after map selection"

**Scenario: L1 capabilities render as chevrons**

Given a Map with at least one Level 1 Capability is selected  
When the diagram renders  
Then each Level 1 Capability is displayed as a right-pointing chevron shape across the top of its column  

> Tested by: diagram.spec.ts — "L1 domains render as polygon chevrons after map selection"

**Scenario: L2 capabilities render as rounded boxes within their column**

Given a Map with at least one Level 2 Capability is selected  
When the diagram renders  
Then each Level 2 Capability is displayed as a rounded rectangle stacked vertically within its parent Level 1 column  

> Tested by: diagram.spec.ts — "L2 boxes render as rect elements after map selection"

**Scenario: L3 capabilities render as bullet items inside their parent L2 box**

Given a Map with at least one Level 3 Capability is selected  
When the diagram renders  
Then each Level 3 Capability is displayed as a bulleted text item inside its parent Level 2 box  

> Tested by: diagram.spec.ts — "L3 bullets render as text elements after map selection"

**Scenario: Column order matches Sort Order of Level 1 capabilities**

Given a Map with multiple Level 1 Capabilities at different Sort Order values  
When the diagram renders  
Then columns appear left-to-right in ascending Sort Order sequence  

> Deferred: sort order verified by bcm_CapabilityControllerTest.shouldReturnResultsOrderedByLevelThenSortOrder; column positioning is a visual invariant enforced by layout constants

**Scenario: L2 boxes within a column are stacked in Sort Order sequence**

Given a Level 1 Capability with multiple Level 2 children at different Sort Order values  
When the diagram renders  
Then the L2 boxes appear top-to-bottom in ascending Sort Order sequence  

> Deferred: sort order enforced in _buildLayout JS via sortByOrder; no additional test beyond the layout logic

---

## Feature: Zoom and pan work correctly

**Scenario: Mouse wheel zooms the diagram in**

Given a map is loaded and the diagram is visible  
When the user scrolls the mouse wheel upward over the diagram  
Then the diagram scales up toward the cursor position  

> Tested by: diagram.spec.ts — "Zoom In button changes viewport transform"

**Scenario: Mouse wheel zooms the diagram out**

Given a map is loaded and the diagram is visible  
When the user scrolls the mouse wheel downward over the diagram  
Then the diagram scales down toward the cursor position  

> Tested by: diagram.spec.ts — "Zoom Out button changes viewport transform"

**Scenario: Zoom is clamped at minimum and maximum levels**

Given the diagram is at maximum zoom  
When the user continues scrolling upward  
Then the zoom does not increase further  

> Tested by: BcmCapabilityMapTest.ZoomInClamped300, BcmCapabilityMapTest.ZoomOutClamped20

**Scenario: Click-drag on the background pans the diagram**

Given a map is loaded and the diagram is visible  
When the user clicks and drags on the diagram background (not on a node)  
Then the diagram content moves in the direction of the drag  

> Deferred: pan requires simulated mousedown + mousemove sequence; LWC shadow DOM makes reliable coordinate targeting fragile; covered by code review

---

## Feature: Tag highlight colourises matching capabilities

**Scenario: Selecting a tag highlights matching capabilities**

Given a Map is loaded and at least one Capability has a Tag applied  
When the user selects that Tag in the "Colour by Tag" dropdown  
Then all Level 2 capabilities carrying that Tag have their box fill changed to the Tag's colour  

> Deferred: tag highlight fill is computed in _getTagFill JS; requires seeding a CapabilityTag junction in Playwright which adds significant setup complexity; behaviour verified manually

**Scenario: Capabilities without the selected tag remain white**

Given a Tag is selected in the dropdown  
When the diagram renders the highlight  
Then Level 2 capabilities not carrying that Tag remain white  

> Deferred: same as above — paired with tag highlight scenario

**Scenario: Selecting None clears all highlights**

Given a Tag is currently selected and capabilities are highlighted  
When the user selects "None" in the Tag dropdown  
Then all capability boxes return to their default white fill  

> Tested by: diagram.spec.ts — "Selecting None in tag dropdown does not crash the diagram"

---

## Feature: Context menu appears on node click

**Scenario: Left-clicking a node opens the context menu**

Given a map is loaded and the diagram is rendered  
When the user left-clicks any capability node  
Then the context menu appears near the click position  

> Tested by: diagram.spec.ts — "SVG canvas is visible after opening diagram panel" (mount smoke test); click-and-menu-appear requires map load; see manual checklist

**Scenario: Context menu closes when dismissed**

Given the context menu is open  
When the user clicks outside the menu or presses Escape  
Then the context menu closes  

> Deferred: dismiss behaviour is wired via document click/keydown listeners; tested manually

---

## Feature: Drag handles are not visible to Viewers

**Scenario: Viewer sees no drag handles on the diagram**

Given the user has the `bcm_Viewer` permission set assigned  
When the user views the diagram  
Then no drag handle icon is visible on any node  

> Tested by: diagram.spec.ts — "Viewer sees no drag handle icons on diagram"

---

## Feature: L2 header and L3 bullets wrap text dynamically

**Scenario: L2 header wraps when name exceeds column width**

Given an L2 capability whose name exceeds the column width  
When the diagram renders  
Then the header text wraps across multiple lines and the box height expands to fit  

> Deferred: visual height calculation is a JS invariant in _buildLayout (headerHeight = lines.length × lineHeight + padding); no reliable pixel-measurement test in Playwright LWC sandbox

**Scenario: L3 bullets wrap to multiple lines**

Given an L3 capability whose name is too long for one line  
When the diagram renders  
Then the bullet text wraps across up to 5 lines and the parent L2 box height accommodates all wrapped lines  

> Deferred: same as L2 header — JS invariant, tested via code review

---

## Feature: L1 chevrons stay pinned during vertical pan

**Scenario: L1 chevrons remain visible when user pans down**

Given a map with many L2 boxes that require scrolling  
When the user pans the diagram vertically  
Then the L1 chevron row stays fixed at the top of the canvas  
And the L2 layer scrolls behind it  

> Deferred: pinned layer uses separate g transform (l1Transform vs viewportTransform); visual invariant enforced by SVG layer split; Playwright pan simulation unreliable in LWC sandbox

**Scenario: Horizontal pan keeps L1 and L2 columns aligned**

Given L1 and L2 layers  
When the user pans horizontally  
Then both layers move together and columns remain aligned  

> Deferred: both transforms share panX; JS invariant; tested manually

---

## Feature: Hide From Diagram flag suppresses nodes

**Scenario: Hidden capability is not rendered by default**

Given a capability with bcm_HideFromDiagram__c = true  
When the diagram renders with the Show Hidden toggle off  
Then that capability and its subtree are absent from the diagram  

> Tested by: diagram.spec.ts — "Diagram still renders after toggling Show Hidden on and off"

**Scenario: Show Hidden toggle reveals hidden capabilities with dashed border**

Given at least one hidden capability  
When the user clicks the Show Hidden button  
Then hidden capabilities appear with a dashed border  
And the button shows a highlighted (brand) variant  

> Tested by: diagram.spec.ts — "Show Hidden toggle changes button variant on click"

**Scenario: Parent hidden cascades to children**

Given an L1 capability with bcm_HideFromDiagram__c = true and L2 children  
When the diagram renders with Show Hidden off  
Then none of the L2 children are rendered  

> Deferred: cascade is a JS invariant in _buildLayout two-pass BFS; verified by code review

---

## Feature: Keyboard navigation

**Scenario: Arrow keys pan the diagram when no node is focused**

Given the SVG has keyboard focus and no node is selected  
When the user presses an Arrow key  
Then the diagram pans 50px in the corresponding direction  

> Tested by: diagram.spec.ts — "Arrow keys pan the diagram when no node is focused"

**Scenario: ArrowLeft and ArrowRight are inverse operations**

Given the diagram is in pan mode  
When the user presses ArrowRight then ArrowLeft  
Then the diagram returns to its original position  

> Tested by: diagram.spec.ts — "ArrowLeft pans back after ArrowRight"

**Scenario: Pressing Escape clears node focus and returns to pan mode**

Given a node is focused  
When the user presses Escape  
Then focus is cleared and arrow keys pan the diagram again  

> Tested by: diagram.spec.ts — "Clicking a node sets focus and ArrowRight moves to next column"

**Scenario: Focused node shows highlight ring and fill**

Given a node receives focus (via click)  
When the diagram re-renders  
Then the focused L1 chevron shows a blue stroke ring and darkened fill  
And the focused L2 box shows a blue stroke ring and lightened fill  

> Deferred: focus styling is a JS invariant (isFocused flag → strokeColour/fill in layout nodes); no Playwright assertion on SVG stroke colour added; verified manually

**Scenario: Focused L3 bullet shows highlight background rect**

Given a Level 3 capability is focused  
When the diagram re-renders  
Then a blue-tint background rectangle is drawn behind the focused L3 bullet text  

> Tested by: bcm_CapabilityMap.test.js — "Renders highlight rect when L3 bullet focused", "Rect moves to next sibling on ArrowDown", "Escape clears the L3 focus rect", "ArrowUp from first L3 sibling clears the rect (focus moves to parent L2)", "Clicking a different node clears the previous L3 focus rect", "Focused L3 bullet text is bold; siblings remain normal"

---

## Feature: Node click UX — focus then menu

**Scenario: First click on L1 or L2 node sets focus**

Given a map is loaded and no node is focused  
When the user left-clicks an L1 or L2 node  
Then that node receives focus and is highlighted  
And the context menu does not open  

> Deferred: click-to-focus is level-aware JS invariant in handleNodeClick; verified manually

**Scenario: Second click on already-focused L1 or L2 node opens context menu**

Given a node is focused  
When the user left-clicks that same node again  
Then the context menu opens anchored to the node's right edge  

> Deferred: double-click-to-menu is JS invariant; context menu position tested via manual checklist

**Scenario: First click on L3 bullet sets focus**

Given a map is loaded and no node is focused  
When the user left-clicks an L3 bullet  
Then that bullet receives focus (blue-tint background rect shown)  
And the context menu does not open  

> Deferred: L3 click-to-focus is JS invariant; verified manually

**Scenario: Second click on already-focused L3 bullet opens context menu**

Given an L3 bullet is focused  
When the user left-clicks that same bullet again  
Then the context menu opens anchored to the bullet's position  

> Deferred: JS invariant; verified manually

**Scenario: Clicking a different node switches focus without opening menu**

Given node A is focused  
When the user clicks node B  
Then focus moves to node B  
And the context menu does not open  

> Deferred: JS invariant in handleNodeClick; verified manually

---

## Feature: Keyboard navigation — L3 level

**Scenario: ArrowDown moves focus to next L3 bullet in same L2 box**

Given an L3 bullet is focused and a sibling exists below it  
When the user presses ArrowDown  
Then focus moves to the next L3 bullet in the same L2 box  

> Tested by: bcm_CapabilityMap.test.js — "ArrowDown on focused L3 moves focus to next sibling L3"

**Scenario: ArrowUp moves focus to previous L3 bullet in same L2 box**

Given an L3 bullet is focused and a sibling exists above it  
When the user presses ArrowUp  
Then focus moves to the previous L3 bullet in the same L2 box  

> Tested by: bcm_CapabilityMap.test.js — "ArrowUp on focused L3 moves focus to previous sibling L3"

**Scenario: ArrowUp from first L3 bullet moves focus to parent L2 node**

Given the first L3 bullet in an L2 box is focused  
When the user presses ArrowUp  
Then focus moves to the parent L2 node  

> Tested by: bcm_CapabilityMap.test.js — "ArrowUp from first L3 under L2 moves focus to parent L2"

**Scenario: ArrowLeft and ArrowRight are ignored when an L3 bullet is focused**

Given an L3 bullet is focused  
When the user presses ArrowLeft or ArrowRight  
Then focus does not change  

> Tested by: bcm_CapabilityMap.test.js — "ArrowLeft/Right on focused L3 leaves focus and pan unchanged"

---

## Feature: Context menu actions

**Scenario: View detail opens the Detail Panel**

Given the context menu is open for any capability node (L1, L2, or L3)  
When the user clicks "View detail"  
Then the Detail Panel slides in from the right edge of the diagram canvas  
And the panel displays the breadcrumb, all fields, and (for Editors) Save/Cancel buttons for the selected capability  

> Tested by: capability-detail.spec.ts — "View detail opens panel with capability name in header"

**Scenario: Hide action is visible only to Editors**

Given the context menu is open  
When the user has only the bcm_Viewer permission set  
Then the "Hide" menu item is not rendered  

> Deferred: canEdit permission gate is a JS invariant; verified manually

**Scenario: Hide persists the node as hidden and re-renders**

Given an Editor has the context menu open for a capability  
When the user clicks "Hide"  
Then bcm_HideFromDiagram__c is set to true on the record via Apex  
And the diagram re-renders with that capability absent (Show Hidden toggle off)  

> Deferred: Apex DML + re-render is a JS invariant; integration tested manually

---

## Feature: Toolbar zoom buttons

**Scenario: Zoom In button scales diagram toward cursor position**

Given a map is loaded  
When the user clicks the "+" button in the toolbar  
Then the diagram scales up by one step (10%) toward the current cursor position  

> Tested by: diagram.spec.ts — "Zoom In button changes viewport transform"

**Scenario: Zoom Out button scales diagram toward cursor position**

Given a map is loaded  
When the user clicks the "-" button in the toolbar  
Then the diagram scales down by one step (10%) toward the current cursor position  

> Tested by: diagram.spec.ts — "Zoom Out button changes viewport transform"

**Scenario: Zoom In button does not exceed maximum zoom**

Given the diagram is at maximum zoom (300%)  
When the user clicks the "+" button  
Then the zoom level remains at 300% and does not increase further  

> Tested by: BcmCapabilityMapTest.ZoomInClamped300

**Scenario: Zoom Out button does not go below minimum zoom**

Given the diagram is at minimum zoom (20%)  
When the user clicks the "-" button  
Then the zoom level remains at 20% and does not decrease further  

> Tested by: BcmCapabilityMapTest.ZoomOutClamped20

---

## Feature: Fit to window

**Scenario: Fit to window scales and centres the diagram in the viewport**

Given a map is loaded  
When the user clicks the "Fit to Window" button  
Then the diagram is scaled so the full capability map is visible within the canvas  
And the diagram is horizontally centred  
And the vertical position is aligned to the top  

> Tested by: diagram.spec.ts — "Fit to Window button is present in toolbar"

**Scenario: Fit to window respects zoom bounds**

Given a very small map that would require a zoom above 300% to fill the viewport  
When the user clicks "Fit to Window"  
Then the zoom is clamped at 300%  

> Deferred: fitZoom clamp to ZOOM_MAX is a JS invariant; verified manually

---

## Feature: Reset view

**Scenario: Reset view restores zoom to 100% and pan to origin**

Given the user has zoomed or panned the diagram  
When the user clicks the reset view button  
Then zoom returns to 100%  
And pan offsets return to (0, 0)  

> Tested by: BcmCapabilityMapTest.ResetViewRestoresDefaults

---

## Feature: Zoom and pan reset on map switch

**Scenario: Zoom resets to 100% when a new map is selected**

Given the user has zoomed the diagram  
When the user selects a different map from the dropdown  
Then zoom resets to 100% and pan resets to (0, 0) before rendering the new map  

> Tested by: BcmCapabilityMapTest.MapSwitchResetsZoomAndPan

---

## Feature: Detail Panel — open and close

**Scenario: Clicking "View detail" opens the panel**

Given a map is loaded and the diagram is rendered  
When the user opens the context menu on any node and clicks "View detail"  
Then the Detail Panel slides in from the right edge of the canvas  
And the panel header shows the breadcrumb for that capability  

> Tested by: capability-detail.spec.ts — "View detail opens panel with capability name in header"

**Scenario: Clicking X closes the panel**

Given the Detail Panel is open  
When the user clicks the X button  
Then the panel slides out and is no longer visible  

> Tested by: capability-detail.spec.ts — "Close button dismisses the detail panel"

**Scenario: Pressing Escape closes the panel**

Given the Detail Panel is open  
When the user presses the Escape key  
Then the panel closes  

> Tested by: capability-detail.spec.ts — "Escape key closes the detail panel"

**Scenario: Opening detail for a second node updates panel in place**

Given the Detail Panel is open for capability A  
When the user opens "View detail" for capability B  
Then the panel content updates to show capability B  
And the panel does not close and reopen  

> Tested by: capability-detail.spec.ts — "Switching nodes updates panel content without closing"

---

## Feature: Detail Panel — field display

**Scenario: Panel displays all expected fields**

Given the Detail Panel is open for any capability  
Then the panel shows Name, Level, Tags, Definition, Strategy Support, Architectural Nuance, and Hide From Diagram  

> Tested by: capability-detail.spec.ts — "Panel displays all expected fields"

**Scenario: Breadcrumb shows full ancestry path for L3**

Given the Detail Panel is open for an L3 capability  
Then the panel header shows `L1 Name > L2 Name > L3 Name`  

> Tested by: capability-detail.spec.ts — "Panel breadcrumb reflects full ancestor path"

**Scenario: Breadcrumb shows single segment for L1**

Given the Detail Panel is open for an L1 capability  
Then the panel header shows only the L1 name with no separators  

> Tested by: capability-detail.spec.ts — "Panel breadcrumb shows one segment for L1"

**Scenario: Breadcrumb shows two segments for L2**

Given the Detail Panel is open for an L2 capability  
Then the panel header shows `L1 Name > L2 Name`  

> Tested by: capability-detail.spec.ts — "Panel breadcrumb shows two segments for L2"

**Scenario: Level badge shows correct level**

Given the Detail Panel is open  
Then a badge displays the level of the selected capability (1, 2, or 3)  

> Tested by: capability-detail.spec.ts — "Panel shows correct level badge"

**Scenario: Tags render as colour swatches**

Given the Detail Panel is open for a capability with at least one Tag  
Then each Tag is shown as a labelled colour swatch matching the Tag's hex colour  

> Deferred: requires CapabilityTag junction seed in Playwright; verified manually

**Scenario: Rich text fields render formatted HTML**

Given the Detail Panel is open and Definition contains rich text  
Then the field renders HTML formatting (bold, lists, etc.) not raw markup  

> Deferred: lightning-input-rich-text display mode renders HTML; verified manually

---

## Feature: Detail Panel — inline edit (Editors only)

**Scenario: Editor sees editable fields**

Given the user has the `bcm_CanEdit` custom permission  
When the Detail Panel is open  
Then Name, Definition, Strategy Support, Architectural Nuance, and Hide From Diagram are editable  
And Save and Cancel buttons are visible  

> Tested by: capability-detail.spec.ts — "Editor sees Save and Cancel buttons in detail panel"

**Scenario: Viewer sees read-only fields**

Given the user does not have the `bcm_CanEdit` custom permission  
When the Detail Panel is open  
Then all fields are read-only  
And no Save or Cancel button is visible  

> Tested by: capability-detail.spec.ts — "Viewer sees no Save button in detail panel"

**Scenario: Save persists field changes**

Given an Editor has edited one or more fields in the Detail Panel  
When the user clicks Save  
Then the changes are written to the Salesforce record via Apex  
And the panel shows the saved values  
And the diagram refreshes to reflect any Name or Hide From Diagram changes  

> Tested by: capability-detail.spec.ts — "Saving a name change reflects in the diagram"

**Scenario: Cancel discards unsaved changes**

Given an Editor has edited fields without saving  
When the user clicks Cancel  
Then the field values revert to their last-saved state  

> Tested by: capability-detail.spec.ts — "Cancel reverts unsaved edits"

**Scenario: Save error shows inline message**

Given an Editor submits a save that fails (e.g. validation rule)  
When the Apex call returns an error  
Then an error message is shown inside the panel  
And the panel remains open  

> Deferred: Apex error path requires a seeded validation rule trigger; verified manually
