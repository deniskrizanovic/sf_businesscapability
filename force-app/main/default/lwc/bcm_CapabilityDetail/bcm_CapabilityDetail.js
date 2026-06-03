import { LightningElement, api, track } from 'lwc';

export default class BcmCapabilityDetail extends LightningElement {
    _capability = null;
    _savePending = false;
    @api
    get capability() { return this._capability; }
    set capability(val) {
        const prev = this._capability;
        this._capability = val;
        // Exit edit mode when:
        //  - panel switched to a different capability, OR
        //  - in-flight save just resolved (same id, fresh record returned by parent).
        // Stay in edit mode if save errored — caller leaves _savePending true and
        //   surfaces errorMessage; user keeps drafts to retry.
        const idChanged = val?.Id !== prev?.Id;
        if (idChanged) {
            this.editMode    = false;
            this._savePending = false;
        } else if (this._savePending && val && prev && !this.errorMessage) {
            this.editMode    = false;
            this._savePending = false;
        }
    }
    @api breadcrumb = [];
    @api isLoading = false;
    @api errorMessage = null;
    @api canEdit = false;

    @track editMode = false;
    @track draftName;
    @track draftDefinition;
    @track draftStrategy;
    @track draftNuance;
    @track draftHide;

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

    get canShowEditButton() {
        return this.canEdit && this.hasContent && !this.editMode;
    }

    get isReadMode() {
        return this.hasContent && !this.editMode;
    }

    get isEditMode() {
        return this.hasContent && this.editMode;
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
        const arr = this.breadcrumb || [];
        return arr.map((seg, idx) => ({
            ...seg,
            isLast: idx === arr.length - 1,
            indentStyle: `padding-left:${idx * 12}px;`,
        }));
    }

    connectedCallback() {
        this._handleDocKeyDown = this._onDocumentKeyDown.bind(this);
        document.addEventListener('keydown', this._handleDocKeyDown);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._handleDocKeyDown);
        if (this._growTimeout) {
            clearTimeout(this._growTimeout);
            this._growTimeout = null;
        }
    }

    _onDocumentKeyDown(evt) {
        if (evt.key === 'Escape' && this.isOpen) {
            this.handleClose();
        }
    }

    handleClose() {
        this.editMode = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleEdit() {
        if (!this.canEdit || !this.capability) return;
        const panel = this.template.querySelector('.bcm-detail-panel');
        this._pendingGrowFrom = panel ? panel.getBoundingClientRect().height : null;
        this.draftName       = this.capability.Name;
        this.draftDefinition = this.capability.bcm_Definition__c;
        this.draftStrategy   = this.capability.bcm_StrategySupport__c;
        this.draftNuance     = this.capability.bcm_ArchitecturalNuance__c;
        this.draftHide       = !!this.capability.bcm_HideFromDiagram__c;
        this.editMode        = true;
    }

    renderedCallback() {
        if (this._pendingGrowFrom == null) return;
        const fromH = this._pendingGrowFrom;
        this._pendingGrowFrom = null;
        const panel = this.template.querySelector('.bcm-detail-panel');
        if (!panel) return;
        const toH = panel.scrollHeight;
        panel.style.maxHeight = fromH + 'px';
        panel.style.overflowY = 'hidden';
        void panel.offsetHeight;
        panel.style.transition = 'max-height 320ms ease';
        panel.style.maxHeight = toH + 'px';
        let done = false;
        const cleanup = () => {
            if (done) return;
            done = true;
            panel.style.transition = '';
            panel.style.maxHeight = '';
            panel.style.overflowY = '';
            panel.removeEventListener('transitionend', cleanup);
            if (this._growTimeout) clearTimeout(this._growTimeout);
            this._growTimeout = null;
        };
        panel.addEventListener('transitionend', cleanup);
        // Fallback: transitionend may not fire if interrupted (panel close, rapid re-edit)
        this._growTimeout = setTimeout(cleanup, 400);
    }

    handleNameChange(evt)        { this.draftName       = evt.target.value; }
    handleDefinitionChange(evt)  { this.draftDefinition = evt.target.value; }
    handleStrategyChange(evt)    { this.draftStrategy   = evt.target.value; }
    handleNuanceChange(evt)      { this.draftNuance     = evt.target.value; }
    handleHideChange(evt)        { this.draftHide       = evt.target.checked; }

    handleCancel() {
        this.editMode = false;
        this._savePending = false;
    }

    handleSave() {
        if (!this.canEdit || !this.capability) return;
        this._savePending = true;
        this.dispatchEvent(new CustomEvent('saved', {
            detail: {
                id                  : this.capability.Id,
                name                : this.draftName,
                definition          : this.draftDefinition,
                strategySupport     : this.draftStrategy,
                architecturalNuance : this.draftNuance,
                hideFromDiagram     : this.draftHide,
            },
        }));
        // editMode stays true until parent re-feeds the capability prop with
        // a successful save (handled in the capability setter).
    }
}
