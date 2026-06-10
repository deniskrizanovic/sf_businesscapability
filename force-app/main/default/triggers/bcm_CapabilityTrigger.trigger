/**
 * Trigger for bcm_Capability__c.
 * Delegates all logic to bcm_CapabilityHandler.
 */
trigger bcm_CapabilityTrigger on bcm_Capability__c(before insert, before update) {
    bcm_CapabilityHandler.handle(Trigger.new, Trigger.oldMap);
}
