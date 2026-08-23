## Context

The e2e suite has two auth paths. Seeding runs Apex via `sf apex run --target-org SF_ORG_ALIAS` — an OAuth-backed CLI session (the admin/integration user). Browser auth, in `tests/e2e/fixtures/auth.setup.ts`, form-fills username/password at `test.salesforce.com` for two distinct users (editor, viewer) and saves each session as a Playwright `storageState`.

Salesforce now enforces MFA at the org/identity layer. The `AutomatedTester - Minimum Access Clone` profile grants `BypassMFAForUiLogins` and `SkipIdentityConfirmation`, but those only cover the org's UI-login MFA prompt and (risk-gated) device confirmation — not the enforced-MFA policy layer that the current rollout applies. Result: headless form login stalls on an MFA / identity interstitial and the `setup` project fails before any spec runs.

Constraints:

- Two genuinely different authenticated users are mandatory — the SF permission model is the system under test (`docs/design/09-e2e-test-architecture.md` §1, §7).
- No CI, no connected app, no cert exist in the repo today — local developer runs only.
- Playwright always uses a fresh browser profile, so any interactive login path re-triggers identity verification every run.

## Goals / Non-Goals

**Goals:**

- Remove all username/password browser login from the suite.
- Establish two isolated, authenticated Lightning browser sessions without a per-run MFA prompt.
- Keep the existing `setup` + `editor` + `viewer` project structure and two-`storageState` model unchanged.
- Fail loudly with an actionable message when an alias is not CLI-authed.

**Non-Goals:**

- CI integration (none exists). No GitHub Actions / secret-stored auth URLs in this change.
- JWT-bearer non-interactive auth (connected app + cert). Deferred until CI is introduced.
- Changing seeding, isolation, ordering, or teardown mechanics.
- Retiring the SF user-record passwords set by `create-e2e-users` (kept; simply unused for browser login).

## Decisions

### Decision: OAuth frontdoor via CLI-authed per-user aliases (Option A)

For each user, authenticate an org alias once with `sf org login web -o <alias>`. At suite setup, obtain a frontdoor URL from that alias and navigate the Playwright page to it; Salesforce sets Lightning session cookies, then `storageState()` persists them as today.

Frontdoor URL source: `sf org open -o <alias> --url-only --path /lightning` emits a `secur/frontdoor.jsp?...` URL carrying the CLI's access token. Preferred over hand-building `frontdoor.jsp?sid=<token>` from `sf org display --json` because the CLI already assembles the correct instance URL, token, and retURL, and refreshes the token transparently.

**Alternatives considered:**

- **JWT bearer per user (Option B)** — fully non-interactive from cold, CI-ideal, no passwords. Rejected for now: requires a connected app + self-signed cert + per-user pre-authorization that the repo does not have and that only pays off under CI.
- **OAuth username-password / ROPC (Option C)** — keeps passwords, mints token via `grant_type=password`. Rejected: Salesforce is deprecating this flow — same trajectory that broke the current setup.

### Decision: `.env` swaps passwords for aliases on the browser-login path

Remove `SF_EDITOR_PASSWORD` / `SF_VIEWER_PASSWORD` usage from `auth.setup.ts`; add `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS`. `SF_ORG_ALIAS` (seeding) and `SF_BASE_URL` are untouched. `.env.example` updated to match. Passwords may remain in `.env` for `create-e2e-users` but no longer gate browser login.

### Decision: grant API Enabled via permission set if missing

The CLI OAuth connected app needs the user to have API Enabled to mint/refresh tokens. The profile does not explicitly enable it; the base Salesforce license may grant it implicitly, so verify against the live org first. If missing, grant via a permission set (per project rule: never hand-edit profile/permission-set XML — use the `generating-permission-set` skill).

### Decision: fail-fast auth setup with actionable diagnostic

If `sf org open`/token retrieval fails for an alias (never logged in, refresh token expired/revoked), the setup throws an error naming the alias and the exact `sf org login web -o <alias>` remediation command — never writes an unauthenticated `storageState` that would surface later as confusing spec failures.

## Risks / Trade-offs

- **Enforced-MFA policy forces periodic re-auth** → the "login once" becomes "login every N days". Mitigation: document the one-time login step and the re-auth command; scope is a single interactive command, not a suite change.
- **Refresh-token expiry mid-run / silent stale session** → frontdoor navigates but lands on a login redirect. Mitigation: after `page.goto(frontdoorUrl)`, assert the URL matches `/lightning/` within timeout; on redirect-to-login, throw the fail-fast diagnostic.
- **Base license does not grant API Enabled** → `sf org login web` or token refresh fails. Mitigation: verify live before implementing; permission-set grant ready as fallback.
- **Frontdoor token appears in a URL** → could be logged. Mitigation: `--url-only` output is captured in-process and not written to disk or committed; do not `console.log` the URL.
- **Two aliases add local setup friction** → developers must run two `sf org login web` commands once. Mitigation: document in the e2e arch doc and `.env.example`.

## Migration Plan

1. Verify (live org) whether editor/viewer users have API Enabled; if not, prepare a permission set grant.
2. Authenticate both users once: `sf org login web -o <editor-alias>`, `sf org login web -o <viewer-alias>`.
3. Update `.env` / `.env.example`: drop browser passwords from the login path, add the two aliases.
4. Rewrite `auth.setup.ts` `loginAs` → `openViaFrontdoor(alias)`: run `sf org open -o <alias> --url-only --path /lightning`, `page.goto(url)`, wait for `/lightning/`, save `storageState`.
5. Run the suite; confirm both projects authenticate with no MFA prompt.
6. Update `docs/design/09-e2e-test-architecture.md` §3 and add the ADR.

**Rollback:** revert `auth.setup.ts` and `.env` changes; the password form path is restored (though it remains blocked by SF MFA until the org policy changes).

## Open Questions

- ~~Do the editor/viewer users have API Enabled via base license, or is the permission set required?~~ **Resolved (live org, 2026-08-21):** Neither user had API Enabled — profile `AutomatedTester - Minimum Access Clone` grants it false, and no assigned permission set granted it. The permission set is required. Created `bcm_ApiEnabled` (grants only `ApiEnabled`), deployed, and assigned to both users.
- ~~Does the org's enforced-MFA policy allow the OAuth refresh token to persist across runs?~~ **Resolved (live org, 2026-08-21):** Yes. The admin alias `home-denispoc` (same org) holds a persisted CLI OAuth refresh token that stays `Connected` across sessions, confirming the org permits refresh-token persistence for the `sf` CLI connected app. Re-auth recurs only when the refresh token is revoked or lapses per the connected app's timeout policy — not per run. The one-time `sf org login web` therefore recurs on that interval, not every suite run.
