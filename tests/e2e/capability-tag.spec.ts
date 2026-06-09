import { test, expect } from '@playwright/test';
import { gotoLightning, setupAutoDismiss } from './fixtures/helpers';
import { getSeedIds } from './fixtures/seeds';
import { CAP_NAME, TAG_NAME } from './capability-tag.seed';

// Resolve the seeded Capability's record URL from the seed-ids file written by globalSetup.
function capabilityViewPath(): string {
    const id = getSeedIds().capabilities[CAP_NAME];
    if (!id) throw new Error(`capability-tag seed not found in .seed-ids.json: ${CAP_NAME}`);
    return `/lightning/r/bcm_Capability__c/${id}/view`;
}

// ── Tags related list on Capability record page ───────────────────────────────

test.describe('Capability record page — Tags related list — editor project', () => {
    let capabilityUrl: string;

    test.beforeAll(() => {
        capabilityUrl = capabilityViewPath();
    });

    test('Tags related list is visible in the sidebar', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, capabilityUrl);
        await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    });
});

// ── Junction record CRUD ──────────────────────────────────────────────────────

test.describe('Capability-Tag junction — editor project', () => {
    let capabilityUrl: string;

    test.beforeAll(() => {
        capabilityUrl = capabilityViewPath();
    });

    test('Editor can link a Tag to a Capability and it appears in the sidebar', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, capabilityUrl);

        await page.getByRole('button', { name: 'Show actions for Tags' }).click();
        await page.getByRole('menuitem', { name: 'New' }).click();
        const tagLookup = page.getByRole('combobox', { name: 'Tag' });
        await tagLookup.click();
        await tagLookup.pressSequentially(TAG_NAME.slice(0, 10));
        await expect(page.getByRole('option', { name: TAG_NAME })).toBeVisible();
        await page.getByRole('option', { name: TAG_NAME }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(page.getByRole('link', { name: TAG_NAME })).toBeVisible();
    });
});

// ── Viewer cannot create a junction ──────────────────────────────────────────

test.describe('Capability record page — Tags related list — viewer project', () => {
    let capabilityUrl: string;

    test.beforeAll(() => {
        capabilityUrl = capabilityViewPath();
    });

    test('Tags related list has no New button for Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await gotoLightning(page, capabilityUrl);
        await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show actions for Tags' })).not.toBeVisible();
    });
});
