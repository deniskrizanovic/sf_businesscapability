## 1. Certificate & secrets

- [x] 1.1 Generate a self-signed X.509 keypair with `openssl` for the JWT External Client App
- [x] 1.2 Add the private-key path (e.g. `secrets/*.key`, `*.pem`) to `.gitignore`; confirm no key is tracked
- [x] 1.3 Document where the private key lives locally and note it must become a CI secret when CI is introduced

## 2. External Client App metadata

- [x] 2.1 Confirm/enable org perm "Allow Access to OAuth Consumer Secrets via Metadata API" + user perm "View External Client Apps Consumer Secrets in Metadata" — VERIFIED NOT REQUIRED: all ECA types (base + global-oauth + oauth-settings + policy + security) deployed cleanly without the consumer-secret metadata perms. JWT bearer is cert-based, has no consumer secret, so the metadata-secret gate never engages.
- [x] 2.2 Invoke the `integration-connectivity-connected-app-configure` skill to author the ECA from its templates (`external-client-app.xml`, `eca-global-oauth.xml`, `eca-oauth-settings.xml`, `eca-policies.xml`): JWT Bearer Flow enabled, scopes (a standard scope such as `api` plus `refresh_token`/`offline_access`), admin-approved pre-authorization, callback URL
- [x] 2.3 Per skill guidance, retrieve OAuth security settings as source of truth: `sf project retrieve start --metadata ExtlClntAppOauthSecuritySettings:<AppName>` — retrieved as `Bcm_E2e_Jwt_oauthSecurity` (real metadata name carries a suffix, not the bare app name)
- [x] 2.4 Deploy the ECA (all types as one unit) via `sf project deploy start --source-dir <path>`
- [x] 2.5 Upload the public X.509 cert to the ECA; verify whether it round-trips as metadata or is a one-time manual upload, and document the answer — DONE via Setup UI (cert `C=AU, O=BusinessCapabilityMap, CN=BCM E2E JWT`, exp 2036). ANSWER: one-time manual Setup upload, does NOT round-trip as metadata (no cert element in any retrieved ECA type). Re-upload required on org rebuild.
- [x] 2.6 Read the org-generated consumer key from the deployed ECA — copied from Setup (External Client App Manager) into `.env` `SF_JWT_CLIENT_ID`

## 3. Per-user pre-authorization

- [x] 3.1 Verify (live org) whether ECA pre-authorization can extend the `bcm_ApiEnabled` permission set or is a separate Setup-side profile/permission-set assignment — VERIFIED: pre-auth is a Setup-side profile/permission-set assignment on the ECA, NOT a metadata edit. ECA does not surface in the `ConnectedApplication` object (42 rows, none match `Bcm_E2e_Jwt`), so the CLI `SetupEntityAccess` insert path is not available. Mechanism: External Client App Manager → app → Policies → Manage Profiles (or Permission Sets). Both e2e users share profile `AutomatedTester - Minimum Access Clone`, so profile assignment covers both in one step.
- [x] 3.2 Pre-authorize the editor and viewer users on the ECA by the verified method — DONE via Setup UI: External Client App Manager → Bcm_E2e_Jwt → Policies → Manage Profiles → added `AutomatedTester - Minimum Access Clone` (the shared profile of both editor + viewer). One profile assignment authorizes both users.

## 4. Env contract

- [x] 4.1 Add `SF_AUTH_MODE` (`web` | `jwt`, default `web`) handling to the suite config
- [x] 4.2 Add jwt-only vars to `.env` and `.env.example`: `SF_JWT_CLIENT_ID` (from 2.4), `SF_JWT_KEY_FILE`, `SF_JWT_INSTANCE_URL`, `SF_EDITOR_USERNAME`, `SF_VIEWER_USERNAME`
- [x] 4.3 Document the sandbox JWT audience trap (`--instance-url https://test.salesforce.com`) in `.env.example`

## 5. Auth setup code

- [x] 5.1 Add `ensureAuthed(alias, username)`: no-op in `web` mode; run `sf org login jwt ...` in `jwt` mode (idempotent)
- [x] 5.2 Call `ensureAuthed` before the unchanged `openViaFrontdoor` for both editor and viewer setups
- [x] 5.3 Branch fail-fast diagnostics on mode: `web` keeps `sf org login web` remediation; `jwt` names the missing env / unreadable key / pre-auth / audience cause and never emits the web remediation
- [x] 5.4 Reject an unrecognized `SF_AUTH_MODE` value with a diagnostic listing accepted values

## 6. Verification

- [x] 6.1 Run the suite in `SF_AUTH_MODE=web` (regression): behavior unchanged, both projects authenticate — PASS: 103 passed, rc=0 (8.0m)
- [x] 6.2 Run the suite in `SF_AUTH_MODE=jwt` after clearing any CLI session for the aliases: both users authenticate with no interaction (proves cold start) — PASS: after `sf org logout` of both aliases, jwt re-auth + frontdoor succeeded from zero session; 104 passed / 8 skipped, rc=0 (8.0m). Required adding the `Web` OAuth scope to the ECA (frontdoor `sf org open` needs a browser-session scope; `Api, RefreshToken` alone returned `ERROR_HTTP_403 Invalid_Scope`). Scope now `Api, Web, RefreshToken`.
- [x] 6.3 Confirm no private key or frontdoor token is written to disk or logged — PASS: log scan for `BEGIN * PRIVATE KEY` / `frontdoor.jsp` / `sid=` clean; `ensureAuthed` never logs stdout of `sf org login jwt`.

## 7. Docs

- [x] 7.1 Rewrite `docs/design/09-e2e-test-architecture.md` §3 to cover the selectable strategy and jwt path
- [x] 7.2 Add an ADR under `docs/adr/` recording the reversal of the earlier JWT non-goal, the CI-capability motivation, and the ECA-over-Connected-App choice (2026-02-21 Connected App creation cutoff)
