import { LightningElement, api, track, wire } from 'lwc';
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
const LINE_HEIGHT       = 20;
const BOX_GAP           = 12;
const DIAGRAM_PADDING   = 24;
const FONT_SIZE_L1      = 13;
const FONT_SIZE_L2      = 12;
const FONT_SIZE_L3      = 11;
const BULLET_INDENT     = Math.round(FONT_SIZE_L3 * 0.6 * 2);

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
    @track _zoom                 = ZOOM_DEFAULT;
    @track _panX                 = 0;
    @track _panY                 = 0;
    @track contextMenuVisible    = false;
    @track contextMenuX          = 0;
    @track contextMenuY          = 0;
    @track contextMenuNode       = null;
    @track showHidden            = false;
    @track focusedNodeId         = null;
    @track _layoutL1             = [];
    @track _layoutL2             = [];

    _capabilities   = [];
    _tagColourMap   = new Map();
    _keyNavMode     = false;
    _isDragging     = false;
    _dragStartX     = 0;
    _dragStartY     = 0;
    _panStartX      = 0;
    _panStartY      = 0;

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

    // ── Computed SVG dimensions & transform ───────────────────────────────────
    get canvasWidth() {
        const roots = this._l1Roots || [];
        const cols  = this.showHidden
            ? roots.length
            : roots.filter(r => !r._hidden).length;
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

    get l1Transform() {
        return `translate(${this.panX}, 0) scale(${this.zoom})`;
    }

    get l2ClipY() {
        return (DIAGRAM_PADDING + CHEVRON_HEIGHT) * this.zoom;
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

        this._l1Roots = roots;

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
        roots.forEach((l1) => {
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
                const bulletLines = [];
                let   bulletY   = boxY + headerHeight;
                for (const l3 of (l2.children || [])) {
                    const allLines = wrapText(l3.Name, maxBulletFirst, FONT_SIZE_L3, 5);
                    allLines.forEach((text, wIdx) => {
                        if (wIdx === 0) {
                            bulletLines.push({
                                key         : l3.Id + '-bullet-0',
                                l3Id        : l3.Id,
                                l3Name      : l3.Name,
                                cursorStyle : 'cursor:pointer',
                                text        : '• ' + text,
                                x           : bulletBaseX,
                                y           : bulletY + LINE_HEIGHT / 2,
                            });
                        } else {
                            bulletLines.push({
                                key         : l3.Id + '-bullet-' + wIdx,
                                l3Id        : null,
                                l3Name      : null,
                                cursorStyle : '',
                                text,
                                x           : bulletContX,
                                y           : bulletY + LINE_HEIGHT / 2,
                            });
                        }
                        bulletY += LINE_HEIGHT;
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
        this._colMap   = colMap;
        this._l2ByCol  = l2ByCol;

        // Build L3 lookup: id → {name, anchorX, anchorY} for context menu positioning
        const l3Map = new Map();
        for (const l2 of l2Nodes) {
            for (const bullet of l2.bulletLines) {
                if (bullet.l3Id) {
                    l3Map.set(bullet.l3Id, { name: bullet.l3Name, anchorX: l2.x + l2.width, anchorY: bullet.y });
                }
            }
        }
        this._layoutL3Map = l3Map;
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
        this.contextMenuVisible = false;
        this.zoom = ZOOM_DEFAULT;
        this.panX = 0;
        this.panY = 0;
        this._loadCapabilities();
    }

    handleTagChange(evt) {
        this.selectedTagId = evt.detail.value;
        this._buildLayout(this._capabilities);
    }

    handleToggleHidden() {
        this.showHidden = !this.showHidden;
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
        this.panY    = Math.min(0, mouseY - (mouseY - this.panY) * (newZoom / this.zoom));
        this.zoom    = newZoom;
    }

    handleSvgMouseDown(evt) {
        if (evt.target.closest('.bcm-node')) return;
        this.focusedNodeId      = null;
        this.contextMenuVisible = false;
        this._keyNavMode = false;
        this._isDragging = true;
        this._dragStartX = evt.clientX;
        this._dragStartY = evt.clientY;
        this._panStartX  = this.panX;
        this._panStartY  = this.panY;
    }

    handleSvgMouseMove(evt) {
        if (!this._isDragging) return;
        this.panX = this._panStartX + (evt.clientX - this._dragStartX);
        this.panY = Math.min(0, this._panStartY + (evt.clientY - this._dragStartY));
    }

    handleSvgMouseUp() {
        this._isDragging = false;
    }

    handleNodeClick(evt) {
        evt.stopPropagation();
        // Check if click landed on an L3 bullet text element
        const targetLevel = evt.target.dataset?.nodeLevel;
        const targetId    = evt.target.dataset?.nodeId;
        const targetName  = evt.target.dataset?.nodeName;

        const nodeId    = evt.currentTarget.dataset.nodeId;
        const nodeLevel = targetLevel || evt.currentTarget.dataset.nodeLevel;
        const nodeName  = targetName  || evt.currentTarget.dataset.nodeName;
        if (!nodeId) return;

        // L3 bullet click — focus first, menu on second click (same as L1/L2)
        if (nodeLevel === '3' && targetId) {
            const l3 = (this._layoutL3Map || new Map()).get(targetId);
            if (!l3) return;
            const alreadyFocused = this.focusedNodeId === targetId;
            this.focusedNodeId = targetId;
            this._keyNavMode   = true;
            this._buildLayout(this._capabilities);
            if (!alreadyFocused) return;
            if (this.contextMenuVisible && this.contextMenuNode?.id === targetId) {
                this.contextMenuVisible = false;
                return;
            }
            this.contextMenuX    = l3.anchorX * this.zoom + this.panX;
            this.contextMenuY    = l3.anchorY * this.zoom + this.panY;
            this.contextMenuNode = { id: targetId, name: targetName || l3.name, level: 3 };
            this.contextMenuVisible = true;
            return;
        }

        // Find node geometry in layout arrays
        const l2Node = (this._layoutL2 || []).find(n => n.id === nodeId);
        const l1Node = (this._layoutL1 || []).find(n => n.id === nodeId);

        let svgRightX, svgMidY;
        if (l2Node) {
            svgRightX = l2Node.x + l2Node.width;
            svgMidY   = l2Node.y + l2Node.height / 2;
        } else if (l1Node) {
            // Chevron tip is 3rd point
            const pts = l1Node.points.split(' ').map(p => p.split(',').map(Number));
            svgRightX = pts[2][0];
            svgMidY   = pts[2][1];
        } else {
            // Fallback to click position
            const alreadyFocusedFb = this.focusedNodeId === nodeId;
            this.focusedNodeId = nodeId;
            this._keyNavMode   = true;
            this._buildLayout(this._capabilities);
            if (alreadyFocusedFb) {
                if (this.contextMenuVisible && this.contextMenuNode?.id === nodeId) {
                    this.contextMenuVisible = false;
                } else {
                    const rect = this.template.querySelector('.bcm-canvas-container').getBoundingClientRect();
                    this.contextMenuX    = evt.clientX - rect.left;
                    this.contextMenuY    = evt.clientY - rect.top;
                    this.contextMenuNode = { id: nodeId, name: nodeName || nodeId, level: l1Node ? 1 : 2 };
                    this.contextMenuVisible = true;
                }
            }
            return;
        }

        const alreadyFocused = this.focusedNodeId === nodeId;
        this.focusedNodeId = nodeId;
        this._keyNavMode   = true;
        this._buildLayout(this._capabilities);

        if (!alreadyFocused) return;

        // Second click opens, third click (menu already visible) closes
        if (this.contextMenuVisible && this.contextMenuNode?.id === nodeId) {
            this.contextMenuVisible = false;
            return;
        }

        const resolvedName = l1Node ? l1Node.name : l2Node.name;
        const isL1 = !!l1Node;
        this.contextMenuX    = svgRightX * this.zoom + this.panX;
        this.contextMenuY    = svgMidY   * this.zoom + (isL1 ? 0 : this.panY);
        this.contextMenuNode = { id: nodeId, name: resolvedName, level: isL1 ? 1 : 2 };
        this.contextMenuVisible = true;
    }

    handleContextMenuClose() {
        this.contextMenuVisible = false;
    }

    handleKeyDown(evt) {
        const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (ARROW_KEYS.includes(evt.key)) evt.preventDefault();
        const PAN_STEP = 50;
        if (!this._keyNavMode) {
            if (evt.key === 'ArrowLeft')  this.panX += PAN_STEP;
            if (evt.key === 'ArrowRight') this.panX -= PAN_STEP;
            if (evt.key === 'ArrowUp')    this.panY = Math.min(0, this.panY + PAN_STEP);
            if (evt.key === 'ArrowDown')  this.panY += -PAN_STEP;
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
        this.contextMenuVisible = false;
        const l1 = this._layoutL1 || [];
        const l2Map = new Map((this._layoutL2 || []).map(n => [n.id, n]));

        // Determine if focused node is L1 or L2
        const focusedL1 = l1.find(n => n.id === this.focusedNodeId);
        const focusedL2 = l2Map.get(this.focusedNodeId);

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
