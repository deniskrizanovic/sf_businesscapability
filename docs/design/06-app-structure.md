# Plan 06: Salesforce App Structure

## Application
- **API Name:** `bcm_BusinessCapabilityMap`
- **Label:** Business Capability Map
- **Navigation Type:** Standard (Lightning Experience)
- **Logo:** Custom (TBD)

## Tabs

| Tab # | Label | Type | Object / Component | Visible To |
|---|---|---|---|---|
| 1 | Maps | Object Tab | `bcm_Map__c` | All BCM users |
| 2 | Capabilities | Object Tab | `bcm_Capability__c` | All BCM users |
| 3 | Tags | Object Tab | `bcm_Tag__c` | All BCM users |

## Map Record Page (`bcm_MapRecordPage`)

The `bcm_Map__c` record page is the primary entry point for both the diagram and import workflows. Two quick action buttons appear in the highlights panel:

### Visualisation Button (`bcm_VisualisationButton`)
- **Type:** LWC quick action (`ScreenAction`) on `bcm_Map__c`
- **Behaviour:** Opens a panel containing `bcm_CapabilityMap` (Step 7) — shows placeholder text until then
- **Visible to:** All BCM users

### Import Button (`bcm_ImportButton`)
- **Type:** LWC quick action (`ScreenAction`) on `bcm_Map__c`
- **Behaviour:** Opens a panel containing `bcm_ImportUtility` (Step 6) — shows placeholder text until then
- **Visible to:** All BCM users (Import logic is guarded by `bcm_CanEdit` custom permission inside the LWC)

## Permission Sets

### bcm_Viewer
**Label:** BCM Viewer
**Description:** Read-only access to the Business Capability Map application.

Object Permissions:
- `bcm_Map__c`: Read
- `bcm_Capability__c`: Read
- `bcm_Tag__c`: Read
- `bcm_CapabilityTag__c`: Read

App Access:
- `bcm_BusinessCapabilityMap`: Visible

Tab Visibility:
- Maps: Default On
- Capabilities: Default On
- Tags: Default On

### bcm_Editor
**Label:** BCM Editor
**Description:** Full access to the Business Capability Map application including structural editing and import.

Object Permissions:
- `bcm_Map__c`: Read, Create, Edit, Delete
- `bcm_Capability__c`: Read, Create, Edit, Delete
- `bcm_Tag__c`: Read, Create, Edit, Delete
- `bcm_CapabilityTag__c`: Read, Create, Edit, Delete

Custom Permission:
- `bcm_CanEdit`: Granted (used by LWC to show/hide drag handles and edit controls)

App Access:
- `bcm_BusinessCapabilityMap`: Visible

Tab Visibility:
- Maps: Default On
- Capabilities: Default On
- Tags: Default On

## Custom Permission
- **API Name:** `bcm_CanEdit`
- **Label:** BCM Can Edit
- **Description:** Grants access to structural editing (drag-drop, reparent) in the BCM diagram. Assigned via bcm_Editor permission set.

Used in LWC via:
```js
import canEdit from '@salesforce/customPermission/bcm_CanEdit';
```

## List Views

### bcm_Capability__c
Default list view columns: `Name`, `bcm_Level__c`, `bcm_Map__c`, `bcm_Parent__c`, `bcm_SortOrder__c`
Default sort: `bcm_Map__c` ASC, `bcm_Level__c` ASC, `bcm_SortOrder__c` ASC

### bcm_Tag__c
Default list view columns: `Name`, `bcm_Colour__c`
Default sort: `Name` ASC

### bcm_Map__c
Default list view columns: `Name`, `bcm_Description__c`
Default sort: `Name` ASC
