import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { cleanupRuns, findOrphanRunIds, isRunId } from './fixtures/cleanup';

dotenv.config();

export default function globalSetup() {
    const runIdFile = path.resolve('tests/e2e/.run_id');

    // A leftover .run_id means the previous run was killed before globalTeardown ran.
    // Clean it up now — overwriting the file below would orphan its records for good.
    const staleRunIds = fs.existsSync(runIdFile)
        ? [fs.readFileSync(runIdFile, 'utf-8').trim()].filter(isRunId)
        : [];
    // Catch runs whose .run_id was lost (other checkout, overwritten by an overlapping run).
    const orphanRunIds = findOrphanRunIds().filter((id) => !staleRunIds.includes(id));
    const toClean = [...staleRunIds, ...orphanRunIds];
    if (toClean.length > 0) {
        console.log(`globalSetup: cleaning up records from previous runs ${toClean.join(', ')}`);
        cleanupRuns(toClean);
    }

    const runId = Date.now().toString();
    fs.writeFileSync(runIdFile, runId, 'utf-8');

    // Synchronous require() — seed modules read RUN_ID from disk eagerly at module load
    // (via fixtures/helpers.ts -> fixtures/run-id.ts). They MUST load AFTER .run_id is written.
    // Dynamic await import() fails under Playwright's CommonJS TS loader, so use require().
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { runAllSeeds } = require('./fixtures/seeds');
    const { dragDropSeed } = require('./drag-drop.seed');
    const { capabilityDetailSeed } = require('./capability-detail.seed');
    const { diagramSeed } = require('./diagram.seed');
    const { capabilityTagSeed } = require('./capability-tag.seed');
    const { capabilityRelatedListSeed, capabilityRtfSeed } = require('./capability.seed');
    const { viewerReadMapSeed } = require('./map.seed');
    /* eslint-enable @typescript-eslint/no-require-imports */

    runAllSeeds([
        dragDropSeed,
        capabilityDetailSeed,
        diagramSeed,
        capabilityTagSeed,
        capabilityRelatedListSeed,
        capabilityRtfSeed,
        viewerReadMapSeed
    ]);
}
