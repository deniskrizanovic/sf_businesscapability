import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import COLOUR_FIELD from '@salesforce/schema/bcm_Tag__c.bcm_Colour__c';

const FIELDS = [COLOUR_FIELD];

// Maps stored hex values back to human-readable labels for display
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

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    record;

    get colour() {
        return getFieldValue(this.record.data, COLOUR_FIELD);
    }

    get label() {
        return COLOUR_LABELS[this.colour] || this.colour;
    }

    get swatchStyle() {
        return `background-color: ${this.colour}; width: 1.25rem; height: 1.25rem; border-radius: 50%; display: inline-block; border: 1px solid rgba(0,0,0,0.15);`;
    }
}
