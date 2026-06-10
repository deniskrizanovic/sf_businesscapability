import { test, expect } from '@playwright/test';
import { selectMap, openDiagram } from '../fixtures/helpers';
import { MAP_NAME } from '../diagram.seed';

const CAPTURE_ENABLED = process.env.BCM_CAPTURE === '1';

test.describe('Visual language reference capture — editor project', () => {
    test.skip(!CAPTURE_ENABLED, 'Set BCM_CAPTURE=1 to capture reference PNGs');

    test.beforeEach(async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
    });

    test('default canvas baseline', async ({ page }) => {
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/canvas-baseline.png' });
    });

    test('l1 focused', async ({ page }) => {
        await page.locator('g.bcm-l1').first().click();
        await page.waitForTimeout(200);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/l1-focused.png' });
    });

    test('l2 focused', async ({ page }) => {
        await page.locator('g.bcm-l2').first().click();
        await page.waitForTimeout(200);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/l2-focused.png' });
    });

    test('l3 focused', async ({ page }) => {
        await page.locator('g.bcm-l3-group text').first().click();
        await page.waitForTimeout(200);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/l3-focused.png' });
    });

    test('tag highlighted', async ({ page }) => {
        const tagCombo = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
        await tagCombo.click();
        await page.waitForTimeout(300);
        const firstOption = page.getByRole('option').filter({ hasNotText: 'None' }).first();
        await firstOption.click();
        await page.waitForTimeout(300);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/tag-highlighted.png' });
    });

    test('strategy on', async ({ page }) => {
        const ssToggle = page.locator('[data-id="strategic-support-toggle"]');
        await ssToggle.click();
        await page.waitForTimeout(300);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/strategy-on.png' });
    });

    test('cross-cutting on', async ({ page }) => {
        const ccToggle = page.locator('[data-id="cross-cutting-toggle"]');
        await ccToggle.click();
        await page.waitForTimeout(300);
        await page.locator('.bcm-canvas').screenshot({ path: 'tests/e2e/__visual__/cross-cutting-on.png' });
    });

    test('detail panel open', async ({ page }) => {
        await page.locator('g.bcm-l2').first().click();
        await page.waitForTimeout(500);
        const detailPanel = page.locator('.bcm-detail-panel');
        await expect(detailPanel).toBeVisible();
        await page.screenshot({ path: 'tests/e2e/__visual__/detail-panel-open.png' });
    });
});
