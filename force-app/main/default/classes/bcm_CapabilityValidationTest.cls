@IsTest(SeeAllData=false)
private class bcm_CapabilityValidationTest {

    @TestSetup
    static void setupTestData() {
        TestDataFactory.createMap('Test Map', true);
    }

    // ─── Level range validation ───────────────────────────────────────────────

    @IsTest
    static void level0_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 0, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 0');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('Level must be 1, 2, or 3'),
                'Error should reference level range: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void level4_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 4, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 4');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('Level must be 1, 2, or 3'),
                'Error should reference level range: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // ─── No-parent rules ─────────────────────────────────────────────────────

    @IsTest
    static void level1_noParent_succeeds() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 1, 1, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        Assert.isNotNull(cap.Id, 'Level 1 with no parent should save successfully');
    }

    @IsTest
    static void level2_noParent_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 2, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 2 with no parent');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('no parent must be Level 1'),
                'Error should reference no-parent rule: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void level3_noParent_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 3, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 3 with no parent');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('no parent must be Level 1'),
                'Error should reference no-parent rule: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // ─── Has-parent rules ────────────────────────────────────────────────────

    @IsTest
    static void level1_withParent_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, parent.Id, 1, 2, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 1 with a parent');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('parent must be Level 2 or 3'),
                'Error should reference has-parent rule: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void level2_withParent_succeeds() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, parent.Id, 2, 1, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        Assert.isNotNull(cap.Id, 'Level 2 with a parent should save successfully');
    }

    @IsTest
    static void level3_withParent_succeeds() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, l2.Id, 3, 1, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        Assert.isNotNull(cap.Id, 'Level 3 with a parent should save successfully');
    }

    // ─── Permission boundaries ────────────────────────────────────────────────

    @IsTest
    static void viewer_cannotInsertCapability() {
        // Verify the permission set metadata directly — permission sets can only
        // grant access, not revoke it, so DML enforcement depends on the base profile.
        // Querying ObjectPermissions is the authoritative check for perm set configuration.
        Test.startTest();
        ObjectPermissions op = [
            SELECT PermissionsCreate FROM ObjectPermissions
            WHERE Parent.Name = 'bcm_Viewer' AND SObjectType = 'bcm_Capability__c'
            LIMIT 1
        ];
        Test.stopTest();

        Assert.isFalse(
            op.PermissionsCreate,
            'bcm_Viewer must not grant Create on bcm_Capability__c'
        );
    }

    @IsTest
    static void editor_canInsertValidCapability() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        User editor = TestDataFactory.createUserWithPermSet('bcm_Editor');
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 1, 1, false);

        // When
        Test.startTest();
        System.runAs(editor) {
            insert cap;
        }
        Test.stopTest();

        // Then
        Assert.isNotNull(cap.Id, 'Editor should be able to insert a valid Level 1 Capability');
    }

    @IsTest
    static void editor_cannotInsertInvalidCapability() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        User editor = TestDataFactory.createUserWithPermSet('bcm_Editor');
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 2, 1, false);

        // When / Then
        Test.startTest();
        System.runAs(editor) {
            try {
                insert cap;
                Assert.fail('Editor should not be able to insert Level 2 with no parent');
            } catch (DmlException e) {
                Assert.isTrue(
                    e.getMessage().contains('no parent must be Level 1'),
                    'Error should reference no-parent rule: ' + e.getMessage()
                );
            }
        }
        Test.stopTest();
    }

    // ─── Trigger behaviour: Level derivation ─────────────────────────────────

    @IsTest
    static void level_derivedAs1_whenNoParent() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, 1, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_Level__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(1, (Integer) saved.bcm_Level__c, 'Level should be derived as 1 when no parent');
    }

    @IsTest
    static void level_derivedAs2_whenParentIsL1() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, null, 1, true);
        bcm_Capability__c child = TestDataFactory.createCapability(m.Id, parent.Id, null, 1, false);

        // When
        Test.startTest();
        insert child;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_Level__c FROM bcm_Capability__c WHERE Id = :child.Id];
        Assert.areEqual(2, (Integer) saved.bcm_Level__c, 'Level should be derived as 2 when parent is L1');
    }

    @IsTest
    static void level_derivedAs3_whenParentIsL2() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, null, 1, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(m.Id, l1.Id, null, 1, true);
        bcm_Capability__c l3 = TestDataFactory.createCapability(m.Id, l2.Id, null, 1, false);

        // When
        Test.startTest();
        insert l3;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_Level__c FROM bcm_Capability__c WHERE Id = :l3.Id];
        Assert.areEqual(3, (Integer) saved.bcm_Level__c, 'Level should be derived as 3 when parent is L2');
    }

    // ─── Trigger behaviour: SortOrder auto-assign ─────────────────────────────

    @IsTest
    static void sortOrder_autoAssigned_whenNotProvided() {
        // Given — no existing siblings in scope
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, null, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(1, (Integer) saved.bcm_SortOrder__c, 'SortOrder should be auto-assigned as 1 when no siblings exist');
    }

    @IsTest
    static void sortOrder_preserved_whenExplicitlyProvided() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, 5, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(5, (Integer) saved.bcm_SortOrder__c, 'SortOrder should remain 5 when explicitly provided');
    }

    @IsTest
    static void sortOrder_shiftsSiblingsByBoth_whenTwoRecordsInsertedAtExplicitPositions() {
        // Given — 10 existing siblings (SortOrders 1–10)
        // Inserting two new records at positions 3 and 7 in the same transaction.
        // Expected cascade (walk each sibling through sorted incoming [3,7]):
        //   orig 1 → 1   (below both, unaffected)
        //   orig 2 → 2
        //   orig 3 → 4   (pushed by new@3)
        //   orig 4 → 5
        //   orig 5 → 6
        //   orig 6 → 8   (pushed by new@3 to 7, then pushed again by new@7 to 8)
        //   orig 7 → 9   (pushed by new@3 to 8, then pushed by new@7 to 9)
        //   orig 8 → 10
        //   orig 9 → 11
        //   orig 10 → 12
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        List<bcm_Capability__c> siblings = new List<bcm_Capability__c>();
        for (Integer i = 1; i <= 10; i++) {
            siblings.add(TestDataFactory.createCapability(m.Id, null, null, i, false));
        }
        insert siblings;

        List<bcm_Capability__c> newRecords = new List<bcm_Capability__c>{
            TestDataFactory.createCapability(m.Id, null, null, 3, false),
            TestDataFactory.createCapability(m.Id, null, null, 7, false)
        };

        // When
        Test.startTest();
        insert newRecords;
        Test.stopTest();

        // Then — new records sit at their requested positions
        Map<Id, bcm_Capability__c> saved = new Map<Id, bcm_Capability__c>([
            SELECT Id, bcm_SortOrder__c FROM bcm_Capability__c WHERE Id IN :newRecords
        ]);
        Assert.areEqual(3,  (Integer) saved.get(newRecords[0].Id).bcm_SortOrder__c, 'First new record should be at position 3');
        Assert.areEqual(7,  (Integer) saved.get(newRecords[1].Id).bcm_SortOrder__c, 'Second new record should be at position 7');

        // Then — existing siblings shifted correctly
        Map<Id, bcm_Capability__c> updatedSiblings = new Map<Id, bcm_Capability__c>([
            SELECT Id, bcm_SortOrder__c FROM bcm_Capability__c WHERE Id IN :siblings
        ]);
        List<Integer> expectedPositions = new List<Integer>{ 1, 2, 4, 5, 6, 8, 9, 10, 11, 12 };
        for (Integer i = 0; i < siblings.size(); i++) {
            Integer actual = (Integer) updatedSiblings.get(siblings[i].Id).bcm_SortOrder__c;
            Assert.areEqual(expectedPositions[i], actual,
                'Sibling originally at ' + (i + 1) + ' should now be at ' + expectedPositions[i]);
        }
    }

    @IsTest
    static void sortOrder_shiftsSiblings_whenInsertedAtExplicitPosition() {
        // Given — 15 existing siblings already in scope (SortOrders 1–15)
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        List<bcm_Capability__c> siblings = new List<bcm_Capability__c>();
        for (Integer i = 1; i <= 15; i++) {
            siblings.add(TestDataFactory.createCapability(m.Id, null, null, i, false));
        }
        insert siblings;

        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, 5, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then — new record sits at 5; original positions 5–15 each shift up by 1
        bcm_Capability__c saved = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(5, (Integer) saved.bcm_SortOrder__c,
            'New record should sit at the explicitly requested position 5');

        Map<Id, bcm_Capability__c> updatedSiblings = new Map<Id, bcm_Capability__c>([
            SELECT Id, bcm_SortOrder__c FROM bcm_Capability__c WHERE Id IN :siblings
        ]);
        for (Integer i = 0; i < siblings.size(); i++) {
            Integer originalPos = i + 1;
            Integer expectedPos = originalPos < 5 ? originalPos : originalPos + 1;
            Decimal actual = updatedSiblings.get(siblings[i].Id).bcm_SortOrder__c;
            Assert.areEqual(expectedPos, (Integer) actual,
                'Sibling originally at ' + originalPos + ' should now be at ' + expectedPos);
        }
    }
}
