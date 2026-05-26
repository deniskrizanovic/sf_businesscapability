# Step 8 Acceptance Criteria — Drag-Drop

## Feature: Drag handles are visible to Editors only

**Scenario: Drag handles appear for users with bcm_CanEdit**

Given the user has the `bcm_Editor` permission set (which grants `bcm_CanEdit`)  
When the user hovers over any capability node in the diagram  
Then a drag handle icon is visible on the node  

**Scenario: Drag handles are hidden from Viewers**

Given the user has the `bcm_Viewer` permission set (which does not grant `bcm_CanEdit`)  
When the user views the diagram  
Then no drag handle icon is visible on any node  

---

## Feature: L2 capabilities can be reordered within their column

**Scenario: Dragging an L2 box to a new position within the same column reorders it**

Given the user has `bcm_Editor` assigned  
And a Level 1 column contains at least two Level 2 capabilities  
When the user drags an L2 box to a new vertical position within the same column and drops it  
Then the diagram immediately re-renders showing the new order  
And after a page refresh the new order persists (SortOrder values updated in the org)  

---

## Feature: L2 capabilities can be reparented to a different column

**Scenario: Dragging an L2 box to a different L1 column reparents it**

Given the user has `bcm_Editor` assigned  
And at least two Level 1 columns exist  
When the user drags an L2 box from one column and drops it onto a different column  
Then the diagram immediately re-renders with the capability under its new parent column  
And after a page refresh the new parent persists (`bcm_Parent__c` updated in the org)  
And the SortOrder of both the old and new sibling lists is updated correctly  

---

## Feature: L1 capabilities can be reordered

**Scenario: Dragging an L1 chevron to a new column position reorders it**

Given the user has `bcm_Editor` assigned  
And at least two Level 1 capabilities exist  
When the user drags an L1 chevron to a new horizontal position and drops it  
Then the diagram immediately re-renders with the columns in the new order  
And after a page refresh the new column order persists  

---

## Feature: L3 capabilities can be reordered within their parent L2 box

**Scenario: Dragging an L3 item to a new position within its L2 box reorders it**

Given the user has `bcm_Editor` assigned  
And a Level 2 box contains at least two Level 3 items  
When the user drags an L3 item to a new position within the same L2 box  
Then the diagram immediately re-renders with the items in the new order  
And after a page refresh the new order persists  

---

## Feature: L3 capabilities can be reparented to a different L2 box

**Scenario: Dragging an L3 item to a different L2 box reparents it**

Given the user has `bcm_Editor` assigned  
And at least two Level 2 boxes exist  
When the user drags an L3 item and drops it onto a different L2 box  
Then the diagram immediately re-renders with the item under its new parent  
And after a page refresh the new parent persists  

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

## Feature: Apex errors revert the diagram and show a toast

**Scenario: Apex failure during reorder reverts the diagram**

Given the user has `bcm_Editor` assigned  
And the Apex reorder call returns an error  
When the drag-drop is completed  
Then the diagram reverts to its pre-drag state  
And a toast error notification is displayed: "Failed to save changes. Your changes have been reverted."  

**Scenario: Apex failure during reparent reverts the diagram**

Given the user has `bcm_Editor` assigned  
And the Apex reparent call returns an error  
When the drag-drop is completed  
Then the diagram reverts to its pre-drag state  
And a toast error notification is displayed: "Failed to save changes. Your changes have been reverted."  

---

## Feature: Drag-drop Apex test class meets coverage and permission boundary requirements

**Scenario: DragDrop test class passes with sufficient coverage**

Given `bcm_DragDropControllerTest` has been deployed  
When the test class is executed in the org  
Then all test methods pass and coverage for `bcm_DragDropController` is ≥ 75%  

**Scenario: Viewer cannot call reorderCapabilities (tested via System.runAs)**

Given a test user with only `bcm_Viewer` assigned is running via `System.runAs`  
When the test calls `bcm_DragDropController.reorderCapabilities` with a valid ordered Id list  
Then an exception is thrown due to insufficient privileges to update `bcm_Capability__c`  

**Scenario: Viewer cannot call reparentCapability (tested via System.runAs)**

Given a test user with only `bcm_Viewer` assigned is running via `System.runAs`  
When the test calls `bcm_DragDropController.reparentCapability` with valid arguments  
Then an exception is thrown due to insufficient privileges to update `bcm_Capability__c`  

**Scenario: Editor can call reorderCapabilities (tested via System.runAs)**

Given a test user with `bcm_Editor` assigned is running via `System.runAs`  
And sibling Capability records exist  
When the test calls `bcm_DragDropController.reorderCapabilities` with a reordered Id list  
Then the method completes without error and `bcm_SortOrder__c` values are updated correctly  

**Scenario: Editor can call reparentCapability (tested via System.runAs)**

Given a test user with `bcm_Editor` assigned is running via `System.runAs`  
And Capability records with two different parents exist  
When the test calls `bcm_DragDropController.reparentCapability` to move a node to a new parent  
Then the method completes without error and `bcm_Parent__c` is updated correctly on the moved node  
