# COSMIC Functional Size Measurement

**Method:** COSMIC v5.0 (ISO 19761)
**Scope:** Business Capability Map — full application (new development, v1)
**Purpose:** Estimate functional size to support project planning and estimation
**Date:** 2026-05-25
**Source artefacts:** `docs/design/01-data-model.md` through `06-app-structure.md`

---

## 1. Measurement Strategy

### 1.1 Functional Users

| Functional User                          | Type                                                                           | Interaction                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| BCM Editor                               | Human                                                                          | Triggers import, drag-drop reorder/reparent, map selection |
| BCM Viewer                               | Human                                                                          | Triggers map selection, diagram view, tag highlight        |
| Salesforce Platform (persistent storage) | Not a functional user — on the software side of the boundary per Rule 7 Note 2 |

> Rule 7 Note 2: "persistent storage is on the software side of the boundary, it is not considered to be a functional user."

### 1.2 Software Boundary

Single Salesforce application layer. The boundary separates:

- **Inside:** All Apex controllers, LWC components, and Salesforce persistent storage (objects)
- **Outside:** The human users (Editor / Viewer) who interact via the Lightning UI

### 1.3 Data Groups (Objects of Interest)

Per Rules 11 and 3.3.1 (Part 2), each persistent object maps to one data group:

| #   | Data Group    | Persistent Object      | Key Attributes                                                                                        |
| --- | ------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| DG1 | Map           | `bcm_Map__c`           | Name, Description                                                                                     |
| DG2 | Capability    | `bcm_Capability__c`    | Name, MapId, ParentId, Level, SortOrder, ExternalId, Definition, StrategySupport, ArchitecturalNuance |
| DG3 | Tag           | `bcm_Tag__c`           | Name, Colour                                                                                          |
| DG4 | CapabilityTag | `bcm_CapabilityTag__c` | CapabilityId, TagId                                                                                   |

All four are Internal data groups (persistent storage is inside the software boundary). There are no External Interface Files — the application has no outbound interfaces to peer systems.

### 1.4 Error/Confirmation Messages

Per Part 2 guidance on Rules 16-19(a): one Exit is identified per functional process for all error/confirmation messages from all possible causes according to the FUR. Platform-generated CRUD errors (validation failures, DML exceptions surfaced to the user) are within the FUR scope — they are implied by the permission sets and object-tab definitions that form the FUR and are not excluded by §2.6.3 (which applies only to messages the FUR does not require the software to process, e.g. OS-level printer errors). Every functional process that performs a Write therefore carries one additional Exit for error/confirmation messages, separate from any data Exit.

Exception: FP4 (Import) — `bcm_ImportResult` bundles success counts and failure data as a single object of interest; the existing Exit covers both the data and the error indication per §2.6.2.

---

## 2. Functional Processes

### Note on client-side-only processes

Processes that involve no data movement across the software boundary and no persistent storage access are **not measurable functional processes** under COSMIC. Rule 10(b) requires a triggering Entry; Rule 10(c) requires at least one Entry plus a Write or Exit. Purely in-memory client computations (SVG layout calculation, zoom/pan state) contain no such data movements.

The following are excluded from the count on this basis:

- SVG diagram layout calculation (pure in-memory JS, no Entry/Exit/Read/Write)
- Zoom and pan state changes (no persistent storage, no Exit carrying data about an object of interest)
- Context menu display in v1 (placeholder only, carries no data about an object of interest per §3.3.3 Part 2)
- Tag colour-highlight rendering (client-side filter on already-loaded data, no new data movement)

---

## 3. Data Movement Breakdown

### FP1 — Load Map List

**Trigger:** Human Viewer/Editor selects the Map page (UI load event)
**FUR source:** `05-lwc-architecture.md` — `getMaps()` wire call

| #   | Movement                               | Type | Data Group | Notes                                                                 |
| --- | -------------------------------------- | ---- | ---------- | --------------------------------------------------------------------- |
| 1   | Receive page-load/map-selector trigger | E    | Map        | Triggering entry; user action to open/refresh the map selector        |
| 2   | Read all Maps from storage             | R    | Map        | `getMaps` SOQL: `SELECT Id, Name, bcm_Description__c FROM bcm_Map__c` |
| 3   | Send Map list to UI                    | X    | Map        | Combobox options rendered to human user                               |

**FP1 size = 3 CFP**

---

### FP2 — Load Capabilities for Selected Map

**Trigger:** Human selects a Map in the combobox
**FUR source:** `05-lwc-architecture.md` — `getCapabilities(mapId)` imperative call

| #   | Movement                        | Type | Data Group    | Notes                                                                                                                |
| --- | ------------------------------- | ---- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Receive selected Map Id         | E    | Map           | Triggering entry — the chosen Map Id crosses the boundary                                                            |
| 2   | Read Capabilities for Map       | R    | Capability    | Main query filtered by `bcm_Map__c`                                                                                  |
| 3   | Read CapabilityTags (sub-query) | R    | CapabilityTag | Sub-select `bcm_CapabilityTags__r` — different data group, separate Read per Rule 14                                 |
| 4   | Read Tags via sub-query         | R    | Tag           | `bcm_Tag__r.Name`, `bcm_Tag__r.bcm_Colour__c` — Tag attributes are a different object of interest from CapabilityTag |
| 5   | Send Capability tree to UI      | X    | Capability    | Diagram data rendered to human user                                                                                  |

> Rule 14 / Guidance on Rules 13–14 (Part 2): different objects of interest moved in the same functional process each require a separate data movement.

**FP2 size = 5 CFP**

---

### FP3 — Load Tag List (Toolbar Combobox)

**Trigger:** Human Viewer/Editor opens the Map page (same page-load as FP1, but `getTags` is a separate wire — distinct triggering event per Rule 10 Note 3)
**FUR source:** `05-lwc-architecture.md` — `getTags()` wire call

| #   | Movement                  | Type | Data Group | Notes                                            |
| --- | ------------------------- | ---- | ---------- | ------------------------------------------------ |
| 1   | Receive page-load trigger | E    | Tag        | Triggering entry for the tag-list load           |
| 2   | Read all Tags             | R    | Tag        | `SELECT Id, Name, bcm_Colour__c FROM bcm_Tag__c` |
| 3   | Send Tag list to UI       | X    | Tag        | "Colour by Tag" combobox options                 |

**FP3 size = 3 CFP**

---

### FP4 — Import Capability Map from JSON

**Trigger:** Human Editor pastes JSON and clicks "Import"
**FUR source:** `02-import.md` — `bcm_ImportController.importCapabilities(String jsonPayload)`

This is a complex functional process. The JSON payload crosses the boundary as a single Entry carrying multiple objects of interest; however, per Rule 13/14 and Guidance on Rules 13–14, data describing _different_ objects of interest within the same functional process each requires a separate Entry.

In this case the JSON is a single string from the user's perspective (one data group from one functional user), not multiple separately-identified entries — the parsing is internal data manipulation, not a boundary crossing. One Entry covers the full JSON payload.

Subsequent Reads are needed for upsert (match-before-write), and Writes cover each distinct persistent object modified.

| #   | Movement                                       | Type | Data Group    | Notes                                                                                                                                                                                         |
| --- | ---------------------------------------------- | ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Receive JSON payload                           | E    | Map           | Triggering entry; JSON string carries map + capability + tag data — one crossing of the boundary from the human user                                                                          |
| 2   | Read existing Map (upsert match)               | R    | Map           | Check for existing `bcm_Map__c` by Name                                                                                                                                                       |
| 3   | Write Map                                      | W    | Map           | Upsert `bcm_Map__c`                                                                                                                                                                           |
| 4   | Read existing Tags (upsert match)              | R    | Tag           | Collect unique tag names, query existing `bcm_Tag__c`                                                                                                                                         |
| 5   | Write Tags                                     | W    | Tag           | Upsert `bcm_Tag__c` records                                                                                                                                                                   |
| 6   | Read existing Capabilities (upsert match)      | R    | Capability    | Query by `bcm_ExternalId__c` for upsert                                                                                                                                                       |
| 7   | Write Capabilities (first pass — no parent)    | W    | Capability    | Upsert flat list without parent links                                                                                                                                                         |
| 8   | Write Capabilities (second pass — set parents) | W    | Capability    | Update `bcm_Parent__c` — FUR explicitly require two writes (step 4 then step 6 in `02-import.md`); Rule 14 permits separate count when FUR explicitly require data to be moved more than once |
| 9   | Write CapabilityTags (delete old junctions)    | W    | CapabilityTag | Delete existing junctions before re-import — Rule 20: delete = Write                                                                                                                          |
| 10  | Write CapabilityTags (insert new junctions)    | W    | CapabilityTag | Insert new junction records — Rule 14: FUR explicitly require delete then insert, two distinct Writes                                                                                         |
| 11  | Send import result to UI                       | X    | Map           | `bcm_ImportResult` (counts of inserted/updated/failed) sent to human user                                                                                                                     |

**FP4 size = 11 CFP**

---

### FP5 — Reorder Capabilities (Same Parent)

**Trigger:** Human Editor completes a drag-drop within the same parent
**FUR source:** `04-drag-drop.md` — `bcm_DragDropController.reorderCapabilities(List<Id> orderedIds)`

| #   | Movement                                    | Type | Data Group | Notes                                                                              |
| --- | ------------------------------------------- | ---- | ---------- | ---------------------------------------------------------------------------------- |
| 1   | Receive ordered Id list                     | E    | Capability | Triggering entry — the new sequence from the human Editor                          |
| 2   | Read Capabilities (fetch records to update) | R    | Capability | Fetch the sibling records to set SortOrder                                         |
| 3   | Write updated SortOrder                     | W    | Capability | Writes `bcm_SortOrder__c` 1, 2, 3… to each sibling                                 |
| 4   | Send confirmation / updated diagram data    | X    | Capability | Optimistic update on client; server Exit confirms success or triggers revert toast |
| 5   | Send error/confirmation message to UI       | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope      |

**FP5 size = 5 CFP**

---

### FP6 — Reparent Capability (Cross-Parent)

**Trigger:** Human Editor drops a node onto a different parent
**FUR source:** `04-drag-drop.md` — `bcm_DragDropController.reparentCapability(Id, Id, List<Id>, List<Id>)`

| #   | Movement                                                                           | Type | Data Group | Notes                                                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Receive reparent command (capabilityId, newParentId, newSiblingIds, oldSiblingIds) | E    | Capability | Triggering entry                                                                                                              |
| 2   | Read moved Capability                                                              | R    | Capability | Fetch the moved node to determine current level and parent                                                                    |
| 3   | Read descendants of moved node                                                     | R    | Capability | Query children for level recalculation — different occurrence set, but same data group: one Read per Rule 15                  |
| 4   | Write moved Capability (new parent + level)                                        | W    | Capability | Update `bcm_Parent__c` and `bcm_Level__c` on the moved node                                                                   |
| 5   | Write descendant levels                                                            | W    | Capability | Update `bcm_Level__c` on all descendants — FUR explicitly requires this as a separate update pass                             |
| 6   | Write new sibling SortOrder                                                        | W    | Capability | Rewrite `bcm_SortOrder__c` for new parent's children list — FUR explicitly require reordering both old and new sibling groups |
| 7   | Write old sibling SortOrder                                                        | W    | Capability | Rewrite `bcm_SortOrder__c` for old parent's remaining children                                                                |
| 8   | Send confirmation / updated diagram data                                           | X    | Capability | Confirms success or triggers revert                                                                                           |
| 9   | Send error/confirmation message to UI                                              | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope                                                 |

> Rule 14 / Guidance on Rules 13–14 Part 2 case (c): FUR explicitly require data describing the same object of interest (Capability) to be written more than once in the same functional process, so each distinct write pass is counted separately.

**FP6 size = 9 CFP**

---

## 4. Standard Record Management Functional Processes

Standard Salesforce Object Tabs expose Create, Read, Update, and Delete operations via the platform UI. These are in scope because the FUR (permission sets in `06-app-structure.md`) explicitly grant Editor users Create/Edit/Delete on these objects, and the Object Tabs provide the triggering UI surface.

FP8 and FP24 (open blank form) count separately from FP9/FP25 (save) because they are triggered by distinct user events — clicking "New" vs. clicking "Save" — satisfying Rule 10(b) independently.

> Note: FP1 (Load Map combobox) and FP3 (Load Tag toolbar combobox) are **not** duplicated here — they serve a different context (diagram toolbar wire calls) with distinct triggering events from the Object Tab list views.

---

### 4.1 bcm_Map\_\_c Management

No Object Tab exists for Map (not listed in `06-app-structure.md` tab table), but Editor permissions include Create/Edit/Delete on `bcm_Map__c`. These FPs represent direct record management accessible to Editors.

#### FP7 — View Map Detail

**Trigger:** Editor clicks a Map record link

| #   | Movement              | Type | Data Group | Notes                   |
| --- | --------------------- | ---- | ---------- | ----------------------- |
| 1   | Receive Map Id        | E    | Map        | Triggering entry        |
| 2   | Read Map record       | R    | Map        | Fetch Name, Description |
| 3   | Send Map detail to UI | X    | Map        | Display record fields   |

**FP7 size = 3 CFP**

---

#### FP8 — Create Map — Open Blank Form

**Trigger:** Editor clicks "New" (blank record form)

| #   | Movement              | Type | Data Group | Notes                                                     |
| --- | --------------------- | ---- | ---------- | --------------------------------------------------------- |
| 1   | Receive "New" command | E    | Map        | Triggering entry                                          |
| 2   | Send blank form to UI | X    | Map        | Empty form displayed; no Read required (no existing data) |

**FP8 size = 2 CFP**

---

#### FP9 — Create Map — Save New Record

**Trigger:** Editor clicks "Save" on the new Map form

| #   | Movement                                 | Type | Data Group | Notes                                                                         |
| --- | ---------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive new Map data (Name, Description) | E    | Map        | Triggering entry                                                              |
| 2   | Write new Map record                     | W    | Map        | INSERT `bcm_Map__c`                                                           |
| 3   | Send confirmation / record Id to UI      | X    | Map        | Redirect to new record detail                                                 |
| 4   | Send error/confirmation message to UI    | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP9 size = 4 CFP**

---

#### FP10 — Edit Map — Load Form

**Trigger:** Editor clicks "Edit" on an existing Map

| #   | Movement                  | Type | Data Group | Notes                    |
| --- | ------------------------- | ---- | ---------- | ------------------------ |
| 1   | Receive Map Id            | E    | Map        | Triggering entry         |
| 2   | Read Map record           | R    | Map        | Pre-populate form fields |
| 3   | Send populated form to UI | X    | Map        | Edit form rendered       |

**FP10 size = 3 CFP**

---

#### FP11 — Edit Map — Save Changes

**Trigger:** Editor clicks "Save" on the edit form

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive updated Map data              | E    | Map        | Triggering entry                                                              |
| 2   | Write updated Map record              | W    | Map        | UPDATE `bcm_Map__c`                                                           |
| 3   | Send confirmation to UI               | X    | Map        | Updated record displayed                                                      |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP11 size = 4 CFP**

---

#### FP12 — Delete Map

**Trigger:** Editor clicks "Delete" on a Map record

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive delete confirmation           | E    | Map        | Triggering entry (confirmation dialog submit)                                 |
| 2   | Read Map record                       | R    | Map        | Verify record exists before delete                                            |
| 3   | Write (delete) Map record             | W    | Map        | DELETE `bcm_Map__c` — Rule 20: delete = Write                                 |
| 4   | Send confirmation to UI               | X    | Map        | Redirect to list / success toast                                              |
| 5   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP12 size = 5 CFP**

---

### 4.2 bcm_Capability\_\_c Object Tab

Object Tab defined in `06-app-structure.md`. List view default columns: Name, Level, Map, Parent, SortOrder.

#### FP13 — View Capability List

**Trigger:** Editor/Viewer opens the Capabilities tab

| #   | Movement                   | Type | Data Group | Notes                                                                |
| --- | -------------------------- | ---- | ---------- | -------------------------------------------------------------------- |
| 1   | Receive list request       | E    | Capability | Triggering entry                                                     |
| 2   | Read Capabilities          | R    | Capability | All visible fields (Name, Level, SortOrder)                          |
| 3   | Read Maps (for Map column) | R    | Map        | Lookup display value — separate object of interest per §3.3.1 Part 2 |
| 4   | Send Capability list to UI | X    | Capability | List view rendered                                                   |

**FP13 size = 4 CFP**

---

#### FP14 — View Capability Detail

**Trigger:** Editor/Viewer clicks a Capability record

| #   | Movement                           | Type | Data Group    | Notes                                                             |
| --- | ---------------------------------- | ---- | ------------- | ----------------------------------------------------------------- |
| 1   | Receive Capability Id              | E    | Capability    | Triggering entry                                                  |
| 2   | Read Capability record             | R    | Capability    | All fields incl. Definition, StrategySupport, ArchitecturalNuance |
| 3   | Read Map (lookup display)          | R    | Map           | Map name for the Map field                                        |
| 4   | Read CapabilityTags (related list) | R    | CapabilityTag | Related list records                                              |
| 5   | Read Tags (via CapabilityTag)      | R    | Tag           | Tag Name, Colour — different object of interest                   |
| 6   | Send Capability detail to UI       | X    | Capability    | Full record + related list rendered                               |

> `bcm_Parent__c` is a self-reference to bcm_Capability\_\_c (DG2) — no additional Read beyond #2 per Rule 15 (same data group, same functional process occurrence).

**FP14 size = 6 CFP**

---

#### FP15 — Create Capability — Open Form

**Trigger:** Editor clicks "New" on the Capabilities tab or related list

| #   | Movement                                 | Type | Data Group | Notes                                    |
| --- | ---------------------------------------- | ---- | ---------- | ---------------------------------------- |
| 1   | Receive "New" command                    | E    | Capability | Triggering entry                         |
| 2   | Read Maps (for Map lookup field options) | R    | Map        | Lookup field must present available Maps |
| 3   | Send blank form to UI                    | X    | Capability | Form rendered with Map lookup options    |

**FP15 size = 3 CFP**

---

#### FP16 — Create Capability — Save

**Trigger:** Editor clicks "Save" on the new Capability form

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive new Capability data           | E    | Capability | Triggering entry                                                              |
| 2   | Write new Capability record           | W    | Capability | INSERT `bcm_Capability__c`                                                    |
| 3   | Send confirmation to UI               | X    | Capability | Redirect to new record detail                                                 |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP16 size = 4 CFP**

---

#### FP17 — Edit Capability — Load Form

**Trigger:** Editor clicks "Edit" on a Capability record

| #   | Movement                   | Type | Data Group | Notes                            |
| --- | -------------------------- | ---- | ---------- | -------------------------------- |
| 1   | Receive Capability Id      | E    | Capability | Triggering entry                 |
| 2   | Read Capability record     | R    | Capability | Pre-populate all editable fields |
| 3   | Read Maps (for Map lookup) | R    | Map        | Populate Map lookup options      |
| 4   | Send populated form to UI  | X    | Capability | Edit form rendered               |

**FP17 size = 4 CFP**

---

#### FP18 — Edit Capability — Save

**Trigger:** Editor clicks "Save" on the edit form

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive updated Capability data       | E    | Capability | Triggering entry                                                              |
| 2   | Write updated Capability record       | W    | Capability | UPDATE `bcm_Capability__c`                                                    |
| 3   | Send confirmation to UI               | X    | Capability | Updated record displayed                                                      |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP18 size = 4 CFP**

---

#### FP19 — Delete Capability

**Trigger:** Editor clicks "Delete" on a Capability record

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive delete confirmation           | E    | Capability | Triggering entry                                                              |
| 2   | Read Capability record                | R    | Capability | Verify before delete                                                          |
| 3   | Write (delete) Capability record      | W    | Capability | DELETE `bcm_Capability__c` — Rule 20                                          |
| 4   | Send confirmation to UI               | X    | Capability | Redirect / success toast                                                      |
| 5   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

> CapabilityTag cascade-delete is Salesforce platform behaviour (Master-Detail), not a measured Write — it is not driven by FUR.

**FP19 size = 5 CFP**

---

#### FP20 — Add Tag to Capability

**Trigger:** Editor adds a Tag via the Capability's Tags related list

| #   | Movement                                 | Type | Data Group    | Notes                                                                         |
| --- | ---------------------------------------- | ---- | ------------- | ----------------------------------------------------------------------------- |
| 1   | Receive Capability Id + Tag selection    | E    | CapabilityTag | Triggering entry                                                              |
| 2   | Read Capability (validate parent exists) | R    | Capability    | Confirm the parent Capability record                                          |
| 3   | Read Tags (for tag picker options)       | R    | Tag           | List of available Tags for selection                                          |
| 4   | Write new CapabilityTag junction         | W    | CapabilityTag | INSERT `bcm_CapabilityTag__c`                                                 |
| 5   | Send confirmation to UI                  | X    | CapabilityTag | Related list refreshed                                                        |
| 6   | Send error/confirmation message to UI    | X    | —             | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP20 size = 6 CFP**

---

#### FP21 — Remove Tag from Capability

**Trigger:** Editor deletes a CapabilityTag record from the related list

| #   | Movement                              | Type | Data Group    | Notes                                                                         |
| --- | ------------------------------------- | ---- | ------------- | ----------------------------------------------------------------------------- |
| 1   | Receive CapabilityTag Id              | E    | CapabilityTag | Triggering entry                                                              |
| 2   | Read CapabilityTag record             | R    | CapabilityTag | Verify before delete                                                          |
| 3   | Write (delete) CapabilityTag          | W    | CapabilityTag | DELETE `bcm_CapabilityTag__c` — Rule 20                                       |
| 4   | Send confirmation to UI               | X    | CapabilityTag | Related list refreshed                                                        |
| 5   | Send error/confirmation message to UI | X    | —             | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP21 size = 5 CFP**

---

### 4.3 bcm_Tag\_\_c Object Tab

Object Tab defined in `06-app-structure.md`. List view default columns: Name, Colour.

#### FP22 — View Tag List

**Trigger:** Editor/Viewer opens the Tags tab

| #   | Movement             | Type | Data Group | Notes                                                  |
| --- | -------------------- | ---- | ---------- | ------------------------------------------------------ |
| 1   | Receive list request | E    | Tag        | Triggering entry                                       |
| 2   | Read Tags            | R    | Tag        | Name, Colour — no cross-object lookups in list columns |
| 3   | Send Tag list to UI  | X    | Tag        | List view rendered                                     |

**FP22 size = 3 CFP**

---

#### FP23 — View Tag Detail

**Trigger:** Editor/Viewer clicks a Tag record

| #   | Movement                              | Type | Data Group    | Notes                                             |
| --- | ------------------------------------- | ---- | ------------- | ------------------------------------------------- |
| 1   | Receive Tag Id                        | E    | Tag           | Triggering entry                                  |
| 2   | Read Tag record                       | R    | Tag           | Name, Colour                                      |
| 3   | Read CapabilityTags (related list)    | R    | CapabilityTag | Junction records linking this Tag to Capabilities |
| 4   | Read Capabilities (via CapabilityTag) | R    | Capability    | Capability names displayed in related list        |
| 5   | Send Tag detail to UI                 | X    | Tag           | Record + related list rendered                    |

**FP23 size = 5 CFP**

---

#### FP24 — Create Tag — Open Blank Form

**Trigger:** Editor clicks "New" on the Tags tab

| #   | Movement              | Type | Data Group | Notes                    |
| --- | --------------------- | ---- | ---------- | ------------------------ |
| 1   | Receive "New" command | E    | Tag        | Triggering entry         |
| 2   | Send blank form to UI | X    | Tag        | No existing data to Read |

**FP24 size = 2 CFP**

---

#### FP25 — Create Tag — Save

**Trigger:** Editor clicks "Save" on the new Tag form

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive new Tag data (Name, Colour)   | E    | Tag        | Triggering entry                                                              |
| 2   | Write new Tag record                  | W    | Tag        | INSERT `bcm_Tag__c`                                                           |
| 3   | Send confirmation to UI               | X    | Tag        | Redirect to new record detail                                                 |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP25 size = 4 CFP**

---

#### FP26 — Edit Tag — Load Form

**Trigger:** Editor clicks "Edit" on a Tag record

| #   | Movement                  | Type | Data Group | Notes                     |
| --- | ------------------------- | ---- | ---------- | ------------------------- |
| 1   | Receive Tag Id            | E    | Tag        | Triggering entry          |
| 2   | Read Tag record           | R    | Tag        | Pre-populate Name, Colour |
| 3   | Send populated form to UI | X    | Tag        | Edit form rendered        |

**FP26 size = 3 CFP**

---

#### FP27 — Edit Tag — Save

**Trigger:** Editor clicks "Save" on the edit form

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive updated Tag data              | E    | Tag        | Triggering entry                                                              |
| 2   | Write updated Tag record              | W    | Tag        | UPDATE `bcm_Tag__c`                                                           |
| 3   | Send confirmation to UI               | X    | Tag        | Updated record displayed                                                      |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

**FP27 size = 4 CFP**

---

#### FP28 — Delete Tag

**Trigger:** Editor clicks "Delete" on a Tag record

| #   | Movement                              | Type | Data Group | Notes                                                                         |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| 1   | Receive delete confirmation           | E    | Tag        | Triggering entry                                                              |
| 2   | Read Tag record                       | R    | Tag        | Verify before delete                                                          |
| 3   | Write (delete) Tag record             | W    | Tag        | DELETE `bcm_Tag__c` — Rule 20                                                 |
| 4   | Send confirmation to UI               | X    | Tag        | Redirect / success toast                                                      |
| 5   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope |

> CapabilityTag cascade-delete is Salesforce platform behaviour (Master-Detail), not a measured Write.

**FP28 size = 5 CFP**

---

### FP29 — View Capability Detail via Panel

**Trigger:** Editor/Viewer second-clicks a focused node in `bcm_CapabilityMap` (1st click focuses, 2nd opens panel)  
**FUR source:** `docs/plans/2026-06-02-09:48-capability-detail-panel.md` — `getCapabilityDetail(capabilityId)`  
Distinct from FP14 (standard Capability record page) — different triggering surface (2nd click on focused diagram node vs Object Tab click) and different UI Exit (`bcm_CapabilityDetail` panel vs platform record page).

| #   | Movement                                     | Type | Data Group    | Notes                                                           |
| --- | -------------------------------------------- | ---- | ------------- | --------------------------------------------------------------- |
| 1   | Receive capability Id (2nd-click viewdetail) | E    | Capability    | Triggering entry — Id crosses software boundary from human user |
| 2   | Read Capability record                       | R    | Capability    | All fields incl. rich text                                      |
| 3   | Read CapabilityTags (sub-query)              | R    | CapabilityTag | Tags\_\_r subquery — different object of interest per Rule 14   |
| 4   | Read Tags (via CapabilityTag)                | R    | Tag           | Name + Colour for swatches — different object of interest       |
| 5   | Send Capability detail to panel UI           | X    | Capability    | Rendered in bcm_CapabilityDetail                                |

**FP29 size = 5 CFP**

---

### FP30 — Edit Capability via Panel — Save

**Trigger:** Editor clicks Save in the detail panel  
**FUR source:** `docs/plans/2026-06-02-09:48-capability-detail-panel.md` — `updateCapability(capability)`  
Distinct from FP18 (standard record edit form save) — different triggering surface (LWC panel Save button vs platform form Save button) and different functional user interaction context.

| #   | Movement                              | Type | Data Group | Notes                                                                                                                   |
| --- | ------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Receive updated Capability data       | E    | Capability | Triggering entry — field values from human Editor cross boundary                                                        |
| 2   | Write updated Capability record       | W    | Capability | UPDATE via bcm_CapabilityService                                                                                        |
| 3   | Send confirmation to UI               | X    | Capability | Panel shows saved values; diagram re-load triggered (FP2 re-trigger is a separate functional process, not counted here) |
| 4   | Send error/confirmation message to UI | X    | —          | §2.6.1: one error/conf Exit per FP; platform CRUD errors are within FUR scope                                           |

**FP30 size = 4 CFP**

---

## 5. Summary Table

| FP        | Functional Process                 | E      | X      | R      | W      | CFP     |
| --------- | ---------------------------------- | ------ | ------ | ------ | ------ | ------- |
| FP1       | Load Map List (combobox)           | 1      | 1      | 1      | 0      | 3       |
| FP2       | Load Capabilities for Selected Map | 1      | 1      | 3      | 0      | 5       |
| FP3       | Load Tag List (toolbar)            | 1      | 1      | 1      | 0      | 3       |
| FP4       | Import Capability Map from JSON    | 1      | 1      | 3      | 6      | 11      |
| FP5       | Reorder Capabilities (same parent) | 1      | 2      | 1      | 1      | 5       |
| FP6       | Reparent Capability (cross-parent) | 1      | 2      | 2      | 4      | 9       |
| FP7       | View Map Detail                    | 1      | 1      | 1      | 0      | 3       |
| FP8       | Create Map — open form             | 1      | 1      | 0      | 0      | 2       |
| FP9       | Create Map — save                  | 1      | 2      | 0      | 1      | 4       |
| FP10      | Edit Map — load form               | 1      | 1      | 1      | 0      | 3       |
| FP11      | Edit Map — save                    | 1      | 2      | 0      | 1      | 4       |
| FP12      | Delete Map                         | 1      | 2      | 1      | 1      | 5       |
| FP13      | View Capability List               | 1      | 1      | 2      | 0      | 4       |
| FP14      | View Capability Detail             | 1      | 1      | 4      | 0      | 6       |
| FP15      | Create Capability — open form      | 1      | 1      | 1      | 0      | 3       |
| FP16      | Create Capability — save           | 1      | 2      | 0      | 1      | 4       |
| FP17      | Edit Capability — load form        | 1      | 1      | 2      | 0      | 4       |
| FP18      | Edit Capability — save             | 1      | 2      | 0      | 1      | 4       |
| FP19      | Delete Capability                  | 1      | 2      | 1      | 1      | 5       |
| FP20      | Add Tag to Capability              | 1      | 2      | 2      | 1      | 6       |
| FP21      | Remove Tag from Capability         | 1      | 2      | 1      | 1      | 5       |
| FP22      | View Tag List                      | 1      | 1      | 1      | 0      | 3       |
| FP23      | View Tag Detail                    | 1      | 1      | 3      | 0      | 5       |
| FP24      | Create Tag — open form             | 1      | 1      | 0      | 0      | 2       |
| FP25      | Create Tag — save                  | 1      | 2      | 0      | 1      | 4       |
| FP26      | Edit Tag — load form               | 1      | 1      | 1      | 0      | 3       |
| FP27      | Edit Tag — save                    | 1      | 2      | 0      | 1      | 4       |
| FP28      | Delete Tag                         | 1      | 2      | 1      | 1      | 5       |
| FP29      | View Capability Detail via Panel   | 1      | 1      | 3      | 0      | 5       |
| FP30      | Edit Capability via Panel — Save   | 1      | 2      | 0      | 1      | 4       |
| **Total** |                                    | **30** | **44** | **36** | **23** | **133** |

**Total COSMIC Functional Size: 133 CFP**

> **Delivery status:** FP29 delivered in GH issue #22 (2026-06-02). FP30 delivered in GH issue #23 (2026-06-03). FP31 (Hide Capability via Context Menu) removed in GH issue #32 (2026-06-03) — Hide UX subsumed by FP30 via panel edit mode.

---

## 6. Excluded Processes (Not Measurable Under COSMIC)

| Process                                                              | Reason for Exclusion                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVG layout calculation (column positions, box heights)               | Pure in-memory computation; no data movement crosses the software boundary and no persistent storage is accessed. Not a functional process per Rule 10(b)(c).                                                                                                                                                                |
| Zoom / pan state                                                     | In-memory JS tracked properties only; no Entry from a functional user carrying data about an object of interest, no Exit, no Read/Write of persistent storage.                                                                                                                                                               |
| Tag colour-highlight rendering                                       | Client-side filter on already-loaded data (no new Apex call). Data was moved in FP2; re-colouring is internal data manipulation, not a new data movement.                                                                                                                                                                    |
| Context menu display                                                 | The rendering of the menu UI itself carries no data about an object of interest per §3.3.3 Part 2 Guidance. Zero data movements. The "View detail" action click is a measurable triggering event counted in FP29.                                                                                                            |
| Map / Tag / Strategic-Support toggle persistence (sessionStorage)    | Persistent storage write/read for UI state restoration (`selectedMapId` GH #26, `selectedTagId` GH #54, `strategicSupportOn` GH #49); sessionStorage is not a functional user per Rule 7 Note 2. Same exclusion class as zoom/pan state. No new data movement crosses the software boundary.                                 |
| Canvas focus outline suppression                                     | Pure CSS visual styling; no data movement crosses the software boundary. Same exclusion class as zoom/pan visual state.                                                                                                                                                                                                      |
| SVG viewport boundary removal / free pan                             | CSS overflow change + removal of pan clamps; no data movement crosses the software boundary. Same exclusion class as zoom/pan visual state.                                                                                                                                                                                  |
| `bcm_IsCrossCutting__c` field add + L1-only validation rule (GH #29) | New attribute on existing entity (`bcm_Capability__c`); no new functional process. Selector payload widens by one boolean — same data movement classification as the existing `getCapabilities` Read. Validation rule is a constraint on the existing Update/Insert process, not a new process. No new R; no new entity.     |
| Cross-cutting band rendering (GH #30)                                | Pure SVG re-layout of already-loaded capability data; the read of `bcm_IsCrossCutting__c` is part of the existing `getCapabilities` payload (FP2). No new Entry, Exit, Read, or Write. The click-to-open-detail action reuses FP29 (View Capability Detail via Panel) — same data movement, different invocation surface.    |
| Cross-cutting band toggle (GH #31)                                   | UI-only client-state flag controlling DOM rendering of already-loaded capability data. No new Entry, Exit, Read, or Write — same payload as FP2 (`getCapabilities`).                                                                                                                                                         |
| Hide via Context Menu removed (GH #32)                               | Former FP31 deleted with the `bcm_ContextMenu` LWC. Hide UX preserved via the Detail Panel edit flow — same `bcm_HideFromDiagram__c` flip is now part of FP30 (`updateCapability`). No new functional process; previously-counted FP31 (3 CFP) subtracted from the total.                                                    |
| Detail panel anchored to LWC root (GH #41, 2026-06-04)               | Pure CSS/HTML layout restructure. Panel is moved out of the SVG-sized canvas container into a host-anchored wrapper so it never visually clips on small diagrams. No new Entry, Exit, Read, or Write — same data movement as FP29 / FP30.                                                                                    |
| Detail Panel record-page link added (GH #45)                         | New "Open record page" anchor in `bcm_CapabilityDetail` header. URL is generated client-side via `lightning/navigation` `GenerateUrl`; clicking the link triggers FP14 (standard `bcm_Capability__c` record page), already counted. No data movement crosses the software boundary in a new way — no new functional process. |
| `bcm_HideFromDiagram__c` field add                                   | Same class as `bcm_IsCrossCutting__c` — new boolean on existing `bcm_Capability__c`; widens FP2 selector payload, no new functional process.                                                                                                                                                                                 |
| L3 tag colourisation (GH #46)                                        | Pure SVG re-render of already-loaded `bcm_CapabilityTags__r` data; no new Entry/Exit/Read/Write. Same class as L2 highlight.                                                                                                                                                                                                 |
| Keyboard navigation                                                  | In-memory focus + pan state on loaded data; no movement crosses boundary. Same class as zoom/pan.                                                                                                                                                                                                                            |
| Fit-to-window / Reset view                                           | In-memory zoom + pan state mutation; same class as zoom/pan.                                                                                                                                                                                                                                                                 |
| Visual-language refresh (GH #43, 2026-06-10)                         | Tokenised palette + type scale + focus-model swap + strategy-mark glyph swap. No data movement crosses the software boundary. Same exclusion class as canvas focus outline suppression.                                                                                                                                      |

> **Step 7 closeout (2026-06-06):** All step-7 deltas accounted for. Total revised to 133 CFP (was 119) — error/confirmation message Exits added to all write-path FPs per §2.6.1 and Part 2 guidance Rules 16-19(a); FP29 + FP30 already counted, FP31 already removed; the four rows above are exclusions (zero CFP). Step 7 row in implementation tracker: FP1 + FP2 + FP3 + FP29 + FP30 = 19 CFP (read-only FPs, unaffected by error/conf Exit additions).

---

## 7. Citations

All rules cited from the indexed COSMIC v5.0 manuals:

- **Rule 10** (Functional Process identification): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/04-mapping-phase.md#L6-L28`

    > "Each functional process identified in the scope of the FSM shall: a) be derived from at least one identifiable FUR, b) be initiated by an Entry data movement from a functional user informing the functional process that it has detected a triggering event, c) comprise at least two data movements, namely always one Entry plus either an Exit or a Write."

- **Rule 13** (Single Entry per object of interest): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/04-mapping-phase.md#L60-L70`

    > "a single Entry data movement shall be identified and counted for the entry of all data describing a single object of interest that the FUR require to be entered, unless the FUR explicitly require data describing the same single object of interest to be entered more than once in the same functional process."

- **Rule 14** (Single Exit/Read/Write per object of interest): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/04-mapping-phase.md#L72-L80`

    > "Similarly, a single Exit, Read or Write data movement shall be identified and counted for the movement of all data describing a single object of interest that the FUR requires of that type … unless the FUR explicitly require data describing the same single object of interest to be moved more than once in the same functional process by a data movement of the same type."

- **Rule 20** (Delete = Write): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/04-mapping-phase.md#L130-L133`

    > "A requirement to delete a data group from persistent storage shall be a single Write data movement."

- **Rule 21** (1 CFP per data movement): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/05-measurement-phase.md#L1-L10`

    > "A unit of measurement, 1 CFP, shall be assigned to each data movement (Entry, Exit, Read or Write) identified in each functional process."

- **Rule 7 Note 2** (Persistent storage not a functional user): `manuals-indexed/part-1-mm-principles-definitions-rules-v5-0-aug-2021/03-measurement-strategy-phase.md#L72-L83`

    > "persistent storage is on the software side of the boundary, it is not considered to be a functional user of the software being measured."

- **§3.3.3 Part 2** (Data not about an object of interest not counted): `manuals-indexed/part-2-mm-guidelines-v5-0-sep-2024/03-the-mapping-phase.md#L156-L164`
    > "Any data appearing on input or output screens or reports that are not related to an object of interest to a functional user should not be identified as indicating a data group."
