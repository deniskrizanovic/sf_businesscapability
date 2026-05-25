# Plan 01: Data Model

## Objects

### bcm_Map__c
A container for a set of Business Capabilities. Multiple maps can exist in the same org.

| Field | Type | Attributes |
|---|---|---|
| `Name` | Standard Text | Required, unique |
| `bcm_Description__c` | Rich Text Area | Optional |

### bcm_Capability__c
A single Business Capability at any level (1, 2, or 3).

| Field | API Name | Type | Attributes |
|---|---|---|---|
| Name | `Name` | Standard Text | Required |
| Map | `bcm_Map__c` | Lookup → `bcm_Map__c` | Required |
| Parent | `bcm_Parent__c` | Lookup → `bcm_Capability__c` | Optional (null = L1 root) |
| Level | `bcm_Level__c` | Number (1, 0 decimal) | Required, values: 1, 2, 3 |
| Sort Order | `bcm_SortOrder__c` | Number (6, 0 decimal) | Required |
| External ID | `bcm_ExternalId__c` | Text (255) | Unique, External ID, used for upsert |
| Definition | `bcm_Definition__c` | Rich Text Area (32768) | Optional |
| Strategy Support | `bcm_StrategySupport__c` | Rich Text Area (32768) | Optional |
| Architectural Nuance | `bcm_ArchitecturalNuance__c` | Rich Text Area (32768) | Optional |

**Relationships:**
- `bcm_Map__c` lookup: `Lookup` (not Master-Detail) — allows map deletion without cascading capability deletion; `deleteConstraint: Restrict`
- `bcm_Parent__c` lookup: `Lookup` (not Master-Detail) — self-referencing hierarchy; `deleteConstraint` **must be `SetNull`** — Salesforce does not allow `Restrict` or `Cascade` on self-referencing lookup fields (deployment error if either is used)

**Validation Rules:**
- `bcm_Level__c` must be 1, 2, or 3
- If `bcm_Parent__c` is null, `bcm_Level__c` must be 1
- If `bcm_Parent__c` is populated, `bcm_Level__c` must be 2 or 3

### bcm_Tag__c
A named, coloured label applied to Capabilities for visualisation grouping.

| Field | API Name | Type | Attributes |
|---|---|---|---|
| Name | `Name` | Standard Text | Required, unique |
| Colour | `bcm_Colour__c` | Text (7) | Required, format: `#RRGGBB` |

**Validation Rule:**
- `bcm_Colour__c` must match regex `#[0-9A-Fa-f]{6}`

### bcm_CapabilityTag__c
Junction object linking Capabilities to Tags. A Capability may have many Tags.

| Field | API Name | Type | Attributes |
|---|---|---|---|
| Capability | `bcm_Capability__c` | Master-Detail → `bcm_Capability__c` | Required |
| Tag | `bcm_Tag__c` | Master-Detail → `bcm_Tag__c` | Required |

**Note:** Both relationships are Master-Detail so junction records are deleted when either parent is deleted. The combination of `bcm_Capability__c` + `bcm_Tag__c` should be unique (duplicate rule or validation).

## Indexes and Performance
- `bcm_ExternalId__c` is an External ID field — automatically indexed by Salesforce
- `bcm_Map__c` on `bcm_Capability__c` — add a custom index via Salesforce Support if data volume exceeds 100k records (unlikely for a capability map, but noted)
- `bcm_Parent__c` — automatically indexed as a lookup relationship field
- `bcm_Level__c` and `bcm_SortOrder__c` — not indexed; queries always filter by `bcm_Map__c` first, so full scans are bounded

## Object Permissions Summary

| Object | bcm_Viewer | bcm_Editor |
|---|---|---|
| `bcm_Map__c` | Read | Read, Create, Edit |
| `bcm_Capability__c` | Read | Read, Create, Edit, Delete |
| `bcm_Tag__c` | Read | Read, Create, Edit, Delete |
| `bcm_CapabilityTag__c` | Read | Read, Create, Edit, Delete |
