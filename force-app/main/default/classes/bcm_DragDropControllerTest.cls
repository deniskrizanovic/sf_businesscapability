/**
 * Tests for bcm_DragDropController.
 *
 * Covers:
 *  - reorderCapabilities: editor reorder, viewer denial, empty list no-op.
 *  - reparentCapability: L2/L3/L1 reparent with sibling rewrites, descendant
 *    level recalculation, cross-Map guard, viewer denial.
 *
 * Permission boundaries are exercised via System.runAs with users assigned
 * the bcm_Viewer permission set (which does NOT grant bcm_CanEdit).
 */
@IsTest(SeeAllData=false)
private class bcm_DragDropControllerTest {
    // ─── reorderCapabilities ──────────────────────────────────────────────────

    @IsTest
    static void reorder_editor_canReorderSiblings() {
        // Given — three L2 siblings under one L1
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c a = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 1, true);
        bcm_Capability__c b = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 2, true);
        bcm_Capability__c c = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 3, true);

        // When — reorder to [c, a, b]
        Test.startTest();
        bcm_DragDropController.reorderCapabilities(new List<Id>{ c.Id, a.Id, b.Id });
        Test.stopTest();

        // Then — sort order rewritten 1..3
        Map<Id, bcm_Capability__c> byId = new Map<Id, bcm_Capability__c>(
            [
                SELECT Id, bcm_SortOrder__c
                FROM bcm_Capability__c
                WHERE Id IN (:a.Id, :b.Id, :c.Id)
            ]
        );
        Assert.areEqual(1, byId.get(c.Id).bcm_SortOrder__c, 'c should be SortOrder 1');
        Assert.areEqual(2, byId.get(a.Id).bcm_SortOrder__c, 'a should be SortOrder 2');
        Assert.areEqual(3, byId.get(b.Id).bcm_SortOrder__c, 'b should be SortOrder 3');
    }

    @IsTest
    static void reorder_viewer_throwsAccessDenied() {
        // Given — Viewer (no bcm_CanEdit) and a capability to reorder
        User viewer = TestDataFactory.createUserWithPermSet('bcm_Viewer');
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);

        // When / Then
        Test.startTest();
        System.runAs(viewer) {
            try {
                bcm_DragDropController.reorderCapabilities(new List<Id>{ l1.Id });
                Assert.fail('Expected AuraHandledException for Viewer without bcm_CanEdit');
            } catch (AuraHandledException e) {
                Assert.areEqual(
                    'Access denied.',
                    e.getMessage(),
                    'Viewer should hit the bcm_CanEdit gate, not a DML error'
                );
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void reorder_emptyList_noOp() {
        // Given
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(map1.Id, null, 1, 7, true);
        Decimal originalSort = l1.bcm_SortOrder__c;

        // When — empty list and null both no-op
        Test.startTest();
        bcm_DragDropController.reorderCapabilities(new List<Id>());
        bcm_DragDropController.reorderCapabilities(null);
        Test.stopTest();

        // Then — record untouched
        bcm_Capability__c after = [
            SELECT bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :l1.Id
        ];
        Assert.areEqual(
            originalSort,
            after.bcm_SortOrder__c,
            'SortOrder should be unchanged for an empty / null reorder list'
        );
    }

    // ─── reparentCapability — L2 across L1 columns ────────────────────────────

    @IsTest
    static void reparent_l2_acrossColumns_updatesParentAndOrders() {
        // Given — two L1 columns; L1A has [a, b], L1B has [x]; move b under L1B between x and end
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1a = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c l1b = TestDataFactory.createCapability(map1.Id, null, 1, 2, true);
        bcm_Capability__c a = TestDataFactory.createCapability(map1.Id, l1a.Id, 2, 1, true);
        bcm_Capability__c b = TestDataFactory.createCapability(map1.Id, l1a.Id, 2, 2, true);
        bcm_Capability__c x = TestDataFactory.createCapability(map1.Id, l1b.Id, 2, 1, true);

        // When — move b to L1B, new order [x, b]; old siblings under L1A become [a]
        Test.startTest();
        bcm_DragDropController.reparentCapability(
            b.Id,
            l1b.Id,
            new List<Id>{ x.Id, b.Id },
            new List<Id>{ a.Id }
        );
        Test.stopTest();

        // Then
        bcm_Capability__c bAfter = [
            SELECT bcm_Parent__c, bcm_Level__c, bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :b.Id
        ];
        Assert.areEqual(l1b.Id, bAfter.bcm_Parent__c, 'b should now be parented to L1B');
        Assert.areEqual(2, bAfter.bcm_Level__c, 'b should remain Level 2');
        Assert.areEqual(2, bAfter.bcm_SortOrder__c, 'b should be SortOrder 2 in L1B');

        bcm_Capability__c xAfter = [
            SELECT bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :x.Id
        ];
        Assert.areEqual(1, xAfter.bcm_SortOrder__c, 'x should remain SortOrder 1 in L1B');

        bcm_Capability__c aAfter = [
            SELECT bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :a.Id
        ];
        Assert.areEqual(1, aAfter.bcm_SortOrder__c, 'a should be SortOrder 1 in L1A');
    }

    // ─── reparentCapability — L3 across L2 boxes ──────────────────────────────

    @IsTest
    static void reparent_l3_acrossL2s_updatesParentAndOrders() {
        // Given
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c l2a = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 1, true);
        bcm_Capability__c l2b = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 2, true);
        bcm_Capability__c l3a1 = TestDataFactory.createCapability(map1.Id, l2a.Id, 3, 1, true);
        bcm_Capability__c l3a2 = TestDataFactory.createCapability(map1.Id, l2a.Id, 3, 2, true);
        bcm_Capability__c l3b1 = TestDataFactory.createCapability(map1.Id, l2b.Id, 3, 1, true);

        // When — move l3a2 to L2B between l3b1 and end
        Test.startTest();
        bcm_DragDropController.reparentCapability(
            l3a2.Id,
            l2b.Id,
            new List<Id>{ l3b1.Id, l3a2.Id },
            new List<Id>{ l3a1.Id }
        );
        Test.stopTest();

        // Then
        bcm_Capability__c moved = [
            SELECT bcm_Parent__c, bcm_Level__c, bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :l3a2.Id
        ];
        Assert.areEqual(l2b.Id, moved.bcm_Parent__c, 'L3 should be reparented to L2B');
        Assert.areEqual(3, moved.bcm_Level__c, 'L3 should remain Level 3');
        Assert.areEqual(2, moved.bcm_SortOrder__c, 'L3 should be SortOrder 2 under L2B');

        bcm_Capability__c oldRemaining = [
            SELECT bcm_SortOrder__c
            FROM bcm_Capability__c
            WHERE Id = :l3a1.Id
        ];
        Assert.areEqual(
            1,
            oldRemaining.bcm_SortOrder__c,
            'Remaining L3 under L2A should be SortOrder 1'
        );
    }

    // ─── reparentCapability — L1 reorder via newParentId == null ──────────────

    @IsTest
    static void reparent_l1_reorder_columnSequence() {
        // Given — three L1 columns
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c c1 = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c c2 = TestDataFactory.createCapability(map1.Id, null, 1, 2, true);
        bcm_Capability__c c3 = TestDataFactory.createCapability(map1.Id, null, 1, 3, true);

        // When — move c3 to position 1: [c3, c1, c2]
        Test.startTest();
        bcm_DragDropController.reparentCapability(
            c3.Id,
            null,
            new List<Id>{ c3.Id, c1.Id, c2.Id },
            new List<Id>()
        );
        Test.stopTest();

        // Then — sequence rewritten and level still 1
        Map<Id, bcm_Capability__c> byId = new Map<Id, bcm_Capability__c>(
            [
                SELECT Id, bcm_Level__c, bcm_SortOrder__c, bcm_Parent__c
                FROM bcm_Capability__c
                WHERE Id IN (:c1.Id, :c2.Id, :c3.Id)
            ]
        );
        Assert.areEqual(1, byId.get(c3.Id).bcm_SortOrder__c, 'c3 should be SortOrder 1');
        Assert.areEqual(2, byId.get(c1.Id).bcm_SortOrder__c, 'c1 should be SortOrder 2');
        Assert.areEqual(3, byId.get(c2.Id).bcm_SortOrder__c, 'c2 should be SortOrder 3');
        Assert.areEqual(1, byId.get(c3.Id).bcm_Level__c, 'c3 should remain Level 1');
        Assert.isNull(byId.get(c3.Id).bcm_Parent__c, 'c3 should remain root (null parent)');
    }

    // ─── reparentCapability — descendant level recalc ─────────────────────────

    @IsTest
    static void reparent_l2_recalcDescendantLevels() {
        // Given — L2 with two L3 children. Move L2 to a different L1.
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1a = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c l1b = TestDataFactory.createCapability(map1.Id, null, 1, 2, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(map1.Id, l1a.Id, 2, 1, true);
        bcm_Capability__c l3a = TestDataFactory.createCapability(map1.Id, l2.Id, 3, 1, true);
        bcm_Capability__c l3b = TestDataFactory.createCapability(map1.Id, l2.Id, 3, 2, true);

        // When — move L2 from L1A to L1B
        Test.startTest();
        bcm_DragDropController.reparentCapability(
            l2.Id,
            l1b.Id,
            new List<Id>{ l2.Id },
            new List<Id>()
        );
        Test.stopTest();

        // Then — L3 children stay at Level 3 (parent stayed at Level 2)
        Map<Id, bcm_Capability__c> byId = new Map<Id, bcm_Capability__c>(
            [
                SELECT Id, bcm_Level__c
                FROM bcm_Capability__c
                WHERE Id IN (:l2.Id, :l3a.Id, :l3b.Id)
            ]
        );
        Assert.areEqual(2, byId.get(l2.Id).bcm_Level__c, 'L2 should remain Level 2');
        Assert.areEqual(3, byId.get(l3a.Id).bcm_Level__c, 'L3a should remain Level 3');
        Assert.areEqual(3, byId.get(l3b.Id).bcm_Level__c, 'L3b should remain Level 3');
    }

    // ─── reparentCapability — cross-Map guard ─────────────────────────────────

    @IsTest
    static void reparent_crossMap_throws() {
        // Given — two Maps; capability in Map A, target parent in Map B
        bcm_Map__c mapA = TestDataFactory.createMap('Map A', true);
        bcm_Map__c mapB = TestDataFactory.createMap('Map B', true);
        bcm_Capability__c capA = TestDataFactory.createCapability(mapA.Id, null, 1, 1, true);
        bcm_Capability__c capB = TestDataFactory.createCapability(mapB.Id, null, 1, 1, true);
        bcm_Capability__c childA = TestDataFactory.createCapability(mapA.Id, capA.Id, 2, 1, true);

        // When / Then — moving childA under capB (different Map) should throw
        Test.startTest();
        try {
            bcm_DragDropController.reparentCapability(
                childA.Id,
                capB.Id,
                new List<Id>{ childA.Id },
                new List<Id>()
            );
            Assert.fail('Expected AuraHandledException for cross-Map reparent');
        } catch (AuraHandledException e) {
            Assert.areEqual(
                'Cannot move a capability across Maps.',
                e.getMessage(),
                'Cross-Map reparent should be rejected by the explicit guard, not platform DML'
            );
        }
        Test.stopTest();
    }

    // ─── reparentCapability — viewer denial ───────────────────────────────────

    @IsTest
    static void reparent_viewer_throwsAccessDenied() {
        // Given
        User viewer = TestDataFactory.createUserWithPermSet('bcm_Viewer');
        bcm_Map__c map1 = TestDataFactory.createMap('Drag Drop Map', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(map1.Id, null, 1, 1, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(map1.Id, l1.Id, 2, 1, true);

        // When / Then
        Test.startTest();
        System.runAs(viewer) {
            try {
                bcm_DragDropController.reparentCapability(
                    l2.Id,
                    l1.Id,
                    new List<Id>{ l2.Id },
                    new List<Id>()
                );
                Assert.fail('Expected AuraHandledException for Viewer');
            } catch (AuraHandledException e) {
                Assert.areEqual(
                    'Access denied.',
                    e.getMessage(),
                    'Viewer should hit the bcm_CanEdit gate, not a DML error'
                );
            }
        }
        Test.stopTest();
    }
}
