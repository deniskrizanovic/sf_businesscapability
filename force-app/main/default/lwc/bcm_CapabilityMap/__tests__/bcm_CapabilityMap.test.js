import { createElement } from 'lwc';
import { createTestWireAdapter } from '@salesforce/wire-service-jest-util';
import BcmCapabilityMap from 'c/bcm_CapabilityMap';

const mockGetMaps = createTestWireAdapter();
const mockGetCapabilities = createTestWireAdapter();
const mockGetTags = createTestWireAdapter();

jest.mock('@salesforce/customPermission/bcm_CanEdit', () => false, { virtual: true });
jest.mock('@salesforce/apex/bcm_MapController.getMaps', () => mockGetMaps, { virtual: true });
jest.mock('@salesforce/apex/bcm_CapabilityController.getCapabilities', () => mockGetCapabilities, { virtual: true });
jest.mock('@salesforce/apex/bcm_TagController.getTags', () => mockGetTags, { virtual: true });

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
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
        mockGetCapabilities.emit({ data: [], error: undefined });
        await flushPromises();
        expect(element.zoom).toBe(1.0);
        expect(element.panX).toBe(0);
        expect(element.panY).toBe(0);
    });
});
