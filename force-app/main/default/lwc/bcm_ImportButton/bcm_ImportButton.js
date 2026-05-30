import { LightningElement } from 'lwc';

export default class BcmImportButton extends LightningElement {
    handleStatusChange(event) {
        const s = event.detail.status;
        if (s === 'FINISHED' || s === 'FINISHED_SCREEN') {
            this.dispatchEvent(new CustomEvent('closeactionpanel'));
        }
    }
}
