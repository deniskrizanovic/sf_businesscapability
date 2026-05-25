# Step 4 Acceptance Criteria — `bcm_CapabilityTag__c` Junction Object

## Feature: CapabilityTag junction object exists with correct relationships

**Scenario: CapabilityTag object is deployed**
- Given the metadata has been deployed to the org
- When a user navigates to Setup → Object Manager
- Then `bcm_CapabilityTag__c` is listed as a custom object

**Scenario: Capability relationship is a Master-Detail**
- Given the `bcm_CapabilityTag__c` object exists
- When a user views the field detail for `bcm_Capability__c`
- Then the relationship type is Master-Detail pointing to `bcm_Capability__c`

**Scenario: Tag relationship is a Master-Detail**
- Given the `bcm_CapabilityTag__c` object exists
- When a user views the field detail for `bcm_Tag__c`
- Then the relationship type is Master-Detail pointing to `bcm_Tag__c`

---

## Feature: Related lists appear on parent record detail pages

**Scenario: Tags related list appears on a Capability record**
- Given a `bcm_Capability__c` record exists
- When the user opens the record detail page
- Then a related list for `bcm_CapabilityTag__c` is visible

**Scenario: Capabilities related list appears on a Tag record**
- Given a `bcm_Tag__c` record exists
- When the user opens the record detail page
- Then a related list for `bcm_CapabilityTag__c` is visible

---

## Feature: Junction records can be created and cascade-deleted

**Scenario: Editor can link a Capability to a Tag**
- Given a `bcm_Capability__c` record and a `bcm_Tag__c` record both exist
- And the user has the `bcm_Editor` permission set assigned
- When the user creates a `bcm_CapabilityTag__c` record linking the two
- Then the junction record saves successfully and appears in both related lists

**Scenario: Deleting a Capability deletes its junction records**
- Given a `bcm_CapabilityTag__c` record exists linking a Capability to a Tag
- When the parent `bcm_Capability__c` record is deleted
- Then the `bcm_CapabilityTag__c` record is also deleted

**Scenario: Deleting a Tag deletes its junction records**
- Given a `bcm_CapabilityTag__c` record exists linking a Capability to a Tag
- When the parent `bcm_Tag__c` record is deleted
- Then the `bcm_CapabilityTag__c` record is also deleted

---

## Feature: Permission sets grant correct access to CapabilityTag records

**Scenario: Viewer can read a CapabilityTag record**
- Given a `bcm_CapabilityTag__c` record exists
- And the user has the `bcm_Viewer` permission set assigned
- When the user views the related list on a Capability or Tag record
- Then the junction record is visible

**Scenario: Viewer cannot create a CapabilityTag record**
- Given the user has the `bcm_Viewer` permission set assigned
- When the user attempts to insert a `bcm_CapabilityTag__c` record via DML
- Then a `DmlException` is thrown with insufficient privileges

**Scenario: Editor can create and delete a CapabilityTag record**
- Given the user has the `bcm_Editor` permission set assigned
- And both a Capability and a Tag record exist
- When the user creates a junction record then deletes it
- Then both operations complete successfully
