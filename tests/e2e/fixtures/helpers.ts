import type { Page } from '@playwright/test';
import { getRunId } from './run-id';

export const APP_PATH = '/lightning/app/bcm_BusinessCapabilityMap';
export const RUN_ID = getRunId();

export async function setupAutoDismiss(page: Page) {
    // Strip Salesforce's auto-opening guidance / onboarding overlays before they can mount.
    // Tags like RUNTIME_THP_LEARNING-SIDE-PANEL or SALES_YUKON-* prompt managers wrap themselves
    // in <lightning-focus-trap>, which steals focus and silently closes any open Lightning
    // combobox dropdown — flaking selectMap() across the suite. MutationObserver removes any
    // matching host element on insertion so the focus trap never activates.
    await page.addInitScript(() => {
        const PREFIXES = ['RUNTIME_THP_LEARNING-', 'SALES_YUKON-', 'RUNTIME_IAG_CORE-', 'SALES_PATHWAYS-'];
        const matches = (tag: string) => PREFIXES.some((p) => tag.startsWith(p));
        const strip = (root: ParentNode) => {
            for (const el of Array.from(root.querySelectorAll('*'))) {
                if (matches(el.tagName)) el.remove();
            }
        };
        const start = () => {
            strip(document);
            new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of Array.from(m.addedNodes)) {
                        if (node.nodeType !== 1) continue;
                        const el = node as Element;
                        if (matches(el.tagName)) el.remove();
                        else strip(el);
                    }
                }
            }).observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    });
    // Strip top-of-page promotional banners (Live Preview, security-requirement nags) that
    // appear inline above the global header. They render synchronously enough to overlap
    // combobox open/close timing — addLocatorHandler is too coarse, since it can fire
    // mid-click and steal focus. Match by banner text and remove the closest container with
    // a "Close" link.
    await page.addInitScript(() => {
        const NEEDLES = ['Live Preview is on', 'Salesforce enforces new security requirements'];
        const findBanner = (text: string): Element | null => {
            const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.includes(text)) {
                    let el: Element | null = node.parentElement;
                    while (el && !el.querySelector('a[href*="javascript"]')) el = el.parentElement;
                    return el;
                }
            }
            return null;
        };
        const stripBanners = () => {
            for (const needle of NEEDLES) {
                const el = findBanner(needle);
                if (el) el.remove();
            }
        };
        const start = () => {
            stripBanners();
            new MutationObserver(stripBanners).observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    });
}

export function recordIdFromUrl(url: string): string {
    const match = url.match(/\/([a-zA-Z0-9]{15,18})\/view/);
    if (!match) throw new Error(`Could not extract record ID from URL: ${url}`);
    return match[1];
}
