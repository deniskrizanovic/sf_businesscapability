import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

// No imports from helpers.ts / run-id.ts — those read .run_id eagerly at module load, and
// globalSetup calls into this module BEFORE the new .run_id is written.

/** Run ids are Date.now() strings. Anything else is rejected before it reaches Apex. */
const RUN_ID_RE = /^\d{13}$/;

export function isRunId(value: string): boolean {
    return RUN_ID_RE.test(value);
}

/** Every e2e record Name ends with " <RUN_ID>" (see 09-e2e-test-architecture.md §4). */
const RUN_ID_SUFFIX_RE = / (\d{13})$/;

/** Orphan sweep leaves runs younger than this alone — another machine may still be running them. */
export const ORPHAN_MIN_AGE_MS = 2 * 60 * 60 * 1000;

/** Run ids before this (2026-01-01) are not ours; guards against unrelated numeric Names. */
const MIN_PLAUSIBLE_RUN_ID = 1767225600000;

/** Keeps generated SOQL WHERE clauses well under the 100k-char statement limit. */
const RUN_IDS_PER_BATCH = 20;

function requireOrgAlias(): string {
    const orgAlias = process.env.SF_ORG_ALIAS;
    if (!orgAlias) throw new Error('SF_ORG_ALIAS is not set in .env');
    return orgAlias;
}

function likeAny(field: string, runIds: string[]): string {
    return runIds.map((id) => `${field} LIKE '%${id}%'`).join(' OR ');
}

/**
 * Delete every record belonging to the given run ids in FK order:
 * CapabilityTag → Tag → Capability → Map.
 * Tags deleted before Capabilities to avoid cascade-on-Capability interfering with Tag DML
 * in the same transaction.
 */
export function cleanupRuns(runIds: string[]): void {
    if (runIds.length === 0) return;
    for (const id of runIds) {
        if (!isRunId(id)) throw new Error(`cleanupRuns: invalid run id "${id}"`);
    }
    const orgAlias = requireOrgAlias();

    for (let i = 0; i < runIds.length; i += RUN_IDS_PER_BATCH) {
        const batch = runIds.slice(i, i + RUN_IDS_PER_BATCH);
        const apex = `
List<bcm_CapabilityTag__c> ct = [SELECT Id FROM bcm_CapabilityTag__c
    WHERE ${likeAny('bcm_Capability__r.Name', batch)}
       OR ${likeAny('bcm_Capability__r.bcm_Map__r.Name', batch)}
       OR ${likeAny('bcm_Tag__r.Name', batch)} LIMIT 10000];
if (!ct.isEmpty()) delete ct;

List<bcm_Tag__c> tags = [SELECT Id FROM bcm_Tag__c WHERE ${likeAny('Name', batch)} LIMIT 10000];
if (!tags.isEmpty()) delete tags;

List<bcm_Capability__c> caps = [SELECT Id FROM bcm_Capability__c
    WHERE ${likeAny('Name', batch)} OR ${likeAny('bcm_Map__r.Name', batch)} LIMIT 10000];
if (!caps.isEmpty()) delete caps;

List<bcm_Map__c> maps = [SELECT Id FROM bcm_Map__c WHERE ${likeAny('Name', batch)} LIMIT 10000];
if (!maps.isEmpty()) delete maps;
`.trim();

        const apexFile = path.resolve(`tests/e2e/.cleanup_${batch[0]}_${Date.now()}.apex`);
        fs.writeFileSync(apexFile, apex, 'utf-8');
        try {
            execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], {
                stdio: 'inherit'
            });
        } finally {
            fs.unlinkSync(apexFile);
        }
    }
}

function queryNames(orgAlias: string, sobject: string): string[] {
    // SOQL `_` matches exactly one char: Name ends with a space + 13 chars. Regex below narrows
    // that to 13 digits.
    const soql = `SELECT Name FROM ${sobject} WHERE Name LIKE '% _____________' LIMIT 10000`;
    const stdout = execFileSync(
        'sf',
        ['data', 'query', '--query', soql, '--target-org', orgAlias, '--json'],
        {
            encoding: 'utf-8',
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
            stdio: ['inherit', 'pipe', 'inherit']
        }
    );
    const parsed = JSON.parse(stdout) as { result: { records: { Name: string }[] } };
    return parsed.result.records.map((r) => r.Name);
}

/**
 * Find run ids of e2e runs whose teardown never ran (process killed, terminal closed, or a
 * later run overwrote .run_id). A run id is orphaned when a Map/Capability/Tag Name ends in
 * it and it is older than ORPHAN_MIN_AGE_MS.
 */
export function findOrphanRunIds(now = Date.now()): string[] {
    const orgAlias = requireOrgAlias();
    const cutoff = now - ORPHAN_MIN_AGE_MS;
    const ids = new Set<string>();
    for (const sobject of ['bcm_Map__c', 'bcm_Capability__c', 'bcm_Tag__c']) {
        for (const name of queryNames(orgAlias, sobject)) {
            const match = name.match(RUN_ID_SUFFIX_RE);
            if (!match) continue;
            const id = Number(match[1]);
            if (id >= MIN_PLAUSIBLE_RUN_ID && id < cutoff) ids.add(match[1]);
        }
    }
    return [...ids].sort();
}
