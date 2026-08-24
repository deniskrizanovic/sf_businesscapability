## Context

The `e2e-authentication` capability today mints browser sessions via an OAuth **frontdoor** exchange: `auth.setup.ts` asks the CLI for a frontdoor URL from a pre-authed org alias (`sf org open -o <alias> --url-only`), navigates to it, and persists `storageState`. The alias is authed once by a human via `sf org login web` (MFA satisfied then), and the CLI's stored refresh token carries subsequent runs.

That path has one structural limit: it cannot cold-start. A fresh machine or CI worker has no CLI refresh token, so the human `sf org login web` is mandatory before the first run, and recurs whenever the refresh token lapses per the org's enforced-MFA policy. The prior change (`migrate-e2e-auth-to-oauth`) named JWT-bearer as Option B and deferred it "until CI is introduced."

This change adds Option B **alongside** Option A, selected in `.env`, defaulting to Option A.

## Goals / Non-Goals

**Goals:**

- Add a `SF_AUTH_MODE` switch (`web` | `jwt`), default `web` — zero change for existing devs.
- Add a fully non-interactive, cold-start-capable JWT-bearer login path.
- Commit the JWT app as project metadata so it deploys with the repo.
- Keep the frontdoor → `storageState` runtime and the two-user isolation model unchanged.
- Branch fail-fast diagnostics on the active mode.

**Non-Goals:**

- Wiring an actual CI pipeline. This makes the suite CI-_capable_, not CI-_integrated_.
- Retiring the `web` path.
- Changing seeding, isolation, ordering, or teardown.

## Decisions

### Decision: single global `SF_AUTH_MODE`, default `web`

One env var selects the strategy for both users. Default `web` preserves today's behavior exactly, so the change is non-breaking. Per-user mixing (editor web / viewer jwt) was considered and rejected — no real use case, and it doubles the diagnostic matrix.

### Decision: the toggle acts only at the `ensureAuthed` seam; frontdoor is unchanged

Both strategies converge on an authed org alias. A new `ensureAuthed(alias, username)` step runs before the existing `openViaFrontdoor(alias)`:

```
ensureAuthed(alias, username):
  if SF_AUTH_MODE == 'jwt':
      sf org login jwt --username <username> --jwt-key-file <SF_JWT_KEY_FILE>
                       --client-id <SF_JWT_CLIENT_ID> --instance-url <SF_JWT_INSTANCE_URL>
                       -a <alias>          # idempotent; re-auths each run → CI cold-start
  # web mode: no-op — alias assumed pre-authed by `sf org login web` (today)
openViaFrontdoor(page, alias)              # UNCHANGED
```

`sf org login jwt` produces a normal authed alias, so the frontdoor code consumes it with no change. There is no refresh token in JWT mode — the CLI re-asserts via the private key when the access token expires, so the refresh-token-expiry class of failure disappears. `sf org login jwt` is app-type-agnostic: it only needs consumer key + private key + username + instance-url, so it works identically against an ECA (confirmed: Data 360 JDBC uses ECA + `clientId`=ECA consumer key + `privateKey`=PEM).

### Decision: use an External Client App, not a Connected App

The committed JWT app is an **External Client App (ECA)**, not a Connected App. Rationale: Salesforce blocks creation of new Connected Apps after **2026-02-21** (already passed) and its official docs direct all new JWT-bearer server-to-server apps to ECAs. A Connected App is therefore not a viable fallback for a _new_ app; ECA is the only forward path. ECA fully supports the JWT-bearer flow with an uploaded X.509 certificate.

ECA is expressed across three metadata types (all Metadata-API deployable, API v59.0+):

- `ExternalClientApplication` — the app shell (name, contact, distribution).
- `ExtlClntAppGlobalOauthSettings` — global OAuth config (callback URL, etc.).
- `ExtlClntAppOauthSettings` — the OAuth plugin config (`.ecaOauth` suffix, `extlClntAppOauthSettings` folder): scopes, policies, JWT-bearer enablement.

The X.509 **public** certificate is uploaded to the ECA (enable OAuth → enable JWT Bearer Flow → upload cert). The **private** key never enters metadata or git.

The ECA metadata is authored via the `integration-connectivity-connected-app-configure` skill (installed from `forcedotcom/sf-skills`), which ships ECA templates (`external-client-app.xml`, `eca-global-oauth.xml`, `eca-oauth-settings.xml`, `eca-policies.xml`, `connected-app-jwt.xml`), a 120-point security checklist, and a testing-validation guide. The skill's own guidance: start from a template, and for OAuth security settings retrieve from the org as the schema source of truth (`sf project retrieve start --metadata ExtlClntAppOauthSecuritySettings:<AppName>`). This supersedes the earlier "no skill exists" concern — no hand-authored XSD-ordered XML is required.

### Decision: consumer key is read post-deploy, not pre-set

Salesforce generates the consumer key when the ECA is created (`oauthLink` = org ID + OAuth consumer id). So `SF_JWT_CLIENT_ID` cannot be known up front. Sequence: generate cert → deploy the ECA → read the generated consumer key from the org → write it into `.env`. Documented as an ordered apply step.

### Decision: per-user pre-authorization is admin-approved via profile/permission set

The ECA uses the "Admin approved users are pre-authorized" OAuth policy; the editor and viewer users are authorized by assigning the ECA to a profile or permission set. This is an explicit task. Verify at apply time whether it can extend the existing `bcm_ApiEnabled` permission set or is a Setup-side assignment. Scopes must include at least one standard scope (e.g. `api`) alongside `refresh_token`/`offline_access` — an admin-pre-authorized app with only `refresh_token` fails to issue tokens.

### Decision: mode-branched fail-fast diagnostics

- `web` mode keeps today's message: name the alias and `sf org login web -a <alias>`.
- `jwt` mode: on failure, check and name what is missing — `SF_JWT_*` env vars, an unreadable `SF_JWT_KEY_FILE`, or a token failure pointing at ECA pre-authorization / instance-url audience. Never emit the `web` remediation in `jwt` mode.

### Decision: sandbox JWT audience

For a sandbox org, the JWT audience / `--instance-url` must be `https://test.salesforce.com`, not the my-domain URL. `.env.example` documents this explicitly (common trap).

## Risks / Trade-offs

- **Private key is a real secret** → local gitignored `.pem`, CI secret store. Never in metadata/git. `.gitignore` updated.
- **ECA metadata is multi-type + gated** → three types must deploy coherently, and deploying OAuth settings via Metadata API requires the org permission "Allow Access to OAuth Consumer Secrets via Metadata API" and the user permission "View External Client Apps Consumer Secrets in Metadata". Mitigation: clear the perm gate first; treat the three types as one deploy unit.
- **JWT-bearer signing cert may not round-trip in metadata** → the ECA OAuth metadata fields found are for asset-token/attestation certs, not clearly the inbound JWT-bearer signing cert. Mitigation: verify at apply whether the JWT cert deploys as metadata; if not, the one-time cert upload becomes a documented manual step (like reading the consumer key).
- **Consumer key generated on create** → not known pre-deploy. Mitigation: ordered apply steps (deploy → read → fill `.env`).
- **Reverses a prior non-goal** → the earlier design deferred JWT. Mitigation: ADR records the reversal, the CI-capability motivation, and the ECA-over-Connected-App choice.
- **Two code paths to keep working** → `web` and `jwt` both exercised. Mitigation: default `web` unchanged; e2e smoke of `jwt` mode documented; diagnostics branched so a misconfig is obvious.
- **Wrong JWT audience on sandbox** → auth fails cryptically. Mitigation: `.env.example` note + jwt-mode diagnostic mentions instance-url/audience.

## Migration Plan

1. Generate a self-signed keypair (`openssl`); keep the private key local + gitignored.
2. Confirm/enable the org + user permissions for deploying ECA OAuth settings via Metadata API.
3. Author the ECA metadata via the `integration-connectivity-connected-app-configure` skill (templates + retrieve-as-source-of-truth): `ExternalClientApplication` + `ExtlClntAppGlobalOauthSettings` + `ExtlClntAppOauthSettings` with JWT-bearer enabled, scopes (incl. a standard scope), admin-approved pre-authorization. Deploy via `sf project deploy start --source-dir <path>`.
4. Upload the public cert to the ECA (verify whether this is metadata or a one-time manual step).
5. Read the generated consumer key from the org; set `SF_JWT_CLIENT_ID` in `.env`.
6. Pre-authorize the editor/viewer users on the ECA (profile or permission-set assignment).
7. Add `SF_AUTH_MODE` + jwt vars to `.env` / `.env.example`; add key path to `.gitignore`.
8. Update `auth.setup.ts`: add mode-branched `ensureAuthed` before the unchanged frontdoor call; branch diagnostics.
9. Run the suite in both modes: `SF_AUTH_MODE=web` (regression) and `SF_AUTH_MODE=jwt` (cold-start, delete CLI auth first to prove non-interactivity).
10. Update `docs/design/09-e2e-test-architecture.md` §3; add the ADR.

**Rollback:** unset/leave `SF_AUTH_MODE=web`; the JWT path is inert and behavior is exactly today's. ECA metadata can remain deployed harmlessly.

## Open Questions

- Does the JWT-bearer signing certificate deploy as ECA metadata, or must it be uploaded once via the UI / Certificate & Key Management? Verify against the target org at apply time.
- Can ECA pre-authorization extend `bcm_ApiEnabled`, or is it a separate Setup-side assignment? Verify against the live org.
- Does `sf org login jwt` for this sandbox need `--instance-url https://test.salesforce.com` (audience) or the my-domain host? Confirm before finalizing `.env.example`.
