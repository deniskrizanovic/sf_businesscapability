import { test, expect } from '@playwright/test';
import { APP_PATH, setupAutoDismiss } from './fixtures/helpers';
import { getSeedIds } from './fixtures/seeds';
import { RELATED_MAP_NAME, RELATED_CAP_NAME, RTF_CAP_NAME } from './capability.seed';

// ── Record form fields ────────────────────────────────────────────────────────

test.describe('Capability form — editor project', () => {
    test('new Capability form shows all expected fields', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await expect(page.getByRole('combobox', { name: 'Map' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Parent Capability' })).toBeVisible();
        await expect(page.getByLabel('Level')).toBeVisible();
        await expect(page.getByLabel('Sort Order')).toBeVisible();
        await expect(page.getByLabel('Capability Name')).toBeVisible();
    });

    test('Parent Capability lookup only returns Capabilities', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await expect(
            page.getByRole('combobox', { name: 'Parent Capability' })
        ).toHaveAttribute('placeholder', 'Search Capabilities...');
    });

    test('Definition RTF field is accessible via inline edit on the record detail view', async ({ page }) => {
        const id = getSeedIds().capabilities[RTF_CAP_NAME];
        if (!id) throw new Error(`capability-rtf seed not found: ${RTF_CAP_NAME}`);

        await setupAutoDismiss(page);
        await page.goto(`/lightning/r/bcm_Capability__c/${id}/view`);
        await expect(page.getByRole('heading', { name: RTF_CAP_NAME })).toBeVisible();

        // Inline-edit pencil is rendered as a button labelled "Edit Definition" alongside the
        // field — relies on the English field label "Definition" matching the org's user language.
        const editPencil = page.getByRole('button', { name: 'Edit Definition' });
        await expect(editPencil).toBeVisible();
        await editPencil.click();

        // Scope the RTF assertion to the Definition field's ARIA group so other RTF fields on
        // the record page (Strategy Support, Architectural Nuance) cannot satisfy it.
        const definitionGroup = page.getByRole('group', { name: 'Definition' });
        await expect(definitionGroup.getByRole('textbox', { name: 'Definition' }))
            .toBeVisible({ timeout: 10000 });
        await expect(definitionGroup.getByRole('button', { name: 'Bold' }))
            .toBeVisible({ timeout: 5000 });
    });
});

// ── Map record page related list ─────────────────────────────────────────────

test.describe('Map record page — editor project', () => {
    let mapUrl: string;

    test.beforeAll(() => {
        const id = getSeedIds().maps[RELATED_MAP_NAME];
        if (!id) throw new Error(`capability-related-list seed not found: ${RELATED_MAP_NAME}`);
        mapUrl = `/lightning/r/bcm_Map__c/${id}/view`;
    });

    test('Map record page includes a Capabilities related list', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('tab', { name: 'Capabilities' })).toBeVisible();
    });

    test('linked Capability appears in the Map related list', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('link', { name: RELATED_CAP_NAME })).toBeVisible();
    });
});

// ── Tab visibility ────────────────────────────────────────────────────────────

test.describe('Capabilities tab — editor project', () => {
    test('Capabilities tab is visible to Editor', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});

test.describe('Capabilities tab — viewer project', () => {
    test('Capabilities tab is visible to Viewer', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});
