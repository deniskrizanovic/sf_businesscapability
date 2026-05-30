/**
 * AuraEnabled controller for retrieving bcm_Map__c records.
 * Used by bcm_CapabilityMap LWC to populate the Map selector combobox.
 */
public with sharing class bcm_MapController {

    /**
     * Returns all Maps ordered by Name.
     *
     * @return List of bcm_Map__c records (Id, Name, bcm_Description__c).
     * @example
     * List<bcm_Map__c> maps = bcm_MapController.getMaps();
     */
    @AuraEnabled(cacheable=true)
    public static List<bcm_Map__c> getMaps() {
        try {
            return [
                SELECT Id, Name, bcm_Description__c
                FROM bcm_Map__c
                WITH USER_MODE
                ORDER BY Name ASC
            ];
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }
}
