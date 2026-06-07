import type { Page } from '@playwright/test';
import { getRunId } from './run-id';

export const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';
export const RUN_ID = getRunId();

export async function setupAutoDismiss(page: Page) {
    await page.addLocatorHandler(
        page.getByText('Live Preview is on'),
        async (locator) => {
            const banner = locator.locator(
                'xpath=ancestor::*[self::div or self::section][.//a[normalize-space()="Close"]][1]',
            );
            await banner.evaluate((el) => el.remove()).catch(() => {});
        },
        { noWaitAfter: true },
    );
}

export function recordIdFromUrl(url: string): string {
    const match = url.match(/\/([a-zA-Z0-9]{15,18})\/view/);
    if (!match) throw new Error(`Could not extract record ID from URL: ${url}`);
    return match[1];
}
