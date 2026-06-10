# Acceptance Criteria — Capability Object

## Feature: A Capability record can be created with all expected fields

**Scenario: Capability form shows all expected fields**

> Tested by: `e2e/capability.spec.ts::"new Capability form shows all expected fields"`

Given I am logged in as an Editor  
When I open a new Capability record  
Then I see fields for Map, Parent Capability, Level, Sort Order, External ID, Definition, Strategy Support, and Architectural Nuance

**Scenario: External ID must be unique across all Capabilities**

> Deferred: platform-enforced (Unique field constraint); verified via UI, not Apex

Given a Capability already exists with a specific External ID  
When I try to save a second Capability with the same External ID  
Then I see an error saying the value must be unique

**Scenario: Parent Capability can only be another Capability**

> Tested by: `e2e/capability.spec.ts::"Parent Capability lookup only returns Capabilities"`

Given I am creating a Capability  
When I click the Parent Capability field  
Then I can only search for and select other Capability records

**Scenario: Definition field is editable via the inline-edit pencil**

Given I am logged in as an Editor  
And I open a Capability record  
When I click the Edit Definition pencil  
Then the rich-text editor mounts inside the Definition field with formatting controls (Bold) available

> Tested by: `e2e/capability.spec.ts::"Definition field is editable via inline-edit pencil — RTF editor mounts with Bold toolbar"`

**Scenario: Formatted text in the Definition field persists and renders**

Given I am logged in as an Editor  
When I enter formatted text (e.g. bold) in the Definition field via inline edit and save  
Then the record saves and the Definition renders the formatting when I view it

> Deferred: persistence + render of formatted rich text is platform-enforced (Salesforce inline-edit + lightning-formatted-rich-text); no project code on this path.

---

## Feature: Level and Sort Order fill in automatically

**Scenario: A top-level Capability gets Level 1**

> Tested by: `bcm_CapabilityValidationTest.level_derivedAs1_whenNoParent`

Given I am logged in as an Editor  
When I save a new Capability without selecting a Parent  
Then the Level is automatically set to 1

**Scenario: A child Capability gets Level 2**

> Tested by: `bcm_CapabilityValidationTest.level_derivedAs2_whenParentIsL1`

Given a Level 1 Capability exists  
When I save a new Capability with that record as its Parent  
Then the Level is automatically set to 2

**Scenario: A grandchild Capability gets Level 3**

> Tested by: `bcm_CapabilityValidationTest.level_derivedAs3_whenParentIsL2`

Given a Level 2 Capability exists  
When I save a new Capability with that record as its Parent  
Then the Level is automatically set to 3

**Scenario: Sort Order is assigned as the next available number when left blank**

> Tested by: `bcm_CapabilityValidationTest.sortOrder_autoAssigned_whenNotProvided`

Given two Capabilities exist under the same Map and Parent with Sort Orders 1 and 2  
When I save a third Capability under the same Map and Parent without entering a Sort Order  
Then the Sort Order is automatically set to 3

**Scenario: Sort Order is preserved when I enter one manually with no siblings**

> Tested by: `bcm_CapabilityValidationTest.sortOrder_preserved_whenExplicitlyProvided`

Given I am logged in as an Editor and no other Capabilities exist under the same Map and Parent  
When I save a Capability with Sort Order set to 10  
Then the Sort Order stays at 10

**Scenario: Existing siblings shift down when I insert a Capability at a taken Sort Order**

> Tested by: `bcm_CapabilityValidationTest.sortOrder_shiftsSiblings_whenInsertedAtExplicitPosition`

Given 15 Capabilities exist under the same Map and Parent with Sort Orders 1 through 15  
When I save a new Capability under the same Map and Parent with Sort Order set to 5  
Then the new Capability has Sort Order 5  
And the Capabilities that previously occupied positions 5 through 15 each move down one position  
And the Capabilities with Sort Orders 1 through 4 are unchanged

**Scenario: Inserting a Capability at a free Sort Order leaves siblings with higher Sort Orders unchanged**

> Tested by: `bcm_CapabilityValidationTest.sortOrder_doesNotShiftSiblings_whenInsertedAtFreePosition`

Given two Capabilities exist under the same Map and Parent with Sort Orders 1 and 6  
When I save a new Capability under the same Map and Parent with Sort Order set to 2  
Then the new Capability has Sort Order 2  
And the Capability with Sort Order 6 remains at 6

**Scenario: Multiple Capabilities inserted in the same save each land at their requested Sort Order**

> Tested by: `bcm_CapabilityValidationTest.sortOrder_shiftsSiblingsByBoth_whenTwoRecordsInsertedAtExplicitPositions`

Given 10 Capabilities exist under the same Map and Parent with Sort Orders 1 through 10  
When I save two new Capabilities in the same transaction with Sort Orders 3 and 7  
Then the first new Capability has Sort Order 3  
And the second new Capability has Sort Order 7  
And existing Capabilities that were displaced by either insertion are each shifted down by the correct amount

---

## Feature: Validation prevents structurally invalid Capabilities

**Scenario: Level 0 is rejected**

> Tested by: `bcm_CapabilityValidationTest.level0_isRejected`

Given I am logged in as an Editor  
When I try to save a Capability with Level set to 0  
Then I see the error: "Level must be 1, 2, or 3."

**Scenario: Level 4 is rejected**

> Tested by: `bcm_CapabilityValidationTest.level4_isRejected`

Given I am logged in as an Editor  
When I try to save a Capability with Level set to 4  
Then I see the error: "Level must be 1, 2, or 3."

**Scenario: A top-level Capability with Level 1 and no Parent saves successfully**

> Tested by: `bcm_CapabilityValidationTest.level1_noParent_succeeds`

Given I am logged in as an Editor  
When I save a Capability with Level 1 and no Parent selected  
Then the record saves successfully

**Scenario: Level 2 with no Parent is rejected**

> Tested by: `bcm_CapabilityValidationTest.level2_noParent_isRejected`

Given I am logged in as an Editor  
When I try to save a Capability with Level 2 and no Parent selected  
Then I see the error: "A capability with no parent must be Level 1."

**Scenario: Level 3 with no Parent is rejected**

> Tested by: `bcm_CapabilityValidationTest.level3_noParent_isRejected`

Given I am logged in as an Editor  
When I try to save a Capability with Level 3 and no Parent selected  
Then I see the error: "A capability with no parent must be Level 1."

**Scenario: Level 1 with a Parent is rejected**

> Tested by: `bcm_CapabilityValidationTest.level1_withParent_isRejected`

Given I am logged in as an Editor and a Capability record exists  
When I try to save a new Capability with Level 1 and that record set as its Parent  
Then I see the error: "A capability with a parent must be Level 2 or 3."

**Scenario: Level 2 with a Parent saves successfully**

> Tested by: `bcm_CapabilityValidationTest.level2_withParent_succeeds`

Given a Level 1 Capability exists  
When I save a new Capability with Level 2 and that record as its Parent  
Then the record saves successfully

**Scenario: Level 3 with a Parent saves successfully**

> Tested by: `bcm_CapabilityValidationTest.level3_withParent_succeeds`

Given a Level 2 Capability exists  
When I save a new Capability with Level 3 and that record as its Parent  
Then the record saves successfully

**Scenario: A Level 3 Capability parented to a Level 1 is rejected**

> Tested by: `bcm_CapabilityValidationTest.level3_withL1Parent_isRejected`

Given a Level 1 Capability exists  
When I try to save a new Capability with Level 3 and that Level 1 record as its Parent  
Then I see the error: "The parent capability must be exactly one level above (e.g. a Level 3 capability must have a Level 2 parent)."

**Scenario: A Level 2 Capability parented to another Level 2 is rejected**

> Tested by: `bcm_CapabilityValidationTest.level2_withL2Parent_isRejected`

Given a Level 2 Capability exists  
When I try to save a new Capability with Level 2 and that Level 2 record as its Parent  
Then I see the error: "The parent capability must be exactly one level above (e.g. a Level 3 capability must have a Level 2 parent)."

---

## Feature: Access rules are enforced for Editors and Viewers

> Access enforcement is **CRUD-based**, not sharing-based: `bcm_Capability__c` is `ReadWrite` OWD (see [data-model § Org-Wide Defaults](../design/01-data-model.md#org-wide-defaults-sharing-model)). `bcm_Viewer` grants `Read` only on the object, so Viewer writes are blocked by Salesforce's CRUD check, not by record sharing.

**Scenario: Viewer can read a Capability record**

> Deferred: read access is permission-set-enforced; verified via UI, not Apex

Given I am logged in as a Viewer  
When I open a Capability record  
Then the record page loads and I can read all fields

**Scenario: Viewer cannot create a Capability record**

> Tested by: `bcm_CapabilityValidationTest.viewer_cannotInsertCapability`

Given I am logged in as a Viewer  
When I attempt to create a new Capability record  
Then I am denied access and cannot save the record

**Scenario: Editor can create, edit, and delete a Capability**

> Tested by: `bcm_CapabilityValidationTest.editor_canInsertValidCapability`

Given I am logged in as an Editor  
When I create a valid Capability, then edit it, then delete it  
Then each action completes without error

**Scenario: Editor cannot save a structurally invalid Capability**

> Tested by: `bcm_CapabilityValidationTest.editor_cannotInsertInvalidCapability`

Given I am logged in as an Editor  
When I try to save a Capability with Level 2 and no Parent  
Then I see a validation error and the record is not saved

---

## Feature: Map record page shows linked Capabilities

**Scenario: Map record page includes a Capabilities section**

> Tested by: `e2e/capability.spec.ts::"Map record page includes a Capabilities related list"`

Given a Map record exists  
When I open that Map record as a Viewer or Editor  
Then I see a Capabilities related list on the page

**Scenario: A linked Capability appears in the Map's related list**

> Tested by: `e2e/capability.spec.ts::"linked Capability appears in the Map related list"`

Given a Map record exists and a Capability is linked to it  
When I open the Map record  
Then that Capability appears in the Capabilities related list

---

## Feature: Capabilities tab is visible in the app

**Scenario: Capabilities tab is visible for Editors**

> Tested by: `e2e/capability.spec.ts::"Capabilities tab is visible to Editor"`

Given I am logged in as an Editor  
When I open the Business Capability Map app  
Then I see a Capabilities tab in the navigation bar

**Scenario: Capabilities tab is visible for Viewers**

> Tested by: `e2e/capability.spec.ts::"Capabilities tab is visible to Viewer"`

Given I am logged in as a Viewer  
When I open the Business Capability Map app  
Then I see a Capabilities tab in the navigation bar

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

**Scenario: Cross-cutting flag can be cleared when reparenting an L1 to L2**

Given a Level 1 Capability with Is Cross-Cutting set to true  
When I reparent it under another Level 1 (making it Level 2) and clear Is Cross-Cutting in the same save  
Then the record saves successfully

> Tested by: `bcm_CapabilityValidationTest.isCrossCutting_clearedOnReparentToL2_succeeds`

**Scenario: Reparenting an L1 with the cross-cutting flag still set is rejected**

Given a Level 1 Capability with Is Cross-Cutting set to true  
When I reparent it under another Level 1 (making it Level 2) without clearing Is Cross-Cutting  
Then I see the error: "The Cross-Cutting flag may only be set on Level 1 capabilities."

> Tested by: `bcm_CapabilityValidationTest.isCrossCutting_remainsTrue_whenReparentedToL2_isRejected`
