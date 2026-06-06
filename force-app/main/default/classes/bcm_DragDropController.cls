/**
 * AuraEnabled controller for drag-drop reorder and reparent operations on
 * bcm_Capability__c records.
 *
 * <p>Both methods require the {@code bcm_CanEdit} custom permission. Callers
 * without it receive an {@link AuraHandledException} with the message
 * "Access denied.".</p>
 *
 * <p>Per ADR 0002, services own DML — but drag-drop is a focused, controller-only
 * surface (no shared business logic) so all writes happen inline here in a single
 * transaction. Trigger + validation rules continue to enforce the L1/L2/L3
 * invariants; platform DML errors are re-thrown as {@link AuraHandledException}.</p>
 */
public with sharing class bcm_DragDropController {

    private static final String ERROR_ACCESS_DENIED = 'Access denied.';
    private static final String ERROR_CROSS_MAP     = 'Cannot move a capability across Maps.';

    /**
     * AuraHandledException strips the constructor message from getMessage() —
     * setMessage() must be called explicitly so the LWC and tests can read it.
     */
    private static AuraHandledException buildAhe(String msg) {
        AuraHandledException e = new AuraHandledException(msg);
        e.setMessage(msg);
        return e;
    }

    /**
     * Rewrites {@code bcm_SortOrder__c} on the supplied capabilities to be
     * sequential 1..N in the order given. Used for sibling reordering when the
     * parent is unchanged.
     *
     * <p>Empty or null input is a silent no-op (no DML, no throw).</p>
     *
     * @param orderedIds  Ids in the desired display order.
     * @example
     * bcm_DragDropController.reorderCapabilities(new List<Id>{ a, b, c });
     */
    @AuraEnabled
    public static void reorderCapabilities(List<Id> orderedIds) {
        if (!FeatureManagement.checkPermission('bcm_CanEdit')) {
            throw buildAhe(ERROR_ACCESS_DENIED);
        }
        if (orderedIds == null || orderedIds.isEmpty()) {
            return;
        }
        try {
            List<bcm_Capability__c> toUpdate = new List<bcm_Capability__c>();
            Integer order = 1;
            for (Id capId : orderedIds) {
                toUpdate.add(new bcm_Capability__c(
                    Id               = capId,
                    bcm_SortOrder__c = order
                ));
                order++;
            }
            update as user toUpdate;
        } catch (Exception ex) {
            throw buildAhe(ex.getMessage());
        }
    }

    /**
     * Reparents a single capability and rewrites {@code bcm_SortOrder__c} on
     * both the old and new sibling lists. Recalculates {@code bcm_Level__c} on
     * the moved node and any descendants so the level stays consistent with
     * its new position in the hierarchy.
     *
     * <p>All writes happen in a single {@code update} call to keep the
     * transaction atomic.</p>
     *
     * @param capabilityId    Id of the capability being moved.
     * @param newParentId     Id of the new parent ({@code null} when moving to root / L1).
     * @param newSiblingIds   Ordered Ids under the new parent (must include capabilityId).
     * @param oldSiblingIds   Ordered Ids remaining under the old parent (capabilityId removed).
     */
    @AuraEnabled
    public static void reparentCapability(
        Id capabilityId,
        Id newParentId,
        List<Id> newSiblingIds,
        List<Id> oldSiblingIds
    ) {
        if (!FeatureManagement.checkPermission('bcm_CanEdit')) {
            throw buildAhe(ERROR_ACCESS_DENIED);
        }
        if (capabilityId == null) {
            throw buildAhe('capabilityId is required');
        }
        try {
            bcm_Capability__c moved = [
                SELECT Id, bcm_Map__c, bcm_Level__c, bcm_Parent__c
                FROM bcm_Capability__c
                WHERE Id = :capabilityId
                WITH USER_MODE
                LIMIT 1
            ];

            Integer newLevel;
            if (newParentId == null) {
                newLevel = 1;
            } else {
                bcm_Capability__c newParent = [
                    SELECT Id, bcm_Map__c, bcm_Level__c
                    FROM bcm_Capability__c
                    WHERE Id = :newParentId
                    WITH USER_MODE
                    LIMIT 1
                ];
                if (newParent.bcm_Map__c != moved.bcm_Map__c) {
                    throw buildAhe(ERROR_CROSS_MAP);
                }
                newLevel = (Integer) newParent.bcm_Level__c + 1;
            }

            Map<Id, bcm_Capability__c> updatesById = new Map<Id, bcm_Capability__c>();

            bcm_Capability__c movedUpdate = new bcm_Capability__c(
                Id            = moved.Id,
                bcm_Parent__c = newParentId,
                bcm_Level__c  = newLevel
            );
            updatesById.put(moved.Id, movedUpdate);

            // Recalculate descendant levels via cascade. SOQL caps at L3 today,
            // but the loop tolerates any future depth change.
            Map<Id, Integer> levelByDescendantId = computeDescendantLevels(moved.Id, newLevel);
            for (Id descId : levelByDescendantId.keySet()) {
                bcm_Capability__c descUpdate = updatesById.containsKey(descId)
                    ? updatesById.get(descId)
                    : new bcm_Capability__c(Id = descId);
                descUpdate.bcm_Level__c = levelByDescendantId.get(descId);
                updatesById.put(descId, descUpdate);
            }

            applySiblingOrder(newSiblingIds, updatesById);
            applySiblingOrder(oldSiblingIds, updatesById);

            if (!updatesById.isEmpty()) {
                List<bcm_Capability__c> toUpdate = updatesById.values();
                update as user toUpdate;
            }
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception ex) {
            throw buildAhe(ex.getMessage());
        }
    }

    /**
     * Recursively builds a map of descendant Ids to their new level, given the
     * moved node's new level. Uses {@code WITH USER_MODE} so users without read
     * access on any descendant cause the operation to fail defense-in-depth
     * (rather than silently producing a partial update).
     */
    private static Map<Id, Integer> computeDescendantLevels(Id rootId, Integer rootNewLevel) {
        Map<Id, Integer> levelById = new Map<Id, Integer>();
        Set<Id> currentParents = new Set<Id>{ rootId };
        Integer parentLevel = rootNewLevel;
        while (!currentParents.isEmpty()) {
            List<bcm_Capability__c> children = [
                SELECT Id, bcm_Parent__c
                FROM bcm_Capability__c
                WHERE bcm_Parent__c IN :currentParents
                WITH USER_MODE
            ];
            if (children.isEmpty()) {
                break;
            }
            Integer childLevel = parentLevel + 1;
            Set<Id> nextParents = new Set<Id>();
            for (bcm_Capability__c child : children) {
                levelById.put(child.Id, childLevel);
                nextParents.add(child.Id);
            }
            currentParents = nextParents;
            parentLevel    = childLevel;
        }
        return levelById;
    }

    /**
     * Writes sequential 1..N {@code bcm_SortOrder__c} to the supplied sibling
     * Ids, merging into any existing pending update for the same Id.
     */
    private static void applySiblingOrder(
        List<Id> siblingIds,
        Map<Id, bcm_Capability__c> updatesById
    ) {
        if (siblingIds == null || siblingIds.isEmpty()) {
            return;
        }
        Integer order = 1;
        for (Id siblingId : siblingIds) {
            bcm_Capability__c pending = updatesById.containsKey(siblingId)
                ? updatesById.get(siblingId)
                : new bcm_Capability__c(Id = siblingId);
            pending.bcm_SortOrder__c = order;
            updatesById.put(siblingId, pending);
            order++;
        }
    }
}
