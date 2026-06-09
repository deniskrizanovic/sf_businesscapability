import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E Diagram Map ${RUN_ID}`;
export const DIAGRAM_TAG_NAME = `Diagram Tag ${RUN_ID}`;
const DIAGRAM_TAG_COLOUR     = '#B8E0C8';
const DIAGRAM_TAG_CAP_NAME   = `Capability Alpha One One ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for diagram e2e tests</p>',
    capabilities: [
        {
            externalId: `diag-l1a-${RUN_ID}`,
            name: `Domain Alpha ${RUN_ID}`,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `diag-l2a-${RUN_ID}`,
                    name: `Group Alpha One ${RUN_ID}`,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [
                        {
                            externalId: `diag-l3a-${RUN_ID}`,
                            name: `Capability Alpha One One ${RUN_ID}`,
                            level: 3,
                            sortOrder: 1,
                            definition: '',
                            strategySupport: '',
                            architecturalNuance: '',
                            children: [],
                        },
                    ],
                },
            ],
        },
        {
            externalId: `diag-l1b-${RUN_ID}`,
            name: `Domain Beta ${RUN_ID}`,
            level: 1,
            sortOrder: 2,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [
                {
                    externalId: `diag-l2b-${RUN_ID}`,
                    name: `Group Beta One ${RUN_ID}`,
                    level: 2,
                    sortOrder: 1,
                    definition: '',
                    strategySupport: '',
                    architecturalNuance: '',
                    children: [],
                },
            ],
        },
        {
            externalId: `diag-l1cc-${RUN_ID}`,
            name: `Cross-cutting Foo ${RUN_ID}`,
            level: 1,
            sortOrder: 3,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [],
        },
        {
            externalId: `diag-l1cc2-${RUN_ID}`,
            name: `Cross-cutting Bar ${RUN_ID}`,
            level: 1,
            sortOrder: 4,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [],
        },
    ],
};

// After the import, flip the cross-cutting flag on Foo/Bar.
// Importer does not yet expose bcm_IsCrossCutting__c.
const EDITOR_USERNAME = process.env.SF_EDITOR_USERNAME;
if (!EDITOR_USERNAME) throw new Error('SF_EDITOR_USERNAME not set — required for diagram seed');

const apexEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const POST_SEED_APEX = `
{
    List<bcm_Capability__c> cc = [SELECT Id FROM bcm_Capability__c
        WHERE Name IN ('Cross-cutting Foo ${RUN_ID}', 'Cross-cutting Bar ${RUN_ID}')];
    for (bcm_Capability__c c : cc) c.bcm_IsCrossCutting__c = true;
    update cc;

    Id editorUserId = [SELECT Id FROM User WHERE Username = '${apexEscape(EDITOR_USERNAME)}' LIMIT 1].Id;
    bcm_Tag__c t = new bcm_Tag__c(Name = '${apexEscape(DIAGRAM_TAG_NAME)}', bcm_Colour__c = '${DIAGRAM_TAG_COLOUR}');
    insert t;
    t.OwnerId = editorUserId;
    update t;

    bcm_Capability__c tagged = [SELECT Id FROM bcm_Capability__c
        WHERE Name = '${apexEscape(DIAGRAM_TAG_CAP_NAME)}' LIMIT 1];
    insert new bcm_CapabilityTag__c(bcm_Capability__c = tagged.Id, bcm_Tag__c = t.Id);
}
`.trim();

export const diagramSeed: SeedSpec = {
    label: 'diagram',
    payload: PAYLOAD,
    postSeedApex: POST_SEED_APEX,
};
