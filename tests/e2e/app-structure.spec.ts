import { test, expect } from '@playwright/test';
import { APP_PATH, setupAutoDismiss } from './fixtures/helpers';

// ── Editor app nav ────────────────────────────────────────────────────────────

test.describe('App navigation — editor project', () => {
    test('editor sees Maps tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps', exact: true })).toBeVisible();
    });

    test('editor sees Capabilities tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities', exact: true })).toBeVisible();
    });

    test('editor sees Tags tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags', exact: true })).toBeVisible();
    });

    test('editor sees Visualisation tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Visualisation', exact: true })).toBeVisible();
    });

    test('editor does not see an Import tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Import', exact: true })).not.toBeVisible();
    });
});

// ── Viewer app nav ────────────────────────────────────────────────────────────

test.describe('App navigation — viewer project', () => {
    test('viewer sees Maps tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Maps', exact: true })).toBeVisible();
    });

    test('viewer sees Capabilities tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Capabilities', exact: true })).toBeVisible();
    });

    test('viewer sees Tags tab', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto(APP_PATH);
        await expect(page.getByRole('link', { name: 'Tags', exact: true })).toBeVisible();
    });
});

// ── Map list-view actions ─────────────────────────────────────────────────────

test.describe('Map list-view actions — editor project', () => {
    test('JSON Import button on list view opens flow without errors', async ({ page }) => {
        await setupAutoDismiss(page);
        await page.goto('/lightning/o/bcm_Map__c/list?filterName=All');
        await page.getByRole('button', { name: 'JSON Import', exact: true }).click();
        await expect(page.locator('force-user-message-popup, .messageText')).toHaveCount(0);
        await expect(page.frameLocator('iframe').getByLabel('Paste JSON')).toBeVisible({
            timeout: 40000
        });
    });
});
