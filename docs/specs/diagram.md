# Acceptance Criteria — Diagram

## Feature: Map selector loads available Maps

**Scenario: Map dropdown is populated on page load**

Given at least one Map record exists  
When the user navigates to the Map tab  
Then the Map dropdown displays all available Map names  

**Scenario: No map is selected on initial load**

Given the user has not previously selected a map  
When the user navigates to the Map tab  
Then the diagram canvas is empty and no capabilities are rendered  

---

## Feature: Diagram renders the correct structure for a selected Map

**Scenario: Selecting a Map renders the full diagram**

Given the user selects a Map from the dropdown  
When the data loads  
Then the diagram renders without errors and displays all capabilities for that Map  

**Scenario: L1 capabilities render as chevrons**

Given a Map with at least one Level 1 Capability is selected  
When the diagram renders  
Then each Level 1 Capability is displayed as a right-pointing chevron shape across the top of its column  

**Scenario: L2 capabilities render as rounded boxes within their column**

Given a Map with at least one Level 2 Capability is selected  
When the diagram renders  
Then each Level 2 Capability is displayed as a rounded rectangle stacked vertically within its parent Level 1 column  

**Scenario: L3 capabilities render as bullet items inside their parent L2 box**

Given a Map with at least one Level 3 Capability is selected  
When the diagram renders  
Then each Level 3 Capability is displayed as a bulleted text item inside its parent Level 2 box  

**Scenario: Column order matches Sort Order of Level 1 capabilities**

Given a Map with multiple Level 1 Capabilities at different Sort Order values  
When the diagram renders  
Then columns appear left-to-right in ascending Sort Order sequence  

**Scenario: L2 boxes within a column are stacked in Sort Order sequence**

Given a Level 1 Capability with multiple Level 2 children at different Sort Order values  
When the diagram renders  
Then the L2 boxes appear top-to-bottom in ascending Sort Order sequence  

---

## Feature: Zoom and pan work correctly

**Scenario: Mouse wheel zooms the diagram in**

Given a map is loaded and the diagram is visible  
When the user scrolls the mouse wheel upward over the diagram  
Then the diagram scales up toward the cursor position  

**Scenario: Mouse wheel zooms the diagram out**

Given a map is loaded and the diagram is visible  
When the user scrolls the mouse wheel downward over the diagram  
Then the diagram scales down toward the cursor position  

**Scenario: Zoom is clamped at minimum and maximum levels**

Given the diagram is at maximum zoom  
When the user continues scrolling upward  
Then the zoom does not increase further  

**Scenario: Click-drag on the background pans the diagram**

Given a map is loaded and the diagram is visible  
When the user clicks and drags on the diagram background (not on a node)  
Then the diagram content moves in the direction of the drag  

---

## Feature: Tag highlight colourises matching capabilities

**Scenario: Selecting a tag highlights matching capabilities**

Given a Map is loaded and at least one Capability has a Tag applied  
When the user selects that Tag in the "Colour by Tag" dropdown  
Then all Level 2 capabilities carrying that Tag have their box fill changed to the Tag's colour  

**Scenario: Capabilities without the selected tag remain white**

Given a Tag is selected in the dropdown  
When the diagram renders the highlight  
Then Level 2 capabilities not carrying that Tag remain white  

**Scenario: Selecting None clears all highlights**

Given a Tag is currently selected and capabilities are highlighted  
When the user selects "None" in the Tag dropdown  
Then all capability boxes return to their default white fill  

---

## Feature: Context menu appears on node click

**Scenario: Left-clicking a node opens the context menu**

Given a map is loaded and the diagram is rendered  
When the user left-clicks any capability node  
Then the context menu appears near the click position  

**Scenario: Context menu closes when dismissed**

Given the context menu is open  
When the user clicks outside the menu or presses Escape  
Then the context menu closes  

---

## Feature: Drag handles are not visible to Viewers

**Scenario: Viewer sees no drag handles on the diagram**

Given the user has the `bcm_Viewer` permission set assigned  
When the user views the diagram  
Then no drag handle icon is visible on any node  
