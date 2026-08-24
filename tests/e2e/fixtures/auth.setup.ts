import { test as setup } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs, constants as fsConstants } from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const editorAuthFile = path.join(__dirname, '../.auth/editor.json');
const viewerAuthFile = path.join(__dirname, '../.auth/viewer.json');

/**
 * Auth strategy for how each user's browser-auth access token is obtained before
 * the frontdoor exchange. Selected via SF_AUTH_MODE; see
 * docs/design/09-e2e-test-architecture.md §3.
 *   web  (default) — alias pre-authed once by a human (`sf org login web`); the
 *                    frontdoor URL comes from `sf org open --url-only`.
 *   jwt            — token minted in-process per run via an RFC 7523 JWT-bearer
 *                    exchange (no `sf` CLI), backed by the committed
 *                    "BCM E2E JWT" External Client App.
 */
type AuthMode = 'web' | 'jwt';

function resolveAuthMode(): AuthMode {
    const raw = (process.env.SF_AUTH_MODE ?? 'web').trim();
    if (raw === '' || raw === 'web') return 'web';
    if (raw === 'jwt') return 'jwt';
    throw new Error(`Invalid SF_AUTH_MODE "${raw}". Accepted values: "web" (default) or "jwt".`);
}

const AUTH_MODE = resolveAuthMode();

/**
 * Mode-branched remediation for a frontdoor navigation failure. In web mode point
 * at the one-time interactive login; in jwt mode NEVER emit the web remediation —
 * name the jwt-side causes instead.
 */
function frontdoorRemediation(label: string): string {
    return AUTH_MODE === 'jwt'
        ? `Re-check jwt config: the SF_JWT_* vars, this user's pre-authorization on the ` +
              `"BCM E2E JWT" External Client App, the instance-url audience ` +
              `(sandbox needs https://test.salesforce.com), and the ECA OAuth scopes ` +
              `(frontdoor needs "Web" — Api+RefreshToken alone yields ERROR_HTTP_403 Invalid_Scope). ` +
              `Do NOT run "sf org login web".`
        : `Run: sf org login web -a ${label}`;
}

// ─── jwt mode: in-process RFC 7523 JWT-bearer flow (no `sf` CLI) ──────────────

/** OAuth error from the token endpoint; carries the safe-to-surface fields only. */
class JwtOAuthError extends Error {
    constructor(
        readonly oauthError: string | undefined,
        readonly oauthDescription: string | undefined
    ) {
        super('jwt-bearer token exchange failed');
        this.name = 'JwtOAuthError';
    }
}

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url');
}

/**
 * Build + RS256-sign a JWT-bearer assertion.
 *   header {alg:'RS256',typ:'JWT'}, claims {iss,sub,aud,exp:now+180}
 * sign `<header>.<claims>` with the PEM private key, append the base64url signature.
 */
function buildJwtAssertion(opts: {
    clientId: string;
    username: string;
    audience: string;
    keyPem: string;
}): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const claims = base64url(
        JSON.stringify({
            iss: opts.clientId,
            sub: opts.username,
            aud: opts.audience,
            exp: now + 180
        })
    );
    const signingInput = `${header}.${claims}`;
    const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(opts.keyPem);
    return `${signingInput}.${base64url(signature)}`;
}

/**
 * Exchange the assertion for an access token at the audience's token endpoint.
 * Returns the org my-domain `instance_url` from the response — the frontdoor MUST
 * be built on that host, not the audience host. On an OAuth error throws
 * JwtOAuthError carrying `{error, error_description}` (never the assertion/token).
 */
async function jwtBearerAccessToken(
    audience: string,
    assertion: string
): Promise<{ access_token: string; instance_url: string }> {
    // Normalize a trailing slash on the audience so the path never double-slashes
    // (e.g. "https://test.salesforce.com/" -> ".../services/oauth2/token").
    const tokenUrl = `${audience.replace(/\/+$/, '')}/services/oauth2/token`;
    const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        })
    });
    const data: {
        access_token?: string;
        instance_url?: string;
        error?: string;
        error_description?: string;
    } = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.instance_url) {
        throw new JwtOAuthError(data.error, data.error_description);
    }
    return { access_token: data.access_token, instance_url: data.instance_url };
}

/** Map the token-endpoint `{error, error_description}` to a human failure class. */
function classifyOAuthError(error: string | undefined, description: string | undefined): string {
    const e = (error ?? '').toLowerCase();
    const d = (description ?? '').toLowerCase();
    if (e === 'invalid_grant' && d.includes('approv'))
        return `the user is not pre-authorized on the "BCM E2E JWT" External Client App`;
    if (e === 'invalid_grant' && d.includes('audience'))
        return `the instance-url audience is wrong (sandbox needs https://test.salesforce.com)`;
    if (
        e === 'invalid_client' ||
        e === 'invalid_client_id' ||
        d.includes('client identifier') ||
        d.includes('client id')
    )
        return `the consumer key (SF_JWT_CLIENT_ID) is invalid`;
    if (e === 'invalid_grant' && (d.includes('signature') || d.includes('assertion')))
        return `the private key / signature is invalid (SF_JWT_KEY_FILE)`;
    return `${error ?? 'unknown_error'}${description ? `: ${description}` : ''}`;
}

/**
 * jwt mode: mint a frontdoor URL for `username` fully in-process.
 * Pre-flight fails fast (missing SF_JWT_* var, unreadable/invalid PEM) with a
 * distinct message, and NEVER emits the `sf org login web` remediation. The
 * assertion, access token, and frontdoor URL are held in-process and never logged.
 */
async function jwtBearerFrontdoorUrl(username: string | undefined): Promise<string> {
    const clientId = process.env.SF_JWT_CLIENT_ID;
    const keyFile = process.env.SF_JWT_KEY_FILE;
    const audience = process.env.SF_JWT_INSTANCE_URL;

    const missing = Object.entries({
        SF_JWT_CLIENT_ID: clientId,
        SF_JWT_KEY_FILE: keyFile,
        SF_JWT_INSTANCE_URL: audience,
        'a username (SF_*_USERNAME)': username
    })
        .filter(([, v]) => !v || !String(v).trim())
        .map(([k]) => k);
    if (missing.length) {
        throw new Error(
            `SF_AUTH_MODE=jwt but required input(s) missing: ${missing.join(', ')}. ` +
                `Set them in .env (see .env.example). This is a jwt-mode config error — ` +
                `do NOT run "sf org login web".`
        );
    }

    // Single try/catch around access + read: a file that passes the R_OK check but
    // is unreadable at read time (deleted/replaced, or a directory -> EISDIR) still
    // surfaces the jwt-mode diagnostic, not a bare Node error.
    let keyPem: string;
    try {
        await fs.access(keyFile!, fsConstants.R_OK);
        keyPem = await fs.readFile(keyFile!, 'utf8');
    } catch {
        throw new Error(
            `SF_AUTH_MODE=jwt: private key file "${keyFile}" (SF_JWT_KEY_FILE) is missing or ` +
                `unreadable. Point it at the ECA's local PEM private key. jwt-mode error — ` +
                `do NOT run "sf org login web".`
        );
    }

    let assertion: string;
    try {
        assertion = buildJwtAssertion({
            clientId: clientId!,
            username: username!,
            audience: audience!,
            keyPem
        });
    } catch (err) {
        const cause = err instanceof Error ? err.message.split('\n')[0] : String(err);
        throw new Error(
            `SF_AUTH_MODE=jwt: could not sign the JWT assertion — the key in "${keyFile}" ` +
                `(SF_JWT_KEY_FILE) is not a valid PEM private key. jwt-mode error — ` +
                `do NOT run "sf org login web".\n  cause: ${cause}`
        );
    }

    let token: { access_token: string; instance_url: string };
    try {
        token = await jwtBearerAccessToken(audience!, assertion);
    } catch (err) {
        if (err instanceof JwtOAuthError) {
            throw new Error(
                `SF_AUTH_MODE=jwt login failed for user "${username}": ` +
                    `${classifyOAuthError(err.oauthError, err.oauthDescription)}. jwt-mode error — ` +
                    `do NOT run "sf org login web".`
            );
        }
        const cause = err instanceof Error ? err.message.split('\n')[0] : String(err);
        throw new Error(
            `SF_AUTH_MODE=jwt: token endpoint request failed for user "${username}". ` +
                `jwt-mode error — do NOT run "sf org login web".\n  cause: ${cause}`
        );
    }

    // Frontdoor MUST use the response instance_url (org my-domain host), not the
    // audience host, or the Lightning cookies won't be set for the org.
    return `${token.instance_url}/secur/frontdoor.jsp?sid=${token.access_token}&retURL=/lightning`;
}

// ─── web mode: frontdoor URL from the CLI's stored session ────────────────────

/**
 * web mode: ask the `sf` CLI for a frontdoor URL for `alias`. The alias must
 * already hold a valid CLI OAuth session (one-time `sf org login web`). The URL
 * carries a live access token, so it is captured in-process and never logged.
 */
async function webFrontdoorUrl(alias: string): Promise<string> {
    let frontdoorUrl: string;
    try {
        const { stdout } = await execFileAsync(
            'sf',
            ['org', 'open', '-o', alias, '--url-only', '--path', '/lightning', '--json'],
            // Playwright sets FORCE_COLOR, which makes `sf --json` emit ANSI-colorized
            // JSON that JSON.parse chokes on. Force plain output.
            { env: { ...process.env, FORCE_COLOR: '0' } }
        );
        frontdoorUrl = JSON.parse(stdout).result.url;
    } catch (err) {
        // Alias has no valid session — fail fast with the mode-appropriate fix.
        // The cause (never the frontdoor URL) is safe to surface for diagnosis.
        const cause = err instanceof Error ? err.message.split('\n')[0] : String(err);
        throw new Error(
            `Could not obtain a frontdoor URL for org alias "${alias}". ` +
                `The alias is not authenticated. ${frontdoorRemediation(alias)}\n  cause: ${cause}`
        );
    }

    if (!frontdoorUrl) {
        throw new Error(
            `sf org open returned no URL for alias "${alias}". ${frontdoorRemediation(alias)}`
        );
    }
    return frontdoorUrl;
}

// ─── shared seam ──────────────────────────────────────────────────────────────

/**
 * Produce a frontdoor URL for a user per the active mode. jwt keys off the
 * username (alias is web-only); web keys off the CLI-authed alias.
 */
async function frontdoorUrlForUser(
    alias: string | undefined,
    username: string | undefined
): Promise<string> {
    if (AUTH_MODE === 'jwt') return jwtBearerFrontdoorUrl(username);
    return webFrontdoorUrl(alias!);
}

/**
 * Navigate the browser to a pre-built frontdoor URL so Salesforce sets the
 * Lightning session cookies, then wait for the Lightning shell. Mode-agnostic —
 * the token source is entirely upstream. The caller persists the storageState.
 * `label` is used only for the remediation message (alias in web mode).
 */
async function openViaFrontdoor(
    page: import('@playwright/test').Page,
    frontdoorUrl: string,
    label: string
) {
    await page.goto(frontdoorUrl);

    // A stale/invalid token frontdoors but redirects back to a login form.
    try {
        await page.waitForURL(/\/lightning\//, { timeout: 30_000 });
    } catch {
        throw new Error(
            `Frontdoor navigation for "${label}" did not reach the Lightning shell ` +
                `(likely redirected to a login form — the session is stale). ` +
                `${frontdoorRemediation(label)}`
        );
    }
}

setup('authenticate as editor', async ({ page }) => {
    const alias = process.env.SF_EDITOR_ALIAS;
    const frontdoorUrl = await frontdoorUrlForUser(alias, process.env.SF_EDITOR_USERNAME);
    await openViaFrontdoor(page, frontdoorUrl, alias ?? 'editor');
    await page.context().storageState({ path: editorAuthFile });
});

setup('authenticate as viewer', async ({ page }) => {
    const alias = process.env.SF_VIEWER_ALIAS;
    const frontdoorUrl = await frontdoorUrlForUser(alias, process.env.SF_VIEWER_USERNAME);
    await openViaFrontdoor(page, frontdoorUrl, alias ?? 'viewer');
    await page.context().storageState({ path: viewerAuthFile });
});
