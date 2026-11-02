# Spec Delta

## ADDED Requirements

### Requirement: Test-user profile grants no login-bypass permissions

The shared test-user profile (`AutomatedTester - Minimum Access Clone`) SHALL NOT grant `BypassMFAForUiLogins` or `SkipIdentityConfirmation`. The suite never uses the UI login form, so these permissions SHALL NOT be needed for authentication.

#### Scenario: Committed profile omits login-bypass permissions

- **WHEN** the committed `AutomatedTester - Minimum Access Clone` profile metadata is inspected
- **THEN** it contains no `userPermissions` entry for `BypassMFAForUiLogins` or `SkipIdentityConfirmation`

#### Scenario: Suite authenticates without login-bypass permissions

- **WHEN** both test users hold the profile without `BypassMFAForUiLogins` or `SkipIdentityConfirmation` and the `setup` project runs in either `web` or `jwt` mode
- **THEN** the editor and viewer sessions are minted and `editor.json` / `viewer.json` are written, with no MFA or identity-verification prompt

### Requirement: Test-user profile is deployable to any project org

The committed test-user profile SHALL refer only to metadata that this project deploys (`bcm_*` objects, fields, classes, layouts, tabs and the app) and to license-level settings (user license, standard user permissions). It SHALL NOT refer to objects, fields, record types, classes, apps, tabs, flows or pages that exist only in one particular org. It SHALL keep every `bcm_*` tab hidden.

#### Scenario: Committed profile references only project metadata

- **WHEN** every object, field, record type, class, layout, app, tab, flow and page named in the committed profile is checked against `force-app`
- **THEN** each one is either defined in `force-app` or is a license-level setting, and none belongs to other work in a single org (e.g. `Asset`, `WorkOrder`, `SUI_*`, `cfp_*`, `dk_*`)

#### Scenario: Profile deploys to an org without the original org's metadata

- **WHEN** the project's `force-app` source, profile included, is deployed to an org that has none of the original org's other metadata and does not offer `BypassMFAForUiLogins` (e.g. `mydevorg`)
- **THEN** the deploy succeeds with no profile failure (no `Unknown user permission`, no missing record type, field, class, app, tab, flow or page)

#### Scenario: Profile grants Lightning Experience access on its own

- **WHEN** a test user holding only this profile and the project permission sets opens a Lightning page in an org where the profile was newly created from source
- **THEN** the page loads in Lightning Experience with no "You can't access Lightning Experience" screen, because the committed profile itself enables `LightningExperienceUser`

#### Scenario: Project tabs stay hidden at profile level

- **WHEN** the committed profile is inspected
- **THEN** `bcm_Map__c`, `bcm_Capability__c` and `bcm_Tag__c` each have a tab visibility of `Hidden`
