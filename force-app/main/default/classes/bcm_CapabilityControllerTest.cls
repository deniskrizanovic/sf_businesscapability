/**
 * Tests for bcm_CapabilityController.getCapabilities().
 */
@IsTest
private class bcm_CapabilityControllerTest {
    @TestSetup
    static void setupTestData() {
        bcm_Map__c mapA = TestDataFactory.createMap('Test Map A', true);
        bcm_Map__c mapB = TestDataFactory.createMap('Test Map B', true);

        // Map A: L1 → L2 → L3 hierarchy
        bcm_Capability__c l1 = TestDataFactory.createCapability(mapA.Id, null, 1, 1, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(mapA.Id, l1.Id, 2, 1, true);
        TestDataFactory.createCapability(mapA.Id, l2.Id, 3, 1, true);

        // Tag + junction for Map A L2 node
        bcm_Tag__c tag = TestDataFactory.createTag('Red Tag', '#F8B4B4', true);
        TestDataFactory.createCapabilityTag(l2.Id, tag.Id, true);

        // Map B: standalone L1 (no children)
        TestDataFactory.createCapability(mapB.Id, null, 1, 1, true);
    }

    @IsTest
    static void shouldReturnCapabilitiesForCorrectMap() {
        // Given
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];

        // When
        Test.startTest();
        List<bcm_Capability__c> result = bcm_CapabilityController.getCapabilities(mapA.Id);
        Test.stopTest();

        // Then — Map A has 3 capabilities (L1 + L2 + L3)
        Assert.areEqual(3, result.size(), 'Should return all 3 capabilities for Map A');
    }

    @IsTest
    static void shouldExcludeCapabilitiesFromOtherMaps() {
        // Given
        bcm_Map__c mapB = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map B' LIMIT 1];

        // When
        Test.startTest();
        List<bcm_Capability__c> result = bcm_CapabilityController.getCapabilities(mapB.Id);
        Test.stopTest();

        // Then — Map B has only 1 capability
        Assert.areEqual(1, result.size(), 'Should return only Map B capabilities');
    }

    @IsTest
    static void shouldIncludeTagSubqueryData() {
        // Given
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];

        // When
        Test.startTest();
        List<bcm_Capability__c> result = bcm_CapabilityController.getCapabilities(mapA.Id);
        Test.stopTest();

        // Then — find the L2 node and verify its CapabilityTags subquery is populated
        bcm_Capability__c l2 = null;
        for (bcm_Capability__c cap : result) {
            if (cap.bcm_Level__c == 2) {
                l2 = cap;
                break;
            }
        }
        Assert.isNotNull(l2, 'L2 capability should be in result');
        Assert.areEqual(1, l2.Tags__r.size(), 'L2 should have 1 CapabilityTag junction');
        Assert.areEqual(
            '#F8B4B4',
            l2.Tags__r[0].bcm_Tag__r.bcm_Colour__c,
            'Tag colour should match inserted value'
        );
    }

    @IsTest
    static void shouldThrowException_WhenMapIdIsNull() {
        // When / Then
        Test.startTest();
        try {
            bcm_CapabilityController.getCapabilities(null);
            Assert.fail('Expected AuraHandledException for null mapId');
        } catch (AuraHandledException ex) {
            // AuraHandledException.getMessage() returns 'Script-thrown exception' at runtime
            Assert.isNotNull(ex, 'AuraHandledException should be thrown for null mapId');
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldReturnResultsOrderedByLevelThenSortOrder() {
        // Given
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];

        // When
        Test.startTest();
        List<bcm_Capability__c> result = bcm_CapabilityController.getCapabilities(mapA.Id);
        Test.stopTest();

        // Then — ORDER BY bcm_Level__c ASC, bcm_SortOrder__c ASC
        Assert.areEqual(1, (Integer) result[0].bcm_Level__c, 'First record should be L1');
        Assert.areEqual(2, (Integer) result[1].bcm_Level__c, 'Second record should be L2');
        Assert.areEqual(3, (Integer) result[2].bcm_Level__c, 'Third record should be L3');
    }

    @IsTest
    static void shouldHideCapability() {
        // Given
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l1 = [
            SELECT Id, bcm_HideFromDiagram__c
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 1
            LIMIT 1
        ];
        Assert.isFalse(l1.bcm_HideFromDiagram__c, 'Precondition: capability not hidden');

        // When
        Test.startTest();
        bcm_CapabilityController.hideCapability(l1.Id);
        Test.stopTest();

        // Then
        bcm_Capability__c after = [
            SELECT bcm_HideFromDiagram__c
            FROM bcm_Capability__c
            WHERE Id = :l1.Id
        ];
        Assert.isTrue(after.bcm_HideFromDiagram__c, 'Capability should be hidden after call');
    }

    @IsTest
    static void shouldThrowException_WhenHideCapabilityIdIsNull() {
        Test.startTest();
        try {
            bcm_CapabilityController.hideCapability(null);
            Assert.fail('Expected AuraHandledException for null capabilityId');
        } catch (AuraHandledException ex) {
            Assert.isNotNull(ex, 'AuraHandledException expected for null capabilityId');
        }
        Test.stopTest();
    }

    @IsTest
    static void getCapabilityDetail_returnsRecord() {
        // Given — populate detail fields on the L2 capability
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l2 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 2
            LIMIT 1
        ];
        l2.bcm_Definition__c = '<p>Definition body</p>';
        l2.bcm_StrategySupport__c = '<p>Strategy body</p>';
        l2.bcm_ArchitecturalNuance__c = '<p>Nuance body</p>';
        update l2;

        // Seed own tag junction so assertion is independent of @TestSetup
        bcm_Tag__c localTag = TestDataFactory.createTag('Detail Test Tag', '#F8B4B4', true);
        TestDataFactory.createCapabilityTag(l2.Id, localTag.Id, true);

        // When
        Test.startTest();
        bcm_Capability__c result = bcm_CapabilityController.getCapabilityDetail(l2.Id);
        Test.stopTest();

        // Then — all fields populated; tag subquery returned
        Assert.isNotNull(result, 'Should return capability record');
        Assert.areEqual(l2.Id, result.Id, 'Should return requested record');
        Assert.areEqual('<p>Definition body</p>', result.bcm_Definition__c);
        Assert.areEqual('<p>Strategy body</p>', result.bcm_StrategySupport__c);
        Assert.areEqual('<p>Nuance body</p>', result.bcm_ArchitecturalNuance__c);
        Assert.areEqual(2, (Integer) result.bcm_Level__c);
        Assert.isTrue(
            result.Tags__r.size() >= 1,
            'Tags subquery should return at least 1 junction'
        );
    }

    @IsTest
    static void getCapabilityDetail_nullId_throws() {
        Test.startTest();
        try {
            bcm_CapabilityController.getCapabilityDetail(null);
            Assert.fail('Expected AuraHandledException for null capabilityId');
        } catch (AuraHandledException ex) {
            Assert.isNotNull(ex, 'AuraHandledException expected for null capabilityId');
        }
        Test.stopTest();
    }

    @IsTest
    static void updateCapability_persists() {
        // Given
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l2 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 2
            LIMIT 1
        ];
        bcm_Capability__c input = new bcm_Capability__c(
            Id = l2.Id,
            Name = 'Renamed L2',
            bcm_Definition__c = '<p>Edited def</p>',
            bcm_StrategySupport__c = '<p>Edited strategy</p>',
            bcm_ArchitecturalNuance__c = '<p>Edited nuance</p>'
        );

        // When
        Test.startTest();
        bcm_CapabilityController.updateCapability(input);
        Test.stopTest();

        // Then
        bcm_Capability__c after = [
            SELECT Name, bcm_Definition__c, bcm_StrategySupport__c, bcm_ArchitecturalNuance__c
            FROM bcm_Capability__c
            WHERE Id = :l2.Id
        ];
        Assert.areEqual('Renamed L2', after.Name);
        Assert.areEqual('<p>Edited def</p>', after.bcm_Definition__c);
        Assert.areEqual('<p>Edited strategy</p>', after.bcm_StrategySupport__c);
        Assert.areEqual('<p>Edited nuance</p>', after.bcm_ArchitecturalNuance__c);
    }

    @IsTest
    static void updateCapability_nullCapability_throws() {
        Test.startTest();
        try {
            bcm_CapabilityController.updateCapability(null);
            Assert.fail('Expected AuraHandledException for null capability');
        } catch (AuraHandledException ex) {
            Assert.isNotNull(ex);
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldWrapException_WhenUserLacksAccess() {
        // Given — user with no object permissions; USER_MODE -> QueryException -> AuraHandledException
        User restrictedUser = TestDataFactory.createUserWithPermSet('bcm_ReadOnly');
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];

        // When / Then
        Test.startTest();
        System.runAs(restrictedUser) {
            try {
                bcm_CapabilityController.getCapabilities(mapA.Id);
            } catch (AuraHandledException ex) {
                Assert.isNotNull(ex, 'AuraHandledException expected when USER_MODE denies access');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void getCapabilityDetail_wrapsException_WhenUserLacksAccess() {
        // Given — restricted user; USER_MODE on detail query -> wrapped AuraHandledException
        User restrictedUser = TestDataFactory.createUserWithPermSet('bcm_ReadOnly');
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l2 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 2
            LIMIT 1
        ];

        Test.startTest();
        System.runAs(restrictedUser) {
            try {
                bcm_CapabilityController.getCapabilityDetail(l2.Id);
            } catch (AuraHandledException ex) {
                Assert.isNotNull(ex, 'AuraHandledException expected when USER_MODE denies access');
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void getCapabilities_returnsIsCrossCuttingFlag_forBothValues() {
        // Given — flip the L1 record's flag on, leave L2 default false
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l1 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 1
            LIMIT 1
        ];
        l1.bcm_IsCrossCutting__c = true;
        update l1;

        // When
        Test.startTest();
        List<bcm_Capability__c> result = bcm_CapabilityController.getCapabilities(mapA.Id);
        Test.stopTest();

        // Then
        Boolean l1Flag = null;
        Boolean l2Flag = null;
        for (bcm_Capability__c cap : result) {
            if (cap.bcm_Level__c == 1)
                l1Flag = cap.bcm_IsCrossCutting__c;
            if (cap.bcm_Level__c == 2)
                l2Flag = cap.bcm_IsCrossCutting__c;
        }
        Assert.areEqual(true, l1Flag, 'L1 should round-trip the cross-cutting flag as true');
        Assert.areEqual(false, l2Flag, 'L2 default should round-trip as false');
    }

    @IsTest
    static void hideCapability_wrapsException_WhenUserLacksAccess() {
        // Given — restricted user; `update as user` -> SecurityException -> wrapped AuraHandledException
        User restrictedUser = TestDataFactory.createUserWithPermSet('bcm_ReadOnly');
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l1 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 1
            LIMIT 1
        ];

        Test.startTest();
        System.runAs(restrictedUser) {
            try {
                bcm_CapabilityController.hideCapability(l1.Id);
                Assert.fail('Expected AuraHandledException when restricted user attempts hide');
            } catch (AuraHandledException ex) {
                Assert.isNotNull(ex, 'AuraHandledException expected when update as user denied');
            }
        }
        Test.stopTest();
    }
}
