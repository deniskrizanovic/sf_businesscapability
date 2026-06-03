/**
 * Tests for bcm_CapabilityService.
 */
@IsTest
private class bcm_CapabilityServiceTest {

    @TestSetup
    static void setupTestData() {
        bcm_Map__c m = TestDataFactory.createMap('Service Test Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        l1.bcm_Definition__c          = '<p>Original def</p>';
        l1.bcm_StrategySupport__c     = '<p>Original strategy</p>';
        l1.bcm_ArchitecturalNuance__c = '<p>Original nuance</p>';
        update l1;
    }

    @IsTest
    static void updateCapability_persists_whitelistedFields() {
        // Given
        bcm_Capability__c cap = [
            SELECT Id, Name, bcm_Definition__c, bcm_StrategySupport__c, bcm_ArchitecturalNuance__c
            FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map'
            LIMIT 1
        ];
        bcm_Capability__c input = new bcm_Capability__c(
            Id                          = cap.Id,
            Name                        = 'Updated Name',
            bcm_Definition__c           = '<p>New def</p>',
            bcm_StrategySupport__c      = '<p>New strategy</p>',
            bcm_ArchitecturalNuance__c  = '<p>New nuance</p>'
        );

        // When
        Test.startTest();
        bcm_CapabilityService.updateCapability(input);
        Test.stopTest();

        // Then
        bcm_Capability__c after = [
            SELECT Name, bcm_Definition__c, bcm_StrategySupport__c, bcm_ArchitecturalNuance__c
            FROM bcm_Capability__c WHERE Id = :cap.Id
        ];
        Assert.areEqual('Updated Name',           after.Name);
        Assert.areEqual('<p>New def</p>',         after.bcm_Definition__c);
        Assert.areEqual('<p>New strategy</p>',    after.bcm_StrategySupport__c);
        Assert.areEqual('<p>New nuance</p>',      after.bcm_ArchitecturalNuance__c);
    }

    @IsTest
    static void updateCapability_ignoresFieldsOutsideWhitelist() {
        // Given — caller attempts to mutate SortOrder (not in whitelist)
        bcm_Capability__c cap = [
            SELECT Id, bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        Decimal originalSort = cap.bcm_SortOrder__c;
        bcm_Capability__c input = new bcm_Capability__c(
            Id                = cap.Id,
            Name              = 'Whitelist Check',
            bcm_SortOrder__c  = 9999
        );

        // When
        Test.startTest();
        bcm_CapabilityService.updateCapability(input);
        Test.stopTest();

        // Then — SortOrder NOT changed; Name updated
        bcm_Capability__c after = [
            SELECT Name, bcm_SortOrder__c
            FROM bcm_Capability__c WHERE Id = :cap.Id
        ];
        Assert.areEqual('Whitelist Check', after.Name);
        Assert.areEqual(originalSort, after.bcm_SortOrder__c,
            'SortOrder must not be touched by service.updateCapability');
    }

    @IsTest
    static void updateCapability_persists_hideFromDiagram() {
        // Given
        bcm_Capability__c cap = [
            SELECT Id, bcm_HideFromDiagram__c
            FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        Assert.isFalse(cap.bcm_HideFromDiagram__c, 'Precondition: hide false');

        // When — flip on
        Test.startTest();
        bcm_CapabilityService.updateCapability(new bcm_Capability__c(
            Id                     = cap.Id,
            bcm_HideFromDiagram__c = true
        ));
        // And — flip off
        bcm_CapabilityService.updateCapability(new bcm_Capability__c(
            Id                     = cap.Id,
            bcm_HideFromDiagram__c = false
        ));
        Test.stopTest();

        // Then
        bcm_Capability__c after = [
            SELECT bcm_HideFromDiagram__c
            FROM bcm_Capability__c WHERE Id = :cap.Id
        ];
        Assert.isFalse(after.bcm_HideFromDiagram__c,
            'Hide must reflect final value supplied to service');
    }

    @IsTest
    static void updateCapability_nullCapability_throws() {
        Test.startTest();
        try {
            bcm_CapabilityService.updateCapability(null);
            Assert.fail('Expected IllegalArgumentException for null capability');
        } catch (IllegalArgumentException ex) {
            Assert.isNotNull(ex);
        }
        Test.stopTest();
    }

    @IsTest
    static void updateCapability_nullId_throws() {
        Test.startTest();
        try {
            bcm_CapabilityService.updateCapability(new bcm_Capability__c(Name = 'no-id'));
            Assert.fail('Expected IllegalArgumentException for missing Id');
        } catch (IllegalArgumentException ex) {
            Assert.isNotNull(ex);
        }
        Test.stopTest();
    }

    @IsTest
    static void updateCapability_viewer_isRejected() {
        // Given — viewer has no Edit on bcm_Capability__c; `update as user` must reject.
        bcm_Capability__c cap = [
            SELECT Id FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        User viewer = TestDataFactory.createUserWithPermSet('bcm_Viewer');

        Boolean rejected = false;
        Test.startTest();
        System.runAs(viewer) {
            try {
                bcm_CapabilityService.updateCapability(new bcm_Capability__c(
                    Id   = cap.Id,
                    Name = 'Should not save'
                ));
            } catch (Exception ex) {
                rejected = true;
            }
        }
        Test.stopTest();

        Assert.isTrue(rejected, 'Viewer must not be able to update via service');
    }
}
