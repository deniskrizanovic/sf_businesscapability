## 1. Verify prerequisites (live org)

- [x] 1.1 Confirm whether the editor/viewer users have API Enabled (base license vs. profile). Query the live org. — **Finding:** neither user has API Enabled; profile `AutomatedTester - Minimum Access Clone` = false, no assigned permission set grants it. Permission set required (1.2).
- [x] 1.2 If API Enabled is missing, create a permission set granting it via the `generating-permission-set` skill and assign it to both users (extend `create-e2e-users` assignment block). — Created `bcm_ApiEnabled` (skill `platform-permission-set-generate`), deployed, extended apex assignment block, assigned to both users.
- [x] 1.3 Confirm the org's enforced-MFA policy permits a persisted OAuth refresh token (informs how often the one-time login recurs). Record finding in design Open Questions. — **Finding:** org permits persisted refresh tokens (admin alias stays Connected across runs); re-auth only on token revoke/expiry, not per run. Recorded in design.

## 2. One-time OAuth login + env contract

- [x] 2.1 Authenticate each test user once: `sf org login web -a <editor-alias>` and `sf org login web -a <viewer-alias>`. — Done by developer; aliases `bcm-editor-e2e` / `bcm-viewer-e2e` set (login registered full username as alias; `sf alias set` mapped the intended names). Both Connected. (Correct flag is `-a`, not `-o`.)
- [x] 2.2 Add `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS` to `.env` and `.env.example`; remove browser passwords from the login path. — aliases `bcm-editor-e2e` / `bcm-viewer-e2e`; passwords retained for `create-e2e-users` but no longer read by `auth.setup.ts`.
- [x] 2.3 Verify `sf org open -o <alias> --url-only --path /lightning` emits a frontdoor URL for each alias. — Both aliases emit a `secur/frontdoor.jsp?...` URL (token not printed).

## 3. Rewrite browser auth

- [x] 3.1 Replace `loginAs(username, password, ...)` in `auth.setup.ts` with `openViaFrontdoor(alias)`: run `sf org open -o <alias> --url-only --path /lightning`, capture the URL in-process (never log it).
- [x] 3.2 `page.goto(frontdoorUrl)`, wait for `/lightning/`, and assert no redirect back to a login form.
- [x] 3.3 On failure (unauthed alias / redirect to login), throw a diagnostic naming the alias and the `sf org login web -o <alias>` remediation command.
- [x] 3.4 Persist `storageState` to `editor.json` / `viewer.json` for each user (unchanged output paths).

## 4. Validate

- [x] 4.1 Delete `tests/e2e/.auth/*.json` and run the `setup` project; confirm both sessions mint with no MFA prompt and no interactive login. — Both setup tests passed (17.5s / 14.7s), `editor.json` + `viewer.json` written, no interactive login. (Fixed: `sf --json` emits ANSI color under Playwright's `FORCE_COLOR`; execFile now sets `FORCE_COLOR=0`.)
- [x] 4.2 Run `editor` and `viewer` projects; confirm the two sessions resolve to different users and permission-model specs still pass. — 102 passed, 0 failed, 2 flaky (passed on retry; normal sandbox jitter, not auth). Viewer permission specs (no New/Edit/drag handles) + editor write specs both pass → distinct users confirmed.
- [x] 4.3 Confirm cold-start failure path: run with an unauthed alias and verify the actionable diagnostic fires. — Ran setup with `SF_EDITOR_ALIAS=bcm-nonexistent-alias`; threw diagnostic naming the alias + `sf org login web -a bcm-nonexistent-alias`, no unauthenticated storageState written.

## 5. Documentation

- [x] 5.1 Rewrite §3 (Authentication) of `docs/design/09-e2e-test-architecture.md` for the OAuth frontdoor flow and one-time login prerequisite. — Also updated §11 pre-flight.
- [x] 5.2 Add an ADR under `docs/adr/` recording the OAuth-frontdoor decision, the retirement of password login, and why JWT/CI is deferred. — `docs/adr/0006-e2e-oauth-frontdoor-auth.md`.
- [x] 5.3 Update any spec `> Tested by:` markers affected by the auth change (per project spec-file rules). — No change needed: no spec marker references the auth mechanism / setup project; e2e markers name behavioral tests whose names are unchanged by the migration.
