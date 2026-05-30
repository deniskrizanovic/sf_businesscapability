# Acceptance Criteria — Capability Tag Object

## Feature: Related lists appear on parent record detail pages

**Scenario: Tags related list appears on a Capability record**

Given a Capability record exists  
When the user opens the record detail page  
Then a Tags related list is visible in the sidebar (not in a Related tab)  

> Tested by: `e2e/capability-tag.spec.ts::"Tags related list is visible in the sidebar"`

**Scenario: Capabilities related list appears on a Tag record**

> Deferred: Tags are the lookup side of the diagram colour-by-tag feature; the Capabilities related list on bcm_Tag__c is not required until Step 7 and will be added then.

Given a Tag record exists  
When the user opens the record detail page  
Then a Capabilities related list is visible  

---

## Feature: Capabilities can be linked to Tags and links cascade-delete correctly

**Scenario: Editor can link a Capability to a Tag**

Given a Capability record and a Tag record both exist  
And the user has the `bcm_Editor` permission set assigned  
When the user creates a link between the two records  
Then the link saves successfully and appears in both related lists  

> Tested by: `bcm_CapabilityTagTest.editor_insertsJunction_succeeds`, `e2e/capability-tag.spec.ts::"Editor can link a Tag to a Capability and it appears in the sidebar"`

**Scenario: Deleting a Capability deletes its tag links**

Given a link exists between a Capability and a Tag  
When the parent Capability record is deleted  
Then the link record is also deleted  

> Tested by: bcm_CapabilityTagTest.deleteParentCapability_cascadesDeletesJunction

**Scenario: Deleting a Tag deletes its capability links**

Given a link exists between a Capability and a Tag  
When the parent Tag record is deleted  
Then the link record is also deleted  

> Tested by: bcm_CapabilityTagTest.deleteParentTag_cascadesDeletesJunction

---

## Feature: Permission sets grant correct access to Capability-Tag links

**Scenario: Viewer can see Capability-Tag links**

Given a link exists between a Capability and a Tag  
And the user has the `bcm_Viewer` permission set assigned  
When the user views the related list on a Capability or Tag record  
Then the link is visible  

> Tested by: `e2e/capability-tag.spec.ts::"Tags related list has no New button for Viewer"`

**Scenario: Viewer cannot create a Capability-Tag link**

Given the user has the `bcm_Viewer` permission set assigned  
When the user attempts to create a link between a Capability and a Tag  
Then access is denied and the link is not created  

> Tested by: `bcm_CapabilityTagTest.viewer_cannotCreateJunction`, `e2e/capability-tag.spec.ts::"Tags related list has no New button for Viewer"`

**Scenario: Editor can create and delete a Capability-Tag link**

Given the user has the `bcm_Editor` permission set assigned  
And both a Capability and a Tag record exist  
When the user creates a link between them then deletes it  
Then both operations complete successfully  

> Tested by: bcm_CapabilityTagTest.editor_insertsJunction_succeeds, bcm_CapabilityTagTest.editor_deletesJunction_succeeds
