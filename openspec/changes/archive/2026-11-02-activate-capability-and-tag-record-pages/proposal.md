# Proposal

## Why

`bcm_Capability_Record_Page` and `bcm_Tag_Record_Page` are deployed but not activated anywhere in source. In `home-denispoc` they were activated by hand in Lightning App Builder, and that never reached the repo. In a new org (`mydevorg`) both objects show the standard record page instead, so 5 e2e tests fail: no Tags sidebar, no Definition field, no colour swatch.

## What Changes

- Add a `View` action override to the `bcm_BusinessCapabilityMap` app for `bcm_Capability__c` → `bcm_Capability_Record_Page`, matching the existing `bcm_Map__c` → `bcm_MapRecordPage` override.
- Add the same kind of override for `bcm_Tag__c` → `bcm_Tag_Record_Page`.
- Deploy only the app to `mydevorg` and rerun the affected e2e specs.
- Update `docs/design/07-record-pages.md`: its FlexiPage sections say Map and Capability use the standard page, which is out of date. Record that all three custom pages are activated through the app's action overrides.

Out of scope: `map.spec.ts:34` ("editor deletes a Map record", two `Delete` buttons match) and `import.spec.ts:80` (a tooltip blocks the second click). Those failures have other causes.

## Capabilities

### New Capabilities

- `record-pages`: which Lightning record page each project object shows in the project app, and that the choice comes from source so every org gets the same pages.

### Modified Capabilities

None.

## Impact

- **Metadata:** `force-app/main/default/applications/bcm_BusinessCapabilityMap.app-meta.xml` (2 new `actionOverrides` elements). No FlexiPage, object or profile changes.
- **Orgs:**
    - `mydevorg`: Capability and Tag records open on the custom pages.
    - `home-denispoc`: no visible change, because the same pages are already active there. The deploy replaces the hand-made activation with the source-defined one.
- **Tests:** these tests should pass in `mydevorg` once the change is in:
    - `capability-tag.spec.ts:22`, `:38`, `:66`
    - `capability.spec.ts:28`
    - `tag.spec.ts:25`

    No test code changes.

- **Docs:** `docs/design/07-record-pages.md`.
