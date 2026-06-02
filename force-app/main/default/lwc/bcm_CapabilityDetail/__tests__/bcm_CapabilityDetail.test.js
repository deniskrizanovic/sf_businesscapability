import { createElement } from 'lwc';
import BcmCapabilityDetail from 'c/bcm_CapabilityDetail';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

const SAMPLE_CAPABILITY = {
    Id: 'L2-1',
    Name: 'Sub-Capability A',
    bcm_Level__c: 2,
    bcm_Definition__c: '<p>Definition body</p>',
    bcm_StrategySupport__c: '<p>Strategy body</p>',
    bcm_ArchitecturalNuance__c: '<p>Nuance body</p>',
    bcm_HideFromDiagram__c: false,
    Tags__r: [],
};

const SAMPLE_BREADCRUMB = [
    { id: 'L1-1', label: 'Capability A' },
    { id: 'L2-1', label: 'Sub-Capability A' },
];

function mount({ capability = null, breadcrumb = [], isLoading = false, errorMessage = null } = {}) {
    const element = createElement('c-bcm_-capability-detail', { is: BcmCapabilityDetail });
    element.capability   = capability;
    element.breadcrumb   = breadcrumb;
    element.isLoading    = isLoading;
    element.errorMessage = errorMessage;
    document.body.appendChild(element);
    return element;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('bcm_CapabilityDetail rendering', () => {
    it('Renders breadcrumb segments', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const segs = el.shadowRoot.querySelectorAll('.bcm-detail-breadcrumb-segment');
        expect(segs.length).toBe(2);
        expect(segs[0].textContent).toContain('Capability A');
        expect(segs[1].textContent).toContain('Sub-Capability A');
    });

    it('Renders level badge L<level>', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const badge = el.shadowRoot.querySelector('.bcm-detail-level-badge');
        expect(badge.textContent).toBe('L2');
    });

    it('Renders capability name', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const name = el.shadowRoot.querySelector('.bcm-detail-name');
        expect(name.textContent).toBe('Sub-Capability A');
    });

    it('Renders all detail fields', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const labels = Array.from(el.shadowRoot.querySelectorAll('.bcm-detail-field-label'))
            .map(n => n.textContent);
        expect(labels).toEqual(
            expect.arrayContaining(['Definition', 'Strategy Support', 'Architectural Nuance', 'Hide From Diagram'])
        );
    });

    it('Hide From Diagram shows "No" when false', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const value = el.shadowRoot.querySelector('.bcm-detail-field-value');
        expect(value.textContent).toBe('No');
    });

    it('Hide From Diagram shows "Yes" when true', () => {
        const el = mount({
            capability: { ...SAMPLE_CAPABILITY, bcm_HideFromDiagram__c: true },
            breadcrumb: SAMPLE_BREADCRUMB,
        });
        const value = el.shadowRoot.querySelector('.bcm-detail-field-value');
        expect(value.textContent).toBe('Yes');
    });

    it('Loading shows spinner and hides body', () => {
        const el = mount({ isLoading: true });
        const spinner = el.shadowRoot.querySelector('lightning-spinner');
        const body    = el.shadowRoot.querySelector('.bcm-detail-body');
        expect(spinner).not.toBeNull();
        expect(body).toBeNull();
    });

    it('Empty state: capability null and not loading -> no body fields', () => {
        const el = mount({});
        const body = el.shadowRoot.querySelector('.bcm-detail-body');
        expect(body).toBeNull();
    });

    it('Has data-open="true" when capability set', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY });
        const panel = el.shadowRoot.querySelector('.bcm-detail-panel');
        expect(panel.getAttribute('data-open')).toBe('true');
    });

    it('Has data-open="false" when no capability and not loading', () => {
        const el = mount({});
        const panel = el.shadowRoot.querySelector('.bcm-detail-panel');
        expect(panel.getAttribute('data-open')).toBe('false');
    });

    it('aria-hidden true when closed, false when open', () => {
        const closed = mount({});
        expect(closed.shadowRoot.querySelector('.bcm-detail-panel').getAttribute('aria-hidden')).toBe('true');
        const open = mount({ capability: SAMPLE_CAPABILITY });
        expect(open.shadowRoot.querySelector('.bcm-detail-panel').getAttribute('aria-hidden')).toBe('false');
    });

    it('Renders error message when errorMessage set', () => {
        const el = mount({ errorMessage: 'Failed to load capability detail' });
        const err = el.shadowRoot.querySelector('.bcm-detail-error');
        expect(err).not.toBeNull();
        expect(err.textContent).toContain('Failed to load capability detail');
    });

    it('No Save / Cancel buttons rendered (read-only scope)', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const buttons = el.shadowRoot.querySelectorAll('lightning-button');
        for (const btn of buttons) {
            const label = (btn.label || '').toLowerCase();
            expect(label).not.toBe('save');
            expect(label).not.toBe('cancel');
        }
    });
});

describe('bcm_CapabilityDetail close behaviour', () => {
    it('X click fires close event', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY });
        const handler = jest.fn();
        el.addEventListener('close', handler);
        const closeBtn = el.shadowRoot.querySelector('.bcm-detail-close');
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('Escape keydown while open fires close event', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY });
        const handler = jest.fn();
        el.addEventListener('close', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flushPromises();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('Escape keydown while closed does not fire close', async () => {
        const el = mount({});
        const handler = jest.fn();
        el.addEventListener('close', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flushPromises();
        expect(handler).not.toHaveBeenCalled();
    });
});
