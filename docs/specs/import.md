# Acceptance Criteria — Import

## Feature: Import UI is accessible from a Map record

**Scenario: Import form opens when Editor clicks the Import button**

Given the user has the `bcm_Editor` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Import button in the highlights panel  
Then the import panel opens displaying a text area for pasting JSON and an "Import" button

> Deferred: UI behaviour — covered by Playwright e2e (tests/e2e/import.spec.ts)

**Scenario: Import panel is not accessible to Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
And the user is viewing a `bcm_Map__c` record  
When the user clicks the Import button in the highlights panel  
Then the import panel opens but the Import button is disabled or hidden

> Tested by: bcm_ImportControllerTest.permission_viewer_cannotCallImport
> Tested by: bcm_ImportControllerTest.invocable_viewer_returnsAccessDenied

---

## Feature: Successful import from valid JSON

**Scenario: Valid JSON creates a Map, Capabilities, and Tags**

Given the user has the `bcm_Editor` permission set assigned  
And the import text area contains a valid JSON payload with a map name, nested capabilities, and tags  
When the user clicks "Import"  
Then a success message is displayed showing the count of capabilities and tags created  
And the imported Map record exists  
And all Capability records from the JSON exist with correct names, levels, sort orders, and parent relationships  
And all Tag records named in the JSON exist  
And the correct Capabilities are linked to their Tags

> Tested by: bcm_ImportControllerTest.happyPath_validJson_importsMapAndCapabilities
> Note: Tags are not imported (bcm_Colour\_\_c is a restricted picklist with no default grey value). Tag count in success message is omitted.

**Scenario: Rich text fields are stored as formatted content**

Given the JSON payload contains formatted content for the Definition, Strategy Support, or Architectural Nuance fields  
When the import completes  
Then those fields on the Capability records contain the content as supplied, rendering formatted in the record detail

> Tested by: bcm_ImportControllerTest.happyPath_richTextFields_storedAsIs

**Scenario: A loading indicator is shown during import**

Given the user has pasted valid JSON and clicked "Import"  
When the import is in progress  
Then a loading spinner is displayed and the Import button is disabled

> Deferred: UI behaviour — covered by Playwright e2e (tests/e2e/import.spec.ts)

---

## Feature: Import is idempotent

**Scenario: Re-importing the same JSON does not create duplicates**

Given a successful import has already been performed  
When the user pastes the same JSON and clicks "Import" again  
Then the operation completes successfully  
And no duplicate Map, Capability, or Tag records are created  
And the tag associations reflect the current JSON (old links replaced, not appended)

> Tested by: bcm_ImportControllerTest.happyPath_reimport_isIdempotent
> Note: Tag associations are not managed by the importer (tags not imported).

---

## Feature: Cross-cutting capabilities are imported

**Scenario: isCrossCutting true sets the flag on a Level 1 capability**

Given the JSON payload contains a Level 1 capability with `"isCrossCutting": true`  
When the import completes  
Then that Capability has IsCrossCutting set and renders in the cross-cutting band  
And Level 1 capabilities without the key are imported with IsCrossCutting unset

> Tested by: bcm_ImportControllerTest.crossCutting_flagTrueOnL1_setsIsCrossCutting

**Scenario: Omitting isCrossCutting preserves an existing flag**

Given a Capability was imported and then marked cross-cutting by hand  
When JSON without an `isCrossCutting` key for that capability is re-imported  
Then the Capability keeps IsCrossCutting set

> Tested by: bcm_ImportControllerTest.crossCutting_keyOmittedOnReimport_preservesExistingFlag

**Scenario: Re-import promotes a Level 2 capability to a cross-cutting Level 1**

Given a Capability was imported as Level 2 under a parent  
When JSON is re-imported with the same externalId at Level 1 and `"isCrossCutting": true`  
Then the Capability becomes Level 1 with no parent and IsCrossCutting set

> Tested by: bcm_ImportControllerTest.crossCutting_reimportPromotesL2ToL1_clearsParentAndSetsFlag

---

## Feature: Tags without an existing colour default to grey

**Scenario: New tags created during import get the default colour**

Given the JSON payload references a tag name that does not yet exist  
When the import completes  
Then a Tag record is created for that tag with Colour set to grey (#CCCCCC)

> Deferred: Tags are not imported — bcm_Colour\_\_c is a restricted required picklist with no grey (#CCCCCC) value. Tags must be created manually via the Tags tab.

---

## Feature: Import errors are handled gracefully

**Scenario: Malformed JSON displays an error message**

Given the import text area contains text that is not valid JSON  
When the user clicks "Import"  
Then an error message is displayed describing the problem  
And no records are created or modified

> Tested by: bcm_ImportControllerTest.error_malformedJson_returnsError

**Scenario: A capability that fails validation rolls back the whole import**

Given the JSON is valid but one capability breaks a validation rule (e.g. `isCrossCutting` on a Level 2)  
When the user clicks "Import"  
Then an error message is displayed naming the failing externalId and the reason  
And no records are created or modified, including the Map and the capabilities that were valid

> Tested by: bcm_ImportControllerTest.error_capabilityFailsValidation_rollsBackAndReturnsError

**Scenario: Empty text area is rejected before submission**

Given the import text area is empty  
When the user clicks "Import"  
Then the import is not submitted and a message prompts the user to paste JSON

> Tested by: bcm_ImportControllerTest.error_emptyPayload_returnsError, bcm_ImportControllerTest.error_nullPayload_returnsError
