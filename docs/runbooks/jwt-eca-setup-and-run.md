# Runbook — JWT External Client App: set up + run automation tests (`SF_AUTH_MODE=jwt`)

Generic, tool-agnostic procedure for **any** automation tool (agent, CI job, shell
script, human) to provision a JWT-bearer External Client App (ECA) that backs
non-interactive automation-test auth, then run a suite against it. The values below
are distilled from a live-org run — treat them as verified defaults, not theory.

> Why ECA not Connected App: Salesforce blocks new Connected App creation after
> 2026-02-21 (passed). ECA is the only forward path for a new JWT-bearer app.

Placeholders used throughout — substitute your own:

- `<ORG_ALIAS>` — an admin-authed CLI alias for deploy/read.
- `<APP>` — the ECA API name (e.g. `My_Jwt_App`).
- `<APP_LABEL>` — the ECA label (e.g. `My JWT App`).
- `<KEY>` / `<CERT>` — local private key / public cert paths.
- `<PROFILE>` — the profile (or permission set) shared by the test users.
- `<EDITOR_USER>` / `<VIEWER_USER>` — the usernames each token authenticates as
  (the JWT `sub`).

---

## 0. Preconditions

- Salesforce CLI (`sf`) installed and on `PATH` — for the **setup** steps only
  (deploy the ECA, read the consumer key). Running the jwt-mode suite needs no
  `sf` CLI: auth is fully in-process (`node:crypto` + `fetch`).
- `openssl` installed.
- Admin access to the target org's Setup (the cert-upload and pre-auth steps are
  Setup-UI-only — see below).
- Know the target org type: **sandbox** → JWT audience `https://test.salesforce.com`;
  **production** → `https://login.salesforce.com`.
- **NOT required (verified):** the org perm "Allow Access to OAuth Consumer Secrets
  via Metadata API" and user perm "View External Client Apps Consumer Secrets in
  Metadata". JWT-bearer is cert-based and has no consumer secret, so that metadata
  gate never engages. Do not waste time enabling it.

---

## 1. Generate the keypair (local, one-time)

Private key stays local + gitignored; only the **public cert** ever leaves the machine.

```sh
mkdir -p secrets
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout <KEY> \
  -out    <CERT> \
  -days   3650 \
  -subj   "/C=<COUNTRY>/O=<ORG>/CN=<COMMON_NAME>"
```

- `<KEY>` = **private** key (PEM). Feeds `SF_JWT_KEY_FILE`. **Never commit.**
- `<CERT>` = **public** X.509 cert. Uploaded to the ECA in step 4.
- Confirm `.gitignore` covers the key location (e.g. `secrets/`, `*.key`, `*.pem`).
  Verify nothing is tracked: `git ls-files | grep -E '\.(key|pem)$|^secrets/'` → must be empty.

---

## 2. Author + deploy the ECA metadata

The ECA is expressed across five metadata types under `force-app/main/default/`.
Deploy them as **one unit**. Author via the
`integration-connectivity-connected-app-configure` skill (ships ECA templates); do
**not** hand-write the XSD-ordered XML.

Verified config:

| Type (folder)                                                            | Key settings                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ExternalClientApplication` (`externalClientApps/`)                      | label `<APP_LABEL>`, `distributionState=Local`, `isProtected=false`                                  |
| `ExtlClntAppGlobalOauthSettings` (`extlClntAppGlobalOauthSets/`)         | `callbackUrl=https://login.salesforce.com/services/oauth2/callback`, `isConsumerSecretOptional=true` |
| `ExtlClntAppOauthSettings` (`extlClntAppOauthSettings/`)                 | **scopes = `Api, Web, RefreshToken`**                                                                |
| `ExtlClntAppOauthConfigurablePolicies` (`extlClntAppOauthPolicies/`)     | `permittedUsersPolicyType=AdminApprovedPreAuthorized`, `ipRelaxationPolicyType=Enforce`              |
| `ExtlClntAppOauthSecuritySettings` (`extlClntAppOauthSecuritySettings/`) | retrieve from org as source of truth                                                                 |

> **Scope trap (verified):** `Web` is mandatory even though this is a server flow.
> A suite that consumes the alias via the frontdoor (`sf org open`) needs a
> browser-session scope. `Api, RefreshToken` alone → `ERROR_HTTP_403 Invalid_Scope`.
> An admin-pre-authorized app also needs at least one standard scope (`Api`) or it
> issues no token.

If the security-settings type schema drifts, retrieve it as the source of truth
before editing (the retrieved name may carry a suffix, e.g. `<APP>_oauthSecurity`):

```sh
sf project retrieve start --metadata ExtlClntAppOauthSecuritySettings:<APP>_oauthSecurity -o <ORG_ALIAS>
```

Deploy all types together:

```sh
sf project deploy start \
  --source-dir force-app/main/default/externalClientApps \
  --source-dir force-app/main/default/extlClntAppGlobalOauthSets \
  --source-dir force-app/main/default/extlClntAppOauthSettings \
  --source-dir force-app/main/default/extlClntAppOauthPolicies \
  --source-dir force-app/main/default/extlClntAppOauthSecuritySettings \
  -o <ORG_ALIAS>
```

---

## 3. Read the generated consumer key

Salesforce **generates** the consumer key on ECA create — it cannot be known before
deploy. After step 2, read it and write it into `.env` as `SF_JWT_CLIENT_ID`.

- Setup → **External Client App Manager** → `<APP_LABEL>` → OAuth Settings →
  **Consumer Key**. Copy the value.

> This ordering is a hard constraint: deploy → read key → fill env. Any automation
> must treat "read consumer key" as a post-deploy step, not a precondition.

---

## 4. Upload the public cert (one-time, manual Setup step)

**Verified:** the JWT signing cert does **NOT** round-trip as ECA metadata — no cert
element appears in any retrieved ECA type. This is a one-time manual upload, and
must be **re-done whenever the org is rebuilt**.

- Setup → External Client App Manager → `<APP_LABEL>` → Edit → OAuth Settings →
  enable **JWT Bearer Flow** → **upload `<CERT>`** (the public cert from step 1). Save.

Any automation tool that cannot drive the Setup UI must surface this as a required
manual handoff, not silently skip it.

---

## 5. Pre-authorize the users (one-time, manual Setup step)

**Verified:** ECA pre-authorization is a **Setup-side profile/permission-set
assignment on the ECA**, not a metadata edit. The ECA does not appear in the
`ConnectedApplication` object, so the CLI `SetupEntityAccess` insert path is
unavailable.

- Setup → External Client App Manager → `<APP_LABEL>` → **Policies** → Manage
  Profiles (or Manage Permission Sets) → add `<PROFILE>`.

> If the test users share one profile, a single assignment authorizes both. If they
> don't, add each user's profile (or assign a common permission set).

---

## 6. Fill the `.env` contract

Copy `.env.example` → `.env` and set the jwt block:

```sh
SF_AUTH_MODE=jwt

SF_JWT_CLIENT_ID=<consumer key from step 3>
SF_JWT_KEY_FILE=<KEY>
SF_JWT_INSTANCE_URL=https://test.salesforce.com   # SANDBOX audience — NOT the my-domain URL

SF_EDITOR_USERNAME=<EDITOR_USER>   # the `sub` each in-process exchange authenticates AS
SF_VIEWER_USERNAME=<VIEWER_USER>
# SF_EDITOR_ALIAS / SF_VIEWER_ALIAS are NOT needed in jwt mode (web-only) — the
# in-process flow keys off username + key + client id + instance-url.
```

> **Audience trap (verified):** sandbox → `https://test.salesforce.com`. Using the
> my-domain host fails the token exchange with an opaque audience error. Production
> orgs use `https://login.salesforce.com`.

`SF_AUTH_MODE` unset or `web` = the interactive path (no jwt vars needed). Any
other value fails fast with a diagnostic.

---

## 7. Run

In jwt mode `auth.setup.ts` performs the JWT-bearer exchange **in-process** (no
`sf` CLI): it RS256-signs the assertion with `node:crypto`, POSTs it to
`<SF_JWT_INSTANCE_URL>/services/oauth2/token` via `fetch`, and builds the frontdoor
URL from the token response `instance_url`. There is nothing to run by hand —
just run the suite as normal.

There is **no refresh token** in jwt mode — a fresh assertion is signed each run
(180s expiry), so refresh-token-expiry failures disappear.

### Prove cold-start (CI-equivalent)

Because jwt mode uses no CLI session or `~/.sf` state, cold-start needs no
logout dance — a machine with **no `sf` CLI installed at all** must still pass:

```sh
# with SF_AUTH_MODE=jwt set and the .env jwt block filled, just run the suite;
# the in-process exchange + frontdoor must succeed from zero session
```

---

## 8. jwt-mode failure diagnosis

The setup fails fast with a distinct message per class; the token-endpoint
`{error, error_description}` is mapped to a cause. Check in order:

1. **Missing env** — any `SF_JWT_*` unset, or `SF_*_USERNAME` unset (pre-flight,
   before any HTTP call).
2. **Unreadable / invalid key** — `SF_JWT_KEY_FILE` path wrong (pre-flight), or the
   file is not a valid PEM private key (assertion signing fails) — distinct messages.
3. **`Invalid_Scope` / `ERROR_HTTP_403`** — ECA missing the `Web` scope (step 2);
   surfaces at the frontdoor navigation, not the token exchange.
4. **`invalid_grant` + audience** — wrong `SF_JWT_INSTANCE_URL` (sandbox needs
   `https://test.salesforce.com`), or the cert upload (step 4) was skipped / lost on
   an org rebuild.
5. **`invalid_grant` + `user hasn't approved this consumer`** — user not
   pre-authorized (step 5).
6. **`invalid_client` / signature** — wrong `SF_JWT_CLIENT_ID`, or the private key
   doesn't match the uploaded cert.

The diagnostic surfaces the OAuth cause but never the assertion, token, or
frontdoor URL, and never emits the `web`-mode remediation (`sf org login web`).

---

## Secrets discipline

- Private key: local + gitignored only; a CI secret store when CI is introduced.
  Never in metadata or git.
- JWT assertion + access token + frontdoor URL: in-process only, never logged and
  never written to disk (no `~/.sf` auth store).
- Verify clean: log scan for `BEGIN * PRIVATE KEY`, `frontdoor.jsp`, `sid=` → none.

## Manual-step summary (cannot be automated via CLI/metadata)

| Step                    | Why manual                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| 3 — read consumer key   | Generated on create; copy from Setup after deploy                                  |
| 4 — upload public cert  | Does not round-trip as metadata; Setup UI only; redo on org rebuild                |
| 5 — pre-authorize users | Setup-side ECA profile/perm-set assignment; ECA absent from `ConnectedApplication` |
