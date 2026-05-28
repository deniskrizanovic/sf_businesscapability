import { test, expect } from '@playwright/test';

const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';
const RUN_ID = Date.now();

async function setupAutoDissmiss(page: import('@playwright/test').Page) {
    await page.addLocatorHandler(page.getByText('Live Preview is on'), async () => {
        const closeBtn = page.getByRole('link', { name: 'Close' });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    });
}

// ── Colour swatch ─────────────────────────────────────────────────────────────

test.describe('Tag record page — editor project', () => {
    let tagUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDissmiss(page);
        await page.goto('/lightning/o/bcm_Tag__c/new');
        await page.getByLabel('Tag Name').fill(`E2E Swatch Tag ${RUN_ID}`);
        await page.getByRole('combobox', { name: 'Colour' }).click();
        await page.getByRole('option', { name: 'Blue' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        tagUrl = page.url();
        await ctx.close();
    });

    test.afterAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await page.goto(tagUrl);
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await ctx.close();
    });

    test('colour swatch lightning-card tile is visible on Tag record page', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(tagUrl);
        // The swatch component renders a lightning-card filled with the colour
        // and the colour name as white centred text
        const swatchCard = page.locator('lightning-card').filter({ hasText: 'Blue' }).first();
        await expect(swatchCard).toBeVisible();
    });
});

// ── Tab visibility ─────────────────────────────────────────────────────────────

test.describe('Tags tab — editor project', () => {
    test('Tags tab is visible to Editor', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags' })).toBeVisible();
    });
});

test.describe('Tags tab — viewer project', () => {
    test('Tags tab is visible to Viewer', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags' })).toBeVisible();
    });
});
