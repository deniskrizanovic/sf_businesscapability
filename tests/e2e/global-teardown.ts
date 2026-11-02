import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { cleanupRuns } from './fixtures/cleanup';

dotenv.config();

export default function globalTeardown() {
    if (!process.env.SF_ORG_ALIAS) throw new Error('SF_ORG_ALIAS is not set in .env');

    const runIdFile = path.resolve('tests/e2e/.run_id');
    if (!fs.existsSync(runIdFile)) return;

    const runId = fs.readFileSync(runIdFile, 'utf-8').trim();

    try {
        cleanupRuns([runId]);
    } finally {
        fs.unlinkSync(runIdFile);
    }
}
