# Tasks

## 1. App metadata

- [x] 1.1 Confirm with the user that hand-editing `bcm_BusinessCapabilityMap.app-meta.xml` is approved. The `generating-custom-application` skill named in `CLAUDE.md` is not installed. Record the approval in this task's line. If it is not approved, use the App Builder + retrieve fallback from design.md for 1.2 instead. — **Approved 2026-11-02** (hand edit, plus dry-run and deploy of the app only to `mydevorg`).
- [x] 1.2 In `force-app/main/default/applications/bcm_BusinessCapabilityMap.app-meta.xml`, add two `<actionOverrides>` elements copied from the existing `bcm_Map__c` one: `bcm_Capability__c` → `bcm_Capability_Record_Page` and `bcm_Tag__c` → `bcm_Tag_Record_Page`. Keep all three together at the start of the file, ordered Capability, Map, Tag. Verify: `rg -c '<actionOverrides>' force-app/main/default/applications/bcm_BusinessCapabilityMap.app-meta.xml` prints `3`, and `git diff` shows only added lines.
- [x] 1.3 Dry-run the app deploy: `sf project deploy start --source-dir force-app/main/default/applications --target-org mydevorg --dry-run`. Verify: status `Succeeded` with no component failure.
- [x] 1.4 Deploy the app: same command without `--dry-run`. Verify: status `Succeeded`. Open a Capability record and a Tag record in the BCM app in `mydevorg`: the Capability page shows the Tags sidebar, and the Tag page shows the "Colour" card.

## 2. Documentation

- [x] 2.1 Update the FlexiPage sections of `docs/design/07-record-pages.md`:
    - **Map:** name `bcm_MapRecordPage`.
    - **Capability:** name `bcm_Capability_Record_Page`, with the Tags related list in the sidebar.
    - **Tag:** already names `bcm_Tag_Record_Page`.
    - **Activation:** state for all three that each page is activated as the BCM app default for desktop through the app's `actionOverrides` in source, not by hand in App Builder.

    Verify: `rg -n "No custom FlexiPage required" docs/design/07-record-pages.md` returns nothing.

## 3. Behaviour verification

- [x] 3.1 Run `npx playwright test tests/e2e/capability-tag.spec.ts tests/e2e/capability.spec.ts tests/e2e/tag.spec.ts` against `mydevorg`. Verify these pass (they cover the scenarios in `specs/record-pages/spec.md`):
    - "Tags related list is visible in the sidebar"
    - "Editor can link a Tag to a Capability and it appears in the sidebar"
    - "Tags related list has no New button for Viewer"
    - "Definition field is editable via inline-edit pencil — RTF editor mounts with Bold toolbar"
    - "colour swatch lightning-card tile is visible on Tag record page"
- [x] 3.2 Run `openspec validate activate-capability-and-tag-record-pages --strict`. Verify: no errors.

## Workflow follow-up

- Archive the change once tasks are done. This creates `openspec/specs/record-pages/spec.md`.
- Separate follow-ups, not part of this change: `map.spec.ts:34` (strict-mode match on two `Delete` buttons) and `import.spec.ts:80` (tooltip blocks the second **JSON Import** click). After those are fixed, task 3.3 of `remove-legacy-mfa-bypass-from-e2e-profile` (full suite green in `mydevorg`) can be ticked.
