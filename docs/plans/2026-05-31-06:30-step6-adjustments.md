# Step 6 Adjustments — Move Import to Map List View (as-built)

## What Was Done

Import button moved from `bcm_Map__c` record page to the Map **list view** as a custom list view button (WebLink `massActionButton`), not a quick action. Salesforce does not allow invoking an LWC from a list view; the solution is a WebLink that opens the flow URL directly.

---

## Changes

### 1. New WebLink: `bcm_Map__c.JSON_Import`

- File: `force-app/main/default/objects/bcm_Map__c/webLinks/JSON_Import.webLink-meta.xml`
- Type: `massActionButton` (list view button)
- `linkType`: `url` → opens `/flow/bcm_Import_Flow`
- `masterLabel`: `JSON Import`
- Created manually in org; retrieved via `sf project retrieve start --metadata "CustomObject:bcm_Map__c"`

### 2. Remove Import action from record page

- File: `force-app/main/default/flexipages/bcm_MapRecordPage.flexipage-meta.xml`
- Removed `bcm_Map__c.Import` from `actionNames` block
- `numVisibleActions` reduced from 3 → 2
- Updated via org retrieve

### 3. Search Layout wired (manual, not retrievable)

Salesforce does not expose "List View Buttons" assignment as retrievable metadata. Already configured in `home-denispoc`:

> Setup → Object Manager → Map → Search Layouts → List View → Edit → "Custom Buttons" → add `JSON Import`

This step must be repeated per org after deploy.

### 4. Unchanged: `bcm_Map__c.Import` QuickAction

The original quick action (`quickActions/bcm_Map__c.Import.quickAction-meta.xml`) still exists but is no longer surfaced on any page. Can be deleted in a future cleanup.

---

## Files Changed

| File | Change |
|---|---|
| `objects/bcm_Map__c/webLinks/JSON_Import.webLink-meta.xml` | new — list view button opening `/flow/bcm_Import_Flow` |
| `flexipages/bcm_MapRecordPage.flexipage-meta.xml` | removed Import action from record page |
| `objects/bcm_Map__c/bcm_Map__c.object-meta.xml` | updated (org retrieve) |
| `objects/bcm_Map__c/listViews/All.listView-meta.xml` | updated (org retrieve) |
| `tests/e2e/import.spec.ts` | updated — all flow selectors via `frameLocator('iframe')`; 40s wait for slow sandbox |

---

## E2E Test Changes

`tests/e2e/import.spec.ts` updated:

- `openImportPanel` navigates to `/lightning/o/bcm_Map__c/list?filterName=All`, clicks `JSON Import` button
- Flow runs inside an **iframe** (list view actions in Lightning open in iframes) — all flow-content selectors routed through `page.frameLocator('iframe')`
- Wait timeout increased to 40s (sandbox can take >20s to render flow in iframe)
- All 9 tests pass

---

## Known Gap: Manual Post-Deploy Step Required

Salesforce does not expose "List View Buttons" assignment as retrievable metadata.

After deploy to a new org:

1. Setup → Object Manager → Map → Search Layouts → List View → Edit
2. Under "Custom Buttons" → add `JSON Import`
3. Save
