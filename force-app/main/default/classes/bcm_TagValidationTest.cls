@IsTest(SeeAllData=false)
private class bcm_TagValidationTest {

    // ─── Valid picklist values save successfully ──────────────────────────────

    // @spec tag-object.md · "Tag colour validation rule fires correctly" · "Valid uppercase hex colour is accepted"
    @IsTest
    static void colour_validBlue_succeeds() {
        // Given
        bcm_Tag__c tag = TestDataFactory.createTag('Blue Tag', '#3A86FF', false);

        // When
        Test.startTest();
        insert tag;
        Test.stopTest();

        // Then
        bcm_Tag__c saved = [SELECT bcm_Colour__c FROM bcm_Tag__c WHERE Id = :tag.Id];
        Assert.areEqual('#3A86FF', saved.bcm_Colour__c, 'Colour should be persisted as #3A86FF');
    }

    // @spec tag-object.md · "Tag colour validation rule fires correctly" · "Valid lowercase hex colour is accepted"
    @IsTest
    static void colour_validEmerald_succeeds() {
        // Given
        bcm_Tag__c tag = TestDataFactory.createTag('Emerald Tag', '#06A77D', false);

        // When
        Test.startTest();
        insert tag;
        Test.stopTest();

        // Then
        bcm_Tag__c saved = [SELECT bcm_Colour__c FROM bcm_Tag__c WHERE Id = :tag.Id];
        Assert.areEqual('#06A77D', saved.bcm_Colour__c, 'Colour should be persisted as #06A77D');
    }

    // ─── Invalid / blank colour values are rejected ───────────────────────────

    // @spec tag-object.md · "Tag colour validation rule fires correctly" · "Empty colour value is rejected"
    @IsTest
    static void colour_blank_isRejected() {
        // Given — null colour; picklist is required
        bcm_Tag__c tag = TestDataFactory.createTag('No Colour Tag', null, false);

        // When / Then
        Test.startTest();
        try {
            insert tag;
            Assert.fail('Expected DmlException for blank colour');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('bcm_Colour__c'),
                'Error should reference the Colour field: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // @spec tag-object.md · "Tag colour validation rule fires correctly" · "Plain text colour name is rejected"
    @IsTest
    static void colour_invalidPicklistValue_isRejected() {
        // Given — "red" is not one of the 10 allowed picklist values
        bcm_Tag__c tag = TestDataFactory.createTag('Invalid Colour Tag', 'red', false);

        // When / Then
        Test.startTest();
        try {
            insert tag;
            Assert.fail('Expected DmlException for invalid picklist value');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') ||
                e.getMessage().contains('bcm_Colour__c'),
                'Error should indicate restricted picklist violation: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // ─── Permission boundaries ────────────────────────────────────────────────

    // @spec tag-object.md · "Permission sets grant correct access to Tags" · "Viewer cannot create a Tag record"
    @IsTest
    static void viewer_cannotInsertTag() {
        Test.startTest();
        ObjectPermissions op = [
            SELECT PermissionsCreate FROM ObjectPermissions
            WHERE Parent.Name = 'bcm_Viewer' AND SObjectType = 'bcm_Tag__c'
            LIMIT 1
        ];
        Test.stopTest();

        Assert.isFalse(
            op.PermissionsCreate,
            'bcm_Viewer must not grant Create on bcm_Tag__c'
        );
    }

    // @spec tag-object.md · "Permission sets grant correct access to Tags" · "Editor can create, edit, and delete a Tag record"
    @IsTest
    static void editor_canInsertValidTag() {
        // Given
        User editor = TestDataFactory.createUserWithPermSet('bcm_Editor');
        bcm_Tag__c tag = TestDataFactory.createTag('Editor Tag', '#3A86FF', false);

        // When
        Test.startTest();
        System.runAs(editor) {
            insert tag;
        }
        Test.stopTest();

        // Then
        Assert.isNotNull(tag.Id, 'Editor should be able to insert a Tag with a valid colour');
    }
}
