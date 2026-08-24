import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RUN_ID, selectMap, openDiagram } from './fixtures/helpers';
import {
    MAP_NAME,
    L1A_NAME,
    L1B_NAME,
    L2A1_NAME,
    L2A2_NAME,
    L3A1A_NAME,
    L3A1B_NAME
} from './drag-drop.seed';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForDragDropSettled(page: import('@playwright/test').Page) {
    // Wait for the save to *begin* (short timeout — no-op gestures never set true; swallow).
    try {
        await page
            .locator('.bcm-canvas-container[data-bcm-saving="true"]')
            .waitFor({ state: 'attached', timeout: 2000 });
    } catch (_) {
        // No-op gesture — saving never flipped to true. Proceed.
    }
    // Then wait for the save to complete.
    await page
        .locator('.bcm-canvas-container[data-bcm-saving="false"]')
        .waitFor({ state: 'attached', timeout: 15000 });
}

function parseDragDropOrder(orgAlias: string, mapName: string, parentName: string): string {
    const apex = `
List<bcm_Capability__c> caps = [
    SELECT Name, bcm_SortOrder__c
    FROM bcm_Capability__c
    WHERE bcm_Map__r.Name = '${mapName}'
      AND bcm_Level__c = 2
      AND bcm_Parent__r.Name = '${parentName}'
    ORDER BY bcm_SortOrder__c ASC
];
String result = '';
for (bcm_Capability__c c : caps) result += c.Name + '|';
System.debug('DRAG_DROP_RESULT:' + result);
`.trim();
    const apexFile = path.resolve(`tests/e2e/.dd_order_${RUN_ID}_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');
    try {
        const out = execFileSync(
            'sf',
            ['apex', 'run', '--file', apexFile, '--target-org', orgAlias],
            { encoding: 'utf-8' }
        );
        // sf echoes the Apex source first, which also contains 'DRAG_DROP_RESULT:' — anchor on
        // the USER_DEBUG log marker to skip the echoed System.debug call line.
        const match = out.match(/USER_DEBUG\|[^|]*\|DEBUG\|DRAG_DROP_RESULT:([^\n]*)/);
        if (!match) throw new Error('DRAG_DROP_RESULT marker not found in apex output');
        // Apex debug log HTML-encodes some chars (e.g. '|' becomes '&#124;').
        return match[1].replace(/&#124;/g, '|').trim();
    } finally {
        fs.unlinkSync(apexFile);
    }
}

function runApex(orgAlias: string, body: string) {
    const apexFile = path.resolve(`tests/e2e/.dd_${RUN_ID}_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, body, 'utf-8');
    try {
        execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], {
            stdio: 'inherit'
        });
    } finally {
        fs.unlinkSync(apexFile);
    }
}

function getOrgAlias(): string {
    const orgAlias = process.env.SF_ORG_ALIAS;
    if (!orgAlias) throw new Error('SF_ORG_ALIAS not set');
    return orgAlias;
}

// ── Drag-drop seed (shared by editor + viewer projects) ───────────────────────

test.describe('Drag-drop seed — editor project', () => {
    test('seed exists', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await expect(page.locator(`[data-node-name="${L1A_NAME}"]`).first()).toBeAttached();
    });

    // ── editor sees drag handles ──────────────────────────────────────────────

    test('editor sees drag handles', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        const handles = page.locator('[data-bcm-drag-handle="true"]');
        const count = await handles.count();
        expect(count).toBeGreaterThan(0);
    });

    // ── L2 reorder within column (gesture) ────────────────────────────────────

    test('L2 reorder within column (gesture)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        await openDiagram(page);
        await selectMap(page, MAP_NAME);

        // Baseline: capture order BEFORE the drag
        const orderBefore = parseDragDropOrder(orgAlias, MAP_NAME, L1A_NAME);
        expect(orderBefore).toContain(L2A1_NAME);
        expect(orderBefore).toContain(L2A2_NAME);

        // Locate L2A1 + L2A2 handles
        const l2a1 = page.locator(`[data-bcm-drag-handle="true"][data-node-level="2"]`).nth(0);
        const l2a2 = page.locator(`[data-bcm-drag-handle="true"][data-node-level="2"]`).nth(1);
        const a1Box = await l2a1.boundingBox();
        const a2Box = await l2a2.boundingBox();
        if (!a1Box || !a2Box) throw new Error('Could not locate L2 handle bounding boxes');

        // Drag L2A1 down past L2A2's midpoint to swap order
        await page.mouse.move(a1Box.x + a1Box.width / 2, a1Box.y + a1Box.height / 2);
        await page.mouse.down();
        const targetY = a2Box.y + a2Box.height + 10;
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
            const yi = a1Box.y + ((targetY - a1Box.y) * i) / steps;
            await page.mouse.move(a1Box.x + a1Box.width / 2, yi);
        }
        await page.mouse.up();

        // Wait for the optimistic re-layout + Apex round-trip to settle
        await waitForDragDropSettled(page);

        // Verify the order CHANGED — gesture must have swapped L2A1 ↔ L2A2
        const orderAfter = parseDragDropOrder(orgAlias, MAP_NAME, L1A_NAME);
        expect(orderAfter).not.toBe(orderBefore);
        expect(orderAfter).toContain(L2A1_NAME);
        expect(orderAfter).toContain(L2A2_NAME);
    });

    // ── L2 reparent across columns (outcome-only) ─────────────────────────────

    test('L2 reparent across columns (outcome)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        runApex(
            orgAlias,
            `
bcm_Capability__c l2 = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L2A2_NAME}' LIMIT 1];
bcm_Capability__c newParent = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L1B_NAME}' LIMIT 1];
l2.bcm_Parent__c = newParent.Id;
l2.bcm_SortOrder__c = 2;
update l2;
`.trim()
        );

        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        // L2A2 should now appear under L1B column area — verify presence
        await expect(page.locator(`[data-node-name="${L2A2_NAME}"]`).first()).toBeAttached();
    });

    // ── L1 reorder (outcome-only) ─────────────────────────────────────────────

    test('L1 reorder (outcome)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        runApex(
            orgAlias,
            `
bcm_Capability__c a = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L1A_NAME}' LIMIT 1];
bcm_Capability__c b = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L1B_NAME}' LIMIT 1];
a.bcm_SortOrder__c = 2;
b.bcm_SortOrder__c = 1;
update new List<bcm_Capability__c>{ a, b };
`.trim()
        );

        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        // Both L1s still visible after reorder
        await expect(page.locator(`[data-node-name="${L1A_NAME}"]`).first()).toBeAttached();
        await expect(page.locator(`[data-node-name="${L1B_NAME}"]`).first()).toBeAttached();
    });

    // ── L3 reorder within L2 (outcome-only) ───────────────────────────────────

    test('L3 reorder within L2 (outcome)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        runApex(
            orgAlias,
            `
bcm_Capability__c a = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L3A1A_NAME}' LIMIT 1];
bcm_Capability__c b = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L3A1B_NAME}' LIMIT 1];
a.bcm_SortOrder__c = 2;
b.bcm_SortOrder__c = 1;
update new List<bcm_Capability__c>{ a, b };
`.trim()
        );

        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        // L3 names render in <text data-node-id ...> (no name attr); query by data-node-id of the cap
        await expect(page.locator('text[data-node-level="3"]').first()).toBeAttached();
    });

    // ── L3 reparent across L2s (outcome-only) ─────────────────────────────────

    test('L3 reparent across L2s (outcome)', async ({ page }) => {
        const orgAlias = getOrgAlias();
        runApex(
            orgAlias,
            `
bcm_Capability__c l3 = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L3A1B_NAME}' LIMIT 1];
bcm_Capability__c newParent = [SELECT Id FROM bcm_Capability__c WHERE Name = '${L2A2_NAME}' LIMIT 1];
l3.bcm_Parent__c = newParent.Id;
l3.bcm_SortOrder__c = 1;
update l3;
`.trim()
        );

        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await expect(page.locator('text[data-node-level="3"]').first()).toBeAttached();
    });
});

// ── Viewer project ────────────────────────────────────────────────────────────

test.describe('Drag-drop — viewer project', () => {
    test('viewer does not see drag handles', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        const count = await page.locator('[data-bcm-drag-handle="true"]').count();
        expect(count).toBe(0);
    });
});
