## MODIFIED Requirements

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
