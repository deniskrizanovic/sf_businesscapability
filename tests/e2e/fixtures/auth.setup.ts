import { test as setup } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const editorAuthFile = path.join(__dirname, '../.auth/editor.json');
const viewerAuthFile = path.join(__dirname, '../.auth/viewer.json');

/**
 * Auth strategy for how each org alias becomes authenticated before the
 * frontdoor exchange. Selected via SF_AUTH_MODE; see
 * docs/design/09-e2e-test-architecture.md §3.
 *   web  (default) — alias pre-authed once by a human (`sf org login web`).
 *   jwt            — alias authed non-interactively per run (`sf org login jwt`),
 *                    backed by the committed "BCM E2E JWT" External Client App.
 */
type AuthMode = 'web' | 'jwt';

function resolveAuthMode(): AuthMode {
    const raw = (process.env.SF_AUTH_MODE ?? 'web').trim();
    if (raw === '' || raw === 'web') return 'web';
    if (raw === 'jwt') return 'jwt';
    throw new Error(
        `Invalid SF_AUTH_MODE "${raw}". Accepted values: "web" (default) or "jwt".`
    );
}

const AUTH_MODE = resolveAuthMode();

/**
 * Mode-branched remediation for a frontdoor failure. In web mode point at the
 * one-time interactive login; in jwt mode NEVER emit the web remediation —
 * name the jwt-side causes instead.
 */
function frontdoorRemediation(alias: string): string {
    return AUTH_MODE === 'jwt'
        ? `Re-check jwt config: the SF_JWT_* vars, this user's pre-authorization on the ` +
              `"BCM E2E JWT" External Client App, the instance-url audience ` +
              `(sandbox needs https://test.salesforce.com), and the ECA OAuth scopes ` +
              `(frontdoor needs "Web" — Api+RefreshToken alone yields ERROR_HTTP_403 Invalid_Scope). ` +
              `Do NOT run "sf org login web".`
        : `Run: sf org login web -a ${alias}`;
}

/**
 * Ensure the org `alias` holds a valid CLI session before the frontdoor exchange.
 *
 * web mode: no-op — the alias is assumed pre-authed via a one-time
 * `sf org login web`, and the CLI's stored refresh token carries subsequent runs.
 *
 * jwt mode: re-assert the alias non-interactively from the ECA private key via
 * `sf org login jwt`. Idempotent — safe to run every time, and cold-start capable
 * (no prior CLI session required). The login stdout carries a live token, so it
 * is never logged; only the first line of an error is surfaced for diagnosis.
 */
async function ensureAuthed(alias: string, username: string | undefined) {
    if (AUTH_MODE === 'web') return;

    const clientId = process.env.SF_JWT_CLIENT_ID;
    const keyFile = process.env.SF_JWT_KEY_FILE;
    const instanceUrl = process.env.SF_JWT_INSTANCE_URL;

    const missing = Object.entries({
        SF_JWT_CLIENT_ID: clientId,
        SF_JWT_KEY_FILE: keyFile,
        SF_JWT_INSTANCE_URL: instanceUrl,
        [`a username for alias "${alias}"`]: username,
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

    try {
        await fs.access(keyFile!, fsConstants.R_OK);
    } catch {
        throw new Error(
            `SF_AUTH_MODE=jwt: private key file "${keyFile}" (SF_JWT_KEY_FILE) is missing or ` +
                `unreadable. Point it at the ECA's local PEM private key. jwt-mode error — ` +
                `do NOT run "sf org login web".`
        );
    }

    try {
        await execFileAsync(
            'sf',
            [
                'org',
                'login',
                'jwt',
                '--username',
                username!,
                '--jwt-key-file',
                keyFile!,
                '--client-id',
                clientId!,
                '--instance-url',
                instanceUrl!,
                '-a',
                alias,
                '--json',
            ],
            { env: { ...process.env, FORCE_COLOR: '0' } }
        );
    } catch (err) {
        const cause = err instanceof Error ? err.message.split('\n')[0] : String(err);
        throw new Error(
            `SF_AUTH_MODE=jwt login failed for alias "${alias}" (user ${username}). ` +
                `Likely: the user is not pre-authorized on the "BCM E2E JWT" External Client App, ` +
                `the instance-url audience is wrong (sandbox needs https://test.salesforce.com), ` +
                `or the consumer key / private key is invalid. jwt-mode error — ` +
                `do NOT run "sf org login web".\n  cause: ${cause}`
        );
    }
}

/**
 * Authenticate a browser session via the OAuth frontdoor flow.
 *
 * The org `alias` must already hold a valid CLI OAuth session — supplied by
 * `ensureAuthed` (web: one-time human login; jwt: per-run `sf org login jwt`).
 * We ask the CLI for a frontdoor URL — it carries the CLI's access token —
 * navigate the page to it so Salesforce sets Lightning session cookies, then the
 * caller persists the storageState.
 *
 * The frontdoor URL contains a live access token, so it is captured in-process
 * and never logged.
 */
async function openViaFrontdoor(page: import('@playwright/test').Page, alias: string) {
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

    await page.goto(frontdoorUrl);

    // A stale/invalid token frontdoors but redirects back to a login form.
    try {
        await page.waitForURL(/\/lightning\//, { timeout: 30_000 });
    } catch {
        throw new Error(
            `Frontdoor navigation for alias "${alias}" did not reach the Lightning shell ` +
                `(likely redirected to a login form — the session is stale). ` +
                `${frontdoorRemediation(alias)}`
        );
    }
}

setup('authenticate as editor', async ({ page }) => {
    await ensureAuthed(process.env.SF_EDITOR_ALIAS!, process.env.SF_EDITOR_USERNAME);
    await openViaFrontdoor(page, process.env.SF_EDITOR_ALIAS!);
    await page.context().storageState({ path: editorAuthFile });
});

setup('authenticate as viewer', async ({ page }) => {
    await ensureAuthed(process.env.SF_VIEWER_ALIAS!, process.env.SF_VIEWER_USERNAME);
    await openViaFrontdoor(page, process.env.SF_VIEWER_ALIAS!);
    await page.context().storageState({ path: viewerAuthFile });
});
