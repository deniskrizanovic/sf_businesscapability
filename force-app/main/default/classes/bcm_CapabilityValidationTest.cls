@IsTest(SeeAllData=false)
private class bcm_CapabilityValidationTest {

    @TestSetup
    static void setupTestData() {
        TestDataFactory.createMap('Test Map', true);
    }

    // ─── Level range validation ───────────────────────────────────────────────

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 0 is rejected"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 4 is rejected"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "A top-level Capability with Level 1 and no Parent saves successfully"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 2 with no Parent is rejected"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 3 with no Parent is rejected"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 1 with a Parent is rejected"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 2 with a Parent saves successfully"
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

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "Level 3 with a Parent saves successfully"
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

    // ─── Parent-level validation ─────────────────────────────────────────────

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "A Level 3 Capability parented to a Level 1 is rejected"
    @IsTest
    static void level3_withL1Parent_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, l1.Id, 3, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 3 with a Level 1 parent');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('must be exactly one level above'),
                'Error should reference parent-level rule: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // @spec capability-object.md · "Validation prevents structurally invalid Capabilities" · "A Level 2 Capability parented to another Level 2 is rejected"
    @IsTest
    static void level2_withL2Parent_isRejected() {
        // Given
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c l2Parent = TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, l2Parent.Id, 2, 1, false);

        // When / Then
        Test.startTest();
        try {
            insert cap;
            Assert.fail('Expected DmlException for Level 2 with a Level 2 parent');
        } catch (DmlException e) {
            Assert.isTrue(
                e.getMessage().contains('must be exactly one level above'),
                'Error should reference parent-level rule: ' + e.getMessage()
            );
        }
        Test.stopTest();
    }

    // ─── Permission boundaries ────────────────────────────────────────────────

    // @spec capability-object.md · "Access rules are enforced for Editors and Viewers" · "Viewer cannot create a Capability record"
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

    // @spec capability-object.md · "Access rules are enforced for Editors and Viewers" · "Editor can create, edit, and delete a Capability"
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

    // @spec capability-object.md · "Access rules are enforced for Editors and Viewers" · "Editor cannot save a structurally invalid Capability"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "A top-level Capability gets Level 1"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "A child Capability gets Level 2"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "A grandchild Capability gets Level 3"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Sort Order is assigned as the next available number when left blank"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Sort Order is preserved when I enter one manually with no siblings"
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

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Multiple Capabilities inserted in the same save each land at their requested Sort Order"
    @IsTest
    static void sortOrder_shiftsSiblingsByBoth_whenTwoRecordsInsertedAtExplicitPositions() {
        // Given — 10 existing siblings (SortOrders 1–10)
        // Inserting two new records at positions 3 and 7 in the same transaction.
        // Consecutive-run shift for incoming 3: run is 3→10 (no gaps), all shift +1 → 4–11.
        // Consecutive-run shift for incoming 7: run is now 7→11 (no gaps), all shift +1 → 8–12.
        //   orig 1 → 1   (below both, unaffected)
        //   orig 2 → 2
        //   orig 3 → 4   (shifted by new@3)
        //   orig 4 → 5
        //   orig 5 → 6
        //   orig 6 → 7 → 8  (shifted by new@3 to 7, then by new@7 to 8)
        //   orig 7 → 8 → 9
        //   orig 8 → 9 → 10
        //   orig 9 → 10 → 11
        //   orig 10 → 11 → 12
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

    // ─── Handler guard: empty list ────────────────────────────────────────────

    // Direct invocation of the handler with an empty list exercises the early-return guard (line 22)
    @IsTest
    static void handler_withEmptyList_isNoop() {
        Test.startTest();
        bcm_CapabilityHandler.handle(new List<bcm_Capability__c>(), null);
        Test.stopTest();
        // No exception thrown = guard executed correctly
    }

    // ─── SortOrder derivation for child capabilities ──────────────────────────

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Sort Order is assigned as the next available number when left blank"
    @IsTest
    static void sortOrder_autoAssigned_forChildCapability() {
        // Given — parent with two Level 2 children already at positions 1 and 2
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, null, 1, true);
        TestDataFactory.createCapability(m.Id, parent.Id, null, 1, true);
        TestDataFactory.createCapability(m.Id, parent.Id, null, 2, true);
        bcm_Capability__c child = TestDataFactory.createCapability(m.Id, parent.Id, null, null, false);

        // When
        Test.startTest();
        insert child;
        Test.stopTest();

        // Then
        bcm_Capability__c saved = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :child.Id];
        Assert.areEqual(3, (Integer) saved.bcm_SortOrder__c,
            'SortOrder should auto-assign as 3 when two siblings already occupy 1 and 2');
    }

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Existing siblings shift down when I insert a Capability at a taken Sort Order"
    @IsTest
    static void sortOrder_shiftsSiblings_forChildCapabilityAtExplicitPosition() {
        // Given — parent with three Level 2 children at positions 1, 2, 3
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, null, 1, true);
        TestDataFactory.createCapability(m.Id, parent.Id, null, 1, true);
        bcm_Capability__c sib2 = TestDataFactory.createCapability(m.Id, parent.Id, null, 2, true);
        bcm_Capability__c sib3 = TestDataFactory.createCapability(m.Id, parent.Id, null, 3, true);
        bcm_Capability__c child = TestDataFactory.createCapability(m.Id, parent.Id, null, 2, false);

        // When
        Test.startTest();
        insert child;
        Test.stopTest();

        // Then — new child sits at 2; run [2,3] shifts up
        bcm_Capability__c savedChild = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :child.Id];
        Assert.areEqual(2, (Integer) savedChild.bcm_SortOrder__c,
            'New child should land at the requested position 2');

        bcm_Capability__c updatedSib2 = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :sib2.Id];
        Assert.areEqual(3, (Integer) updatedSib2.bcm_SortOrder__c,
            'Sibling originally at 2 should shift to 3');

        bcm_Capability__c updatedSib3 = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :sib3.Id];
        Assert.areEqual(4, (Integer) updatedSib3.bcm_SortOrder__c,
            'Sibling originally at 3 should shift to 4');
    }

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Inserting a Capability at a free Sort Order leaves siblings with higher Sort Orders unchanged"
    @IsTest
    static void sortOrder_doesNotShiftSiblings_whenInsertedAtFreePosition() {
        // Given — siblings at 1 and 6 (gap between them)
        bcm_Map__c m = [SELECT Id FROM bcm_Map__c LIMIT 1];
        bcm_Capability__c sib1 = TestDataFactory.createCapability(m.Id, null, null, 1, false);
        bcm_Capability__c sib6 = TestDataFactory.createCapability(m.Id, null, null, 6, false);
        insert new List<bcm_Capability__c>{ sib1, sib6 };

        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, null, 2, false);

        // When
        Test.startTest();
        insert cap;
        Test.stopTest();

        // Then — new record lands at 2; sibling at 6 is untouched
        bcm_Capability__c saved = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(2, (Integer) saved.bcm_SortOrder__c, 'New record should sit at the free position 2');

        bcm_Capability__c updatedSib6 = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :sib6.Id];
        Assert.areEqual(6, (Integer) updatedSib6.bcm_SortOrder__c, 'Sibling at 6 should not shift — there was a gap between 2 and 6');
    }

    // @spec capability-object.md · "Level and Sort Order fill in automatically" · "Existing siblings shift down when I insert a Capability at a taken Sort Order"
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
