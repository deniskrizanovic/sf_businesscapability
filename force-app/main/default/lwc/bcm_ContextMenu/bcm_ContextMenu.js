import { LightningElement, api } from 'lwc';

export default class BcmContextMenu extends LightningElement {
    @api x    = 0;
    @api y    = 0;
    @api node = null;

    get menuPositionStyle() {
        return `position:absolute;left:${this.x}px;top:${this.y}px;z-index:9000;`;
    }

    connectedCallback() {
        this._handleDocClick  = this._onDocumentClick.bind(this);
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
        if (evt.key === 'Escape') {
            this._close();
        }
    }

    _close() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
