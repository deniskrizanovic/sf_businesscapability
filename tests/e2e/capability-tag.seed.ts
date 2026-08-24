import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E CapTag Map ${RUN_ID}`;
export const L1_CAP_NAME = `E2E CapTag Domain ${RUN_ID}`;
export const CAP_NAME = `E2E CapTag Cap ${RUN_ID}`;
export const TAG_NAME = `E2E CapTag Tag ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for capability-tag e2e</p>',
    capabilities: [
        {
            externalId: `captag-l1-${RUN_ID}`,
            name: L1_CAP_NAME,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `captag-l2-${RUN_ID}`,
                    name: CAP_NAME,
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

// Importer does not create Tags — provision the Tag via post-seed Apex.
// Colour value '#C8D9CE' is the Green picklist value (see bcm_Colour__c metadata).
// Tag is owned by the editor user so junction-create from the editor session
// passes the cross-reference access check on master-detail save.
const EDITOR_USERNAME = process.env.SF_EDITOR_USERNAME;
if (!EDITOR_USERNAME)
    throw new Error('SF_EDITOR_USERNAME not set — required for capability-tag seed');

// Escape backslash then single-quote for safe interpolation into an Apex/SOQL string literal.
const apexEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const POST_SEED_APEX = `
Id editorUserId = [SELECT Id FROM User WHERE Username = '${apexEscape(EDITOR_USERNAME)}' LIMIT 1].Id;
bcm_Tag__c t = new bcm_Tag__c(Name = '${apexEscape(TAG_NAME)}', bcm_Colour__c = '#C8D9CE');
insert t;
t.OwnerId = editorUserId;
update t;
`.trim();

export const capabilityTagSeed: SeedSpec = {
    label: 'capability-tag',
    payload: PAYLOAD,
    postSeedApex: POST_SEED_APEX
};
