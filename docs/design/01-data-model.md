# Plan 01: Data Model

## Objects

### bcm_Map\_\_c

A container for a set of Business Capabilities. Multiple maps can exist in the same org.

| Field                | Type           | Attributes       |
| -------------------- | -------------- | ---------------- |
| `Name`               | Standard Text  | Required, unique |
| `bcm_Description__c` | Rich Text Area | Optional         |

### bcm_Capability\_\_c

A single Business Capability at any level (1, 2, or 3).

| Field                | API Name                     | Type                         | Attributes                           |
| -------------------- | ---------------------------- | ---------------------------- | ------------------------------------ |
| Name                 | `Name`                       | Standard Text                | Required                             |
| Map                  | `bcm_Map__c`                 | Lookup → `bcm_Map__c`        | Required                             |
| Parent               | `bcm_Parent__c`              | Lookup → `bcm_Capability__c` | Optional (null = L1 root)            |
| Level                | `bcm_Level__c`               | Number (1, 0 decimal)        | Required, values: 1, 2, 3            |
| Sort Order           | `bcm_SortOrder__c`           | Number (6, 0 decimal)        | Required                             |
| External ID          | `bcm_ExternalId__c`          | Text (255)                   | Unique, External ID, used for upsert |
| Definition           | `bcm_Definition__c`          | Rich Text Area (32768)       | Optional                             |
| Strategy Support     | `bcm_StrategySupport__c`     | Rich Text Area (32768)       | Optional                             |
| Architectural Nuance | `bcm_ArchitecturalNuance__c` | Rich Text Area (32768)       | Optional                             |

**Relationships:**

- `bcm_Map__c` lookup: `Lookup` (not Master-Detail) — allows map deletion without cascading capability deletion; `deleteConstraint: Restrict`
- `bcm_Parent__c` lookup: `Lookup` (not Master-Detail) — self-referencing hierarchy; `deleteConstraint` **must be `SetNull`** — Salesforce does not allow `Restrict` or `Cascade` on self-referencing lookup fields (deployment error if either is used)

**Validation Rules:**

- `bcm_Level__c` must be 1, 2, or 3
- If `bcm_Parent__c` is null, `bcm_Level__c` must be 1
- If `bcm_Parent__c` is populated, `bcm_Level__c` must be 2 or 3

### bcm_Tag\_\_c

A named, coloured label applied to Capabilities for visualisation grouping.

| Field  | API Name        | Type                  | Attributes       |
| ------ | --------------- | --------------------- | ---------------- |
| Name   | `Name`          | Standard Text         | Required, unique |
| Colour | `bcm_Colour__c` | Picklist (restricted) | Required         |

**Picklist values** (label → stored API value used directly as hex colour by the diagram LWC):

| Label   | Stored value |
| ------- | ------------ |
| Blue    | `#3A86FF`    |
| Green   | `#2DC653`    |
| Red     | `#E63946`    |
| Purple  | `#7B2FBE`    |
| Orange  | `#FB5607`    |
| Teal    | `#0096C7`    |
| Pink    | `#FF006E`    |
| Amber   | `#FFBE0B`    |
| Indigo  | `#4361EE`    |
| Emerald | `#06A77D`    |

**No validation rule required** — the restricted picklist enforces allowed values at the platform level. The stored value is the hex code so Step 7's diagram LWC can use `bcm_Colour__c` directly without a lookup table.

### bcm_CapabilityTag\_\_c

Junction object linking Capabilities to Tags. A Capability may have many Tags.

| Field      | API Name            | Type                                | Attributes |
| ---------- | ------------------- | ----------------------------------- | ---------- |
| Capability | `bcm_Capability__c` | Master-Detail → `bcm_Capability__c` | Required   |
| Tag        | `bcm_Tag__c`        | Master-Detail → `bcm_Tag__c`        | Required   |

**Note:** Both relationships are Master-Detail so junction records are deleted when either parent is deleted. The combination of `bcm_Capability__c` + `bcm_Tag__c` should be unique (duplicate rule or validation).

## Indexes and Performance

- `bcm_ExternalId__c` is an External ID field — automatically indexed by Salesforce
- `bcm_Map__c` on `bcm_Capability__c` — add a custom index via Salesforce Support if data volume exceeds 100k records (unlikely for a capability map, but noted)
- `bcm_Parent__c` — automatically indexed as a lookup relationship field
- `bcm_Level__c` and `bcm_SortOrder__c` — not indexed; queries always filter by `bcm_Map__c` first, so full scans are bounded

## Object Permissions Summary

| Object                 | bcm_Viewer | bcm_Editor                 |
| ---------------------- | ---------- | -------------------------- |
| `bcm_Map__c`           | Read       | Read, Create, Edit         |
| `bcm_Capability__c`    | Read       | Read, Create, Edit, Delete |
| `bcm_Tag__c`           | Read       | Read, Create, Edit, Delete |
| `bcm_CapabilityTag__c` | Read       | Read, Create, Edit, Delete |

## Org-Wide Defaults (Sharing Model)

| Object                 | Internal Sharing Model          | External Sharing Model |
| ---------------------- | ------------------------------- | ---------------------- |
| `bcm_Map__c`           | `ReadWrite` (Public Read/Write) | `Private`              |
| `bcm_Capability__c`    | `ReadWrite` (Public Read/Write) | `Private`              |
| `bcm_Tag__c`           | `Read` (Public Read Only)       | n/a                    |
| `bcm_CapabilityTag__c` | `ControlledByParent` (junction) | n/a                    |

**Rationale:** Capability maps are intentionally non-confidential — every BCM user who can see the app should see every map and every capability. We do not have a row-level segmentation requirement (e.g. "Finance maps are hidden from HR"); restricting visibility per record would defeat the purpose of an enterprise-wide capability inventory.

With `ReadWrite` OWD, **edit access is gated entirely by the permission sets** ([06-app-structure.md](06-app-structure.md)): `bcm_Viewer` grants `Read` only on `bcm_Map__c` and `bcm_Capability__c`, so Viewer users still cannot create, edit, or delete records — Salesforce's CRUD check fires before sharing. `bcm_Editor` grants full CRUD plus the `bcm_CanEdit` custom permission for the diagram's structural-edit affordances.

**Why not `Read` OWD?** The earlier model used `Read` OWD and would have required sharing rules or manual record sharing for any future "edit a record I do not own" workflow. `ReadWrite` keeps the access model declarative (permsets only) and consistent with how the e2e suite expects integration users (test harness, importer) to write to records seeded by other users without sharing-recalc lag intermittently blocking master-detail junction inserts (see [09-e2e-test-architecture.md §5](09-e2e-test-architecture.md)).
