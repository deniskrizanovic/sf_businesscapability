// Deletes all bcm_Tag__c records and re-inserts the canonical colour presets.
// Run this after deploying updated bcm_Colour__c picklist values.
// WARNING: also deletes bcm_CapabilityTag__c junction records (FK constraint).

List<bcm_CapabilityTag__c> assignments = [SELECT Id FROM bcm_CapabilityTag__c LIMIT 10000];
if (!assignments.isEmpty()) {
    delete assignments;
    System.debug('Deleted ' + assignments.size() + ' bcm_CapabilityTag__c records');
}

List<bcm_Tag__c> existing = [SELECT Id FROM bcm_Tag__c LIMIT 10000];
if (!existing.isEmpty()) {
    delete existing;
    System.debug('Deleted ' + existing.size() + ' bcm_Tag__c records');
}

List<bcm_Tag__c> tags = new List<bcm_Tag__c>{
    new bcm_Tag__c(Name = 'Blue',    bcm_Colour__c = '#BDD0EE'),
    new bcm_Tag__c(Name = 'Green',   bcm_Colour__c = '#C8D9CE'),
    new bcm_Tag__c(Name = 'Red',     bcm_Colour__c = '#E8C8C8'),
    new bcm_Tag__c(Name = 'Purple',  bcm_Colour__c = '#D5CEDF'),
    new bcm_Tag__c(Name = 'Orange',  bcm_Colour__c = '#EDD9C2'),
    new bcm_Tag__c(Name = 'Teal',    bcm_Colour__c = '#C6D5D5'),
    new bcm_Tag__c(Name = 'Pink',    bcm_Colour__c = '#EDD0D9'),
    new bcm_Tag__c(Name = 'Amber',   bcm_Colour__c = '#EDE0C2'),
    new bcm_Tag__c(Name = 'Indigo',  bcm_Colour__c = '#C9CCDF'),
    new bcm_Tag__c(Name = 'Emerald', bcm_Colour__c = '#C8D9CC')
};
insert tags;
System.debug('Inserted ' + tags.size() + ' bcm_Tag__c records');
