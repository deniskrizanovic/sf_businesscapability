import { test, expect } from '@playwright/test';
import { RUN_ID, setupAutoDismiss, recordIdFromUrl } from './fixtures/helpers';

// ── Tags related list on Capability record page ───────────────────────────────

test.describe('Capability record page — Tags related list — editor project', () => {
    let capabilityUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(`E2E CapTag Map ${RUN_ID}`);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        const mapId = recordIdFromUrl(page.url());

        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(`E2E CapTag Cap ${RUN_ID}`);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        capabilityUrl = page.url();

        await ctx.close();
    });

    test('Tags related list is visible in the sidebar', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(capabilityUrl);
        await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    });
});

// ── Junction record CRUD ──────────────────────────────────────────────────────

test.describe('Capability-Tag junction — editor project', () => {
    let capabilityUrl: string;
    const tagName = `E2E CapTag Tag ${RUN_ID}`;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(`E2E CapTag Junction Map ${RUN_ID}`);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        const mapId = recordIdFromUrl(page.url());

        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(`E2E CapTag Junction Cap ${RUN_ID}`);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        capabilityUrl = page.url();

        await page.goto('/lightning/o/bcm_Tag__c/new');
        await page.getByLabel('Tag Name').fill(tagName);
        await page.getByRole('combobox', { name: 'Colour' }).click();
        await page.getByRole('option', { name: 'Green' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);

        await ctx.close();
    });

    test('Editor can link a Tag to a Capability and it appears in the sidebar', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(capabilityUrl);

        await page.getByRole('button', { name: 'Show actions for Tags' }).click();
        await page.getByRole('menuitem', { name: 'New' }).click();
        const tagLookup = page.getByRole('combobox', { name: 'Tag' });
        await tagLookup.click();
        await tagLookup.pressSequentially(tagName.slice(0, 10));
        await expect(page.getByRole('option', { name: tagName })).toBeVisible();
        await page.getByRole('option', { name: tagName }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(page.getByRole('link', { name: tagName })).toBeVisible();
    });
});

// ── Viewer cannot create a junction ──────────────────────────────────────────

test.describe('Capability record page — Tags related list — viewer project', () => {
    let capabilityUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(`E2E CapTag Viewer Map ${RUN_ID}`);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        const mapId = recordIdFromUrl(page.url());

        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(`E2E CapTag Viewer Cap ${RUN_ID}`);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        capabilityUrl = page.url();

        await ctx.close();
    });

    test('Tags related list has no New button for Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(capabilityUrl);
        await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show actions for Tags' })).not.toBeVisible();
    });
});
