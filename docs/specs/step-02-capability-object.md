# Step 2 Acceptance Criteria — Capability Object

## Feature: A Capability record can be created with all expected fields

**Scenario: Capability form shows all expected fields**
- Given I am logged in as an Editor
- When I open a new Capability record
- Then I see fields for Map, Parent Capability, Level, Sort Order, External ID, Definition, Strategy Support, and Architectural Nuance

**Scenario: External ID must be unique across all Capabilities**
- Given a Capability already exists with a specific External ID
- When I try to save a second Capability with the same External ID
- Then I see an error saying the value must be unique

**Scenario: Parent Capability can only be another Capability**
- Given I am creating a Capability
- When I click the Parent Capability field
- Then I can only search for and select other Capability records

**Scenario: Definition field displays formatted text**
- Given I am logged in as an Editor
- When I create a Capability and enter formatted text in the Definition field
- Then the record saves and the Definition renders the formatting when I view it

---

## Feature: Level and Sort Order fill in automatically

**Scenario: A top-level Capability gets Level 1**
- Given I am logged in as an Editor
- When I save a new Capability without selecting a Parent
- Then the Level is automatically set to 1

**Scenario: A child Capability gets Level 2**
- Given a Level 1 Capability exists
- When I save a new Capability with that record as its Parent
- Then the Level is automatically set to 2

**Scenario: A grandchild Capability gets Level 3**
- Given a Level 2 Capability exists
- When I save a new Capability with that record as its Parent
- Then the Level is automatically set to 3

**Scenario: Sort Order is assigned as the next available number when left blank**
- Given two Capabilities exist under the same Map and Parent with Sort Orders 1 and 2
- When I save a third Capability under the same Map and Parent without entering a Sort Order
- Then the Sort Order is automatically set to 3

**Scenario: Sort Order is preserved when I enter one manually**
- Given I am logged in as an Editor
- When I save a Capability with Sort Order set to 10
- Then the Sort Order stays at 10

---

## Feature: Validation prevents structurally invalid Capabilities

**Scenario: Level 0 is rejected**
- Given I am logged in as an Editor
- When I try to save a Capability with Level set to 0
- Then I see the error: "Level must be 1, 2, or 3."

**Scenario: Level 4 is rejected**
- Given I am logged in as an Editor
- When I try to save a Capability with Level set to 4
- Then I see the error: "Level must be 1, 2, or 3."

**Scenario: A top-level Capability with Level 1 and no Parent saves successfully**
- Given I am logged in as an Editor
- When I save a Capability with Level 1 and no Parent selected
- Then the record saves successfully

**Scenario: Level 2 with no Parent is rejected**
- Given I am logged in as an Editor
- When I try to save a Capability with Level 2 and no Parent selected
- Then I see the error: "A capability with no parent must be Level 1."

**Scenario: Level 3 with no Parent is rejected**
- Given I am logged in as an Editor
- When I try to save a Capability with Level 3 and no Parent selected
- Then I see the error: "A capability with no parent must be Level 1."

**Scenario: Level 1 with a Parent is rejected**
- Given I am logged in as an Editor and a Capability record exists
- When I try to save a new Capability with Level 1 and that record set as its Parent
- Then I see the error: "A capability with a parent must be Level 2 or 3."

**Scenario: Level 2 with a Parent saves successfully**
- Given a Level 1 Capability exists
- When I save a new Capability with Level 2 and that record as its Parent
- Then the record saves successfully

**Scenario: Level 3 with a Parent saves successfully**
- Given a Level 2 Capability exists
- When I save a new Capability with Level 3 and that record as its Parent
- Then the record saves successfully

---

## Feature: Access rules are enforced for Editors and Viewers

**Scenario: Viewer can read a Capability record**
- Given I am logged in as a Viewer
- When I open a Capability record
- Then the record page loads and I can read all fields

**Scenario: Viewer cannot create a Capability record**
- Given I am logged in as a Viewer
- When I attempt to create a new Capability record
- Then I am denied access and cannot save the record

**Scenario: Editor can create, edit, and delete a Capability**
- Given I am logged in as an Editor
- When I create a valid Capability, then edit it, then delete it
- Then each action completes without error

**Scenario: Editor cannot save a structurally invalid Capability**
- Given I am logged in as an Editor
- When I try to save a Capability with Level 2 and no Parent
- Then I see a validation error and the record is not saved

---

## Feature: Map record page shows linked Capabilities

**Scenario: Map record page includes a Capabilities section**
- Given a Map record exists
- When I open that Map record as a Viewer or Editor
- Then I see a Capabilities related list on the page

**Scenario: A linked Capability appears in the Map's related list**
- Given a Map record exists and a Capability is linked to it
- When I open the Map record
- Then that Capability appears in the Capabilities related list

---

## Feature: Capabilities tab is visible in the app

**Scenario: Capabilities tab is visible for Editors**
- Given I am logged in as an Editor
- When I open the Business Capability Map app
- Then I see a Capabilities tab in the navigation bar

**Scenario: Capabilities tab is visible for Viewers**
- Given I am logged in as a Viewer
- When I open the Business Capability Map app
- Then I see a Capabilities tab in the navigation bar
