import { test, expect } from '@playwright/test';
import { RUN_ID, setupAutoDismiss } from './fixtures/helpers';

const SAMPLE_JSON = JSON.stringify({
    mapName: `E2E Import Map ${RUN_ID}`,
    mapDescription: '<p>Imported via e2e test</p>',
    capabilities: [
        {
            externalId: `e2e-l1-${RUN_ID}`,
            name: 'E2E Domain',
            level: 1,
            sortOrder: 1,
            definition: '<p>L1</p>',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `e2e-l2-${RUN_ID}`,
                    name: 'E2E Group',
                    level: 2,
                    sortOrder: 1,
                    definition: '<p>L2</p>',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [
                        {
                            externalId: `e2e-l3-${RUN_ID}`,
                            name: 'E2E Capability',
                            level: 3,
                            sortOrder: 1,
                            definition: '<p>L3</p>',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: [],
                        },
                    ],
                },
            ],
        },
    ],
});

async function createMap(page: import('@playwright/test').Page, name: string): Promise<string> {
    await setupAutoDismiss(page);
    await page.goto('/lightning/o/bcm_Map__c/new');
    await page.getByLabel('Map Name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForURL(/\/view$/);
    return page.url();
}

async function openImportPanel(page: import('@playwright/test').Page, mapUrl: string) {
    await setupAutoDismiss(page);
    await page.goto(mapUrl);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    // Flow screen takes a few seconds to load inside the action panel
    await page.getByLabel('Paste JSON').waitFor({ state: 'visible', timeout: 20000 });
}

// ── Import panel opens ────────────────────────────────────────────────────────

test.describe('Import panel — editor project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, `E2E Import Panel Map ${RUN_ID}`);
        await ctx.close();
    });

    test('Import button opens panel showing Flow Screen 1 with JSON textarea', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        // getByLabel('Paste JSON') already waited in openImportPanel — just assert the Flow's Import button too
        await expect(page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true })).toBeVisible();
    });
});

// ── Successful import ─────────────────────────────────────────────────────────

test.describe('Successful import — editor project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, `E2E Import Holder ${RUN_ID}`);
        await ctx.close();
    });

    test('valid JSON shows success screen with capability count', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        // Click the flow's "Import" button (the last one on the page — action panel button is first)
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.getByText(/Successfully imported \d+ capabilities/)).toBeVisible({ timeout: 30000 });
    });

    test('Close button on success screen dismisses the panel', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        // Panel closed — flow screen no longer visible
        await expect(page.getByLabel('Paste JSON')).not.toBeVisible();
    });

    test('re-import with same JSON completes successfully (idempotent)', async ({ page }) => {
        // First import
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        await page.getByRole('button', { name: 'Close', exact: true }).click();

        // Second import with same JSON
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        await page.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.getByText(/Successfully imported \d+ capabilities/)).toBeVisible({ timeout: 30000 });
    });
});

// ── Error handling ────────────────────────────────────────────────────────────

test.describe('Import error handling — editor project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, `E2E Import Errors Map ${RUN_ID}`);
        await ctx.close();
    });

    test('malformed JSON shows error screen', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill('not valid json {{{');
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        // Error screen shows the errorMessage — not a generic platform error
        await expect(page.getByText(/Invalid JSON/i)).toBeVisible({ timeout: 30000 });
    });

    test('error screen Previous button returns to Screen 1', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill('not valid json {{{');
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        await page.getByRole('button', { name: 'Previous', exact: true }).click();
        await expect(page.getByLabel('Paste JSON')).toBeVisible();
    });
});

// ── Viewer access ─────────────────────────────────────────────────────────────

test.describe('Import panel — viewer project', () => {
    let mapUrl: string;

    test.beforeAll(async ({ browser }) => {
        // Create the map as editor so it exists, then viewer navigates to it
        const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        mapUrl = await createMap(page, `E2E Import Viewer Map ${RUN_ID}`);
        await ctx.close();
    });

    test('viewer clicking Import shows error screen (no crash, no unhandled exception)', async ({ page }) => {
        await openImportPanel(page, mapUrl);
        await page.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await page.locator('lightning-flow').getByRole('button', { name: 'Import', exact: true }).click();
        // AuraHandledException.getMessage() returns 'Script-thrown exception' at runtime —
        // assert the error screen (Previous button) appears rather than matching the message text
        await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeVisible({ timeout: 30000 });
    });
});
