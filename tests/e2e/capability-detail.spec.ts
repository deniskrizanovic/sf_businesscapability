import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RUN_ID, setupAutoDismiss } from './fixtures/helpers';

// ── Seed data ─────────────────────────────────────────────────────────────────
const MAP_NAME = `E2E Detail Panel Map ${RUN_ID}`;
const L1_NAME  = `Detail Domain ${RUN_ID}`;
const L2_NAME  = `Detail Group ${RUN_ID}`;
const L3_NAME  = `Detail Capability ${RUN_ID}`;

const SAMPLE_JSON = JSON.stringify({
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for detail-panel e2e</p>',
    capabilities: [
        {
            externalId: `dp-l1-${RUN_ID}`,
            name: L1_NAME,
            level: 1,
            sortOrder: 1,
            definition: '<p>L1 def</p>',
            strategySupport: '<p>L1 strategy</p>',
            architecturalNuance: '<p>L1 nuance</p>',
            children: [
                {
                    externalId: `dp-l2-${RUN_ID}`,
                    name: L2_NAME,
                    level: 2,
                    sortOrder: 1,
                    definition: '<p>L2 def</p>',
                    strategySupport: '<p>L2 strategy</p>',
                    architecturalNuance: '<p>L2 nuance</p>',
                    children: [
                        {
                            externalId: `dp-l3-${RUN_ID}`,
                            name: L3_NAME,
                            level: 3,
                            sortOrder: 1,
                            definition: '<p>L3 def</p>',
                            strategySupport: '<p>L3 strategy</p>',
                            architecturalNuance: '<p>L3 nuance</p>',
                            children: [],
                        },
                    ],
                },
            ],
        },
    ],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openDiagram(page: Page) {
    await setupAutoDismiss(page);
    await page.goto('/lightning/n/bcm_Visualisation');
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
}

async function selectMap(page: Page) {
    await page.getByRole('combobox', { name: 'Map' }).first().click();
    await page.getByRole('option', { name: MAP_NAME }).click({ timeout: 15000 });
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
}

async function openDetailPanelOnL1(page: Page) {
    const node = page.locator(`svg.bcm-canvas g.bcm-node[data-node-level="1"][data-node-name="${L1_NAME}"]`);
    await node.click();
    await node.click();
    const menu = page.locator('.bcm-menu-card');
    await expect(menu).toBeVisible();
    await menu.getByText('View detail', { exact: true }).click();
    const panel = page.locator('.bcm-detail-panel[data-open="true"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    return panel;
}

async function openDetailPanelOnL2(page: Page) {
    // Click the L2 label text (header) to avoid hitting L3 bullet text overlapping the same rect
    const label = page.locator(`svg.bcm-canvas g.bcm-node[data-node-level="2"][data-node-name="${L2_NAME}"] > text`).first();
    await label.click();
    await label.click();
    const menu = page.locator('.bcm-menu-card');
    await expect(menu).toBeVisible();
    await menu.getByText('View detail', { exact: true }).click();
    const panel = page.locator('.bcm-detail-panel[data-open="true"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    return panel;
}

async function openDetailPanelOnL3(page: Page) {
    // L3 wrapped names render as multiple <text> lines sharing data-node-name; click first line
    const text = page.locator(`svg.bcm-canvas text[data-node-level="3"][data-node-name="${L3_NAME}"]`).first();
    await text.click();
    await text.click();
    const menu = page.locator('.bcm-menu-card');
    await expect(menu).toBeVisible();
    await menu.getByText('View detail', { exact: true }).click();
    const panel = page.locator('.bcm-detail-panel[data-open="true"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    return panel;
}

// ── Seed once for the whole spec ──────────────────────────────────────────────

test.describe('Detail panel — seed — editor project', () => {
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(180000);
        const ctx  = await browser.newContext({ storageState: 'tests/e2e/.auth/editor.json' });
        const page = await ctx.newPage();
        await setupAutoDismiss(page);

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

    test('seed placeholder', () => { /* triggers beforeAll */ });
});

// ── FP29 scenarios — editor project ───────────────────────────────────────────

test.describe('Detail panel — open and close — editor project', () => {
    test('View detail opens panel with capability name in header', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        await expect(panel.locator('.bcm-detail-name')).toHaveText(L2_NAME);
    });

    test('Close button dismisses the detail panel', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        await openDetailPanelOnL2(page);
        await page.locator('.bcm-detail-close button').click();
        await expect(page.locator('.bcm-detail-panel[data-open="true"]')).toHaveCount(0, { timeout: 5000 });
    });

    test('Escape key closes the detail panel', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        await openDetailPanelOnL2(page);
        await page.keyboard.press('Escape');
        await expect(page.locator('.bcm-detail-panel[data-open="true"]')).toHaveCount(0, { timeout: 5000 });
    });

    test('Switching nodes updates panel content without closing', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        await openDetailPanelOnL2(page);
        // Open detail on L1 while panel still open
        const l1 = page.locator(`svg.bcm-canvas g.bcm-node[data-node-level="1"][data-node-name="${L1_NAME}"]`);
        await l1.click();
        await l1.click();
        const menu = page.locator('.bcm-menu-card');
        await expect(menu).toBeVisible();
        await menu.getByText('View detail', { exact: true }).click();
        const panel = page.locator('.bcm-detail-panel[data-open="true"]');
        await expect(panel).toBeVisible();
        await expect(panel.locator('.bcm-detail-name')).toHaveText(L1_NAME, { timeout: 5000 });
    });
});

test.describe('Detail panel — breadcrumb + level badge — editor project', () => {
    test('Panel breadcrumb shows one segment for L1', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL1(page);
        const segs = panel.locator('.bcm-detail-breadcrumb-segment');
        await expect(segs).toHaveCount(1);
        await expect(segs.nth(0)).toContainText(L1_NAME);
    });

    test('Panel breadcrumb shows two segments for L2', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        const segs = panel.locator('.bcm-detail-breadcrumb-segment');
        await expect(segs).toHaveCount(2);
        await expect(segs.nth(0)).toContainText(L1_NAME);
        await expect(segs.nth(1)).toContainText(L2_NAME);
    });

    test('Panel breadcrumb reflects full ancestor path for L3', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL3(page);
        const segs = panel.locator('.bcm-detail-breadcrumb-segment');
        await expect(segs).toHaveCount(3);
        await expect(segs.nth(0)).toContainText(L1_NAME);
        await expect(segs.nth(1)).toContainText(L2_NAME);
        await expect(segs.nth(2)).toContainText(L3_NAME);
    });

    test('Panel shows correct level badge', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        await expect(panel.locator('.bcm-detail-level-badge')).toHaveText('L2');
    });
});

test.describe('Detail panel — fields — editor project', () => {
    test('Panel displays all expected fields', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        const labels = panel.locator('.bcm-detail-field-label');
        await expect(labels).toHaveCount(4);
        const labelTexts = await labels.allTextContents();
        expect(labelTexts).toEqual(
            expect.arrayContaining(['Definition', 'Strategy Support', 'Architectural Nuance', 'Hide From Diagram'])
        );
    });
});

// ── FP30 scenarios — editor project ───────────────────────────────────────────

test.describe('Detail panel — edit + save — editor project', () => {
    test('Editor sees Edit button and can enter edit mode', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        const editBtn = panel.locator('.bcm-detail-edit button');
        await expect(editBtn).toBeVisible();
        await editBtn.click();
        await expect(panel.locator('.bcm-detail-save')).toBeVisible();
        await expect(panel.locator('.bcm-detail-cancel')).toBeVisible();
        await expect(panel.locator('.bcm-detail-input-name')).toBeVisible();
    });

    test('Save persists name change and refreshes diagram', async ({ page }) => {
        const newName = `${L2_NAME} EDITED`;
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        await panel.locator('.bcm-detail-edit button').click();
        const nameInput = panel.locator('.bcm-detail-input-name input');
        await nameInput.fill(newName);
        await panel.locator('.bcm-detail-save button').click();
        // Panel returns to read mode showing new name
        await expect(panel.locator('.bcm-detail-name')).toHaveText(newName, { timeout: 10000 });
        // Diagram L2 box reflects new label
        await expect(
            page.locator(`svg.bcm-canvas g.bcm-node[data-node-level="2"][data-node-name="${newName}"]`)
        ).toBeVisible({ timeout: 10000 });

        // Reset name back so this test is idempotent for re-runs
        await panel.locator('.bcm-detail-edit button').click();
        await panel.locator('.bcm-detail-input-name input').fill(L2_NAME);
        await panel.locator('.bcm-detail-save button').click();
        await expect(panel.locator('.bcm-detail-name')).toHaveText(L2_NAME, { timeout: 10000 });
    });

    test('Cancel reverts unsaved name change', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        await panel.locator('.bcm-detail-edit button').click();
        const nameInput = panel.locator('.bcm-detail-input-name input');
        await nameInput.fill('Unsaved Garbage');
        await panel.locator('.bcm-detail-cancel button').click();
        // Back in read mode with original name
        await expect(panel.locator('.bcm-detail-name')).toHaveText(L2_NAME);
        // Edit button visible again
        await expect(panel.locator('.bcm-detail-edit')).toBeVisible();
    });
});

// ── FP30 viewer regression — viewer project ───────────────────────────────────

test.describe('Detail panel — viewer no-edit — viewer project', () => {
    test('Viewer sees no Edit/Save/Cancel buttons in panel', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page);
        const panel = await openDetailPanelOnL2(page);
        await expect(panel.locator('.bcm-detail-edit')).toHaveCount(0);
        await expect(panel.locator('.bcm-detail-save')).toHaveCount(0);
        await expect(panel.locator('.bcm-detail-cancel')).toHaveCount(0);
    });
});

// ── Teardown — editor project ─────────────────────────────────────────────────

test.describe('Detail panel — teardown — editor project', () => {
    test.afterAll(() => {
        const orgAlias = process.env.SF_ORG_ALIAS;
        if (!orgAlias) throw new Error('SF_ORG_ALIAS not set');

        const apex = `
List<bcm_Capability__c> caps = [SELECT Id FROM bcm_Capability__c WHERE bcm_Map__r.Name = '${MAP_NAME}' LIMIT 10000];
if (!caps.isEmpty()) delete caps;
List<bcm_Map__c> maps = [SELECT Id FROM bcm_Map__c WHERE Name = '${MAP_NAME}' LIMIT 10000];
if (!maps.isEmpty()) delete maps;
`.trim();

        const apexFile = path.resolve(`tests/e2e/.teardown_detail_${RUN_ID}.apex`);
        fs.writeFileSync(apexFile, apex, 'utf-8');
        try {
            execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { stdio: 'inherit' });
        } finally {
            fs.unlinkSync(apexFile);
        }
    });

    test('teardown placeholder', () => { /* triggers afterAll */ });
});
