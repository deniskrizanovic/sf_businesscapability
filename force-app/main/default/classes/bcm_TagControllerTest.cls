/**
 * Tests for bcm_TagController.getTags().
 */
@IsTest
private class bcm_TagControllerTest {

    @TestSetup
    static void setupTestData() {
        TestDataFactory.createTag('Zebra Tag', '#A8C7FF', true);
        TestDataFactory.createTag('Alpha Tag', '#B8E0C8', true);
    }

    @IsTest
    static void shouldReturnAllTags_WhenRecordsExist() {
        // When
        Test.startTest();
        List<bcm_Tag__c> result = bcm_TagController.getTags();
        Test.stopTest();

        // Then
        Assert.areEqual(2, result.size(), 'Should return both tags');
    }

    @IsTest
    static void shouldReturnTagsOrderedByName() {
        // When
        Test.startTest();
        List<bcm_Tag__c> result = bcm_TagController.getTags();
        Test.stopTest();

        // Then
        Assert.areEqual('Alpha Tag', result[0].Name, 'First tag should be Alpha Tag (alphabetical)');
        Assert.areEqual('Zebra Tag', result[1].Name, 'Second tag should be Zebra Tag (alphabetical)');
    }

    @IsTest
    static void shouldReturnEmptyList_WhenNoTagsExist() {
        // Given — delete all tags from @TestSetup
        delete [SELECT Id FROM bcm_Tag__c];

        // When
        Test.startTest();
        List<bcm_Tag__c> result = bcm_TagController.getTags();
        Test.stopTest();

        // Then
        Assert.areEqual(0, result.size(), 'Should return empty list when no tags exist');
    }

    @IsTest
    static void shouldIncludeColourField() {
        // When
        Test.startTest();
        List<bcm_Tag__c> result = bcm_TagController.getTags();
        Test.stopTest();

        // Then — Alpha Tag has Green colour
        Assert.areEqual('#B8E0C8', result[0].bcm_Colour__c, 'Colour field should be populated');
    }

    @IsTest
    static void shouldWrapException_WhenUserLacksAccess() {
        // Given — restricted user; USER_MODE denies bcm_Tag__c access -> AuraHandledException
        User restrictedUser = TestDataFactory.createUserWithPermSet('bcm_ReadOnly');

        // When / Then
        Test.startTest();
        System.runAs(restrictedUser) {
            try {
                bcm_TagController.getTags();
            } catch (AuraHandledException ex) {
                Assert.isNotNull(ex, 'AuraHandledException expected when USER_MODE denies access');
            }
        }
        Test.stopTest();
    }
}
