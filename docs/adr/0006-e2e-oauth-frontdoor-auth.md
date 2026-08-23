# ADR 0006: OAuth frontdoor for e2e browser authentication

See also: [E2E Test Architecture §3](../design/09-e2e-test-architecture.md) — the mechanics of the frontdoor flow; [ADR 0003](0003-playwright-e2e-testing.md) — why Playwright.

The Playwright e2e suite authenticates its two test users (editor, viewer) by deriving a browser session from an OAuth-authenticated `sf` CLI org. For each user it obtains a frontdoor URL (`sf org open -o <alias> --url-only --path /lightning`), navigates the browser to it to set Lightning session cookies, and persists the `storageState`. No username/password login form is filled.

## Context

The suite previously form-filled username/password at `test.salesforce.com` in `auth.setup.ts`. Salesforce now enforces MFA at the org/identity layer — above what the `BypassMFAForUiLogins` / `SkipIdentityConfirmation` profile permissions can disable. Headless form login therefore stalled on an MFA / identity-verification interstitial and the whole suite failed at the `setup` project before any spec ran.

The seeding path already authenticated via the OAuth-backed `sf` CLI session; only browser auth was still on passwords. Migrating browser auth to the CLI's OAuth token removes the last password login and unblocks the suite.

## Considered Options

**OAuth frontdoor via CLI-authed per-user aliases (chosen).** Authenticate each user's org alias once with `sf org login web` (a human satisfies MFA at that moment); every subsequent run mints a browser session from the CLI's stored refresh token with no interactive login or MFA prompt. Preferred over hand-building `frontdoor.jsp?sid=<token>` because the CLI assembles the correct instance URL, token, and retURL, and refreshes the token transparently.

**JWT bearer per user.** Fully non-interactive from cold and CI-ideal. Rejected for now: requires a connected app + self-signed cert + per-user pre-authorization that the repo does not have and that only pays off under CI (which does not yet exist).

**OAuth username-password / ROPC (`grant_type=password`).** Keeps passwords, mints a token directly. Rejected: Salesforce is deprecating this flow — the same trajectory that broke the current password login.

## Consequences

- Password browser login is **retired**. The e2e user passwords set by `create-e2e-users.sh` remain (they provision the user records) but no longer gate browser login. `.env` swaps `SF_EDITOR_PASSWORD` / `SF_VIEWER_PASSWORD` on the login path for `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS`.
- A **one-time interactive login per user** is now a developer prerequisite: `sf org login web -a <alias>`. It recurs only when the refresh token is revoked or expires per the connected app's timeout policy, not per run.
- Each test user needs **API Enabled** for the CLI connected app to mint/refresh tokens. The base profile lacks it, so it is granted via the `bcm_ApiEnabled` permission set (never by hand-editing profile XML).
- `auth.setup.ts` **fails fast** with an actionable `sf org login web -a <alias>` diagnostic when an alias is unauthenticated or its session is stale, rather than writing an unauthenticated `storageState`.
- **CI and JWT-bearer auth are deferred** until CI is introduced. This ADR should be revisited then — JWT bearer becomes the natural choice for a non-interactive CI runner.
