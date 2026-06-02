import { createElement } from 'lwc';
import BcmContextMenu from 'c/bcm_ContextMenu';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

function mount(node) {
    const element = createElement('c-bcm_-context-menu', { is: BcmContextMenu });
    element.anchorX = 100;
    element.anchorY = 100;
    element.node    = node;
    document.body.appendChild(element);
    return element;
}

function getMenuItems(element) {
    return element.shadowRoot.querySelectorAll('li.bcm-menu-item');
}

function getViewDetailItem(element) {
    const items = getMenuItems(element);
    for (const li of items) {
        if (li.textContent.includes('View detail')) return li;
    }
    return null;
}

function getHideItem(element) {
    const items = getMenuItems(element);
    for (const li of items) {
        if (li.textContent.includes('Hide')) return li;
    }
    return null;
}

function clickEl(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

describe('bcm_ContextMenu — View detail item visibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('Renders View detail for L1', () => {
        const element = mount({ id: 'L1-A', name: 'Capability A', level: 1 });
        expect(getViewDetailItem(element)).not.toBeNull();
    });

    it('Renders View detail for L2', () => {
        const element = mount({ id: 'L2-A1', name: 'Sub-Cap A1', level: 2 });
        expect(getViewDetailItem(element)).not.toBeNull();
    });

    it('Renders View detail for L3', () => {
        const element = mount({ id: 'L3-A1a', name: 'Detail A1a', level: 3 });
        expect(getViewDetailItem(element)).not.toBeNull();
    });

    it('Renders Hide item when canEdit is true', () => {
        const element = mount({ id: 'L1-A', name: 'Capability A', level: 1 });
        element.canEdit = true;
        return Promise.resolve().then(() => {
            expect(getHideItem(element)).not.toBeNull();
        });
    });

    it('Hides Hide item when canEdit is false', () => {
        const element = mount({ id: 'L1-A', name: 'Capability A', level: 1 });
        expect(getHideItem(element)).toBeNull();
    });
});

describe('bcm_ContextMenu — viewdetail event payload', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it.each([
        [1, { id: 'L1-A',   name: 'Capability A' }],
        [2, { id: 'L2-A1',  name: 'Sub-Cap A1'   }],
        [3, { id: 'L3-A1a', name: 'Detail A1a'   }],
    ])('Click View detail at level %i fires viewdetail with correct payload', async (level, base) => {
        const node = { ...base, level };
        const element = mount(node);

        const handler = jest.fn();
        element.addEventListener('viewdetail', handler);

        clickEl(getViewDetailItem(element));
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            id   : base.id,
            level,
            name : base.name,
        });
    });

    it('Click View detail also fires close event', async () => {
        const element = mount({ id: 'L1-A', name: 'Capability A', level: 1 });
        const closeHandler = jest.fn();
        element.addEventListener('close', closeHandler);

        clickEl(getViewDetailItem(element));
        await flushPromises();

        expect(closeHandler).toHaveBeenCalled();
    });
});

describe('bcm_ContextMenu — Hide regression', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it.each([1, 2, 3])('Click Hide at level %i still fires close', async (level) => {
        const element = mount({ id: 'X', name: 'X', level });
        element.canEdit = true;
        await flushPromises();
        const closeHandler = jest.fn();
        element.addEventListener('close', closeHandler);

        clickEl(getHideItem(element));
        await flushPromises();

        expect(closeHandler).toHaveBeenCalled();
    });
});
