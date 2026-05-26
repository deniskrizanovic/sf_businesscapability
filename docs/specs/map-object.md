# Step 1 Acceptance Criteria — `bcm_Map__c` Object

## Feature: Map object exists with correct fields

**Scenario: Editor can create a Map record with a description**

Given the user has the `bcm_Editor` permission set assigned  
When the user creates a new `bcm_Map__c` record with Name "Test Map" and a rich text description  
Then the record saves successfully and the description renders formatted in the record detail  

**Scenario: Editor can edit a Map record**

Given a `bcm_Map__c` record exists  
And the user has the `bcm_Editor` permission set assigned  
When the user edits the record and changes the Name  
Then the updated record saves successfully  

**Scenario: Editor can delete a Map record**

Given a `bcm_Map__c` record exists  
And the user has the `bcm_Editor` permission set assigned  
When the user deletes the record  
Then the record is removed and the user is returned to the list view  

---

## Feature: bcm_Viewer permission set grants read-only access to Maps

**Scenario: Viewer can view a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user navigates to a `bcm_Map__c` record  
Then the record detail page loads successfully  

**Scenario: Viewer cannot create a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user attempts to create a new `bcm_Map__c` record via DML  
Then a `DmlException` is thrown with insufficient privileges  

**Scenario: Viewer cannot edit a Map record**

Given the user has the `bcm_Viewer` permission set assigned  
And a `bcm_Map__c` record exists  
When the user attempts to update the record via DML  
Then a `DmlException` is thrown with insufficient privileges  

---

## Feature: BCM app is accessible and Maps tab is visible to Editors only

**Scenario: BCM app appears in App Launcher**

Given the metadata has been deployed  
When a user with either permission set opens the App Launcher  
Then `Business Capability Map` is listed  

**Scenario: Maps tab is visible to Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the `bcm_BusinessCapabilityMap` app  
Then the Maps tab is visible in the navigation bar  

**Scenario: Maps tab is hidden from Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the `bcm_BusinessCapabilityMap` app  
Then the Maps tab is not visible in the navigation bar  

**Scenario: Maps tab navigates to the Map list view**

Given the user has the `bcm_Editor` permission set assigned  
And the user is in the `bcm_BusinessCapabilityMap` app  
When the user clicks the Maps tab  
Then the `bcm_Map__c` list view is displayed  
