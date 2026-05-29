# Acceptance Criteria — Map Object

## Feature: Map records can be created and managed

**Scenario: Editor can create a Map record with a description**

Given the user has the `bcm_Editor` permission set assigned  
When the user creates a new Map with a name and a rich text description  
Then the record saves successfully and the description renders formatted in the record detail  

> Tested by: `e2e/map.spec.ts::"editor creates a Map record with a description"`

**Scenario: Editor can edit a Map record**

Given a Map record exists  
And the user has the `bcm_Editor` permission set assigned  
When the user edits the record and changes the name  
Then the updated record saves successfully  

> Tested by: `e2e/map.spec.ts::"editor edits a Map record name"`

**Scenario: Editor can delete a Map record**

Given a Map record exists  
And the user has the `bcm_Editor` permission set assigned  
When the user deletes the record  
Then the record is removed and the user is returned to the list view  

> Tested by: `e2e/map.spec.ts::"editor deletes a Map record"`

---

## Feature: Viewers have read-only access to Maps

**Scenario: Viewer can view a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user navigates to a Map record  
Then the record detail page loads successfully  

> Tested by: `e2e/map.spec.ts::"viewer can read a Map record"`

**Scenario: Viewer cannot create a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user attempts to create a new Map record  
Then access is denied and the record is not created  

> Tested by: `e2e/map.spec.ts::"viewer cannot create a Map record — no New button"`

**Scenario: Viewer cannot edit a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
And a Map record exists  
When the user attempts to edit the record  
Then access is denied and the record is not updated  

> Tested by: `e2e/map.spec.ts::"viewer cannot edit a Map record — no Edit button"`

---

## Feature: Business Capability Map app is accessible with correct tab visibility

**Scenario: BCM app appears in App Launcher**

Given the user has either the `bcm_Editor` or `bcm_Viewer` permission set assigned  
When the user opens the App Launcher  
Then Business Capability Map is listed  

> Tested by: `e2e/map.spec.ts::"BCM app appears in App Launcher"`

**Scenario: Maps tab is visible to Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps tab is visible in the navigation bar  

> Tested by: `e2e/map.spec.ts::"Maps tab is visible to Editor"`

**Scenario: Maps tab is visible to Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps tab is visible in the navigation bar  

> Tested by: `e2e/map.spec.ts::"Maps tab is visible to Viewer"`

**Scenario: Maps tab navigates to the Maps list**

Given the user has the `bcm_Editor` permission set assigned  
And the user is in the Business Capability Map app  
When the user clicks the Maps tab  
Then the Maps list is displayed  

> Tested by: `e2e/map.spec.ts::"Maps tab navigates to the Maps list"`
