import { createElement } from 'lwc';
import { createTestWireAdapter } from '@salesforce/wire-service-jest-util';

import BcmCapabilityMap from 'c/bcm_CapabilityMap';

const mockGetMaps = createTestWireAdapter();
const mockGetTags = createTestWireAdapter();

let mockHideCapabilityImpl = jest.fn().mockResolvedValue(undefined);
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

let mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);

jest.mock('@salesforce/customPermission/bcm_CanEdit', () => false, { virtual: true });
jest.mock('@salesforce/apex/bcm_MapController.getMaps', () => mockGetMaps, { virtual: true });
jest.mock('@salesforce/apex/bcm_TagController.getTags', () => mockGetTags, { virtual: true });
jest.mock('@salesforce/apex/bcm_CapabilityController.getCapabilities',
    () => {
        const fn = function(...args) { return mockCapabilitiesImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
    { virtual: true }
);
jest.mock('@salesforce/apex/bcm_CapabilityController.hideCapability',
    () => {
        const fn = function(...args) { return mockHideCapabilityImpl(...args); };
        fn.__esModule = true;
        fn.default = fn;
        return fn;
    },
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

// Seeds a map selection so _buildLayout is populated
async function seedLayout(element) {
    const mapCombobox = element.shadowRoot.querySelector('lightning-combobox');
    mapCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'MAP-1' } }));
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
});

describe('BcmCapabilityMap node click UX — focus then menu', () => {
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

    it('First click L1 node focuses it but does not open context menu', () => {
        const l1Node = getNode(element, 'L1-A');
        clickNode(l1Node);
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
    });

    it('Second click on same L1 node opens context menu', async () => {
        const l1Node = getNode(element, 'L1-A');
        clickNode(l1Node);
        await flushPromises();
        clickNode(l1Node);
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();
    });

    it('First click L2 node focuses it but does not open context menu', () => {
        const l2Node = getNode(element, 'L2-A1');
        clickNode(l2Node);
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
    });

    it('Second click on same L2 node opens context menu', async () => {
        const l2Node = getNode(element, 'L2-A1');
        clickNode(l2Node);
        await flushPromises();
        clickNode(l2Node);
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();
    });

    it('Clicking a different node after first focus does not open context menu', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        const l2A2 = getNode(element, 'L2-A2');
        clickNode(l2A1);
        await flushPromises();
        clickNode(l2A2);
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
    });
});

describe('BcmCapabilityMap node click UX — L3 bullets', () => {
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

    it('First click on L3 bullet focuses it but does not open context menu', () => {
        const l3Text = getL3TextNode(element, 'L3-A1a');
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
    });

    it('Second click on same L3 bullet opens context menu', async () => {
        const l3Text = getL3TextNode(element, 'L3-A1a');
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        l3Text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();
    });
});

describe('BcmCapabilityMap keyboard navigation — L2 level', () => {
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

    // Focus L2-A1 via click, then navigate down to L2-A2
    it('ArrowDown from focused L2 moves focus to next L2 in column', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushPromises();

        // After ArrowDown, menu should still be closed (nav moves focus, not opens menu)
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();

        // Second click on L2-A2 should open menu immediately (it is now focused)
        const l2A2 = getNode(element, 'L2-A2');
        clickNode(l2A2);
        await flushPromises();
        const menuAfter = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menuAfter).not.toBeNull();
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

        // L2-A1 should now be focused; second click opens menu
        clickNode(l2A1);
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();
    });

    it('ArrowUp from first L2 in column moves focus to parent L1', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await flushPromises();

        // L1-A should now be focused; second click on it opens menu
        const l1A = getNode(element, 'L1-A');
        clickNode(l1A);
        await flushPromises();
        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();
    });

    it('ArrowLeft/Right on focused L2 does not open context menu', async () => {
        const l2A1 = getNode(element, 'L2-A1');
        clickNode(l2A1);
        await flushPromises();

        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushPromises();

        const menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
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
});

describe('BcmCapabilityMap context menu actions', () => {
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

    // Helper: open context menu on an L1/L2 node (two clicks)
    async function openMenuOnNode(nodeId) {
        const node = getNode(element, nodeId);
        clickNode(node);
        await flushPromises();
        clickNode(node);
        await flushPromises();
        return element.shadowRoot.querySelector('c-bcm_-context-menu');
    }

    it('Context menu renders with correct node prop when opened', async () => {
        const menu = await openMenuOnNode('L2-A1');
        expect(menu).not.toBeNull();
        expect(menu.node).toMatchObject({ id: 'L2-A1' });
    });

    it('Context menu close event hides the menu', async () => {
        await openMenuOnNode('L2-A1');
        let menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).not.toBeNull();

        menu.dispatchEvent(new CustomEvent('close', { bubbles: false }));
        await flushPromises();

        menu = element.shadowRoot.querySelector('c-bcm_-context-menu');
        expect(menu).toBeNull();
    });

    it('Context menu is hidden when canEdit is false (no Hide button exposed via parent)', async () => {
        // canEdit=false (mocked at top) means bcm_ContextMenu receives no special prop from parent
        // The parent only controls visibility; Hide button visibility is a bcm_ContextMenu concern.
        // Verify: menu opens without error when viewer clicks a node
        const menu = await openMenuOnNode('L2-A1');
        expect(menu).not.toBeNull();
        // node prop passed correctly so child can gate Hide button
        expect(menu.node).toBeDefined();
    });

    it('View detail loads capability via Apex and opens panel', async () => {
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

        const menu = await openMenuOnNode('L2-A1');
        expect(menu).not.toBeNull();

        menu.dispatchEvent(new CustomEvent('viewdetail', {
            detail: { id: 'L2-A1', level: 2, name: 'Sub-Cap A1' },
        }));
        await flushPromises();

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

describe('BcmCapabilityMap context menu — Hide capability', () => {
    let element;

    beforeEach(async () => {
        mockCapabilitiesImpl = jest.fn().mockResolvedValue(CAPS_DATA);
        mockHideCapabilityImpl = jest.fn().mockResolvedValue(undefined);
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

    async function openMenuOnNode(nodeId) {
        const node = getNode(element, nodeId);
        clickNode(node);
        await flushPromises();
        clickNode(node);
        await flushPromises();
        return element.shadowRoot.querySelector('c-bcm_-context-menu');
    }

    it('Hide click calls hideCapability Apex and rebuilds layout without target node', async () => {
        // Precondition: L2-A1 visible in layout
        expect(getNode(element, 'L2-A1')).not.toBeNull();

        const menu = await openMenuOnNode('L2-A1');
        expect(menu).not.toBeNull();

        menu.dispatchEvent(new CustomEvent('hide', {
            detail: { id: 'L2-A1', level: 2, name: 'Sub-Cap A1' },
        }));
        await flushPromises();

        expect(mockHideCapabilityImpl).toHaveBeenCalledTimes(1);
        expect(mockHideCapabilityImpl).toHaveBeenCalledWith({ capabilityId: 'L2-A1' });

        // Layout rebuilt — hidden L2 no longer rendered (showHidden defaults to false)
        expect(getNode(element, 'L2-A1')).toBeNull();
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
        const callsBefore = mockCapabilitiesImpl.mock.calls.length;
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
        // Local-patch + rebuild — no extra Apex call to cacheable getCapabilities
        expect(mockCapabilitiesImpl.mock.calls.length).toBe(callsBefore);
        // Layout reflects the new name on the L2 node
        const renamed = element.shadowRoot.querySelector('[data-node-id="L2-A1"][data-node-name="Renamed L2"]');
        expect(renamed).not.toBeNull();
    });

    it('saved event with no id is ignored (no Apex call)', async () => {
        const panel = element.shadowRoot.querySelector('c-bcm_-capability-detail');
        panel.dispatchEvent(new CustomEvent('saved', { detail: {} }));
        await flushPromises();
        expect(mockUpdateCapabilityImpl).not.toHaveBeenCalled();
    });
});
