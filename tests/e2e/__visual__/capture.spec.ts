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
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/canvas-baseline.png' });
    });

    test('l1 focused', async ({ page }) => {
        const l1 = page.locator('g.bcm-l1').first();
        await l1.click();
        await expect(l1).toHaveAttribute('data-focused', 'true');
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/l1-focused.png' });
    });

    test('l2 focused', async ({ page }) => {
        const l2 = page.locator('g.bcm-l2').first();
        await l2.click();
        await expect(l2).toHaveAttribute('data-focused', 'true');
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/l2-focused.png' });
    });

    test('l3 focused', async ({ page }) => {
        const l3Text = page.locator('g.bcm-l3-group text').first();
        await l3Text.click();
        await expect(l3Text).toHaveAttribute('data-focused', 'true');
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/l3-focused.png' });
    });

    test('tag highlighted', async ({ page }) => {
        const tagCombo = page.getByRole('combobox', { name: 'Colour by Tag' }).first();
        await tagCombo.click();
        const firstOption = page.getByRole('option').filter({ hasNotText: 'None' }).first();
        await expect(firstOption).toBeVisible();
        await firstOption.click();
        await expect(firstOption).not.toBeVisible();
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/tag-highlighted.png' });
    });

    test('strategy on', async ({ page }) => {
        const ssToggle = page.getByTestId('strategic-support-toggle');
        await ssToggle.click();
        await expect(page.locator('.bcm-strategy-stripe').first()).toBeVisible();
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/strategy-on.png' });
    });

    test('cross-cutting on', async ({ page }) => {
        const ccToggle = page.getByTestId('cross-cutting-toggle');
        await ccToggle.click();
        await expect(page.locator('.bcm-band-node').first()).toBeVisible();
        await page
            .locator('.bcm-canvas')
            .screenshot({ path: 'tests/e2e/__visual__/cross-cutting-on.png' });
    });

    test('detail panel open', async ({ page }) => {
        await page.locator('g.bcm-l2').first().click();
        const detailPanel = page.locator('.bcm-detail-panel');
        await expect(detailPanel).toBeVisible();
        // Wait for slide-in CSS transition (250ms) to settle before capturing
        await expect
            .poll(
                () =>
                    detailPanel.evaluate((p: HTMLElement) =>
                        Math.round(new DOMMatrixReadOnly(getComputedStyle(p).transform).m41)
                    ),
                { timeout: 2000 }
            )
            .toBe(0);
        await page.screenshot({ path: 'tests/e2e/__visual__/detail-panel-open.png' });
    });
});
