# Step 6 Acceptance Criteria — Import Utility

## Feature: Import UI is accessible to Editors

**Scenario: Import component is visible on the Import page**

Given the user has the `bcm_Editor` permission set assigned  
When the user navigates to the Import tab in the BCM app  
Then the `bcm_ImportUtility` component is displayed with a "Paste JSON" textarea and an "Import" button  

**Scenario: Import page is not accessible to Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the `bcm_BusinessCapabilityMap` app  
Then the Import tab is not visible in the navigation bar  

---

## Feature: Successful import from valid JSON

**Scenario: Valid JSON creates Map, Capabilities, and Tags**

Given the user has the `bcm_Editor` permission set assigned  
And the Import textarea contains a valid JSON payload with `mapName`, nested capabilities, and tags  
When the user clicks "Import"  
Then a success message is displayed showing the count of capabilities inserted and tags created  
And the imported `bcm_Map__c` record exists in the org  
And all `bcm_Capability__c` records from the JSON exist with correct Name, Level, SortOrder, and parent relationships  
And all `bcm_Tag__c` records named in the JSON exist  
And `bcm_CapabilityTag__c` junction records link the correct capabilities to their tags  

**Scenario: Rich text fields are stored as HTML**

Given the JSON payload contains HTML strings for `definition`, `strategySupport`, or `architecturalNuance`  
When the import completes  
Then the corresponding `bcm_Capability__c` rich text fields contain the HTML as supplied, rendering formatted in the record detail  

**Scenario: Spinner is shown during import**

Given the user has pasted valid JSON and clicked "Import"  
When the Apex call is in progress  
Then a loading spinner is displayed and the Import button is disabled  

---

## Feature: Import is idempotent

**Scenario: Re-importing the same JSON does not create duplicates**

Given a successful import has already been performed  
When the user pastes the same JSON and clicks "Import" again  
Then the operation completes successfully  
And no duplicate `bcm_Map__c`, `bcm_Capability__c`, or `bcm_Tag__c` records are created  
And the tag associations reflect the current JSON (old junctions replaced, not appended)  

---

## Feature: Tags without an existing colour default to grey

**Scenario: New tags created during import get the default colour**

Given the JSON payload references a tag name that does not yet exist in the org  
When the import completes  
Then a `bcm_Tag__c` record is created for that tag with `bcm_Colour__c` = "#CCCCCC"  

---

## Feature: Import errors are handled gracefully

**Scenario: Malformed JSON displays an error message**

Given the Import textarea contains text that is not valid JSON  
When the user clicks "Import"  
Then an error message is displayed describing the parse failure  
And no records are created or modified in the org  

**Scenario: Empty textarea is rejected before submission**

Given the Import textarea is empty  
When the user clicks "Import"  
Then the import is not submitted and an inline validation message prompts the user to paste JSON  

---

## Feature: Import Apex test class meets coverage and permission boundary requirements

**Scenario: Test class passes with sufficient coverage**

Given `bcm_ImportControllerTest` has been deployed  
When the test class is executed in the org  
Then all test methods pass and overall coverage for `bcm_ImportController` is ≥ 75%  

**Scenario: Viewer cannot call importCapabilities (tested via System.runAs)**

Given a test user with only `bcm_Viewer` assigned is running via `System.runAs`  
When the test calls `bcm_ImportController.importCapabilities` with a valid JSON payload  
Then an `AuraHandledException` or `DmlException` is thrown due to insufficient privileges on the objects being written  

**Scenario: Editor can successfully call importCapabilities (tested via System.runAs)**

Given a test user with `bcm_Editor` assigned is running via `System.runAs`  
When the test calls `bcm_ImportController.importCapabilities` with a valid JSON payload  
Then the method returns a successful `bcm_ImportResult` and the expected records are created in the org  
