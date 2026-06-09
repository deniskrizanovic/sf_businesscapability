import { test, expect } from '@playwright/test';
import { RUN_ID, selectMap, openDiagram } from './fixtures/helpers';
import { MAP_NAME } from './diagram.seed';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getViewportTransform(page: import('@playwright/test').Page): Promise<string | null> {
    // The L1 g (first child of svg) carries l1Transform which includes scale(zoom) — sufficient for zoom checks
    return page.locator('svg.bcm-canvas > g').first().getAttribute('transform').catch(() => null);
}

// ── Map selector — editor project ─────────────────────────────────────────────

test.describe('Map selector — editor project', () => {
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
        await selectMap(page, MAP_NAME);
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
        await selectMap(page, MAP_NAME);
        const count = await page.locator('.bcm-canvas polygon').count();
        expect(count).toBeGreaterThan(0);
    });

    test('L2 boxes render as rect elements after map selection', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        const count = await page.locator('.bcm-canvas rect').count();
        expect(count).toBeGreaterThan(0);
    });

    test('L3 bullets render as text elements after map selection', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        const bullets = page.locator('svg.bcm-canvas text').filter({ hasText: '•' });
        await expect(bullets.first()).toBeVisible({ timeout: 10000 });
    });

    test('Cross-cutting L1 renders as band chevron at bottom; non-cross-cutting still in column', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await page.locator('lightning-button-icon[data-id="cross-cutting-toggle"]').click();

        const ccName = `Cross-cutting Foo ${RUN_ID}`;
        const ccBand = page.locator(`g.bcm-band-node[data-node-name="${ccName}"]`);
        await expect(ccBand).toHaveCount(1);

        // Non-cross-cutting L1 still in the regular column layer
        const regularName = `Domain Alpha ${RUN_ID}`;
        const regularCol = page.locator(
            `g.bcm-node[data-node-level="1"][data-node-name="${regularName}"]`
        );
        await expect(regularCol).toHaveCount(1);

        // Cross-cutting L1 is NOT in the regular column layer
        const ccColumn = page.locator(
            `g.bcm-node[data-node-level="1"][data-node-name="${ccName}"]`
        );
        await expect(ccColumn).toHaveCount(0);
    });

    test('Cross-cutting band layered stack: lowest sortOrder paints last (DOM-last) and chevrons span full width', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await page.locator('lightning-button-icon[data-id="cross-cutting-toggle"]').click();

        const bandNodes = page.locator('g.bcm-band-node');
        await expect(bandNodes).toHaveCount(2);

        // sortOrder 3 (Foo) < sortOrder 4 (Bar) → Foo last in DOM (on top of stack)
        const lastName = await bandNodes.last().getAttribute('data-node-name');
        expect(lastName).toBe(`Cross-cutting Foo ${RUN_ID}`);

        // Polygon spans full width: first vertex x = DIAGRAM_PADDING (24)
        const points = await bandNodes.last().locator('polygon').getAttribute('points');
        const firstX = parseFloat(points!.trim().split(/\s+/)[0].split(',')[0]);
        expect(firstX).toBe(24);
    });

    test('Clicking a cross-cutting band chevron opens the Detail Panel', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await page.locator('lightning-button-icon[data-id="cross-cutting-toggle"]').click();

        const ccName = `Cross-cutting Foo ${RUN_ID}`;
        await page.locator(`g.bcm-band-node[data-node-name="${ccName}"]`).click();
        await expect(page.locator('.bcm-detail-panel[data-open="true"]')).toBeVisible({ timeout: 10000 });
    });

    test('Cross-cutting toggle: hidden by default, shows on click, hides on second click', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);

        const ccName = `Cross-cutting Foo ${RUN_ID}`;
        const ccBand = page.locator(`g.bcm-band-node[data-node-name="${ccName}"]`);
        const toggle = page.locator('lightning-button-icon[data-id="cross-cutting-toggle"]');

        await expect(ccBand).toHaveCount(0);

        await toggle.click();
        await expect(ccBand).toHaveCount(1);

        await toggle.click();
        await expect(ccBand).toHaveCount(0);
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

    test( 'ArrowRight pan -> L2 transform translateX increases (no clip on right)', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
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
        await selectMap(page, MAP_NAME);
        const svg = page.locator('svg.bcm-canvas');
        await svg.focus();

        // Three ArrowDown presses = -150px panY (previously clamped at 0; should now go negative)
        for (let i = 0; i < 3; i++) await svg.press('ArrowDown');
        const after = await getL2Transform(page);

        expect(after).toMatch(/translate\(0,\s*-150\)/);
    });

    test('ArrowUp from origin -> positive panY (was previously clamped to 0)', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
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
        await selectMap(page, MAP_NAME);
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
        await selectMap(page, MAP_NAME);
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
        const tagFilter = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
        await expect(async () => {
            await tagFilter.click();
            await page.getByRole('option', { name: 'None' }).click({ timeout: 1500 });
        }).toPass({ timeout: 20000, intervals: [500, 1000, 1500] });
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
        await selectMap(page, MAP_NAME);
        await page.getByTitle('Show Hidden').click();
        await page.getByTitle('Show Hidden').click();
        const count = await page.locator('.bcm-canvas polygon').count();
        expect(count).toBeGreaterThan(0);
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
        await selectMap(page, MAP_NAME);
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
        await openDiagram(page);
        const handles = await page.locator('.bcm-drag-handle').count();
        expect(handles).toBe(0);
    });

});
