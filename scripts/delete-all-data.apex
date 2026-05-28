// Deletes all BCM data in the org.
// Safe to run repeatedly; each step is a no-op when the object is already empty.
// Deletion order respects FK constraints:
//   CapabilityTag → Capability → Map
//   CapabilityTag → Tag
// bcm_Capability__c.bcm_Map__c has deleteConstraint=Restrict, so
// all Capabilities must be gone before Maps can be deleted.

List<bcm_CapabilityTag__c> tags = [SELECT Id FROM bcm_CapabilityTag__c LIMIT 10000];
if (!tags.isEmpty()) {
    delete tags;
    System.debug('Deleted ' + tags.size() + ' bcm_CapabilityTag__c records');
}

List<bcm_Capability__c> capabilities = [SELECT Id FROM bcm_Capability__c LIMIT 10000];
if (!capabilities.isEmpty()) {
    delete capabilities;
    System.debug('Deleted ' + capabilities.size() + ' bcm_Capability__c records');
}

List<bcm_Tag__c> tagObjects = [SELECT Id FROM bcm_Tag__c LIMIT 10000];
if (!tagObjects.isEmpty()) {
    delete tagObjects;
    System.debug('Deleted ' + tagObjects.size() + ' bcm_Tag__c records');
}

List<bcm_Map__c> maps = [SELECT Id FROM bcm_Map__c LIMIT 10000];
if (!maps.isEmpty()) {
    delete maps;
    System.debug('Deleted ' + maps.size() + ' bcm_Map__c records');
}

System.debug('BCM data cleanup complete.');
