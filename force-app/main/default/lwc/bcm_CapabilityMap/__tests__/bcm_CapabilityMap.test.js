import { createElement } from 'lwc';
import { createTestWireAdapter } from '@salesforce/wire-service-jest-util';

const mockGetMaps = createTestWireAdapter();
const mockGetTags = createTestWireAdapter();
const mockGetCapabilities = createTestWireAdapter();

// require() (not import) ensures mockGetMaps/mockGetTags are constructed
// before the component module's apex-scoped imports resolve to .default.
const BcmCapabilityMap = require('c/bcm_CapabilityMap').default;

let mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue(null);
let mockUpdateCapabilityImpl = jest.fn().mockResolvedValue(undefined);

// Imperative Apex mock — returns a resolved promise with seeded data
const CAPS_DATA = [
    { Id: 'L1-A', Name: 'Capability A', bcm_Parent__c: null, bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false },
    { Id: 'L2-A1', Name: 'Sub-Cap A1', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false, Tags__r: [] },
    { Id: 'L2-A2', Name: 'Sub-Cap A2', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 2, bcm_HideFromDiagram__c: false, Tags__r: [] },
    { Id: 'L3-A1a', Name: 'Detail A1a', bcm_Parent__c: 'L2-A1', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false },
    { Id: 'L3-A1b', Name: 'Detail A1b', bcm_Parent__c: 'L2-A1', bcm_SortOrder__c: 2, bcm_HideFromDiagram__c: false },
    { Id: 'L1-B', Name: 'Capability B', bcm_Parent__c: null, bcm_SortOrder__c: 2, bcm_HideFromDiagram__c: false },
    { Id: 'L2-B1', Name: 'Sub-Cap B1', bcm_Parent__c: 'L1-B', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false, Tags__r: [] },
];

// `getCapabilities` is now a @wire — `mockGetCapabilities.emit(data)` feeds the
// component. `mockCapabilitiesImpl` is kept as a plain jest.fn for legacy
// assertions: `seedLayout` invokes it with `{ mapId }` and tests still call
// `mockCapabilitiesImpl.mockResolvedValue(DATA)` to set what `seedLayout`
// emits.
let mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);

let mockCanEdit = false;
jest.mock(
    '@salesforce/customPermission/bcm_CanEdit',
    () => ({
        __esModule: true,
        get default() { return mockCanEdit; },
    }),
    { virtual: true }
);

let mockReorderImpl  = jest.fn().mockResolvedValue(undefined);
let mockReparentImpl = jest.fn().mockResolvedValue(undefined);
jest.mock(
    '@salesforce/apex/bcm_DragDropController.reorderCapabilities',
    () => {
        const fn = function(...args) { return mockReorderImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/bcm_DragDropController.reparentCapability',
    () => {
        const fn = function(...args) { return mockReparentImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
    { virtual: true }
);
jest.mock(
    'lightning/platformShowToastEvent',
    () => ({
        __esModule: true,
        ShowToastEvent: class ShowToastEvent extends CustomEvent {
            constructor(detail) {
                super('lightning__showtoast', { detail, bubbles: true, composed: true });
            }
        },
    }),
    { virtual: true }
);
jest.mock('@salesforce/apex', () => ({
    __esModule: true,
    refreshApex: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });
const { refreshApex } = require('@salesforce/apex');
jest.mock('@salesforce/apex/bcm_MapController.getMaps', () => ({ __esModule: true, default: mockGetMaps }), { virtual: true });
jest.mock('@salesforce/apex/bcm_TagController.getTags', () => ({ __esModule: true, default: mockGetTags }), { virtual: true });
jest.mock('@salesforce/apex/bcm_CapabilityController.getCapabilities',
    () => ({ __esModule: true, default: mockGetCapabilities }),
    { virtual: true }
);
jest.mock('@salesforce/apex/bcm_CapabilityController.getCapabilityDetail',
    () => {
        const fn = function(...args) { return mockGetCapabilityDetailImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
    { virtual: true }
);
jest.mock('@salesforce/apex/bcm_CapabilityController.updateCapability',
    () => {
        const fn = function(...args) { return mockUpdateCapabilityImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
    { virtual: true }
);

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

// Seeds a map selection so _buildLayout is populated. Emits through the
// `mockGetCapabilities` wire adapter and records the call against
// `mockCapabilitiesImpl` for legacy `toHaveBeenCalledWith({ mapId })` checks.
async function seedLayout(element, mapId = 'MAP-1') {
    const mapCombobox = element.shadowRoot.querySelector('lightning-combobox');
    mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: mapId } }));
    const data = await mockCapabilitiesImpl({ mapId });
    mockGetCapabilities.emit({ data, error: undefined });
    await flushPromises();
}

// Returns the first .bcm-node with matching data-node-id
function getNode(element, nodeId) {
    return element.shadowRoot.querySelector(`[data-node-id="${nodeId}"]`);
}

function clickNode(node) {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

// Returns SVG canvas element
function getSvg(element) {
    return element.shadowRoot.querySelector('svg.bcm-canvas');
}

function getL3TextNode(element, l3Id) {
    return element.shadowRoot.querySelector(`text[data-node-id="${l3Id}"][data-node-level="3"]`);
}

describe('BcmCapabilityMap zoom/pan state machine', () => {
    let element;
    let zoomInBtn, zoomOutBtn, resetBtn, mapCombobox;

    beforeEach(async () => {
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();

        zoomInBtn   = element.shadowRoot.querySelector('[title="Zoom In"]');
        zoomOutBtn  = element.shadowRoot.querySelector('[title="Zoom Out"]');
        resetBtn    = element.shadowRoot.querySelector('[title="Reset View"]');
        mapCombobox = element.shadowRoot.querySelector('lightning-combobox');
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('Zoom In increases zoom state', () => {
        const before = element.zoom;
        zoomInBtn.click();
        expect(element.zoom).toBeGreaterThan(before);
    });

    it('Zoom Out decreases zoom state', () => {
        const before = element.zoom;
        zoomOutBtn.click();
        expect(element.zoom).toBeLessThan(before);
    });

    it('Zoom In clamped at 300%', () => {
        // Click Zoom In 20 times to reach ZOOM_MAX (1.0 + 20*0.1 = 3.0)
        for (let i = 0; i < 20; i++) zoomInBtn.click();
        expect(element.zoom).toBe(3.0);
        zoomInBtn.click();
        expect(element.zoom).toBe(3.0);
    });

    it('Zoom Out clamped at 20%', () => {
        // Click Zoom Out 8 times to reach ZOOM_MIN (1.0 - 8*0.1 = 0.2)
        for (let i = 0; i < 8; i++) zoomOutBtn.click();
        expect(element.zoom).toBe(0.2);
        zoomOutBtn.click();
        expect(element.zoom).toBe(0.2);
    });

    it('Reset View returns zoom to 1.0 and pan to (0,0)', () => {
        zoomInBtn.click();
        zoomInBtn.click();
        resetBtn.click();
        expect(element.zoom).toBe(1.0);
        expect(element.panX).toBe(0);
        expect(element.panY).toBe(0);
    });

    it('Switching selected map resets zoom and pan to defaults', async () => {
        zoomInBtn.click();
        zoomInBtn.click();
        mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'newMapId' } }));
        await flushPromises();
        expect(element.zoom).toBe(1.0);
        expect(element.panX).toBe(0);
        expect(element.panY).toBe(0);
    });

    it('clears diagram when map combobox is unselected', async () => {
        // Seed map + capabilities so layout populated
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        await flushPromises();
        await seedLayout(element);
        expect(element.shadowRoot.querySelectorAll('.bcm-node[data-node-level="1"]').length)
            .toBeGreaterThan(0);

        // User clears the combobox
        mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await flushPromises();

        // Diagram emptied — no L1 column nodes remain
        expect(element.shadowRoot.querySelectorAll('.bcm-node[data-node-level="1"]').length)
            .toBe(0);
        expect(element.shadowRoot.querySelectorAll('.bcm-node[data-node-level="2"]').length)
            .toBe(0);
    });
});

function getPanel(element) {
    return element.shadowRoot.querySelector('c-bcm_-capability-detail');
}

describe('BcmCapabilityMap node click UX — focus then panel', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockGetCapabilityDetailImpl = jest.fn().mockImplementation(({ capabilityId }) =>
            Promise.resolve({ Id: capabilityId, Name: capabilityId, bcm_Level__c: 1, Tags__r: [] })
        );
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('First click L1 node focuses it but does not open detail panel', () => {
        const l1Node = getNode(element, 'L1-A');
        clickNode(l1Node);
        expect(mockGetCapabilityDetailImpl).not.toHaveBeenCalled();
        expect(getPanel(element).capability).toBeNull();
    });

    it('Second click on same L1 node opens detail panel', async () => {
        const l1Node = getNode(element, 'L1-A');
        clickNode(l1Node);
        await flushPromises();
        clickNode(l1Node);
        await flushPromises();
        expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L1-A' });
        expect(getPanel(element).capability).toMatchObject({ Id: 'L1-A' });
    });

    it('First click L2 node focuses it but does not open detail panel', () => {
        const l2Node = getNode(element, 'L2-A1');
        clickNode(l2Node);
        expect(mockGetCapabilityDetailImpl).not.toHaveBeenCalled();
        expect(getPanel(element).capability).toBeNull();
    });

    it('Second click on same L2 node opens detail panel', async () => {
        const l2Node = getNode(element, 'L2-A1');
        clickNode(l2Node);
        await flushPromises();
        clickNode(l2Node);
        await flushPromises();
        expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L2-A1' });
        expect(getPanel(element).capability).toMatchObject({ Id: 'L2-A1' });
    });

    it('Clicking a different node after first focus does not open detail panel', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        const l2A2 = getNode(element, 'L2-A2');
        clickNode(l2A1);
        await flushPromises();
        clickNode(l2A2);
        await flushPromises();
        expect(mockGetCapabilityDetailImpl).not.toHaveBeenCalled();
        expect(getPanel(element).capability).toBeNull();
    });
});

describe('BcmCapabilityMap node click UX — L3 bullets', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockGetCapabilityDetailImpl = jest.fn().mockImplementation(({ capabilityId }) =>
            Promise.resolve({ Id: capabilityId, Name: capabilityId, bcm_Level__c: 3, Tags__r: [] })
        );
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('First click on L3 bullet focuses it but does not open detail panel', () => {
        const l3Text = getL3TextNode(element, 'L3-A1a');
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(mockGetCapabilityDetailImpl).not.toHaveBeenCalled();
        expect(getPanel(element).capability).toBeNull();
    });

    it('Second click on same L3 bullet opens detail panel', async () => {
        const l3Text = getL3TextNode(element, 'L3-A1a');
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L3-A1a' });
        expect(getPanel(element).capability).toMatchObject({ Id: 'L3-A1a' });
    });
});

describe('BcmCapabilityMap keyboard navigation — L2 level', () => {
    let element;
    let svg;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockGetCapabilityDetailImpl = jest.fn().mockImplementation(({ capabilityId }) =>
            Promise.resolve({ Id: capabilityId, Name: capabilityId, bcm_Level__c: 2, Tags__r: [] })
        );
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        svg = getSvg(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    // Focus L2-A1 via click, then navigate down to L2-A2
    it('ArrowDown from focused L2 moves focus to next L2 in column', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        // After ArrowDown, panel should still be closed (nav moves focus, not opens panel)
        expect(getPanel(element).capability).toBeNull();

        // Second click on L2-A2 opens panel (it is now focused)
        const l2A2 = getNode(element, 'L2-A2');
        clickNode(l2A2);
        await flushPromises();
        expect(getPanel(element).capability).toMatchObject({ Id: 'L2-A2' });
    });

    it('ArrowUp from focused L2 moves focus to previous L2 in column', async () => {
        // Focus L2-A2 first via click + ArrowDown
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        // Now L2-A2 should be focused; ArrowUp should move back to L2-A1
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        // L2-A1 now focused; second click opens panel
        clickNode(l2A1);
        await flushPromises();
        expect(getPanel(element).capability).toMatchObject({ Id: 'L2-A1' });
    });

    it('ArrowUp from first L2 in column moves focus to parent L1', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        // L1-A now focused; second click opens panel
        const l1A = getNode(element, 'L1-A');
        clickNode(l1A);
        await flushPromises();
        expect(getPanel(element).capability).toMatchObject({ Id: 'L1-A' });
    });

    it('ArrowLeft/Right on focused L2 does not open detail panel', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushPromises();

        expect(getPanel(element).capability).toBeNull();
    });
});

describe('BcmCapabilityMap keyboard navigation — L3 level', () => {
    let element;
    let svg;

    function isFocused(el, selector) {
        const node = el.shadowRoot.querySelector(selector);
        return node && node.getAttribute('data-focused') === 'true';
    }

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        svg = getSvg(element);

        // Focus L3-A1a via click (first click sets focus)
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('ArrowDown on focused L3 moves focus to next sibling L3', async () => {
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(true);

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        expect(isFocused(element, 'text[data-node-id="L3-A1b"][data-node-level="3"]')).toBe(true);
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(false);
    });

    it('ArrowUp on focused L3 moves focus to previous sibling L3', async () => {
        // First move down to L3-A1b
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();
        expect(isFocused(element, 'text[data-node-id="L3-A1b"][data-node-level="3"]')).toBe(true);

        // Then ArrowUp returns to L3-A1a
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(true);
        expect(isFocused(element, 'text[data-node-id="L3-A1b"][data-node-level="3"]')).toBe(false);
    });

    it('ArrowUp from first L3 under L2 moves focus to parent L2', async () => {
        // L3-A1a is the first sibling under L2-A1
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(true);

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        // Parent L2-A1 now focused
        expect(isFocused(element, '[data-node-id="L2-A1"][data-node-level="2"]')).toBe(true);
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(false);
    });

    it('ArrowLeft/Right on focused L3 leaves focus and pan unchanged', async () => {
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(true);
        const panXBefore = element.panX;
        const panYBefore = element.panY;

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await flushPromises();
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushPromises();

        // Focus unchanged
        expect(isFocused(element, 'text[data-node-id="L3-A1a"][data-node-level="3"]')).toBe(true);
        // Pan unchanged
        expect(element.panX).toBe(panXBefore);
        expect(element.panY).toBe(panYBefore);
    });

    it('ArrowDown on last L3 sibling leaves focus unchanged', async () => {
        // Move to last sibling L3-A1b
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();
        expect(isFocused(element, 'text[data-node-id="L3-A1b"][data-node-level="3"]')).toBe(true);

        // ArrowDown again: no next sibling -> focus unchanged
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        expect(isFocused(element, 'text[data-node-id="L3-A1b"][data-node-level="3"]')).toBe(true);
    });
});

describe('BcmCapabilityMap L3 focus highlight rect', () => {
    let element;
    let svg;

    function getFocusRect(el) {
        return el.shadowRoot.querySelector('rect.bcm-l3-focus-rect');
    }

    function getFocusRects(el) {
        return el.shadowRoot.querySelectorAll('rect.bcm-l3-focus-rect');
    }

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        svg = getSvg(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('Renders highlight rect when L3 bullet focused', async () => {
        expect(getFocusRect(element)).toBeNull();

        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        const rect = getFocusRect(element);
        expect(rect).not.toBeNull();
        expect(rect.getAttribute('fill')).toBe('#E8F4FF');
        expect(rect.getAttribute('stroke')).toBe('#0070D2');
        // Only one rect total
        expect(getFocusRects(element).length).toBe(1);
    });

    it('Focused L3 bullet text is bold; siblings remain normal', async () => {
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        const focusedText = getL3TextNode(element, 'L3-A1a');
        const siblingText = getL3TextNode(element, 'L3-A1b');
        expect(focusedText.getAttribute('font-weight')).toBe('bold');
        expect(siblingText.getAttribute('font-weight')).toBe('normal');
    });

    it('Rect moves to next sibling on ArrowDown', async () => {
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        const yBefore = parseFloat(getFocusRect(element).getAttribute('y'));

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        const rectsAfter = getFocusRects(element);
        expect(rectsAfter.length).toBe(1);
        const yAfter = parseFloat(rectsAfter[0].getAttribute('y'));
        expect(yAfter).not.toBe(yBefore);

        // Bold has migrated
        const newFocused = getL3TextNode(element, 'L3-A1b');
        const oldFocused = getL3TextNode(element, 'L3-A1a');
        expect(newFocused.getAttribute('font-weight')).toBe('bold');
        expect(oldFocused.getAttribute('font-weight')).toBe('normal');
    });

    it('Escape clears the L3 focus rect', async () => {
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(getFocusRect(element)).not.toBeNull();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushPromises();

        expect(getFocusRect(element)).toBeNull();
    });

    it('ArrowUp from first L3 sibling clears the rect (focus moves to parent L2)', async () => {
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(getFocusRect(element)).not.toBeNull();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        // Parent L2-A1 now focused; no L3 rect
        expect(getFocusRect(element)).toBeNull();
    });

    it('Clicking a different node clears the previous L3 focus rect', async () => {
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(getFocusRect(element)).not.toBeNull();

        const l2A2 = getNode(element, 'L2-A2');
        clickNode(l2A2);
        await flushPromises();

        expect(getFocusRect(element)).toBeNull();
    });
});

describe('BcmCapabilityMap canvas click clears focus', () => {
    let element;
    let svg;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        svg = getSvg(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('Canvas mousedown clears L2 highlight', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();
        expect(getNode(element, 'L2-A1').getAttribute('data-focused')).toBe('true');

        // Mousedown on bare SVG (no .bcm-node ancestor)
        const evt = new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 10, clientY: 10 });
        svg.dispatchEvent(evt);
        await flushPromises();

        expect(getNode(element, 'L2-A1').getAttribute('data-focused')).not.toBe('true');
        // Stroke reverts to default
        const rect = getNode(element, 'L2-A1').querySelector('rect');
        expect(rect.getAttribute('stroke')).toBe('#CCCCCC');
        expect(rect.getAttribute('stroke-width')).toBe('1');
    });

    it('Canvas mousedown with no focus is a no-op (no throw)', async () => {
        expect(() => {
            const evt = new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 10, clientY: 10 });
            svg.dispatchEvent(evt);
        }).not.toThrow();
        await flushPromises();
    });

    it('Pan still works after canvas mousedown', async () => {
        const before = element.panX;
        const down = new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 100 });
        svg.dispatchEvent(down);
        const move = new MouseEvent('mousemove', { bubbles: true, composed: true, clientX: 150, clientY: 100 });
        svg.dispatchEvent(move);
        await flushPromises();
        expect(element.panX).toBe(before + 50);
    });

    it('ArrowUp pans diagram down (positive panY) — no clamp', async () => {
        expect(element.panY).toBe(0);
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();
        expect(element.panY).toBe(50);
    });

    it('ArrowDown pans diagram up (negative panY) — no clamp', async () => {
        expect(element.panY).toBe(0);
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();
        expect(element.panY).toBe(-50);
    });
});

describe('BcmCapabilityMap second-click → detail panel', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    async function clickTwice(nodeId) {
        const node = getNode(element, nodeId);
        clickNode(node);
        await flushPromises();
        clickNode(node);
        await flushPromises();
    }

    it('Second click loads capability via Apex and opens panel', async () => {
        const detailRecord = {
            Id: 'L2-A1',
            Name: 'Sub-Cap A1',
            bcm_Level__c: 2,
            bcm_Definition__c: '<p>Def</p>',
            bcm_StrategySupport__c: null,
            bcm_ArchitecturalNuance__c: null,
            bcm_HideFromDiagram__c: false,
            Tags__r: [],
        };
        mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue(detailRecord);

        await clickTwice('L2-A1');

        expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L2-A1' });

        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        expect(panel).not.toBeNull();
        expect(panel.capability).toMatchObject({ Id: 'L2-A1', Name: 'Sub-Cap A1' });
        // Breadcrumb walks parent chain root-first: L1-A -> L2-A1
        expect(panel.breadcrumb).toEqual([
            { id: 'L1-A', label: 'Capability A' },
            { id: 'L2-A1', label: 'Sub-Cap A1' },
        ]);
    });
});

describe('BcmCapabilityMap detail panel anchoring (GH #41)', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('Detail panel is anchored outside the canvas container', () => {
        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        const canvasContainer = element.shadowRoot.querySelector('.bcm-canvas-container');
        expect(panel).not.toBeNull();
        expect(canvasContainer).not.toBeNull();
        expect(canvasContainer.contains(panel)).toBe(false);
    });
});

describe('BcmCapabilityMap detail panel — saved flow', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockUpdateCapabilityImpl = jest.fn().mockResolvedValue(undefined);
        mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue({
            Id: 'L2-A1',
            Name: 'Renamed L2',
            bcm_Level__c: 2,
            bcm_Definition__c: '<p>D</p>',
            bcm_StrategySupport__c: null,
            bcm_ArchitecturalNuance__c: null,
            bcm_HideFromDiagram__c: false,
            Tags__r: [],
        });

        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('saved event calls updateCapability and rebuilds diagram with new name', async () => {
        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        expect(panel).not.toBeNull();

        panel.dispatchEvent(new CustomEvent('saved', {
            detail: {
                id                  : 'L2-A1',
                name                : 'Renamed L2',
                definition          : '<p>D</p>',
                strategySupport     : '<p>S</p>',
                architecturalNuance : '<p>N</p>',
                hideFromDiagram     : false,
            },
        }));
        await flushPromises();
        await flushPromises();

        expect(mockUpdateCapabilityImpl).toHaveBeenCalledTimes(1);
        const arg = mockUpdateCapabilityImpl.mock.calls[0][0];
        expect(arg.capability).toMatchObject({
            Id                          : 'L2-A1',
            Name                        : 'Renamed L2',
            bcm_Definition__c           : '<p>D</p>',
            bcm_StrategySupport__c      : '<p>S</p>',
            bcm_ArchitecturalNuance__c  : '<p>N</p>',
            bcm_HideFromDiagram__c      : false,
        });
        // Local-patch immediately reflects new name; refreshApex runs behind it.
        const renamed = element.shadowRoot.querySelector('[data-node-id="L2-A1"][data-node-name="Renamed L2"]');
        expect(renamed).not.toBeNull();
    });

    it('saved event with no id is ignored (no Apex call)', async () => {
        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        panel.dispatchEvent(new CustomEvent('saved', { detail: {} }));
        await flushPromises();
        expect(mockUpdateCapabilityImpl).not.toHaveBeenCalled();
    });

    it('saved event Apex error surfaces errorMessage to detail panel', async () => {
        mockUpdateCapabilityImpl = jest.fn().mockRejectedValue({
            body: { message: 'Validation rule blocked the save' },
        });
        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');

        panel.dispatchEvent(new CustomEvent('saved', {
            detail: {
                id                  : 'L2-A1',
                name                : 'Will Fail',
                definition          : '<p>D</p>',
                strategySupport     : '<p>S</p>',
                architecturalNuance : '<p>N</p>',
                hideFromDiagram     : false,
            },
        }));
        await flushPromises();
        await flushPromises();

        expect(mockUpdateCapabilityImpl).toHaveBeenCalledTimes(1);
        const refreshed = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        expect(refreshed.errorMessage).toBe('Validation rule blocked the save');
    });
});

describe('BcmCapabilityMap session persistence', () => {
    let element;

    beforeEach(() => {
        sessionStorage.clear();
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.removeChild(element);
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    it('Writes selectedMapId to sessionStorage on map change', async () => {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }, { Id: 'MAP-2', Name: 'Map 2' }], error: undefined });
        await flushPromises();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-2' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedMapId')).toBe('MAP-2');
    });

    it('Restores selectedMapId from sessionStorage on init when id is in mapOptions', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedMapId', 'MAP-2');
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }, { Id: 'MAP-2', Name: 'Map 2' }], error: undefined });
        await flushPromises();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.value).toBe('MAP-2');
        expect(mockGetCapabilities.getLastConfig()).toEqual({ mapId: 'MAP-2' });
    });

    it('Clears persisted id and leaves selector empty when id is not in mapOptions', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedMapId', 'MAP-DELETED');
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        await flushPromises();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.value).toBeFalsy();
        expect(sessionStorage.getItem('bcm.visualisation.selectedMapId')).toBeNull();
        // Wire never received a non-null mapId
        const lastCfg = mockGetCapabilities.getLastConfig();
        expect(lastCfg && lastCfg.mapId).toBeFalsy();
    });

    it('Silent fallback when sessionStorage.setItem throws (no crash, no abort)', async () => {
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('QuotaExceeded'); });
        try {
            mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
            await flushPromises();
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            expect(() => {
                combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-1' } }));
            }).not.toThrow();
            await flushPromises();
            expect(mockGetCapabilities.getLastConfig()).toEqual({ mapId: 'MAP-1' });
        } finally {
            setItemSpy.mockRestore();
        }
    });

    it('Silent fallback when sessionStorage.getItem throws on init', async () => {
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => { throw new Error('SecurityError'); });
        try {
            document.body.removeChild(element);
            element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
            document.body.appendChild(element);
            expect(() => {
                mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
            }).not.toThrow();
            await flushPromises();
            // No restore attempted -> wire never receives a real mapId
            const cfg = mockGetCapabilities.getLastConfig();
            expect(cfg && cfg.mapId).toBeFalsy();
        } finally {
            getItemSpy.mockRestore();
        }
    });

    it('Silent fallback when sessionStorage.removeItem throws (stale-id path)', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedMapId', 'MAP-DELETED');
        const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem')
            .mockImplementation(() => { throw new Error('SecurityError'); });
        try {
            document.body.removeChild(element);
            element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
            document.body.appendChild(element);
            expect(() => {
                mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
            }).not.toThrow();
            await flushPromises();
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            expect(combobox.value).toBeFalsy();
            const cfg = mockGetCapabilities.getLastConfig();
            expect(cfg && cfg.mapId).toBeFalsy();
        } finally {
            removeItemSpy.mockRestore();
        }
    });
});

describe('BcmCapabilityMap cross-cutting band', () => {
    let element;

    const CAPS_DATA_WITH_CC = [
        ...CAPS_DATA,
        { Id: 'L1-CC', Name: 'Security', bcm_Parent__c: null, bcm_SortOrder__c: 99,
          bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: true },
        { Id: 'L1-CC2', Name: 'Compliance', bcm_Parent__c: null, bcm_SortOrder__c: 100,
          bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: true },
        { Id: 'L2-CC1', Name: 'Encryption', bcm_Parent__c: 'L1-CC', bcm_SortOrder__c: 1,
          bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: false, Tags__r: [] },
    ];

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA_WITH_CC);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        // Band hidden by default (issue #31). Toggle on for these tests.
        const toggle = element.shadowRoot.querySelector(
            'lightning-button-icon[data-id="cross-cutting-toggle"]'
        );
        toggle.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it('Cross-cutting L1 renders as band node, not as column chevron', () => {
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        expect(band).not.toBeNull();
        const column = element.shadowRoot.querySelector(
            '.bcm-node[data-node-id="L1-CC"][data-node-level="1"]'
        );
        expect(column).toBeNull();
    });

    it('Cross-cutting L1 child (L2) is excluded from the diagram', () => {
        const l2 = element.shadowRoot.querySelector('[data-node-id="L2-CC1"]');
        expect(l2).toBeNull();
    });

    it('Non-cross-cutting L1 still renders as a regular column chevron', () => {
        const regular = element.shadowRoot.querySelector(
            '.bcm-node[data-node-id="L1-A"][data-node-level="1"]'
        );
        expect(regular).not.toBeNull();
    });

    it('Click on band chevron triggers viewdetail Apex call', async () => {
        const detailRecord = { Id: 'L1-CC', Name: 'Security', bcm_Level__c: 1, Tags__r: [] };
        mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue(detailRecord);
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        band.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(mockGetCapabilityDetailImpl).toHaveBeenCalledWith({ capabilityId: 'L1-CC' });
    });

    it('Lowest-SortOrder cross-cutting renders on top of layered band stack', () => {
        const bandNodes = element.shadowRoot.querySelectorAll('.bcm-band-node');
        expect(bandNodes.length).toBe(2);
        // DOM-last paints on top; sortOrder 99 (Security) < 100 (Compliance) → Security on top
        const lastId = bandNodes[bandNodes.length - 1].getAttribute('data-node-id');
        expect(lastId).toBe('L1-CC');
    });

    it('Band chevron spans full diagram width', () => {
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        const polygon = band.querySelector('polygon');
        const points = polygon.getAttribute('points').trim().split(/\s+/);
        // First vertex x should equal DIAGRAM_PADDING (24)
        const firstX = parseFloat(points[0].split(',')[0]);
        expect(firstX).toBe(24);
        // Tip x reaches near canvasWidth - DIAGRAM_PADDING
        const svg = element.shadowRoot.querySelector('svg.bcm-canvas');
        const canvasW = parseFloat(svg.getAttribute('width'));
        const tipX = parseFloat(points[2].split(',')[0]);
        expect(tipX).toBe(canvasW - 24);
    });

    it('Band label is uppercased and left-aligned (no text-anchor)', () => {
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        const text = band.querySelector('text');
        expect(text.textContent.trim()).toBe('SECURITY');
        expect(text.getAttribute('text-anchor')).toBeNull();
    });
});

describe('BcmCapabilityMap cross-cutting band — cc-only map', () => {
    let element;

    const CAPS_DATA_CC_ONLY = [
        { Id: 'L1-CC', Name: 'Security', bcm_Parent__c: null, bcm_SortOrder__c: 1,
          bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: true },
    ];

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA_CC_ONLY);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        // Band hidden by default (issue #31). Toggle on for these tests.
        const toggle = element.shadowRoot.querySelector(
            'lightning-button-icon[data-id="cross-cutting-toggle"]'
        );
        toggle.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it('Renders the band when there are zero regular L1s', () => {
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        expect(band).not.toBeNull();
        // No regular column chevrons should exist
        const cols = element.shadowRoot.querySelectorAll('.bcm-node[data-node-level="1"]');
        expect(cols.length).toBe(0);
    });

    it('Skips the empty L1-row reservation when no regular roots exist', () => {
        // Band's bandTopY should sit at DIAGRAM_PADDING + BOX_GAP (no header strip).
        // Polygon points: first vertex y = bandTopY = 24 + BOX_GAP.
        const band = element.shadowRoot.querySelector('.bcm-band-node[data-node-id="L1-CC"]');
        const polygon = band.querySelector('polygon');
        const points = polygon.getAttribute('points').trim().split(/\s+/);
        const firstY = parseFloat(points[0].split(',')[1]);
        // BOX_GAP = 16; DIAGRAM_PADDING = 24 -> 40. If header strip leaked in, this would jump
        // by CHEVRON_HEIGHT (~60) + BOX_GAP (16) = ~76 to ~116.
        expect(firstY).toBeLessThan(60);
    });
});

describe('BcmCapabilityMap cross-cutting toggle', () => {
    let element;

    const CAPS_DATA_WITH_CC = [
        ...CAPS_DATA,
        { Id: 'L1-CC', Name: 'Security', bcm_Parent__c: null, bcm_SortOrder__c: 99,
          bcm_HideFromDiagram__c: false, bcm_IsCrossCutting__c: true },
    ];

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA_WITH_CC);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    function getToggleButton() {
        return element.shadowRoot.querySelector(
            'lightning-button-icon[data-id="cross-cutting-toggle"]'
        );
    }

    it('Band is not rendered on initial load (default hidden)', () => {
        const bandNodes = element.shadowRoot.querySelectorAll('.bcm-band-node');
        expect(bandNodes.length).toBe(0);
    });

    it('Toggle button starts with neutral (border) variant', () => {
        expect(getToggleButton().variant).toBe('border');
    });

    it('Clicking toggle renders band and flips variant to brand', async () => {
        getToggleButton().dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        const bandNodes = element.shadowRoot.querySelectorAll('.bcm-band-node');
        expect(bandNodes.length).toBeGreaterThan(0);
        expect(getToggleButton().variant).toBe('brand');
    });

    it('Clicking toggle twice hides band and resets variant to border', async () => {
        getToggleButton().dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        getToggleButton().dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        const bandNodes = element.shadowRoot.querySelectorAll('.bcm-band-node');
        expect(bandNodes.length).toBe(0);
        expect(getToggleButton().variant).toBe('border');
    });

    it('Switching map resets toggle to hidden + neutral variant', async () => {
        // Toggle on first
        getToggleButton().dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        expect(getToggleButton().variant).toBe('brand');
        expect(element.shadowRoot.querySelectorAll('.bcm-band-node').length).toBeGreaterThan(0);

        // Switch map -> reset
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-2' } }));
        await flushPromises();

        expect(getToggleButton().variant).toBe('border');
        expect(element.shadowRoot.querySelectorAll('.bcm-band-node').length).toBe(0);
    });
});

describe('BcmCapabilityMap tag colour highlight', () => {
    let element;

    const TAG_RED   = { Id: 'tag-1', Name: 'NEW',     bcm_Colour__c: '#FF5733' };
    const TAG_BLUE  = { Id: 'tag-2', Name: 'CHANGED', bcm_Colour__c: '#3366FF' };

    const TAGGED_CAPS = [
        { Id: 'L1-A', Name: 'Capability A', bcm_Parent__c: null, bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false },
        { Id: 'L2-A1', Name: 'Sub-Cap A1', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false,
          Tags__r: [{ bcm_Tag__c: 'tag-1', bcm_Tag__r: { Name: 'NEW', bcm_Colour__c: '#FF5733' } }] },
        { Id: 'L2-A2', Name: 'Sub-Cap A2', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 2, bcm_HideFromDiagram__c: false,
          Tags__r: [] },
        { Id: 'L3-A1a', Name: 'Detail A1a', bcm_Parent__c: 'L2-A1', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false,
          Tags__r: [{ bcm_Tag__c: 'tag-1', bcm_Tag__r: { Name: 'NEW', bcm_Colour__c: '#FF5733' } }] },
        { Id: 'L3-A1b', Name: 'Detail A1b', bcm_Parent__c: 'L2-A1', bcm_SortOrder__c: 2, bcm_HideFromDiagram__c: false,
          Tags__r: [] },
    ];

    function getTagCombobox() {
        return element.shadowRoot.querySelectorAll('lightning-combobox')[1];
    }

    function getL2Rect(el, l2Id) {
        return el.shadowRoot.querySelector(`[data-node-id="${l2Id}"][data-node-level="2"] > rect`);
    }

    function getTagRects(el) {
        return el.shadowRoot.querySelectorAll('rect.bcm-l3-tag-rect');
    }

    function getFocusRects(el) {
        return el.shadowRoot.querySelectorAll('rect.bcm-l3-focus-rect');
    }

    beforeEach(async () => {
        sessionStorage.clear();
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(TAGGED_CAPS);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [TAG_RED, TAG_BLUE], error: undefined });
        await flushPromises();
        await seedLayout(element);
    });

    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        sessionStorage.clear();
    });

    it('L2 box fill matches selected tag colour when capability carries the tag', async () => {
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'tag-1' } }));
        await flushPromises();

        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FF5733');
    });

    it('L2 box stays white when capability does not carry the selected tag', async () => {
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'tag-1' } }));
        await flushPromises();

        expect(getL2Rect(element, 'L2-A2').getAttribute('fill')).toBe('#FFFFFF');
    });

    it('L3 bullet group renders tag rect with selected tag colour', async () => {
        expect(getTagRects(element).length).toBe(0);

        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'tag-1' } }));
        await flushPromises();

        const tagRects = getTagRects(element);
        expect(tagRects.length).toBe(1);
        expect(tagRects[0].getAttribute('fill')).toBe('#FF5733');

        // Width matches the focus rect geometry (COLUMN_WIDTH - BOX_PADDING*2 - 8 = 220 - 24 - 8 = 188)
        expect(parseFloat(tagRects[0].getAttribute('width'))).toBe(188);
    });

    it('L3 tag rect is suppressed when the L3 is focused', async () => {
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'tag-1' } }));
        await flushPromises();
        expect(getTagRects(element).length).toBe(1);

        // Focus the tagged L3 (L3-A1a)
        const l3a = getL3TextNode(element, 'L3-A1a');
        l3a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        expect(getTagRects(element).length).toBe(0);
        expect(getFocusRects(element).length).toBe(1);
    });

    it('Selecting None clears L2 fill and L3 tag rect', async () => {
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'tag-1' } }));
        await flushPromises();
        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FF5733');
        expect(getTagRects(element).length).toBe(1);

        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await flushPromises();

        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FFFFFF');
        expect(getTagRects(element).length).toBe(0);
    });
});

describe('BcmCapabilityMap drag-drop', () => {
    let element;

    function getDragHandles(el) {
        return el.shadowRoot.querySelectorAll('[data-bcm-drag-handle="true"]');
    }
    function getGhost(el) {
        return el.shadowRoot.querySelector('[data-bcm-ghost="true"]');
    }
    function getDropIndicator(el) {
        return el.shadowRoot.querySelector('[data-bcm-drop-indicator="true"]');
    }
    function getL2Handle(el, l2Id) {
        return el.shadowRoot.querySelector(`[data-bcm-drag-handle="true"][data-node-id="${l2Id}"][data-node-level="2"]`);
    }

    beforeEach(async () => {
        mockCanEdit = true;
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockGetCapabilityDetailImpl = jest.fn().mockResolvedValue(null);
        mockReorderImpl  = jest.fn().mockResolvedValue(undefined);
        mockReparentImpl = jest.fn().mockResolvedValue(undefined);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();
        await seedLayout(element);
        // jsdom doesn't implement getBoundingClientRect on SVG; stub it.
        const svg = element.shadowRoot.querySelector('svg.bcm-canvas');
        svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 });
    });

    afterEach(() => {
        mockCanEdit = false;
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it('editor sees drag handles', () => {
        const handles = getDragHandles(element);
        expect(handles.length).toBeGreaterThan(0);
    });

    // "viewer does not see drag handles" lives in tests/e2e/drag-drop.spec.ts —
    // sfdx-lwc-jest's customPermission resolver returns the mock factory output as
    // the import value directly (not as `.default`), so Jest cannot toggle the
    // permission across tests in the same module. Spec marker points at Playwright.

    it('ghost renders at cursor', async () => {
        const handle = getL2Handle(element, 'L2-A1');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 200 }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 320 }));
        await flushPromises();
        expect(getGhost(element)).not.toBeNull();
    });

    it('drop indicator renders at target gap', async () => {
        const handle = getL2Handle(element, 'L2-A1');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 200 }));
        // Hover over L2-A2 mid-y so target = position before A2 (i.e. swap)
        // L2-A2 sits in column 0, below L2-A1.
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 350 }));
        await flushPromises();
        expect(getDropIndicator(element)).not.toBeNull();
        // cleanup mouseup
        window.dispatchEvent(new MouseEvent('mouseup'));
        await flushPromises();
    });

    it('drop outside valid target cancels', async () => {
        const handle = getL2Handle(element, 'L2-A1');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 200 }));
        // Drop at far-bottom outside any column header / column box gap area
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: -500 }));
        window.dispatchEvent(new MouseEvent('mouseup', { clientX: -500, clientY: -500 }));
        await flushPromises();
        expect(mockReorderImpl).not.toHaveBeenCalled();
        expect(mockReparentImpl).not.toHaveBeenCalled();
        expect(getGhost(element)).toBeNull();
    });

    it('apex error reverts and toasts', async () => {
        mockReparentImpl = jest.fn().mockRejectedValue({ body: { message: 'boom' } });
        const toastSpy = jest.fn();
        element.addEventListener('lightning__showtoast', toastSpy);

        const handle = getL2Handle(element, 'L2-A1');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 200 }));
        // Drop into L1-B column (different parent → reparent path)
        // L1-B is column index 1 — its L2 column starts at DIAGRAM_PADDING + COLUMN_WIDTH + COLUMN_GAP = 24 + 220 + 16 = 260
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 280, clientY: 100 }));
        window.dispatchEvent(new MouseEvent('mouseup', { clientX: 280, clientY: 100 }));
        await flushPromises();
        await flushPromises();
        await flushPromises();

        expect(toastSpy).toHaveBeenCalled();
    });

    it('escape cancels drag', async () => {
        const handle = getL2Handle(element, 'L2-A1');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 200 }));
        await flushPromises();
        expect(getGhost(element)).not.toBeNull();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flushPromises();

        expect(getGhost(element)).toBeNull();
        expect(mockReorderImpl).not.toHaveBeenCalled();
        expect(mockReparentImpl).not.toHaveBeenCalled();
    });
});

describe('BcmCapabilityMap tag combobox refresh on focus', () => {
    let element;

    const TAGGED_CAPS_FOR_REFRESH = [
        { Id: 'L1-A', Name: 'Capability A', bcm_Parent__c: null, bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false },
        { Id: 'L2-A1', Name: 'Sub-Cap A1', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false,
          Tags__r: [{ bcm_Tag__c: 'TAG-1' }] },
    ];

    function getTagCombobox() {
        return element.shadowRoot.querySelectorAll('lightning-combobox')[1];
    }

    function getL2Rect(el, l2Id) {
        return el.shadowRoot.querySelector(`[data-node-id="${l2Id}"][data-node-level="2"] > rect`);
    }

    beforeEach(async () => {
        sessionStorage.clear();
        refreshApex.mockClear();
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(TAGGED_CAPS_FOR_REFRESH);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#FF0000' },
        ], error: undefined });
        await flushPromises();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        sessionStorage.clear();
    });

    it('Focusing the tag combobox refreshes both getTags and getCapabilities wires', async () => {
        await seedLayout(element);
        refreshApex.mockClear();
        getTagCombobox().dispatchEvent(new CustomEvent('focus'));
        expect(refreshApex).toHaveBeenCalledTimes(2);
    });

    it('Focus refreshes capabilities so junction edits propagate to node fills', async () => {
        await seedLayout(element);
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        await flushPromises();
        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FF0000');

        getTagCombobox().dispatchEvent(new CustomEvent('focus'));
        await flushPromises();

        // Simulate the wire re-emitting capabilities with the junction removed
        // (mirrors a user un-tagging the L2 in another tab).
        mockGetCapabilities.emit({
            data: [
                { Id: 'L1-A', Name: 'Capability A', bcm_Parent__c: null, bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false },
                { Id: 'L2-A1', Name: 'Sub-Cap A1', bcm_Parent__c: 'L1-A', bcm_SortOrder__c: 1, bcm_HideFromDiagram__c: false, Tags__r: [] },
            ],
            error: undefined,
        });
        await flushPromises();

        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FFFFFF');
    });

    it('Second wire emission with a new colour updates tagOptions colour entry', async () => {
        expect(getTagCombobox().options.find(o => o.value === 'TAG-1').colour).toBe('#FF0000');

        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#00FF00' },
        ], error: undefined });
        await flushPromises();

        expect(getTagCombobox().options.find(o => o.value === 'TAG-1').colour).toBe('#00FF00');
    });

    it('Selected L2 fill repaints when refreshed colour map changes', async () => {
        await seedLayout(element);
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        await flushPromises();
        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#FF0000');

        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Strategic', bcm_Colour__c: '#00FF00' },
        ], error: undefined });
        await flushPromises();

        expect(getL2Rect(element, 'L2-A1').getAttribute('fill')).toBe('#00FF00');
    });

    it('If the selected tag is removed from the refreshed list, selectedTagId clears', async () => {
        await seedLayout(element);
        getTagCombobox().dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-1' } }));
        await flushPromises();
        expect(getTagCombobox().value).toBe('TAG-1');

        mockGetTags.emit({ data: [], error: undefined });
        await flushPromises();

        expect(getTagCombobox().value).toBe('');
    });
});

describe('BcmCapabilityMap tag session persistence', () => {
    let element;

    beforeEach(() => {
        sessionStorage.clear();
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.removeChild(element);
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    it('Writes selectedTagId to sessionStorage on tag change', async () => {
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Red',   bcm_Colour__c: '#FF0000' },
            { Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' },
        ], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelectorAll('lightning-combobox')[1];
        tagCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'TAG-2' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBe('TAG-2');
    });

    it('Removes persisted selectedTagId when user selects None', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-2');
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [{ Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' }], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelectorAll('lightning-combobox')[1];
        tagCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await flushPromises();
        expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBeNull();
    });

    it('Restores selectedTagId from sessionStorage on init when id is in tagOptions', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-2');
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [
            { Id: 'TAG-1', Name: 'Red',   bcm_Colour__c: '#FF0000' },
            { Id: 'TAG-2', Name: 'Green', bcm_Colour__c: '#00FF00' },
        ], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelectorAll('lightning-combobox')[1];
        expect(tagCombobox.value).toBe('TAG-2');
    });

    it('Clears persisted tag id and leaves selector at None when id is not in tagOptions', async () => {
        sessionStorage.setItem('bcm.visualisation.selectedTagId', 'TAG-DELETED');
        document.body.removeChild(element);
        element = createElement('c-bcm-capability-map', { is: BcmCapabilityMap });
        document.body.appendChild(element);
        mockGetMaps.emit({ data: [{ Id: 'MAP-1', Name: 'Map 1' }], error: undefined });
        mockGetTags.emit({ data: [{ Id: 'TAG-1', Name: 'Red', bcm_Colour__c: '#FF0000' }], error: undefined });
        await flushPromises();
        const tagCombobox = element.shadowRoot.querySelectorAll('lightning-combobox')[1];
        expect(tagCombobox.value).toBeFalsy();
        expect(sessionStorage.getItem('bcm.visualisation.selectedTagId')).toBeNull();
    });
});
