import type { Page } from '@playwright/test';
import { getRunId } from './run-id';

export const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';
export const RUN_ID = getRunId();

export async function setupAutoDismiss(page: Page) {
    await page.addLocatorHandler(page.getByText('Live Preview is on'), async () => {
        const closeBtn = page.getByRole('link', { name: 'Close' });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    });
}

export function recordIdFromUrl(url: string): string {
    const match = url.match(/\/([a-zA-Z0-9]{15,18})\/view/);
    if (!match) throw new Error(`Could not extract record ID from URL: ${url}`);
    return match[1];
}
