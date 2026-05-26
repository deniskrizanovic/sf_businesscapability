/**
 * Handler for bcm_CapabilityTrigger.
 * Derives bcm_Level__c and bcm_SortOrder__c before insert and before update.
 *
 * Level derivation (only when bcm_Level__c is null):
 *   - No parent → Level 1
 *   - Parent set → parent's Level + 1
 *
 * SortOrder on insert:
 *   - Explicit value provided → shift existing siblings at >= that position down by 1
 *   - No value provided → append at MAX sibling SortOrder + 1 (or 1 if no siblings)
 */
public with sharing class bcm_CapabilityHandler {

    /**
     * Entry point called by bcm_CapabilityTrigger for before insert and before update.
     * @param newRecords Trigger.new list
     * @param oldMap     Trigger.oldMap (null on insert)
     */
    public static void handle(List<bcm_Capability__c> newRecords, Map<Id, SObject> oldMap) {
        if (newRecords == null || newRecords.isEmpty()) {
            return;
        }
        deriveLevel(newRecords);
        Boolean isInsert = (oldMap == null);
        if (isInsert) {
            shiftSiblingsForExplicitSortOrder(newRecords);
        }
        deriveSortOrder(newRecords);
    }

    // ─── Level derivation ────────────────────────────────────────────────────

    private static void deriveLevel(List<bcm_Capability__c> records) {
        Set<Id> parentIds = new Set<Id>();
        for (bcm_Capability__c cap : records) {
            if (cap.bcm_Level__c == null && cap.bcm_Parent__c != null) {
                parentIds.add(cap.bcm_Parent__c);
            }
        }

        Map<Id, bcm_Capability__c> parentById = new Map<Id, bcm_Capability__c>();
        if (!parentIds.isEmpty()) {
            for (bcm_Capability__c parent : [
                SELECT Id, bcm_Level__c
                FROM bcm_Capability__c
                WHERE Id IN :parentIds
                WITH USER_MODE
            ]) {
                parentById.put(parent.Id, parent);
            }
        }

        for (bcm_Capability__c cap : records) {
            if (cap.bcm_Level__c != null) {
                continue;
            }
            if (cap.bcm_Parent__c == null) {
                cap.bcm_Level__c = 1;
            } else {
                bcm_Capability__c parent = parentById.get(cap.bcm_Parent__c);
                if (parent != null && parent.bcm_Level__c != null) {
                    cap.bcm_Level__c = parent.bcm_Level__c + 1;
                }
            }
        }
    }

    // ─── SortOrder shift (explicit insert) ──────────────────────────────────

    private static void shiftSiblingsForExplicitSortOrder(List<bcm_Capability__c> records) {
        Map<String, List<Integer>> incomingByKey = new Map<String, List<Integer>>();
        Map<String, Id> mapIdByKey = new Map<String, Id>();
        Map<String, Id> parentIdByKey = new Map<String, Id>();

        for (bcm_Capability__c cap : records) {
            if (cap.bcm_SortOrder__c == null || cap.bcm_Map__c == null) {
                continue;
            }
            String key = buildGroupKey(cap.bcm_Map__c, cap.bcm_Parent__c);
            if (!incomingByKey.containsKey(key)) {
                incomingByKey.put(key, new List<Integer>());
                mapIdByKey.put(key, cap.bcm_Map__c);
                parentIdByKey.put(key, cap.bcm_Parent__c);
            }
            incomingByKey.get(key).add(cap.bcm_SortOrder__c.intValue());
        }

        if (incomingByKey.isEmpty()) {
            return;
        }

        // Determine minimum incoming position per group to bound the sibling query
        Map<String, Integer> minIncomingByKey = new Map<String, Integer>();
        for (String key : incomingByKey.keySet()) {
            Integer minVal = null;
            for (Integer v : incomingByKey.get(key)) {
                if (minVal == null || v < minVal) minVal = v;
            }
            minIncomingByKey.put(key, minVal);
        }

        Set<Id> mapIds = new Set<Id>(mapIdByKey.values());
        Set<Id> nonNullParentIds = new Set<Id>();
        Boolean hasNullParentGroup = false;
        for (String key : parentIdByKey.keySet()) {
            Id pid = parentIdByKey.get(key);
            if (pid != null) nonNullParentIds.add(pid);
            else hasNullParentGroup = true;
        }

        // siblingsMap: groupKey → (sortOrder → sibling record)
        Map<String, Map<Integer, bcm_Capability__c>> siblingsMap = new Map<String, Map<Integer, bcm_Capability__c>>();

        if (!nonNullParentIds.isEmpty()) {
            for (bcm_Capability__c sib : [
                SELECT Id, bcm_Map__c, bcm_Parent__c, bcm_SortOrder__c
                FROM bcm_Capability__c
                WHERE bcm_Map__c IN :mapIds AND bcm_Parent__c IN :nonNullParentIds
                WITH USER_MODE
            ]) {
                String key = buildGroupKey(sib.bcm_Map__c, sib.bcm_Parent__c);
                Integer minIncoming = minIncomingByKey.get(key);
                if (minIncoming == null || sib.bcm_SortOrder__c < minIncoming) continue;
                if (!siblingsMap.containsKey(key)) siblingsMap.put(key, new Map<Integer, bcm_Capability__c>());
                siblingsMap.get(key).put(sib.bcm_SortOrder__c.intValue(), sib);
            }
        }

        if (hasNullParentGroup) {
            for (bcm_Capability__c sib : [
                SELECT Id, bcm_Map__c, bcm_Parent__c, bcm_SortOrder__c
                FROM bcm_Capability__c
                WHERE bcm_Map__c IN :mapIds AND bcm_Parent__c = NULL
                WITH USER_MODE
            ]) {
                String key = buildGroupKey(sib.bcm_Map__c, null);
                Integer minIncoming = minIncomingByKey.get(key);
                if (minIncoming == null || sib.bcm_SortOrder__c < minIncoming) continue;
                if (!siblingsMap.containsKey(key)) siblingsMap.put(key, new Map<Integer, bcm_Capability__c>());
                siblingsMap.get(key).put(sib.bcm_SortOrder__c.intValue(), sib);
            }
        }

        if (siblingsMap.isEmpty()) {
            return;
        }

        // For each group, process incoming positions lowest-first.
        // Only shift siblings that form a consecutive run starting at the incoming position —
        // gaps in the sequence stop the cascade, so siblings beyond the gap are never touched.
        Map<Id, bcm_Capability__c> toUpdate = new Map<Id, bcm_Capability__c>();

        for (String key : incomingByKey.keySet()) {
            Map<Integer, bcm_Capability__c> byPos = siblingsMap.get(key);
            if (byPos == null || byPos.isEmpty()) continue;

            Set<Integer> occupied = new Set<Integer>(byPos.keySet());

            List<Integer> incoming = incomingByKey.get(key).clone();
            incoming.sort();

            for (Integer incomingPos : incoming) {
                if (!occupied.contains(incomingPos)) {
                    // Position is free — no shift needed
                    occupied.add(incomingPos);
                    continue;
                }
                // Find end of the consecutive run starting at incomingPos
                Integer runEnd = incomingPos;
                while (occupied.contains(runEnd + 1)) {
                    runEnd++;
                }
                // Shift siblings in [incomingPos..runEnd] up by 1, high-to-low
                // to avoid overwriting a position before it is processed
                for (Integer pos = runEnd; pos >= incomingPos; pos--) {
                    bcm_Capability__c sib = byPos.get(pos);
                    if (sib == null) continue;
                    occupied.remove(pos);
                    byPos.remove(pos);
                    sib.bcm_SortOrder__c = pos + 1;
                    occupied.add(pos + 1);
                    byPos.put(pos + 1, sib);
                    toUpdate.put(sib.Id, sib);
                }
                occupied.add(incomingPos);
            }
        }

        if (!toUpdate.isEmpty()) {
            update toUpdate.values();
        }
    }

    // ─── SortOrder derivation ────────────────────────────────────────────────

    private static void deriveSortOrder(List<bcm_Capability__c> records) {
        // Collect unique (mapId, parentId) groups for records that need SortOrder assigned
        Set<String> groupKeys = new Set<String>();
        Map<String, Id> mapIdByKey = new Map<String, Id>();
        Map<String, Id> parentIdByKey = new Map<String, Id>();

        for (bcm_Capability__c cap : records) {
            if (cap.bcm_SortOrder__c == null && cap.bcm_Map__c != null) {
                String key = buildGroupKey(cap.bcm_Map__c, cap.bcm_Parent__c);
                groupKeys.add(key);
                mapIdByKey.put(key, cap.bcm_Map__c);
                parentIdByKey.put(key, cap.bcm_Parent__c);
            }
        }

        if (groupKeys.isEmpty()) {
            return;
        }

        // For each group query MAX(SortOrder) among existing siblings
        Map<String, Decimal> maxSortOrderByKey = new Map<String, Decimal>();
        for (String key : groupKeys) {
            maxSortOrderByKey.put(key, 0);
        }

        // Build sets for the IN clauses; null parentId needs special handling
        Set<Id> mapIds = new Set<Id>(mapIdByKey.values());
        Set<Id> nonNullParentIds = new Set<Id>();
        Boolean hasNullParentGroup = false;

        for (String key : groupKeys) {
            Id pid = parentIdByKey.get(key);
            if (pid != null) {
                nonNullParentIds.add(pid);
            } else {
                hasNullParentGroup = true;
            }
        }

        // Query siblings with non-null parent
        if (!nonNullParentIds.isEmpty()) {
            for (AggregateResult ar : [
                SELECT bcm_Map__c mapId, bcm_Parent__c parentId, MAX(bcm_SortOrder__c) maxSort
                FROM bcm_Capability__c
                WHERE bcm_Map__c IN :mapIds AND bcm_Parent__c IN :nonNullParentIds
                WITH USER_MODE
                GROUP BY bcm_Map__c, bcm_Parent__c
            ]) {
                Id mId = (Id) ar.get('mapId');
                Id pId = (Id) ar.get('parentId');
                Decimal maxSort = (Decimal) ar.get('maxSort');
                String key = buildGroupKey(mId, pId);
                if (groupKeys.contains(key) && maxSort != null) {
                    maxSortOrderByKey.put(key, maxSort);
                }
            }
        }

        // Query siblings with null parent (L1 capabilities)
        if (hasNullParentGroup) {
            for (AggregateResult ar : [
                SELECT bcm_Map__c mapId, MAX(bcm_SortOrder__c) maxSort
                FROM bcm_Capability__c
                WHERE bcm_Map__c IN :mapIds AND bcm_Parent__c = NULL
                WITH USER_MODE
                GROUP BY bcm_Map__c
            ]) {
                Id mId = (Id) ar.get('mapId');
                Decimal maxSort = (Decimal) ar.get('maxSort');
                String key = buildGroupKey(mId, null);
                if (groupKeys.contains(key) && maxSort != null) {
                    maxSortOrderByKey.put(key, maxSort);
                }
            }
        }

        // Apply: each record needing SortOrder gets MAX+1, then increments the running max
        // so multiple records in the same batch get unique, sequential values
        for (bcm_Capability__c cap : records) {
            if (cap.bcm_SortOrder__c != null || cap.bcm_Map__c == null) {
                continue;
            }
            String key = buildGroupKey(cap.bcm_Map__c, cap.bcm_Parent__c);
            Decimal currentMax = maxSortOrderByKey.get(key) ?? 0;
            cap.bcm_SortOrder__c = currentMax + 1;
            maxSortOrderByKey.put(key, currentMax + 1);
        }
    }

    private static String buildGroupKey(Id mapId, Id parentId) {
        return String.valueOf(mapId) + '|' + (parentId != null ? String.valueOf(parentId) : 'NULL');
    }
}
