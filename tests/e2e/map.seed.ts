import { RUN_ID } from './fixtures/helpers';
import type { SeedSpec } from './fixtures/seeds';

// Map used by the "Map access — viewer project" suite in map.spec.ts.
// No Capabilities required — test only asserts read access from a viewer session.
export const VIEWER_READ_MAP_NAME = `E2E Viewer Read Map ${RUN_ID}`;

const PAYLOAD = {
    mapName: VIEWER_READ_MAP_NAME,
    mapDescription: '<p>Seeded for viewer read-access e2e</p>',
    capabilities: [],
};

export const viewerReadMapSeed: SeedSpec = {
    label: 'viewer-read-map',
    payload: PAYLOAD,
};
