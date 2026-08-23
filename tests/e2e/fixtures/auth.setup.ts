import { test as setup } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const editorAuthFile = path.join(__dirname, '../.auth/editor.json');
const viewerAuthFile = path.join(__dirname, '../.auth/viewer.json');

/**
 * Authenticate a browser session via the OAuth frontdoor flow.
 *
 * The org `alias` must already hold a valid CLI OAuth session (one-time
 * `sf org login web -o <alias>`). We ask the CLI for a frontdoor URL — it
 * carries the CLI's access token — navigate the page to it so Salesforce sets
 * Lightning session cookies, then the caller persists the storageState.
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
        // Never logged in, or refresh token expired/revoked — fail fast with the fix.
        // The cause (never the frontdoor URL) is safe to surface for diagnosis.
        const cause = err instanceof Error ? err.message.split('\n')[0] : String(err);
        throw new Error(
            `Could not obtain a frontdoor URL for org alias "${alias}". ` +
                `The alias is not authenticated (never logged in, or its refresh token expired/revoked). ` +
                `Run: sf org login web -a ${alias}\n  cause: ${cause}`
        );
    }

    if (!frontdoorUrl) {
        throw new Error(
            `sf org open returned no URL for alias "${alias}". Run: sf org login web -a ${alias}`
        );
    }

    await page.goto(frontdoorUrl);

    // A stale/invalid token frontdoors but redirects back to a login form.
    try {
        await page.waitForURL(/\/lightning\//, { timeout: 30_000 });
    } catch {
        throw new Error(
            `Frontdoor navigation for alias "${alias}" did not reach the Lightning shell ` +
                `(likely redirected to a login form — the CLI session is stale). ` +
                `Run: sf org login web -a ${alias}`
        );
    }
}

setup('authenticate as editor', async ({ page }) => {
    await openViaFrontdoor(page, process.env.SF_EDITOR_ALIAS!);
    await page.context().storageState({ path: editorAuthFile });
});

setup('authenticate as viewer', async ({ page }) => {
    await openViaFrontdoor(page, process.env.SF_VIEWER_ALIAS!);
    await page.context().storageState({ path: viewerAuthFile });
});
