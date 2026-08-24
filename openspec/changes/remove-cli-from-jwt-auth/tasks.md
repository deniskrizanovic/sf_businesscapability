## 1. In-process JWT-bearer helper

- [ ] 1.1 Add `buildJwtAssertion({clientId, username, audience, keyPem})` in `auth.setup.ts` (or a small local helper) — base64url header `{alg:'RS256',typ:'JWT'}` + claims `{iss,sub,aud,exp:now+180}`, sign `header.claims` with `crypto.createSign('RSA-SHA256')`, append base64url signature
- [ ] 1.2 Add `jwtBearerAccessToken()` — POST `<SF_JWT_INSTANCE_URL>/services/oauth2/token` via `fetch` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`; return `{ access_token, instance_url }`
- [ ] 1.3 Add `jwtBearerFrontdoorUrl(username)` — read key file, build assertion, exchange, return `<instance_url>/secur/frontdoor.jsp?sid=<access_token>&retURL=/lightning` using the response `instance_url` (NOT the audience host)

## 2. Rework the auth seam

- [ ] 2.1 Refactor `openViaFrontdoor` to accept a pre-built `frontdoorUrl` (mode-agnostic): `page.goto` → `waitForURL(/\/lightning\//)` → caller `storageState()`
- [ ] 2.2 web branch: produce frontdoor URL via `sf org open --url-only` (unchanged behavior)
- [ ] 2.3 jwt branch: produce frontdoor URL via `jwtBearerFrontdoorUrl(username)`; remove the `sf org login jwt` call and the alias argument from the jwt path
- [ ] 2.4 Update `setup('authenticate as editor'/'viewer')` bodies to the new seam (pass username in jwt; alias only for web)

## 3. Diagnostics & secret discipline

- [ ] 3.1 Keep pre-flight fail-fast: missing `SF_JWT_*` var, unreadable/invalid PEM key — distinct messages, never emit `sf org login web`
- [ ] 3.2 Map token-endpoint `{error, error_description}` to failure classes (not pre-authorized / wrong audience / bad key or client id); surface cause, never the assertion/token/URL
- [ ] 3.3 Confirm no logging of the JWT assertion, access token, or frontdoor URL

## 4. Env & docs

- [ ] 4.1 `.env.example` — mark `SF_EDITOR_ALIAS`/`SF_VIEWER_ALIAS` as web-only; note jwt needs no alias
- [ ] 4.2 `docs/design/09-e2e-test-architecture.md` §3 — jwt mode is in-process, no CLI; frontdoor built from token response `instance_url`
- [ ] 4.3 `docs/adr/0007-e2e-jwt-external-client-app-auth.md` — follow-up note: jwt path no longer uses the `sf` CLI
- [ ] 4.4 `docs/runbooks/jwt-eca-setup-and-run.md` §7 — cold-start proof simplifies (no `sf org logout` dance); §8 diagnosis reflects OAuth-error mapping

## 5. Verify (live sandbox)

- [ ] 5.1 Cold-start `SF_AUTH_MODE=jwt` with no `sf` CLI session — both editor + viewer reach `/lightning/`, `storageState` written
- [ ] 5.2 Confirm the `Web`-scope assumption holds for the self-built frontdoor URL; if a `singleaccess` hop is required, add it in task 1.3 and re-verify
- [ ] 5.3 Regression: `SF_AUTH_MODE=web` (and unset) still mint sessions via `sf org open` unchanged
- [ ] 5.4 Log-scan the run output — no `BEGIN * PRIVATE KEY`, no `frontdoor.jsp`, no `sid=`
