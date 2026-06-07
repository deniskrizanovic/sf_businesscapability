@IsTest(SeeAllData=false)
private class bcm_CapabilityTagTest {

    @TestSetup
    static void setupTestData() {
        bcm_Map__c m = TestDataFactory.createMap('Test Map', true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, null, true);
        TestDataFactory.createTag('Blue Tag', '#A8C7FF', true);
    }

    // ─── Editor can create a junction record ─────────────────────────────────

    // @spec capability-tag-object.md · "Capabilities can be linked to Tags and links cascade-delete correctly" · "Editor can link a Capability to a Tag"
    @IsTest
    static void editor_insertsJunction_succeeds() {
        // Given
        User editor = TestDataFactory.createUserWithPermSet('bcm_Editor');

        // When
        bcm_CapabilityTag__c junction;
        Test.startTest();
        System.runAs(editor) {
            bcm_Map__c m = TestDataFactory.createMap('Editor Map', true);
            bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, null, true);
            bcm_Tag__c tag = TestDataFactory.createTag('Editor Tag', '#A8C7FF', true);
            junction = TestDataFactory.createCapabilityTag(cap.Id, tag.Id, false);
            insert junction;
        }
        Test.stopTest();

        // Then
        Assert.isNotNull(junction.Id, 'Editor should be able to insert a CapabilityTag junction record');
        Integer count = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE Id = :junction.Id];
        Assert.areEqual(1, count, 'Exactly one junction record should exist');
    }

    // ─── Cascade deletes ──────────────────────────────────────────────────────

    // @spec capability-tag-object.md · "Capabilities can be linked to Tags and links cascade-delete correctly" · "Deleting a Capability deletes its tag links"
    @IsTest
    static void deleteParentCapability_cascadesDeletesJunction() {
        // Given
        bcm_Capability__c cap = [SELECT Id FROM bcm_Capability__c LIMIT 1];
        bcm_Tag__c tag = [SELECT Id FROM bcm_Tag__c LIMIT 1];
        TestDataFactory.createCapabilityTag(cap.Id, tag.Id, true);

        // When
        Test.startTest();
        delete cap;
        Test.stopTest();

        // Then
        Integer remaining = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE bcm_Tag__c = :tag.Id];
        Assert.areEqual(0, remaining, 'Junction record should be cascade-deleted when parent Capability is deleted');
    }

    // @spec capability-tag-object.md · "Capabilities can be linked to Tags and links cascade-delete correctly" · "Deleting a Tag deletes its capability links"
    @IsTest
    static void deleteParentTag_cascadesDeletesJunction() {
        // Given
        bcm_Capability__c cap = [SELECT Id FROM bcm_Capability__c LIMIT 1];
        bcm_Tag__c tag = [SELECT Id FROM bcm_Tag__c LIMIT 1];
        TestDataFactory.createCapabilityTag(cap.Id, tag.Id, true);

        // When
        Test.startTest();
        delete tag;
        Test.stopTest();

        // Then
        Integer remaining = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE bcm_Capability__c = :cap.Id];
        Assert.areEqual(0, remaining, 'Junction record should be cascade-deleted when parent Tag is deleted');
    }

    // ─── Permission boundaries ────────────────────────────────────────────────

    // @spec capability-tag-object.md · "Permission sets grant correct access to Capability-Tag links" · "Viewer cannot create a Capability-Tag link"
    @IsTest
    static void viewer_cannotCreateJunction() {
        Test.startTest();
        ObjectPermissions op = [
            SELECT PermissionsCreate FROM ObjectPermissions
            WHERE Parent.Name = 'bcm_Viewer' AND SObjectType = 'bcm_CapabilityTag__c'
            LIMIT 1
        ];
        Test.stopTest();

        Assert.isFalse(
            op.PermissionsCreate,
            'bcm_Viewer must not grant Create on bcm_CapabilityTag__c'
        );
    }

    // @spec capability-tag-object.md · "Permission sets grant correct access to Capability-Tag links" · "Editor can create and delete a Capability-Tag link"
    @IsTest
    static void editor_deletesJunction_succeeds() {
        // Given — user created before System.runAs to avoid mixed-DML; records created inside runAs so editor owns them
        User editor = TestDataFactory.createUserWithPermSet('bcm_Editor');

        // When
        Id junctionId;
        Test.startTest();
        System.runAs(editor) {
            bcm_Map__c m = TestDataFactory.createMap('Editor Map', true);
            bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, null, true);
            bcm_Tag__c tag = TestDataFactory.createTag('Editor Tag', '#A8C7FF', true);
            bcm_CapabilityTag__c junction = TestDataFactory.createCapabilityTag(cap.Id, tag.Id, true);
            junctionId = junction.Id;
            delete junction;
        }
        Test.stopTest();

        // Then
        Integer remaining = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE Id = :junctionId];
        Assert.areEqual(0, remaining, 'Editor should be able to delete a junction record');
    }
}
