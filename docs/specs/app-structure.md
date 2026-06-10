# Acceptance Criteria — App Structure

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees Maps, Capabilities, Tags, and Visualisation navigation tabs**

Given the user has the `bcm_Editor` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps, Capabilities, Tags, and Visualisation tabs are visible in the navigation bar  
And no Import tab appears in the navigation bar

> Tested by: `e2e/app-structure.spec.ts::"editor sees Maps tab"`, `e2e/app-structure.spec.ts::"editor sees Capabilities tab"`, `e2e/app-structure.spec.ts::"editor sees Tags tab"`, `e2e/app-structure.spec.ts::"editor sees Visualisation tab"`, `e2e/app-structure.spec.ts::"editor does not see an Import tab"`

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Maps, Capabilities, and Tags tabs**

Given the user has the `bcm_Viewer` permission set assigned  
When the user opens the Business Capability Map app  
Then the Maps, Capabilities, and Tags tabs are visible

> Tested by: `e2e/app-structure.spec.ts::"viewer sees Maps tab"`, `e2e/app-structure.spec.ts::"viewer sees Capabilities tab"`, `e2e/app-structure.spec.ts::"viewer sees Tags tab"`

---

## Feature: App pages open without errors

**Scenario: JSON Import flow opens without errors from list view**

Given the user has the `bcm_Editor` permission set assigned  
When the user clicks the JSON Import button on the Maps list view  
Then the Import flow opens with no error messages  
And the Paste JSON field is visible

> Tested by: `e2e/app-structure.spec.ts::"JSON Import button on list view opens flow without errors"`

**Scenario: Visualisation button on Map record page**

> Deferred: Visualisation is now a first-class app nav tab (Step 7); record-page button behaviour is covered by diagram.spec.ts Visualisation tab navigation.
