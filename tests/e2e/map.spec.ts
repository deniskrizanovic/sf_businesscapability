import { test, expect } from '@playwright/test';
import { APP_PATH, RUN_ID, setupAutoDismiss, gotoLightning } from './fixtures/helpers';
import { getSeedIds } from './fixtures/seeds';
import { VIEWER_READ_MAP_NAME } from './map.seed';

async function createMap(page: import('@playwright/test').Page, name: string): Promise<string> {
    await setupAutoDismiss(page);
    await gotoLightning(page, '/lightning/o/bcm_Map__c/new');
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
    });

    test('editor edits a Map record name', async ({ page }) => {
        const before = `E2E Map Edit Before ${RUN_ID}`;
        const after = `E2E Map Edit After ${RUN_ID}`;
        await createMap(page, before);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('Map Name').fill(after);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByRole('heading', { name: after })).toBeVisible();
    });

    test('editor deletes a Map record', async ({ page }) => {
        await createMap(page, `E2E Map Delete ${RUN_ID}`);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.waitForSelector('.slds-page-header', { state: 'visible' });
        await expect(
            page.getByRole('link', { name: `E2E Map Delete ${RUN_ID}` })
        ).not.toBeVisible();
    });
});

// ── Viewer access ────────────────────────────────────────────────────────────

test.describe('Map access — viewer project', () => {
    let mapUrl: string;

    test.beforeAll(() => {
        const id = getSeedIds().maps[VIEWER_READ_MAP_NAME];
        if (!id) throw new Error(`viewer-read-map seed not found: ${VIEWER_READ_MAP_NAME}`);
        mapUrl = `/lightning/r/bcm_Map__c/${id}/view`;
    });

    test('viewer can read a Map record', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, mapUrl);
        await expect(page.getByRole('heading', { name: VIEWER_READ_MAP_NAME })).toBeVisible();
    });

    test('viewer cannot create a Map record — no New button', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, '/lightning/o/bcm_Map__c/list');
        await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
    });

    test('viewer cannot edit a Map record — no Edit button', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, mapUrl);
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible();
    });
});

// ── App Launcher and tab visibility ─────────────────────────────────────────

test.describe('BCM app — editor project', () => {
    test('BCM app appears in App Launcher', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, '/lightning/o/bcm_Map__c/home');
        await page.getByRole('button', { name: 'App Launcher' }).click();
        await expect(
            page
                .getByRole('heading', { name: 'Business Capability Map' })
                .or(
                    page
                        .locator('p.slds-text-heading_small, .appTileTitle')
                        .getByText('Business Capability Map')
                )
                .first()
        ).toBeVisible({ timeout: 15000 });
    });

    test('Maps tab is visible to Editor', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps' })).toBeVisible();
    });

    test('Maps tab navigates to the Maps list', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, APP_PATH);
        await page.getByRole('link', { name: 'Maps' }).click();
        await expect(page).toHaveURL(/bcm_Map__c/);
    });
});

test.describe('BCM app — viewer project', () => {
    test('Maps tab is visible to Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps' })).toBeVisible();
    });
});
