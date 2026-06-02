import { LightningElement, api } from 'lwc';

export default class BcmContextMenu extends LightningElement {
    @api anchorX = 0;
    @api anchorY = 0;
    @api node    = null;  // { id, name, level }

    get menuTitle() {
        return this.node?.name || 'Actions';
    }

    get isL3() {
        return this.node?.level === 3;
    }

    // Position wrapper so left edge aligns with node's right edge,
    // vertically centred on anchorY (compensated after render via CSS transform)
    get wrapperStyle() {
        return `position:absolute;left:${this.anchorX}px;top:${this.anchorY}px;z-index:9000;transform:translateY(-50%);`;
    }

    connectedCallback() {
        this._handleDocClick   = this._onDocumentClick.bind(this);
        this._handleDocKeyDown = this._onDocumentKeyDown.bind(this);
        document.addEventListener('click',   this._handleDocClick);
        document.addEventListener('keydown', this._handleDocKeyDown);
    }

    disconnectedCallback() {
        document.removeEventListener('click',   this._handleDocClick);
        document.removeEventListener('keydown', this._handleDocKeyDown);
    }

    _onDocumentClick(evt) {
        if (!this.template.contains(evt.target)) {
            this._close();
        }
    }

    _onDocumentKeyDown(evt) {
        if (evt.key === 'Escape') this._close();
    }

    handleClose() {
        this._close();
    }

    handleViewDetail() {
        this.dispatchEvent(new CustomEvent('viewdetail', {
            detail: {
                id   : this.node?.id,
                level: this.node?.level,
                name : this.node?.name,
            },
        }));
        this._close();
    }

    handleHide() {
        this.dispatchEvent(new CustomEvent('hide', {
            detail: {
                id   : this.node?.id,
                level: this.node?.level,
                name : this.node?.name,
            },
        }));
        this._close();
    }

    _close() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
