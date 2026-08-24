## Why

`SF_AUTH_MODE=jwt` was introduced to make the e2e suite cold-start / CI-capable, yet it still depends on the `sf` CLI at two points: `sf org login jwt` mints the token and `sf org open` builds the frontdoor URL. The CLI must be installed and on `PATH`, it stores the minted token as machine-global state under `~/.sf` keyed by an alias, and it forces `FORCE_COLOR`/JSON-parsing workarounds. The JWT-bearer exchange and the frontdoor URL are both plain HTTPS calls; the running Node 22 process (global `fetch` + `node:crypto`) can perform them directly with zero new dependencies, removing the last runtime dependency and hidden global state from the jwt auth path.

## What Changes

- In `jwt` mode, replace `sf org login jwt` with an in-process RFC 7523 JWT-bearer token exchange: build + RS256-sign the assertion with `node:crypto`, POST it to `/services/oauth2/token` with `fetch`, receive `{ access_token, instance_url }`.
- In `jwt` mode, replace `sf org open --url-only` with an in-process frontdoor URL built from the token response: `<instance_url>/secur/frontdoor.jsp?sid=<access_token>&retURL=/lightning`. The `instance_url` MUST come from the token response (my-domain host), not the audience host.
- `page.goto(frontdoorUrl)` + `storageState()` persistence stay identical — the change acts only at the token-source seam.
- **BREAKING (jwt mode only):** `SF_EDITOR_ALIAS` / `SF_VIEWER_ALIAS` are no longer required or consumed in `jwt` mode — the alias existed solely as the CLI's token-store handle. `web` mode still requires them.
- `web` mode is unchanged: it still uses `sf org login web` (prerequisite) and `sf org open` (frontdoor). Only `jwt` mode goes CLI-free.
- jwt-mode diagnostics map the OAuth error response (`invalid_grant`, audience, key/signature errors) to the existing failure classes (missing env, unreadable key, user not pre-authorized, wrong audience) and still never emit the `sf org login web` remediation.
- Token never touches disk (no `~/.sf` auth store write); it lives only in-process and is never logged — same secret discipline as today, applied to the frontdoor URL / access token.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `e2e-authentication`: The JWT-bearer requirement changes from "runs `sf org login jwt` … then the frontdoor exchange" to an in-process JWT-bearer token exchange + in-process frontdoor URL, with no `sf` CLI invocation and no alias in `jwt` mode. The `web`-mode requirements and the two-user-isolation / frontdoor-storageState requirements are unchanged.

## Impact

- **Code:** `tests/e2e/fixtures/auth.setup.ts` — `ensureAuthed` and `openViaFrontdoor` rework for jwt mode; likely a small `jwtBearerFrontdoorUrl()` helper. `web` branch untouched.
- **Config / env:** `.env.example` — note `SF_EDITOR_ALIAS`/`SF_VIEWER_ALIAS` are `web`-only; jwt block otherwise unchanged (`SF_JWT_CLIENT_ID`, `SF_JWT_KEY_FILE`, `SF_JWT_INSTANCE_URL`, `SF_*_USERNAME`).
- **Dependencies:** none added — `node:crypto` + global `fetch` (Node 22, present).
- **Docs:** `docs/design/09-e2e-test-architecture.md` §3, `docs/adr/0007-e2e-jwt-external-client-app-auth.md` (follow-up note), `docs/runbooks/jwt-eca-setup-and-run.md` §7 (cold-start dance simplifies).
- **ECA metadata / Setup steps:** unchanged. `Web` scope, cert upload, pre-authorization all still apply — building the frontdoor URL ourselves does NOT relax the `Web` scope requirement (to verify on a live run).
- **Out of scope:** making `web` mode CLI-free; wiring an actual CI pipeline.
