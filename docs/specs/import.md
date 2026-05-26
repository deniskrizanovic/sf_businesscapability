# Acceptance Criteria — Import

## Feature: Import UI is accessible to Editors

**Scenario: Import form is visible on the Import page**

Given the user has the `bcm_Editor` permission set assigned  
When the user navigates to the Import tab in the Business Capability Map app  
Then the import form is displayed with a text area for pasting JSON and an "Import" button  

**Scenario: Import page is not accessible to Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Import tab is not visible in the navigation bar  

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

**Scenario: Rich text fields are stored as formatted content**

Given the JSON payload contains formatted content for the Definition, Strategy Support, or Architectural Nuance fields  
When the import completes  
Then those fields on the Capability records contain the content as supplied, rendering formatted in the record detail  

**Scenario: A loading indicator is shown during import**

Given the user has pasted valid JSON and clicked "Import"  
When the import is in progress  
Then a loading spinner is displayed and the Import button is disabled  

---

## Feature: Import is idempotent

**Scenario: Re-importing the same JSON does not create duplicates**

Given a successful import has already been performed  
When the user pastes the same JSON and clicks "Import" again  
Then the operation completes successfully  
And no duplicate Map, Capability, or Tag records are created  
And the tag associations reflect the current JSON (old links replaced, not appended)  

---

## Feature: Tags without an existing colour default to grey

**Scenario: New tags created during import get the default colour**

Given the JSON payload references a tag name that does not yet exist  
When the import completes  
Then a Tag record is created for that tag with Colour set to grey (#CCCCCC)  

---

## Feature: Import errors are handled gracefully

**Scenario: Malformed JSON displays an error message**

Given the import text area contains text that is not valid JSON  
When the user clicks "Import"  
Then an error message is displayed describing the problem  
And no records are created or modified  

**Scenario: Empty text area is rejected before submission**

Given the import text area is empty  
When the user clicks "Import"  
Then the import is not submitted and a message prompts the user to paste JSON  
