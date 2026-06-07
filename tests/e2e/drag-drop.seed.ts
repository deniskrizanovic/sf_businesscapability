import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

export const MAP_NAME   = `E2E DragDrop Map ${RUN_ID}`;
export const L1A_NAME   = `Domain DD Alpha ${RUN_ID}`;
export const L1B_NAME   = `Domain DD Beta ${RUN_ID}`;
export const L2A1_NAME  = `Group Alpha One ${RUN_ID}`;
export const L2A2_NAME  = `Group Alpha Two ${RUN_ID}`;
export const L2B1_NAME  = `Group Beta One ${RUN_ID}`;
export const L3A1A_NAME = `Cap Alpha One A ${RUN_ID}`;
export const L3A1B_NAME = `Cap Alpha One B ${RUN_ID}`;

const PAYLOAD = {
    mapName: MAP_NAME,
    mapDescription: '<p>Seeded for drag-drop e2e tests</p>',
    capabilities: [
        {
            externalId: `dd-l1a-${RUN_ID}`, name: L1A_NAME, level: 1, sortOrder: 1,
            definition: '', strategySupport: '', architecturalNuance: '',
            children: [
                {
                    externalId: `dd-l2a1-${RUN_ID}`, name: L2A1_NAME, level: 2, sortOrder: 1,
                    definition: '', strategySupport: '', architecturalNuance: '',
                    children: [
                        { externalId: `dd-l3a1a-${RUN_ID}`, name: L3A1A_NAME, level: 3, sortOrder: 1, definition: '', strategySupport: '', architecturalNuance: '', children: [] },
                        { externalId: `dd-l3a1b-${RUN_ID}`, name: L3A1B_NAME, level: 3, sortOrder: 2, definition: '', strategySupport: '', architecturalNuance: '', children: [] },
                    ],
                },
                {
                    externalId: `dd-l2a2-${RUN_ID}`, name: L2A2_NAME, level: 2, sortOrder: 2,
                    definition: '', strategySupport: '', architecturalNuance: '', children: [],
                },
            ],
        },
        {
            externalId: `dd-l1b-${RUN_ID}`, name: L1B_NAME, level: 1, sortOrder: 2,
            definition: '', strategySupport: '', architecturalNuance: '',
            children: [
                {
                    externalId: `dd-l2b1-${RUN_ID}`, name: L2B1_NAME, level: 2, sortOrder: 1,
                    definition: '', strategySupport: '', architecturalNuance: '', children: [],
                },
            ],
        },
    ],
};

export const dragDropSeed: SeedSpec = {
    label: 'drag-drop',
    payload: PAYLOAD,
};
