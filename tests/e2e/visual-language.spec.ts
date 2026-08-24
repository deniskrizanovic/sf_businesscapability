import { test, expect } from '@playwright/test';
import { selectMap, openDiagram } from './fixtures/helpers';
import { MAP_NAME, STRATEGY_CAP_NAME } from './diagram.seed';

// Mirrored from c/bcm_VisualTokens (regression check, not imported)
const EXPECTED_L1_FILL = '#ebebeb';
const EXPECTED_L1_STROKE = '#e0e0e0';
const EXPECTED_L2_STROKE = '#e0e0e0';
const EXPECTED_TAG_FALLBACK = '#ffffff';
const EXPECTED_FOCUS_RING = '#0070D2';
const EXPECTED_BAND_RAMP = ['#f7f7f7', '#ececec', '#e0e0e0', '#d4d4d4'];
const EXPECTED_STRATEGY_FILL_RGB = 'rgb(194, 155, 61)'; // #c29b3d

test.describe('Visual language regression — editor project', () => {
    test.beforeEach(async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
    });

    test('L1 chevron renders with new tokens', async ({ page }) => {
        const l1Polygon = page.locator('.bcm-l1 polygon').first();
        await expect(l1Polygon).toBeVisible();

        const fill = await l1Polygon.getAttribute('fill');
        const stroke = await l1Polygon.getAttribute('stroke');

        expect(fill).toBe(EXPECTED_L1_FILL);
        expect(stroke).toBe(EXPECTED_L1_STROKE);
    });

    test('L2 box renders with new tokens', async ({ page }) => {
        const l2Rect = page.locator('.bcm-l2 rect').first();
        await expect(l2Rect).toBeVisible();

        const fill = await l2Rect.getAttribute('fill');
        const stroke = await l2Rect.getAttribute('stroke');

        // L2 without tag uses BCM_TAG_FALLBACK
        expect(fill).toBe(EXPECTED_TAG_FALLBACK);
        expect(stroke).toBe(EXPECTED_L2_STROKE);
    });

    test('Cross-cutting band first chevron renders with new band ramp', async ({ page }) => {
        // Toggle cross-cutting on
        const ccToggle = page.getByTestId('cross-cutting-toggle');
        await ccToggle.click();

        const bandPolygon = page.locator('.bcm-band-node polygon').first();
        await expect(bandPolygon).toBeVisible();

        const fill = await bandPolygon.getAttribute('fill');
        expect(EXPECTED_BAND_RAMP).toContain(fill);
    });

    test('Strategic Support marked node renders strategy mark glyph with token fill', async ({
        page
    }) => {
        // Toggle strategic support on
        const ssToggle = page.getByTestId('strategic-support-toggle');
        await ssToggle.click();

        // Strategy mark glyph should be visible
        const strategyStripe = page.locator('.bcm-strategy-stripe').first();
        await expect(strategyStripe).toBeVisible();

        // Check computed fill from CSS custom property
        const computedFill = await strategyStripe.evaluate((el) => getComputedStyle(el).fill);
        expect(computedFill).toBe(EXPECTED_STRATEGY_FILL_RGB);
    });

    test('Focused L2 stroke matches focus ring token', async ({ page }) => {
        const l2Rect = page.locator('.bcm-l2 rect').first();
        await expect(l2Rect).toBeVisible();

        // Capture baseline fill
        const fillBefore = await l2Rect.getAttribute('fill');

        // Click to focus
        await l2Rect.click();

        // Focus ring applied to stroke
        await expect(l2Rect).toHaveAttribute('stroke', EXPECTED_FOCUS_RING);

        // Single-channel focus — fill unchanged
        await expect(l2Rect).toHaveAttribute('fill', fillBefore);
    });
});
