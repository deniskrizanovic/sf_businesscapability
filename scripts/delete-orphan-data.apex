// Deletes orphan BCM records left over from failed e2e runs.
// Keeps records belonging to the two canonical maps:
//   - "Generic Enterprise Capability Map"
//   - "Homes NSW Business Capability Model"
// Deletion order: CapabilityTag -> Capability -> Map -> unreferenced Tag.

Set<String> keepMapNames = new Set<String>{
    'Generic Enterprise Capability Map'
};

Set<Id> keepMapIds = new Map<Id, bcm_Map__c>(
    [SELECT Id FROM bcm_Map__c WHERE Name IN :keepMapNames]
).keySet();
System.debug('Keeping ' + keepMapIds.size() + ' map(s): ' + keepMapNames);

List<bcm_CapabilityTag__c> orphanCt = [
    SELECT Id FROM bcm_CapabilityTag__c
    WHERE bcm_Capability__r.bcm_Map__c NOT IN :keepMapIds
    LIMIT 10000
];
if (!orphanCt.isEmpty()) {
    delete orphanCt;
    System.debug('Deleted ' + orphanCt.size() + ' bcm_CapabilityTag__c records');
}

List<bcm_Capability__c> orphanCaps = [
    SELECT Id FROM bcm_Capability__c
    WHERE bcm_Map__c NOT IN :keepMapIds
    LIMIT 10000
];
if (!orphanCaps.isEmpty()) {
    delete orphanCaps;
    System.debug('Deleted ' + orphanCaps.size() + ' bcm_Capability__c records');
}

List<bcm_Map__c> orphanMaps = [
    SELECT Id FROM bcm_Map__c
    WHERE Id NOT IN :keepMapIds
    LIMIT 10000
];
if (!orphanMaps.isEmpty()) {
    delete orphanMaps;
    System.debug('Deleted ' + orphanMaps.size() + ' bcm_Map__c records');
}

Set<Id> referencedTagIds = new Set<Id>();
for (bcm_CapabilityTag__c ct : [SELECT bcm_Tag__c FROM bcm_CapabilityTag__c WHERE bcm_Tag__c != null LIMIT 50000]) {
    referencedTagIds.add(ct.bcm_Tag__c);
}

List<bcm_Tag__c> orphanTags = [
    SELECT Id FROM bcm_Tag__c
    WHERE Id NOT IN :referencedTagIds
    LIMIT 10000
];
if (!orphanTags.isEmpty()) {
    delete orphanTags;
    System.debug('Deleted ' + orphanTags.size() + ' unreferenced bcm_Tag__c records');
}

System.debug('Orphan cleanup complete.');
