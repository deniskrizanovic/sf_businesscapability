import type { FrameLocator, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
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
        const PREFIXES = [
            'RUNTIME_THP_LEARNING-',
            'SALES_YUKON-',
            'RUNTIME_IAG_CORE-',
            'SALES_PATHWAYS-'
        ];
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
    // Strip top-of-page promotional banners (Live Preview, security-requirement nags, and
    // slds-notify_alert system messages) that appear inline above the global header. They
    // render synchronously enough to overlap combobox open/close timing — addLocatorHandler
    // is too coarse, since it can fire mid-click and steal focus. Match by banner text or
    // by SLDS class pattern and remove the element.
    await page.addInitScript(() => {
        const NEEDLES = ['Live Preview is on', 'Salesforce enforces new security requirements'];
        const findBanner = (text: string): Element | null => {
            const walker = document.createTreeWalker(
                document.body || document.documentElement,
                NodeFilter.SHOW_TEXT
            );
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
            // Also strip SLDS notify/alert banners by class — these don't always contain
            // predictable text but steal focus from open comboboxes via position:fixed overlay.
            for (const el of Array.from(
                document.querySelectorAll('.slds-notify_alert.system-message')
            )) {
                el.remove();
            }
        };
        const start = () => {
            stripBanners();
            new MutationObserver(stripBanners).observe(document.documentElement, {
                childList: true,
                subtree: true
            });
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

/**
 * Open the diagram's Map combobox and click the option matching `mapName`.
 *
 * Hardens three known flakes:
 *  - Late-mounting onboarding overlays close the dropdown ~300ms after open;
 *    retry the open + click until the option click sticks.
 *  - Strict-mode violation when two Maps share a Name (parallel-seeding race);
 *    fail with a clear diagnostic citing duplicate seed before clicking.
 *  - Canvas isn't rendered until SVG polygons paint; wait for first polygon.
 */
export async function selectMap(page: Page, mapName: string): Promise<void> {
    const combo = page.getByRole('combobox', { name: 'Map' }).first();
    const option = page.getByRole('option', { name: mapName });

    await expect(async () => {
        await combo.click();
        const count = await option.count();
        if (count > 1) {
            throw new Error(
                `selectMap: ${count} Map options match "${mapName}" — duplicate seed. ` +
                    `Check globalSetup ran exactly once and externalIds in seeds.ts are unique.`
            );
        }
        await option.click({ timeout: 1500 });
    }).toPass({ timeout: 20000, intervals: [500, 1000, 1500] });

    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
}

/**
 * Wait for Salesforce spinner overlays to detach after navigation.
 *
 * SF sandboxes under CI load occasionally leave a spinner overlapping the first
 * interactive element, causing "element not visible / pointer-events: none" flakes.
 * Resolves immediately if none of the selectors are in the DOM; swallows timeout
 * (spinner stuck) so the test can fail with a more descriptive locator error.
 */
export async function drainSpinners(page: Page): Promise<void> {
    const SELECTORS = ['.slds-spinner_container', '.loadingBox', '.forceIconSpinner'];
    await Promise.all(
        SELECTORS.map((sel) =>
            page
                .locator(sel)
                .waitFor({ state: 'hidden', timeout: 15000 })
                .catch(() => {})
        )
    );
}

/**
 * Navigate to a Lightning URL and clear the "Sorry to interrupt — Check your
 * Internet connection" interrupt screen if it appears. Up to 3 attempts.
 *
 * Salesforce sandboxes intermittently render this interrupt page in place of
 * the requested record/app page on first paint. Without recovery the next
 * locator wait fails with a confusing "element not found" against the wrong
 * DOM. Use this any time `page.goto()` lands on a Lightning page.
 *
 * Drains SF spinner overlays before returning so callers can interact
 * immediately after navigation without a separate `drainSpinners` call.
 */
export async function gotoLightning(page: Page, url: string): Promise<void> {
    const interruptBtn = page.getByRole('button', { name: /Refresh|Try Again/ });
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'commit', timeout: 20000 });
        } catch (err) {
            lastErr = err;
            continue;
        }
        // Give the app shell a beat to either render or surface the interrupt.
        await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
        if (await interruptBtn.isVisible().catch(() => false)) {
            await interruptBtn.click().catch(() => {});
            continue;
        }
        await drainSpinners(page);
        return;
    }
    throw lastErr ?? new Error(`gotoLightning: interrupt screen never cleared for ${url}`);
}

/**
 * Navigate to the Visualisation tab and wait for the canvas to mount.
 *
 * Hardens against the Lightning "Sorry to interrupt — Check your Internet
 * connection" dialog that occasionally replaces the app shell on first paint.
 * If detected, click Refresh/Try Again and re-navigate. Up to 3 attempts.
 */
export async function openDiagram(page: Page): Promise<void> {
    await setupAutoDismiss(page);
    const canvas = page.locator('.bcm-canvas');
    const interruptBtn = page.getByRole('button', { name: /Refresh|Try Again/ });

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.goto('/lightning/n/bcm_Visualisation', {
                waitUntil: 'commit',
                timeout: 10000
            });
        } catch (err) {
            lastErr = err;
            continue;
        }
        // Detect interrupt eagerly so we don't burn the canvas waitFor budget on a dead page.
        if (await interruptBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await interruptBtn.click().catch(() => {});
            continue;
        }
        try {
            await canvas.waitFor({ state: 'visible', timeout: 20000 });
            return;
        } catch (err) {
            lastErr = err;
            if (await interruptBtn.isVisible().catch(() => false)) {
                await interruptBtn.click().catch(() => {});
            }
        }
    }
    throw lastErr ?? new Error('openDiagram: canvas never became visible');
}

/**
 * Lightning Flow renders inside an iframe on the list view "JSON Import" panel.
 * `flow(page)` returns the FrameLocator scoped to that iframe.
 */
export const flow = (page: Page): FrameLocator => page.frameLocator('iframe');

const FLOW_SCREEN_BODY = 'flowruntime-lwc-body';

/**
 * Click a Flow Screen button that advances to another screen and wait for the
 * transition to finish.
 *
 * Replaces magic-timeout text matchers (`expect(text).toBeVisible({ timeout: 30000 })`)
 * with the actual transition signal: Lightning Flow re-renders the
 * `<flowruntime-lwc-body>` host between screens, so we capture an element handle
 * to the current body, click, and wait for that exact node to detach. The next
 * `flowruntime-lwc-body` is then waited on before returning so callers can
 * immediately assert against new screen content.
 *
 * Use only for buttons that move between screens (Import, Previous). For terminal
 * buttons that dismiss the panel (Close), call the click directly and assert the
 * panel is gone.
 */
export async function clickFlowNext(page: Page, name: 'Import' | 'Previous'): Promise<void> {
    const body = flow(page).locator(FLOW_SCREEN_BODY).first();
    await body.waitFor({ state: 'attached', timeout: 30000 });
    const handle = await body.elementHandle({ timeout: 5000 });
    await flow(page).getByRole('button', { name, exact: true }).click();
    if (!handle) throw new Error('clickFlowNext: could not capture flowruntime-lwc-body handle');
    await handle.waitForElementState('hidden', { timeout: 30000 });
    await handle.dispose();
    await body.waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * Assert that the given element is not visually clipped by any ancestor.
 *
 * Catches the specific bug where SLDS overlays render under an
 * `overflow: hidden` container that visually crops them even though
 * `getBoundingClientRect()` returns the full layout rect (so `toBeVisible()`
 * would lie).
 *
 * Approach: sample points across the element's rect (top, middle, bottom rows
 * × left, centre, right cols) and use `elementFromPoint` — recursing into
 * shadow roots — to find what actually paints there. Each sample point must
 * resolve to the element itself or one of its descendants. If a sample point
 * is outside the viewport, or hit-tests to an unrelated ancestor/sibling,
 * the element is clipped at that point.
 *
 * `overflow: hidden` clips both paint AND hit-testing for descendants, so
 * `elementFromPoint` is a faithful proxy for "is this pixel actually the
 * element from the user's perspective".
 */
export async function expectNotClippedByAncestor(locator: Locator): Promise<void> {
    const violation = await locator.evaluate((el: Element) => {
        const rect = el.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        // Recursive elementFromPoint that pierces open shadow roots.
        const deepElementFromPoint = (x: number, y: number): Element | null => {
            let scope: Document | ShadowRoot = document;
            let last: Element | null = null;
            for (let i = 0; i < 16; i++) {
                const hit = scope.elementFromPoint(x, y);
                if (!hit || hit === last) return last;
                last = hit;
                if (hit.shadowRoot) {
                    scope = hit.shadowRoot;
                } else {
                    return hit;
                }
            }
            return last;
        };

        const isOrContains = (candidate: Element | null): boolean => {
            if (!candidate) return false;
            // Walk up through parents and shadow hosts looking for `el`.
            let node: Element | null = candidate;
            while (node) {
                if (node === el) return true;
                node =
                    node.parentElement ??
                    (node.getRootNode() instanceof ShadowRoot
                        ? (node.getRootNode() as ShadowRoot).host
                        : null);
            }
            return false;
        };

        // If the element has no layout (dropdown closed before evaluate ran), bail early.
        // Returning a sentinel causes the caller to retry via toPass rather than misfiring
        // sample points at (0,0) which hit whatever happens to be at the origin.
        if (rect.width === 0 && rect.height === 0) {
            return {
                reason: 'element has zero rect — likely closed before evaluate',
                elRect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
            };
        }

        // Sample 9 points: 3 rows × 3 cols, inset 2px from edges.
        const inset = 2;
        const xs = [rect.left + inset, rect.left + rect.width / 2, rect.right - inset];
        const ys = [rect.top + inset, rect.top + rect.height / 2, rect.bottom - inset];

        for (const y of ys) {
            for (const x of xs) {
                if (x < 0 || y < 0 || x > vw || y > vh) {
                    return {
                        reason: 'sample point outside viewport',
                        point: { x, y },
                        viewport: { w: vw, h: vh },
                        elRect: {
                            top: rect.top,
                            bottom: rect.bottom,
                            left: rect.left,
                            right: rect.right
                        }
                    };
                }
                const hit = deepElementFromPoint(x, y);
                if (!isOrContains(hit)) {
                    return {
                        reason: 'sample point hit-tests to unrelated element',
                        point: { x, y },
                        hit: hit
                            ? {
                                  tag: hit.tagName.toLowerCase(),
                                  className: (hit as HTMLElement).className || ''
                              }
                            : null,
                        elRect: {
                            top: rect.top,
                            bottom: rect.bottom,
                            left: rect.left,
                            right: rect.right
                        }
                    };
                }
            }
        }
        return null;
    });
    expect(violation, `Element visually clipped: ${JSON.stringify(violation)}`).toBeNull();
}
