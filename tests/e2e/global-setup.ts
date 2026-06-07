import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export default function globalSetup() {
    const runId = Date.now().toString();
    fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');

    // Synchronous require() — seed modules read RUN_ID from disk eagerly at module load
    // (via fixtures/helpers.ts -> fixtures/run-id.ts). They MUST load AFTER .run_id is written.
    // Dynamic await import() fails under Playwright's CommonJS TS loader, so use require().
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { runAllSeeds } = require('./fixtures/seeds');
    const { dragDropSeed } = require('./drag-drop.seed');
    const { capabilityDetailSeed } = require('./capability-detail.seed');
    const { diagramSeed } = require('./diagram.seed');
    /* eslint-enable @typescript-eslint/no-require-imports */

    runAllSeeds([dragDropSeed, capabilityDetailSeed, diagramSeed]);
}
