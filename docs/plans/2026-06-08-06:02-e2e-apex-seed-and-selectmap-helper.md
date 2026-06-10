# E2e Apex Seed + Shared selectMap Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate two structural sources of e2e flake — duplicate Map seeding when editor + viewer Playwright projects run in parallel, and combobox-snap-shut races caused by inconsistent Map-selection helpers.

**Architecture:** Replace per-spec UI-driven `beforeAll` JSON Import flows with a single Apex-based global seed. Seeds run once in `globalSetup` (before auth.setup, before any project) by invoking `bcm_ImportController.importCapabilities` via `sf apex run`. Each spec exports its seed payload from a co-located `<spec>.seed.ts` module; `fixtures/seeds.ts` aggregates and runs them. A unified `selectMap()` helper in `fixtures/helpers.ts` replaces every raw combobox click — adds option-count assertion and retry on dropdown auto-close.

**Tech Stack:** Playwright 1.x, TypeScript, Salesforce DX (`sf apex run --file`), Apex (`bcm_ImportController.importCapabilities` already implements idempotent externalId upsert).

**Function-point coverage:** No FP table change — pure refactor of test infrastructure. No spec markers move.

---

## E2e changes (per project rule)

| File                                        | Change                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/e2e/fixtures/helpers.ts`             | Add `selectMap(page, mapName)` helper with retry + option-count assertion.                                                                       |
| `tests/e2e/fixtures/seeds.ts` (new)         | Aggregate per-spec seed payloads; run via Apex.                                                                                                  |
| `tests/e2e/global-setup.ts`                 | After writing RUN_ID, invoke aggregated Apex seed.                                                                                               |
| `tests/e2e/drag-drop.spec.ts`               | Remove both UI `beforeAll` blocks; export seed; replace raw combobox clicks with `selectMap()`.                                                  |
| `tests/e2e/capability-detail.spec.ts`       | Same — remove UI seed `beforeAll`; export seed; replace raw combobox click.                                                                      |
| `tests/e2e/diagram.spec.ts`                 | Same — remove UI seed `beforeAll` (incl. cross-cutting flag Apex); export seed (cross-cutting flag folded into payload via post-seed Apex tail). |
| `tests/e2e/drag-drop.seed.ts` (new)         | Exported `SAMPLE_JSON` + name constants.                                                                                                         |
| `tests/e2e/capability-detail.seed.ts` (new) | Same.                                                                                                                                            |
| `tests/e2e/diagram.seed.ts` (new)           | Same + cross-cutting flag SOQL/DML payload.                                                                                                      |

Specs not touched: `app-structure`, `capability`, `capability-tag`, `import`, `map`, `tag`. They either don't seed via JSON Import, or use independent Map/Cap creation flows whose flake risk was rated low in the audit.

---

## File Structure

```
tests/e2e/
├── fixtures/
│   ├── helpers.ts                    # MODIFY: add selectMap()
│   ├── seeds.ts                      # NEW: aggregate + run via Apex
│   ├── auth.setup.ts                 # unchanged
│   └── run-id.ts                     # unchanged
├── global-setup.ts                   # MODIFY: invoke seeds.ts after RUN_ID write
├── global-teardown.ts                # unchanged (already covers seeded data via LIKE %RUN_ID%)
├── drag-drop.seed.ts                 # NEW: SAMPLE_JSON + name constants
├── drag-drop.spec.ts                 # MODIFY: drop beforeAll blocks; import seed; use selectMap
├── capability-detail.seed.ts         # NEW
├── capability-detail.spec.ts         # MODIFY
├── diagram.seed.ts                   # NEW (incl. cross-cutting flag tail Apex)
└── diagram.spec.ts                   # MODIFY
```

Each `*.seed.ts` exports:

- name constants (MAP_NAME etc.) — re-exported from spec for backward use
- a `SeedSpec` object: `{ payload: object, postSeedApex?: string }`

`fixtures/seeds.ts` collects all SeedSpecs and emits one Apex script:

```apex
// For each seed:
bcm_ImportController.importCapabilities('<json escaped>');
// then optional postSeedApex
```

`globalSetup` writes the script to a temp file and runs `sf apex run --file <tmp> --target-org $SF_ORG_ALIAS`. Single invocation. Atomic from Playwright's perspective.

---

### Task 1: Add `selectMap` helper to `fixtures/helpers.ts`

**Files:**

- Modify: `tests/e2e/fixtures/helpers.ts`

- [ ] **Step 1: Append `selectMap` helper at end of `helpers.ts`**

Add to bottom of file (after existing exports):

```ts
import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Open the diagram's Map combobox and click the option matching `mapName`.
 *
 * Hardens three known flakes:
 *  - Late-mounting onboarding overlays close the dropdown ~300ms after open;
 *    retry the open + click until the option click sticks.
 *  - Strict-mode violation when two Maps share a Name (parallel-seeding race);
 *    fail with a clear diagnostic citing duplicate seed *before* clicking.
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/fixtures/helpers.ts
git commit -m "test(e2e): add shared selectMap helper with retry + dup-detection"
```

---

### Task 2: Create `drag-drop.seed.ts` extracting payload from spec

**Files:**

- Create: `tests/e2e/drag-drop.seed.ts`

- [ ] **Step 1: Create `drag-drop.seed.ts` with content moved from spec**

```ts
import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E DragDrop Map ${RUN_ID}`;
export const L1A_NAME = `Domain DD Alpha ${RUN_ID}`;
export const L1B_NAME = `Domain DD Beta ${RUN_ID}`;
export const L2A1_NAME = `Group Alpha One ${RUN_ID}`;
export const L2A2_NAME = `Group Alpha Two ${RUN_ID}`;
export const L2B1_NAME = `Group Beta One ${RUN_ID}`;
export const L3A1A_NAME = `Cap Alpha One A ${RUN_ID}`;
export const L3A1B_NAME = `Cap Alpha One B ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for drag-drop e2e tests</p>',
    capabilities: [
        {
            externalId: `dd-l1a-${RUN_ID}`,
            name: L1A_NAME,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `dd-l2a1-${RUN_ID}`,
                    name: L2A1_NAME,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [
                        {
                            externalId: `dd-l3a1a-${RUN_ID}`,
                            name: L3A1A_NAME,
                            level: 3,
                            sortOrder: 1,
                            definition: '',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: []
                        },
                        {
                            externalId: `dd-l3a1b-${RUN_ID}`,
                            name: L3A1B_NAME,
                            level: 3,
                            sortOrder: 2,
                            definition: '',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: []
                        }
                    ]
                },
                {
                    externalId: `dd-l2a2-${RUN_ID}`,
                    name: L2A2_NAME,
                    level: 2,
                    sortOrder: 2,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: []
                }
            ]
        },
        {
            externalId: `dd-l1b-${RUN_ID}`,
            name: L1B_NAME,
            level: 1,
            sortOrder: 2,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `dd-l2b1-${RUN_ID}`,
                    name: L2B1_NAME,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: []
                }
            ]
        }
    ]
};

export const dragDropSeed: SeedSpec = {
    label: 'drag-drop',
    payload: PAYLOAD
};
```

- [ ] **Step 2: Verify file compiles in isolation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: one error — `Cannot find module './fixtures/seeds'` (resolved in Task 5).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/drag-drop.seed.ts
git commit -m "test(e2e): extract drag-drop seed payload to dedicated module"
```

---

### Task 3: Create `capability-detail.seed.ts`

**Files:**

- Create: `tests/e2e/capability-detail.seed.ts`

- [ ] **Step 1: Create file**

```ts
import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E Detail Panel Map ${RUN_ID}`;
export const L1_NAME = `Detail Domain ${RUN_ID}`;
export const L2_NAME = `Detail Group ${RUN_ID}`;
export const L3_NAME = `Detail Capability ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for detail panel e2e tests</p>',
    capabilities: [
        {
            externalId: `dp-l1-${RUN_ID}`,
            name: L1_NAME,
            level: 1,
            sortOrder: 1,
            definition: '<p>L1 def</p>',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `dp-l2-${RUN_ID}`,
                    name: L2_NAME,
                    level: 2,
                    sortOrder: 1,
                    definition: '<p>L2 def</p>',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [
                        {
                            externalId: `dp-l3-${RUN_ID}`,
                            name: L3_NAME,
                            level: 3,
                            sortOrder: 1,
                            definition: '<p>L3 def</p>',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: []
                        }
                    ]
                }
            ]
        }
    ]
};

export const capabilityDetailSeed: SeedSpec = {
    label: 'capability-detail',
    payload: PAYLOAD
};
```

> NOTE: Verify `definition` HTML matches whatever the existing `capability-detail.spec.ts` SAMPLE_JSON declares (lines 14–47). If different, copy verbatim.

- [ ] **Step 2: Read current SAMPLE_JSON in spec to confirm parity**

Run: `sed -n '12,50p' tests/e2e/capability-detail.spec.ts`
Expected: structure matches the SAMPLE_JSON in the spec — fix divergences (definition strings, child counts) before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/capability-detail.seed.ts
git commit -m "test(e2e): extract capability-detail seed payload"
```

---

### Task 4: Create `diagram.seed.ts` (with cross-cutting flag tail Apex)

**Files:**

- Create: `tests/e2e/diagram.seed.ts`

- [ ] **Step 1: Read current diagram SAMPLE_JSON to copy verbatim**

Run: `sed -n '8,90p' tests/e2e/diagram.spec.ts`
Capture exact payload. The seed file below mirrors the audit summary; reconcile with the spec source of truth.

- [ ] **Step 2: Create `diagram.seed.ts`**

```ts
import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E Diagram Map ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for diagram e2e tests</p>',
    capabilities: [
        // ... copy verbatim from diagram.spec.ts SAMPLE_JSON (lines ~11–88)
    ]
};

// After the import, flip the cross-cutting flag on Foo/Bar.
// Importer does not yet expose bcm_IsCrossCutting__c.
const POST_SEED_APEX = `
List<bcm_Capability__c> cc = [SELECT Id FROM bcm_Capability__c
    WHERE Name IN ('Cross-cutting Foo ${RUN_ID}', 'Cross-cutting Bar ${RUN_ID}')];
for (bcm_Capability__c c : cc) c.bcm_IsCrossCutting__c = true;
update cc;
`.trim();

export const diagramSeed: SeedSpec = {
    label: 'diagram',
    payload: PAYLOAD,
    postSeedApex: POST_SEED_APEX
};
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/diagram.seed.ts
git commit -m "test(e2e): extract diagram seed payload + cross-cutting tail apex"
```

---

### Task 5: Create `fixtures/seeds.ts` aggregator

**Files:**

- Create: `tests/e2e/fixtures/seeds.ts`

- [ ] **Step 1: Create aggregator + Apex runner**

```ts
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

export interface SeedSpec {
    /** Short label used for diagnostic logging only. */
    label: string;
    /** JSON payload accepted by bcm_ImportController.importCapabilities. */
    payload: unknown;
    /** Optional Apex executed AFTER the importer (e.g. flip a flag the importer can't set). */
    postSeedApex?: string;
}

/**
 * Run all registered seeds via a single `sf apex run` invocation.
 * Idempotent — bcm_ImportController upserts by externalId. Safe to re-run if a prior run aborted.
 */
export function runAllSeeds(seeds: SeedSpec[]): void {
    if (seeds.length === 0) return;

    const orgAlias = process.env.SF_ORG_ALIAS;
    if (!orgAlias) throw new Error('SF_ORG_ALIAS not set — required for e2e seeding');

    const blocks: string[] = [];
    for (const s of seeds) {
        // Apex string literal: escape backslashes and single-quotes.
        const json = JSON.stringify(s.payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        blocks.push(`/* === ${s.label} === */`);
        blocks.push(
            `bcm_ImportController.bcm_ImportResult res_${s.label.replace(/[^a-zA-Z0-9_]/g, '_')} = ` +
                `bcm_ImportController.importCapabilities('${json}');`
        );
        blocks.push(
            `if (!res_${s.label.replace(/[^a-zA-Z0-9_]/g, '_')}.success) ` +
                `throw new System.AssertException('Seed ${s.label} failed: ' + ` +
                `res_${s.label.replace(/[^a-zA-Z0-9_]/g, '_')}.errorMessage);`
        );
        if (s.postSeedApex) blocks.push(s.postSeedApex);
    }

    const apex = blocks.join('\n');
    const apexFile = path.resolve(`tests/e2e/.seed_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');
    try {
        execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], {
            stdio: 'inherit'
        });
    } finally {
        fs.unlinkSync(apexFile);
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors related to seed module imports resolve. Any remaining errors are spec-side and resolved in later tasks.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/fixtures/seeds.ts
git commit -m "test(e2e): add seed aggregator that runs bcm_ImportController via sf apex run"
```

---

### Task 6: Wire `globalSetup` to invoke aggregated seed

**Files:**

- Modify: `tests/e2e/global-setup.ts`

- [ ] **Step 1: Replace contents**

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { runAllSeeds } from './fixtures/seeds';
import { dragDropSeed } from './drag-drop.seed';
import { capabilityDetailSeed } from './capability-detail.seed';
import { diagramSeed } from './diagram.seed';

dotenv.config();

export default function globalSetup() {
    const runId = Date.now().toString();
    fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');

    // Seeds resolve RUN_ID at module load time via fixtures/run-id.ts -> fixtures/helpers.ts.
    // Each .seed.ts builds its payload eagerly using that constant; re-importing here is fine
    // because the file we wrote above is what RUN_ID reads from.
    runAllSeeds([dragDropSeed, capabilityDetailSeed, diagramSeed]);
}
```

> CRITICAL: `RUN_ID` is read from disk at module load. The seed modules will be imported BEFORE `fs.writeFileSync` runs because of ES module hoisting. To prevent a stale read, the seed payloads must be built lazily.

- [ ] **Step 2: Convert seeds to lazy payloads**

Refactor each `.seed.ts` to defer payload construction:

In `drag-drop.seed.ts` (and equivalents), replace:

```ts
const PAYLOAD = { mapName: MAP_NAME, ... };
export const dragDropSeed: SeedSpec = { label: 'drag-drop', payload: PAYLOAD };
```

with:

```ts
export const dragDropSeed: SeedSpec = {
    label: 'drag-drop',
    get payload() { return buildPayload(); },
};

function buildPayload() {
    return { mapName: MAP_NAME, ... };  // MAP_NAME read at access time
}
```

But MAP_NAME also reads RUN_ID eagerly. Two cleaner alternatives:

- (a) Convert MAP_NAME to a getter via a function: `export const mapName = () => \`E2E DragDrop Map ${getRunId()}\`;`
- (b) Move `fs.writeFileSync` of RUN_ID **before** the seed-module imports inside globalSetup using a dynamic `import()`:

```ts
export default async function globalSetup() {
    const runId = Date.now().toString();
    fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');

    const { runAllSeeds } = await import('./fixtures/seeds');
    const { dragDropSeed } = await import('./drag-drop.seed');
    const { capabilityDetailSeed } = await import('./capability-detail.seed');
    const { diagramSeed } = await import('./diagram.seed');

    runAllSeeds([dragDropSeed, capabilityDetailSeed, diagramSeed]);
}
```

**Use option (b)** — preserves the existing eager constant style in seed and spec files. No spec rewrites needed for naming.

Final `global-setup.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export default async function globalSetup() {
    const runId = Date.now().toString();
    fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');

    const { runAllSeeds } = await import('./fixtures/seeds');
    const { dragDropSeed } = await import('./drag-drop.seed');
    const { capabilityDetailSeed } = await import('./capability-detail.seed');
    const { diagramSeed } = await import('./diagram.seed');

    runAllSeeds([dragDropSeed, capabilityDetailSeed, diagramSeed]);
}
```

- [ ] **Step 3: Verify dry-run — globalSetup invokes Apex once**

Run: `SF_ORG_ALIAS=$SF_ORG_ALIAS npx playwright test --list 2>&1 | head -20`
Expected: tests listed; no error about missing modules. (`--list` does not run globalSetup; this is a sanity check only.)

To actually exercise globalSetup, run a single trivial test:

Run: `npx playwright test --project=editor app-structure.spec.ts -g "BCM app appears in App Launcher"`
Expected: passes; before passing, observes Apex script execution in stdout (`Compiled successfully.` / `Executed successfully.`).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/global-setup.ts
git commit -m "test(e2e): seed all maps via apex in globalSetup (kills parallel-seed race)"
```

---

### Task 7: Strip `drag-drop.spec.ts` UI seed + adopt `selectMap`

**Files:**

- Modify: `tests/e2e/drag-drop.spec.ts`

- [ ] **Step 1: Replace top-of-file constants and helper with seed import**

Replace lines 1–116 (imports through local `selectMap`) with:

```ts
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RUN_ID, setupAutoDismiss, selectMap } from './fixtures/helpers';
import {
    MAP_NAME,
    L1A_NAME,
    L1B_NAME,
    L2A1_NAME,
    L2A2_NAME,
    L2B1_NAME,
    L3A1A_NAME,
    L3A1B_NAME
} from './drag-drop.seed';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openDiagram(page: import('@playwright/test').Page) {
    await setupAutoDismiss(page);
    await page.goto('/lightning/n/bcm_Visualisation');
    await page.locator('.bcm-canvas').waitFor({ state: 'visible', timeout: 20000 });
}

async function waitForDragDropSettled(page: import('@playwright/test').Page) {
    try {
        await page
            .locator('.bcm-canvas-container[data-bcm-saving="true"]')
            .waitFor({ state: 'attached', timeout: 2000 });
    } catch (_) {
        // No-op gesture — saving never flipped to true. Proceed.
    }
    await page
        .locator('.bcm-canvas-container[data-bcm-saving="false"]')
        .waitFor({ state: 'attached', timeout: 15000 });
}
```

(The remaining helper functions `parseDragDropOrder`, `runApex`, `getOrgAlias` remain unchanged.)

- [ ] **Step 2: Delete the editor-project `beforeAll` block**

Remove lines 176–193 (`test.describe('Drag-drop seed — editor project', () => { test.beforeAll(...) })` body), keeping the surrounding `test.describe` open AND the test bodies. The `seed exists` test (line 195) stays — it now verifies the global seed worked.

The block becomes:

```ts
test.describe('Drag-drop seed — editor project', () => {
    test('seed exists', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        await expect(page.locator(`[data-node-name="${L1A_NAME}"]`).first()).toBeAttached();
    });
    // ... remaining tests, all updated to use selectMap(page, MAP_NAME)
});
```

- [ ] **Step 3: Replace every `await selectMap(page);` (no arg) with `await selectMap(page, MAP_NAME);`**

Sed-style replacement:

```bash
sed -i '' 's/await selectMap(page);/await selectMap(page, MAP_NAME);/g' tests/e2e/drag-drop.spec.ts
```

- [ ] **Step 4: Delete the viewer-project `beforeAll` block + raw combobox click**

Replace the entire `test.describe('Drag-drop — viewer project', () => { ... })` (lines 328–355) with:

```ts
test.describe('Drag-drop — viewer project', () => {
    test('viewer does not see drag handles', async ({ page }) => {
        await openDiagram(page);
        await selectMap(page, MAP_NAME);
        const count = await page.locator('[data-bcm-drag-handle="true"]').count();
        expect(count).toBe(0);
    });
});
```

- [ ] **Step 5: Run the spec under both projects to confirm green**

Run: `npx playwright test drag-drop.spec.ts`
Expected: 10/10 pass (1 setup + 6 editor + 1 viewer + 2 auth-setup tests).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/drag-drop.spec.ts
git commit -m "test(e2e): drop UI seed in drag-drop.spec — use globalSetup + shared selectMap"
```

---

### Task 8: Strip `capability-detail.spec.ts` UI seed + adopt `selectMap`

**Files:**

- Modify: `tests/e2e/capability-detail.spec.ts`

- [ ] **Step 1: Replace top imports with seed import**

Replace existing constants block (the `MAP_NAME`/`L1_NAME`/`L2_NAME`/`L3_NAME` declarations + `SAMPLE_JSON` constant) with:

```ts
import { RUN_ID, setupAutoDismiss, selectMap } from './fixtures/helpers';
import { MAP_NAME, L1_NAME, L2_NAME, L3_NAME } from './capability-detail.seed';
```

Delete the local `SAMPLE_JSON` constant (lines ~13–48).

- [ ] **Step 2: Delete local `selectMap` helper (lines 60–64)**

Remove:

```ts
async function selectMap(page: Page) {
    await page.getByRole('combobox', { name: 'Map' }).first().click();
    await page.getByRole('option', { name: MAP_NAME }).click({ timeout: 15000 });
    await page.locator('.bcm-canvas polygon').first().waitFor({ state: 'visible', timeout: 20000 });
}
```

- [ ] **Step 3: Update all callers**

Replace every `await selectMap(page);` with `await selectMap(page, MAP_NAME);`.

```bash
sed -i '' 's/await selectMap(page);/await selectMap(page, MAP_NAME);/g' tests/e2e/capability-detail.spec.ts
```

- [ ] **Step 4: Delete the seed `beforeAll` block (lines 97–117)**

Replace the entire `test.describe('Detail panel — seed — editor project', () => { ... })` block with **nothing** (delete the wrapping describe and the placeholder test). Global seed handles it.

- [ ] **Step 5: Confirm spec compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Run the spec**

Run: `npx playwright test capability-detail.spec.ts`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/capability-detail.spec.ts
git commit -m "test(e2e): drop UI seed in capability-detail.spec — use globalSetup + shared selectMap"
```

---

### Task 9: Strip `diagram.spec.ts` UI seed + cross-cutting flag Apex + adopt `selectMap`

**Files:**

- Modify: `tests/e2e/diagram.spec.ts`

- [ ] **Step 1: Replace constants + import**

Replace `MAP_NAME` declaration + `SAMPLE_JSON` constant with:

```ts
import { RUN_ID, setupAutoDismiss, selectMap } from './fixtures/helpers';
import { MAP_NAME } from './diagram.seed';
```

Drop the `SAMPLE_JSON` constant (lines ~10–88).

- [ ] **Step 2: Delete local `selectMapFromCombobox` helper (lines 98–102)**

- [ ] **Step 3: Replace callers**

```bash
sed -i '' 's/await selectMapFromCombobox(page);/await selectMap(page, MAP_NAME);/g' tests/e2e/diagram.spec.ts
```

- [ ] **Step 4: Delete the seed `beforeAll` block (lines 113–147)**

The cross-cutting flag Apex inside that `beforeAll` now lives in `diagram.seed.ts:postSeedApex`. Drop the whole `test.beforeAll` body. The first test in the describe (`Map combobox is present in diagram toolbar`, line 149) keeps the `test.describe` open so don't remove the wrapper, only its `beforeAll`.

- [ ] **Step 5: Update Tag highlight raw `getByRole('option', { name: 'None' })` (line 390)**

Wrap with the same retry pattern. Add a small inline helper near the top of the spec (or directly inline):

```ts
const tagFilter = page.getByRole('combobox', { name: /Tag/ }).first();
await expect(async () => {
    await tagFilter.click();
    await page.getByRole('option', { name: 'None' }).click({ timeout: 1500 });
}).toPass({ timeout: 20000, intervals: [500, 1000, 1500] });
```

(Replace the two existing lines opening the Tag combobox + clicking 'None'.)

- [ ] **Step 6: Run the spec**

Run: `npx playwright test diagram.spec.ts`
Expected: all tests pass. Watch for cross-cutting tests (lines 201, 224, 242, 252, 263) — these depend on the flag Apex tail; if they fail, verify `diagram.seed.ts:postSeedApex` ran by inspecting `sf apex run` stdout from globalSetup.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/diagram.spec.ts
git commit -m "test(e2e): drop UI seed in diagram.spec — use globalSetup + shared selectMap"
```

---

### Task 10: Run full e2e suite + clean up

**Files:**

- None (verification only).

- [ ] **Step 1: Full suite, single run, both projects**

Run: `npx playwright test`
Expected: all tests pass. Total runtime should drop noticeably (3 fewer 30–90s UI seed flows).

- [ ] **Step 2: Re-run twice to gauge flake rate**

Run: `for i in 1 2; do echo "=== Run $i ==="; npx playwright test || break; done`
Expected: both runs green. Any failure -> investigate before declaring done.

- [ ] **Step 3: Confirm globalTeardown still cleans seeded data**

Run: `sf data query -q "SELECT COUNT() FROM bcm_Map__c WHERE Name LIKE '%E2E%'" --target-org $SF_ORG_ALIAS`
Expected: 0 rows after teardown.

- [ ] **Step 4: Verify no orphan `.seed_*.apex` temp files left in `tests/e2e/`**

Run: `ls tests/e2e/.seed_*.apex 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 5: Final commit (if any cleanup needed)**

If steps 1–4 surface issues that required fixes, stage and commit them. Otherwise no commit needed for this task.

---

## Out of scope (intentional)

- `capability-tag.spec.ts` UI seeds (3 separate `beforeAll`s creating Maps + Capabilities + Tags via standard record-create UI). Distinct names per describe → no collision today; risk rated low. Migrate later if it starts flaking.
- `import.spec.ts` viewer-side parallel JSON Import. Viewer lacks DML perms so no row contention; the editor-side describe's two-import idempotency test is bcm_ImportController's own coverage area.
- `map.spec.ts` viewer `beforeAll` creating its own Read Map. Distinct name, single creator, no race.
- Apex-side seed perf optimisation (e.g. `Database.upsert` batching). Already efficient.
- Concurrent-org-run collision (Defect C from audit). Solvable with per-developer RUN_ID prefix; defer to follow-up.

---

## Risk register

| Risk                                                                                                                                                      | Mitigation                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bcm_ImportController.importCapabilities` raises `AuraHandledException` for non-`bcm_CanEdit` users; globalSetup runs as the SF CLI's authenticated user. | Verify CLI org user has `bcm_CanEdit`. If not, run script via `--user` or as an integration user. The existing JSON-Import `beforeAll` already proves the CLI user has DML access. |
| Apex literal escape via `JSON.stringify(...).replace(/'/g, "\\'")` may miss edge cases (backslashes in HTML descriptions).                                | Use a deliberate escape pair: backslashes first, then quotes. Already in `runAllSeeds`.                                                                                            |
| Single 200KB+ Apex script hits compile or governor limits.                                                                                                | Three seeds × ~5KB each = ~15KB Apex. Well under the 1MB anon limit.                                                                                                               |
| `globalSetup` failure surfaces as cryptic test errors.                                                                                                    | Apex script halts on `System.AssertException` per seed; `execFileSync` non-zero exit propagates the full Apex stderr to Playwright stdout.                                         |
| Cross-cutting flag tail Apex runs before the importer commits.                                                                                            | Importer commits synchronously inside `bcm_ImportController.importCapabilities`; tail Apex runs in a subsequent statement of the same anon block, sees committed state.            |

Self-review pass: spec coverage ✓ all three flake-prone seeds migrated, helper standardised. No placeholders. Type names consistent (`SeedSpec`, `selectMap(page, mapName)`, `bcm_ImportController.bcm_ImportResult`) across all tasks.
