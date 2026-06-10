/**
 * Imports a capability map from a nested JSON payload.
 *
 * <p>Upserts {@code bcm_Map__c} and all {@code bcm_Capability__c} records, including
 * parent–child links. Because the {@code No_Parent_Must_Be_Level_1} validation rule
 * rejects Level 2/3 records without a parent, capabilities are upserted in three
 * sequential passes (L1 → L2 → L3), with parent Ids resolved between passes.</p>
 *
 * <p>Tags are intentionally not imported; they must be created and assigned manually
 * via the Tags tab after import.</p>
 *
 * <p>Requires the {@code bcm_CanEdit} custom permission. Callers without it receive an
 * {@link AuraHandledException}.</p>
 */
public with sharing class bcm_ImportController {
    private static final String ERROR_PAYLOAD_REQUIRED = 'JSON payload is required';
    private static final String ERROR_MAP_NAME_REQUIRED = 'mapName is required in the JSON payload';
    private static final String ERROR_ACCESS_DENIED = 'Access denied';

    // ─── Public entry point ──────────────────────────────────────────────────

    /**
     * Imports a capability map from a nested JSON payload.
     * Tags present in the JSON are silently ignored.
     *
     * @param jsonPayload  JSON string matching the {@link bcm_ImportPayload} structure.
     * @return             {@link bcm_ImportResult} with {@code success=true} and inserted /
     *                     updated counts on success; {@code success=false} with an
     *                     {@code errorMessage} on validation or parse failure.
     * @example
     * bcm_ImportController.bcm_ImportResult result =
     *     bcm_ImportController.importCapabilities(
     *         '{ "mapName": "My Map", "capabilities": [] }'
     *     );
     */
    public static bcm_ImportResult importCapabilities(String jsonPayload) {
        if (String.isBlank(jsonPayload)) {
            return errorResult(ERROR_PAYLOAD_REQUIRED);
        }
        if (!FeatureManagement.checkPermission('bcm_CanEdit')) {
            throw new AuraHandledException(ERROR_ACCESS_DENIED);
        }
        try {
            Map<String, Object> raw = (Map<String, Object>) JSON.deserializeUntyped(jsonPayload);
            bcm_ImportPayload payload = parsePayload(raw);
            return runImport(payload);
        } catch (JSONException jsonEx) {
            return errorResult('Invalid JSON: ' + jsonEx.getMessage());
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception ex) {
            return errorResult(ex.getMessage());
        }
    }

    // ─── Manual JSON parsers ─────────────────────────────────────────────────
    // JSON.deserialize is avoided for bcm_ImportPayload because bcm_CapabilityNode
    // is self-recursive. Salesforce's Flow-to-Apex bridge reflects on inner classes
    // during InvocableMethod setup and reports duplicate fields on recursive types.

    private static bcm_ImportPayload parsePayload(Map<String, Object> raw) {
        bcm_ImportPayload p = new bcm_ImportPayload();
        p.mapName = (String) raw.get('mapName');
        p.mapDescription = (String) raw.get('mapDescription');
        p.capabilities = new List<bcm_CapabilityNode>();
        Object caps = raw.get('capabilities');
        if (caps instanceof List<Object>) {
            for (Object item : (List<Object>) caps) {
                p.capabilities.add(parseNode((Map<String, Object>) item));
            }
        }
        return p;
    }

    private static bcm_CapabilityNode parseNode(Map<String, Object> raw) {
        bcm_CapabilityNode n = new bcm_CapabilityNode();
        n.externalId = (String) raw.get('externalId');
        n.name = (String) raw.get('name');
        n.level = raw.get('level') != null
            ? Integer.valueOf(String.valueOf(raw.get('level')))
            : null;
        n.sortOrder = raw.get('sortOrder') != null
            ? Integer.valueOf(String.valueOf(raw.get('sortOrder')))
            : null;
        n.definition = (String) raw.get('definition');
        n.strategySupport = (String) raw.get('strategySupport');
        n.architecturalNuance = (String) raw.get('architecturalNuance');
        n.children = new List<bcm_CapabilityNode>();
        Object kids = raw.get('children');
        if (kids instanceof List<Object>) {
            for (Object item : (List<Object>) kids) {
                n.children.add(parseNode((Map<String, Object>) item));
            }
        }
        return n;
    }

    // ─── Private orchestration ───────────────────────────────────────────────

    private static bcm_ImportResult runImport(bcm_ImportPayload payload) {
        if (payload == null || String.isBlank(payload.mapName)) {
            return errorResult(ERROR_MAP_NAME_REQUIRED);
        }
        bcm_ImportResult result = new bcm_ImportResult();

        bcm_Map__c mapRecord = upsertMap(payload);

        List<bcm_CapabilityNode> rootNodes = payload.capabilities ?? new List<bcm_CapabilityNode>();
        Map<String, String> parentByChild = new Map<String, String>();
        List<bcm_Capability__c> flatList = flattenTree(
            rootNodes,
            mapRecord.Id,
            null,
            parentByChild
        );

        upsertByLevel(flatList, mapRecord.Id, parentByChild, result);

        result.success = true;
        return result;
    }

    // ─── upsertMap ───────────────────────────────────────────────────────────

    /**
     * Queries for an existing {@code bcm_Map__c} by Name and updates it, or inserts
     * a new record when no match is found.
     *
     * @param payload  The import payload containing mapName and mapDescription.
     * @return         The saved bcm_Map__c record with its Id populated.
     */
    private static bcm_Map__c upsertMap(bcm_ImportPayload payload) {
        List<bcm_Map__c> existing = [
            SELECT Id, bcm_Description__c
            FROM bcm_Map__c
            WHERE Name = :payload.mapName
            WITH USER_MODE
            LIMIT 1
        ];
        if (!existing.isEmpty()) {
            bcm_Map__c mapRecord = existing[0];
            mapRecord.bcm_Description__c = payload.mapDescription;
            Database.update(mapRecord, AccessLevel.USER_MODE);
            return mapRecord;
        }
        bcm_Map__c newMap = new bcm_Map__c(
            Name = payload.mapName,
            bcm_Description__c = payload.mapDescription
        );
        Database.insert(newMap, AccessLevel.USER_MODE);
        return newMap;
    }

    // ─── flattenTree ─────────────────────────────────────────────────────────

    /**
     * Recursively depth-first-traverses the capability node tree, building a flat
     * list of SObjects and recording parent–child external-ID relationships.
     *
     * <p>{@code bcm_Parent__c} is intentionally left null on all returned records.
     * Parents are resolved in {@link #upsertByLevel} after each level is persisted.</p>
     *
     * @param nodes             Capability nodes at the current tree level.
     * @param mapId             The bcm_Map__c Id to associate with every record.
     * @param parentExternalId  The external ID of the parent node, or {@code null} for roots.
     * @param parentByChild     Accumulator: child externalId → parent externalId.
     * @return                  Flat list of unsaved bcm_Capability__c records.
     */
    private static List<bcm_Capability__c> flattenTree(
        List<bcm_CapabilityNode> nodes,
        Id mapId,
        String parentExternalId,
        Map<String, String> parentByChild
    ) {
        List<bcm_Capability__c> flatList = new List<bcm_Capability__c>();
        if (nodes == null || nodes.isEmpty()) {
            return flatList;
        }
        for (bcm_CapabilityNode node : nodes) {
            flatList.add(
                new bcm_Capability__c(
                    Name = node.name,
                    bcm_Map__c = mapId,
                    bcm_Level__c = node.level,
                    bcm_SortOrder__c = node.sortOrder,
                    bcm_ExternalId__c = node.externalId,
                    bcm_Definition__c = node.definition,
                    bcm_StrategySupport__c = node.strategySupport,
                    bcm_ArchitecturalNuance__c = node.architecturalNuance
                )
            );
            if (parentExternalId != null) {
                parentByChild.put(node.externalId, parentExternalId);
            }
            List<bcm_CapabilityNode> children = node.children ?? new List<bcm_CapabilityNode>();
            flatList.addAll(flattenTree(children, mapId, node.externalId, parentByChild));
        }
        return flatList;
    }

    // ─── upsertByLevel ───────────────────────────────────────────────────────

    /**
     * Upserts capabilities in three sequential passes (L1 → L2 → L3).
     *
     * <p>The {@code No_Parent_Must_Be_Level_1} and {@code Has_Parent_Must_Be_Level_2_Or_3}
     * validation rules require that parent Ids are set before Level 2 and 3 records are
     * persisted. This method resolves parents from the prior level's upsert before
     * submitting each batch.</p>
     *
     * @param flatList      All capability SObjects from flattenTree (bcm_Parent__c null).
     * @param mapId         The bcm_Map__c Id used to scope post-upsert queries.
     * @param parentByChild Child externalId → parent externalId.
     * @param result        Accumulator for inserted/updated counts.
     */
    private static void upsertByLevel(
        List<bcm_Capability__c> flatList,
        Id mapId,
        Map<String, String> parentByChild,
        bcm_ImportResult result
    ) {
        Map<String, Id> externalIdToId = new Map<String, Id>();

        for (Integer level = 1; level <= 3; level++) {
            List<bcm_Capability__c> levelList = new List<bcm_Capability__c>();
            for (bcm_Capability__c cap : flatList) {
                if (cap.bcm_Level__c == level) {
                    levelList.add(cap);
                }
            }
            if (levelList.isEmpty()) {
                continue;
            }

            // Set bcm_Parent__c before upserting L2 / L3
            if (level > 1) {
                for (bcm_Capability__c cap : levelList) {
                    String parentExtId = parentByChild.get(cap.bcm_ExternalId__c);
                    if (parentExtId != null) {
                        cap.bcm_Parent__c = externalIdToId.get(parentExtId);
                    }
                }
            }

            List<Database.UpsertResult> upsertResults = Database.upsert(
                levelList,
                bcm_Capability__c.bcm_ExternalId__c,
                false
            );
            for (Database.UpsertResult ur : upsertResults) {
                if (ur.isSuccess()) {
                    if (ur.isCreated()) {
                        result.capabilitiesInserted++;
                    } else {
                        result.capabilitiesUpdated++;
                    }
                }
            }

            // Re-query to get authoritative Ids for the next level's parent lookup
            for (bcm_Capability__c cap : [
                SELECT Id, bcm_ExternalId__c
                FROM bcm_Capability__c
                WHERE bcm_Map__c = :mapId AND bcm_Level__c = :level
                WITH USER_MODE
            ]) {
                if (String.isNotBlank(cap.bcm_ExternalId__c)) {
                    externalIdToId.put(cap.bcm_ExternalId__c, cap.Id);
                }
            }
        }
    }

    // ─── errorResult ────────────────────────────────────────────────────────

    private static bcm_ImportResult errorResult(String message) {
        bcm_ImportResult result = new bcm_ImportResult();
        result.success = false;
        result.errorMessage = message;
        return result;
    }

    // ─── Inner wrapper classes ───────────────────────────────────────────────

    /**
     * Top-level JSON payload structure for a capability map import.
     * Tags are intentionally absent — they are not imported.
     */
    public class bcm_ImportPayload {
        /** Name of the Map record; used as the SOQL lookup key (required). */
        public String mapName;
        /** HTML-formatted description stored on the Map record. */
        public String mapDescription;
        /** Root-level capability nodes (L1 domains). */
        public List<bcm_CapabilityNode> capabilities;
    }

    /**
     * A single capability node in the import tree.
     * Unknown JSON fields (e.g. {@code tags}) are silently ignored during
     * deserialization because {@code JSON.deserialize} (not {@code JSON.deserializeStrict})
     * is used.
     */
    public class bcm_CapabilityNode {
        /** Unique string key used for upsert via bcm_ExternalId__c and parent wiring. */
        public String externalId;
        /** Display name for the capability record. */
        public String name;
        /** Hierarchy level: 1 (domain), 2 (group), or 3 (capability). */
        public Integer level;
        /** Display order within the parent group. */
        public Integer sortOrder;
        /** HTML-formatted definition. */
        public String definition;
        /** HTML-formatted strategy support notes. */
        public String strategySupport;
        /** HTML-formatted architectural nuance notes. */
        public String architecturalNuance;
        /** Child capability nodes (may be empty or omitted). */
        public List<bcm_CapabilityNode> children;
    }

    /**
     * Returned from an import attempt. Fields are exposed to Screen Flows via
     * {@code @InvocableVariable}.
     */
    public class bcm_ImportResult {
        /** Number of bcm_Capability__c records created in this import. */
        @InvocableVariable
        public Integer capabilitiesInserted = 0;
        /** Number of bcm_Capability__c records updated in this import. */
        @InvocableVariable
        public Integer capabilitiesUpdated = 0;
        /** {@code true} when the import completed without a hard error. */
        @InvocableVariable
        public Boolean success = false;
        /** Human-readable description when {@code success} is {@code false}. */
        @InvocableVariable
        public String errorMessage;
    }

    // ─── Flow entry point ────────────────────────────────────────────────────

    public class FlowInput {
        @InvocableVariable(label='JSON Payload' required=true)
        public String jsonPayload;
    }

    @InvocableMethod(
        label='Import Capability Map from JSON'
        description='Calls importCapabilities and surfaces result for a Screen Flow.'
        category='BCM'
    )
    public static List<bcm_ImportResult> execute(List<FlowInput> inputs) {
        try {
            return new List<bcm_ImportResult>{ importCapabilities(inputs.get(0).jsonPayload) };
        } catch (AuraHandledException e) {
            bcm_ImportResult err = new bcm_ImportResult();
            err.success = false;
            err.errorMessage = e.getMessage();
            err.capabilitiesInserted = 0;
            err.capabilitiesUpdated = 0;
            return new List<bcm_ImportResult>{ err };
        }
    }
}
