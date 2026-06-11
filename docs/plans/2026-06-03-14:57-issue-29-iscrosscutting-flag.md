# Issue #29 — Add `bcm_IsCrossCutting__c` Flag to Capability

> **Status:** Completed 2026-06-03 — all tasks ticked; FP count exclusion row added (no new FP).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

Editors need to mark Level 1 capabilities as "cross-cutting" — i.e. they conceptually apply across all other capabilities (e.g. Security, Compliance, Data Governance). Issue #29 introduces the storage + read API + UI exposure for the flag. Downstream visualisation work (separate issue) will consume the flag to render cross-cutting L1s differently. For this issue: Editor toggles flag on Capability record page; Viewer reads it; Apex selectors return it in their payload.

L1-only enforcement is added via a validation rule — the flag may only be `true` on Level 1 records. Editors get an inline error if they try to tick it on L2 or L3.

---

## Architecture

1. **Field metadata** — new `Checkbox` custom field `bcm_IsCrossCutting__c` on `bcm_Capability__c`, `defaultValue=false`, with description + inline help.
2. **Validation rule** — `IsCrossCutting_Only_On_Level_1` blocks save when `bcm_IsCrossCutting__c = TRUE && bcm_Level__c != 1`. Sibling pattern: `Level_Range`, `No_Parent_Must_Be_Level_1` etc. in `objects/bcm_Capability__c/validationRules/`.
3. **Permission Sets** — add `<fieldPermissions>` block to `bcm_Editor` (read+edit) and `bcm_Viewer` (read-only).
4. **FlexiPage** — current `bcm_Capability_Record_Page.flexipage-meta.xml` uses `force:detailPanel` which auto-renders all object fields per FLS, so no FlexiPage edit is required. **Verify by inspection**: if a future deploy reveals it's needed, invoke `generating-flexipage`.
5. **Apex** — extend SOQL in `bcm_CapabilityController.getCapabilities` and `bcm_CapabilityController.getCapabilityDetail` to select `bcm_IsCrossCutting__c`.
6. **Apex tests** — add roundtrip test in `bcm_CapabilityControllerTest` (true/false through `getCapabilities`); add validation tests in `bcm_CapabilityValidationTest` (true on L1 succeeds; true on L2/L3 fails).
7. **Spec** — add scenarios to `docs/specs/capability-object.md` under a new feature block "Cross-cutting flag", including the L1-only validation rule.
8. **No new FP** — single new attribute on existing entity; validation rule is a constraint, not a functional process. Add row to §6 Excluded Processes in `docs/economics/function-point-count.md`.

**Generation rule:** Per CLAUDE.md, all `*-meta.xml` files MUST be created via the matching skill. Use `generating-custom-field` for the field; `generating-validation-rule` for the validation rule. Permset and FlexiPage edits are minor additions to existing files — invoke matching skill if available; otherwise hand-edit using the existing siblings as the shape source of truth.

**Tech Stack:** Salesforce metadata (custom field, permset), Apex (controller + test), Markdown specs.

---

## File Structure

- **Create** `force-app/main/default/objects/bcm_Capability__c/fields/bcm_IsCrossCutting__c.field-meta.xml` — via `generating-custom-field`
- **Create** `force-app/main/default/objects/bcm_Capability__c/validationRules/IsCrossCutting_Only_On_Level_1.validationRule-meta.xml` — via `generating-validation-rule`
- **Modify** `force-app/main/default/permissionsets/bcm_Editor.permissionset-meta.xml` — add field permission (read+edit)
- **Modify** `force-app/main/default/permissionsets/bcm_Viewer.permissionset-meta.xml` — add field permission (read-only)
- **Modify** `force-app/main/default/classes/bcm_CapabilityController.cls` — add field to two SOQL select lists
- **Modify** `force-app/main/default/classes/bcm_CapabilityControllerTest.cls` — add roundtrip test
- **Modify** `force-app/main/default/classes/bcm_CapabilityValidationTest.cls` — add validation rule tests (L1 succeeds; L2/L3 rejected)
- **Modify** `docs/specs/capability-object.md` — add scenarios for the new flag
- **Modify** `docs/economics/function-point-count.md` — add row to §6 Excluded Processes

---

## Task 1: Generate the custom field

**Files:**

- Create: `force-app/main/default/objects/bcm_Capability__c/fields/bcm_IsCrossCutting__c.field-meta.xml`

- [x] **Step 1: Invoke `generating-custom-field` skill**

    Field params:
    - object: `bcm_Capability__c`
    - apiName: `bcm_IsCrossCutting__c`
    - label: `Is Cross-Cutting`
    - type: `Checkbox`
    - defaultValue: `false`
    - description: "When checked, this capability applies across all other capabilities at the same map (e.g. Security, Compliance). Intended for Level 1 records; downstream visualisation may render cross-cutting capabilities differently."
    - inlineHelpText: "Tick to mark this capability as cross-cutting (applies across all other capabilities). Typically used on Level 1 records."

- [x] **Step 2: Verify generated XML structure**

    Compare against sibling `bcm_HideFromDiagram__c.field-meta.xml`. Should be `<CustomField>` root with `<fullName>`, `<label>`, `<description>`, `<inlineHelpText>`, `<type>Checkbox</type>`, `<defaultValue>false</defaultValue>`.

- [x] **Step 3: Commit**

    ```bash
    git add force-app/main/default/objects/bcm_Capability__c/fields/bcm_IsCrossCutting__c.field-meta.xml
    git commit -m "feat(capability): add bcm_IsCrossCutting__c checkbox field (GH #29)"
    ```

---

## Task 2: Generate the L1-only validation rule

**Files:**

- Create: `force-app/main/default/objects/bcm_Capability__c/validationRules/IsCrossCutting_Only_On_Level_1.validationRule-meta.xml`

- [x] **Step 1: Invoke `generating-validation-rule` skill**

    Rule params:
    - object: `bcm_Capability__c`
    - fullName: `IsCrossCutting_Only_On_Level_1`
    - active: `true`
    - errorConditionFormula: `AND(bcm_IsCrossCutting__c, bcm_Level__c <> 1)`
    - errorMessage: `The Cross-Cutting flag may only be set on Level 1 capabilities.`
    - errorDisplayField: `bcm_IsCrossCutting__c` (so error renders inline next to the checkbox)

- [x] **Step 2: Verify generated XML structure**

    Compare against sibling `Level_Range.validationRule-meta.xml`. Should be `<ValidationRule>` root with `<fullName>`, `<active>`, `<errorConditionFormula>`, optional `<errorDisplayField>`, `<errorMessage>`.

- [x] **Step 3: Commit**

    ```bash
    git add force-app/main/default/objects/bcm_Capability__c/validationRules/IsCrossCutting_Only_On_Level_1.validationRule-meta.xml
    git commit -m "feat(capability): block bcm_IsCrossCutting__c on non-L1 records (GH #29)"
    ```

---

## Task 3: Grant FLS via permission sets

**Files:**

- Modify: `force-app/main/default/permissionsets/bcm_Editor.permissionset-meta.xml`
- Modify: `force-app/main/default/permissionsets/bcm_Viewer.permissionset-meta.xml`

- [x] **Step 1: Add read+edit field permission to `bcm_Editor`**

    Insert a new `<fieldPermissions>` block adjacent to the existing `bcm_HideFromDiagram__c` block. Match Editor file's child-element ordering (`<editable>`, `<field>`, `<readable>`):

    ```xml
    <fieldPermissions>
        <editable>true</editable>
        <field>bcm_Capability__c.bcm_IsCrossCutting__c</field>
        <readable>true</readable>
    </fieldPermissions>
    ```

- [x] **Step 2: Add read-only field permission to `bcm_Viewer`**

    Match Viewer file's child-element ordering (`<editable>`, `<readable>`, `<field>`):

    ```xml
    <fieldPermissions>
        <editable>false</editable>
        <readable>true</readable>
        <field>bcm_Capability__c.bcm_IsCrossCutting__c</field>
    </fieldPermissions>
    ```

- [x] **Step 3: Validate via `generating-permission-set` skill if needed**

    If hand-editing causes deploy errors, regenerate via skill. Existing permset siblings are the source of truth for shape.

- [x] **Step 4: Commit**

    ```bash
    git add force-app/main/default/permissionsets/bcm_Editor.permissionset-meta.xml \
            force-app/main/default/permissionsets/bcm_Viewer.permissionset-meta.xml
    git commit -m "feat(permsets): grant FLS for bcm_IsCrossCutting__c (GH #29)"
    ```

---

## Task 4: Confirm Capability record page renders the field

**Files:**

- (Possibly) Modify: `force-app/main/default/flexipages/bcm_Capability_Record_Page.flexipage-meta.xml`

- [x] **Step 1: Inspect current FlexiPage**

    Current page uses `force:detailPanel` (auto-renders all readable fields per FLS). FLS from Task 2 is sufficient — Editors see editable, Viewers see read-only. **No FlexiPage edit required.**

    If a post-deploy check shows the field missing, invoke `generating-flexipage` to add it explicitly. No commit on this task unless a change is made.

---

## Task 5: Include the flag in Apex selector payloads

**Files:**

- Modify: `force-app/main/default/classes/bcm_CapabilityController.cls`

- [x] **Step 1: Add `bcm_IsCrossCutting__c` to `getCapabilities` SELECT**

    In the `SELECT` list, append after `bcm_HideFromDiagram__c`:

    ```apex
    , bcm_IsCrossCutting__c
    ```

- [x] **Step 2: Add `bcm_IsCrossCutting__c` to `getCapabilityDetail` SELECT**

    Same field, same position relative to `bcm_HideFromDiagram__c`.

- [x] **Step 3: Commit**

    ```bash
    git add force-app/main/default/classes/bcm_CapabilityController.cls
    git commit -m "feat(controller): expose bcm_IsCrossCutting__c via Capability selectors (GH #29)"
    ```

---

## Task 6: Apex roundtrip test + validation rule tests

**Files:**

- Modify: `force-app/main/default/classes/bcm_CapabilityControllerTest.cls`

- [x] **Step 1: Add test asserting flag round-trips through controller**

    Append new `@IsTest` method:

    ```apex
    @IsTest
    static void getCapabilities_returnsIsCrossCuttingFlag_forBothValues() {
        // Given — flip the L1 record's flag on, leave L2 default false
        bcm_Map__c mapA = [SELECT Id FROM bcm_Map__c WHERE Name = 'Test Map A' LIMIT 1];
        bcm_Capability__c l1 = [
            SELECT Id FROM bcm_Capability__c
            WHERE bcm_Map__c = :mapA.Id AND bcm_Level__c = 1 LIMIT 1
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
            if (cap.bcm_Level__c == 1) l1Flag = cap.bcm_IsCrossCutting__c;
            if (cap.bcm_Level__c == 2) l2Flag = cap.bcm_IsCrossCutting__c;
        }
        Assert.areEqual(true,  l1Flag, 'L1 should round-trip the cross-cutting flag as true');
        Assert.areEqual(false, l2Flag, 'L2 default should round-trip as false');
    }
    ```

- [x] **Step 2: Run Apex tests against scratch org**

    ```bash
    sf apex run test --class-names bcm_CapabilityControllerTest --result-format human --code-coverage
    ```

    Expected: all tests pass; new test asserts both `true` and `false` flow through.

- [x] **Step 3: Commit**

    ```bash
    git add force-app/main/default/classes/bcm_CapabilityControllerTest.cls
    git commit -m "test(controller): assert bcm_IsCrossCutting__c round-trips (GH #29)"
    ```

- [x] **Step 4: Add validation rule tests to `bcm_CapabilityValidationTest`**

    Append three `@IsTest` methods (match neighbouring style — `Database.SaveResult` with `allOrNone=false` so the failure surfaces as an error, not a thrown exception):

    ```apex
    @IsTest
    static void isCrossCutting_onLevel1_succeeds() {
        bcm_Map__c m = TestDataFactory.createMap('VR Map', true);
        bcm_Capability__c l1 = new bcm_Capability__c(
            Name = 'L1 cross', bcm_Map__c = m.Id, bcm_Level__c = 1,
            bcm_IsCrossCutting__c = true
        );
        Database.SaveResult sr = Database.insert(l1, false);
        Assert.isTrue(sr.isSuccess(), 'L1 with IsCrossCutting=true should save');
    }

    @IsTest
    static void isCrossCutting_onLevel2_isRejected() {
        bcm_Map__c m = TestDataFactory.createMap('VR Map L2', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c l2 = new bcm_Capability__c(
            Name = 'L2 cross', bcm_Map__c = m.Id, bcm_Parent__c = l1.Id,
            bcm_Level__c = 2, bcm_IsCrossCutting__c = true
        );
        Database.SaveResult sr = Database.insert(l2, false);
        Assert.isFalse(sr.isSuccess(), 'L2 with IsCrossCutting=true should fail');
        Assert.isTrue(
            sr.getErrors()[0].getMessage().contains('Level 1'),
            'Error should mention Level 1 restriction'
        );
    }

    @IsTest
    static void isCrossCutting_onLevel3_isRejected() {
        bcm_Map__c m = TestDataFactory.createMap('VR Map L3', true);
        bcm_Capability__c l1 = TestDataFactory.createCapability(m.Id, null, 1, 1, true);
        bcm_Capability__c l2 = TestDataFactory.createCapability(m.Id, l1.Id, 2, 1, true);
        bcm_Capability__c l3 = new bcm_Capability__c(
            Name = 'L3 cross', bcm_Map__c = m.Id, bcm_Parent__c = l2.Id,
            bcm_Level__c = 3, bcm_IsCrossCutting__c = true
        );
        Database.SaveResult sr = Database.insert(l3, false);
        Assert.isFalse(sr.isSuccess(), 'L3 with IsCrossCutting=true should fail');
    }
    ```

    (Inspect `bcm_CapabilityValidationTest` first — TestDataFactory call signature and `bcm_SortOrder__c` handling may require small adjustments. Existing `level1_noParent_succeeds` is the closest sibling pattern.)

- [x] **Step 5: Run tests**

    ```bash
    sf apex run test --class-names bcm_CapabilityValidationTest --result-format human
    ```

- [x] **Step 6: Commit**

    ```bash
    git add force-app/main/default/classes/bcm_CapabilityValidationTest.cls
    git commit -m "test(validation): assert IsCrossCutting only allowed on L1 (GH #29)"
    ```

---

## Task 7: Update spec

**Files:**

- Modify: `docs/specs/capability-object.md`

- [x] **Step 1: Append new feature block at end of file**

    ```markdown
    ---

    ## Feature: Cross-cutting flag on Capability

    **Scenario: Editor can toggle the cross-cutting flag**

    Given I am logged in as an Editor
    When I open a Capability record page and tick the Is Cross-Cutting checkbox
    Then the field saves and the value persists on reload

    > Deferred: platform-enforced (FLS + standard inline edit); verified via UI, not Apex

    **Scenario: Viewer sees the cross-cutting flag read-only**

    Given I am logged in as a Viewer
    When I open a Capability record page
    Then I see the Is Cross-Cutting field as read-only

    > Deferred: read access is permission-set-enforced; verified via UI, not Apex

    **Scenario: Capability selector returns the cross-cutting flag in its payload**

    Given a Level 1 Capability with Is Cross-Cutting set to true and a Level 2 Capability with the default value
    When the diagram requests capabilities for the map
    Then the L1 record's payload contains `bcm_IsCrossCutting__c = true`
    And the L2 record's payload contains `bcm_IsCrossCutting__c = false`

    > Tested by: `bcm_CapabilityControllerTest.getCapabilities_returnsIsCrossCuttingFlag_forBothValues`

    **Scenario: Cross-cutting flag is rejected on a Level 2 capability**

    Given I am logged in as an Editor and a Level 2 Capability exists
    When I tick Is Cross-Cutting and try to save
    Then I see the error: "The Cross-Cutting flag may only be set on Level 1 capabilities."

    > Tested by: `bcm_CapabilityValidationTest.isCrossCutting_onLevel2_isRejected`

    **Scenario: Cross-cutting flag is rejected on a Level 3 capability**

    Given I am logged in as an Editor and a Level 3 Capability exists
    When I tick Is Cross-Cutting and try to save
    Then I see the error: "The Cross-Cutting flag may only be set on Level 1 capabilities."

    > Tested by: `bcm_CapabilityValidationTest.isCrossCutting_onLevel3_isRejected`

    **Scenario: Cross-cutting flag saves successfully on a Level 1 capability**

    Given I am logged in as an Editor
    When I tick Is Cross-Cutting on a new Capability with Level 1 and no parent
    Then the record saves successfully

    > Tested by: `bcm_CapabilityValidationTest.isCrossCutting_onLevel1_succeeds`
    ```

- [x] **Step 2: Commit**

    ```bash
    git add docs/specs/capability-object.md
    git commit -m "docs(specs): document cross-cutting flag (GH #29)"
    ```

---

## Task 8: COSMIC FP exclusion note

**Files:**

- Modify: `docs/economics/function-point-count.md`

- [x] **Step 1: Append row to §6 Excluded Processes table**

    ```markdown
    | `bcm_IsCrossCutting__c` field add + L1-only validation rule (GH #29) | New attribute on existing entity (`bcm_Capability__c`); no new functional process. Selector payload widens by one boolean — same data movement classification as the existing `getCapabilities` Read. Validation rule is a constraint on the existing Update/Insert process, not a new process. No new R; no new entity. |
    ```

- [x] **Step 2: Commit**

    ```bash
    git add docs/economics/function-point-count.md
    git commit -m "docs(cfp): exclude bcm_IsCrossCutting__c addition from FP count (GH #29)"
    ```

---

## Task 9: Final verification + plan completion

- [x] **Step 1: Deploy + run full Apex suite against scratch org**

    ```bash
    sf project deploy start
    sf apex run test --result-format human --code-coverage --wait 10
    ```

    Expected: clean deploy; all Apex tests pass.

- [x] **Step 2: Run Jest suite**

    ```bash
    npm test
    ```

    Expected: no regressions. (No LWC code changed; LWC payload widens transparently.)

- [x] **Step 3: Manual smoke against scratch org**
    - As Editor: open an L1 Capability, tick Is Cross-Cutting, save, reload — value persists.
    - As Editor: open an L2 Capability, tick Is Cross-Cutting, save — error surfaces; record does not save.
    - As Viewer: open same record — field is read-only.

- [x] **Step 4: Mark plan steps complete**

    Tick every `- [ ]` to `- [x]` with completion date. Update FP table per [[feedback_mark_complete_fp_table]].

- [x] **Step 5: Push branch + open PR (do NOT auto-merge)**

    ```bash
    git push -u origin sf_businesscapability-29
    gh pr create --title "feat: add bcm_IsCrossCutting__c flag to Capability (GH #29)" --body "$(cat <<'EOF'
    ## Summary
    - New `bcm_IsCrossCutting__c` Checkbox field on `bcm_Capability__c` (default `false`)
    - Validation rule `IsCrossCutting_Only_On_Level_1` blocks the flag on L2/L3
    - FLS: Editor read+edit; Viewer read-only
    - Field rendered automatically by `force:detailPanel` on Capability record page
    - `bcm_CapabilityController.getCapabilities` and `getCapabilityDetail` include the flag in their payload
    - Apex tests assert true/false round-trip + L1-only enforcement

    ## Test plan
    - [x] `sf apex run test --class-names bcm_CapabilityControllerTest,bcm_CapabilityValidationTest`
    - [x] `npm test`
    - [x] Manual: L1 Editor toggle on, save, reload — persists
    - [x] Manual: L2 Editor toggle on, save — validation error surfaces
    - [x] Manual: Viewer sees field read-only

    Closes #29
    EOF
    )"
    ```

---

## Self-Review Notes

- **Acceptance criteria coverage:**
    - ☑ Field exists, default `false` — Task 1
    - ☑ L1-only validation rule — Task 2 (added per user request)
    - ☑ FLS Editor edit / Viewer read — Task 3
    - ☑ Renders on FlexiPage — Task 4 (auto via `force:detailPanel` + FLS)
    - ☑ Selectors return flag in payload — Task 5
    - ☑ Apex roundtrip + validation tests — Task 6
    - ☑ Existing tests pass — Task 9
- **Scope discipline:** L1-only enforcement via validation rule; no LWC change. Issue scope is "expose flag through read API"; downstream visualisation work consumes it later.
- **FP table:** No new FP — attribute add + constraint. Excluded-processes row added in T8. [[feedback_mark_complete_fp_table]] — no FP row to tick.
- **Metadata generation:** Field XML via `generating-custom-field`; validation rule via `generating-validation-rule` per CLAUDE.md "Never Hand-Write XML" rule. Permset edits are additions to existing files; if `generating-permission-set` only does whole-file generation, hand-edit is acceptable but verify XSD ordering against existing siblings.
- **Placeholder scan:** Clean — no TBD / TODO.
- **e2e:** No e2e change — field is rendered by standard `force:detailPanel`, behaviour is platform-enforced. Manual smoke per T8 covers UI.
