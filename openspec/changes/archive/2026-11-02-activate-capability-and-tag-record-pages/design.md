# Design

## Context

See proposal.md - Why. Current state:

- `force-app/main/default/applications/bcm_BusinessCapabilityMap.app-meta.xml` has one `<actionOverrides>` element: `View`, `Flexipage`, `formFactor` `Large`, `bcm_Map__c` → `bcm_MapRecordPage`. Its comment ("Action override created by Lightning App Builder during activation") shows it was retrieved from an org, not written by hand.
- `bcm_Capability_Record_Page` (`sobjectType` `bcm_Capability__c`) and `bcm_Tag_Record_Page` (`sobjectType` `bcm_Tag__c`) are `RecordPage` FlexiPages in source and deploy cleanly. Nothing in source activates them. The object metadata for `bcm_Capability__c` and `bcm_Tag__c` has no `actionOverrides`.
- `docs/plans/2026-05-25-19:20-implementation-plan.md:228` records that the Capability page was "manually assigned as default for `bcm_BusinessCapabilityMap` app". That activation stayed in `home-denispoc`.
- The e2e tests open records with app-less URLs (`/lightning/r/<object>/<id>/view`). Lightning then uses the user's last-used app. In `mydevorg`, `UserAppInfo` for both e2e users points to `bcm_BusinessCapabilityMap` (Large), because other specs open `/lightning/app/bcm_BusinessCapabilityMap` first.
- `CLAUDE.md` maps Lightning App metadata to the `generating-custom-application` skill. That skill is not installed in this environment, so the rule is: say so and ask before editing the XML by hand.

## Goals / Non-Goals

**Goals:**

- Map, Capability and Tag records open on their custom pages in the BCM app in any org deployed from source.
- The app file stays in the shape an org retrieve would produce.

**Non-Goals:**

- Org-wide default (object-level) activation. Outside the BCM app, records keep the standard page, as Map records already do.
- Phone or other form factors. The app is `Large` only (`<formFactors>Large</formFactors>`).
- Any change to the FlexiPages themselves, to tests, or to the profile.
- The other `mydevorg` failures (`map.spec.ts:34`, `import.spec.ts:80`).

## Decisions

**Activate at app level, using the same element shape as the Map override.** Add two `<actionOverrides>` elements. Each has `actionName` `View`, `content` = page name, `formFactor` `Large`, `pageOrSobjectType` = object, `skipRecordTypeSelect` `false`, and `type` `Flexipage`. This is the same shape as the existing Map element. App level matches how Map is already done and how the Capability page was activated in `home-denispoc`. It also keeps everything in one file.

- _Alternative: org default via `actionOverrides` in each object's `.object-meta.xml`._ Rejected for now. It touches two object files, differs from the Map pattern, and changes the page outside the BCM app too. It would make app-less URLs work for users whose last app is something else. That is not needed today (see Context: `UserAppInfo`), but it is the fallback if that ever changes.
- _Alternative: both app and org level._ Rejected. It doubles the metadata for no observable gain.

**Hand edit with explicit approval, copying the retrieved Map element.** No skill covers Lightning App metadata here. The new elements copy an element that an org already generated, changing only `content` and `pageOrSobjectType`. Both values are names defined in `force-app`. All `<actionOverrides>` elements stay together at the start of `<CustomApplication>`, where the XSD expects them. Order them by `pageOrSobjectType` (Capability, Map, Tag) so a later retrieve gives a small diff. Keep the same `<comment>` text so the file looks like an App Builder retrieve.

- _Alternative: activate both pages in App Builder in `mydevorg`, then `sf project retrieve start --metadata CustomApplication:bcm_BusinessCapabilityMap`._ This is the fallback if the hand edit is not approved. It avoids hand-written XML, but needs manual UI steps, and the retrieve may also reorder or add elements, making the diff noisier.

**Deploy the app only.** `sf project deploy start --source-dir force-app/main/default/applications --target-org mydevorg`, with a `--dry-run` first. The FlexiPages are already in the org.

## Risks / Trade-offs

- [App-less record URLs show the standard page for a user whose last app is not BCM] → True today for Map as well. The e2e users' last app is BCM. If this starts to cause flaky tests, move to org-level activation (see Decisions).
- [Deploying to `home-denispoc` changes its activation] → It sets the same page that is already active there, so nothing visible changes. If that org had activated the pages per profile or record type, the app-level default does not override those, so nothing changes there either.
- [The hand edit breaks the XML] → Dry-run deploy first, then confirm in the org that the Capability and Tag pages are active (`sf org open` on a record, or run the e2e tests).

## Migration Plan

1. Edit the app metadata (after approval) and dry-run, then deploy it to `mydevorg`.
2. Rerun `capability-tag.spec.ts`, `capability.spec.ts` and `tag.spec.ts` against `mydevorg`.
3. Rollback: revert the app file and deploy it again. Then check in Lightning App Builder that the Capability and Tag pages are no longer the app default. If they still are, deactivate them there by hand.
