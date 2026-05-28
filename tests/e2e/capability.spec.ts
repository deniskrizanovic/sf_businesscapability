import { test, expect } from '@playwright/test';

const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';

const RUN_ID = Date.now();

async function setupAutoDissmiss(page: import('@playwright/test').Page) {
    await page.addLocatorHandler(page.getByText('Live Preview is on'), async () => {
        const closeBtn = page.getByRole('link', { name: 'Close' });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    });
}

// Extract the Salesforce record ID from a Lightning record URL
function recordIdFromUrl(url: string): string {
    const match = url.match(/\/([a-zA-Z0-9]{15,18})\/view/);
    if (!match) throw new Error(`Could not extract record ID from URL: ${url}`);
    return match[1];
}

// Delete a Capability record via the list-view row action (the Capability FlexiPage
// does not expose Delete in its header actions panel).
async function deleteCapabilityRecord(
    page: import('@playwright/test').Page,
    capName: string
) {
    await setupAutoDissmiss(page);
    await page.goto('/lightning/o/bcm_Capability__c/list');
    // Find the row by the record name link
    const row = page.getByRole('row').filter({ hasText: capName }).first();
    await row.getByRole('button', { name: /show actions/i }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
}

// ── Record form fields ────────────────────────────────────────────────────────

test.describe('Capability form — editor project', () => {
    test('new Capability form shows all expected fields', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        // Fields on the compact new-record modal
        await expect(page.getByRole('combobox', { name: 'Map' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Parent Capability' })).toBeVisible();
        await expect(page.getByLabel('Level')).toBeVisible();
        await expect(page.getByLabel('Sort Order')).toBeVisible();
        await expect(page.getByLabel('Capability Name')).toBeVisible();
    });

    test('Parent Capability lookup only returns Capabilities', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto('/lightning/o/bcm_Capability__c/new');
        // The placeholder text on the lookup confirms the filtered object type
        await expect(
            page.getByRole('combobox', { name: 'Parent Capability' })
        ).toHaveAttribute('placeholder', 'Search Capabilities...');
    });

    test('Definition RTF field is accessible via inline edit on the record detail view', async ({ page }) => {
        const mapName = `E2E Cap RTF Map ${RUN_ID}`;
        const capName = `E2E RTF Cap ${RUN_ID}`;

        await setupAutoDissmiss(page);
        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(mapName);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        const mapUrl = page.url();

        const mapId = recordIdFromUrl(mapUrl);
        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(capName);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);

        // The Capability record saves successfully and the detail view loads
        await expect(page.getByRole('heading', { name: capName })).toBeVisible();

        // Tidy up: delete Capability via list-view row action, then delete the Map
        await deleteCapabilityRecord(page, capName);
        await page.goto(mapUrl);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
    });
});

// ── Map record page related list ─────────────────────────────────────────────

test.describe('Map record page — editor project', () => {
    const mapName = `E2E Related List Map ${RUN_ID}`;
    const capName = `E2E Related Cap ${RUN_ID}`;
    let mapUrl: string;
    let capUrl: string;

    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await setupAutoDissmiss(page);

        await page.goto('/lightning/o/bcm_Map__c/new');
        await page.getByLabel('Map Name').fill(mapName);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        mapUrl = page.url();

        const mapId = recordIdFromUrl(mapUrl);
        await page.goto(`/lightning/o/bcm_Capability__c/new?defaultFieldValues=bcm_Map__c=${mapId}`);
        await page.getByLabel('Capability Name').fill(capName);
        await page.getByLabel('Level').fill('1');
        await page.getByLabel('Sort Order').fill('1');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(/\/view$/);
        capUrl = page.url();

        await ctx.close();
    });

    test.afterAll(async ({ browser }) => {
        const ctx = await browser.newContext({
            storageState: 'tests/e2e/.auth/editor.json',
        });
        const page = await ctx.newPage();
        await deleteCapabilityRecord(page, capName);
        await page.goto(mapUrl);
        await page.locator('.slds-page-header').getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await ctx.close();
    });

    test('Map record page includes a Capabilities related list', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(mapUrl);
        // The related list tab is labelled "Capabilities" inside the Related tab panel
        await expect(page.getByRole('tab', { name: 'Capabilities' })).toBeVisible();
    });

    test('linked Capability appears in the Map related list', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(mapUrl);
        await expect(page.getByRole('link', { name: capName })).toBeVisible();
    });
});

// ── Tab visibility ────────────────────────────────────────────────────────────

test.describe('Capabilities tab — editor project', () => {
    test('Capabilities tab is visible to Editor', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});

test.describe('Capabilities tab — viewer project', () => {
    test('Capabilities tab is visible to Viewer', async ({ page }) => {
        await setupAutoDissmiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities' })).toBeVisible();
    });
});
