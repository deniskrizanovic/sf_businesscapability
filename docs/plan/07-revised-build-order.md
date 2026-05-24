# Plan 07: Revised Build Order

**Supersedes** the Build Order section of `06-app-structure.md`.

## Principle
Build the Salesforce app shell first so every subsequent step is deployable and testable in a real org. Each phase ends with something you can navigate to and interact with.

---

## Already Complete
- Custom Objects: `bcm_Map__c`, `bcm_Capability__c`, `bcm_Tag__c`, `bcm_CapabilityTag__c`
- Custom Fields and Validation Rules on all objects
- Permission Sets: `bcm_Viewer`, `bcm_Editor`
- Apex: `bcm_ImportController` + `bcm_ImportControllerTest`
- LWC: `bcm_ImportUtility`
- FlexiPage: `bcm_ImportPage` + its tab

---

## Phase 1 — App Shell
**Goal:** Deploy the full app structure so you can navigate every tab in the org.

1. Custom Permission: `bcm_CanEdit`
2. Stub Apex read controllers — `getMaps()`, `getCapabilities()`, `getTags()` returning empty lists
   - `bcm_MapController`, `bcm_CapabilityController`, `bcm_TagController`
3. Stub `bcm_CapabilityMap` LWC — renders a toolbar (map selector, tag selector, zoom buttons) wired to the stub Apex, and a placeholder `<div>` where the SVG will go
4. `bcm_MapPage` FlexiPage — full-width, hosts `bcm_CapabilityMap`
5. Lightning Application: `bcm_BusinessCapabilityMap` with all tabs
6. Remaining tabs: Map (Lightning App Page), Capabilities (object tab), Tags (object tab)
7. List Views: `bcm_Capability__c`, `bcm_Tag__c`, `bcm_Map__c`

**Testable after Phase 1:**
- Navigate the full app in Salesforce
- Switch between all tabs
- Import page works end-to-end
- Assign `bcm_Viewer` / `bcm_Editor` and verify tab visibility

---

## Phase 2 — Data Loading
**Goal:** Map selector populates from real data; capabilities load when a map is selected.

8. Implement real `getMaps()`, `getCapabilities(mapId)`, `getTags()` in the Apex controllers
9. Wire `bcm_CapabilityMap` JS to load maps on connect, load capabilities + tags on map selection change
10. Display selected map name and capability count in the placeholder area (no diagram yet)
11. Apex tests for all three controllers

**Testable after Phase 2:**
- Import a JSON payload → switch to Map tab → select the map → confirm capability count shown
- Verify `bcm_Viewer` cannot trigger any write operations (permission guard in place from step 3)

---

## Phase 3 — Static Diagram
**Goal:** SVG diagram renders correctly for a loaded map; read-only.

12. JS tree assembly (flat list → tree with sorted children)
13. JS layout calculation (column positions, box heights, canvas dimensions)
14. SVG rendering in `bcm_CapabilityMap` template: L1 chevrons, L2 boxes, L3 bullets
15. Text wrapping utility (character-width estimate, line breaking)
16. Zoom and pan (`<g transform>`, mouse wheel, drag background, toolbar buttons)

**Testable after Phase 3:**
- Full diagram visible for any imported map
- Zoom and pan work
- Multiple maps can be compared by switching the selector

---

## Phase 4 — Tag Highlight
**Goal:** Colour-by-tag works end-to-end.

17. Tag combobox populates from loaded tags
18. Highlight logic: collect capability IDs carrying selected tag, pass `isHighlighted` to renderer
19. L2 box fill colour driven by tag colour; L3 bullet text weight changes accordingly
20. "None" selection clears all highlights

**Testable after Phase 4:**
- Apply a tag to some capabilities via Import or record edit → select tag in toolbar → verify colour

---

## Phase 5 — Drag-Drop
**Goal:** Editors can reorder and reparent nodes; viewers see no drag handles.

21. `bcm_DragDropController` Apex — `reorderCapabilities`, `reparentCapability` (combined method)
22. Apex tests for `bcm_DragDropController`
23. Drag handle rendering (hidden when `canEdit` is false)
24. Drag start / ghost element / drop indicator line
25. Reorder (same parent) interaction → Apex call → optimistic update
26. Reparent (different parent, same level) interaction → Apex call → optimistic update
27. Error states: toast + revert on Apex failure

**Testable after Phase 5:**
- Reorder L1 columns, L2 boxes, L3 items
- Drag an L2 to a different L1 column
- Confirm `bcm_Viewer` user cannot drag (no handles visible, mousedown ignored)

---

## Phase 6 — Context Menu
**Goal:** Left-click menu shell in place, ready for future actions.

28. `bcm_ContextMenu` LWC — floating div, "No actions available" placeholder, dismiss on click-outside or Escape

**Testable after Phase 6:**
- Left-click any node → menu appears → Escape or outside click → menu closes

---

## Summary Table

| Phase | Ends with |
|---|---|
| 1 — App Shell | Full app navigation, import works |
| 2 — Data Loading | Map selector + capability count live |
| 3 — Static Diagram | Full read-only SVG diagram, zoom/pan |
| 4 — Tag Highlight | Colour-by-tag end-to-end |
| 5 — Drag-Drop | Full structural editing |
| 6 — Context Menu | Menu shell in place |
