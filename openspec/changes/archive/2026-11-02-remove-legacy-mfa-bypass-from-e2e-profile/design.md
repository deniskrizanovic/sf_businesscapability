# Design

## Context

See proposal.md - Why. Current state:

- `force-app/main/default/profiles/AutomatedTester - Minimum Access Clone.profile-meta.xml` has two `<userPermissions>` blocks (`BypassMFAForUiLogins`, `SkipIdentityConfirmation`), both `enabled=true`, mixed into the alphabetical permission list.
- `CLAUDE.md` maps no generation skill to Profile metadata. Its rule is: state that explicitly and ask before editing `*-meta.xml` by hand.
- `docs/design/09-e2e-test-architecture.md:124` and ADR 0006 already record that these permissions no longer matter. `docs/design/08-quality-plan.md` (Test Users section) still describes them as required.
- The `mydevorg` deploy left the profile out. Every other component deployed (77/77).
- The profile was retrieved whole from `home-denispoc`. Besides the two permissions, it lists access to that org's other work: 140 field permissions (only 6 on `bcm_*` objects), 35 class accesses (only 5 in `force-app`), 14 record type visibilities and 12 layout assignments (only 1 for `bcm_*`), 4 app visibilities (1 `bcm_*`), 15 tab visibilities (3 `bcm_*`), 3 flow accesses and 1 page access (none in the project). A dry-run deploy of the profile to `mydevorg` fails on the first of these: `no RecordType named Asset.Component found`.

## Goals / Non-Goals

**Goals:**

- The committed profile deploys cleanly to `mydevorg` and to any org that accepts the rest of `force-app`.
- Documentation matches what the profile actually grants.

**Non-Goals:**

- Turning the two permissions off in orgs that already have the profile (`home-denispoc`). Deploying leaves missing profile entries unchanged, so they stay enabled there until someone turns them off in Setup. This is optional and harmless.
- Making the admin field-access fix part of the deploy. In `mydevorg`, the admin user is given `bcm_Editor` by hand (task 3.1); it is not committed as metadata.
- Any change to e2e auth code or Playwright config.
- Matching the Minimum Access baseline exactly in a new org. In a new org the profile starts from the `Salesforce` license defaults, plus what the file lists. The e2e tests depend only on the `bcm_*` entries and the Lightning permissions, which the file keeps.

## Decisions

**Delete the two `<userPermissions>` blocks by hand, with explicit approval.** No skill covers Profile metadata. Removing two complete, self-contained elements leaves the schema's element ordering unchanged and adds no org-specific values, which are the risks the "never hand-write XML" rule guards against. The apply step needs explicit user approval first, per `CLAUDE.md`.

- _Alternative: turn the permissions off in Setup, then retrieve the profile._ Rejected. The org that holds the profile (`home-denispoc`) has an expired session, and retrieving a profile only brings back the parts covered by the retrieve manifest. That produces a noisy, partial diff of a 1000+ line file. The hand deletion gives a deterministic two-block diff.
- _Alternative: keep the permissions and leave the profile out of deploys to orgs without them._ Rejected. The profile is needed for e2e in every org: it hides the `bcm_*` tabs and is the External Client App pre-authorization target. Leaving it out permanently breaks e2e setup in those orgs.

**Cut the profile down to project metadata with a scripted filter, with a second explicit approval.** Each top-level child of `<Profile>` is a self-contained element. A one-off script (kept outside the repo) keeps an element only if every metadata name it refers to is defined in `force-app`, or if it is a license-level setting (`userLicense`, `custom`, `userPermissions`). Everything else is deleted whole. Kept elements stay byte-for-byte the same and in the same order, so the schema's element ordering holds. Expected result:

| Element                                                  | Kept                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applicationVisibilities`                                | `bcm_BusinessCapabilityMap`                                                                                                                                     |
| `classAccesses`                                          | `TestDataFactory`, `bcm_CapabilityHandler`, `bcm_CapabilityTagTest`, `bcm_CapabilityValidationTest`, `bcm_TagValidationTest`                                    |
| `fieldPermissions`                                       | 6 fields on `bcm_Capability__c` / `bcm_Map__c`                                                                                                                  |
| `layoutAssignments`                                      | `bcm_Capability__c-Capability Layout`                                                                                                                           |
| `tabVisibilities`                                        | `bcm_Capability__c`, `bcm_Map__c`, `bcm_Tag__c` (all `Hidden`)                                                                                                  |
| `custom`, `userLicense`                                  | unchanged                                                                                                                                                       |
| `userPermissions`                                        | `ActivitiesAccess`, `AllowViewKnowledge`, `ChatterInternalUser`, `LightningConsoleAllowedForUser`, `LightningExperienceUser` (added, see below), `ViewHelpLink` |
| `flowAccesses`, `pageAccesses`, `recordTypeVisibilities` | none                                                                                                                                                            |

- _Alternative: delete only the entries that fail, one dry-run at a time._ Rejected. It takes many deploy rounds and still leaves entries that happen to deploy (for example standard-object fields) but have nothing to do with this project.
- _Alternative: rebuild from a fresh Minimum Access clone in `mydevorg` and retrieve._ Rejected. It is manual Setup work, and the retrieved file picks up that org's own references in the same way.
- _Alternative: leave the profile out of other orgs._ Rejected for the same reason as above: e2e needs it everywhere.

**Remove `SkipIdentityConfirmation` too, not just the permission that blocked the deploy.** It is left over from the same form-login design, and keeping it would suggest it still matters. Its only possible effect was on UI logins, which no longer happen.

**Check behaviour against the real `setup` project.** No unit test can show that auth works without the permissions. The proof is a deploy to `mydevorg` plus a `setup` run against an org where the users hold the updated profile.

**Add `LightningExperienceUser` to the profile.** The committed profile never listed it. `home-denispoc` must have turned it on in Setup without it reaching source. In `mydevorg` the profile started from the license defaults, which leave it off, so every Lightning page showed "You can't access Lightning Experience" and nearly the whole e2e suite failed. Adding it in the file, rather than turning it on in Setup, keeps the profile self-contained in every org. The new element sits alphabetically between `LightningConsoleAllowedForUser` and `ViewHelpLink`. The user approved this hand edit on 2026-11-02.

**Keep `AllowViewKnowledge` unless the dry-run rejects it.** It is a standard permission, but it needs Knowledge to be enabled. If `mydevorg` rejects it, remove it too: the e2e tests do not use Knowledge.

## Risks / Trade-offs

- [Hidden dependency on the permissions in some untried path] → Both auth modes avoid the login form, as the spec scenario "No username/password form login occurs" already requires. Running `setup` and the full suite in `mydevorg` confirms nothing breaks. The users there were created on the trimmed profile, so they never had either permission.
- [Hand edit or filter corrupts the XML] → Remove only whole top-level elements and keep the rest byte-for-byte. Check with `sf project deploy start --dry-run` against `mydevorg` before the real deploy.
- [A removed entry was needed by the e2e users] → None of the removed entries refer to project metadata, and the e2e tests touch only `bcm_*` objects. The `setup` run plus a full e2e run against an org with the new profile confirms nothing breaks.
- [Trimmed profile deployed to `home-denispoc` looks like it should remove access] → It does not: deploying changes only listed entries. Access to `SUI_*` / `cfp_*` there is unchanged.
- [`home-denispoc` keeps the permissions, so it differs from source] → Accepted (see Non-Goals). The optional cleanup is listed as a follow-up.

## Migration Plan

1. Edit the profile (after each approval): remove the two permissions, then run the trim filter. Update `08-quality-plan.md`.
2. Dry-run the profile deploy to `mydevorg`, then deploy it: `sf project deploy start --source-dir "force-app/main/default/profiles" --target-org mydevorg`.
3. Rollback: revert the profile file. Deploying the old version to `mydevorg` fails again, so rolling back means leaving the profile out of that org.
