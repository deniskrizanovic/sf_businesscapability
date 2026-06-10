@IsTest
public class TestDataFactory {
    public static bcm_Map__c createMap(String name, Boolean doInsert) {
        bcm_Map__c m = new bcm_Map__c(Name = name);
        if (doInsert) {
            insert m;
        }
        return m;
    }

    public static bcm_Capability__c createCapability(
        Id mapId,
        Id parentId,
        Integer level,
        Integer sortOrder,
        Boolean doInsert
    ) {
        bcm_Capability__c cap = new bcm_Capability__c(
            Name = 'Test Capability',
            bcm_Map__c = mapId,
            bcm_Parent__c = parentId,
            bcm_Level__c = level,
            bcm_SortOrder__c = sortOrder
        );
        if (doInsert) {
            insert cap;
        }
        return cap;
    }

    public static bcm_Tag__c createTag(String name, String colour, Boolean doInsert) {
        bcm_Tag__c tag = new bcm_Tag__c(Name = name, bcm_Colour__c = colour);
        if (doInsert) {
            insert tag;
        }
        return tag;
    }

    public static bcm_CapabilityTag__c createCapabilityTag(
        Id capabilityId,
        Id tagId,
        Boolean doInsert
    ) {
        bcm_CapabilityTag__c jct = new bcm_CapabilityTag__c(
            bcm_Capability__c = capabilityId,
            bcm_Tag__c = tagId
        );
        if (doInsert) {
            insert jct;
        }
        return jct;
    }

    public static User createUserWithPermSet(String permSetName) {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Minimum Access - Salesforce' LIMIT 1];
        User running = [
            SELECT TimeZoneSidKey, LocaleSidKey, EmailEncodingKey, LanguageLocaleKey
            FROM User
            WHERE Id = :UserInfo.getUserId()
        ];
        User u = new User(
            FirstName = 'Test',
            LastName = permSetName,
            Email = permSetName + '@bcmtest.example.invalid',
            Username = permSetName +
                '.' +
                UserInfo.getOrganizationId() +
                '@bcmtest.example.invalid',
            Alias = permSetName.left(8),
            TimeZoneSidKey = running.TimeZoneSidKey,
            LocaleSidKey = running.LocaleSidKey,
            EmailEncodingKey = running.EmailEncodingKey,
            LanguageLocaleKey = running.LanguageLocaleKey,
            ProfileId = p.Id
        );
        insert u;
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);
        return u;
    }
}
