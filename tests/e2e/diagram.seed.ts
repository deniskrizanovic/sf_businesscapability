import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E Diagram Map ${RUN_ID}`;

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
const POST_SEED_APEX = `
List<bcm_Capability__c> cc = [SELECT Id FROM bcm_Capability__c
    WHERE Name IN ('Cross-cutting Foo ${RUN_ID}', 'Cross-cutting Bar ${RUN_ID}')];
for (bcm_Capability__c c : cc) c.bcm_IsCrossCutting__c = true;
update cc;
`.trim();

export const diagramSeed: SeedSpec = {
    label: 'diagram',
    payload: PAYLOAD,
    postSeedApex: POST_SEED_APEX,
};
