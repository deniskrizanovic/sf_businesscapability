# Acceptance Criteria — Tag Object

## Feature: Tag colour validation rule fires correctly

**Scenario: Empty colour value is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with an empty Colour  
Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."  

**Scenario: Plain text colour name is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with Colour set to "red"  
Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."  

**Scenario: Invalid hex characters are rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with Colour set to "#GGGGGG"  
Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."  

**Scenario: Colour that is too short is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with Colour set to "#3A86"  
Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."  

**Scenario: Colour that is too long is rejected**

Given the user has the `bcm_Editor` permission set assigned  
When the user attempts to save a Tag with Colour set to "#3A86FFAA"  
Then a validation error is displayed: "Colour must be a hex code in the format #RRGGBB."  

**Scenario: Valid uppercase hex colour is accepted**

Given the user has the `bcm_Editor` permission set assigned  
When the user saves a Tag with Colour set to "#3A86FF"  
Then the record saves successfully  

**Scenario: Valid lowercase hex colour is accepted**

Given the user has the `bcm_Editor` permission set assigned  
When the user saves a Tag with Colour set to "#3a86ff"  
Then the record saves successfully  

---

## Feature: Permission sets grant correct access to Tags

**Scenario: Viewer can read a Tag record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user navigates to a Tag record  
Then the record detail page loads successfully  

**Scenario: Viewer cannot create a Tag record**

Given the user has the `bcm_Viewer` permission set assigned  
When the user attempts to create a new Tag record  
Then access is denied and the record is not created  

**Scenario: Editor can create, edit, and delete a Tag record**

Given the user has the `bcm_Editor` permission set assigned  
When the user creates a Tag with a valid colour, edits it, then deletes it  
Then each operation completes successfully  

---

## Feature: Tags tab is visible in the BCM app

**Scenario: Tags tab appears for Editors**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the Tags tab is visible in the navigation bar  

**Scenario: Tags tab appears for Viewers**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Tags tab is visible in the navigation bar  
