# Step 3 Acceptance Criteria — `bcm_Tag__c` Object

## Feature: Tag object exists with correct fields

**Scenario: Tag object is deployed**
- Given the metadata has been deployed to the org
- When a user navigates to Setup → Object Manager
- Then `bcm_Tag__c` is listed as a custom object

**Scenario: Colour field is present**
- Given the `bcm_Tag__c` object exists
- When a user views the Fields & Relationships
- Then `bcm_Colour__c` is present with type Text and length 7

---

## Feature: Tag colour validation rule fires correctly

**Scenario: Empty colour value is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Tag with `bcm_Colour__c` = ""
- Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."

**Scenario: Plain text colour name is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Tag with `bcm_Colour__c` = "red"
- Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."

**Scenario: Invalid hex characters are rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Tag with `bcm_Colour__c` = "#GGGGGG"
- Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."

**Scenario: Colour that is too short is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Tag with `bcm_Colour__c` = "#3A86"
- Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."

**Scenario: Colour that is too long is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Tag with `bcm_Colour__c` = "#3A86FFAA"
- Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."

**Scenario: Valid uppercase hex colour is accepted**
- Given the user has the `bcm_Editor` permission set assigned
- When the user saves a Tag with `bcm_Colour__c` = "#3A86FF"
- Then the record saves successfully

**Scenario: Valid lowercase hex colour is accepted**
- Given the user has the `bcm_Editor` permission set assigned
- When the user saves a Tag with `bcm_Colour__c` = "#3a86ff"
- Then the record saves successfully

---

## Feature: Tag colour validation Apex test class passes with permission boundary coverage

**Scenario: All validation test methods pass**
- Given `bcm_TagValidationTest` has been deployed
- When the test class is executed in the org
- Then all test methods pass with no failures

**Scenario: Viewer cannot insert a Tag (tested via System.runAs)**
- Given a test user with only `bcm_Viewer` assigned is running via `System.runAs`
- When the test attempts to insert a `bcm_Tag__c` record via DML
- Then a `DmlException` is thrown with insufficient privileges

**Scenario: Editor can insert a valid Tag (tested via System.runAs)**
- Given a test user with `bcm_Editor` assigned is running via `System.runAs`
- When the test inserts a `bcm_Tag__c` record with a valid hex colour
- Then the record is created successfully

**Scenario: Editor cannot insert a Tag with an invalid colour (tested via System.runAs)**
- Given a test user with `bcm_Editor` assigned is running via `System.runAs`
- When the test attempts to insert a `bcm_Tag__c` record with `bcm_Colour__c` = "red"
- Then a `DmlException` is thrown from the validation rule

---

## Feature: Permission sets grant correct access to Tags

**Scenario: Viewer can read a Tag record**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user navigates to a `bcm_Tag__c` record
- Then the record detail page loads successfully

**Scenario: Viewer cannot create a Tag record**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user attempts to insert a `bcm_Tag__c` record via DML
- Then a `DmlException` is thrown with insufficient privileges

**Scenario: Editor can create, edit, and delete a Tag record**
- Given the user has the `bcm_Editor` permission set assigned
- When the user creates a Tag with a valid colour, edits it, then deletes it
- Then each operation completes successfully

---

## Feature: Tags tab is visible in the BCM app

**Scenario: Tags tab appears for Editors**
- Given the user has the `bcm_Editor` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the Tags tab is visible in the navigation bar

**Scenario: Tags tab appears for Viewers**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the Tags tab is visible in the navigation bar
