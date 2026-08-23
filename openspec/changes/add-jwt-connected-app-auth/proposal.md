## Why

The e2e suite's browser auth (OAuth frontdoor via CLI-authed aliases) requires a one-time interactive `sf org login web` per user and re-auth whenever the refresh token lapses per the org's MFA policy. That path cannot cold-start on a fresh machine or in CI without a human. Adding a JWT-bearer strategy backed by a committed app makes non-interactive, cold-start auth possible — the prerequisite the prior change deferred "until CI is introduced" — while keeping the existing interactive path as the default so no current dev workflow breaks.

The app is an **External Client App (ECA)**, not a Connected App: Salesforce blocks creation of new Connected Apps after 2026-02-21 (already passed), and its own docs direct all new JWT-bearer server-to-server apps to ECAs.

## What Changes

- Add a **selectable auth strategy** to the e2e suite, chosen in `.env` via `SF_AUTH_MODE` (`web` | `jwt`), defaulting to `web` (today's behavior — no breaking change).
- Add a **JWT-bearer login path**: when `SF_AUTH_MODE=jwt`, the setup project runs `sf org login jwt` (username + private key + ECA consumer key + instance URL) to authenticate each user's alias non-interactively, then reuses the **unchanged** frontdoor → `storageState` flow. No interactive login, no per-run MFA, cold-start capable.
- Commit an **External Client App** definition as project metadata so the JWT app deploys with the repo. ECA is expressed across the metadata types `ExternalClientApplication`, `ExtlClntAppGlobalOauthSettings`, and `ExtlClntAppOauthSettings` (JWT-bearer enabled, OAuth scopes, admin-approved pre-authorization). The X.509 **public** certificate is uploaded to the ECA; the **private** key is never committed. The metadata is authored via the `integration-connectivity-connected-app-configure` skill (installed from `forcedotcom/sf-skills`, which ships ECA templates) — no hand-authored XML.
- Extend the `.env` contract: add `SF_AUTH_MODE`, and the jwt-only vars `SF_JWT_CLIENT_ID`, `SF_JWT_KEY_FILE`, `SF_JWT_INSTANCE_URL`, `SF_EDITOR_USERNAME`, `SF_VIEWER_USERNAME`. Update `.env.example`. Add the private-key path to `.gitignore`.
- Branch the fail-fast diagnostic on mode: `web` keeps the `sf org login web` remediation; `jwt` surfaces missing env / key file / ECA pre-authorization / wrong audience instead.
- Docs: update `docs/design/09-e2e-test-architecture.md` §3 and add an ADR recording the reversal of the earlier JWT non-goal, the CI motivation, and the ECA-over-Connected-App choice.

## Capabilities

### New Capabilities

<!-- None: behavior extends the existing e2e-authentication capability. -->

### Modified Capabilities

- `e2e-authentication`: adds a selectable auth strategy (`SF_AUTH_MODE`) and a JWT-bearer non-interactive login backed by a committed External Client App; scopes the existing one-time interactive-login requirement to `web` mode.

## Impact

- **Code**: `tests/e2e/fixtures/auth.setup.ts` (add mode-branched `ensureAuthed` step before the unchanged frontdoor call).
- **Config**: `.env`, `.env.example`, `.gitignore`. One-time cert generation; consumer key read from the deployed ECA.
- **Metadata**: new ECA (`ExternalClientApplication` + `ExtlClntAppGlobalOauthSettings` + `ExtlClntAppOauthSettings`; JWT config + uploaded public cert). Per-user pre-authorization mapping the app to editor/viewer users is admin-approved via profile/permission set. May extend the existing `bcm_ApiEnabled` permission set.
- **Org prerequisite**: deploying ECA OAuth settings via Metadata API requires the org permission "Allow Access to OAuth Consumer Secrets via Metadata API" and the user permission "View External Client Apps Consumer Secrets in Metadata".
- **Secrets**: private key stored locally (gitignored) and as a CI secret; frontdoor URL token handling unchanged (in-process, never logged).
- **Docs**: `docs/design/09-e2e-test-architecture.md` §3; new ADR under `docs/adr/`.
- **Ordering constraint**: ECA consumer key is generated on create — deploy app → read generated key → fill `SF_JWT_CLIENT_ID`.
- **Out of scope**: full CI pipeline wiring (this change makes the suite CI-_capable_, not CI-_integrated_); retiring the `web` path; changing seeding/isolation/teardown.
