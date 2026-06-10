import { test, expect } from '@playwright/test';
import { APP_PATH, RUN_ID, setupAutoDismiss } from './fixtures/helpers';

// ── Colour swatch ─────────────────────────────────────────────────────────────

test.describe('Tag record page — editor project', () => {
    let tagUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Tag__c/new');
        await page.getByLabel('Tag Name').fill(`E2E Swatch Tag ${RUN_ID}`);
        await page.getByRole('combobox', { name: 'Colour' }).click();
        await page.getByRole('option', { name: 'Blue' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        tagUrl = page.url();
        await ctx.close();
    });

    test('colour swatch lightning-card tile is visible on Tag record page', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(tagUrl);
        // The swatch card has title "Colour"; inner label text may be hex or human label depending on load state.
        const swatchCard = page.locator('article').filter({ has: page.locator('h2', { hasText: 'Colour' }) }).first();
        await expect(swatchCard).toBeVisible({ timeout: 15000 });
    });
});

// ── Tab visibility ─────────────────────────────────────────────────────────────

test.describe('Tags tab — editor project', () => {
    test('Tags tab is visible to Editor', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags' })).toBeVisible();
    });
});

test.describe('Tags tab — viewer project', () => {
    test('Tags tab is visible to Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags' })).toBeVisible();
    });
});
