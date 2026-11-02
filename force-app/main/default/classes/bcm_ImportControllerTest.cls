@IsTest(SeeAllData=false)
private class bcm_ImportControllerTest {
    // ─── Shared test fixture ──────────────────────────────────────────────────

    // 3-capability tree: L1 → L2 → L3, no tags.
    // The "tags" key is present to verify it is silently ignored.
    private static final String SAMPLE_JSON =
        '{' +
        '"mapName":"Test Import Map",' +
        '"mapDescription":"<p>Test description</p>",' +
        '"capabilities":[' +
        '{' +
        '"externalId":"cap-l1",' +
        '"name":"Domain 1",' +
        '"level":1,' +
        '"sortOrder":1,' +
        '"definition":"<p>L1 definition</p>",' +
        '"strategySupport":"<p>L1 strategy</p>",' +
        '"architecturalNuance":"<p>L1 nuance</p>",' +
        '"tags":["IGNORED"],' +
        '"children":[' +
        '{' +
        '"externalId":"cap-l2",' +
        '"name":"Group 1",' +
        '"level":2,' +
        '"sortOrder":1,' +
        '"definition":"<p>L2 definition</p>",' +
        '"strategySupport":"",' +
        '"architecturalNuance":"",' +
        '"children":[' +
        '{' +
        '"externalId":"cap-l3",' +
        '"name":"Capability 1",' +
        '"level":3,' +
        '"sortOrder":1,' +
        '"definition":"<p>L3 definition</p>",' +
        '"strategySupport":"",' +
        '"architecturalNuance":"",' +
        '"children":[]' +
        '}' +
        ']' +
        '}' +
        ']' +
        '}' +
        ']' +
        '}';

    // ─── Happy path ───────────────────────────────────────────────────────────

    // @spec import.md · "Successful import from valid JSON" · "Valid JSON creates a Map, Capabilities, and Tags"
    @IsTest
    static void happyPath_validJson_importsMapAndCapabilities() {
        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            SAMPLE_JSON
        );
        Test.stopTest();

        // Then — result
        Assert.isTrue(result.success, 'Import should succeed for valid JSON');
        Assert.areEqual(
            3,
            result.capabilitiesInserted,
            'Three capabilities should be inserted on first import'
        );
        Assert.areEqual(
            0,
            result.capabilitiesUpdated,
            'No capabilities should be updated on first import'
        );
        Assert.isNull(result.errorMessage, 'errorMessage should be null on success');

        // Then — Map record
        Integer mapCount = [
            SELECT COUNT()
            FROM bcm_Map__c
            WHERE Name = 'Test Import Map'
        ];
        Assert.areEqual(1, mapCount, 'Exactly one Map record should be created');

        // Then — Capability records
        Integer capCount = [SELECT COUNT() FROM bcm_Capability__c];
        Assert.areEqual(3, capCount, 'Three Capability records should exist');

        // Then — parent chain
        bcm_Capability__c l1 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cap-l1'
        ];
        bcm_Capability__c l2 = [
            SELECT Id, bcm_Parent__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cap-l2'
        ];
        bcm_Capability__c l3 = [
            SELECT Id, bcm_Parent__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cap-l3'
        ];
        Assert.areEqual(l1.Id, l2.bcm_Parent__c, 'L2 capability should be parented to L1');
        Assert.areEqual(l2.Id, l3.bcm_Parent__c, 'L3 capability should be parented to L2');
    }

    // @spec import.md · "Successful import from valid JSON" · "Rich text fields are stored as formatted content"
    @IsTest
    static void happyPath_richTextFields_storedAsIs() {
        // Given
        String richTextJson =
            '{' +
            '"mapName":"Rich Text Map",' +
            '"capabilities":[' +
            '{' +
            '"externalId":"rt-l1",' +
            '"name":"RT Domain",' +
            '"level":1,' +
            '"sortOrder":1,' +
            '"definition":"<p>Bold <strong>word</strong></p>",' +
            '"strategySupport":"<ul><li>item</li></ul>",' +
            '"architecturalNuance":"<p>nuance</p>",' +
            '"children":[]' +
            '}' +
            ']' +
            '}';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            richTextJson
        );
        Test.stopTest();

        // Then
        Assert.isTrue(result.success, 'Import should succeed for rich-text JSON');
        bcm_Capability__c saved = [
            SELECT bcm_Definition__c, bcm_StrategySupport__c, bcm_ArchitecturalNuance__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'rt-l1'
        ];
        Assert.areEqual(
            '<p>Bold <strong>word</strong></p>',
            saved.bcm_Definition__c,
            'Definition should be stored verbatim as supplied HTML'
        );
        Assert.areEqual(
            '<ul><li>item</li></ul>',
            saved.bcm_StrategySupport__c,
            'StrategySupport should be stored verbatim as supplied HTML'
        );
        Assert.areEqual(
            '<p>nuance</p>',
            saved.bcm_ArchitecturalNuance__c,
            'ArchitecturalNuance should be stored verbatim as supplied HTML'
        );
    }

    // @spec import.md · "Import is idempotent" · "Re-importing the same JSON does not create duplicates"
    @IsTest
    static void happyPath_reimport_isIdempotent() {
        // Given — first import
        bcm_ImportController.importCapabilities(SAMPLE_JSON);

        // When — second import with the same JSON
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            SAMPLE_JSON
        );
        Test.stopTest();

        // Then — result reflects updates, not inserts
        Assert.isTrue(result.success, 'Re-import should succeed');
        Assert.areEqual(
            0,
            result.capabilitiesInserted,
            'No new capabilities should be created on re-import'
        );
        Assert.areEqual(
            3,
            result.capabilitiesUpdated,
            'All three capabilities should be updated on re-import'
        );

        // Then — no duplicate records
        Integer mapCount = [
            SELECT COUNT()
            FROM bcm_Map__c
            WHERE Name = 'Test Import Map'
        ];
        Assert.areEqual(1, mapCount, 'Re-import must not create a duplicate Map record');

        Integer capCount = [SELECT COUNT() FROM bcm_Capability__c];
        Assert.areEqual(3, capCount, 'Re-import must not create duplicate Capability records');
    }

    // ─── Cross-cutting flag ───────────────────────────────────────────────────

    // @spec import.md · "Cross-cutting capabilities are imported" · "isCrossCutting true sets the flag on a Level 1 capability"
    @IsTest
    static void crossCutting_flagTrueOnL1_setsIsCrossCutting() {
        // Given
        String ccJson =
            '{' +
            '"mapName":"Cross-cutting Map",' +
            '"capabilities":[' +
            '{"externalId":"cc-l1","name":"Band","level":1,"sortOrder":1,"isCrossCutting":true,"children":[]},' +
            '{"externalId":"reg-l1","name":"Column","level":1,"sortOrder":2,"children":[]}' +
            ']' +
            '}';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            ccJson
        );
        Test.stopTest();

        // Then
        Assert.isTrue(result.success, 'Import should succeed for cross-cutting JSON');
        bcm_Capability__c band = [
            SELECT bcm_IsCrossCutting__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cc-l1'
        ];
        bcm_Capability__c column = [
            SELECT bcm_IsCrossCutting__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'reg-l1'
        ];
        Assert.isTrue(band.bcm_IsCrossCutting__c, 'isCrossCutting:true should set the flag');
        Assert.isFalse(
            column.bcm_IsCrossCutting__c,
            'Omitted isCrossCutting should default to false'
        );
    }

    // @spec import.md · "Cross-cutting capabilities are imported" · "Omitting isCrossCutting preserves an existing flag"
    @IsTest
    static void crossCutting_keyOmittedOnReimport_preservesExistingFlag() {
        // Given — L1 imported, then flagged by hand
        bcm_ImportController.importCapabilities(SAMPLE_JSON);
        bcm_Capability__c l1 = [
            SELECT Id
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cap-l1'
        ];
        l1.bcm_IsCrossCutting__c = true;
        update l1;

        // When — re-import JSON that has no isCrossCutting key
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            SAMPLE_JSON
        );
        Test.stopTest();

        // Then
        Assert.isTrue(result.success, 'Re-import should succeed');
        bcm_Capability__c saved = [
            SELECT bcm_IsCrossCutting__c
            FROM bcm_Capability__c
            WHERE Id = :l1.Id
        ];
        Assert.isTrue(
            saved.bcm_IsCrossCutting__c,
            'Re-import without isCrossCutting must not clear a hand-set flag'
        );
    }

    // @spec import.md · "Cross-cutting capabilities are imported" · "Re-import promotes a Level 2 capability to a cross-cutting Level 1"
    @IsTest
    static void crossCutting_reimportPromotesL2ToL1_clearsParentAndSetsFlag() {
        // Given — cap-l2 imported as a Level 2 child of cap-l1
        bcm_ImportController.importCapabilities(SAMPLE_JSON);
        String promotedJson =
            '{' +
            '"mapName":"Test Import Map",' +
            '"capabilities":[' +
            '{"externalId":"cap-l1","name":"Domain 1","level":1,"sortOrder":1,"children":[]},' +
            '{"externalId":"cap-l2","name":"Group 1","level":1,"sortOrder":2,"isCrossCutting":true,"children":[]}' +
            ']' +
            '}';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            promotedJson
        );
        Test.stopTest();

        // Then
        Assert.isTrue(result.success, 'Re-import should succeed');
        bcm_Capability__c promoted = [
            SELECT bcm_Level__c, bcm_Parent__c, bcm_IsCrossCutting__c
            FROM bcm_Capability__c
            WHERE bcm_ExternalId__c = 'cap-l2'
        ];
        Assert.areEqual(1, promoted.bcm_Level__c, 'Promoted capability should be Level 1');
        Assert.isNull(promoted.bcm_Parent__c, 'Promoted Level 1 capability should have no parent');
        Assert.isTrue(
            promoted.bcm_IsCrossCutting__c,
            'Promoted capability should be cross-cutting'
        );
    }

    // ─── Error handling ───────────────────────────────────────────────────────

    // @spec import.md · "Import errors are handled gracefully" · "Malformed JSON displays an error message"
    @IsTest
    static void error_malformedJson_returnsError() {
        // Given
        String badJson = 'not valid json {{{';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            badJson
        );
        Test.stopTest();

        // Then
        Assert.isFalse(result.success, 'Import should fail for malformed JSON');
        Assert.isNotNull(
            result.errorMessage,
            'errorMessage should be populated for malformed JSON'
        );

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for malformed JSON');
    }

    // @spec import.md · "Import errors are handled gracefully" · "A capability that fails validation rolls back the whole import"
    @IsTest
    static void error_capabilityFailsValidation_rollsBackAndReturnsError() {
        // Given — isCrossCutting on a Level 2 capability is rejected by validation
        String invalidJson =
            '{' +
            '"mapName":"Rollback Map",' +
            '"capabilities":[' +
            '{"externalId":"rb-l1","name":"Domain","level":1,"sortOrder":1,"children":[' +
            '{"externalId":"rb-l2","name":"Group","level":2,"sortOrder":1,"isCrossCutting":true,"children":[]}' +
            ']}' +
            ']' +
            '}';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result = bcm_ImportController.importCapabilities(
            invalidJson
        );
        Test.stopTest();

        // Then — failure is reported with the offending externalId
        Assert.isFalse(result.success, 'Import should fail when a capability fails validation');
        Assert.isNotNull(result.errorMessage, 'errorMessage should be populated');
        Assert.isTrue(
            result.errorMessage.contains('rb-l2'),
            'errorMessage should name the failing externalId: ' + result.errorMessage
        );
        Assert.areEqual(0, result.capabilitiesInserted, 'No inserts should be reported');
        Assert.areEqual(0, result.capabilitiesUpdated, 'No updates should be reported');

        // Then — nothing persisted, including the Map and the valid L1
        Assert.areEqual(0, [SELECT COUNT() FROM bcm_Map__c], 'Map insert should be rolled back');
        Assert.areEqual(
            0,
            [SELECT COUNT() FROM bcm_Capability__c],
            'Capability inserts should be rolled back'
        );
    }

    // @spec import.md · "Import errors are handled gracefully" · "Empty text area is rejected before submission"
    @IsTest
    static void error_emptyPayload_returnsError() {
        // When — empty string
        Test.startTest();
        bcm_ImportController.bcm_ImportResult resultEmpty = bcm_ImportController.importCapabilities(
            ''
        );
        Test.stopTest();

        // Then
        Assert.isFalse(resultEmpty.success, 'Empty string should produce a failure result');
        Assert.isNotNull(
            resultEmpty.errorMessage,
            'errorMessage should be populated for an empty payload'
        );

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for an empty payload');
    }

    @IsTest
    static void error_nullPayload_returnsError() {
        // When — null
        Test.startTest();
        bcm_ImportController.bcm_ImportResult resultNull = bcm_ImportController.importCapabilities(
            null
        );
        Test.stopTest();

        // Then
        Assert.isFalse(resultNull.success, 'Null payload should produce a failure result');
        Assert.isNotNull(
            resultNull.errorMessage,
            'errorMessage should be populated for a null payload'
        );

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for a null payload');
    }

    // ─── Permission boundary ──────────────────────────────────────────────────

    // @spec import.md · "Import UI is accessible from a Map record" · "Import panel is not accessible to Viewers"
    @IsTest
    static void permission_viewer_cannotCallImport() {
        // Given — create Viewer user before startTest to avoid mixed-DML issue
        User viewer = TestDataFactory.createUserWithPermSet('bcm_Viewer');

        // When / Then
        Test.startTest();
        System.runAs(viewer) {
            try {
                bcm_ImportController.importCapabilities(SAMPLE_JSON);
                Assert.fail('Expected AuraHandledException for Viewer without bcm_CanEdit');
            } catch (AuraHandledException e) {
                // AuraHandledException.getMessage() returns 'Script-thrown exception' in test
                // context — catching the specific type is the reliable assertion.
                Assert.isNotNull(e, 'AuraHandledException should be thrown for a Viewer');
            }
        }
        Test.stopTest();

        // Then — no records created
        Integer capCount = [SELECT COUNT() FROM bcm_Capability__c];
        Assert.areEqual(0, capCount, 'No Capability records should be created by a Viewer');
    }

    // ─── Invocable (Flow) entry point ─────────────────────────────────────────

    // @spec import.md · "Successful import from valid JSON" · "Valid JSON creates a Map, Capabilities, and Tags"
    @IsTest
    static void invocable_execute_delegatesAndReturnsResult() {
        // Given
        bcm_ImportController.FlowInput input = new bcm_ImportController.FlowInput();
        input.jsonPayload = SAMPLE_JSON;

        // When
        Test.startTest();
        List<bcm_ImportController.bcm_ImportResult> results = bcm_ImportController.execute(
            new List<bcm_ImportController.FlowInput>{ input }
        );
        Test.stopTest();

        // Then
        Assert.areEqual(1, results.size(), 'execute() should return a single-element list');
        bcm_ImportController.bcm_ImportResult result = results[0];
        Assert.isTrue(result.success, 'Invocable import should succeed for valid JSON');
        Assert.areEqual(
            3,
            result.capabilitiesInserted,
            'Three capabilities should be inserted via the invocable path'
        );
        Assert.isNull(result.errorMessage, 'errorMessage should be null on success');
    }

    // @spec import.md · "Import UI is accessible from a Map record" · "Import panel is not accessible to Viewers"
    @IsTest
    static void invocable_viewer_returnsAccessDenied() {
        // Given — create Viewer user before startTest to avoid mixed-DML issue
        User viewer = TestDataFactory.createUserWithPermSet('bcm_Viewer');

        bcm_ImportController.FlowInput input = new bcm_ImportController.FlowInput();
        input.jsonPayload = SAMPLE_JSON;

        // When
        Test.startTest();
        List<bcm_ImportController.bcm_ImportResult> results;
        System.runAs(viewer) {
            results = bcm_ImportController.execute(
                new List<bcm_ImportController.FlowInput>{ input }
            );
        }
        Test.stopTest();

        // Then — AuraHandledException is caught and returned as a failure result (not re-thrown)
        Assert.areEqual(1, results.size(), 'execute() should return a single-element list');
        bcm_ImportController.bcm_ImportResult result = results[0];
        Assert.isFalse(result.success, 'Viewer should not be able to import via the Flow path');
        Assert.isNotNull(
            result.errorMessage,
            'errorMessage should be populated when permission is denied'
        );

        Integer capCount = [SELECT COUNT() FROM bcm_Capability__c];
        Assert.areEqual(0, capCount, 'No Capability records should be created by a Viewer');
    }
}
