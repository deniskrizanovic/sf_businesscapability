/**
 * Tests for bcm_CapabilityHandler — level derivation, sort-order derivation,
 * sibling-shift on explicit insert, and update path.
 * Handler is exercised via DML (trigger) except the null/empty guard,
 * which is called directly because handle() is public.
 */
@IsTest
private class bcm_CapabilityHandlerTest {

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** Insert a capability with null level AND null sort order so handler derives both. */
    private static bcm_Capability__c insertAuto(Id mapId, Id parentId) {
        bcm_Capability__c cap = new bcm_Capability__c(
            Name          = 'Cap',
            bcm_Map__c    = mapId,
            bcm_Parent__c = parentId
        );
        insert cap;
        return [SELECT Id, bcm_Level__c, bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
    }

    /** Insert a capability with an explicit sort order so the shift path fires. */
    private static bcm_Capability__c insertExplicit(Id mapId, Id parentId, Integer sortOrder) {
        bcm_Capability__c cap = new bcm_Capability__c(
            Name             = 'Cap',
            bcm_Map__c       = mapId,
            bcm_Parent__c    = parentId,
            bcm_SortOrder__c = sortOrder
        );
        insert cap;
        return [SELECT Id, bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :cap.Id];
    }

    // ─── handle() null / empty guard ─────────────────────────────────────────

    @IsTest
    static void shouldReturnEarly_WhenHandleCalledWithNull() {
        Test.startTest();
        bcm_CapabilityHandler.handle(null, null);
        Test.stopTest();
        // No exception = guard executed
        Assert.isTrue(true, 'handle(null, null) should return without error');
    }

    @IsTest
    static void shouldReturnEarly_WhenHandleCalledWithEmptyList() {
        Test.startTest();
        bcm_CapabilityHandler.handle(new List<bcm_Capability__c>(), null);
        Test.stopTest();
        Assert.isTrue(true, 'handle(empty, null) should return without error');
    }

    // ─── Level derivation ────────────────────────────────────────────────────

    @IsTest
    static void shouldSetLevelOne_WhenNoParent() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);

        Test.startTest();
        bcm_Capability__c cap = insertAuto(m.Id, null);
        Test.stopTest();

        Assert.areEqual(1, (Integer) cap.bcm_Level__c, 'L1 cap with no parent should get Level 1');
    }

    @IsTest
    static void shouldDeriveLevelFromParent_WhenParentSet() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        Test.startTest();
        bcm_Capability__c child = insertAuto(m.Id, parent.Id);
        Test.stopTest();

        Assert.areEqual(2, (Integer) child.bcm_Level__c, 'Child should get parent.Level + 1');
    }

    @IsTest
    static void shouldPreserveExplicitLevel_WhenLevelAlreadySet() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        Test.startTest();
        // Level 2 with a level-1 parent — explicit value, handler must not overwrite
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, parent.Id, 2, 1, true);
        bcm_Capability__c fetched = [SELECT bcm_Level__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Test.stopTest();

        Assert.areEqual(2, (Integer) fetched.bcm_Level__c, 'Explicit level should not be overwritten');
    }

    // ─── SortOrder derivation — null parent (L1) ─────────────────────────────

    @IsTest
    static void shouldSetSortOrder1_WhenFirstL1CapInMap() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);

        Test.startTest();
        bcm_Capability__c cap = insertAuto(m.Id, null);
        Test.stopTest();

        Assert.areEqual(1, (Integer) cap.bcm_SortOrder__c, 'First L1 cap should get SortOrder 1');
    }

    @IsTest
    static void shouldAppendSortOrder_WhenL1SiblingsExist() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        TestDataFactory.createCapability(m.Id, null, 1, 2, true);

        Test.startTest();
        bcm_Capability__c cap = insertAuto(m.Id, null);
        Test.stopTest();

        Assert.areEqual(3, (Integer) cap.bcm_SortOrder__c, 'SortOrder should be MAX sibling + 1');
    }

    // ─── SortOrder derivation — non-null parent (L2+) ────────────────────────

    @IsTest
    static void shouldSetSortOrder1_WhenFirstChildUnderParent() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        Test.startTest();
        bcm_Capability__c child = insertAuto(m.Id, parent.Id);
        Test.stopTest();

        Assert.areEqual(1, (Integer) child.bcm_SortOrder__c, 'First child under parent should get SortOrder 1');
    }

    @IsTest
    static void shouldAppendSortOrder_WhenChildSiblingsExist() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        TestDataFactory.createCapability(m.Id, parent.Id, 2, 1, true);
        TestDataFactory.createCapability(m.Id, parent.Id, 2, 2, true);

        Test.startTest();
        bcm_Capability__c child = insertAuto(m.Id, parent.Id);
        Test.stopTest();

        Assert.areEqual(3, (Integer) child.bcm_SortOrder__c, 'Child SortOrder should be MAX sibling + 1');
    }

    @IsTest
    static void shouldAssignSequential_WhenBulkInsertNullSortOrder() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        List<bcm_Capability__c> caps = new List<bcm_Capability__c>();
        for (Integer i = 0; i < 5; i++) {
            caps.add(new bcm_Capability__c(Name = 'Cap ' + i, bcm_Map__c = m.Id));
        }

        Test.startTest();
        insert caps;
        Test.stopTest();

        List<bcm_Capability__c> saved = [
            SELECT bcm_SortOrder__c FROM bcm_Capability__c
            WHERE bcm_Map__c = :m.Id ORDER BY bcm_SortOrder__c ASC
        ];
        Assert.areEqual(5, saved.size(), 'All 5 caps should be inserted');
        for (Integer i = 0; i < 5; i++) {
            Assert.areEqual(i + 1, (Integer) saved[i].bcm_SortOrder__c,
                'SortOrder should be sequential starting at 1');
        }
    }

    // ─── Sibling shift — explicit sort order (null parent / L1) ─────────────

    @IsTest
    static void shouldShiftSibling_WhenExplicitSortOrderClashes_NullParent() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c existing = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        Test.startTest();
        insertExplicit(m.Id, null, 1); // clashes with existing at pos 1
        Test.stopTest();

        bcm_Capability__c shifted = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :existing.Id];
        Assert.areEqual(2, (Integer) shifted.bcm_SortOrder__c, 'Existing sibling should shift to pos 2');
    }

    @IsTest
    static void shouldNotShift_WhenExplicitSortOrderIsFree_NullParent() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c existing = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        Test.startTest();
        insertExplicit(m.Id, null, 5); // position 5 is free
        Test.stopTest();

        bcm_Capability__c unshifted = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :existing.Id];
        Assert.areEqual(1, (Integer) unshifted.bcm_SortOrder__c, 'Existing sibling should not be shifted');
    }

    @IsTest
    static void shouldShiftConsecutiveRun_WhenMultipleSiblingsOccupyPositions() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c s1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c s2 = TestDataFactory.createCapability(m.Id, null, 1, 2, true);
        bcm_Capability__c s3 = TestDataFactory.createCapability(m.Id, null, 1, 3, true);

        Test.startTest();
        insertExplicit(m.Id, null, 1); // clashes → consecutive run 1,2,3 all shift
        Test.stopTest();

        Map<Id, bcm_Capability__c> after = new Map<Id, bcm_Capability__c>([
            SELECT Id, bcm_SortOrder__c FROM bcm_Capability__c
            WHERE Id IN :new List<Id>{s1.Id, s2.Id, s3.Id}
        ]);
        Assert.areEqual(2, (Integer) after.get(s1.Id).bcm_SortOrder__c, 's1 should shift to 2');
        Assert.areEqual(3, (Integer) after.get(s2.Id).bcm_SortOrder__c, 's2 should shift to 3');
        Assert.areEqual(4, (Integer) after.get(s3.Id).bcm_SortOrder__c, 's3 should shift to 4');
    }

    // ─── Sibling shift — explicit sort order (non-null parent / L2+) ─────────

    @IsTest
    static void shouldShiftSibling_WhenExplicitSortOrderClashes_WithParent() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c parent = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c existing = TestDataFactory.createCapability(m.Id, parent.Id, 2, 1, true);

        Test.startTest();
        insertExplicit(m.Id, parent.Id, 1); // clashes with child at pos 1
        Test.stopTest();

        bcm_Capability__c shifted = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :existing.Id];
        Assert.areEqual(2, (Integer) shifted.bcm_SortOrder__c, 'Child sibling should shift to pos 2');
    }

    // ─── Sibling shift — free-slot branch (lines 166-167) ────────────────────

    @IsTest
    static void shouldNotShift_WhenIncomingSlotFree_ButHigherSiblingExists() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        // Sibling at pos 3 — above the incoming pos 2, so it enters the loop but slot 2 is free
        bcm_Capability__c s3 = TestDataFactory.createCapability(m.Id, null, 1, 3, true);

        Test.startTest();
        insertExplicit(m.Id, null, 2); // pos 2 is free; pos 3 exists but should not shift
        Test.stopTest();

        bcm_Capability__c s3After = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :s3.Id];
        Assert.areEqual(3, (Integer) s3After.bcm_SortOrder__c, 'Sibling at pos 3 should not shift when incoming pos 2 is free');
    }

    // ─── deriveSortOrder skip branch (line 277) — explicit sort order mixed with null ─

    @IsTest
    static void shouldSkipSortOrderDerivation_WhenSortOrderAlreadySet() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);

        Test.startTest();
        // Insert two caps in one DML: one explicit (skip branch) + one null (derive branch)
        List<bcm_Capability__c> batch = new List<bcm_Capability__c>{
            new bcm_Capability__c(Name = 'Explicit', bcm_Map__c = m.Id, bcm_SortOrder__c = 10),
            new bcm_Capability__c(Name = 'Auto',     bcm_Map__c = m.Id)
        };
        insert batch;
        Test.stopTest();

        Map<String, bcm_Capability__c> byName = new Map<String, bcm_Capability__c>();
        for (bcm_Capability__c c : [SELECT Name, bcm_SortOrder__c FROM bcm_Capability__c WHERE bcm_Map__c = :m.Id]) {
            byName.put(c.Name, c);
        }
        Assert.areEqual(10, (Integer) byName.get('Explicit').bcm_SortOrder__c, 'Explicit SortOrder should be unchanged');
        Assert.areEqual(1,  (Integer) byName.get('Auto').bcm_SortOrder__c,     'Auto SortOrder should be derived as 1');
    }

    // ─── Update path (no shift) ───────────────────────────────────────────────

    @IsTest
    static void shouldNotShiftSiblings_OnUpdate() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c s1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c s2 = TestDataFactory.createCapability(m.Id, null, 1, 2, true);

        Test.startTest();
        s1.Name = 'Updated Name';
        update s1;
        Test.stopTest();

        bcm_Capability__c s2After = [SELECT bcm_SortOrder__c FROM bcm_Capability__c WHERE Id = :s2.Id];
        Assert.areEqual(2, (Integer) s2After.bcm_SortOrder__c, 'Sibling SortOrder should be unchanged on update');
    }

    @IsTest
    static void shouldDeriveLevelOnUpdate_WhenLevelIsNull() {
        bcm_Map__c m = TestDataFactory.createMap('M', true);
        bcm_Capability__c cap = TestDataFactory.createCapability(m.Id, null, 1, 1, true);

        // Manually null-out level via direct field force via another insert then update scenario —
        // set level to null in-memory and update; trigger fires with oldMap != null
        Test.startTest();
        cap.bcm_Level__c = null;
        update cap;
        Test.stopTest();

        bcm_Capability__c fetched = [SELECT bcm_Level__c FROM bcm_Capability__c WHERE Id = :cap.Id];
        Assert.areEqual(1, (Integer) fetched.bcm_Level__c, 'Level should be re-derived to 1 on update when null');
    }
}
