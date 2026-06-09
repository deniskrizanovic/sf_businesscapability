import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getRunId } from './run-id';

export interface SeedSpec {
    /** Short label used for diagnostic logging only. */
    label: string;
    /** JSON payload accepted by bcm_ImportController.importCapabilities. */
    payload: unknown;
    /** Optional Apex executed AFTER the importer (e.g. flip a flag the importer can't set). */
    postSeedApex?: string;
}

export interface SeedIds {
    /** bcm_Capability__c.Name -> Id, for every Capability whose Name contains the run id. */
    capabilities: Record<string, string>;
    /** bcm_Map__c.Name -> Id, for every Map whose Name contains the run id. */
    maps: Record<string, string>;
    /** bcm_Tag__c.Name -> Id, for every Tag whose Name contains the run id. */
    tags: Record<string, string>;
}

const SEED_IDS_FILE = 'tests/e2e/.seed-ids.json';
const SEED_IDS_MARKER = 'BCM_SEED_IDS:';

/**
 * Run all registered seeds via a single `sf apex run` invocation.
 * Idempotent — bcm_ImportController upserts by externalId. Safe to re-run if a prior run aborted.
 *
 * After seeding, queries every Capability/Map/Tag matching the run id and writes
 * the resulting Name->Id map to tests/e2e/.seed-ids.json so specs can resolve
 * record URLs without per-test `sf data query` round-trips.
 */
export function runAllSeeds(seeds: SeedSpec[]): void {
    if (seeds.length === 0) return;

    const orgAlias = process.env.SF_ORG_ALIAS;
    if (!orgAlias) throw new Error('SF_ORG_ALIAS not set — required for e2e seeding');

    const runId = getRunId();
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
    blocks.push(emitSeedIdsApex(runId));

    const apex = blocks.join('\n');
    const apexFile = path.resolve(`tests/e2e/.seed_${Date.now()}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');
    let stdout: string;
    try {
        stdout = execFileSync(
            'sf',
            ['apex', 'run', '--file', apexFile, '--target-org', orgAlias],
            {
                encoding: 'utf-8',
                env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
                // stderr remains live so apex failures stream to the console; stdout is captured
                // for the BCM_SEED_IDS marker. stdin inherited.
                stdio: ['inherit', 'pipe', 'inherit'],
            },
        );
    } catch (err) {
        // sf prints the actual Apex compile / runtime error on stdout, not stderr.
        // execFileSync attaches captured streams to the thrown error — re-emit so the
        // failure message reaches the developer instead of being swallowed.
        const e = err as { stdout?: Buffer | string };
        if (e.stdout) process.stdout.write(e.stdout.toString());
        throw err;
    } finally {
        fs.unlinkSync(apexFile);
    }
    process.stdout.write(stdout);

    const seedIds = parseSeedIds(stdout);
    fs.writeFileSync(path.resolve(SEED_IDS_FILE), JSON.stringify(seedIds, null, 2), 'utf-8');
}

/**
 * Apex that emits a single System.debug line containing JSON of every record
 * matching the run id. Captured from `sf apex run` stdout.
 */
function emitSeedIdsApex(runId: string): string {
    return `
/* === seed-ids capture === */
Map<String, String> capIds = new Map<String, String>();
for (bcm_Capability__c c : [SELECT Id, Name FROM bcm_Capability__c WHERE Name LIKE '%${runId}%' LIMIT 10000]) {
    capIds.put(c.Name, c.Id);
}
Map<String, String> mapIds = new Map<String, String>();
for (bcm_Map__c m : [SELECT Id, Name FROM bcm_Map__c WHERE Name LIKE '%${runId}%' LIMIT 10000]) {
    mapIds.put(m.Name, m.Id);
}
Map<String, String> tagIds = new Map<String, String>();
for (bcm_Tag__c t : [SELECT Id, Name FROM bcm_Tag__c WHERE Name LIKE '%${runId}%' LIMIT 10000]) {
    tagIds.put(t.Name, t.Id);
}
Map<String, Object> out = new Map<String, Object>{
    'capabilities' => capIds,
    'maps' => mapIds,
    'tags' => tagIds
};
// Base64 the JSON so HTML-entity encoding in debug log output never mangles quotes.
String b64 = EncodingUtil.base64Encode(Blob.valueOf(JSON.serialize(out)));
System.debug('${SEED_IDS_MARKER}' + b64);
`.trim();
}

function parseSeedIds(stdout: string): SeedIds {
    // Anchor on the USER_DEBUG log marker so we skip the echoed Apex source.
    const re = new RegExp(`USER_DEBUG\\|[^|]*\\|DEBUG\\|${SEED_IDS_MARKER}([^\\n]*)`);
    const match = stdout.match(re);
    if (!match) {
        throw new Error(`runAllSeeds: ${SEED_IDS_MARKER} marker not found in apex output`);
    }
    const json = Buffer.from(match[1].trim(), 'base64').toString('utf-8');
    return JSON.parse(json) as SeedIds;
}

/** Read the seed-ids file written by runAllSeeds. */
export function getSeedIds(): SeedIds {
    const raw = fs.readFileSync(path.resolve(SEED_IDS_FILE), 'utf-8');
    return JSON.parse(raw) as SeedIds;
}
