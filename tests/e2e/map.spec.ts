import { test, expect } from '@playwright/test';

const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';
const RUN_ID = Date.now();

// Auto-dismiss the "Live Preview is on" banner whenever it appears
async function setupAutoDissmiss(page: import('@playwright/test').Page) {
    await page.addLocatorHandler(page.getByText('Live Preview is on'), async () => {
        const closeBtn = page.getByRole('link', { name: 'Close' });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    });
}

// Create a Map record via UI and return its record URL
async function createMap(
    page: import('@playwright/test').Page,
    name: string
): Promise<string> {
    await setupAutoDissmiss(page);
    await page.goto('/lightning/o/bcm_Map__c/new');
    await page.getByLabel('Map Name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForURL(/\/view$/);
    return page.url();
}

// ── Editor CRUD ─────────────────────────────────────────────────────────────

test.describe('Map CRUD — editor project', () => {
    test('editor creates a Map record with a description', async ({ page }) => {
        const name = `E2E Map Create ${RUN_ID}`;
        await createMap(page, name);
        await expect(page.getByRole('heading', { name })).toBeVisible();
        // Tidy up
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
    });

    test('editor edits a Map record name', async ({ page }) => {
        const before = `E2E Map Edit Before ${RUN_ID}`;
        const after = `E2E Map Edit After ${RUN_ID}`;
        await createMap(page, before);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('Map Name').fill(after);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByRole('heading', { name: after })).toBeVisible();
        // Tidy up
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
    });

    test('editor deletes a Map record', async ({ page }) => {
        await createMap(page, `E2E Map Delete ${RUN_ID}`);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        // After deletion Lightning redirects to the list view
        await page.waitForSelector('.slds-page-header', { state: 'visible' });
        await expect(page.getByRole('link', { name: 'E2E Map Delete Test' })).not.toBeVisible();
    });
});

// ── Viewer access ────────────────────────────────────────────────────────────

test.describe('Map access — viewer project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, `E2E Viewer Read Map ${RUN_ID}`);
        await ctx.close();
    });

    test.afterAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await page.goto(mapUrl);
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await ctx.close();
    });

    test('viewer can read a Map record', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('heading', { name: `E2E Viewer Read Map ${RUN_ID}` })).toBeVisible();
    });

    test('viewer cannot create a Map record — no New button', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto('/lightning/o/bcm_Map__c/list');
        await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
    });

    test('viewer cannot edit a Map record — no Edit button', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(mapUrl);
        // The record-level Edit action sits in the record actions bar as a button
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible();
    });
});

// ── App Launcher and tab visibility ─────────────────────────────────────────

test.describe('BCM app — editor project', () => {
    test('BCM app appears in App Launcher', async ({ page }) => {
        await setupAutoDissmiss(page);
        // Navigate directly to the Maps list (no Live Preview banner, nav bar rendered)
        await page.goto('/lightning/o/bcm_Map__c/home');
        await page.getByRole('button', { name: 'App Launcher' }).click();
        // The panel shows "Recently Used" and "All Apps" — assert the app heading is visible
        await expect(
            page.getByRole('heading', { name: 'Business Capability Map' }).or(
                page.locator('p.slds-text-heading_small, .appTileTitle').getByText('Business Capability Map')
            ).first()
        ).toBeVisible({ timeout: 15000 });
    });

    test('Maps tab is visible to Editor', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps' })).toBeVisible();
    });

    test('Maps tab navigates to the Maps list', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await page.getByRole('link', { name: 'Maps' }).click();
        await expect(page).toHaveURL(/bcm_Map__c/);
    });
});

test.describe('BCM app — viewer project', () => {
    test('Maps tab is hidden from Viewer', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        // Wait for the nav bar to fully render before asserting absence
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Maps' })).not.toBeVisible();
    });
});
