# Proposal

## Why

The e2e test-user profile `AutomatedTester - Minimum Access Clone` still grants `BypassMFAForUiLogins` and `SkipIdentityConfirmation`. Those permissions were added for the old username/password form login. That login path is gone: both auth modes (`web` and `jwt`) now mint browser sessions through an OAuth frontdoor exchange, so neither permission does anything. They now cause harm. Deploying the project to `mydevorg` failed with `Unknown user permission: BypassMFAForUiLogins` because that org does not offer the permission, and the profile had to be left out of the deploy. Without the profile, the e2e users and the External Client App pre-authorization cannot be set up in that org.

Removing the permissions alone is not enough. A dry-run deploy then failed with `no RecordType named Asset.Component found`. The profile was retrieved whole from `home-denispoc`, so it also refers to objects, fields, record types, classes, apps, tabs, flows and a page that belong to other work in that org (`Asset`, `WorkOrder`, `SUI_*`, `cfp_*`, `dk_*`). Those references make the profile deployable only to that one org.

## What Changes

- Remove the `BypassMFAForUiLogins` user permission from `AutomatedTester - Minimum Access Clone`.
- Remove the `SkipIdentityConfirmation` user permission from the same profile. It is also left over from form login and not needed.
- Cut the profile down to entries for this project's own metadata (`bcm_*`) plus the license-level settings: `userLicense`, `custom`, and the remaining standard user permissions. Remove every field permission, class access, record type visibility, layout assignment, app visibility, tab visibility, flow access and page access that points at metadata outside `force-app`.
- The profile keeps what it does for the project: `ActivitiesAccess` / `ChatterInternalUser` for Lightning, all `bcm_*` tabs hidden, and its role as the External Client App pre-authorization target.
- Update `docs/design/08-quality-plan.md`, which still says the profile grants these permissions "to allow headless login".
- Deploy the profile to `mydevorg` so the full project is present in that org.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `e2e-authentication`: add two requirements. The test-user profile grants no login-bypass permissions, which makes the "no UI login" guarantee explicit at the profile level. The profile refers only to this project's metadata and license-level settings, so it deploys to any org that accepts the project.

## Impact

- **Metadata**: `force-app/main/default/profiles/AutomatedTester - Minimum Access Clone.profile-meta.xml` (two `userPermissions` entries removed, and all entries for metadata outside the project removed; roughly 1,000 lines down to under 100).
- **Docs**: `docs/design/08-quality-plan.md` (Test Users / Test Users Profile sections).
- **Orgs**: `mydevorg` gets the profile for the first time. In orgs that already have the profile (e.g. `home-denispoc`), deploying changes only the entries the file lists. The two permissions and the non-project access stay as they are there. Turning the permissions off is optional cleanup in Setup.
- **Tests**: no test code changes. The e2e `setup` project must still authenticate both users.
