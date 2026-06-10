import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { BCM_TAG_PRESETS } from 'c/bcm_VisualTokens';

const COLOUR_LABELS = Object.fromEntries(BCM_TAG_PRESETS.map((p) => [p.hex, p.label]));

export default class BcmColourSwatch extends LightningElement {
    @api recordId;
    @api colourField = 'bcm_Tag__c.bcm_Colour__c';

    @track _colour;

    @wire(getRecord, { recordId: '$recordId', fields: '$_fields' })
    wiredRecord({ data }) {
        if (data) {
            const fieldParts = this.colourField.split('.');
            const fieldRef = fieldParts[fieldParts.length - 1];
            const objFields = data.fields;
            this._colour = objFields[fieldRef]?.value ?? null;
        }
    }

    get _fields() {
        return this.colourField ? [this.colourField] : [];
    }

    get colour() {
        return this._colour;
    }

    get label() {
        return COLOUR_LABELS[this._colour] || this._colour || '';
    }

    get swatchStyle() {
        return `background-color: ${this._colour};`;
    }
}
