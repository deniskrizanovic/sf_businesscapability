import { LightningElement, track, wire } from 'lwc';
import hasPermission from '@salesforce/customPermission/bcm_CanEdit';
import getMaps from '@salesforce/apex/bcm_MapController.getMaps';
import getCapabilities from '@salesforce/apex/bcm_CapabilityController.getCapabilities';
import getTags from '@salesforce/apex/bcm_TagController.getTags';

// ── Layout constants ──────────────────────────────────────────────────────────
const COLUMN_WIDTH      = 220;
const COLUMN_GAP        = 16;
const CHEVRON_HEIGHT    = 60;
const CHEVRON_NOTCH     = 16;
const BOX_PADDING       = 12;
const BOX_HEADER_HEIGHT = 40;
const LINE_HEIGHT       = 20;
const BOX_GAP           = 12;
const DIAGRAM_PADDING   = 24;
const FONT_SIZE_L1      = 13;
const FONT_SIZE_L2      = 12;
const FONT_SIZE_L3      = 11;

const ZOOM_MIN   = 0.2;
const ZOOM_MAX   = 3.0;
const ZOOM_STEP  = 0.1;
const ZOOM_DEFAULT = 1.0;

// ── Text wrap helper ──────────────────────────────────────────────────────────
function wrapText(text, maxWidth, fontSize, maxLines) {
    const charWidth  = fontSize * 0.6;
    const maxChars   = Math.floor(maxWidth / charWidth);
    const words      = String(text || '').split(' ');
    const lines      = [];
    let   current    = '';
    for (const word of words) {
        const candidate = current ? current + ' ' + word : word;
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
        if (lines.length >= maxLines) { current = ''; break; }
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
}

function truncateText(text, maxWidth, fontSize) {
    const charWidth = fontSize * 0.6;
    const maxChars  = Math.floor(maxWidth / charWidth);
    return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

export default class BcmCapabilityMap extends LightningElement {

    // ── Wired data ────────────────────────────────────────────────────────────
    @track mapOptions   = [];
    @track tagOptions   = [{ label: 'None', value: '' }];

    @wire(getMaps)
    wiredMaps({ data, error }) {
        if (data) {
            this.mapOptions = data.map(m => ({ label: m.Name, value: m.Id }));
        } else if (error) {
            this.errorMessage = error?.body?.message || 'Failed to load maps';
        }
    }

    @wire(getTags)
    wiredTags({ data, error }) {
        if (data) {
            this.tagOptions = [{ label: 'None', value: '' },
                ...data.map(t => ({ label: t.Name, value: t.Id, colour: t.bcm_Colour__c }))];
            this._tagColourMap = new Map(data.map(t => [t.Id, t.bcm_Colour__c]));
        } else if (error) {
            this.errorMessage = error?.body?.message || 'Failed to load tags';
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────
    @track selectedMapId         = null;
    @track selectedTagId         = '';
    @track highlightedNodeIds    = new Set();
    @track isLoading             = false;
    @track errorMessage          = null;
    @track zoom                  = ZOOM_DEFAULT;
    @track panX                  = 0;
    @track panY                  = 0;
    @track contextMenuVisible    = false;
    @track contextMenuX          = 0;
    @track contextMenuY          = 0;
    @track contextMenuNode       = null;

    _capabilities   = [];
    _tagColourMap   = new Map();
    _isDragging     = false;
    _dragStartX     = 0;
    _dragStartY     = 0;
    _panStartX      = 0;
    _panStartY      = 0;

    get canEdit() {
        return hasPermission;
    }

    // ── Computed SVG dimensions & transform ───────────────────────────────────
    get canvasWidth() {
        const cols = this._l1Roots?.length || 0;
        if (cols === 0) return 600;
        return DIAGRAM_PADDING * 2 + cols * COLUMN_WIDTH + Math.max(0, cols - 1) * COLUMN_GAP;
    }

    get canvasHeight() {
        const tallest = this._tallestColumnHeight || 0;
        return DIAGRAM_PADDING * 2 + CHEVRON_HEIGHT + BOX_GAP + tallest;
    }

    get viewportTransform() {
        return `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
    }

    // ── Tree & layout ─────────────────────────────────────────────────────────
    get l1Nodes() { return this._layoutL1 || []; }
    get l2Nodes() { return this._layoutL2 || []; }

    _buildLayout(capabilities) {
        if (!capabilities?.length) {
            this._l1Roots            = [];
            this._tallestColumnHeight = 0;
            this._layoutL1           = [];
            this._layoutL2           = [];
            return;
        }

        // Build id → node map
        const nodeMap = new Map();
        for (const cap of capabilities) {
            nodeMap.set(cap.Id, { ...cap, children: [] });
        }

        // Wire parent-child
        const roots = [];
        for (const cap of capabilities) {
            const node = nodeMap.get(cap.Id);
            if (cap.bcm_Parent__c && nodeMap.has(cap.bcm_Parent__c)) {
                nodeMap.get(cap.bcm_Parent__c).children.push(node);
            } else if (!cap.bcm_Parent__c) {
                roots.push(node);
            }
        }

        // Sort by SortOrder at each level
        const sortByOrder = arr => arr.sort((a, b) =>
            (a.bcm_SortOrder__c || 0) - (b.bcm_SortOrder__c || 0));
        sortByOrder(roots);
        for (const node of nodeMap.values()) {
            sortByOrder(node.children);
        }

        this._l1Roots = roots;

        // ── Layout L1 chevrons ───────────────────────────────────────────────
        const l1Nodes = [];
        const l2Nodes = [];
        let tallest   = 0;

        roots.forEach((l1, colIdx) => {
            const colX = DIAGRAM_PADDING + colIdx * (COLUMN_WIDTH + COLUMN_GAP);
            const x    = colX;
            const y    = DIAGRAM_PADDING;
            const w    = COLUMN_WIDTH;
            const h    = CHEVRON_HEIGHT;
            const n    = CHEVRON_NOTCH;
            const points = [
                `${x},${y}`,
                `${x + w - n},${y}`,
                `${x + w},${y + h / 2}`,
                `${x + w - n},${y + h}`,
                `${x},${y + h}`,
            ].join(' ');

            const labelMaxW = w - BOX_PADDING * 2;
            const textLines = wrapText(l1.Name, labelMaxW, FONT_SIZE_L1, 3);
            const lineSpacing = 16;
            const totalH      = textLines.length * lineSpacing;
            const startY      = y + h / 2 - totalH / 2 + lineSpacing / 2;

            l1Nodes.push({
                id        : l1.Id,
                points,
                fill      : '#4A4A4A',
                labelLines: textLines.map((text, i) => ({
                    key : l1.Id + '-label-' + i,
                    text,
                    x   : x + w / 2,
                    y   : startY + i * lineSpacing,
                })),
            });

            // ── Layout L2 boxes in this column ───────────────────────────────
            let boxY   = DIAGRAM_PADDING + CHEVRON_HEIGHT + BOX_GAP;
            let colH   = 0;

            for (const l2 of l1.children) {
                const l3Count   = l2.children?.length || 0;
                const boxHeight = BOX_HEADER_HEIGHT + l3Count * LINE_HEIGHT + BOX_PADDING * 2;

                // Tag fill
                const tagFill = this._getTagFill(l2.Id, l2.Tags__r);

                // L2 header text
                const l2MaxW   = COLUMN_WIDTH - BOX_PADDING * 2;
                const l2Lines  = wrapText(l2.Name, l2MaxW, FONT_SIZE_L2, 2);
                const l2StartY = boxY + BOX_PADDING + FONT_SIZE_L2 / 2;

                // L3 bullets
                const bulletLines = (l2.children || []).map((l3, bIdx) => {
                    const raw       = '• ' + l3.Name;
                    const maxBullet = COLUMN_WIDTH - BOX_PADDING * 2 - 8;
                    const text      = truncateText(raw, maxBullet, FONT_SIZE_L3);
                    return {
                        key  : l3.Id + '-bullet',
                        text,
                        x    : colX + BOX_PADDING + 8,
                        y    : boxY + BOX_HEADER_HEIGHT + bIdx * LINE_HEIGHT + LINE_HEIGHT / 2,
                    };
                });

                l2Nodes.push({
                    id         : l2.Id,
                    x          : colX,
                    y          : boxY,
                    width      : COLUMN_WIDTH,
                    height     : boxHeight,
                    fill       : tagFill,
                    labelLines : l2Lines.map((text, i) => ({
                        key  : l2.Id + '-label-' + i,
                        text,
                        x    : colX + BOX_PADDING,
                        y    : l2StartY + i * (FONT_SIZE_L2 + 4),
                    })),
                    bulletLines,
                });

                boxY += boxHeight + BOX_GAP;
                colH += boxHeight + BOX_GAP;
            }

            if (colH > tallest) tallest = colH;
        });

        this._tallestColumnHeight = tallest;
        this._layoutL1 = l1Nodes;
        this._layoutL2 = l2Nodes;
    }

    _getTagFill(capId, tagsRelation) {
        if (!this.selectedTagId) return '#FFFFFF';
        if (!tagsRelation?.length) return '#FFFFFF';
        for (const jct of tagsRelation) {
            if (jct.bcm_Tag__c === this.selectedTagId) {
                return this._tagColourMap.get(this.selectedTagId) || '#FFFFFF';
            }
        }
        return '#FFFFFF';
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    handleMapChange(evt) {
        this.selectedMapId     = evt.detail.value;
        this.contextMenuVisible = false;
        this._loadCapabilities();
    }

    handleTagChange(evt) {
        this.selectedTagId = evt.detail.value;
        this._buildLayout(this._capabilities);
    }

    _loadCapabilities() {
        if (!this.selectedMapId) return;
        this.isLoading    = true;
        this.errorMessage = null;
        getCapabilities({ mapId: this.selectedMapId })
            .then(data => {
                this._capabilities = data;
                this._buildLayout(data);
            })
            .catch(err => {
                this.errorMessage = err?.body?.message || 'Failed to load capabilities';
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleZoomIn() {
        this.zoom = Math.min(ZOOM_MAX, Math.round((this.zoom + ZOOM_STEP) * 10) / 10);
    }

    handleZoomOut() {
        this.zoom = Math.max(ZOOM_MIN, Math.round((this.zoom - ZOOM_STEP) * 10) / 10);
    }

    handleResetView() {
        this.zoom = ZOOM_DEFAULT;
        this.panX = 0;
        this.panY = 0;
    }

    handleWheel(evt) {
        evt.preventDefault();
        const delta    = evt.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        const newZoom  = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
            Math.round((this.zoom + delta) * 10) / 10));
        if (newZoom === this.zoom) return;

        // Zoom toward cursor
        const rect   = evt.currentTarget.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;
        this.panX    = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY    = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom    = newZoom;
    }

    handleSvgMouseDown(evt) {
        if (evt.target.closest('.bcm-node')) return;
        this._isDragging = true;
        this._dragStartX = evt.clientX;
        this._dragStartY = evt.clientY;
        this._panStartX  = this.panX;
        this._panStartY  = this.panY;
    }

    handleSvgMouseMove(evt) {
        if (!this._isDragging) return;
        this.panX = this._panStartX + (evt.clientX - this._dragStartX);
        this.panY = this._panStartY + (evt.clientY - this._dragStartY);
    }

    handleSvgMouseUp() {
        this._isDragging = false;
    }

    handleNodeClick(evt) {
        const nodeId = evt.currentTarget.dataset.nodeId;
        if (!nodeId) return;
        const rect          = this.template.querySelector('.bcm-canvas-container').getBoundingClientRect();
        this.contextMenuX   = evt.clientX - rect.left;
        this.contextMenuY   = evt.clientY - rect.top;
        this.contextMenuNode = nodeId;
        this.contextMenuVisible = true;
    }

    handleContextMenuClose() {
        this.contextMenuVisible = false;
    }
}
