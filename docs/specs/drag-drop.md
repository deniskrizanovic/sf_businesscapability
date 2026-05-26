# Acceptance Criteria — Drag and Drop

## Feature: Drag handles are visible to Editors only

**Scenario: Drag handles appear for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user hovers over any capability node in the diagram  
Then a drag handle icon is visible on the node  

**Scenario: Drag handles are hidden from Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user views the diagram  
Then no drag handle icon is visible on any node  

---

## Feature: L2 capabilities can be reordered within their column

**Scenario: Dragging an L2 box to a new position within the same column reorders it**

Given the user has the `bcm_Editor` permission set assigned  
And a Level 1 column contains at least two Level 2 capabilities  
When the user drags an L2 box to a new vertical position within the same column and drops it  
Then the diagram immediately re-renders showing the new order  
And after refreshing the page the new order is still shown  

---

## Feature: L2 capabilities can be reparented to a different column

**Scenario: Dragging an L2 box to a different L1 column reparents it**

Given the user has the `bcm_Editor` permission set assigned  
And at least two Level 1 columns exist  
When the user drags an L2 box from one column and drops it onto a different column  
Then the diagram immediately re-renders with the capability under its new parent column  
And after refreshing the page the capability still appears under its new parent  
And the order of both the old and new sibling lists is updated correctly  

---

## Feature: L1 capabilities can be reordered

**Scenario: Dragging an L1 chevron to a new column position reorders it**

Given the user has the `bcm_Editor` permission set assigned  
And at least two Level 1 capabilities exist  
When the user drags an L1 chevron to a new horizontal position and drops it  
Then the diagram immediately re-renders with the columns in the new order  
And after refreshing the page the new column order is still shown  

---

## Feature: L3 capabilities can be reordered within their parent L2 box

**Scenario: Dragging an L3 item to a new position within its L2 box reorders it**

Given the user has the `bcm_Editor` permission set assigned  
And a Level 2 box contains at least two Level 3 items  
When the user drags an L3 item to a new position within the same L2 box  
Then the diagram immediately re-renders with the items in the new order  
And after refreshing the page the new order is still shown  

---

## Feature: L3 capabilities can be reparented to a different L2 box

**Scenario: Dragging an L3 item to a different L2 box reparents it**

Given the user has the `bcm_Editor` permission set assigned  
And at least two Level 2 boxes exist  
When the user drags an L3 item and drops it onto a different L2 box  
Then the diagram immediately re-renders with the item under its new parent  
And after refreshing the page the item still appears under its new parent  

---

## Feature: Ghost and drop indicator are shown during drag

**Scenario: A ghost element follows the cursor during drag**

Given the user has initiated a drag on a capability node  
When the drag is in progress  
Then a semi-transparent ghost of the dragged element follows the cursor  

**Scenario: A drop indicator line appears at the target position**

Given the user is dragging a capability over a valid drop target  
When the cursor is between two sibling nodes  
Then a drop indicator line is rendered between those siblings  

---

## Feature: Dropping outside a valid target cancels the drag

**Scenario: Dropping on an invalid target cancels without changes**

Given the user has initiated a drag on a capability node  
When the user releases the mouse outside any valid drop target  
Then the diagram returns to its original state with no changes applied  

---

## Feature: Save failures revert the diagram and notify the user

**Scenario: Save failure during reorder reverts the diagram**

Given the user has the `bcm_Editor` permission set assigned  
And the save fails after a reorder  
When the drag-drop is completed  
Then the diagram reverts to its pre-drag state  
And an error message is displayed: "Failed to save changes. Your changes have been reverted."  

**Scenario: Save failure during reparent reverts the diagram**

Given the user has the `bcm_Editor` permission set assigned  
And the save fails after a reparent  
When the drag-drop is completed  
Then the diagram reverts to its pre-drag state  
And an error message is displayed: "Failed to save changes. Your changes have been reverted."  
