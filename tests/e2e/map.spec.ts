import { test, expect } from '@playwright/test';

const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';

// Shared seed: create a Map record via UI and return its record URL
async function createMap(
    page: import('@playwright/test').Page,
    name: string,
    description?: string
): Promise<string> {
    await page.goto(`${APP_PATH}/bcm_Map__c/new`);
    await page.getByLabel('Map Name').fill(name);
    if (description) {
        // Rich Text Area — type into the iframe content area
        const rtfFrame = page.frameLocator('iframe[title*="Description"]').first();
        await rtfFrame.locator('body').fill(description);
    }
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(/\/view$/);
    return page.url();
}

// ── Editor CRUD ─────────────────────────────────────────────────────────────

test.describe('Map CRUD — editor project', () => {
    test('editor creates a Map record with a description', async ({ page }) => {
        const url = await createMap(page, 'E2E Map Create Test', 'Test description');
        await expect(page.getByRole('heading', { name: 'E2E Map Create Test' })).toBeVisible();
        // Tidy up
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
    });

    test('editor edits a Map record name', async ({ page }) => {
        const url = await createMap(page, 'E2E Map Edit Before');
        await page.getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('Map Name').fill('E2E Map Edit After');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByRole('heading', { name: 'E2E Map Edit After' })).toBeVisible();
        // Tidy up
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
    });

    test('editor deletes a Map record', async ({ page }) => {
        await createMap(page, 'E2E Map Delete Test');
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.waitForURL(/bcm_Map__c\/list/);
        await expect(page.getByText('E2E Map Delete Test')).not.toBeVisible();
    });
});

// ── Viewer access ────────────────────────────────────────────────────────────

test.describe('Map access — viewer project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        // Create a Map as editor so viewer has a record to navigate to
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, 'E2E Viewer Read Map');
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
        await page.goto(mapUrl);
        await expect(page.getByRole('heading', { name: 'E2E Viewer Read Map' })).toBeVisible();
    });

    test('viewer cannot create a Map record — no New button', async ({ page }) => {
        await page.goto('/lightning/o/bcm_Map__c/list');
        await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
    });

    test('viewer cannot edit a Map record — no Edit button', async ({ page }) => {
        await page.goto(mapUrl);
        await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();
    });
});

// ── App Launcher and tab visibility ─────────────────────────────────────────

test.describe('BCM app — editor project', () => {
    test('BCM app appears in App Launcher', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'App Launcher' }).click();
        await expect(page.getByRole('link', { name: 'Business Capability Map' })).toBeVisible();
    });

    test('Maps tab is visible to Editor', async ({ page }) => {
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps' })).toBeVisible();
    });

    test('Maps tab navigates to the Maps list', async ({ page }) => {
        await page.goto(APP_PATH);
        await page.getByRole('link', { name: 'Maps' }).click();
        await expect(page).toHaveURL(/bcm_Map__c/);
    });
});

test.describe('BCM app — viewer project', () => {
    test('Maps tab is hidden from Viewer', async ({ page }) => {
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps' })).not.toBeVisible();
    });
});
