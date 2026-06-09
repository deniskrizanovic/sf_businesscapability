import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

// Map + Capability used by the "Map record page — related list" suite in capability.spec.ts.
export const RELATED_MAP_NAME = `E2E Related List Map ${RUN_ID}`;
export const RELATED_CAP_NAME = `E2E Related Cap ${RUN_ID}`;

const RELATED_PAYLOAD = {
    mapName: RELATED_MAP_NAME,
    mapDescription: '<p>Seeded for capability related-list e2e</p>',
    capabilities: [
        {
            externalId: `cap-related-l1-${RUN_ID}`,
            name: RELATED_CAP_NAME,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [],
        },
    ],
};

export const capabilityRelatedListSeed: SeedSpec = {
    label: 'capability-related-list',
    payload: RELATED_PAYLOAD,
};

// Map + Capability used by the "RTF inline edit" test in capability.spec.ts.
// Definition starts empty so the test can assert the inline-edit save persists new content.
export const RTF_MAP_NAME = `E2E Cap RTF Map ${RUN_ID}`;
export const RTF_CAP_NAME = `E2E RTF Cap ${RUN_ID}`;

const RTF_PAYLOAD = {
    mapName: RTF_MAP_NAME,
    mapDescription: '<p>Seeded for RTF inline-edit e2e</p>',
    capabilities: [
        {
            externalId: `cap-rtf-l1-${RUN_ID}`,
            name: RTF_CAP_NAME,
            level: 1,
            sortOrder: 1,
            definition: '',
            strategySupport: '',
            architecturalNuance: '',
            children: [],
        },
    ],
};

export const capabilityRtfSeed: SeedSpec = {
    label: 'capability-rtf',
    payload: RTF_PAYLOAD,
};
