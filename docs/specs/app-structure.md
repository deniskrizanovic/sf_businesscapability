# Acceptance Criteria — App Structure

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees all four tabs**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the following tabs are all visible in the navigation bar: Visualisation, Maps, Capabilities, Tags  

**Scenario: Visualisation tab opens the Visualisation page**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Visualisation tab  
Then the Visualisation page opens and displays content  

**Scenario: Visualisation button on Map record opens Visualisation page**

Given the user has the `bcm_Editor` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Visualisation button in the record header  
Then the Visualisation page opens  

**Scenario: Import tab on Map record page is visible to Editors**

Given the user has the `bcm_Editor` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Import tab on the record page  
Then the Import tab content is displayed  

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Visualisation, Maps, Capabilities, and Tags tabs**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Visualisation, Maps, Capabilities, and Tags tabs are visible  

**Scenario: Viewer can open the Visualisation page**

Given the user has the `bcm_Viewer` permission set assigned  
When the user clicks the Visualisation tab  
Then the Visualisation page opens and displays content  

---

## Feature: App pages open without errors

**Scenario: Visualisation page opens without errors for any BCM user**

Given the user has either the `bcm_Editor` or `bcm_Viewer` permission set assigned  
When the user clicks the Visualisation tab  
Then the Visualisation page opens with no error messages  

**Scenario: Map record Import tab opens without errors for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user views a `bcm_Map__c` record and clicks the Import tab  
Then the Import tab opens with no error messages  
