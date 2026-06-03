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

function mount({ capability = null, breadcrumb = [], isLoading = false, errorMessage = null, canEdit = false } = {}) {
    const element = createElement('c-bcm_-capability-detail', { is: BcmCapabilityDetail });
    element.capability   = capability;
    element.breadcrumb   = breadcrumb;
    element.isLoading    = isLoading;
    element.errorMessage = errorMessage;
    element.canEdit      = canEdit;
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

    it('Read mode has no Save / Cancel buttons', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB });
        const buttons = el.shadowRoot.querySelectorAll('lightning-button');
        for (const btn of buttons) {
            const label = (btn.label || '').toLowerCase();
            expect(label).not.toBe('save');
            expect(label).not.toBe('cancel');
        }
    });
});

describe('bcm_CapabilityDetail edit mode', () => {
    it('Viewer (canEdit=false) sees no Edit button', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: false });
        expect(el.shadowRoot.querySelector('.bcm-detail-edit')).toBeNull();
    });

    it('Editor (canEdit=true) sees Edit button in read mode', () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        expect(el.shadowRoot.querySelector('.bcm-detail-edit')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-save')).toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-cancel')).toBeNull();
    });

    it('Click Edit shows inputs and Save+Cancel; hides Edit', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-definition')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-strategy')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-nuance')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-save')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-cancel')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-edit')).toBeNull();
    });

    it('Save fires saved event with draft payload', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        const handler = jest.fn();
        el.addEventListener('saved', handler);

        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        // Mutate name draft — set value then fire change event; handler reads evt.target.value
        const nameInput = el.shadowRoot.querySelector('.bcm-detail-input-name');
        nameInput.value = 'Edited Name';
        nameInput.dispatchEvent(new CustomEvent('change'));
        await flushPromises();

        el.shadowRoot.querySelector('.bcm-detail-save')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0].detail;
        expect(payload.id).toBe('L2-1');
        expect(payload.name).toBe('Edited Name');
        expect(payload.definition).toBe('<p>Definition body</p>');
        expect(payload.strategySupport).toBe('<p>Strategy body</p>');
        expect(payload.architecturalNuance).toBe('<p>Nuance body</p>');
        expect(payload.hideFromDiagram).toBe(false);
    });

    it('Save keeps edit mode until parent re-feeds capability prop (success path)', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        el.shadowRoot.querySelector('.bcm-detail-save')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        // Still in edit mode immediately after Save dispatch — parent has not confirmed yet
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).not.toBeNull();

        // Parent re-feeds same id with no error -> exit edit mode
        el.capability = { ...SAMPLE_CAPABILITY, Name: 'Edited' };
        await flushPromises();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-name')).not.toBeNull();
    });

    it('Save error keeps edit mode and surfaces error message', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        el.shadowRoot.querySelector('.bcm-detail-save')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        // Parent surfaces error — edit mode must remain so drafts are not lost
        el.errorMessage = 'Save failed';
        el.capability = { ...SAMPLE_CAPABILITY };
        await flushPromises();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).not.toBeNull();
        const err = el.shadowRoot.querySelector('.bcm-detail-error');
        expect(err).not.toBeNull();
        expect(err.textContent).toContain('Save failed');
    });

    it('Switching to a different capability id resets edit mode to read', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).not.toBeNull();

        el.capability = { ...SAMPLE_CAPABILITY, Id: 'L2-OTHER', Name: 'Other' };
        await flushPromises();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-name')).not.toBeNull();
    });

    it('Cancel reverts to read mode without firing saved', async () => {
        const el = mount({ capability: SAMPLE_CAPABILITY, breadcrumb: SAMPLE_BREADCRUMB, canEdit: true });
        const handler = jest.fn();
        el.addEventListener('saved', handler);

        el.shadowRoot.querySelector('.bcm-detail-edit')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();
        el.shadowRoot.querySelector('.bcm-detail-cancel')
            .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await flushPromises();

        expect(handler).not.toHaveBeenCalled();
        // Read-mode markers re-appear
        expect(el.shadowRoot.querySelector('.bcm-detail-name')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.bcm-detail-input-name')).toBeNull();
        // Read-mode shows the original (unedited) name
        expect(el.shadowRoot.querySelector('.bcm-detail-name').textContent).toBe('Sub-Capability A');
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
