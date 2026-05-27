import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

const COLOUR_LABELS = {
    '#3A86FF': 'Blue',
    '#2DC653': 'Green',
    '#E63946': 'Red',
    '#7B2FBE': 'Purple',
    '#FB5607': 'Orange',
    '#0096C7': 'Teal',
    '#FF006E': 'Pink',
    '#FFBE0B': 'Amber',
    '#4361EE': 'Indigo',
    '#06A77D': 'Emerald'
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
