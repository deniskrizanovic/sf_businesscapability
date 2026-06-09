import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME = `E2E Detail Panel Map ${RUN_ID}`;
export const L1_NAME  = `Detail Domain ${RUN_ID}`;
export const L2_NAME  = `Detail Group ${RUN_ID}`;
export const L3_NAME  = `Detail Capability ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for detail-panel e2e</p>',
    capabilities: [
        {
            externalId: `dp-l1-${RUN_ID}`,
            name: L1_NAME,
            level: 1,
            sortOrder: 1,
            definition: '<p>L1 def</p>',
            strategySupport: '<p>L1 strategy</p>',
            architecturalNuance: '<p>L1 nuance</p>',
            children: [
                {
                    externalId: `dp-l2-${RUN_ID}`,
                    name: L2_NAME,
                    level: 2,
                    sortOrder: 1,
                    definition: '<p>L2 def</p>',
                    strategySupport: '<p>L2 strategy</p>',
                    architecturalNuance: '<p>L2 nuance</p>',
                    children: [
                        {
                            externalId: `dp-l3-${RUN_ID}`,
                            name: L3_NAME,
                            level: 3,
                            sortOrder: 1,
                            definition: '<p>L3 def</p>',
                            strategySupport: '<p>L3 strategy</p>',
                            architecturalNuance: '<p>L3 nuance</p>',
                            children: [],
                        },
                    ],
                },
            ],
        },
    ],
};

export const capabilityDetailSeed: SeedSpec = {
    label: 'capability-detail',
    payload: PAYLOAD,
};
