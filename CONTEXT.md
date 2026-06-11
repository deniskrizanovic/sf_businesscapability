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

The diagram toolbar has a single-tag combobox. Selecting a Tag highlights matching Capabilities using the Tag's stored colour: Level 2 boxes take the colour as their full fill; Level 3 bullets render a tinted background rectangle behind their text (suppressed when the L3 is focused — focus styling wins). Level 1 chevrons are unaffected by tag selection. Selecting "None" clears the highlight.

Tags replace status flags and freeform colour choices. The `[NEW]` and `[MODIFIED]` markers in the source data are Tags. Tags are org-wide — not scoped to a single Map.

## Cross-cutting Capability

A Level 1 Business Capability flagged as cutting across the rest of the capability model rather than belonging to a single column. Stored as `bcm_IsCrossCutting__c = true` on `bcm_Capability__c` and only valid at Level 1 (validation rule rejects Level 2/3). Cross-cutting L1s and all their L2/L3 descendants are excluded from the regular column layout in the diagram and rendered separately as a Cross-cutting Band.

## Cross-cutting Band

A horizontal stack of full-width chevrons rendered at the bottom of the diagram canvas, one chevron per Cross-cutting Capability. Each chevron spans from the first column to the last and overlaps the row above, exposing only the bottom strip. The capability with the lowest `bcm_SortOrder__c` paints last (DOM-last) so it sits on top of the stack. Labels are uppercased and bottom-left-aligned. Clicking a band chevron opens the Detail Panel via the existing `viewdetail` flow. The band layer pans with the full viewport (both panX and panY), so it scrolls with the rest of the diagram content.

## Sort Order

A sequential integer (1, 2, 3...) stored on each `bcm_Capability__c` record indicating its position among siblings (Capabilities sharing the same parent). When a Capability is reordered or reparented via drag-and-drop, the Sort Order of all affected siblings is rewritten in full from 1. Gaps and fractional values are not used.

## Strategic Support

Free-text rationale stored on `bcm_Capability__c` (`bcm_StrategySupport__c`) explaining how a capability supports business strategy. The diagram offers a Strategic Support toolbar toggle that, when on, marks every capability whose Strategic Support content is non-empty (after stripping HTML and whitespace) with a visual highlight. The highlight is a display option only — it does not change underlying data.

## Diagram

The SVG-based Lightning Web Component (`bcm_CapabilityMap`) that renders the full Capability hierarchy. The diagram is the primary interface for viewing and structurally editing the Capability map.

Diagram interactions:

- **Drag-and-drop:** Reorders siblings or reparents a Capability to a different parent at the same level. Cross-level moves (changing a node's level via drag) are not supported — use data editing instead.
- **Zoom and scroll:** Supported within the component.
- **Left-click context menu:** Available on every node at all levels (L1, L2, L3).
- **Colorise by tag:** Highlights all Capabilities carrying a selected Tag.
- **View detail:** Opens the Detail Panel for any node at any level.

## Detail Panel

A 400px-wide overlay panel that slides in from the right edge of the diagram canvas when the user selects "View detail" from the context menu. The panel displays all fields of the selected Capability and allows inline editing by users with the `bcm_CanEdit` custom permission. Editors see Save and Cancel buttons; Viewers see read-only field values.

The panel remains open across node switches — selecting "View detail" on a different node updates the panel content in place without closing and reopening.

Fields displayed: Name, Level (read-only badge), Tags (read-only colour swatches), Definition, Strategy Support, Architectural Nuance, Hide From Diagram.

After a successful save, the diagram refreshes to reflect any Name or Hide From Diagram changes.

## Breadcrumb

An ordered list of ancestor Capability names from root (Level 1) to the currently selected node, displayed at the top of the Detail Panel. Built client-side from the already-loaded capability tree — no additional server call. Format: `L1 Name > L2 Name > L3 Name`.

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

## Visual Tokens

A single source of truth for diagram-specific colours, type scale, focus model, and strategy-mark glyph metadata. Lives in the `bcm_VisualTokens` LWC bundle as JS exports (`BCM_*`) with a hand-synced CSS mirror (`--bcm-*`) for stylesheet consumers. SLDS owns chrome (toolbar, comboboxes, detail-panel form fields); the tokens module owns the SVG canvas and diagram-specific surfaces. See ADR-0005 and `docs/design/10-visual-language.md` for values and rationale.

## LWC Components

- `bcm_CapabilityMap` — container component; owns map selector, data loading, SVG viewport, zoom/pan via `<g transform>`, layout calculation, and all Apex interaction per ADR 0002
- `bcm_CapabilityNode` — child component; renders a single Capability as chevron, box, or bullet depending on Level; owns drag handle and emits `nodedrop` and `nodeclick` events
- `bcm_CapabilityDetail` — presentational component; receives `capability`, `breadcrumb`, `canEdit`, and `isLoading` as `@api` props; renders Detail Panel; fires `close` and `saved` events to parent. Opened directly by `bcm_CapabilityMap` on the second click of a focused node (no intermediate context menu)
- `bcm_ImportUtility` — admin component; textarea for JSON paste, Import button, calls Apex upsert controller
