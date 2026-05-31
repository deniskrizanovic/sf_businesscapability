import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RUN_ID, setupAutoDismiss } from './fixtures/helpers';

// ── Seed data ─────────────────────────────────────────────────────────────────
const MAP_NAME = `E2E Diagram Map ${RUN_ID}`;

const SAMPLE_JSON = JSON.stringify({
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for diagram e2e tests</p>',
    capabilities: [
        {
            externalId: `diag-l1a-${RUN_ID}`,
            name: `Domain Alpha ${RUN_ID}`,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `diag-l2a-${RUN_ID}`,
                    name: `Group Alpha One ${RUN_ID}`,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [
                        {
                            externalId: `diag-l3a-${RUN_ID}`,
                            name: `Capability Alpha One One ${RUN_ID}`,
                            level: 3,
                            sortOrder: 1,
                            definition: '',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: [],
                        },
                    ],
                },
            ],
        },
        {
            externalId: `diag-l1b-${RUN_ID}`,
            name: `Domain Beta ${RUN_ID}`,
            level: 1,
            sortOrder: 2,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [],
        },
    ],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openDiagram(page: import('@playwright/test').Page) {
    await setupAutoDismiss(page);
    await page.goto('/lightning/n/bcm_Visualisation');
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
}

async function selectMapFromCombobox(page: import('@playwright/test').Page) {
    await page.getByRole('combobox', { name: 'Map' }).first().click();
    await page.getByRole('option', { name: MAP_NAME }).click({ timeout: 15000 });
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
}

async function getViewportTransform(page: import('@playwright/test').Page): Promise<string | null> {
    return page.locator('svg.bcm-canvas > g').getAttribute('transform').catch(() => null);
}

// ── Map selector — editor project ─────────────────────────────────────────────
// This suite seeds the shared map used by all later suites.

test.describe('Map selector — editor project', () => {
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(180000);
        const ctx  = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

        // Import map + capabilities via list-view JSON Import button (lives in an iframe)
        const flow = page.frameLocator('iframe');
        await page.goto('/lightning/o/bcm_Map__c/list?filterName=All');
        await page.getByRole('button', { name: 'JSON Import', exact: true }).click();
        await flow.getByLabel('Paste JSON').waitFor({ state: 'visible', timeout: 40000 });
        await flow.getByLabel('Paste JSON').fill(SAMPLE_JSON);
        await flow.getByRole('button', { name: 'Import', exact: true }).click();
        await flow.getByText(/Successfully imported \d+ capabilities/).waitFor({ timeout: 90000 });
        await flow.getByRole('button', { name: 'Close', exact: true }).click();

        await ctx.close();
    });

    test('Map combobox is present in diagram toolbar', async ({ page }) => {
        await openDiagram(page);
        await expect(page.getByRole('combobox', { name: 'Map' }).first()).toBeVisible();
    });

    test('Canvas shows no chevrons before a map is selected', async ({ page }) => {
        await openDiagram(page);
        const polygonCount = await page.locator('.bcm-canvas polygon').count();
        expect(polygonCount).toBe(0);
    });
});

// ── Diagram structure — editor project ────────────────────────────────────────

test.describe('Diagram structure — editor project', () => {
    test('L1 domains render as polygon chevrons after map selection', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const count = await page.locator('.bcm-canvas polygon').count();
        expect(count).toBeGreaterThan(0);
    });

    test('L2 boxes render as rect elements after map selection', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const count = await page.locator('.bcm-canvas rect').count();
        expect(count).toBeGreaterThan(0);
    });

    test('L3 bullets render as text elements after map selection', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const bullets = page.locator('svg.bcm-canvas text').filter({ hasText: '•' });
        await expect(bullets.first()).toBeVisible({ timeout: 10000 });
    });
});

// ── Zoom & pan — editor project ───────────────────────────────────────────────

test.describe('Zoom & pan — editor project', () => {
    test('Zoom In button changes viewport transform', async ({ page }) => {
        await openDiagram(page);
        const before = await getViewportTransform(page);
        await page.getByTitle('Zoom In').click();
        const after = await getViewportTransform(page);
        expect(after).not.toBe(before);
    });

    test('Zoom Out button changes viewport transform', async ({ page }) => {
        await openDiagram(page);
        const before = await getViewportTransform(page);
        await page.getByTitle('Zoom Out').click();
        const after = await getViewportTransform(page);
        expect(after).not.toBe(before);
    });

    test('Reset View restores default scale(1)', async ({ page }) => {
        await openDiagram(page);
        await page.getByTitle('Zoom In').click();
        await page.getByTitle('Zoom In').click();
        await page.getByTitle('Reset View').click();
        const transform = await getViewportTransform(page);
        expect(transform).toContain('scale(1)');
    });
});

// ── Tag highlight — editor project ────────────────────────────────────────────

test.describe('Tag highlight — editor project', () => {
    test('Colour by Tag combobox is visible in toolbar', async ({ page }) => {
        await openDiagram(page);
        await expect(page.getByRole('combobox', { name: 'Colour by Tag' }).first()).toBeVisible();
    });

    test('Selecting None in tag dropdown does not crash the diagram', async ({ page }) => {
        await openDiagram(page);
        await page.getByRole('combobox', { name: 'Colour by Tag' }).first().click();
        await page.getByRole('option', { name: 'None' }).click();
        await expect(page.locator('.bcm-canvas')).toBeVisible();
    });
});

// ── Context menu — editor project ─────────────────────────────────────────────

test.describe('Context menu — editor project', () => {
    test('SVG canvas is visible after opening diagram panel', async ({ page }) => {
        await openDiagram(page);
        await expect(page.locator('.bcm-canvas')).toBeVisible();
    });
});

// ── Permission — viewer project ───────────────────────────────────────────────

test.describe('Permission — viewer project', () => {
    test('Viewer sees no drag handle icons on diagram', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/n/bcm_Visualisation');
        await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
        const handles = await page.locator('.bcm-drag-handle').count();
        expect(handles).toBe(0);
    });
});

// ── Teardown — editor project ─────────────────────────────────────────────────

test.describe('Teardown — editor project', () => {
    test.afterAll(() => {
        const orgAlias = process.env.SF_ORG_ALIAS;
        if (!orgAlias) throw new Error('SF_ORG_ALIAS not set');

        const apex = `
List<bcm_Capability__c> caps = [SELECT Id FROM bcm_Capability__c WHERE bcm_Map__r.Name LIKE '%${RUN_ID}%' LIMIT 10000];
if (!caps.isEmpty()) delete caps;
List<bcm_Map__c> maps = [SELECT Id FROM bcm_Map__c WHERE Name LIKE '%${RUN_ID}%' AND Name LIKE '%Diagram%' LIMIT 10000];
if (!maps.isEmpty()) delete maps;
`.trim();

        const apexFile = path.resolve(`tests/e2e/.teardown_diagram_${RUN_ID}.apex`);
        fs.writeFileSync(apexFile, apex, 'utf-8');
        try {
            execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { stdio: 'inherit' });
        } finally {
            fs.unlinkSync(apexFile);
        }
    });

    test('placeholder so afterAll runs', () => { /* intentional */ });
});
