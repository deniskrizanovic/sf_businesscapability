import { test, expect, type Page } from '@playwright/test';
import { RUN_ID } from './fixtures/helpers';

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

// List view actions in Lightning open inside an iframe — all flow-content selectors must go through this
const flow = (page: Page) => page.frameLocator('iframe');

async function openImportPanel(page: Page) {
    await page.goto('/lightning/o/bcm_Map__c/list?filterName=All');
    await page.getByRole('button', { name: 'JSON Import', exact: true }).click();
    // Sandbox can take >20s to render the flow screen inside the iframe
    await flow(page).getByLabel('Paste JSON').waitFor({ state: 'visible', timeout: 40000 });
}

// ── Import panel opens ────────────────────────────────────────────────────────

test.describe('Import panel — editor project', () => {
    test('JSON Import button opens panel showing Flow Screen 1 with JSON textarea', async ({ page }) => {
        await openImportPanel(page);
        await expect(flow(page).getByRole('button', { name: 'Import', exact: true })).toBeVisible();
    });
});

// ── Successful import ─────────────────────────────────────────────────────────

test.describe('Successful import — editor project', () => {
    test('valid JSON shows success screen with capability count', async ({ page }) => {
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await expect(flow(page).getByText(/Successfully imported \d+ capabilities/)).toBeVisible({ timeout: 30000 });
    });

    test('Close button on success screen dismisses the panel', async ({ page }) => {
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await flow(page).getByRole('button', { name: 'Close', exact: true }).click();
        await expect(flow(page).getByLabel('Paste JSON')).not.toBeVisible();
    });

    test('re-import with same JSON completes successfully (idempotent)', async ({ page }) => {
        // First import
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await flow(page).getByRole('button', { name: 'Close', exact: true }).click();

        // Second import with same JSON
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await expect(flow(page).getByText(/Successfully imported \d+ capabilities/)).toBeVisible({ timeout: 30000 });
    });
});

// ── Error handling ────────────────────────────────────────────────────────────

test.describe('Import error handling — editor project', () => {
    test('malformed JSON shows error screen', async ({ page }) => {
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill('not valid json {{{');
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await expect(flow(page).getByText(/Invalid JSON/i)).toBeVisible({ timeout: 30000 });
    });

    test('error screen Previous button returns to Screen 1', async ({ page }) => {
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill('not valid json {{{');
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        await flow(page).getByRole('button', { name: 'Previous', exact: true }).click();
        await expect(flow(page).getByLabel('Paste JSON')).toBeVisible();
    });
});

// ── Viewer access ─────────────────────────────────────────────────────────────

test.describe('Import panel — viewer project', () => {
    test('viewer clicking Import shows error screen (no crash, no unhandled exception)', async ({ page }) => {
        await openImportPanel(page);
        await flow(page).getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow(page).getByRole('button', { name: 'Import', exact: true }).click();
        // AuraHandledException.getMessage() returns 'Script-thrown exception' at runtime —
        // assert the error screen (Previous button) appears rather than matching the message text
        await expect(flow(page).getByRole('button', { name: 'Previous', exact: true })).toBeVisible({ timeout: 30000 });
    });
});
