// Assigns canonical tag colours to specific capabilities from the generic BCM.
// Capabilities are looked up by bcm_ExternalId__c; tags by Name.
// Safe to re-run: skips assignments where either side is missing.

Map<String, Id> capMap = new Map<String, Id>();
for (bcm_Capability__c c : [
    SELECT Id, bcm_ExternalId__c
    FROM bcm_Capability__c
    WHERE bcm_ExternalId__c != null
    AND bcm_Map__r.Name = 'Generic Enterprise Capability Map'
]) {
    capMap.put(c.bcm_ExternalId__c, c.Id);
}

Map<String, Id> tagMap = new Map<String, Id>();
for (bcm_Tag__c t : [SELECT Id, Name FROM bcm_Tag__c]) {
    tagMap.put(t.Name, t.Id);
}

// Each pair: [externalId, tagName]
List<List<String>> assignments = new List<List<String>>{
    new List<String>{ 'L2-CUSTOMER-MARKETING',       'Blue'    },
    new List<String>{ 'L2-CUSTOMER-SALES',            'Blue'    },
    new List<String>{ 'L2-CUSTOMER-SERVICE',          'Blue'    },
    new List<String>{ 'L2-PRODUCT-DEV',               'Green'   },
    new List<String>{ 'L2-PRODUCT-STRATEGY',          'Green'   },
    new List<String>{ 'L2-OPERATIONS-SUPPLY',         'Orange'  },
    new List<String>{ 'L2-OPERATIONS-FULFILMENT',     'Orange'  },
    new List<String>{ 'L2-FINANCE-ACCOUNTING',        'Amber'   },
    new List<String>{ 'L2-FINANCE-PLANNING',          'Amber'   },
    new List<String>{ 'L2-TECH-DATA',                 'Indigo'  },
    new List<String>{ 'L2-TECH-SECURITY',             'Red'     },
    new List<String>{ 'L2-TECH-APPS',                 'Indigo'  },
    new List<String>{ 'L2-CORPORATE-GRC',             'Purple'  },
    new List<String>{ 'L2-CORPORATE-STRATEGY',        'Purple'  },
    new List<String>{ 'L2-PEOPLE-TALENT',             'Teal'    },
    new List<String>{ 'L2-PEOPLE-REWARDS',            'Teal'    },
    new List<String>{ 'L2-CORPORATE-LEGAL',           'Pink'    },
    new List<String>{ 'L2-PRODUCT-LIFECYCLE',         'Emerald' }
};

List<bcm_CapabilityTag__c> junctions = new List<bcm_CapabilityTag__c>();
for (List<String> pair : assignments) {
    Id capId = capMap.get(pair[0]);
    Id tagId = tagMap.get(pair[1]);
    if (capId != null && tagId != null) {
        junctions.add(new bcm_CapabilityTag__c(
            bcm_Capability__c = capId,
            bcm_Tag__c        = tagId
        ));
    }
}

insert junctions;
System.debug('Inserted ' + junctions.size() + ' tag assignments');
