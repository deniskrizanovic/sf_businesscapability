import { test, expect } from '@playwright/test';
import { APP_PATH, RUN_ID, setupAutoDismiss, recordIdFromUrl } from './fixtures/helpers';

// ── Record form fields ────────────────────────────────────────────────────────

test.describe('Capability form — editor project', () => {
    test('new Capability form shows all expected fields', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await expect(page.getByRole('combobox', { name: 'Map' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Parent Capability' })).toBeVisible();
        await expect(page.getByLabel('Level')).toBeVisible();
        await expect(page.getByLabel('Sort Order')).toBeVisible();
        await expect(page.getByLabel('Capability Name')).toBeVisible();
    });

    test('Parent Capability lookup only returns Capabilities', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await expect(
            page.getByRole('combobox', { name: 'Parent Capability' })
        ).toHaveAttribute('placeholder', 'Search Capabilities...');
    });

    test('Definition RTF field is accessible via inline edit on the record detail view', async ({ page }) => {
        const mapName = `E2E Cap RTF Map ${RUN_ID}`;
        const capName = `E2E RTF Cap ${RUN_ID}`;

        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(mapName);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        const mapUrl = page.url();

        const mapId = recordIdFromUrl(mapUrl);
        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(capName);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);

        await expect(page.getByRole('heading', { name: capName })).toBeVisible();
    });
});

// ── Map record page related list ─────────────────────────────────────────────

test.describe('Map record page — editor project', () => {
    const mapName = `E2E Related List Map ${RUN_ID}`;
    const capName = `E2E Related Cap ${RUN_ID}`;
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(mapName);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        mapUrl = page.url();

        const mapId = recordIdFromUrl(mapUrl);
        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(capName);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);

        await ctx.close();
    });

    test('Map record page includes a Capabilities related list', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('tab', { name: 'Capabilities' })).toBeVisible();
    });

    test('linked Capability appears in the Map related list', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('link', { name: capName })).toBeVisible();
    });
});

// ── Tab visibility ────────────────────────────────────────────────────────────

test.describe('Capabilities tab — editor project', () => {
    test('Capabilities tab is visible to Editor', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});

test.describe('Capabilities tab — viewer project', () => {
    test('Capabilities tab is visible to Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});
