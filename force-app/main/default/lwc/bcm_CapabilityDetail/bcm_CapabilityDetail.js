import { LightningElement, api } from 'lwc';

export default class BcmCapabilityDetail extends LightningElement {
    @api capability = null;
    @api breadcrumb = [];
    @api isLoading = false;
    @api errorMessage = null;

    get isOpen() {
        return this.isLoading || this.capability != null || this.hasError;
    }

    get isClosed() {
        return !this.isOpen;
    }

    get openAttr() {
        return this.isOpen ? 'true' : 'false';
    }

    get hasError() {
        return this.errorMessage != null;
    }

    get level() {
        return this.capability?.bcm_Level__c;
    }

    get levelBadge() {
        const lvl = this.level;
        return lvl == null ? '' : `L${lvl}`;
    }

    get name() {
        return this.capability?.Name;
    }

    get definition() {
        return this.capability?.bcm_Definition__c;
    }

    get strategySupport() {
        return this.capability?.bcm_StrategySupport__c;
    }

    get architecturalNuance() {
        return this.capability?.bcm_ArchitecturalNuance__c;
    }

    get hideFromDiagramText() {
        return this.capability?.bcm_HideFromDiagram__c ? 'Yes' : 'No';
    }

    get hasContent() {
        return !this.isLoading && this.capability != null;
    }

    get tags() {
        const junctions = this.capability?.Tags__r || [];
        return junctions.map(j => ({
            id: j.bcm_Tag__c,
            name: j.bcm_Tag__r?.Name,
            style: `background-color:${j.bcm_Tag__r?.bcm_Colour__c || '#ccc'};`,
        }));
    }

    get hasTags() {
        return (this.capability?.Tags__r || []).length > 0;
    }

    get breadcrumbItems() {
        return (this.breadcrumb || []).map((seg, idx, arr) => ({
            ...seg,
            isLast: idx === arr.length - 1,
        }));
    }

    connectedCallback() {
        this._handleDocKeyDown = this._onDocumentKeyDown.bind(this);
        document.addEventListener('keydown', this._handleDocKeyDown);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._handleDocKeyDown);
    }

    _onDocumentKeyDown(evt) {
        if (evt.key === 'Escape' && this.isOpen) {
            this.handleClose();
        }
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
