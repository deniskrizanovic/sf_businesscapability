# Plan 06: Salesforce App Structure

## Application
- **API Name:** `bcm_BusinessCapabilityMap`
- **Label:** Business Capability Map
- **Navigation Type:** Standard (Lightning Experience)
- **Logo:** Custom (TBD)

## Tabs

| Tab # | Label | Type | Object / Component | Visible To |
|---|---|---|---|---|
| 1 | Map | Lightning App Page | `bcm_CapabilityMap` LWC | All BCM users |
| 2 | Capabilities | Object Tab | `bcm_Capability__c` | All BCM users |
| 3 | Tags | Object Tab | `bcm_Tag__c` | All BCM users |
| 4 | Import | Lightning App Page | `bcm_ImportUtility` LWC | `bcm_Editor` only |

## Lightning App Pages

### BCM Map Page
- **API Name:** `bcm_MapPage`
- **Label:** Capability Map
- **Layout:** Single region, full width (no sidebar)
- **Component:** `bcm_CapabilityMap` occupies full region
- **Activation:** Assigned to `bcm_BusinessCapabilityMap` app

### BCM Import Page
- **API Name:** `bcm_ImportPage`
- **Label:** Capability Import
- **Layout:** Single region, full width
- **Component:** `bcm_ImportUtility` occupies full region
- **Activation:** Assigned to `bcm_BusinessCapabilityMap` app

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
- Map: Default On
- Capabilities: Default On
- Tags: Default On
- Import: Hidden

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
- Map: Default On
- Capabilities: Default On
- Tags: Default On
- Import: Default On

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
