import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

const COLOUR_LABELS = {
    '#A8C7FF': 'Blue',
    '#B8E0C8': 'Green',
    '#F8B4B4': 'Red',
    '#D8C4EC': 'Purple',
    '#FFD4A8': 'Orange',
    '#B8DCDC': 'Teal',
    '#FFC8DC': 'Pink',
    '#FFE4A8': 'Amber',
    '#C4C8F0': 'Indigo',
    '#B8E0C0': 'Emerald'
};

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
