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
    static void updateCapability_persists_allowlistedFields() {
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
    static void updateCapability_ignoresFieldsOutsideAllowlist() {
        // Given — caller attempts to mutate SortOrder (not in allowlist)
        bcm_Capability__c cap = [
            SELECT Id, bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        Decimal originalSort = cap.bcm_SortOrder__c;
        bcm_Capability__c input = new bcm_Capability__c(
            Id                = cap.Id,
            Name              = 'Allowlist Check',
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
        Assert.areEqual('Allowlist Check', after.Name);
        Assert.areEqual(originalSort, after.bcm_SortOrder__c,
            'SortOrder must not be touched by service.updateCapability');
    }

    @IsTest
    static void updateCapability_partialInput_preservesUnsetFields() {
        // Given — record seeded with Definition / Strategy / Nuance values
        bcm_Capability__c cap = [
            SELECT Id, Name, bcm_Definition__c, bcm_StrategySupport__c,
                   bcm_ArchitecturalNuance__c, bcm_HideFromDiagram__c
            FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        String  origDef    = cap.bcm_Definition__c;
        String  origStrat  = cap.bcm_StrategySupport__c;
        String  origNuance = cap.bcm_ArchitecturalNuance__c;
        Boolean origHide   = cap.bcm_HideFromDiagram__c;

        // Caller submits ONLY a Name change — other fields left null on input
        bcm_Capability__c input = new bcm_Capability__c(
            Id   = cap.Id,
            Name = 'Only Name Changed'
        );

        // When
        Test.startTest();
        bcm_CapabilityService.updateCapability(input);
        Test.stopTest();

        // Then — Name updated; other fields untouched (no null overwrite)
        bcm_Capability__c after = [
            SELECT Name, bcm_Definition__c, bcm_StrategySupport__c,
                   bcm_ArchitecturalNuance__c, bcm_HideFromDiagram__c
            FROM bcm_Capability__c WHERE Id = :cap.Id
        ];
        Assert.areEqual('Only Name Changed', after.Name);
        Assert.areEqual(origDef,    after.bcm_Definition__c,
            'Definition must not be nulled when input omits it');
        Assert.areEqual(origStrat,  after.bcm_StrategySupport__c,
            'StrategySupport must not be nulled when input omits it');
        Assert.areEqual(origNuance, after.bcm_ArchitecturalNuance__c,
            'ArchitecturalNuance must not be nulled when input omits it');
        Assert.areEqual(origHide,   after.bcm_HideFromDiagram__c,
            'HideFromDiagram must not be flipped when input omits it');
    }

    @IsTest
    static void updateCapability_emptyString_clearsRichTextField() {
        // Given — record with seeded Definition
        bcm_Capability__c cap = [
            SELECT Id, bcm_Definition__c FROM bcm_Capability__c
            WHERE bcm_Map__r.Name = 'Service Test Map' LIMIT 1
        ];
        Assert.isNotNull(cap.bcm_Definition__c, 'Precondition: Definition seeded');

        // When — empty string is the explicit "clear" signal
        // (Salesforce coerces empty rich-text to null on persist; both reflect "cleared".)
        Test.startTest();
        bcm_CapabilityService.updateCapability(new bcm_Capability__c(
            Id                = cap.Id,
            bcm_Definition__c = ''
        ));
        Test.stopTest();

        // Then
        bcm_Capability__c after = [
            SELECT bcm_Definition__c FROM bcm_Capability__c WHERE Id = :cap.Id
        ];
        Assert.isTrue(String.isBlank(after.bcm_Definition__c),
            'Empty string input should clear the field (null or empty after persist)');
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
