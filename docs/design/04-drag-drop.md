# Plan 04: Drag-Drop Interactions

## Overview
Drag-drop allows users to reorder capabilities within a parent (same parent, new position) or reparent a capability to a different parent at the same level (same level, different parent). Cross-level moves are not supported via drag-drop.

Drag-drop is only active for users with the `bcm_Editor` Permission Set. Drag handles are hidden from `bcm_Viewer` users.

## Draggable Elements
- **L2 boxes** — can be reordered within their L1 column, or dragged to a different L1 column (reparent to a different L1)
- **L1 chevrons** — can be reordered (changing column order) but cannot be reparented (no L0 parent exists)
- **L3 items** — can be reordered within their L2 box, or dragged to a different L2 box at the same level

L3 items cannot be dragged to become L2 boxes, and L2 boxes cannot be dragged to become L3 items.

## Drag Handle
Each draggable element has a small drag handle icon (⠿ or similar) visible on hover. The handle is a `<foreignObject>` containing a small HTML icon, or a simple SVG `<text>` element using a Unicode drag icon. Clicking the handle initiates drag; clicking elsewhere on the node opens the context menu.

## Drag Interaction Flow

### Phase 1: Drag Start
- `mousedown` on drag handle → set `isDragging = true`, record `draggedNodeId`, capture initial mouse position
- Add `mousemove` and `mouseup` listeners to the SVG root
- Render a semi-transparent "ghost" of the dragged element following the cursor (offset by initial grab point)
- Highlight valid drop targets (siblings and valid parent containers)

### Phase 2: Drag Over
- On `mousemove`: update ghost position
- Determine the current drop target:
  - For L2 drag: which L1 column is the cursor over? Which position between siblings?
  - For L3 drag: which L2 box is the cursor over? Which position between siblings?
  - For L1 drag: which position between columns?
- Render a drop indicator line between the target siblings (a horizontal line `<line>` element)

### Phase 3: Drop
- `mouseup` → determine final drop target
- If drop target is same parent, different position → **Reorder**
- If drop target is different parent, same level → **Reparent**
- If drop target is same position as original → cancel (no-op)
- If drop is outside a valid target → cancel (no-op)
- Remove ghost, remove drop indicator, set `isDragging = false`
- Call the appropriate Apex method

### Phase 4: Optimistic Update
- Before the Apex call returns, update the local JS tree state immediately so the diagram re-renders in the new position without waiting for the server
- If Apex returns an error, revert to the pre-drag state and show a toast error

## Apex Methods

### Reorder (same parent, new position)
```apex
@AuraEnabled
public static void reorderCapabilities(List<Id> orderedIds)
```
- `orderedIds`: the complete ordered list of sibling Ids in their new sequence
- Writes `bcm_SortOrder__c` as 1, 2, 3... to each Id in order
- No parent change, no level change

### Reparent (new parent, same level)
```apex
@AuraEnabled
public static void reparentCapability(Id capabilityId, Id newParentId, List<Id> newSiblingIds)
```
- `capabilityId`: the moved capability
- `newParentId`: the new parent Id (null if moved to L1, i.e. reordering root columns)
- `newSiblingIds`: the complete ordered list of the new parent's children after the move (includes the moved node)
- Updates `bcm_Parent__c` on the moved node
- Recalculates `bcm_Level__c` on the moved node and all its descendants (recursive)
- Writes sequential `bcm_SortOrder__c` to all `newSiblingIds`
- Does NOT update sort order of the old parent's remaining siblings — caller must pass a separate `reorderCapabilities` call for the old parent if needed (or handle both in a combined method — see below)

### Combined Reparent + Reorder
To avoid two round-trips, the LWC calls a combined method when reparenting:

```apex
@AuraEnabled
public static void reparentCapability(
    Id capabilityId,
    Id newParentId,
    List<Id> newSiblingIds,
    List<Id> oldSiblingIds
)
```
- `oldSiblingIds`: the remaining siblings in the old parent after removal, in order
- Rewrites sort order for both old and new sibling lists in one transaction

## Level Recalculation on Reparent
When a node is reparented, its level may change (e.g. an L2 moved under a different L1 stays L2 — but the architecture must recalculate descendants). The Apex method:

1. Determines the new level = parent's level + 1
2. Updates the moved node's `bcm_Level__c`
3. Queries all descendants of the moved node (recursive SOQL up to 5 levels, or Apex loop)
4. Recalculates and updates each descendant's level

Given the 3-level cap, a moved L2 node can only have L3 children — one level of descendants at most. The recalculation is a single additional `update` on the child records.

## Permission Guard
The JS controller checks the current user's permission before rendering drag handles:

```js
// In bcm_CapabilityMap connectedCallback
import canEdit from '@salesforce/customPermission/bcm_CanEdit';
// canEdit is true if the user has the bcm_Editor permission set
```

If `canEdit` is false:
- Drag handles are not rendered
- `mousedown` on nodes is ignored for drag purposes
- Context menu still works (read-only actions)

## Error States
- Apex error during reorder/reparent: toast notification "Failed to save changes. Your changes have been reverted.", local state reverted
- Network timeout: same as above
- Concurrent edit (another user moved a node): detected on next page load; no real-time conflict resolution in v1
