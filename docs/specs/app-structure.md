# Step 5 Acceptance Criteria — App Structure

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees all five tabs**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the `bcm_BusinessCapabilityMap` app  
Then the following tabs are all visible in the navigation bar: Map, Capabilities, Tags, Import, Maps  

**Scenario: Map tab navigates to the Map FlexiPage**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Map tab  
Then `bcm_MapPage` loads (placeholder content visible)  

**Scenario: Import tab navigates to the Import FlexiPage**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the Import tab  
Then `bcm_ImportPage` loads (placeholder content visible)  

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Map, Capabilities, and Tags tabs only**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the `bcm_BusinessCapabilityMap` app  
Then the Map, Capabilities, and Tags tabs are visible  
And the Import and Maps tabs are not visible  

**Scenario: Viewer can navigate to the Map page**

Given the user has the `bcm_Viewer` permission set assigned  
When the user clicks the Map tab  
Then `bcm_MapPage` loads (placeholder content visible)  

---

## Feature: FlexiPage stubs are deployed and accessible

**Scenario: bcm_MapPage loads without errors**

Given the metadata has been deployed  
When a user with any BCM permission set navigates to `bcm_MapPage`  
Then the page loads with placeholder content and no Lightning errors  

**Scenario: bcm_ImportPage loads without errors**

Given the metadata has been deployed  
When a user with the `bcm_Editor` permission set navigates to `bcm_ImportPage`  
Then the page loads with placeholder content and no Lightning errors  
