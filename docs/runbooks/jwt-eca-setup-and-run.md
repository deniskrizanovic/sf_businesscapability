# Runbook — JWT External Client App: set up + run e2e (`SF_AUTH_MODE=jwt`)

Generic, tool-agnostic procedure for **any** automation tool (agent, CI job, shell
script, human) to provision the JWT-bearer External Client App (ECA) that backs
non-interactive e2e auth, then run the suite against it.

Source of truth for the design: `docs/adr/0007-e2e-jwt-external-client-app-auth.md`
and `docs/design/09-e2e-test-architecture.md` §3. This runbook is the executable
distillation — the values below are **verified against the live org**, not theory.

> Why ECA not Connected App: Salesforce blocks new Connected App creation after
> 2026-02-21 (passed). ECA is the only forward path for a new JWT-bearer app.

---

## 0. Preconditions

- Salesforce CLI (`sf`) installed and on `PATH`.
- `openssl` installed.
- Admin access to the target org's Setup (steps 4 and 6 are Setup-UI-only — see below).
- Target is a **sandbox** in this project → JWT audience is `https://test.salesforce.com`.
- **NOT required (verified):** the org perm "Allow Access to OAuth Consumer Secrets
  via Metadata API" and user perm "View External Client Apps Consumer Secrets in
  Metadata". JWT-bearer is cert-based and has no consumer secret, so that metadata
  gate never engages. Do not waste time enabling it.

Placeholders used below: `<ORG_ALIAS>` (an admin-authed alias for deploy/read),
`<APP>` = `Bcm_E2e_Jwt`, `<APP_LABEL>` = `BCM E2E JWT`.

---

## 1. Generate the keypair (local, one-time)

Private key stays local + gitignored; only the **public cert** ever leaves the machine.

```sh
mkdir -p secrets
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout secrets/bcm-e2e-jwt.key \
  -out    secrets/bcm-e2e-jwt.crt \
  -days   3650 \
  -subj   "/C=AU/O=BusinessCapabilityMap/CN=BCM E2E JWT"
```

- `secrets/bcm-e2e-jwt.key` = **private** key (PEM). Feeds `SF_JWT_KEY_FILE`. **Never commit.**
- `secrets/bcm-e2e-jwt.crt` = **public** X.509 cert. Uploaded to the ECA in step 4.
- Confirm `.gitignore` covers `secrets/`, `*.key`, `*.pem`. Verify nothing is tracked:
  `git ls-files | grep -E '\.(key|pem)$|^secrets/'` → must be empty.

---

## 2. Author + deploy the ECA metadata

The ECA is expressed across five metadata types under `force-app/main/default/`.
They already exist in this repo — deploy as **one unit**. If recreating from
scratch, author via the `integration-connectivity-connected-app-configure` skill
(ships ECA templates); do **not** hand-write the XSD-ordered XML.

Verified config (from the committed files):

| Type (folder)                                                            | Key settings                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ExternalClientApplication` (`externalClientApps/`)                      | label `BCM E2E JWT`, `distributionState=Local`, `isProtected=false`                                  |
| `ExtlClntAppGlobalOauthSettings` (`extlClntAppGlobalOauthSets/`)         | `callbackUrl=https://login.salesforce.com/services/oauth2/callback`, `isConsumerSecretOptional=true` |
| `ExtlClntAppOauthSettings` (`extlClntAppOauthSettings/`)                 | **scopes = `Api, Web, RefreshToken`**                                                                |
| `ExtlClntAppOauthConfigurablePolicies` (`extlClntAppOauthPolicies/`)     | `permittedUsersPolicyType=AdminApprovedPreAuthorized`, `ipRelaxationPolicyType=Enforce`              |
| `ExtlClntAppOauthSecuritySettings` (`extlClntAppOauthSecuritySettings/`) | retrieve from org as source of truth                                                                 |

> **Scope trap (verified):** `Web` is mandatory even though this is a server flow.
> The suite consumes the alias via the frontdoor (`sf org open`), which needs a
> browser-session scope. `Api, RefreshToken` alone → `ERROR_HTTP_403 Invalid_Scope`.
> An admin-pre-authorized app also needs at least one standard scope (`Api`) or it
> issues no token.

If the security-settings type schema drifts, retrieve it as the source of truth
before editing:

```sh
sf project retrieve start --metadata ExtlClntAppOauthSecuritySettings:Bcm_E2e_Jwt_oauthSecurity -o <ORG_ALIAS>
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

- Setup → App Manager / **External Client App Manager** → `BCM E2E JWT` → OAuth
  Settings → **Consumer Key**. Copy the value.

> This ordering is a hard constraint: deploy → read key → fill env. Any automation
> must treat "read consumer key" as a post-deploy step, not a precondition.

---

## 4. Upload the public cert (one-time, manual Setup step)

**Verified:** the JWT signing cert does **NOT** round-trip as ECA metadata — no cert
element appears in any retrieved ECA type. This is a one-time manual upload, and
must be **re-done whenever the org is rebuilt**.

- Setup → External Client App Manager → `BCM E2E JWT` → Edit → OAuth Settings →
  enable **JWT Bearer Flow** → **upload `secrets/bcm-e2e-jwt.crt`** (the public cert
  from step 1). Save.

Any automation tool that cannot drive the Setup UI must surface this as a required
manual handoff, not silently skip it.

---

## 5. Pre-authorize the users (one-time, manual Setup step)

**Verified:** ECA pre-authorization is a **Setup-side profile/permission-set
assignment on the ECA**, not a metadata edit. The ECA does not appear in the
`ConnectedApplication` object, so the CLI `SetupEntityAccess` insert path is
unavailable.

- Setup → External Client App Manager → `BCM E2E JWT` → **Policies** → Manage
  Profiles (or Manage Permission Sets) → add the profile that the e2e users share:
  **`AutomatedTester - Minimum Access Clone`**.

> Both editor + viewer users share that profile → one profile assignment authorizes
> both. If your users don't share a profile, add each one (or a common permission set).

---

## 6. Fill the `.env` contract

Copy `.env.example` → `.env` and set the jwt block. Verified values:

```sh
SF_AUTH_MODE=jwt

SF_JWT_CLIENT_ID=<consumer key from step 3>
SF_JWT_KEY_FILE=secrets/bcm-e2e-jwt.key
SF_JWT_INSTANCE_URL=https://test.salesforce.com   # SANDBOX audience — NOT the my-domain URL

SF_EDITOR_USERNAME=<editor user>   # the identity each alias authenticates AS
SF_VIEWER_USERNAME=<viewer user>
SF_EDITOR_ALIAS=bcm-editor-e2e
SF_VIEWER_ALIAS=bcm-viewer-e2e
```

> **Audience trap (verified):** sandbox → `https://test.salesforce.com`. Using the
> my-domain host fails the token exchange with an opaque audience error. Production
> orgs use `https://login.salesforce.com`.

`SF_AUTH_MODE` unset or `web` = today's interactive path (no jwt vars needed). Any
other value fails fast with a diagnostic.

---

## 7. Run

`ensureAuthed` (in `tests/e2e/fixtures/auth.setup.ts`) runs per alias before the
unchanged frontdoor exchange. In jwt mode it runs, idempotently, per run:

```sh
sf org login jwt \
  --username     <SF_*_USERNAME> \
  --jwt-key-file <SF_JWT_KEY_FILE> \
  --client-id    <SF_JWT_CLIENT_ID> \
  --instance-url <SF_JWT_INSTANCE_URL> \
  -a             <alias>
```

There is **no refresh token** in jwt mode — the CLI re-asserts via the private key
when the access token expires, so refresh-token-expiry failures disappear.

Run the suite as normal (e.g. `npm run test:e2e`).

### Prove cold-start (CI-equivalent)

Clear any existing CLI session for the aliases first, then run — no interaction
should be required:

```sh
sf org logout -o bcm-editor-e2e --no-prompt
sf org logout -o bcm-viewer-e2e --no-prompt
# then run the suite; jwt re-auth + frontdoor must succeed from zero session
```

Verified result: 104 passed / 8 skipped, rc=0 from a zero-session start.

---

## 8. jwt-mode failure diagnosis

When auth fails in jwt mode, check in order:

1. **Missing env** — any `SF_JWT_*` unset, or `SF_*_USERNAME` unset.
2. **Unreadable key** — `SF_JWT_KEY_FILE` path wrong / not a valid PEM private key.
3. **`Invalid_Scope` / `ERROR_HTTP_403`** — ECA missing the `Web` scope (step 2).
4. **Token/audience error** — wrong `SF_JWT_INSTANCE_URL` (sandbox needs
   `https://test.salesforce.com`), or the cert upload (step 4) was skipped / lost on
   an org rebuild.
5. **`user hasn't approved this consumer` / no token** — user not pre-authorized
   (step 5), or a standard scope (`Api`) missing.

Never emit the `web`-mode remediation (`sf org login web`) in jwt mode.

---

## Secrets discipline

- Private key: local + gitignored only; a CI secret store when CI is introduced.
  Never in metadata or git.
- Frontdoor URL token: in-process, never logged. `ensureAuthed` never logs the
  stdout of `sf org login jwt`.
- Verified clean: log scan for `BEGIN * PRIVATE KEY`, `frontdoor.jsp`, `sid=` → none.

## Manual-step summary (cannot be automated via CLI/metadata)

| Step                    | Why manual                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| 4 — upload public cert  | Does not round-trip as metadata; Setup UI only; redo on org rebuild                |
| 5 — pre-authorize users | Setup-side ECA profile/perm-set assignment; ECA absent from `ConnectedApplication` |
| 3 — read consumer key   | Generated on create; copy from Setup after deploy                                  |
