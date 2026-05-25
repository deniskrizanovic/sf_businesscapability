# Step 2 Acceptance Criteria — `bcm_Capability__c` Object

## Feature: Capability object exists with correct fields

**Scenario: Capability object is deployed**
- Given the metadata has been deployed to the org
- When a user navigates to Setup → Object Manager
- Then `bcm_Capability__c` is listed as a custom object

**Scenario: All custom fields are present**
- Given the `bcm_Capability__c` object exists
- When a user views the Fields & Relationships
- Then the following fields are present: `bcm_Map__c`, `bcm_Parent__c`, `bcm_Level__c`, `bcm_SortOrder__c`, `bcm_ExternalId__c`, `bcm_Definition__c`, `bcm_StrategySupport__c`, `bcm_ArchitecturalNuance__c`

**Scenario: External ID field is marked as External ID**
- Given the `bcm_Capability__c` object exists
- When a user views the field detail for `bcm_ExternalId__c`
- Then the field is marked as External ID and Unique

**Scenario: Parent field is a self-referencing Lookup, not Master-Detail**
- Given the `bcm_Capability__c` object exists
- When a user views the field detail for `bcm_Parent__c`
- Then the relationship type is Lookup and the related object is `bcm_Capability__c`

**Scenario: Rich text fields accept HTML content**
- Given the user has the `bcm_Editor` permission set assigned
- When the user creates a Capability record with `bcm_Definition__c` set to `<p>A <strong>key</strong> capability.</p>`
- Then the record saves successfully and the field renders formatted HTML in the record detail

---

## Feature: Capability level validation rules fire correctly

**Scenario: Level 0 is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Capability record with `bcm_Level__c` = 0
- Then a validation error is displayed: "Level must be 1, 2, or 3."

**Scenario: Level 4 is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Capability record with `bcm_Level__c` = 4
- Then a validation error is displayed: "Level must be 1, 2, or 3."

**Scenario: Level 1 with no parent is accepted**
- Given the user has the `bcm_Editor` permission set assigned
- When the user saves a Capability record with `bcm_Level__c` = 1 and `bcm_Parent__c` = null
- Then the record saves successfully

**Scenario: Level 2 with no parent is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Capability record with `bcm_Level__c` = 2 and `bcm_Parent__c` = null
- Then a validation error is displayed: "A capability with no parent must be Level 1."

**Scenario: Level 3 with no parent is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- When the user attempts to save a Capability record with `bcm_Level__c` = 3 and `bcm_Parent__c` = null
- Then a validation error is displayed: "A capability with no parent must be Level 1."

**Scenario: Level 1 with a parent is rejected**
- Given the user has the `bcm_Editor` permission set assigned
- And a parent Capability record exists
- When the user attempts to save a Capability with `bcm_Level__c` = 1 and `bcm_Parent__c` set to the parent
- Then a validation error is displayed: "A capability with a parent must be Level 2 or 3."

**Scenario: Level 2 with a parent is accepted**
- Given the user has the `bcm_Editor` permission set assigned
- And a Level 1 Capability record exists
- When the user saves a Capability with `bcm_Level__c` = 2 and `bcm_Parent__c` set to the Level 1 record
- Then the record saves successfully

**Scenario: Level 3 with a parent is accepted**
- Given the user has the `bcm_Editor` permission set assigned
- And a Level 2 Capability record exists
- When the user saves a Capability with `bcm_Level__c` = 3 and `bcm_Parent__c` set to the Level 2 record
- Then the record saves successfully

---

## Feature: Capability validation Apex test class passes with permission boundary coverage

**Scenario: All validation test methods pass**
- Given `bcm_CapabilityValidationTest` has been deployed
- When the test class is executed in the org
- Then all test methods pass with no failures

**Scenario: Viewer cannot insert a Capability (tested via System.runAs)**
- Given a test user with only `bcm_Viewer` assigned is running via `System.runAs`
- When the test attempts to insert a valid `bcm_Capability__c` record via DML
- Then a `DmlException` is thrown with insufficient privileges

**Scenario: Editor can insert a valid Capability (tested via System.runAs)**
- Given a test user with `bcm_Editor` assigned is running via `System.runAs`
- When the test inserts a valid `bcm_Capability__c` record via DML
- Then the record is created successfully

**Scenario: Editor cannot insert an invalid Capability (tested via System.runAs)**
- Given a test user with `bcm_Editor` assigned is running via `System.runAs`
- When the test attempts to insert a Capability with Level 2 and no parent
- Then a `DmlException` is thrown from the validation rule

---

## Feature: Permission sets grant correct access to Capabilities

**Scenario: Viewer can read a Capability record**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user navigates to a `bcm_Capability__c` record
- Then the record detail page loads successfully

**Scenario: Viewer cannot create a Capability record**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user attempts to insert a `bcm_Capability__c` record via DML
- Then a `DmlException` is thrown with insufficient privileges

**Scenario: Editor can create, edit, and delete a Capability record**
- Given the user has the `bcm_Editor` permission set assigned
- When the user creates a valid Capability record, edits it, then deletes it
- Then each operation completes successfully

---

## Feature: Capabilities tab is visible in the BCM app

**Scenario: Capabilities tab appears for Editors**
- Given the user has the `bcm_Editor` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the Capabilities tab is visible in the navigation bar

**Scenario: Capabilities tab appears for Viewers**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the Capabilities tab is visible in the navigation bar
