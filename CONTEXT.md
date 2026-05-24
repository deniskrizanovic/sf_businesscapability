# Business Capability Map — Domain Glossary

## Business Capability
A named, persistent ability the business has, independent of organisational structure or technology. Defined in BABOK terms: capabilities describe what the business does, not how it is organised or delivered. Every node in the diagram — at every level — is a Business Capability.

Capabilities are hierarchical. A root-level Capability (no parent) is a Level 1 Capability. Its children are Level 2, and their children are Level 3. Level is stored explicitly on each record, not derived at query time.

A Capability belongs to at most one parent. Many-to-many parenting is out of scope.

## Level
An integer (1, 2, or 3) stored on each `bcm_Capability__c` record indicating its depth in the capability hierarchy. Level 1 is the root. When a Capability is reparented, Level is recalculated and written to the moved node and all its descendants in the same operation.

Level determines how a Capability is rendered in the diagram:
- **Level 1:** Chevron/arrow shape across the top of the diagram column
- **Level 2:** Rounded rectangle box, stacked vertically within its column
- **Level 3:** Bulleted list item rendered below its parent Level 2 box

## Tag
A named label that can be applied to any Capability to support categorisation and visualisation. Tags have no hierarchy. A Capability may carry multiple Tags. Each Tag carries a stored hex colour (`bcm_Colour__c`, e.g. `#FF5733`) set by an admin on the tag record.

The diagram toolbar has a single-tag combobox. Selecting a Tag highlights all Capabilities carrying that Tag using the Tag's stored colour. Selecting "None" clears the highlight.

Tags replace status flags and freeform colour choices. The `[NEW]` and `[MODIFIED]` markers in the source data are Tags. Tags are org-wide — not scoped to a single Map.

## Sort Order
A sequential integer (1, 2, 3...) stored on each `bcm_Capability__c` record indicating its position among siblings (Capabilities sharing the same parent). When a Capability is reordered or reparented via drag-and-drop, the Sort Order of all affected siblings is rewritten in full from 1. Gaps and fractional values are not used.

## Diagram
The SVG-based Lightning Web Component (`bcm_CapabilityMap`) that renders the full Capability hierarchy. The diagram is the primary interface for viewing and structurally editing the Capability map.

Diagram interactions:
- **Drag-and-drop:** Reorders siblings or reparents a Capability to a different parent at the same level. Cross-level moves (changing a node's level via drag) are not supported — use data editing instead.
- **Zoom and scroll:** Supported within the component.
- **Left-click context menu:** Available on every node; actions to be defined.
- **Colorise by tag:** Highlights all Capabilities carrying a selected Tag.

## Map
A named container for a set of Business Capabilities. All `bcm_Capability__c` records belong to exactly one Map. Multiple Maps can exist in the same org — each represents an independent capability model (e.g. different business units, different versions, different clients).

The `bcm_CapabilityMap` LWC renders one Map at a time, selected by the user from the Maps list view.

## Import
The mechanism for loading Capability data into Salesforce. Source format is a nested JSON tree with a top-level `mapName` property that identifies which Map the capabilities belong to. Import is performed via the `bcm_ImportUtility` LWC: an admin pastes JSON into a textarea and triggers an Apex upsert. The importer creates or matches the named Map, then upserts all Capabilities into it. Upsert matching uses `bcm_ExternalId__c`.

## External ID
A unique text identifier (`bcm_ExternalId__c`) on each `bcm_Capability__c` record used to match records during import upsert operations. Assigned in the JSON source data. Not displayed in the diagram.

## Rendering Mode
A per-level configuration that controls whether a group of Capabilities is rendered as boxes or as a bulleted list. The default is: Level 1 = chevron, Level 2 = box, Level 3 = list. Individual parent Capabilities may override the rendering of their children.

## Permission Sets
Two Permission Sets control access to the application:
- `bcm_Viewer` — read-only access; cannot trigger drag-drop or reparenting operations
- `bcm_Editor` — full access including structural changes via drag-drop; drag handles are hidden from Viewers

## Diagram Page
A standalone Lightning App Page (full-width) hosting the `bcm_CapabilityMap` LWC. A map selector combobox at the top of the page allows the user to switch between Maps without leaving the page. This is the primary interface for the application.

## LWC Components
- `bcm_CapabilityMap` — parent component; owns map selector, data loading, SVG viewport, zoom/pan via `<g transform>`, and layout calculation
- `bcm_CapabilityNode` — child component; renders a single Capability as chevron, box, or bullet depending on Level; owns drag handle and emits `nodedrop` and `nodeclick` events
- `bcm_ContextMenu` — shell component; renders on left-click of any node; no actions in v1, structured for future extension
- `bcm_ImportUtility` — admin component; textarea for JSON paste, Import button, calls Apex upsert controller
