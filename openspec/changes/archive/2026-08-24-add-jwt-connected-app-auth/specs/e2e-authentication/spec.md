## ADDED Requirements

### Requirement: Auth strategy selectable via environment

The e2e suite SHALL choose its browser-auth token source from an `SF_AUTH_MODE` environment variable with values `web` or `jwt`. When unset or `web`, the suite SHALL behave exactly as the OAuth-frontdoor-from-CLI-web-login path. The selected mode SHALL affect only how each user's org alias becomes authenticated; the frontdoor exchange and `storageState` persistence SHALL be identical across modes.

#### Scenario: Default mode preserves existing behavior

- **WHEN** the `setup` project runs with `SF_AUTH_MODE` unset or set to `web`
- **THEN** no JWT login occurs, each alias is assumed pre-authed via `sf org login web`, and the suite mints sessions via the frontdoor flow exactly as before

#### Scenario: JWT mode selected

- **WHEN** the `setup` project runs with `SF_AUTH_MODE=jwt`
- **THEN** each user's alias is authenticated non-interactively via `sf org login jwt` before the frontdoor exchange, and the resulting `storageState` files are written to the same `editor.json` / `viewer.json` paths

#### Scenario: Unrecognized mode fails clearly

- **WHEN** `SF_AUTH_MODE` is set to a value other than `web` or `jwt`
- **THEN** the setup fails with a diagnostic naming the invalid value and listing the accepted values

### Requirement: JWT-bearer non-interactive login via committed External Client App

When `SF_AUTH_MODE=jwt`, the suite SHALL authenticate each test user's org alias using the JWT-bearer flow of an External Client App (ECA) whose definition is committed as project metadata. The flow SHALL require no interactive login and no per-run MFA prompt, and SHALL succeed on a machine with no prior CLI session (cold start). The ECA's private key SHALL NOT be committed to the repository or embedded in metadata.

#### Scenario: Cold-start authentication with no prior CLI session

- **WHEN** `SF_AUTH_MODE=jwt` and the machine has no stored CLI session for the user's alias
- **THEN** the suite runs `sf org login jwt` with the user's username, the private key at `SF_JWT_KEY_FILE`, the ECA's `SF_JWT_CLIENT_ID`, and `SF_JWT_INSTANCE_URL`, obtains a session with no human interaction, and proceeds to the frontdoor exchange

#### Scenario: External Client App deploys as project metadata

- **WHEN** the project metadata is deployed to an org
- **THEN** the JWT-bearer External Client App is created with its OAuth configuration and public X.509 certificate, and the repository contains no private key

#### Scenario: JWT-mode failure names the JWT cause

- **WHEN** `SF_AUTH_MODE=jwt` and login fails (missing `SF_JWT_*` variable, unreadable key file, user not pre-authorized on the External Client App, or wrong instance-url audience)
- **THEN** the setup fails with a diagnostic identifying the specific missing input or JWT-side cause, and never emits the `sf org login web` remediation

## MODIFIED Requirements

### Requirement: One-time interactive OAuth login prerequisite

In `web` mode, each test user's org SHALL be authenticated once, interactively, via `sf org login web`, satisfying MFA at that time. Subsequent suite runs SHALL reuse the CLI's stored refresh token and require no interactive login or MFA prompt. This requirement SHALL apply only when `SF_AUTH_MODE` is unset or `web`; in `jwt` mode no interactive login is required at any point.

#### Scenario: Cold start with unauthenticated alias fails clearly

- **WHEN** the suite runs in `web` mode and the org alias for a user has no valid CLI session (never logged in, or refresh token expired/revoked)
- **THEN** the auth setup fails with a diagnostic naming the alias and the `sf org login web -a <alias>` command needed to restore it, rather than silently producing an unauthenticated `storageState`

#### Scenario: Warm run needs no interaction

- **WHEN** the suite runs in `web` mode and the org alias has a valid stored CLI session
- **THEN** the auth setup completes with no browser login form, no MFA prompt, and no human interaction

#### Scenario: JWT mode requires no interactive login prerequisite

- **WHEN** the suite runs in `jwt` mode
- **THEN** no prior `sf org login web` is required, and authentication proceeds non-interactively from the committed External Client App and private key
