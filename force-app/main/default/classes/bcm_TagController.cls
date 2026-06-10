/**
 * AuraEnabled controller for retrieving bcm_Tag__c records.
 * Used by bcm_CapabilityMap LWC to populate the Tag highlight combobox.
 */
public with sharing class bcm_TagController {
    /**
     * Returns all Tags ordered by Name.
     *
     * @return List of bcm_Tag__c records (Id, Name, bcm_Colour__c).
     * @example
     * List<bcm_Tag__c> tags = bcm_TagController.getTags();
     */
    @AuraEnabled(cacheable=true)
    public static List<bcm_Tag__c> getTags() {
        try {
            return [
                SELECT Id, Name, bcm_Colour__c
                FROM bcm_Tag__c
                WITH USER_MODE
                ORDER BY Name ASC
            ];
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }
}
