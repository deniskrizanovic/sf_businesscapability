# Acceptance Criteria — App Structure

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees all five tabs**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the following tabs are all visible in the navigation bar: Map, Capabilities, Tags, Import, Maps  

**Scenario: Map tab opens the Map page**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Map tab  
Then the Map page opens and displays content  

**Scenario: Import tab opens the Import page**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Import tab  
Then the Import page opens and displays content  

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Map, Capabilities, and Tags tabs only**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Map, Capabilities, and Tags tabs are visible  
And the Import and Maps tabs are not visible  

**Scenario: Viewer can open the Map page**

Given the user has the `bcm_Viewer` permission set assigned  
When the user clicks the Map tab  
Then the Map page opens and displays content  

---

## Feature: App pages open without errors

**Scenario: Map page opens without errors for any BCM user**

Given the user has either the `bcm_Editor` or `bcm_Viewer` permission set assigned  
When the user clicks the Map tab  
Then the Map page opens with no error messages  

**Scenario: Import page opens without errors for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Import tab  
Then the Import page opens with no error messages  
