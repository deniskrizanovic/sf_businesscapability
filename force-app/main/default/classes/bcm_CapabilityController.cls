/**
 * AuraEnabled controller for retrieving bcm_Capability__c records for a given Map.
 * Includes CapabilityTag subquery for tag colour data used by bcm_CapabilityMap LWC.
 */
public with sharing class bcm_CapabilityController {

    /**
     * Returns all Capabilities for the given Map, ordered by level then sort order.
     * Includes a subquery on bcm_CapabilityTags__r for tag colour highlight data.
     *
     * @param mapId  Id of the bcm_Map__c record to fetch capabilities for.
     * @return List of bcm_Capability__c records with CapabilityTag subrecords.
     * @example
     * List<bcm_Capability__c> caps = bcm_CapabilityController.getCapabilities(mapId);
     */
    @AuraEnabled(cacheable=true)
    public static List<bcm_Capability__c> getCapabilities(Id mapId) {
        if (mapId == null) {
            throw new AuraHandledException('mapId is required');
        }
        try {
            return [
                SELECT Id, Name, bcm_Parent__c, bcm_Level__c, bcm_SortOrder__c,
                       bcm_ExternalId__c, bcm_Definition__c,
                       bcm_StrategySupport__c, bcm_ArchitecturalNuance__c,
                       bcm_HideFromDiagram__c, bcm_IsCrossCutting__c,
                       (SELECT bcm_Tag__c, bcm_Tag__r.Name, bcm_Tag__r.bcm_Colour__c
                        FROM Tags__r)
                FROM bcm_Capability__c
                WHERE bcm_Map__c = :mapId
                WITH USER_MODE
                ORDER BY bcm_Level__c ASC, bcm_SortOrder__c ASC
            ];
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    /**
     * Returns a single Capability with full detail fields + tag junction subquery.
     * Not cacheable — panel always shows freshly-fetched record.
     *
     * @param capabilityId  Id of the bcm_Capability__c record.
     * @return The Capability record with detail fields.
     */
    @AuraEnabled
    public static bcm_Capability__c getCapabilityDetail(Id capabilityId) {
        if (capabilityId == null) {
            throw new AuraHandledException('capabilityId is required');
        }
        try {
            return [
                SELECT Id, Name, bcm_Parent__c, bcm_Level__c,
                       bcm_Definition__c, bcm_StrategySupport__c,
                       bcm_ArchitecturalNuance__c, bcm_HideFromDiagram__c,
                       bcm_IsCrossCutting__c,
                       (SELECT bcm_Tag__c, bcm_Tag__r.Name, bcm_Tag__r.bcm_Colour__c
                          FROM Tags__r)
                FROM bcm_Capability__c
                WHERE Id = :capabilityId
                WITH USER_MODE
                LIMIT 1
            ];
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    /**
     * Persists Name + rich-text fields edited via the Capability Detail panel.
     * Delegates DML to bcm_CapabilityService (per ADR 0002).
     *
     * @param capability  Capability with Id and editable fields populated.
     */
    @AuraEnabled
    public static void updateCapability(bcm_Capability__c capability) {
        try {
            bcm_CapabilityService.updateCapability(capability);
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    /**
     * Sets bcm_HideFromDiagram__c = true on the given Capability.
     *
     * @param capabilityId  Id of the bcm_Capability__c record to hide.
     */
    @AuraEnabled
    public static void hideCapability(Id capabilityId) {
        if (capabilityId == null) {
            throw new AuraHandledException('capabilityId is required');
        }
        try {
            bcm_Capability__c cap = new bcm_Capability__c(
                Id = capabilityId,
                bcm_HideFromDiagram__c = true
            );
            update as user cap;
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }
}
