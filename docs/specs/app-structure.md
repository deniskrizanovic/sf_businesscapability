# Acceptance Criteria — App Structure

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees Maps, Capabilities, and Tags navigation tabs**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps, Capabilities, and Tags tabs are visible in the navigation bar  
And no Visualisation or Import tabs appear in the navigation bar  

> Tested by: `e2e/app-structure.spec.ts::"editor sees Maps tab"`, `e2e/app-structure.spec.ts::"editor sees Capabilities tab"`, `e2e/app-structure.spec.ts::"editor sees Tags tab"`, `e2e/app-structure.spec.ts::"editor does not see a Visualisation tab"`, `e2e/app-structure.spec.ts::"editor does not see an Import tab"`

**Scenario: Visualisation button on Map record opens a stub modal**

Given the user has the `bcm_Editor` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Visualisation button in the record header  
Then a modal opens and displays content  

> Tested by: `e2e/app-structure.spec.ts::"Visualisation button opens panel without errors"`

**Scenario: Import button on Map record page is visible to Editors**

Given the user has the `bcm_Editor` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user views the record header  
Then the Import button is visible  

> Tested by: `e2e/app-structure.spec.ts::"Import button is visible in highlights panel"`

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Maps, Capabilities, and Tags tabs**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps, Capabilities, and Tags tabs are visible  

> Tested by: `e2e/app-structure.spec.ts::"viewer sees Maps tab"`, `e2e/app-structure.spec.ts::"viewer sees Capabilities tab"`, `e2e/app-structure.spec.ts::"viewer sees Tags tab"`

**Scenario: Viewer can access the Visualisation modal**

> Deferred: Viewer access to the Visualisation button is verified end-to-end in Step 7 when the diagram LWC replaces the stub modal; stub modal behaviour for Viewer is not in scope for this step.

Given the user has the `bcm_Viewer` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Visualisation button  
Then the modal opens  

---

## Feature: App pages open without errors

**Scenario: Visualisation modal opens without errors for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Visualisation button on a `bcm_Map__c` record  
Then the modal opens with no error messages  

> Tested by: `e2e/app-structure.spec.ts::"Visualisation button opens panel without errors"`

**Scenario: Import modal opens without errors for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Import button on a `bcm_Map__c` record  
Then the modal opens with no error messages  

> Tested by: `e2e/app-structure.spec.ts::"Import button opens panel without errors"`
