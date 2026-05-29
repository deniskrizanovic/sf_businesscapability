import { LightningElement } from 'lwc';

export default class BcmVisualisationButton extends LightningElement {
    close() {
        this.dispatchEvent(new CustomEvent('closeactionpanel'));
    }
}
