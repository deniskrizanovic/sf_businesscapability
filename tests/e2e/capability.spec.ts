import { test, expect } from '@playwright/test';

const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';

// ── Record form fields ────────────────────────────────────────────────────────

test.describe('Capability form — editor project', () => {
    test('new Capability form shows all expected fields', async ({ page }) => {
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await expect(page.getByLabel('Map')).toBeVisible();
        await expect(page.getByLabel('Parent Capability')).toBeVisible();
        await expect(page.getByLabel('Level')).toBeVisible();
        await expect(page.getByLabel('Sort Order')).toBeVisible();
        await expect(page.getByLabel('External ID')).toBeVisible();
        await expect(page.getByLabel('Definition')).toBeVisible();
        await expect(page.getByLabel('Strategy Support')).toBeVisible();
        await expect(page.getByLabel('Architectural Nuance')).toBeVisible();
    });

    test('Parent Capability lookup only returns Capabilities', async ({ page }) => {
        await page.goto('/lightning/o/bcm_Capability__c/new');
        await page.getByLabel('Parent Capability').click();
        // The lookup magnifier opens a search — assert the object label in the search dialog
        const lookupDialog = page.getByRole('dialog');
        await expect(lookupDialog.getByText('Capabilities')).toBeVisible();
    });

    test('Definition field renders formatted text after save', async ({ page, browser }) => {
        // Need a Map to attach the Capability to — create one as editor
        const mapCtx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const mapPage = await mapCtx.newPage();
        await mapPage.goto('/lightning/o/bcm_Map__c/new');
        await mapPage.getByLabel('Map Name').fill('E2E Cap RTF Map');
        await mapPage.getByRole('button', { name: 'Save' }).click();
        await mapPage.waitForURL(/\/view$/);
        const mapUrl = mapPage.url();
        const mapId = mapUrl.match(/\/([a-zA-Z0-9]{15,18})\/view/)?.[1];
        await mapCtx.close();

        await page.goto('/lightning/o/bcm_Capability__c/new');
        await page.getByLabel('Map').fill('E2E Cap RTF Map');
        await page.getByRole('option', { name: 'E2E Cap RTF Map' }).click();
        await page.getByLabel('Capability Name').fill('RTF Cap');

        const rtfFrame = page.frameLocator('iframe[title*="Definition"]').first();
        await rtfFrame.locator('body').fill('**Bold definition text**');

        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForURL(/\/view$/);

        // Verify the Definition field rendered (iframe content or rich text output area)
        await expect(page.locator('.slds-rich-text-editor__output').first()).toBeVisible();

        // Tidy up
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const editorCtx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const cleanPage = await editorCtx.newPage();
        await cleanPage.goto(mapUrl);
        await cleanPage.getByRole('button', { name: 'Delete' }).click();
        await cleanPage.getByRole('button', { name: 'Delete', exact: true }).click();
        await editorCtx.close();
    });
});

// ── Map record page related list ─────────────────────────────────────────────

test.describe('Map record page — editor project', () => {
    let mapUrl: string;
    let capUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill('E2E Related List Map');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForURL(/\/view$/);
        mapUrl = page.url();

        await page.goto('/lightning/o/bcm_Capability__c/new');
        await page.getByLabel('Map').fill('E2E Related List Map');
        await page.getByRole('option', { name: 'E2E Related List Map' }).click();
        await page.getByLabel('Capability Name').fill('E2E Related Cap');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForURL(/\/view$/);
        capUrl = page.url();

        await ctx.close();
    });

    test.afterAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await page.goto(capUrl);
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.goto(mapUrl);
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await ctx.close();
    });

    test('Map record page includes a Capabilities related list', async ({ page }) => {
        await page.goto(mapUrl);
        await expect(page.getByText('Capabilities')).toBeVisible();
    });

    test('linked Capability appears in the Map related list', async ({ page }) => {
        await page.goto(mapUrl);
        await expect(page.getByRole('link', { name: 'E2E Related Cap' })).toBeVisible();
    });
});

// ── Tab visibility ────────────────────────────────────────────────────────────

test.describe('Capabilities tab — editor project', () => {
    test('Capabilities tab is visible to Editor', async ({ page }) => {
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});

test.describe('Capabilities tab — viewer project', () => {
    test('Capabilities tab is visible to Viewer', async ({ page }) => {
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});
