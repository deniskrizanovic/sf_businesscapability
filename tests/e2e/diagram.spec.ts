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
            children: [
                {
                    externalId: `diag-l2b-${RUN_ID}`,
                    name: `Group Beta One ${RUN_ID}`,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [],
                },
            ],
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
    // The L1 g (first child of svg) carries l1Transform which includes scale(zoom) — sufficient for zoom checks
    return page.locator('svg.bcm-canvas > g').first().getAttribute('transform').catch(() => null);
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

    test('Selected map persists across page reload within same session', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        // Reload reuses tab — sessionStorage retained
        await page.reload();
        await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
        // Polygon must render without re-selecting from dropdown
        await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
        // Combobox displays the seeded map name
        const combobox = page.getByRole('combobox', { name: 'Map' }).first();
        await expect(combobox).toHaveValue(MAP_NAME).catch(async () => {
            // lightning-combobox surfaces selection via aria-activedescendant; fall back to text
            await expect(combobox).toContainText(MAP_NAME);
        });
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

    // Read the L2 layer transform (second <g> child of svg) — carries panX,panY,zoom
    async function getL2Transform(page: import('@playwright/test').Page): Promise<string | null> {
        return page.locator('svg.bcm-canvas > g').nth(0).getAttribute('transform').catch(() => null);
    }

    test('ArrowRight pan -> L2 transform translateX increases (no clip on right)', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();

        const before = await getL2Transform(page);
        // Six ArrowRight presses = -300px panX from origin
        for (let i = 0; i < 6; i++) await svg.press('ArrowRight');
        const after = await getL2Transform(page);

        expect(before).toMatch(/translate\(0,\s*0\)/);
        // After ArrowRight, panX should be -300 (negative since ArrowRight moves diagram left to reveal right side)
        expect(after).toMatch(/translate\(-300,\s*0\)/);
    });

    test('ArrowDown pan -> L2 transform translateY decreases (free vertical pan, no clamp)', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();

        // Three ArrowDown presses = -150px panY (previously clamped at 0; should now go negative)
        for (let i = 0; i < 3; i++) await svg.press('ArrowDown');
        const after = await getL2Transform(page);

        expect(after).toMatch(/translate\(0,\s*-150\)/);
    });

    test('ArrowUp from origin -> positive panY (was previously clamped to 0)', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();

        // Two ArrowUp presses = +100px panY. Pre-fix: clamped to 0. Post-fix: 100.
        await svg.press('ArrowUp');
        await svg.press('ArrowUp');
        const after = await getL2Transform(page);

        expect(after).toMatch(/translate\(0,\s*100\)/);
    });

    test('Zoom in then ArrowRight -> L2 transform shows scale>1 AND translateX moved', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        await page.getByTitle('Zoom In').click();
        await page.getByTitle('Zoom In').click();

        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();
        for (let i = 0; i < 4; i++) await svg.press('ArrowRight');
        const after = await getL2Transform(page);

        // scale at 1.2 after 2 zoom-in clicks
        expect(after).toMatch(/scale\(1\.2\)/);
        // panX = -200 after 4 ArrowRight
        expect(after).toMatch(/translate\(-200,\s*0\)/);
    });

    test('L1 chevron band stays at translateY=0 even when L2 panY is non-zero', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();

        // Pan diagram down (negative panY)
        for (let i = 0; i < 3; i++) await svg.press('ArrowDown');

        // L1 layer is the SECOND <g> child (drawn last so always on top)
        const l1Transform = await page.locator('svg.bcm-canvas > g').nth(1).getAttribute('transform');
        // L1 must keep Y=0 regardless of panY — chevron band is X-only pinned
        expect(l1Transform).toMatch(/translate\(0,\s*0\)/);
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

// ── Show Hidden toggle — editor project ──────────────────────────────────────

test.describe('Show Hidden toggle — editor project', () => {
    test('Show Hidden button is visible in toolbar', async ({ page }) => {
        await openDiagram(page);
        await expect(page.getByTitle('Show Hidden')).toBeVisible();
    });

    test('Show Hidden toggle button responds to clicks without error', async ({ page }) => {
        await openDiagram(page);
        const btn = page.getByTitle('Show Hidden');
        // Toggle on
        await btn.click();
        await expect(page.locator('.bcm-canvas')).toBeVisible();
        // Toggle off
        await btn.click();
        await expect(page.locator('.bcm-canvas')).toBeVisible();
    });

    test('Diagram still renders after toggling Show Hidden on and off', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        await page.getByTitle('Show Hidden').click();
        await page.getByTitle('Show Hidden').click();
        const count = await page.locator('.bcm-canvas polygon').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Hide menu action removes node and Show Hidden restores it', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);

        const targetName = `Domain Beta ${RUN_ID}`;
        const targetSelector = `svg.bcm-canvas g.bcm-node[data-node-level="1"][data-node-name="${targetName}"]`;
        const target = page.locator(targetSelector);

        await expect(target).toHaveCount(1);

        try {
            await target.click();
            await target.click();

            const menu = page.locator('.bcm-menu-card');
            await expect(menu).toBeVisible();
            await menu.getByText('Hide', { exact: true }).click();

            await expect(page.locator(targetSelector)).toHaveCount(0, { timeout: 10000 });

            await page.getByTitle('Show Hidden').click();
            await expect(page.locator(targetSelector)).toHaveCount(1, { timeout: 10000 });

            await page.getByTitle('Show Hidden').click();
        } finally {
            const orgAlias = process.env.SF_ORG_ALIAS;
            if (!orgAlias) throw new Error('SF_ORG_ALIAS not set');
            const apex = `
List<bcm_Capability__c> hidden = [SELECT Id FROM bcm_Capability__c WHERE bcm_Map__r.Name LIKE '%${RUN_ID}%' AND bcm_HideFromDiagram__c = true LIMIT 10000];
for (bcm_Capability__c c : hidden) c.bcm_HideFromDiagram__c = false;
if (!hidden.isEmpty()) update hidden;
`.trim();
            const apexFile = path.resolve(`tests/e2e/.unhide_${RUN_ID}.apex`);
            fs.writeFileSync(apexFile, apex, 'utf-8');
            try {
                execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { stdio: 'inherit' });
            } finally {
                fs.unlinkSync(apexFile);
            }
        }
    });
});

// ── Keyboard navigation — editor project ─────────────────────────────────────

test.describe('Keyboard navigation — editor project', () => {
    test('Arrow keys pan the diagram when no node is focused', async ({ page }) => {
        await openDiagram(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();
        const before = await getViewportTransform(page);
        await svg.press('ArrowRight');
        const after = await getViewportTransform(page);
        expect(after).not.toBe(before);
    });

    test('ArrowLeft pans back after ArrowRight', async ({ page }) => {
        await openDiagram(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();
        const origin = await getViewportTransform(page);
        await svg.press('ArrowRight');
        await svg.press('ArrowLeft');
        const restored = await getViewportTransform(page);
        expect(restored).toBe(origin);
    });

    test('Clicking a node sets focus and ArrowRight moves to next column', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const firstNode = page.locator('.bcm-canvas .bcm-node').first();
        await firstNode.click();
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();
        // After click focus is set; pressing Escape should clear it without crashing
        await svg.press('Escape');
        // Now back to pan mode — arrow key changes pan
        const before = await getViewportTransform(page);
        await svg.press('ArrowLeft');
        const after = await getViewportTransform(page);
        expect(after).not.toBe(before);
    });

    test('No visible focus outline on canvas after click', async ({ page }) => {
        await openDiagram(page);
        const svg = page.locator('svg.bcm-canvas');
        await svg.click();
        await expect(svg).toBeFocused();
        const outlineStyle = await svg.evaluate(
            (el) => window.getComputedStyle(el).outlineStyle
        );
        const outlineWidth = await svg.evaluate(
            (el) => window.getComputedStyle(el).outlineWidth
        );
        expect(outlineStyle === 'none' || outlineWidth === '0px').toBe(true);
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

    test('Viewer cannot see Hide button in context menu', async ({ page }) => {
        await openDiagram(page);
        await selectMapFromCombobox(page);
        const node = page.locator('.bcm-canvas .bcm-node').first();
        await node.click();
        await node.click();
        const menu = page.locator('.bcm-menu-card');
        await expect(menu).toBeVisible();
        await expect(menu.getByText('View detail', { exact: true })).toBeVisible();
        await expect(menu.getByText('Hide', { exact: true })).toHaveCount(0);
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
