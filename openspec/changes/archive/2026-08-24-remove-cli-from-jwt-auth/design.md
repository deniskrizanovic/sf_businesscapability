## Context

`tests/e2e/fixtures/auth.setup.ts` mints per-user browser sessions via a two-step seam: `ensureAuthed(alias, username)` then `openViaFrontdoor(page, alias)`. In `jwt` mode both steps shell out to the `sf` CLI:

- `ensureAuthed` → `sf org login jwt` — RFC 7523 JWT-bearer exchange; the CLI signs the assertion, POSTs the token endpoint, and stores `{ access_token, instance_url }` in `~/.sf` keyed by `<alias>`.
- `openViaFrontdoor` → `sf org open --url-only` — the CLI reads the stored token for `<alias>` and assembles a `secur/frontdoor.jsp` URL.

Both are plain HTTPS operations. The CLI adds: a required install on `PATH`, machine-global on-disk token state keyed by an alias, a `FORCE_COLOR=0` + `JSON.parse` dance around `--json`, and coarse error reporting (first line of stderr). Runtime is Node 22 — global `fetch` and `node:crypto` are available with no new dependency. ADR 0007 already established the ECA, scopes, cert upload, and pre-authorization; this change touches only how the token and frontdoor URL are produced in `jwt` mode.

## Goals / Non-Goals

**Goals:**

- Remove the `sf` CLI dependency from the `jwt` auth path entirely (both token mint and frontdoor URL).
- Zero new npm dependencies — `node:crypto` for RS256, global `fetch` for HTTPS.
- Preserve the seam: `page.goto(frontdoorUrl)` + `storageState()` byte-identical to today.
- Keep `web` mode and all diagnostics behavior intact; jwt diagnostics get richer (real OAuth error).
- Improve secret posture: access token never written to an on-disk auth store.

**Non-Goals:**

- Making `web` mode CLI-free (its premise is the CLI's stored refresh token; no in-process equivalent without reimplementing web OAuth).
- Changing the ECA metadata, OAuth scopes, cert upload, or pre-authorization steps.
- Wiring an actual CI pipeline (suite stays CI-_capable_, not CI-_integrated_).

## Decisions

**In-process JWT-bearer with `node:crypto`, not a jwt library.** Building the assertion is ~15 lines: base64url the header `{alg:'RS256',typ:'JWT'}` and claims `{iss:clientId, sub:username, aud:instanceUrl, exp:now+180}`, sign the `header.claims` string with `crypto.createSign('RSA-SHA256')` + the PEM private key, append the base64url signature. No `jsonwebtoken`/`jose` needed. _Alternative — add `jose`:_ rejected; a dependency for one RS256 sign is not worth the supply-chain surface when `node:crypto` is built in.

**`fetch` for the token POST, not Playwright's `request` fixture.** The setup project already has a `page`; `fetch` is global in Node 22 and keeps the token exchange independent of the browser context. Body is `application/x-www-form-urlencoded`: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`.

**Frontdoor URL uses the token response `instance_url`, not the audience host.** The JWT `aud` / `SF_JWT_INSTANCE_URL` is the login host (`https://test.salesforce.com` for sandbox). The token response returns the org's my-domain `instance_url`; the frontdoor must be built on that host or the Lightning cookies won't be set for the org. This is the primary correctness trap. Frontdoor form: `<instance_url>/secur/frontdoor.jsp?sid=<access_token>&retURL=/lightning`.

**Unified `openViaFrontdoor(page, frontdoorUrl)` seam.** Refactor so each mode produces a frontdoor URL its own way and hands it to one navigation+wait+persist function:

```
                 jwt mode                          web mode
  ensureAuthed → jwtBearerFrontdoorUrl(user)     sf org open --url-only
                       │                                  │
                       └──────────► frontdoorUrl ◄────────┘
                                        │
                     openViaFrontdoor(page, frontdoorUrl)   (goto + waitForURL + storageState)
```

_Alternative — branch inside `openViaFrontdoor`:_ rejected; passing the URL in keeps the navigation/persist logic mode-agnostic and the token source cleanly separated.

**Alias becomes web-only.** `SF_EDITOR_ALIAS`/`SF_VIEWER_ALIAS` are the CLI's token-store handle. In jwt the flow keys off username + key + client id + instance-url, so the alias is dropped from that path. `.env.example` documents them as web-only. The `setup(...)` test bodies pass username (already present) instead of alias in jwt.

**Diagnostics map the OAuth error JSON.** The token endpoint returns `{ error, error_description }` on failure — richer than CLI stderr. Map to existing classes: `invalid_grant` + "user hasn't approved" → not pre-authorized; audience/`invalid_grant` on aud → wrong `SF_JWT_INSTANCE_URL`; signature/`invalid_client` → bad key/client id. Preserve the pre-flight checks (missing env, unreadable key) and the "never emit `sf org login web`" rule.

## Risks / Trade-offs

- **`Web` scope assumption may differ from CLI path** → building `frontdoor.jsp?sid=<access_token>` ourselves is expected to still require the ECA `Web` scope (the token is used to establish a UI session). Verify on the first live jwt run; if a `singleaccess` exchange is needed instead of the raw access token, add that one hop. Removing the CLI does NOT relax the scope story.
- **frontdoor host mistake** → using the audience host instead of the response `instance_url` silently redirects to a login form. Mitigation: the "frontdoor URL built from token response instance_url" scenario + a cold-start assertion that `/lightning/` is reached.
- **Token in a JS variable / process env** → same exposure class as the frontdoor URL today. Mitigation: never log the assertion, token, or URL; keep the existing log-scan discipline (`BEGIN * PRIVATE KEY`, `frontdoor.jsp`, `sid=`).
- **PEM key format edge cases** (PKCS#1 vs PKCS#8, passphrase) → `crypto.createSign` accepts PEM directly; the runbook's `openssl … -nodes` produces an unencrypted PKCS#8 key that signs without a passphrase. Mitigation: surface a clear "unreadable/invalid PEM" diagnostic distinct from the OAuth-error path.
- **Clock skew on `exp`** → 180s expiry with `aud` correct is standard; Salesforce tolerates minor skew. No mitigation needed beyond a short, near-future `exp`.

## Migration Plan

1. Add `jwtBearerFrontdoorUrl()` helper + refactor `openViaFrontdoor` to take a pre-built URL; wire the jwt branch to the helper, web branch to `sf org open`.
2. Update `.env.example` to mark alias vars web-only; no jwt var changes.
3. Live-run `SF_AUTH_MODE=jwt` cold-start on the sandbox (no `sf` session) — confirm both users reach `/lightning/`, confirm `Web`-scope assumption.
4. Update docs: design §3, ADR 0007 follow-up note, runbook §7 (cold-start dance drops away).
5. **Rollback:** revert `auth.setup.ts`; the CLI-based jwt path is fully described by ADR 0007 and still deployable. `web` mode is untouched throughout, so the default developer workflow is never at risk.

## Open Questions

- Does the raw `access_token` as `sid` establish the Lightning session, or is a `/services/oauth2/singleaccess` exchange required first? (Resolve on the step-3 live run.)
- Keep `SF_EDITOR_ALIAS`/`SF_VIEWER_ALIAS` as optional diagnostic labels in jwt logs, or drop references entirely? (Lean: keep as optional label only, never load-bearing.)
