# e2e-authentication Specification

## Purpose

Define how the Playwright e2e suite establishes authenticated Salesforce browser sessions for its test users. Sessions are minted from OAuth-authenticated `sf` CLI orgs via a frontdoor URL exchange — never by filling the Salesforce username/password login form — so runs are not blocked by live MFA or identity-verification interstitials.

## Requirements

### Requirement: Browser session established via OAuth frontdoor

The e2e suite SHALL establish an authenticated Lightning browser session for each test user without filling the Salesforce username/password login form. The session SHALL be derived from an OAuth-authenticated `sf` CLI org, using a frontdoor URL to exchange the CLI's access token for browser session cookies.

#### Scenario: Editor session minted from CLI-authed org

- **WHEN** the `setup` project runs and the org aliased by `SF_EDITOR_ALIAS` has a valid CLI OAuth session
- **THEN** the suite obtains a frontdoor URL for that org, navigates the browser to it, waits for the Lightning shell to load, and writes the resulting `storageState` to `tests/e2e/.auth/editor.json`

#### Scenario: Viewer session minted from CLI-authed org

- **WHEN** the `setup` project runs and the org aliased by `SF_VIEWER_ALIAS` has a valid CLI OAuth session
- **THEN** the suite writes the resulting authenticated `storageState` to `tests/e2e/.auth/viewer.json`

#### Scenario: No username/password form login occurs

- **WHEN** any test user authenticates for the suite
- **THEN** no navigation to the `test.salesforce.com` / `login.salesforce.com` login form and no password field fill occurs, so no live MFA or identity-verification interstitial can block the run

### Requirement: Two isolated user sessions preserved

The suite SHALL produce two independent browser sessions — one per test user — so the `editor` and `viewer` Playwright projects each load a distinct `storageState`. The Salesforce permission model under test SHALL be exercised by two genuinely different authenticated users, not one shared session.

#### Scenario: Editor and viewer resolve to different users

- **WHEN** both auth setups have run
- **THEN** `editor.json` and `viewer.json` hold sessions for different Salesforce users, and the `editor`/`viewer` projects consume their respective files as configured in `playwright.config.ts`

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

### Requirement: Test users have API access

Each test user SHALL have the API Enabled permission required for the CLI OAuth connected app to mint and refresh access tokens. Where the base profile does not grant it, it SHALL be granted via a permission set rather than by editing profile metadata.

#### Scenario: User lacking API access is remediated by permission set

- **WHEN** a test user's profile does not grant API Enabled
- **THEN** API Enabled is granted to that user through a permission set assignment, and the frontdoor auth flow succeeds
