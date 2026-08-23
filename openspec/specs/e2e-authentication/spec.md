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

### Requirement: One-time interactive OAuth login prerequisite

Each test user's org SHALL be authenticated once, interactively, via `sf org login web`, satisfying MFA at that time. Subsequent suite runs SHALL reuse the CLI's stored refresh token and require no interactive login or MFA prompt.

#### Scenario: Cold start with unauthenticated alias fails clearly

- **WHEN** the `setup` project runs and the org alias for a user has no valid CLI session (never logged in, or refresh token expired/revoked)
- **THEN** the auth setup fails with a diagnostic naming the alias and the `sf org login web -o <alias>` command needed to restore it, rather than silently producing an unauthenticated `storageState`

#### Scenario: Warm run needs no interaction

- **WHEN** the org alias has a valid stored CLI session
- **THEN** the auth setup completes with no browser login form, no MFA prompt, and no human interaction

### Requirement: Test users have API access

Each test user SHALL have the API Enabled permission required for the CLI OAuth connected app to mint and refresh access tokens. Where the base profile does not grant it, it SHALL be granted via a permission set rather than by editing profile metadata.

#### Scenario: User lacking API access is remediated by permission set

- **WHEN** a test user's profile does not grant API Enabled
- **THEN** API Enabled is granted to that user through a permission set assignment, and the frontdoor auth flow succeeds
