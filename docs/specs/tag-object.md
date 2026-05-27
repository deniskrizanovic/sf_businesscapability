# Acceptance Criteria — Tag Object

## Feature: Tag colour picklist enforces allowed values

**Scenario: Blank colour is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag without selecting a Colour  
Then the record is rejected because Colour is required  

> Tested by: bcm_TagValidationTest.colour_blank_isRejected

**Scenario: Value not in the picklist is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with a Colour value not in the allowed list (e.g. "red")  
Then the platform rejects the record with a restricted picklist error  

> Tested by: bcm_TagValidationTest.colour_invalidPicklistValue_isRejected

**Scenario: Valid picklist value saves successfully**

Given the user has the `bcm_Editor` permission set assigned  
When the user saves a Tag with Colour set to "Blue"  
Then the record saves and the stored value is `#3A86FF`  

> Tested by: bcm_TagValidationTest.colour_validBlue_succeeds

**Scenario: Second valid picklist value saves successfully**

Given the user has the `bcm_Editor` permission set assigned  
When the user saves a Tag with Colour set to "Emerald"  
Then the record saves and the stored value is `#06A77D`  

> Tested by: bcm_TagValidationTest.colour_validEmerald_succeeds

---

## Feature: Colour swatch is visible on Tag record page

**Scenario: Swatch renders after saving a Tag with a colour**

Given the user has any permission set assigned  
When the user opens a saved Tag record that has a Colour selected  
Then a `lightning-card` tile filled with the chosen colour is visible on the record page above the detail tabs, with the colour name displayed as white text centred inside it  

> Tested by: UI only

---

## Feature: Permission sets grant correct access to Tags

**Scenario: Viewer can read a Tag record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user navigates to a Tag record  
Then the record detail page loads successfully  

> Deferred: Read access verified indirectly by ObjectPermissions query in viewer_cannotInsertTag

**Scenario: Viewer cannot create a Tag record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user attempts to create a new Tag record  
Then access is denied and the record is not created  

> Tested by: bcm_TagValidationTest.viewer_cannotInsertTag

**Scenario: Editor can create, edit, and delete a Tag record**

Given the user has the `bcm_Editor` permission set assigned  
When the user creates a Tag with a valid colour, edits it, then deletes it  
Then each operation completes successfully  

> Tested by: bcm_TagValidationTest.editor_canInsertValidTag

---

## Feature: Tags tab is visible in the BCM app

**Scenario: Tags tab appears for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the Tags tab is visible in the navigation bar  

> Tested by: UI only

**Scenario: Tags tab appears for Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Tags tab is visible in the navigation bar  

> Tested by: UI only
