# Tasks

## 1. Profile metadata

- [x] 1.1 Confirm with the user that hand-editing the profile XML is approved (no Profile skill exists, per `CLAUDE.md`). Record the approval in this task's line. — **Approved 2026-11-02** (hand removal of the two `<userPermissions>` blocks, plus dry-run and deploy to `mydevorg`).
- [x] 1.2 In `force-app/main/default/profiles/AutomatedTester - Minimum Access Clone.profile-meta.xml`, delete the whole `<userPermissions>` element for `BypassMFAForUiLogins` and the one for `SkipIdentityConfirmation`. Verify: `rg -n "BypassMFAForUiLogins|SkipIdentityConfirmation" force-app` returns nothing, and `git diff --stat` shows only those 8 lines removed from the profile.
- [x] 1.3 Confirm with the user that the scripted trim of the profile to project metadata is approved (design.md, "Cut the profile down to project metadata"). Record the approval in this task's line. — **Approved 2026-11-02** (trim to the preview matching design.md's table, plus dry-run and deploy to `mydevorg`).
- [x] 1.4 Run the trim filter (script kept outside the repo) on the profile. Verify: the kept elements match the table in design.md; every object, field, class, layout, app and tab named in the file exists under `force-app`; no `flowAccesses`, `pageAccesses` or `recordTypeVisibilities` remain; and `git diff` shows deletions only.
- [x] 1.5 Dry-run the profile deploy: `sf project deploy start --source-dir "force-app/main/default/profiles" --target-org mydevorg --dry-run`. Verify: success with no profile failure. If `AllowViewKnowledge` is rejected, remove it (design.md) and dry-run again.
- [x] 1.6 Deploy the profile: `sf project deploy start --source-dir "force-app/main/default/profiles" --target-org mydevorg`. Verify: status `Succeeded`, and the profile is listed in `sf org list metadata --metadata-type Profile --target-org mydevorg`.
- [x] 1.7 Add a `LightningExperienceUser` `<userPermissions>` entry to the profile, between `LightningConsoleAllowedForUser` and `ViewHelpLink` (approved by the user 2026-11-02), and deploy it to `mydevorg`. Verify: the deploy succeeds and `PermissionsLightningExperienceUser` is `true` on the profile in `mydevorg`.

## 2. Documentation

- [x] 2.1 Update `docs/design/08-quality-plan.md` (Test Users and Test Users Profile sections). Drop the claim that the profile grants `BypassMFAForUiLogins` / `SkipIdentityConfirmation` "to allow headless login", and remove their bullets. Point to `09-e2e-test-architecture.md` §3 for how auth works now. Verify: `rg -n "BypassMFAForUiLogins|SkipIdentityConfirmation" docs/design/08-quality-plan.md` returns nothing.
- [x] 2.2 In the same "Test Users Profile" section, add that the committed profile lists only this project's `bcm_*` metadata and license-level settings, so it deploys to any org, and that new metadata added to the project must not bring in references to other orgs' metadata. Verify: the section says this and names no `SUI_*`, `cfp_*` or `dk_*` metadata.

## 3. Behaviour verification

- [x] 3.1 Set up e2e in `mydevorg`, where the users are created on the trimmed profile, so no Setup cleanup of old permissions is needed. Create the users with `./scripts/create-e2e-users.sh mydevorg`, point `.env` at `mydevorg` (JWT audience `https://login.salesforce.com`), and do the 3 manual JWT app steps (consumer key, cert upload, profile pre-authorization). Give the admin user `bcm_Editor`, because fields deployed through the Metadata API grant no field access to the admin profile and the seed Apex will not compile without it. Verify: both users are active on `AutomatedTester - Minimum Access Clone` with `bcm_Editor`/`bcm_Viewer` + `bcm_ApiEnabled`.
- [x] 3.2 Delete `tests/e2e/.auth/*.json` and run `npx playwright test --project=setup` against `mydevorg`. Verify: both setup tests pass, `editor.json` and `viewer.json` are written, and no MFA or identity prompt appears (spec scenario "Suite authenticates without login-bypass permissions").
- [x] 3.3 Run the full e2e suite (`npm run test:e2e`) against `mydevorg`. Verify: all tests pass, tab-visibility tests included. — **2026-11-02**: 102 passed, 2 flaky (passed on retry: `capability-tag.spec.ts:38`, `map.spec.ts:34` — first-attempt click timeouts, not auth-related), 8 skipped. Needed `activate-capability-and-tag-record-pages` plus fixes to `map.spec.ts` (Delete dialog scope) and `import.spec.ts` (tooltip blocking the click).
- [x] 3.4 Run `openspec validate remove-legacy-mfa-bypass-from-e2e-profile --strict`. Verify: no errors.

## Workflow follow-up

- Archive the change once tasks are done, syncing the new requirements into `openspec/specs/e2e-authentication/spec.md`.
- Optional: turn off the two permissions on the profile in `home-denispoc` Setup, so that org matches source.
