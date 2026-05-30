/**
 * Tests for bcm_MapController.getMaps().
 */
@IsTest
private class bcm_MapControllerTest {

    @TestSetup
    static void setupTestData() {
        TestDataFactory.createMap('Map Alpha', true);
        TestDataFactory.createMap('Map Beta', true);
    }

    @IsTest
    static void shouldReturnAllMaps_WhenRecordsExist() {
        // When
        Test.startTest();
        List<bcm_Map__c> result = bcm_MapController.getMaps();
        Test.stopTest();

        // Then
        Assert.areEqual(2, result.size(), 'Should return both maps');
    }

    @IsTest
    static void shouldReturnMapsOrderedByName() {
        // When
        Test.startTest();
        List<bcm_Map__c> result = bcm_MapController.getMaps();
        Test.stopTest();

        // Then
        Assert.areEqual('Map Alpha', result[0].Name, 'First record should be Map Alpha (alphabetical)');
        Assert.areEqual('Map Beta',  result[1].Name, 'Second record should be Map Beta (alphabetical)');
    }

    @IsTest
    static void shouldReturnEmptyList_WhenNoMapsExist() {
        // Given — delete all maps created in @TestSetup
        delete [SELECT Id FROM bcm_Map__c];

        // When
        Test.startTest();
        List<bcm_Map__c> result = bcm_MapController.getMaps();
        Test.stopTest();

        // Then
        Assert.areEqual(0, result.size(), 'Should return empty list when no maps exist');
    }
}
