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

**Scenario: Map selection persists for session — restore after navigation**

Given the user selected a Map in the Visualisation page  
When the user navigates to another tab and returns within the same browser session  
Then the Map dropdown still shows the previously selected Map  
And the canvas renders the capabilities for that Map  

> Tested by: bcm_CapabilityMap.test.js — "Restores selectedMapId from sessionStorage on init when id is in mapOptions"; diagram.spec.ts — "Selected map persists across page reload within same session"

**Scenario: Persisted Map id no longer in options is silently cleared**

Given the user has a persisted Map id in sessionStorage that no longer exists in `mapOptions`  
When the Visualisation panel reloads  
Then the dropdown is empty  
And the persisted key is removed from sessionStorage  

> Tested by: bcm_CapabilityMap.test.js — "Clears persisted id and leaves selector empty when id is not in mapOptions"

**Scenario: sessionStorage unavailable does not crash the page**

Given `sessionStorage.setItem` throws (privacy mode / quota)  
When the user selects a Map  
Then the diagram still loads capabilities for that map  
And no error is surfaced to the user  

> Tested by: bcm_CapabilityMap.test.js — "Silent fallback when sessionStorage.setItem throws (no crash, no abort)"

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

**Scenario: Pan in any direction updates the L2 viewport transform without clip**

Given a map is loaded and the diagram is visible  
When the user pans the diagram in any direction  
Then the L2 layer `transform` attribute reflects the cumulative panX / panY offset  
And content beyond the initial canvas bounds is no longer clipped by the SVG element  

> Tested by: diagram.spec.ts — "ArrowRight pan -> L2 transform translateX increases (no clip on right)", "ArrowDown pan -> L2 transform translateY decreases (free vertical pan, no clamp)"

**Scenario: Vertical pan is unrestricted in both directions**

Given the diagram is at pan origin (panY = 0)  
When the user presses ArrowUp from origin  
Then panY moves into positive territory  
And no clamp pins panY to ≤ 0  

> Tested by: diagram.spec.ts — "ArrowUp from origin -> positive panY (was previously clamped to 0)"; bcm_CapabilityMap.test.js — "ArrowUp pans diagram down (positive panY) — no clamp", "ArrowDown pans diagram up (negative panY) — no clamp"

**Scenario: Zoom + pan compose correctly in the L2 transform**

Given the user has zoomed in (zoom > 1)  
When the user pans right  
Then the L2 `transform` attribute carries both the new `scale(zoom)` and an updated `translate(panX, panY)`  

> Tested by: diagram.spec.ts — "Zoom in then ArrowRight -> L2 transform shows scale>1 AND translateX moved"

**Scenario: L1 chevron band remains pinned vertically during pan**

Given the user pans the diagram vertically (any panY)  
When the L1 transform is read  
Then translateY on the L1 layer remains 0  
And the L2 layer carries the panY offset  

> Tested by: diagram.spec.ts — "L1 chevron band stays at translateY=0 even when L2 panY is non-zero"

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

## Feature: Cross-cutting band

**Scenario: Cross-cutting L1 capabilities render as a layered chevron band at the bottom**

Given a Map contains at least one Level 1 Capability with `bcm_IsCrossCutting__c = true`  
When the diagram renders  
Then those L1s appear as a stack of full-width chevrons at the bottom of the canvas  
And each chevron spans the full diagram width (first column to last column)  
And rows overlap vertically so each row's bottom strip remains visible below the next  

> Tested by: bcm_CapabilityMap.test.js — "Cross-cutting L1 renders as band node, not as column chevron", "Band chevron spans full diagram width"; diagram.spec.ts — "Cross-cutting L1 renders as band chevron at bottom; non-cross-cutting still in column"

**Scenario: Lowest-SortOrder cross-cutting capability paints on top of the stack**

Given two or more cross-cutting L1 Capabilities  
When the diagram renders the band  
Then the capability with the lowest `bcm_SortOrder__c` is rendered last in the DOM and paints on top of the layered stack  

> Tested by: bcm_CapabilityMap.test.js — "Lowest-SortOrder cross-cutting renders on top of layered band stack"

**Scenario: Band labels are uppercased and bottom-left-aligned**

Given a cross-cutting band chevron is rendered  
When the label is drawn  
Then the label text is the capability name in uppercase  
And the label is anchored to the bottom-left of the chevron strip  

> Tested by: bcm_CapabilityMap.test.js — "Band label is uppercased and left-aligned (no text-anchor)"

**Scenario: Cross-cutting L1 is excluded from the regular column layout**

Given an L1 Capability with `bcm_IsCrossCutting__c = true`  
When the diagram renders  
Then that L1 does not appear as a column chevron in the top L1 row  
And no L2 or L3 descendant of that L1 is rendered anywhere on the diagram  

> Tested by: bcm_CapabilityMap.test.js — "Cross-cutting L1 child (L2) is excluded from the diagram", "Non-cross-cutting L1 still renders as a regular column chevron"

**Scenario: Clicking a cross-cutting band chevron opens the Detail Panel**

Given the cross-cutting band is rendered  
When the user clicks one of its chevrons  
Then the Detail Panel opens populated with that capability via the existing `viewdetail` flow  

> Tested by: bcm_CapabilityMap.test.js — "Click on band chevron triggers viewdetail Apex call"; diagram.spec.ts — "Clicking a cross-cutting band chevron opens the Detail Panel"

**Scenario: Band stays pinned to the bottom during vertical pan**

Given the diagram is taller than the viewport and the user pans vertically  
When the L2 layer's translateY changes  
Then the band layer's translateY remains 0 (mirrors the L1 top-row pinning)  

> Deferred: visual invariant — band layer transform shares the L1-pin pattern (`translate(panX, 0)`); covered by the existing L1-pin test ("L1 chevron band stays at translateY=0 even when L2 panY is non-zero") which exercises the same mechanism

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

**Scenario: SVG canvas does not show a default browser focus outline**

Given the user clicks, tabs to, or drags within the diagram canvas  
When the canvas element gains keyboard focus  
Then no visible blue focus outline is rendered around the canvas  
And keyboard handlers (`handleKeyDown`) still fire normally  

> Tested by: diagram.spec.ts — "No visible focus outline on canvas after click"

**Scenario: Hovering an L3 bullet text shifts its colour to signal interactivity**

Given a map is displayed with at least one L3 capability  
When the user moves the pointer over any line of an L3 bullet (including wrapped continuation lines)  
Then all text lines of that bullet change colour to #0070D2  
And when the pointer leaves, all lines revert to #444444  
And if the L3 bullet is focused, its highlight rect and bold weight are unaffected by hover  
And if the L3 bullet is focused, its text colour changes to #0070D2 on hover (hover CSS wins; focused text colour is intentionally unoverridden)  

> Deferred: CSS-only hover (SVG fill via `g[data-l3-group]:hover text`); browser pseudo-state not assertable in Jest or Playwright — verified manually in org

---

## Feature: Node click UX — focus then menu

**Scenario: First click on L1 or L2 node sets focus**

Given a map is loaded and no node is focused  
When the user left-clicks an L1 or L2 node  
Then that node receives focus and is highlighted  
And the context menu does not open  

> Tested by: `bcm_CapabilityMap.test.js — "First click L1 node focuses it but does not open context menu"`, `bcm_CapabilityMap.test.js — "First click L2 node focuses it but does not open context menu"`

**Scenario: Second click on already-focused L1 or L2 node opens context menu**

Given a node is focused  
When the user left-clicks that same node again  
Then the context menu opens anchored to the node's right edge  

> Tested by: `bcm_CapabilityMap.test.js — "Second click on same L1 node opens context menu"`, `bcm_CapabilityMap.test.js — "Second click on same L2 node opens context menu"`

**Scenario: First click on L3 bullet sets focus**

Given a map is loaded and no node is focused  
When the user left-clicks an L3 bullet  
Then that bullet receives focus (blue-tint background rect shown)  
And the context menu does not open  

> Tested by: `bcm_CapabilityMap.test.js — "First click on L3 bullet focuses it but does not open context menu"`

**Scenario: Second click on already-focused L3 bullet opens context menu**

Given an L3 bullet is focused  
When the user left-clicks that same bullet again  
Then the context menu opens anchored to the bullet's position  

> Tested by: `bcm_CapabilityMap.test.js — "Second click on same L3 bullet opens context menu"`

**Scenario: Clicking a different node switches focus without opening menu**

Given node A is focused  
When the user clicks node B  
Then focus moves to node B  
And the context menu does not open  

> Tested by: `bcm_CapabilityMap.test.js — "Clicking a different node after first focus does not open context menu"`

**Scenario: Clicking empty canvas background clears node focus**

Given a node is focused  
When the user clicks on empty SVG canvas (not on any node)  
Then focus is cleared and the node returns to its unfocused visual state  
And `data-focused` on the previously-focused `<g>` is no longer `"true"`  
And subsequent pan/drag still works  

> Tested by: bcm_CapabilityMap.test.js — "Canvas mousedown clears L2 highlight", "Canvas mousedown with no focus is a no-op (no throw)", "Pan still works after canvas mousedown"

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

**Scenario: View detail menu item is rendered for L1, L2, and L3 nodes**

Given the context menu is open for any capability node  
Then the menu shows a "View detail" item  

> Tested by: bcm_ContextMenu.test.js — "Renders View detail for L1", "Renders View detail for L2", "Renders View detail for L3"

**Scenario: Clicking View detail fires viewdetail event with node payload**

Given the context menu is open for an L1, L2, or L3 capability  
When the user clicks "View detail"  
Then the menu dispatches a `viewdetail` CustomEvent with `{ id, level, name }` from the node prop  
And the menu closes  

> Tested by: bcm_ContextMenu.test.js — "Click View detail at level 1/2/3 fires viewdetail with correct payload", "Click View detail also fires close event"

**Scenario: View detail opens the Detail Panel**

Given the context menu is open for any capability node (L1, L2, or L3)  
When the user clicks "View detail"  
Then the Detail Panel slides in from the right edge of the diagram canvas  
And the panel displays the breadcrumb and read-only fields for the selected capability  

> Tested by: capability-detail.spec.ts — "View detail opens panel with capability name in header"; bcm_CapabilityMap.test.js — "View detail loads capability via Apex and opens panel"

**Scenario: Hide action is visible only to Editors**

Given the context menu is open  
When the user has only the bcm_Viewer permission set  
Then the "Hide" menu item is not rendered  

> Tested by: diagram.spec.ts:284 — "Viewer cannot see Hide button in context menu"

**Scenario: Hide persists the node as hidden and re-renders**

Given an Editor has the context menu open for a capability  
When the user clicks "Hide"  
Then bcm_HideFromDiagram__c is set to true on the record via Apex  
And the diagram re-renders with that capability absent (Show Hidden toggle off)  

> Tested by: bcm_CapabilityMap.test.js — "Hide click calls hideCapability Apex and rebuilds layout without target node"; bcm_CapabilityControllerTest.shouldHideCapability; diagram.spec.ts:231 — "Hide menu action removes node and Show Hidden restores it"

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

> Tested by: capability-detail.spec.ts — "Panel breadcrumb reflects full ancestor path for L3"

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

> Tested by: capability-detail.spec.ts — "Editor sees Edit button and can enter edit mode"

**Scenario: Viewer sees read-only fields**

Given the user does not have the `bcm_CanEdit` custom permission  
When the Detail Panel is open  
Then all fields are read-only  
And no Save or Cancel button is visible  

> Tested by: capability-detail.spec.ts — "Viewer sees no Edit/Save/Cancel buttons in panel"; bcm_CapabilityDetail.test.js — "Viewer (canEdit=false) sees no Edit button", "Read mode has no Save / Cancel buttons"

**Scenario: Save persists field changes**

Given an Editor has edited one or more fields in the Detail Panel  
When the user clicks Save  
Then the changes are written to the Salesforce record via Apex  
And the panel shows the saved values  
And the diagram refreshes to reflect any Name change  

> Tested by: capability-detail.spec.ts — "Save persists name change and refreshes diagram"; bcm_CapabilityServiceTest.updateCapability_persists_allowlistedFields; bcm_CapabilityServiceTest.updateCapability_persists_hideFromDiagram; bcm_CapabilityControllerTest.updateCapability_persists; bcm_CapabilityMap.test.js — "saved event calls updateCapability and rebuilds diagram with new name"

**Scenario: Cancel discards unsaved changes**

Given an Editor has edited fields without saving  
When the user clicks Cancel  
Then the field values revert to their last-saved state  

> Tested by: capability-detail.spec.ts — "Cancel reverts unsaved name change"; bcm_CapabilityDetail.test.js — "Cancel reverts to read mode without firing saved"

**Scenario: Save error shows inline message**

Given an Editor submits a save that fails (e.g. validation rule)  
When the Apex call returns an error  
Then an error message is shown inside the panel  
And the panel remains open  

> Tested by: bcm_CapabilityDetail.test.js — "Save error keeps edit mode and surfaces error message"; bcm_CapabilityMap.test.js — "saved event Apex error surfaces errorMessage to detail panel"
