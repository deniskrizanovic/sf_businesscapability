## Why

The Playwright e2e suite authenticates its two test users (editor, viewer) by filling the Salesforce username/password login form at `test.salesforce.com`. Salesforce now enforces MFA at a layer the `BypassMFAForUiLogins` profile permission cannot switch off, so headless form-fill login stalls on an MFA / identity-verification interstitial and the entire suite fails at the `setup` project before any spec runs. The seeding path already authenticates via the OAuth-backed `sf` CLI session; only the browser login path is still on passwords. Migrating browser auth to an OAuth frontdoor flow removes the last password-based login and unblocks the suite.

## What Changes

- **BREAKING** (dev workflow): `auth.setup.ts` no longer form-fills username/password. Each test user is authenticated once via `sf org login web` (real OAuth, MFA satisfied once by a human); the setup project mints a browser session per run from the CLI's stored token — no live login, no MFA prompt per run.
- New browser-auth mechanism: for each user, obtain a frontdoor URL from the CLI-authed org (`sf org open -o <alias> --url-only --path /lightning`), navigate the Playwright page to it, wait for the Lightning shell, and persist `storageState` to `editor.json` / `viewer.json` exactly as today.
- `.env` contract changes: remove `SF_EDITOR_PASSWORD` / `SF_VIEWER_PASSWORD` from the browser-login path; add `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS` naming the two CLI-authed orgs. (User-record passwords set by `create-e2e-users` are unaffected — they are simply no longer used for browser login.)
- Ensure the two test users have **API Enabled** (required for the CLI OAuth connected app to mint/refresh tokens). If the `AutomatedTester - Minimum Access Clone` profile lacks it, grant it via a permission set — never hand-edit profile XML.
- Docs: rewrite the authentication section (§3) of `docs/design/09-e2e-test-architecture.md`; add an ADR recording the OAuth-frontdoor decision and why password login was retired.

## Capabilities

### New Capabilities

- `e2e-authentication`: How the Playwright e2e suite establishes an authenticated browser session for each test user without interactive per-run login — the OAuth frontdoor flow, the one-time CLI login prerequisite, the two-user session isolation it must preserve, and its failure/diagnostic behavior.

### Modified Capabilities

<!-- None: no existing specs in openspec/specs/. -->

## Impact

- **Code**: `tests/e2e/fixtures/auth.setup.ts` (login mechanism), `playwright.config.ts` (unchanged structurally — still `setup` + `editor` + `viewer` projects with two storageStates).
- **Config**: `.env`, `.env.example` (drop browser passwords, add aliases). One-time `sf org login web` per user.
- **Metadata**: possibly a permission set granting `ApiEnabled` to the test-user profile (pending live-org check).
- **Docs**: `docs/design/09-e2e-test-architecture.md` §3; new ADR under `docs/adr/`.
- **Out of scope**: CI (none exists yet) and JWT-bearer non-interactive auth — deferred until CI is introduced.
