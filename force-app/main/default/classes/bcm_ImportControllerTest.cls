@IsTest(SeeAllData=false)
private class bcm_ImportControllerTest {

    // ─── Shared test fixture ──────────────────────────────────────────────────

    // 3-capability tree: L1 → L2 → L3, no tags.
    // The "tags" key is present to verify it is silently ignored.
    private static final String SAMPLE_JSON =
            '{'
                    + '"mapName":"Test Import Map",'
                    + '"mapDescription":"<p>Test description</p>",'
                    + '"capabilities":['
                    + '{'
                    + '"externalId":"cap-l1",'
                    + '"name":"Domain 1",'
                    + '"level":1,'
                    + '"sortOrder":1,'
                    + '"definition":"<p>L1 definition</p>",'
                    + '"strategySupport":"<p>L1 strategy</p>",'
                    + '"architecturalNuance":"<p>L1 nuance</p>",'
                    + '"tags":["IGNORED"],'
                    + '"children":['
                    + '{'
                    + '"externalId":"cap-l2",'
                    + '"name":"Group 1",'
                    + '"level":2,'
                    + '"sortOrder":1,'
                    + '"definition":"<p>L2 definition</p>",'
                    + '"strategySupport":"",'
                    + '"architecturalNuance":"",'
                    + '"children":['
                    + '{'
                    + '"externalId":"cap-l3",'
                    + '"name":"Capability 1",'
                    + '"level":3,'
                    + '"sortOrder":1,'
                    + '"definition":"<p>L3 definition</p>",'
                    + '"strategySupport":"",'
                    + '"architecturalNuance":"",'
                    + '"children":[]'
                    + '}'
                    + ']'
                    + '}'
                    + ']'
                    + '}'
                    + ']'
                    + '}';

    // ─── Happy path ───────────────────────────────────────────────────────────

    // @spec import.md · "Feature: Successful import from valid JSON" · "Scenario: Valid JSON creates a Map, Capabilities, and Tags"
    @IsTest
    static void happyPath_validJson_importsMapAndCapabilities() {
        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result =
                bcm_ImportController.importCapabilities(SAMPLE_JSON);
        Test.stopTest();

        // Then — result
        Assert.isTrue(result.success, 'Import should succeed for valid JSON');
        Assert.areEqual(3, result.capabilitiesInserted,
                'Three capabilities should be inserted on first import');
        Assert.areEqual(0, result.capabilitiesUpdated,
                'No capabilities should be updated on first import');
        Assert.isNull(result.errorMessage,
                'errorMessage should be null on success');

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
        Assert.areEqual(l1.Id, l2.bcm_Parent__c,
                'L2 capability should be parented to L1');
        Assert.areEqual(l2.Id, l3.bcm_Parent__c,
                'L3 capability should be parented to L2');
    }

    // @spec import.md · "Feature: Successful import from valid JSON" · "Scenario: Rich text fields are stored as formatted content"
    @IsTest
    static void happyPath_richTextFields_storedAsIs() {
        // Given
        String richTextJson =
                '{'
                        + '"mapName":"Rich Text Map",'
                        + '"capabilities":['
                        + '{'
                        + '"externalId":"rt-l1",'
                        + '"name":"RT Domain",'
                        + '"level":1,'
                        + '"sortOrder":1,'
                        + '"definition":"<p>Bold <strong>word</strong></p>",'
                        + '"strategySupport":"<ul><li>item</li></ul>",'
                        + '"architecturalNuance":"<p>nuance</p>",'
                        + '"children":[]'
                        + '}'
                        + ']'
                        + '}';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result =
                bcm_ImportController.importCapabilities(richTextJson);
        Test.stopTest();

        // Then
        Assert.isTrue(result.success, 'Import should succeed for rich-text JSON');
        bcm_Capability__c saved = [
                SELECT bcm_Definition__c, bcm_StrategySupport__c, bcm_ArchitecturalNuance__c
                FROM bcm_Capability__c
                WHERE bcm_ExternalId__c = 'rt-l1'
        ];
        Assert.areEqual('<p>Bold <strong>word</strong></p>', saved.bcm_Definition__c,
                'Definition should be stored verbatim as supplied HTML');
        Assert.areEqual('<ul><li>item</li></ul>', saved.bcm_StrategySupport__c,
                'StrategySupport should be stored verbatim as supplied HTML');
        Assert.areEqual('<p>nuance</p>', saved.bcm_ArchitecturalNuance__c,
                'ArchitecturalNuance should be stored verbatim as supplied HTML');
    }

    // @spec import.md · "Feature: Import is idempotent" · "Scenario: Re-importing the same JSON does not create duplicates"
    @IsTest
    static void happyPath_reimport_isIdempotent() {
        // Given — first import
        bcm_ImportController.importCapabilities(SAMPLE_JSON);

        // When — second import with the same JSON
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result =
                bcm_ImportController.importCapabilities(SAMPLE_JSON);
        Test.stopTest();

        // Then — result reflects updates, not inserts
        Assert.isTrue(result.success, 'Re-import should succeed');
        Assert.areEqual(0, result.capabilitiesInserted,
                'No new capabilities should be created on re-import');
        Assert.areEqual(3, result.capabilitiesUpdated,
                'All three capabilities should be updated on re-import');

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

    // ─── Error handling ───────────────────────────────────────────────────────

    // @spec import.md · "Feature: Import errors are handled gracefully" · "Scenario: Malformed JSON displays an error message"
    @IsTest
    static void error_malformedJson_returnsError() {
        // Given
        String badJson = 'not valid json {{{';

        // When
        Test.startTest();
        bcm_ImportController.bcm_ImportResult result =
                bcm_ImportController.importCapabilities(badJson);
        Test.stopTest();

        // Then
        Assert.isFalse(result.success, 'Import should fail for malformed JSON');
        Assert.isNotNull(result.errorMessage,
                'errorMessage should be populated for malformed JSON');

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for malformed JSON');
    }

    // @spec import.md · "Feature: Import errors are handled gracefully" · "Scenario: Empty text area is rejected before submission"
    @IsTest
    static void error_emptyPayload_returnsError() {
        // When — empty string
        Test.startTest();
        bcm_ImportController.bcm_ImportResult resultEmpty =
                bcm_ImportController.importCapabilities('');
        Test.stopTest();

        // Then
        Assert.isFalse(resultEmpty.success, 'Empty string should produce a failure result');
        Assert.isNotNull(resultEmpty.errorMessage,
                'errorMessage should be populated for an empty payload');

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for an empty payload');
    }

    @IsTest
    static void error_nullPayload_returnsError() {
        // When — null
        Test.startTest();
        bcm_ImportController.bcm_ImportResult resultNull =
                bcm_ImportController.importCapabilities(null);
        Test.stopTest();

        // Then
        Assert.isFalse(resultNull.success, 'Null payload should produce a failure result');
        Assert.isNotNull(resultNull.errorMessage,
                'errorMessage should be populated for a null payload');

        Integer mapCount = [SELECT COUNT() FROM bcm_Map__c];
        Assert.areEqual(0, mapCount, 'No Map records should be created for a null payload');
    }

    // ─── Permission boundary ──────────────────────────────────────────────────

    // @spec import.md · "Feature: Import UI is accessible from a Map record" · "Scenario: Import panel is not accessible to Viewers"
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

    // @spec import.md · "Feature: Successful import from valid JSON" · "Scenario: Valid JSON creates a Map, Capabilities, and Tags"
    @IsTest
    static void invocable_execute_delegatesAndReturnsResult() {
        // Given
        bcm_ImportController.FlowInput input = new bcm_ImportController.FlowInput();
        input.jsonPayload = SAMPLE_JSON;

        // When
        Test.startTest();
        List<bcm_ImportController.bcm_ImportResult> results =
                bcm_ImportController.execute(new List<bcm_ImportController.FlowInput>{ input });
        Test.stopTest();

        // Then
        Assert.areEqual(1, results.size(), 'execute() should return a single-element list');
        bcm_ImportController.bcm_ImportResult result = results[0];
        Assert.isTrue(result.success, 'Invocable import should succeed for valid JSON');
        Assert.areEqual(3, result.capabilitiesInserted,
                'Three capabilities should be inserted via the invocable path');
        Assert.isNull(result.errorMessage, 'errorMessage should be null on success');
    }

    // @spec import.md · "Feature: Import UI is accessible from a Map record" · "Scenario: Import panel is not accessible to Viewers"
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
                    new List<bcm_ImportController.FlowInput>{ input });
        }
        Test.stopTest();

        // Then — AuraHandledException is caught and returned as a failure result (not re-thrown)
        Assert.areEqual(1, results.size(), 'execute() should return a single-element list');
        bcm_ImportController.bcm_ImportResult result = results[0];
        Assert.isFalse(result.success, 'Viewer should not be able to import via the Flow path');
        Assert.isNotNull(result.errorMessage,
                'errorMessage should be populated when permission is denied');

        Integer capCount = [SELECT COUNT() FROM bcm_Capability__c];
        Assert.areEqual(0, capCount, 'No Capability records should be created by a Viewer');
    }
}
