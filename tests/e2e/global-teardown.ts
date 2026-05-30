import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

export default function globalTeardown() {
    const orgAlias = process.env.SF_ORG_ALIAS;
    if (!orgAlias) throw new Error('SF_ORG_ALIAS is not set in .env');

    const runIdFile = path.resolve('tests/e2e/.run_id');
    if (!fs.existsSync(runIdFile)) return;

    const runId = fs.readFileSync(runIdFile, 'utf-8').trim();

    // Delete in FK order: CapabilityTag → Capability → Tag → Map
    const apex = `
List<bcm_Map__c> mapsToDelete = [SELECT Id FROM bcm_Map__c WHERE Name LIKE '%${runId}%' LIMIT 10000];
Set<Id> mapIds = new Map<Id, bcm_Map__c>(mapsToDelete).keySet();

List<bcm_CapabilityTag__c> ct = [SELECT Id FROM bcm_CapabilityTag__c
    WHERE bcm_Capability__r.Name LIKE '%${runId}%'
       OR bcm_Capability__r.bcm_Map__c IN :mapIds
       OR bcm_Tag__r.Name LIKE '%${runId}%' LIMIT 10000];
if (!ct.isEmpty()) delete ct;

List<bcm_Capability__c> caps = [SELECT Id FROM bcm_Capability__c
    WHERE Name LIKE '%${runId}%' OR bcm_Map__c IN :mapIds LIMIT 10000];
if (!caps.isEmpty()) delete caps;

List<bcm_Tag__c> tags = [SELECT Id FROM bcm_Tag__c WHERE Name LIKE '%${runId}%' LIMIT 10000];
if (!tags.isEmpty()) delete tags;

if (!mapsToDelete.isEmpty()) delete mapsToDelete;
`.trim();

    const apexFile = path.resolve(`tests/e2e/.teardown_${runId}.apex`);
    fs.writeFileSync(apexFile, apex, 'utf-8');

    try {
        execFileSync('sf', ['apex', 'run', '--file', apexFile, '--target-org', orgAlias], { stdio: 'inherit' });
    } finally {
        fs.unlinkSync(apexFile);
        fs.unlinkSync(runIdFile);
    }
}
