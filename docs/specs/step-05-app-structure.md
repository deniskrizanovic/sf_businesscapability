# Step 5 Acceptance Criteria — App Structure

## Feature: bcm_CanEdit Custom Permission is deployed

**Scenario: Custom Permission exists in the org**
- Given the metadata has been deployed
- When a user navigates to Setup → Custom Permissions
- Then `bcm_CanEdit` is listed with label "BCM Can Edit"

**Scenario: bcm_Editor permission set grants bcm_CanEdit**
- Given the `bcm_Editor` permission set has been updated
- When a user views the Custom Permissions section of `bcm_Editor`
- Then `bcm_CanEdit` is listed as granted

**Scenario: bcm_Viewer permission set does not grant bcm_CanEdit**
- Given the `bcm_Viewer` permission set exists
- When a user views the Custom Permissions section of `bcm_Viewer`
- Then `bcm_CanEdit` is not listed

---

## Feature: Full app navigation is correct for Editors

**Scenario: Editor sees all five tabs**
- Given the user has the `bcm_Editor` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the following tabs are all visible in the navigation bar: Map, Capabilities, Tags, Import, Maps

**Scenario: Map tab navigates to the Map FlexiPage**
- Given the user has the `bcm_Editor` permission set assigned
- When the user clicks the Map tab
- Then `bcm_MapPage` loads (placeholder content visible)

**Scenario: Import tab navigates to the Import FlexiPage**
- Given the user has the `bcm_Editor` permission set assigned
- When the user clicks the Import tab
- Then `bcm_ImportPage` loads (placeholder content visible)

---

## Feature: Full app navigation is correct for Viewers

**Scenario: Viewer sees Map, Capabilities, and Tags tabs only**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user opens the `bcm_BusinessCapabilityMap` app
- Then the Map, Capabilities, and Tags tabs are visible
- And the Import and Maps tabs are not visible

**Scenario: Viewer can navigate to the Map page**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user clicks the Map tab
- Then `bcm_MapPage` loads (placeholder content visible)

---

## Feature: FlexiPage stubs are deployed and accessible

**Scenario: bcm_MapPage loads without errors**
- Given the metadata has been deployed
- When a user with any BCM permission set navigates to `bcm_MapPage`
- Then the page loads with placeholder content and no Lightning errors

**Scenario: bcm_ImportPage loads without errors**
- Given the metadata has been deployed
- When a user with the `bcm_Editor` permission set navigates to `bcm_ImportPage`
- Then the page loads with placeholder content and no Lightning errors
