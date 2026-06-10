@IsTest(SeeAllData=false)
private class bcm_CapabilityTagTest {
    @TestSetup
    static void setupTestData() {
        bcm_Map__c m = TestDataFactory.createMap('Test Map', true);
        // L1 root required so L2 child is not treated as root by the trigger
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
        TestDataFactory.createTag('Blue Tag', '#BDD0EE', true);
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
            bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
            bcm_Capability__c l2 = TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
            bcm_Tag__c tag = TestDataFactory.createTag('Editor Tag', '#BDD0EE', true);
            junction = TestDataFactory.createCapabilityTag(l2.Id, tag.Id, false);
            insert junction;
        }
        Test.stopTest();

        // Then
        Assert.isNotNull(
            junction.Id,
            'Editor should be able to insert a CapabilityTag junction record'
        );
        Integer count = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE Id = :junction.Id];
        Assert.areEqual(1, count, 'Exactly one junction record should exist');
    }

    // ─── Cascade deletes ──────────────────────────────────────────────────────

    // @spec capability-tag-object.md · "Capabilities can be linked to Tags and links cascade-delete correctly" · "Deleting a Capability deletes its tag links"
    @IsTest
    static void deleteParentCapability_cascadesDeletesJunction() {
        // Given — use the L2 child so the validation rule does not block the tag link
        bcm_Capability__c cap = [SELECT Id FROM bcm_Capability__c WHERE bcm_Level__c = 2 LIMIT 1];
        bcm_Tag__c tag = [SELECT Id FROM bcm_Tag__c LIMIT 1];
        TestDataFactory.createCapabilityTag(cap.Id, tag.Id, true);

        // When
        Test.startTest();
        delete cap;
        Test.stopTest();

        // Then
        Integer remaining = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE bcm_Tag__c = :tag.Id];
        Assert.areEqual(
            0,
            remaining,
            'Junction record should be cascade-deleted when parent Capability is deleted'
        );
    }

    // @spec capability-tag-object.md · "Capabilities can be linked to Tags and links cascade-delete correctly" · "Deleting a Tag deletes its capability links"
    @IsTest
    static void deleteParentTag_cascadesDeletesJunction() {
        // Given — use the L2 child so the validation rule does not block the tag link
        bcm_Capability__c cap = [SELECT Id FROM bcm_Capability__c WHERE bcm_Level__c = 2 LIMIT 1];
        bcm_Tag__c tag = [SELECT Id FROM bcm_Tag__c LIMIT 1];
        TestDataFactory.createCapabilityTag(cap.Id, tag.Id, true);

        // When
        Test.startTest();
        delete tag;
        Test.stopTest();

        // Then
        Integer remaining = [
            SELECT COUNT()
            FROM bcm_CapabilityTag__c
            WHERE bcm_Capability__c = :cap.Id
        ];
        Assert.areEqual(
            0,
            remaining,
            'Junction record should be cascade-deleted when parent Tag is deleted'
        );
    }

    // ─── Validation rule: no tag on L1 ───────────────────────────────────────

    // @spec capability-tag-object.md · "Tags cannot be assigned to L1 capabilities" · "Tagging an L1 capability is rejected"
    @IsTest
    static void insertJunctionOnL1Capability_throwsDmlException() {
        // Given
        bcm_Map__c m = TestDataFactory.createMap('L1 Map', true);
        bcm_Capability__c l1Cap = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Tag__c tag = TestDataFactory.createTag('L1 Tag', '#BDD0EE', true);
        bcm_CapabilityTag__c junction = TestDataFactory.createCapabilityTag(
            l1Cap.Id,
            tag.Id,
            false
        );

        // When / Then
        Test.startTest();
        try {
            insert junction;
            Assert.fail('Expected DmlException for tagging an L1 capability');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('Tags cannot be assigned to L1 (top-level) capabilities.'),
                'Exception message should match validation rule text'
            );
        }
        Test.stopTest();
    }

    // ─── Permission boundaries ────────────────────────────────────────────────

    // @spec capability-tag-object.md · "Permission sets grant correct access to Capability-Tag links" · "Viewer cannot create a Capability-Tag link"
    @IsTest
    static void viewer_cannotCreateJunction() {
        Test.startTest();
        ObjectPermissions op = [
            SELECT PermissionsCreate
            FROM ObjectPermissions
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
            bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
            bcm_Capability__c l2 = TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
            bcm_Tag__c tag = TestDataFactory.createTag('Editor Tag', '#BDD0EE', true);
            bcm_CapabilityTag__c junction = TestDataFactory.createCapabilityTag(
                l2.Id,
                tag.Id,
                true
            );
            junctionId = junction.Id;
            delete junction;
        }
        Test.stopTest();

        // Then
        Integer remaining = [SELECT COUNT() FROM bcm_CapabilityTag__c WHERE Id = :junctionId];
        Assert.areEqual(0, remaining, 'Editor should be able to delete a junction record');
    }
}
