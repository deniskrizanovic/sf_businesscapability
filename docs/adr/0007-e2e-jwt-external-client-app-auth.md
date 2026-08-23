# ADR 0007: JWT-bearer External Client App for non-interactive e2e authentication

See also: [E2E Test Architecture §3](../design/09-e2e-test-architecture.md) — the mechanics of the selectable auth strategy; [ADR 0006](0006-e2e-oauth-frontdoor-auth.md) — the OAuth frontdoor flow this builds on.

The e2e suite gains a **selectable auth strategy** chosen via `SF_AUTH_MODE` (`web` | `jwt`, default `web`). In `jwt` mode each test user's org alias is authenticated non-interactively via the JWT-bearer flow of a committed **External Client App** (ECA), "BCM E2E JWT", before the unchanged frontdoor → `storageState` flow. The frontdoor mechanics and the two-user isolation model are unchanged; the switch acts only at a new `ensureAuthed` seam.

## Context

ADR 0006 chose the OAuth frontdoor via CLI-authed per-user aliases and **deferred JWT bearer "until CI is introduced."** That path has one structural limit: it cannot cold-start. A fresh machine or CI worker has no CLI refresh token, so a human `sf org login web` is mandatory before the first run and recurs whenever the refresh token lapses under the org's enforced-MFA policy.

Making the suite CI-_capable_ requires a fully non-interactive, cold-start login. That is the prerequisite ADR 0006 named and deferred — this ADR reverses that non-goal. The motivation is CI capability, not retiring the interactive path: `web` remains the default so no current developer workflow changes.

## Considered Options

**JWT-bearer via a committed External Client App (chosen).** `sf org login jwt` re-asserts each alias from a private key every run — no refresh token, no human, no MFA, cold-start capable. The app is committed as project metadata so it deploys with the repo. `sf org login jwt` is app-type-agnostic (consumer key + private key + username + instance-url), so it consumes an ECA identically to a Connected App, and the resulting authed alias flows into the unchanged frontdoor code.

**JWT-bearer via a new Connected App.** The historically usual vehicle for JWT bearer. **Rejected — not viable:** Salesforce blocks creation of _new_ Connected Apps after **2026-02-21** (already passed), and its own docs direct all new JWT-bearer server-to-server apps to External Client Apps. A Connected App is therefore not a forward path for a new app; the ECA is.

**Stay on the frontdoor `web` path only.** Rejected as the _sole_ strategy — it cannot cold-start, blocking CI. Retained as the **default** mode, so this is an addition, not a replacement.

**Per-user auth mode (editor web / viewer jwt).** Rejected: no real use case and it doubles the diagnostic matrix. A single global `SF_AUTH_MODE` selects the strategy for both users.

## Decision detail

- **ECA over Connected App** for the reason above (2026-02-21 creation cutoff). The ECA is expressed across `ExternalClientApplication`, `ExtlClntAppGlobalOauthSettings`, and `ExtlClntAppOauthSettings`, authored via the `integration-connectivity-connected-app-configure` skill's templates — no hand-authored XSD-ordered XML.
- **Scopes** are `Api, Web, RefreshToken`. `Api` + `RefreshToken` alone let JWT bearer mint a valid API token (the org shows `Connected`), but the e2e flow immediately calls `sf org open` to build a **frontdoor browser session**, which requires the `Web` scope — without it the frontdoor returns `ERROR_HTTP_403 Invalid_Scope` even though login succeeded. `Web` was added during apply once the cold-start run surfaced this. (Verified live: JWT auth passes but frontdoor 403s until `Web` is present.)
- **Consumer key is read post-deploy**, not pre-set — Salesforce generates it on ECA create. Apply order: generate cert → deploy ECA → read key → fill `SF_JWT_CLIENT_ID`.
- **Pre-authorization** uses the "Admin approved users are pre-authorized" policy; both e2e users are authorized by assigning their shared **profile** `AutomatedTester - Minimum Access Clone` to the ECA (not the `bcm_ApiEnabled` permission set). Both users already carry that profile, so one profile assignment authorizes editor and viewer together.

## Consequences

- **The `web` path is unchanged and default.** Setting `SF_AUTH_MODE=jwt` is opt-in; unset/`web` reproduces today's behavior exactly. Rollback is leaving `SF_AUTH_MODE=web` — the JWT path is then inert.
- **The private key is a real secret.** It lives locally under `secrets/` (gitignored: `secrets/`, `*.key`, `*.pem`) and, when CI arrives, in a CI secret store. It never enters metadata or git; only the public cert is uploaded to the ECA.
- **Diagnostics are mode-branched.** `web` keeps the `sf org login web` remediation; `jwt` names the missing `SF_JWT_*` var / unreadable key / ECA pre-authorization / wrong instance-url audience and never emits the web remediation. An unrecognized `SF_AUTH_MODE` fails fast.
- **Sandbox audience trap:** `--instance-url` must be `https://test.salesforce.com` for a sandbox, not the my-domain host. Documented in `.env.example` and the jwt-mode diagnostic.
- **Metadata-API gate:** deploying ECA OAuth settings needs the org permission "Allow Access to OAuth Consumer Secrets via Metadata API" and the user permission "View External Client Apps Consumer Secrets in Metadata".
- **Resolved at apply time:** (a) the JWT-bearer signing cert is a **one-time manual Setup upload** — it does not round-trip as metadata (no cert element in any retrieved ECA type), so it must be re-uploaded on org rebuild; (b) ECA pre-authorization is a **Setup-side profile assignment** (External Client App Manager → Policies → Manage Profiles → add `AutomatedTester - Minimum Access Clone`, the profile both e2e users share), not a metadata edit — the ECA does not surface in the `ConnectedApplication` object, so there is no CLI `SetupEntityAccess` path. Profile assignment (rather than the `bcm_ApiEnabled` permission set) was chosen because both users share that one profile, so a single assignment covers both.
- **Metadata-API gate resolved:** the consumer-secret org/user perms in the note above proved **not required** — cert-based JWT bearer has no consumer secret, so all ECA types deployed without them.
- **This ADR supersedes ADR 0006's JWT deferral.** ADR 0006 remains accurate for the `web` path it describes; the "CI and JWT-bearer auth are deferred" consequence there is now resolved by this ADR.
- **Scope:** this makes the suite CI-_capable_, not CI-_integrated_. Wiring an actual CI pipeline is out of scope.
