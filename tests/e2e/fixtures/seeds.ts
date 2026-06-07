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
        // Apex string literal: escape backslashes first, then single-quotes.
        const json = JSON.stringify(s.payload).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
        const varSuffix = s.label.replace(/[^a-zA-Z0-9_]/g, '_');
        blocks.push(`/* === ${s.label} === */`);
        blocks.push(
            `bcm_ImportController.bcm_ImportResult res_${varSuffix} = ` +
            `bcm_ImportController.importCapabilities('${json}');`,
        );
        blocks.push(
            `if (!res_${varSuffix}.success) ` +
            `throw new System.AssertException('Seed ${s.label} failed: ' + ` +
            `res_${varSuffix}.errorMessage);`,
        );
        if (s.postSeedApex) blocks.push(s.postSeedApex);
    }

    const apex = blocks.join('\n');
    const apexFile = path.resolve(`tests/e2e/.seed_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');
    try {
        execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { stdio: 'inherit' });
    } finally {
        fs.unlinkSync(apexFile);
    }
}
