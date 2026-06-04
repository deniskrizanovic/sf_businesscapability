import { LightningElement, api, track, wire } from 'lwc';
import hasPermission from '@salesforce/customPermission/bcm_CanEdit';
import getMaps from '@salesforce/apex/bcm_MapController.getMaps';
import getCapabilities from '@salesforce/apex/bcm_CapabilityController.getCapabilities';
import getCapabilityDetail from '@salesforce/apex/bcm_CapabilityController.getCapabilityDetail';
import getTags from '@salesforce/apex/bcm_TagController.getTags';
import updateCapability from '@salesforce/apex/bcm_CapabilityController.updateCapability';

// ── Layout constants ──────────────────────────────────────────────────────────
const COLUMN_WIDTH      = 220;
const COLUMN_GAP        = 16;
const CHEVRON_HEIGHT    = 60;
const CHEVRON_NOTCH     = 16;
const BOX_PADDING       = 12;
const LINE_HEIGHT       = 20;
const BOX_GAP           = 12;
const DIAGRAM_PADDING   = 24;
const FONT_SIZE_L1      = 13;
const FONT_SIZE_L2      = 12;
const FONT_SIZE_L3      = 11;
const BULLET_INDENT     = Math.round(FONT_SIZE_L3 * 0.6 * 2);

// Cross-cutting band layered visual
const BAND_ROW_OVERLAP    = 12;
const BAND_NOTCH          = CHEVRON_NOTCH * 2;
const BAND_LABEL_PAD_X    = 18;
const BAND_LABEL_PAD_BOTTOM = 8;
const BAND_PALETTE        = ['#1a3d6b', '#2b4f7a', '#3f6492', '#587bad'];

const ZOOM_MIN   = 0.2;
const ZOOM_MAX   = 3.0;
const ZOOM_STEP  = 0.1;
const ZOOM_DEFAULT = 1.0;

const SESSION_KEY_SELECTED_MAP = 'bcm.visualisation.selectedMapId';

function safeSessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
}

function safeSessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) { /* silent */ }
}

function safeSessionRemove(key) {
    try { sessionStorage.removeItem(key); } catch (_) { /* silent */ }
}

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


export default class BcmCapabilityMap extends LightningElement {

    // ── Wired data ────────────────────────────────────────────────────────────
    @track mapOptions   = [];
    @track tagOptions   = [{ label: 'None', value: '' }];

    @wire(getMaps)
    wiredMaps({ data, error }) {
        if (data) {
            this.mapOptions = data.map(m => ({ label: m.Name, value: m.Id }));
            this._maybeRestoreSelectedMap();
        } else if (error) {
            this.errorMessage = error?.body?.message || 'Failed to load maps';
        }
    }

    _maybeRestoreSelectedMap() {
        if (this._restoreAttempted) return;
        this._restoreAttempted = true;
        const persistedId = safeSessionGet(SESSION_KEY_SELECTED_MAP);
        if (!persistedId) return;
        const isValid = this.mapOptions.some(opt => opt.value === persistedId);
        if (!isValid) {
            safeSessionRemove(SESSION_KEY_SELECTED_MAP);
            return;
        }
        this.selectedMapId = persistedId;
        this._loadCapabilities();
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
    @track _zoom                 = ZOOM_DEFAULT;
    @track _panX                 = 0;
    @track _panY                 = 0;
    @track showHidden            = false;
    @track showCrossCutting      = false;
    @track focusedNodeId         = null;
    @track _layoutL1             = [];
    @track _layoutL2             = [];
    @track _layoutBand           = [];
    @track detailCapability      = null;
    @track detailBreadcrumb      = [];
    @track detailIsLoading       = false;
    @track detailErrorMessage    = null;
    _detailRequestSeq            = 0;

    _capabilities   = [];
    _tagColourMap   = new Map();
    _keyNavMode     = false;
    _isDragging     = false;
    _dragStartX     = 0;
    _dragStartY     = 0;
    _panStartX      = 0;
    _panStartY      = 0;
    _restoreAttempted = false;

    @api get zoom() { return this._zoom; }
    set zoom(v)      { this._zoom = v; }

    @api get panX()  { return this._panX; }
    set panX(v)      { this._panX = v; }

    @api get panY()  { return this._panY; }
    set panY(v)      { this._panY = v; }

    get canEdit() {
        return hasPermission;
    }

    get showHiddenVariant() {
        return this.showHidden ? 'brand' : 'border';
    }

    get crossCuttingVariant() {
        return this.showCrossCutting ? 'brand' : 'border';
    }

    // ── Computed SVG dimensions & transform ───────────────────────────────────
    get canvasWidth() {
        const roots = this._l1Roots || [];
        const cols  = this.showHidden
            ? roots.length
            : roots.filter(r => !r._hidden).length;
        const colWidth = cols > 0
            ? DIAGRAM_PADDING * 2 + cols * COLUMN_WIDTH + Math.max(0, cols - 1) * COLUMN_GAP
            : 0;
        return colWidth === 0 ? 600 : colWidth;
    }

    get canvasHeight() {
        const tallest = this._tallestColumnHeight || 0;
        const nrows   = this._ccRootCount || 0;
        const hasRegular = (this._l1Roots || []).length > 0;
        const headerReserved = hasRegular ? CHEVRON_HEIGHT + BOX_GAP : 0;
        const bandReserved = (this.showCrossCutting && nrows > 0)
            ? nrows * CHEVRON_HEIGHT - (nrows - 1) * BAND_ROW_OVERLAP + BOX_GAP
            : 0;
        return DIAGRAM_PADDING * 2 + headerReserved + tallest + bandReserved;
    }

    get viewportTransform() {
        return `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
    }

    get l1Transform() {
        return `translate(${this.panX}, 0) scale(${this.zoom})`;
    }

    get bandTransform() {
        return `translate(${this.panX}, 0) scale(${this.zoom})`;
    }

    get l2ClipY() {
        return (DIAGRAM_PADDING + CHEVRON_HEIGHT) * this.zoom;
    }

    // ── Tree & layout ─────────────────────────────────────────────────────────
    get l1Nodes() { return this._layoutL1 || []; }
    get l2Nodes() { return this._layoutL2 || []; }
    get bandNodes() { return this._layoutBand || []; }

    _buildLayout(capabilities) {
        if (!capabilities?.length) {
            this._l1Roots            = [];
            this._tallestColumnHeight = 0;
            this._layoutL1           = [];
            this._layoutL2           = [];
            this._layoutBand         = [];
            this._ccRootCount        = 0;
            this._colMap             = {};
            this._l2ByCol            = {};
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

        // ── Partition cross-cutting L1s into the band layer ──────────────────
        const ccRoots      = roots.filter(r => r.bcm_IsCrossCutting__c);
        const regularRoots = roots.filter(r => !r.bcm_IsCrossCutting__c);
        this._ccRootCount  = ccRoots.length;
        this._l1Roots      = regularRoots;

        // ── Two-pass hidden cascade ──────────────────────────────────────────
        // Pass 1: mark nodes explicitly hidden
        for (const node of nodeMap.values()) {
            node._hidden = !!node.bcm_HideFromDiagram__c;
        }
        // Pass 2: propagate hide to children (BFS from roots)
        const queue = [...roots];
        while (queue.length) {
            const n = queue.shift();
            for (const child of n.children) {
                if (n._hidden) child._hidden = true;
                queue.push(child);
            }
        }

        // ── Layout L1 chevrons ───────────────────────────────────────────────
        const l1Nodes = [];
        const l2Nodes = [];
        let tallest   = 0;
        const colMap   = {};   // colIdx → l1 id
        const l2ByCol  = {};   // colIdx → [l2 ids]

        let visibleColIdx = 0;
        regularRoots.forEach((l1) => {
            // Skip hidden L1 when toggle is OFF
            if (l1._hidden && !this.showHidden) return;

            const colIdx = visibleColIdx++;
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
            const l1Dashed  = l1._hidden && this.showHidden;
            const l1Focused = l1.Id === this.focusedNodeId;
            colMap[colIdx]  = l1.Id;
            l2ByCol[colIdx] = [];

            l1Nodes.push({
                id          : l1.Id,
                name        : l1.Name,
                colIdx,
                isFocused   : l1Focused,
                fill        : l1Focused ? '#2A2A2A' : '#4A4A4A',
                strokeColour: l1Focused ? '#0070D2' : '#333333',
                strokeWidth : l1Focused ? '3' : '1',
                strokeDash  : l1Dashed ? '4 2' : '',
                points,
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
                // Skip hidden L2 when toggle is OFF
                if (l2._hidden && !this.showHidden) continue;

                // Tag fill
                const tagFill = this._getTagFill(l2.Id, l2.Tags__r);

                // L2 header — uncapped wrap, dynamic height
                const l2MaxW      = COLUMN_WIDTH - BOX_PADDING * 2;
                const l2Lines     = wrapText(l2.Name, l2MaxW, FONT_SIZE_L2, 10);
                const headerHeight = l2Lines.length * (FONT_SIZE_L2 + 4) + BOX_PADDING * 2;
                const l2StartY    = boxY + BOX_PADDING + FONT_SIZE_L2 / 2;

                // L3 bullets — hanging indent: first line gets "• ", continuations indented
                const bulletBaseX    = colX + BOX_PADDING + 8;
                const bulletContX    = bulletBaseX + BULLET_INDENT;
                const maxBulletFirst = COLUMN_WIDTH - BOX_PADDING * 2 - 8;
                const maxBulletCont  = maxBulletFirst - BULLET_INDENT;
                const bulletGroups = [];
                let   bulletY   = boxY + headerHeight;
                for (const l3 of (l2.children || [])) {
                    if (l3._hidden && !this.showHidden) continue;
                    const allLines = wrapText(l3.Name, maxBulletFirst, FONT_SIZE_L3, 5);
                    const l3Focused = l3.Id === this.focusedNodeId;
                    const l3Dashed  = l3._hidden && this.showHidden;
                    const fontWeight = l3Focused ? 'bold' : 'normal';
                    const fontStyle  = l3Dashed ? 'italic' : 'normal';
                    const fillColour = l3Dashed ? '#999' : '#222';
                    const focusRectStartY = bulletY;
                    const lines = allLines.map((text, wIdx) => {
                        const line = {
                            key         : l3.Id + '-bullet-' + wIdx,
                            isFocused   : l3Focused,
                            fontWeight,
                            fontStyle,
                            fill        : fillColour,
                            text        : wIdx === 0 ? '• ' + text : text,
                            x           : wIdx === 0 ? bulletBaseX : bulletContX,
                            y           : bulletY + LINE_HEIGHT / 2,
                        };
                        bulletY += LINE_HEIGHT;
                        return line;
                    });
                    bulletGroups.push({
                        key       : l3.Id + '-group',
                        l3Id      : l3.Id,
                        l3Name    : l3.Name,
                        isFocused : l3Focused,
                        lines,
                        focusRect : l3Focused ? {
                            x     : bulletBaseX - 4,
                            y     : focusRectStartY,
                            width : COLUMN_WIDTH - BOX_PADDING * 2 - 8,
                            height: allLines.length * LINE_HEIGHT - 2,
                        } : null,
                    });
                }

                const boxHeight = headerHeight + (bulletY - (boxY + headerHeight)) + BOX_PADDING;

                const l2Dashed  = l2._hidden && this.showHidden;
                const l2Focused = l2.Id === this.focusedNodeId;
                const rowIdx    = l2ByCol[colIdx].length;
                l2ByCol[colIdx].push(l2.Id);

                l2Nodes.push({
                    id          : l2.Id,
                    name        : l2.Name,
                    colIdx,
                    rowIdx,
                    isFocused   : l2Focused,
                    x           : colX,
                    y           : boxY,
                    width       : COLUMN_WIDTH,
                    height      : boxHeight,
                    fill        : l2Focused ? '#E8F4FF' : tagFill,
                    strokeColour: l2Focused ? '#0070D2' : '#CCCCCC',
                    strokeWidth : l2Focused ? '3' : '1',
                    strokeDash  : l2Dashed ? '4 2' : '',
                    labelLines : l2Lines.map((text, i) => ({
                        key  : l2.Id + '-label-' + i,
                        text,
                        x    : colX + BOX_PADDING,
                        y    : l2StartY + i * (FONT_SIZE_L2 + 4),
                    })),
                    bulletGroups,
                });

                boxY += boxHeight + BOX_GAP;
                colH += boxHeight + BOX_GAP;
            }

            if (colH > tallest) tallest = colH;
        });

        this._tallestColumnHeight = tallest;
        this._layoutL1 = l1Nodes;
        this._layoutL2 = l2Nodes;
        this._colMap   = colMap;
        this._l2ByCol  = l2ByCol;

        // Build L3 lookup: id → {name, anchorX, anchorY, parentL2Id, siblingIdx}
        // Also build l3ByL2: l2Id → ordered [l3Id, ...] for sibling navigation
        const l3Map  = new Map();
        const l3ByL2 = new Map();
        for (const l2 of l2Nodes) {
            const siblings = [];
            for (const group of l2.bulletGroups) {
                l3Map.set(group.l3Id, {
                    name      : group.l3Name,
                    anchorX   : l2.x + l2.width,
                    anchorY   : group.lines[0].y,
                    parentL2Id: l2.id,
                    siblingIdx: siblings.length,
                });
                siblings.push(group.l3Id);
            }
            l3ByL2.set(l2.id, siblings);
        }
        this._layoutL3Map = l3Map;
        this._l3ByL2      = l3ByL2;

        // ── Build cross-cutting band (layered full-width chevrons) ───────────
        const bandNodes = [];
        if (ccRoots.length) {
            // Span full column area: x = DIAGRAM_PADDING, width = canvasWidth - 2*pad
            const bandX = DIAGRAM_PADDING;
            const bandW = this.canvasWidth - DIAGRAM_PADDING * 2;
            // cc-only map (zero regularRoots) -> drop the empty L1-row reservation
            const headerReserved = regularRoots.length ? CHEVRON_HEIGHT + BOX_GAP : 0;
            const bandTopY = DIAGRAM_PADDING + headerReserved + tallest + BOX_GAP;
            const h = CHEVRON_HEIGHT;
            const n = BAND_NOTCH;

            // Iterate reverse so bandNodes[0] = bottom-most row (drawn first → painted behind);
            // sortOrder 1 ends up DOM-last → on top of stack.
            for (let i = ccRoots.length - 1; i >= 0; i--) {
                const cc = ccRoots[i];
                const y  = bandTopY + i * (h - BAND_ROW_OVERLAP);
                const points = [
                    `${bandX},${y}`,
                    `${bandX + bandW - n},${y}`,
                    `${bandX + bandW},${y + h / 2}`,
                    `${bandX + bandW - n},${y + h}`,
                    `${bandX},${y + h}`,
                ].join(' ');
                bandNodes.push({
                    id    : cc.Id,
                    name  : cc.Name,
                    label : String(cc.Name || '').toUpperCase(),
                    fill  : BAND_PALETTE[i % BAND_PALETTE.length],
                    points,
                    labelX: bandX + BAND_LABEL_PAD_X,
                    labelY: y + h - BAND_LABEL_PAD_BOTTOM,
                });
            }
        }
        this._layoutBand = bandNodes;
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
        this.selectedMapId      = evt.detail.value;
        this.zoom = ZOOM_DEFAULT;
        this.panX = 0;
        this.panY = 0;
        this.showCrossCutting = false;
        if (this.selectedMapId) {
            safeSessionSet(SESSION_KEY_SELECTED_MAP, this.selectedMapId);
        } else {
            safeSessionRemove(SESSION_KEY_SELECTED_MAP);
        }
        this._loadCapabilities();
    }

    handleTagChange(evt) {
        this.selectedTagId = evt.detail.value;
        this._buildLayout(this._capabilities);
    }

    handleToggleHidden() {
        this.showHidden = !this.showHidden;
        this._panX = 0;
        this._panY = 0;
        this._buildLayout(this._capabilities);
    }

    handleToggleCrossCutting() {
        this.showCrossCutting = !this.showCrossCutting;
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

    handleFitToWindow() {
        const container = this.template.querySelector('.bcm-canvas-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const cw = rect.width;
        const ch = rect.height;
        const dw = this.canvasWidth;
        const dh = this.canvasHeight;
        if (!dw || !dh || !cw || !ch) return;
        const fitZoom = Math.min(cw / dw, ch / dh, ZOOM_MAX);
        const clampedZoom = Math.max(ZOOM_MIN, fitZoom);
        this.zoom = Math.round(clampedZoom * 100) / 100;
        this.panX = (cw - dw * this.zoom) / 2;
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
        if (evt.target.closest('.bcm-node, .bcm-band-node')) return;
        const hadFocus = this.focusedNodeId !== null;
        this.focusedNodeId      = null;
        this._keyNavMode = false;
        if (hadFocus) this._buildLayout(this._capabilities);
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
        evt.stopPropagation();
        const targetLevel = evt.target.dataset?.nodeLevel;
        const targetId    = evt.target.dataset?.nodeId;

        const nodeId    = evt.currentTarget.dataset.nodeId;
        const nodeLevel = targetLevel || evt.currentTarget.dataset.nodeLevel;
        if (!nodeId) return;

        // Resolve clicked id (L3 may sit inside a group)
        const l3Group = evt.target.closest && evt.target.closest('[data-l3-group]');
        const resolvedId = (nodeLevel === '3' && targetId)
            ? targetId
            : (l3Group ? l3Group.dataset.l3Group : nodeId);

        // Panel open -> any click refreshes panel directly
        if (this.detailCapability || this.detailIsLoading) {
            this.focusedNodeId = resolvedId;
            this._keyNavMode   = true;
            this._buildLayout(this._capabilities);
            this.handleViewDetail({ detail: { id: resolvedId } });
            return;
        }

        // Panel closed: 1st click focuses, 2nd click on already-focused opens panel
        const alreadyFocused = this.focusedNodeId === resolvedId;
        this.focusedNodeId = resolvedId;
        this._keyNavMode   = true;
        this._buildLayout(this._capabilities);
        if (!alreadyFocused) return;
        this.handleViewDetail({ detail: { id: resolvedId } });
    }

    handleBandClick(evt) {
        evt.stopPropagation();
        const id = evt.currentTarget.dataset.nodeId;
        if (!id) return;
        this.handleViewDetail({ detail: { id } });
    }

    handleViewDetail(evt) {
        const id = evt?.detail?.id;
        if (!id) return;
        const reqId = ++this._detailRequestSeq;
        this.detailIsLoading    = true;
        this.detailCapability   = null;
        this.detailBreadcrumb   = this._buildBreadcrumb(id);
        this.detailErrorMessage = null;
        getCapabilityDetail({ capabilityId: id })
            .then(rec => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailCapability = rec;
            })
            .catch(err => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailErrorMessage =
                    err?.body?.message || 'Failed to load capability detail';
            })
            .finally(() => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailIsLoading = false;
            });
    }

    handleDetailSaved(evt) {
        const payload = evt?.detail || {};
        if (!payload.id) return;
        const capability = {
            Id                          : payload.id,
            Name                        : payload.name,
            bcm_Definition__c           : payload.definition,
            bcm_StrategySupport__c      : payload.strategySupport,
            bcm_ArchitecturalNuance__c  : payload.architecturalNuance,
            bcm_HideFromDiagram__c      : payload.hideFromDiagram,
        };
        this.detailErrorMessage = null;
        const reqId = ++this._detailRequestSeq;
        updateCapability({ capability })
            .then(() => {
                if (reqId !== this._detailRequestSeq) return null;
                this._capabilities = (this._capabilities || []).map(c =>
                    c.Id === payload.id
                        ? { ...c,
                            Name                        : payload.name,
                            bcm_Definition__c           : payload.definition,
                            bcm_StrategySupport__c      : payload.strategySupport,
                            bcm_ArchitecturalNuance__c  : payload.architecturalNuance,
                            bcm_HideFromDiagram__c      : payload.hideFromDiagram }
                        : c
                );
                this._buildLayout(this._capabilities);
                return getCapabilityDetail({ capabilityId: payload.id });
            })
            .then(rec => {
                if (reqId !== this._detailRequestSeq) return;
                if (rec) this.detailCapability = rec;
            })
            .catch(err => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailErrorMessage =
                    err?.body?.message || 'Failed to save capability';
            });
    }

    handleDetailClose() {
        this._detailRequestSeq++;
        this.detailCapability   = null;
        this.detailBreadcrumb   = [];
        this.detailIsLoading    = false;
        this.detailErrorMessage = null;
    }

    _buildBreadcrumb(id) {
        const byId = new Map();
        (this._capabilities || []).forEach(c => byId.set(c.Id, c));
        const chain = [];
        let cur = byId.get(id);
        while (cur) {
            chain.unshift({ id: cur.Id, label: cur.Name });
            cur = cur.bcm_Parent__c ? byId.get(cur.bcm_Parent__c) : null;
        }
        return chain;
    }

    handleKeyDown(evt) {
        const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (ARROW_KEYS.includes(evt.key)) evt.preventDefault();
        const PAN_STEP = 50;
        if (!this._keyNavMode) {
            if (evt.key === 'ArrowLeft')  this.panX += PAN_STEP;
            if (evt.key === 'ArrowRight') this.panX -= PAN_STEP;
            if (evt.key === 'ArrowUp')    this.panY += PAN_STEP;
            if (evt.key === 'ArrowDown')  this.panY -= PAN_STEP;
        } else {
            if (evt.key === 'Escape') {
                this._keyNavMode   = false;
                this.focusedNodeId = null;
                this._buildLayout(this._capabilities);
            } else {
                this._navigateFromKey(evt.key);
            }
        }
    }

    _navigateFromKey(key) {
        const l1 = this._layoutL1 || [];
        const l2Map = new Map((this._layoutL2 || []).map(n => [n.id, n]));

        // Determine if focused node is L1, L2, or L3
        const focusedL1 = l1.find(n => n.id === this.focusedNodeId);
        const focusedL2 = l2Map.get(this.focusedNodeId);
        const focusedL3 = (this._layoutL3Map || new Map()).get(this.focusedNodeId);

        // L3 focus: ArrowUp/Down move between siblings, ArrowUp from first goes to parent L2,
        // ArrowLeft/Right are ignored (focus + pan unchanged).
        // Note: ArrowDown on the last sibling is a no-op — focus unchanged, no rebuild needed.
        if (!focusedL1 && !focusedL2 && focusedL3) {
            const siblings = (this._l3ByL2 || new Map()).get(focusedL3.parentL2Id) || [];
            const idx      = focusedL3.siblingIdx;
            if (key === 'ArrowDown') {
                if (idx < siblings.length - 1) {
                    this.focusedNodeId = siblings[idx + 1];
                    this._buildLayout(this._capabilities);
                }
            } else if (key === 'ArrowUp') {
                if (idx > 0) {
                    this.focusedNodeId = siblings[idx - 1];
                } else {
                    this.focusedNodeId = focusedL3.parentL2Id;
                }
                this._buildLayout(this._capabilities);
            }
            // ArrowLeft / ArrowRight: ignored
            return;
        }

        if (focusedL1) {
            const colIdx = focusedL1.colIdx;
            if (key === 'ArrowLeft' && colIdx > 0) {
                const nextL1Id = this._colMap[colIdx - 1];
                const firstL2 = (this._l2ByCol[colIdx - 1] || [])[0];
                this.focusedNodeId = firstL2 || nextL1Id;
            } else if (key === 'ArrowRight') {
                const maxCol = l1.length - 1;
                if (colIdx < maxCol) {
                    const nextL1Id = this._colMap[colIdx + 1];
                    const firstL2 = (this._l2ByCol[colIdx + 1] || [])[0];
                    this.focusedNodeId = firstL2 || nextL1Id;
                }
            } else if (key === 'ArrowDown') {
                const firstL2 = (this._l2ByCol[colIdx] || [])[0];
                if (firstL2) this.focusedNodeId = firstL2;
            }
        } else if (focusedL2) {
            const { colIdx, rowIdx } = focusedL2;
            const colL2 = this._l2ByCol[colIdx] || [];
            if (key === 'ArrowUp') {
                if (rowIdx > 0) {
                    this.focusedNodeId = colL2[rowIdx - 1];
                } else {
                    this.focusedNodeId = this._colMap[colIdx];
                }
            } else if (key === 'ArrowDown') {
                if (rowIdx < colL2.length - 1) {
                    this.focusedNodeId = colL2[rowIdx + 1];
                }
            } else if (key === 'ArrowLeft' && colIdx > 0) {
                const prevL2s = this._l2ByCol[colIdx - 1] || [];
                const idx = Math.min(rowIdx, prevL2s.length - 1);
                this.focusedNodeId = prevL2s[idx] || this._colMap[colIdx - 1];
            } else if (key === 'ArrowRight') {
                const maxCol = l1.length - 1;
                if (colIdx < maxCol) {
                    const nextL2s = this._l2ByCol[colIdx + 1] || [];
                    const idx = Math.min(rowIdx, nextL2s.length - 1);
                    this.focusedNodeId = nextL2s[idx] || this._colMap[colIdx + 1];
                }
            }
        }
        this._buildLayout(this._capabilities);
    }
}
