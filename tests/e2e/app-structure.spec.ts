import { test, expect } from '@playwright/test';
import { APP_PATH, RUN_ID, setupAutoDismiss } from './fixtures/helpers';

async function createMap(
    page: import('@playwright/test').Page,
    name: string
): Promise<string> {
    await setupAutoDismiss(page);
    await page.goto('/lightning/o/bcm_Map__c/new');
    await page.getByLabel('Map Name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForURL(/\/view$/);
    return page.url();
}

// ── Editor app nav ────────────────────────────────────────────────────────────

test.describe('App navigation — editor project', () => {
    test('editor sees Maps tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps', exact: true })).toBeVisible();
    });

    test('editor sees Capabilities tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities', exact: true })).toBeVisible();
    });

    test('editor sees Tags tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags', exact: true })).toBeVisible();
    });

    test('editor does not see a Visualisation tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Visualisation', exact: true })).not.toBeVisible();
    });

    test('editor does not see an Import tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Import', exact: true })).not.toBeVisible();
    });
});

// ── Viewer app nav ────────────────────────────────────────────────────────────

test.describe('App navigation — viewer project', () => {
    test('viewer sees Maps tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps', exact: true })).toBeVisible();
    });

    test('viewer sees Capabilities tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities', exact: true })).toBeVisible();
    });

    test('viewer sees Tags tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags', exact: true })).toBeVisible();
    });
});

// ── Map record page buttons ───────────────────────────────────────────────────

test.describe('Map record page buttons — editor project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        mapUrl = await createMap(page, `E2E AppStructure Map ${RUN_ID}`);
        await page.close();
    });

    test('Visualisation button is visible in highlights panel', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('button', { name: 'Visualisation', exact: true })).toBeVisible();
    });

    test('Import button is visible in highlights panel', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
    });

    test('Visualisation button opens panel without errors', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await page.getByRole('button', { name: 'Visualisation', exact: true }).click();
        await expect(page.locator('force-user-message-popup, .messageText')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    });

    test('Import button opens panel without errors', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.locator('force-user-message-popup, .messageText')).toHaveCount(0);
        await expect(page.getByLabel('Paste JSON')).toBeVisible();
    });
});
