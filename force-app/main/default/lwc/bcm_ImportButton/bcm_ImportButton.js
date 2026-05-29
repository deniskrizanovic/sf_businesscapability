import { LightningElement } from 'lwc';

export default class BcmImportButton extends LightningElement {
    close() {
        this.dispatchEvent(new CustomEvent('closeactionpanel'));
    }
}
