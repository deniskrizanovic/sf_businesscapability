# e2e-authentication Specification

## Purpose

Define how the Playwright e2e suite establishes authenticated Salesforce browser sessions for its test users. Sessions are minted from OAuth-authenticated `sf` CLI orgs via a frontdoor URL exchange — never by filling the Salesforce username/password login form — so runs are not blocked by live MFA or identity-verification interstitials.

## Requirements

### Requirement: Browser session established via OAuth frontdoor

The e2e suite SHALL establish an authenticated Lightning browser session for each test user without filling the Salesforce username/password login form. The session SHALL be derived from an OAuth access token — in `web` mode from the `sf` CLI org's stored session, in `jwt` mode from the in-process JWT-bearer token exchange — using a frontdoor URL to exchange that access token for browser session cookies.

#### Scenario: Editor session minted from available access token

- **WHEN** the `setup` project runs and a valid OAuth access token for the editor user is available (per `SF_AUTH_MODE`)
- **THEN** the suite obtains a frontdoor URL for that token, navigates the browser to it, waits for the Lightning shell to load, and writes the resulting `storageState` to `tests/e2e/.auth/editor.json`

#### Scenario: Viewer session minted from available access token

- **WHEN** the `setup` project runs and a valid OAuth access token for the viewer user is available (per `SF_AUTH_MODE`)
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

The e2e suite SHALL choose its browser-auth token source from an `SF_AUTH_MODE` environment variable with values `web` or `jwt`. When unset or `web`, the suite SHALL behave exactly as the OAuth-frontdoor-from-CLI-web-login path. The selected mode SHALL affect only how each user's browser-auth access token is obtained; the frontdoor exchange and `storageState` persistence SHALL be identical across modes.

#### Scenario: Default mode preserves existing behavior

- **WHEN** the `setup` project runs with `SF_AUTH_MODE` unset or set to `web`
- **THEN** no JWT exchange occurs, each alias is assumed pre-authed via `sf org login web`, and the suite mints sessions via the `sf org open` frontdoor flow exactly as before

#### Scenario: JWT mode selected

- **WHEN** the `setup` project runs with `SF_AUTH_MODE=jwt`
- **THEN** each user's access token is obtained by an in-process JWT-bearer exchange (no `sf` CLI invocation), and the resulting `storageState` files are written to the same `editor.json` / `viewer.json` paths

#### Scenario: Unrecognized mode fails clearly

- **WHEN** `SF_AUTH_MODE` is set to a value other than `web` or `jwt`
- **THEN** the setup fails with a diagnostic naming the invalid value and listing the accepted values

### Requirement: JWT-bearer non-interactive login via committed External Client App

When `SF_AUTH_MODE=jwt`, the suite SHALL authenticate each test user using the JWT-bearer flow of an External Client App (ECA) whose definition is committed as project metadata, performed **in-process without invoking the `sf` CLI**. The suite SHALL build and RS256-sign the JWT assertion locally, exchange it for an access token over HTTPS, and build the frontdoor URL from the token response. The flow SHALL require no interactive login and no per-run MFA prompt, SHALL succeed on a machine with no prior CLI session (cold start), and SHALL require no `sf` CLI installation. The ECA's private key SHALL NOT be committed to the repository or embedded in metadata, and the minted access token SHALL NOT be persisted to disk.

#### Scenario: Cold-start in-process authentication with no CLI

- **WHEN** `SF_AUTH_MODE=jwt` and the machine has no `sf` CLI session (or no `sf` CLI at all)
- **THEN** the suite builds a JWT assertion (`iss=SF_JWT_CLIENT_ID`, `sub=SF_*_USERNAME`, `aud=SF_JWT_INSTANCE_URL`, short expiry) signed RS256 with the key at `SF_JWT_KEY_FILE`, POSTs it to `<SF_JWT_INSTANCE_URL>/services/oauth2/token` as a JWT-bearer grant, receives `{ access_token, instance_url }`, and proceeds to the frontdoor exchange — with no human interaction and no `sf` invocation

#### Scenario: Frontdoor URL built from the token response instance_url

- **WHEN** the JWT-bearer exchange returns `access_token` and `instance_url`
- **THEN** the frontdoor URL is `<instance_url>/secur/frontdoor.jsp?sid=<access_token>&retURL=/lightning`, using the `instance_url` from the token response (the org my-domain host), not the `SF_JWT_INSTANCE_URL` audience host

#### Scenario: Alias variables not required in jwt mode

- **WHEN** `SF_AUTH_MODE=jwt` and `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS` are unset
- **THEN** authentication still succeeds, because the in-process flow keys off username + key + client id + instance-url and never uses a CLI alias

#### Scenario: Access token never persisted to disk

- **WHEN** the JWT-bearer exchange succeeds
- **THEN** the access token is held only in-process and used to build the frontdoor URL, is never written to an `sf` CLI auth store or any file, and is never logged

#### Scenario: External Client App deploys as project metadata

- **WHEN** the project metadata is deployed to an org
- **THEN** the JWT-bearer External Client App is created with its OAuth configuration and public X.509 certificate, and the repository contains no private key

#### Scenario: JWT-mode failure names the JWT cause

- **WHEN** `SF_AUTH_MODE=jwt` and authentication fails (missing `SF_JWT_*` variable, unreadable key file, or an OAuth error from the token endpoint — `invalid_grant` for a user not pre-authorized on the External Client App, or a wrong instance-url audience)
- **THEN** the setup fails with a diagnostic identifying the specific missing input or the OAuth error cause, and never emits the `sf org login web` remediation

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
