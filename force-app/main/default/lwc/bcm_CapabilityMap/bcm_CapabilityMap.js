import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import hasPermission from '@salesforce/customPermission/bcm_CanEdit';
import getMaps from '@salesforce/apex/bcm_MapController.getMaps';
import getCapabilities from '@salesforce/apex/bcm_CapabilityController.getCapabilities';
import getCapabilityDetail from '@salesforce/apex/bcm_CapabilityController.getCapabilityDetail';
import getTags from '@salesforce/apex/bcm_TagController.getTags';
import updateCapability from '@salesforce/apex/bcm_CapabilityController.updateCapability';
import reorderCapabilities from '@salesforce/apex/bcm_DragDropController.reorderCapabilities';
import reparentCapability from '@salesforce/apex/bcm_DragDropController.reparentCapability';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {
    BCM_L1_FILL,
    BCM_L1_FILL_FOCUSED,
    BCM_L1_STROKE,
    BCM_L1_LABEL,
    BCM_L2_STROKE,
    BCM_L2_LABEL,
    BCM_L2_GHOST_FILL,
    BCM_L3_LABEL,
    BCM_L3_LABEL_DIMMED,
    BCM_TAG_FALLBACK,
    BCM_FOCUS_RING,
    BCM_BAND_RAMP,
    BCM_STRATEGY_MARK,
    BCM_BAND_LABEL_LIGHT,
    BCM_BAND_LABEL_DARK,
    BCM_BAND_STROKE,
    BCM_PANEL_SECONDARY_TEXT
} from 'c/bcm_VisualTokens';

// ── Layout constants ──────────────────────────────────────────────────────────
const COLUMN_WIDTH = 220;
const COLUMN_GAP = 16;
const CHEVRON_HEIGHT = 60;
const CHEVRON_NOTCH = 16;
const BOX_PADDING = 12;
const LINE_HEIGHT = 20;
const BOX_GAP = 12;
const DIAGRAM_PADDING = 24;
const FONT_SIZE_L1 = 13;
const FONT_SIZE_L2 = 12;
const FONT_SIZE_L3 = 11;
const BULLET_INDENT = Math.round(FONT_SIZE_L3 * 0.6 * 2); // "• " prefix: bullet + space, each ~0.6em

const STRATEGY_STRIPE_W = BCM_STRATEGY_MARK.weight / 2; // L2/L3 stripes half the L1 weight
const STRATEGY_STRIPE_INSET_Y = 4;
const STRATEGY_STRIPE_INSET_X = 4;

// Cross-cutting band layered visual
const BAND_ROW_OVERLAP = 12;
const BAND_NOTCH = CHEVRON_NOTCH * 2;
const BAND_LABEL_PAD_X = 18;
const BAND_LABEL_PAD_BOTTOM = 8;

// Returns relative luminance (0–1) for a 6-digit hex color.
function hexLuminance(hex) {
    const c = hex.replace('#', '');
    return [0, 2, 4].reduce((sum, i) => {
        const v = parseInt(c.slice(i, i + 2), 16) / 255;
        return (
            sum +
            (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][i / 2]
        );
    }, 0);
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1.0;
const PEEK_OFFSET = 60;
const PAN_STEP = 50;

const SESSION_KEY_SELECTED_MAP = 'bcm.visualisation.selectedMapId';
const SESSION_KEY_SELECTED_TAG = 'bcm.visualisation.selectedTagId';
const SESSION_KEY_STRATEGIC = 'bcm.visualisation.strategicSupportOn';

function safeSessionGet(key) {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSessionSet(key, value) {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        /* silent */
    }
}

function safeSessionRemove(key) {
    try {
        sessionStorage.removeItem(key);
    } catch {
        /* silent */
    }
}

function isStrategic(html) {
    return (
        String(html || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .trim().length > 0
    );
}

// ── Text wrap helper ──────────────────────────────────────────────────────────
function wrapText(text, maxWidth, fontSize, maxLines) {
    const charWidth = fontSize * 0.6;
    const maxChars = Math.floor(maxWidth / charWidth);
    const words = String(text || '').split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? current + ' ' + word : word;
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
        if (lines.length >= maxLines) {
            current = '';
            break;
        }
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
}

export default class BcmCapabilityMap extends LightningElement {
    connectedCallback() {
        this._maybeRestoreStrategicSupport();
        this._rootKeyDownBound = this._handleRootKeyDown.bind(this);
        // Shadow-root listener catches keydown events that originate inside the
        // component (e.g. focus on a toolbar button). Window listener catches
        // events when focus is on <body> or anywhere outside the shadow tree.
        // Same event can hit both in a real browser (composed=true on native
        // keyboard events) — guard with a per-event marker.
        this.template.addEventListener('keydown', this._rootKeyDownBound);
        window.addEventListener('keydown', this._rootKeyDownBound);
    }

    disconnectedCallback() {
        if (this._rootKeyDownBound) {
            this.template.removeEventListener('keydown', this._rootKeyDownBound);
            window.removeEventListener('keydown', this._rootKeyDownBound);
            this._rootKeyDownBound = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    renderedCallback() {
        if (this._resizeObserver) return;
        const container = this.template.querySelector('.bcm-canvas-container');
        if (!container) return;
        if (typeof ResizeObserver === 'undefined') return;
        this._resizeObserver = new ResizeObserver((entries) => {
            this._containerWidth = entries[0].contentRect.width;
        });
        this._resizeObserver.observe(container);
        this._containerWidth = container.getBoundingClientRect().width;
    }

    _handleRootKeyDown(evt) {
        if (evt.__bcmHandled) return;
        const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!ARROW_KEYS.includes(evt.key) && evt.key !== 'Escape') return;
        // Skip when typing in a form control inside the toolbar/combobox.
        const path = typeof evt.composedPath === 'function' ? evt.composedPath() : [];
        for (const el of path) {
            if (!el || !el.tagName) continue;
            const tag = el.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            if (tag === 'lightning-combobox' || tag === 'lightning-input') return;
        }
        // Component must still be in DOM (window listener could fire after disconnect race).
        if (!this.template.querySelector('svg.bcm-canvas')) return;
        evt.__bcmHandled = true;
        this.handleKeyDown(evt);
    }

    _clampPanY(panY) {
        // Upper bound: don't pan content top below viewport top (panY ≤ 0).
        // Lower bound: stop when the lowest L2 box has been pushed PEEK_OFFSET
        // below the chevron strip — leaves a peek of content above so the user
        // sees there is more content to scroll back through.
        const layoutL2 = this._layoutL2 || [];
        let lowestTop = 0;
        for (const n of layoutL2) {
            if (n.y > lowestTop) lowestTop = n.y;
        }
        const minY = Math.min(0, this.l2ClipY + PEEK_OFFSET - lowestTop * this._zoom);
        return Math.max(minY, Math.min(0, panY));
    }

    _clampPanX(panX) {
        const slack = this._containerWidth - this.canvasWidth * this._zoom;
        const minX = Math.min(0, slack) - PEEK_OFFSET;
        const maxX = Math.max(0, slack) + PEEK_OFFSET;
        return Math.max(minX, Math.min(maxX, panX));
    }

    // ── Wired data ────────────────────────────────────────────────────────────
    @track mapOptions = [];
    @track tagOptions = [{ label: 'None', value: '' }];

    @wire(getMaps)
    wiredMaps({ data, error }) {
        if (data) {
            this.mapOptions = data.map((m) => ({ label: m.Name, value: m.Id }));
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
        const isValid = this.mapOptions.some((opt) => opt.value === persistedId);
        if (!isValid) {
            safeSessionRemove(SESSION_KEY_SELECTED_MAP);
            return;
        }
        this.selectedMapId = persistedId;
    }

    @wire(getCapabilities, { mapId: '$selectedMapId' })
    wiredCapabilities(result) {
        this._wiredCaps = result;
        if (!this.selectedMapId) {
            this._capabilities = [];
            this.isLoading = false;
            return;
        }
        if (result.data) {
            this._capabilities = result.data;
            this._buildLayout(result.data);
            this.errorMessage = null;
            this.isLoading = false;
        } else if (result.error) {
            this.errorMessage = result.error?.body?.message || 'Failed to load capabilities';
            this.isLoading = false;
        }
    }

    @wire(getTags)
    wiredTags(result) {
        this._wiredTags = result;
        const { data, error } = result;
        if (data) {
            this.tagOptions = [
                { label: 'None', value: '' },
                ...data.map((t) => ({ label: t.Name, value: t.Id, colour: t.bcm_Colour__c }))
            ];
            this._tagColourMap = new Map(data.map((t) => [t.Id, t.bcm_Colour__c]));
            if (this.selectedTagId && !this._tagColourMap.has(this.selectedTagId)) {
                this.selectedTagId = '';
            }
            this._maybeRestoreSelectedTag();
            if (this._capabilities.length) {
                this._buildLayout(this._capabilities);
            }
        } else if (error) {
            this.errorMessage = error?.body?.message || 'Failed to load tags';
        }
    }

    _maybeRestoreSelectedTag() {
        if (this._tagRestoreAttempted) return;
        this._tagRestoreAttempted = true;
        const persistedId = safeSessionGet(SESSION_KEY_SELECTED_TAG);
        if (!persistedId) return;
        if (!this._tagColourMap.has(persistedId)) {
            safeSessionRemove(SESSION_KEY_SELECTED_TAG);
            return;
        }
        this.selectedTagId = persistedId;
    }

    _maybeRestoreStrategicSupport() {
        if (this._strategyRestoreAttempted) return;
        this._strategyRestoreAttempted = true;
        if (safeSessionGet(SESSION_KEY_STRATEGIC) === 'true') {
            this.showStrategicSupport = true;
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────
    @track selectedMapId = null;
    @track selectedTagId = '';
    @track highlightedNodeIds = new Set();
    @track isLoading = false;
    @track errorMessage = null;
    @track _zoom = ZOOM_DEFAULT;
    @track _panX = 0;
    @track _panY = 0;
    @track showHidden = false;
    @track showCrossCutting = false;
    @track showStrategicSupport = false;
    @track focusedNodeId = null;
    @track _layoutL1 = [];
    @track _layoutL2 = [];
    @track _layoutBand = [];
    @track detailCapability = null;
    @track detailBreadcrumb = [];
    @track detailIsLoading = false;
    @track detailErrorMessage = null;
    _detailRequestSeq = 0;

    // ── Drag-drop state ───────────────────────────────────────────────────────
    @track isDragging = false;
    @track isSavingDragDrop = false;
    @track ghost = null;
    @track dropIndicator = null;
    _draggedNodeId = null;
    _draggedNodeLevel = null;
    _ghostOffsetX = 0;
    _ghostOffsetY = 0;
    _dropTargetInfo = null;
    _preDragSnapshot = null;
    _dragMoveBound = null;
    _dragUpBound = null;
    _dragKeyDownBound = null;

    _capabilities = [];
    _wiredCaps = null;
    _wiredTags = null;
    _tagColourMap = new Map();
    _keyNavMode = false;
    _isDragging = false;
    _dragStartX = 0;
    _dragStartY = 0;
    _panStartX = 0;
    _panStartY = 0;
    _restoreAttempted = false;
    _tagRestoreAttempted = false;
    _strategyRestoreAttempted = false;
    _containerWidth = 0;
    _resizeObserver = null;

    @api get zoom() {
        return this._zoom;
    }
    set zoom(v) {
        this._zoom = v;
    }

    @api get panX() {
        return this._panX;
    }
    set panX(v) {
        this._panX = v;
    }

    @api get panY() {
        return this._panY;
    }
    set panY(v) {
        this._panY = v;
    }

    get canEdit() {
        return hasPermission;
    }

    get savingAttr() {
        return this.isSavingDragDrop ? 'true' : 'false';
    }

    get showHiddenVariant() {
        return this.showHidden ? 'brand' : 'border';
    }

    get crossCuttingVariant() {
        return this.showCrossCutting ? 'brand' : 'border';
    }

    get strategicSupportVariant() {
        return this.showStrategicSupport ? 'brand' : 'border';
    }

    // ── Visual-token getters (template bindings) ──────────────────────────────
    get focusRingColour() {
        return BCM_FOCUS_RING;
    }
    get l1LabelColour() {
        return BCM_L1_LABEL;
    }
    get l2LabelColour() {
        return BCM_L2_LABEL;
    }
    get bandStroke() {
        return BCM_BAND_STROKE;
    }
    get l1GhostFill() {
        return BCM_L1_FILL;
    }
    get l1GhostStroke() {
        return BCM_L1_STROKE;
    }
    get l2GhostFill() {
        return BCM_L2_GHOST_FILL;
    }
    get dragHandleColour() {
        return BCM_PANEL_SECONDARY_TEXT;
    }

    // ── Computed SVG dimensions & transform ───────────────────────────────────
    get canvasWidth() {
        const roots = this._l1Roots || [];
        const cols = this.showHidden ? roots.length : roots.filter((r) => !r._hidden).length;
        const colWidth =
            cols > 0
                ? DIAGRAM_PADDING * 2 + cols * COLUMN_WIDTH + Math.max(0, cols - 1) * COLUMN_GAP
                : 0;
        return colWidth === 0 ? 600 : colWidth;
    }

    get canvasHeight() {
        const tallest = this._tallestColumnHeight || 0;
        const nrows = this._ccRootCount || 0;
        const hasRegular = (this._l1Roots || []).length > 0;
        const headerReserved = hasRegular ? CHEVRON_HEIGHT + BOX_GAP : 0;
        const bandReserved =
            this.showCrossCutting && nrows > 0
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
        return `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
    }

    get l2ClipY() {
        return (DIAGRAM_PADDING + CHEVRON_HEIGHT) * this.zoom;
    }

    // ── Tree & layout ─────────────────────────────────────────────────────────
    get l1Nodes() {
        return this._layoutL1 || [];
    }
    get l2Nodes() {
        return this._layoutL2 || [];
    }
    get bandNodes() {
        return this._layoutBand || [];
    }

    _buildL1StrategyMark(pointsStr, x, y, w, h) {
        // Chevron points: 0=top-left, 1=top-right before notch, 2=right tip,
        //                 3=bottom-right after notch, 4=bottom-left
        // Strategy mark: vertical stripe on the left straight edge (pts[0] → pts[4]).
        const pts = pointsStr.split(' ').map((p) => {
            const [px, py] = p.split(',').map(Number);
            return { x: px, y: py };
        });
        const leftX = pts[0]?.x ?? x;
        const topY = pts[0]?.y ?? y;
        const botY = pts[4]?.y ?? y + h;
        return {
            kind: 'rect',
            isRect: true,
            x: leftX,
            y: topY,
            width: BCM_STRATEGY_MARK.weight,
            height: botY - topY
        };
    }

    _buildLayout(capabilities) {
        if (!capabilities?.length) {
            this._l1Roots = [];
            this._tallestColumnHeight = 0;
            this._layoutL1 = [];
            this._layoutL2 = [];
            this._layoutBand = [];
            this._ccRootCount = 0;
            this._colMap = {};
            this._l2ByCol = {};
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
        const sortByOrder = (arr) =>
            arr.sort((a, b) => (a.bcm_SortOrder__c || 0) - (b.bcm_SortOrder__c || 0));
        sortByOrder(roots);
        for (const node of nodeMap.values()) {
            sortByOrder(node.children);
        }

        // ── Partition cross-cutting L1s into the band layer ──────────────────
        const ccRoots = roots.filter((r) => r.bcm_IsCrossCutting__c);
        const regularRoots = roots.filter((r) => !r.bcm_IsCrossCutting__c);
        this._ccRootCount = ccRoots.length;
        this._l1Roots = regularRoots;

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
        let tallest = 0;
        const colMap = {}; // colIdx → l1 id
        const l2ByCol = {}; // colIdx → [l2 ids]

        let visibleColIdx = 0;
        regularRoots.forEach((l1) => {
            // Skip hidden L1 when toggle is OFF
            if (l1._hidden && !this.showHidden) return;

            const colIdx = visibleColIdx++;
            const colX = DIAGRAM_PADDING + colIdx * (COLUMN_WIDTH + COLUMN_GAP);
            const x = colX;
            const y = DIAGRAM_PADDING;
            const w = COLUMN_WIDTH;
            const h = CHEVRON_HEIGHT;
            const n = CHEVRON_NOTCH;
            const points = [
                `${x},${y}`,
                `${x + w - n},${y}`,
                `${x + w},${y + h / 2}`,
                `${x + w - n},${y + h}`,
                `${x},${y + h}`
            ].join(' ');

            const labelMaxW = w - BOX_PADDING * 2;
            const textLines = wrapText(l1.Name, labelMaxW, FONT_SIZE_L1, 3);
            const lineSpacing = 16;
            const totalH = textLines.length * lineSpacing;
            const startY = y + h / 2 - totalH / 2 + lineSpacing / 2;
            const l1Dashed = l1._hidden && this.showHidden;
            const l1Focused = l1.Id === this.focusedNodeId;
            colMap[colIdx] = l1.Id;
            l2ByCol[colIdx] = [];

            const l1Strategy =
                this.showStrategicSupport && isStrategic(l1.bcm_StrategySupport__c)
                    ? this._buildL1StrategyMark(points, x, y, w, h)
                    : null;

            l1Nodes.push({
                id: l1.Id,
                name: l1.Name,
                colIdx,
                isFocused: l1Focused,
                fill: l1Focused ? BCM_L1_FILL_FOCUSED : BCM_L1_FILL,
                strokeColour: l1Focused ? BCM_FOCUS_RING : BCM_L1_STROKE,
                strokeWidth: l1Focused ? '3' : '1',
                strokeDash: l1Dashed ? '4 2' : '',
                points,
                handleX: x + 8,
                handleY: y + h / 2 + 4,
                strategyMark: l1Strategy,
                labelLines: textLines.map((text, i) => ({
                    key: l1.Id + '-label-' + i,
                    text,
                    x: x + w / 2,
                    y: startY + i * lineSpacing
                }))
            });

            // ── Layout L2 boxes in this column ───────────────────────────────
            let boxY = DIAGRAM_PADDING + CHEVRON_HEIGHT + BOX_GAP;
            let colH = 0;

            for (const l2 of l1.children) {
                // Skip hidden L2 when toggle is OFF
                if (l2._hidden && !this.showHidden) continue;

                // Tag fill
                const tagFill = this._getTagFill(l2.Id, l2.Tags__r);

                // L2 header — uncapped wrap, dynamic height
                const l2MaxW = COLUMN_WIDTH - BOX_PADDING * 2;
                const l2Lines = wrapText(l2.Name, l2MaxW, FONT_SIZE_L2, 10);
                const headerHeight = l2Lines.length * (FONT_SIZE_L2 + 4) + BOX_PADDING * 2;
                const l2StartY = boxY + BOX_PADDING + FONT_SIZE_L2 / 2;

                // L3 bullets — bullet glyph is a separate element; all text lines align at bulletContX
                const bulletBaseX = colX + BOX_PADDING + 8;
                const bulletContX = bulletBaseX + BULLET_INDENT;
                const maxBulletText = COLUMN_WIDTH - BOX_PADDING * 2 - 8 - BULLET_INDENT;
                const bulletGroups = [];
                let bulletY = boxY + headerHeight;
                for (const l3 of l2.children || []) {
                    if (l3._hidden && !this.showHidden) continue;
                    const allLines = wrapText(l3.Name, maxBulletText, FONT_SIZE_L3, 5);
                    const l3Focused = l3.Id === this.focusedNodeId;
                    const l3Dashed = l3._hidden && this.showHidden;
                    const l3TagFill = this._getTagFill(l3.Id, l3.Tags__r);
                    const showTagRect = !l3Focused && l3TagFill !== BCM_TAG_FALLBACK;
                    const fontWeight = l3Focused ? 'bold' : 'normal';
                    const fontStyle = l3Dashed ? 'italic' : 'normal';
                    const fillColour = l3Dashed ? BCM_L3_LABEL_DIMMED : BCM_L3_LABEL;
                    const focusRectStartY = bulletY;
                    const startBulletY = bulletY;
                    const lines = allLines.map((text, wIdx) => ({
                        key: l3.Id + '-bullet-' + wIdx,
                        isFocused: l3Focused,
                        fontWeight,
                        fontStyle,
                        fill: fillColour,
                        bullet: wIdx === 0 ? '•' : null,
                        bulletKey: l3.Id + '-bullet-glyph',
                        bulletX: bulletBaseX,
                        text,
                        x: bulletContX,
                        y: startBulletY + wIdx * LINE_HEIGHT + LINE_HEIGHT / 2
                    }));
                    bulletY = startBulletY + allLines.length * LINE_HEIGHT;
                    bulletGroups.push({
                        key: l3.Id + '-group',
                        l3Id: l3.Id,
                        l3Name: l3.Name,
                        isFocused: l3Focused,
                        lines,
                        strategyMark:
                            this.showStrategicSupport && isStrategic(l3.bcm_StrategySupport__c)
                                ? {
                                      isRect: true,
                                      x: bulletBaseX - 8,
                                      y: focusRectStartY,
                                      width: STRATEGY_STRIPE_W,
                                      height: allLines.length * LINE_HEIGHT - 2
                                  }
                                : null,
                        focusRect: l3Focused
                            ? {
                                  x: bulletBaseX - 4,
                                  y: focusRectStartY,
                                  width: COLUMN_WIDTH - BOX_PADDING * 2 - 8,
                                  height: allLines.length * LINE_HEIGHT - 2
                              }
                            : null,
                        tagRect: showTagRect
                            ? {
                                  x: bulletBaseX - 4,
                                  y: focusRectStartY,
                                  width: COLUMN_WIDTH - BOX_PADDING * 2 - 8,
                                  height: allLines.length * LINE_HEIGHT - 2,
                                  fill: l3TagFill
                              }
                            : null,
                        handleHitX: bulletBaseX - 8,
                        handleHitY: focusRectStartY,
                        handleHitW: 14,
                        handleHitH: LINE_HEIGHT
                    });
                }

                const boxHeight = headerHeight + (bulletY - (boxY + headerHeight)) + BOX_PADDING;

                const l2Dashed = l2._hidden && this.showHidden;
                const l2Focused = l2.Id === this.focusedNodeId;
                const rowIdx = l2ByCol[colIdx].length;
                l2ByCol[colIdx].push(l2.Id);

                const l2Strategy =
                    this.showStrategicSupport && isStrategic(l2.bcm_StrategySupport__c)
                        ? {
                              isRect: true,
                              x: colX + STRATEGY_STRIPE_INSET_X,
                              y: boxY + STRATEGY_STRIPE_INSET_Y,
                              width: STRATEGY_STRIPE_W,
                              height: boxHeight - STRATEGY_STRIPE_INSET_Y * 2
                          }
                        : null;

                l2Nodes.push({
                    id: l2.Id,
                    name: l2.Name,
                    colIdx,
                    rowIdx,
                    isFocused: l2Focused,
                    x: colX,
                    y: boxY,
                    width: COLUMN_WIDTH,
                    height: boxHeight,
                    fill: tagFill,
                    strokeColour: l2Focused ? BCM_FOCUS_RING : BCM_L2_STROKE,
                    strokeWidth: l2Focused ? '3' : '1',
                    strokeDash: l2Dashed ? '4 2' : '',
                    handleX: colX + 4,
                    handleY: boxY + 12,
                    strategyMark: l2Strategy,
                    labelLines: l2Lines.map((text, i) => ({
                        key: l2.Id + '-label-' + i,
                        text,
                        x: colX + BOX_PADDING,
                        y: l2StartY + i * (FONT_SIZE_L2 + 4)
                    })),
                    bulletGroups
                });

                boxY += boxHeight + BOX_GAP;
                colH += boxHeight + BOX_GAP;
            }

            if (colH > tallest) tallest = colH;
        });

        this._tallestColumnHeight = tallest;
        this._layoutL1 = l1Nodes;
        this._layoutL2 = l2Nodes;
        this._colMap = colMap;
        this._l2ByCol = l2ByCol;

        // Build L3 lookup: id → {name, anchorX, anchorY, parentL2Id, siblingIdx}
        // Also build l3ByL2: l2Id → ordered [l3Id, ...] for sibling navigation
        const l3Map = new Map();
        const l3ByL2 = new Map();
        for (const l2 of l2Nodes) {
            const siblings = [];
            for (const group of l2.bulletGroups) {
                l3Map.set(group.l3Id, {
                    name: group.l3Name,
                    anchorX: l2.x + l2.width,
                    anchorY: group.lines[0].y,
                    parentL2Id: l2.id,
                    siblingIdx: siblings.length
                });
                siblings.push(group.l3Id);
            }
            l3ByL2.set(l2.id, siblings);
        }
        this._layoutL3Map = l3Map;
        this._l3ByL2 = l3ByL2;

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
                const y = bandTopY + i * (h - BAND_ROW_OVERLAP);
                const points = [
                    `${bandX},${y}`,
                    `${bandX + bandW - n},${y}`,
                    `${bandX + bandW},${y + h / 2}`,
                    `${bandX + bandW - n},${y + h}`,
                    `${bandX},${y + h}`
                ].join(' ');
                const fill = BCM_BAND_RAMP[i % BCM_BAND_RAMP.length];
                bandNodes.push({
                    id: cc.Id,
                    name: cc.Name,
                    label: String(cc.Name || '').toUpperCase(),
                    fill,
                    labelColor:
                        hexLuminance(fill) > 0.179 ? BCM_BAND_LABEL_DARK : BCM_BAND_LABEL_LIGHT,
                    points,
                    labelX: bandX + BAND_LABEL_PAD_X,
                    labelY: y + h - BAND_LABEL_PAD_BOTTOM,
                    strategyMark:
                        this.showStrategicSupport && isStrategic(cc.bcm_StrategySupport__c)
                            ? {
                                  isRect: true,
                                  x: bandX + STRATEGY_STRIPE_INSET_X,
                                  y: y + STRATEGY_STRIPE_INSET_Y,
                                  width: STRATEGY_STRIPE_W,
                                  height: h - STRATEGY_STRIPE_INSET_Y * 2
                              }
                            : null
                });
            }
        }
        this._layoutBand = bandNodes;
    }

    _getTagFill(capId, tagsRelation) {
        if (!this.selectedTagId) return BCM_TAG_FALLBACK;
        if (!tagsRelation?.length) return BCM_TAG_FALLBACK;
        for (const jct of tagsRelation) {
            if (jct.bcm_Tag__c === this.selectedTagId) {
                return this._tagColourMap.get(this.selectedTagId) || BCM_TAG_FALLBACK;
            }
        }
        return BCM_TAG_FALLBACK;
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    handleMapChange(evt) {
        this.selectedMapId = evt.detail.value;
        this._zoom = ZOOM_DEFAULT;
        this._panX = 0;
        this._panY = 0;
        this.showCrossCutting = false;
        this.showStrategicSupport = false;
        // sessionStorage value intentionally untouched — reload restores user's preference
        if (this.selectedMapId) {
            safeSessionSet(SESSION_KEY_SELECTED_MAP, this.selectedMapId);
        } else {
            safeSessionRemove(SESSION_KEY_SELECTED_MAP);
            this._capabilities = [];
            this._buildLayout([]);
        }
        this.isLoading = !!this.selectedMapId;
    }

    handleTagFocus() {
        if (this._wiredTags) refreshApex(this._wiredTags);
        if (this._wiredCaps) refreshApex(this._wiredCaps);
    }

    handleTagChange(evt) {
        this.selectedTagId = evt.detail.value;
        if (this.selectedTagId) {
            safeSessionSet(SESSION_KEY_SELECTED_TAG, this.selectedTagId);
        } else {
            safeSessionRemove(SESSION_KEY_SELECTED_TAG);
        }
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

    handleToggleStrategicSupport() {
        this.showStrategicSupport = !this.showStrategicSupport;
        if (this.showStrategicSupport) {
            safeSessionSet(SESSION_KEY_STRATEGIC, 'true');
        } else {
            safeSessionRemove(SESSION_KEY_STRATEGIC);
        }
        this._buildLayout(this._capabilities);
    }

    _refreshCapabilities() {
        if (!this._wiredCaps) return Promise.resolve();
        return refreshApex(this._wiredCaps);
    }

    handleZoomIn() {
        this._zoom = Math.min(ZOOM_MAX, Math.round((this._zoom + ZOOM_STEP) * 10) / 10);
        this._panX = this._clampPanX(this._panX);
        this._panY = this._clampPanY(this._panY);
    }

    handleZoomOut() {
        this._zoom = Math.max(ZOOM_MIN, Math.round((this._zoom - ZOOM_STEP) * 10) / 10);
        this._panX = this._clampPanX(this._panX);
        this._panY = this._clampPanY(this._panY);
    }

    handleResetView() {
        this._zoom = ZOOM_DEFAULT;
        this._panX = 0;
        this._panY = 0;
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
        this._zoom = Math.round(clampedZoom * 100) / 100;
        this._panX = (cw - dw * this._zoom) / 2;
        this._panY = 0;
    }

    handleWheel(evt) {
        if (this.isDragging) {
            evt.preventDefault();
            return;
        }
        evt.preventDefault();
        const delta = evt.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        const newZoom = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, Math.round((this._zoom + delta) * 10) / 10)
        );
        if (newZoom === this._zoom) return;

        // Zoom toward cursor
        const rect = evt.currentTarget.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;
        this._panX = this._clampPanX(mouseX - (mouseX - this._panX) * (newZoom / this._zoom));
        this._panY = this._clampPanY(mouseY - (mouseY - this._panY) * (newZoom / this._zoom));
        this._zoom = newZoom;
    }

    get ghostTransform() {
        if (!this.ghost) return '';
        return `translate(${this.ghost.x}, ${this.ghost.y})`;
    }

    // ── Drag-drop ─────────────────────────────────────────────────────────────

    handleHandleMouseDown(evt) {
        if (!this.canEdit || this.isSavingDragDrop) return;
        evt.stopPropagation();
        evt.preventDefault();

        const nodeId = evt.currentTarget.dataset.nodeId;
        const nodeLevel = parseInt(evt.currentTarget.dataset.nodeLevel, 10);
        if (!nodeId || !nodeLevel) return;

        const layoutNode = this._findLayoutNode(nodeId, nodeLevel);
        if (!layoutNode) return;

        const viewportPoint = this._clientToViewport(evt.clientX, evt.clientY);
        const ghost = this._buildGhostFromLayoutNode(layoutNode, nodeLevel);
        if (!ghost) return;

        this._draggedNodeId = nodeId;
        this._draggedNodeLevel = nodeLevel;
        this._ghostOffsetX = viewportPoint.x - ghost.originX;
        this._ghostOffsetY = viewportPoint.y - ghost.originY;
        ghost.x = ghost.originX;
        ghost.y = ghost.originY;
        this.ghost = ghost;
        this.isDragging = true;
        this.dropIndicator = null;
        this._preDragSnapshot = JSON.parse(JSON.stringify(this._capabilities));

        this._dragMoveBound = this._handleDragMouseMove.bind(this);
        this._dragUpBound = this._handleDragMouseUp.bind(this);
        this._dragKeyDownBound = this._handleDragKeyDown.bind(this);
        window.addEventListener('mousemove', this._dragMoveBound);
        window.addEventListener('mouseup', this._dragUpBound);
        window.addEventListener('keydown', this._dragKeyDownBound);
    }

    _handleDragMouseMove(evt) {
        if (!this.isDragging) return;
        const point = this._clientToViewport(evt.clientX, evt.clientY);
        this.ghost = {
            ...this.ghost,
            x: point.x - this._ghostOffsetX,
            y: point.y - this._ghostOffsetY
        };
        this._dropTargetInfo = this._hitTest(point.x, point.y, this._draggedNodeLevel);
        this.dropIndicator = this._buildDropIndicator(this._dropTargetInfo);
    }

    _handleDragMouseUp() {
        if (!this.isDragging) return;
        this._detachDragListeners();
        const target = this._dropTargetInfo;
        const movedId = this._draggedNodeId;
        const level = this._draggedNodeLevel;

        const cleanup = () => {
            this.isDragging = false;
            this.ghost = null;
            this.dropIndicator = null;
            this._dropTargetInfo = null;
            this._draggedNodeId = null;
            this._draggedNodeLevel = null;
        };

        if (!target) {
            this._preDragSnapshot = null;
            cleanup();
            return;
        }

        const moved = this._capabilities.find((c) => c.Id === movedId);
        if (!moved) {
            this._preDragSnapshot = null;
            cleanup();
            return;
        }

        const oldParentId = moved.bcm_Parent__c || null;
        const newParentId = target.parentId;

        // Compute new sibling order from snapshot
        const oldSiblings = this._capabilities
            .filter((c) => (c.bcm_Parent__c || null) === oldParentId && c.Id !== movedId)
            .sort((a, b) => (a.bcm_SortOrder__c || 0) - (b.bcm_SortOrder__c || 0))
            .map((c) => c.Id);

        const sameParent = oldParentId === newParentId;
        let newSiblings = this._capabilities
            .filter((c) => (c.bcm_Parent__c || null) === newParentId && c.Id !== movedId)
            .sort((a, b) => (a.bcm_SortOrder__c || 0) - (b.bcm_SortOrder__c || 0))
            .map((c) => c.Id);
        const insertAt = Math.max(0, Math.min(target.position, newSiblings.length));
        newSiblings = [...newSiblings.slice(0, insertAt), movedId, ...newSiblings.slice(insertAt)];

        // No-op detection
        if (sameParent) {
            const oldOrderWithMoved = this._capabilities
                .filter((c) => (c.bcm_Parent__c || null) === oldParentId)
                .sort((a, b) => (a.bcm_SortOrder__c || 0) - (b.bcm_SortOrder__c || 0))
                .map((c) => c.Id);
            if (this._arraysEqual(oldOrderWithMoved, newSiblings)) {
                this._preDragSnapshot = null;
                cleanup();
                return;
            }
        }

        // Optimistic update
        this._applyOptimisticReorder(movedId, newParentId, level, newSiblings, oldSiblings);
        this._buildLayout(this._capabilities);
        if (this.detailCapability) {
            this.detailBreadcrumb = this._buildBreadcrumb(this.detailCapability.Id);
        }
        this.isSavingDragDrop = true;
        cleanup();

        this._dispatchSaveApex(movedId, newParentId, sameParent, newSiblings, oldSiblings);
    }

    _dispatchSaveApex(movedId, newParentId, sameParent, newSiblings, oldSiblings) {
        const apexCall = sameParent
            ? reorderCapabilities({ orderedIds: newSiblings })
            : reparentCapability({
                  capabilityId: movedId,
                  newParentId: newParentId,
                  newSiblingIds: newSiblings,
                  oldSiblingIds: oldSiblings
              });

        return apexCall
            .then(() => this._refreshCapabilities())
            .then(() => {
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
            })
            .catch((err) => {
                this._capabilities = this._preDragSnapshot;
                this._buildLayout(this._capabilities);
                if (this.detailCapability) {
                    this.detailBreadcrumb = this._buildBreadcrumb(this.detailCapability.Id);
                }
                this.isSavingDragDrop = false;
                this._preDragSnapshot = null;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Drag-drop save failed',
                        message: 'Failed to save changes. Your changes have been reverted.',
                        variant: 'error',
                        mode: 'dismissable'
                    })
                );
                console.warn('bcm drag-drop save failed', err);
            });
    }

    _handleDragKeyDown(evt) {
        if (!this.isDragging) return;
        if (evt.key === 'Escape') {
            evt.preventDefault();
            this._detachDragListeners();
            this._preDragSnapshot = null;
            this.isDragging = false;
            this.ghost = null;
            this.dropIndicator = null;
            this._dropTargetInfo = null;
            this._draggedNodeId = null;
            this._draggedNodeLevel = null;
        }
    }

    _detachDragListeners() {
        if (this._dragMoveBound) window.removeEventListener('mousemove', this._dragMoveBound);
        if (this._dragUpBound) window.removeEventListener('mouseup', this._dragUpBound);
        if (this._dragKeyDownBound) window.removeEventListener('keydown', this._dragKeyDownBound);
        this._dragMoveBound = null;
        this._dragUpBound = null;
        this._dragKeyDownBound = null;
    }

    _findLayoutNode(nodeId, level) {
        if (level === 1) return (this._layoutL1 || []).find((n) => n.id === nodeId);
        if (level === 2) return (this._layoutL2 || []).find((n) => n.id === nodeId);
        if (level === 3) {
            for (const l2 of this._layoutL2 || []) {
                const g = l2.bulletGroups.find((g2) => g2.l3Id === nodeId);
                if (g) return { l2, group: g };
            }
        }
        return null;
    }

    _buildGhostFromLayoutNode(layoutNode, level) {
        if (level === 1) {
            return {
                isL1: true,
                isL2: false,
                isL3: false,
                points: layoutNode.points
                    .split(' ')
                    .map((p) => {
                        const [px, py] = p.split(',').map(Number);
                        return `${px - layoutNode.handleX + 8},${py - (layoutNode.handleY - 4) + 0}`;
                    })
                    .join(' '),
                width: COLUMN_WIDTH,
                height: CHEVRON_HEIGHT,
                originX: layoutNode.handleX - 8,
                originY: layoutNode.handleY - CHEVRON_HEIGHT / 2 - 4,
                label: layoutNode.name,
                labelX: 12,
                labelY: 24,
                labelFill: BCM_L1_LABEL
            };
        }
        if (level === 2) {
            return {
                isL1: false,
                isL2: true,
                isL3: false,
                width: layoutNode.width,
                height: layoutNode.height,
                originX: layoutNode.x,
                originY: layoutNode.y,
                label: layoutNode.name,
                labelX: 12,
                labelY: 20,
                labelFill: BCM_L2_LABEL
            };
        }
        // L3
        const { group } = layoutNode;
        return {
            isL1: false,
            isL2: false,
            isL3: true,
            width: COLUMN_WIDTH - BOX_PADDING * 2 - 8,
            height: group.lines.length * LINE_HEIGHT,
            originX: group.handleHitX,
            originY: group.handleHitY,
            label: group.l3Name,
            labelX: 12,
            labelY: 14,
            labelFill: BCM_L3_LABEL
        };
    }

    _clientToViewport(clientX, clientY) {
        const svg = this.template.querySelector('svg.bcm-canvas');
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        return {
            x: (localX - this.panX) / this.zoom,
            y: (localY - this.panY) / this.zoom
        };
    }

    _hitTest(viewportX, viewportY, level) {
        if (level === 1) {
            const cols = this._layoutL1 || [];
            if (!cols.length) return null;
            // Use geometric column center as gap anchor — independent of label wrap.
            const colCenter = (colIdx) =>
                DIAGRAM_PADDING + colIdx * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2;
            for (let i = 0; i <= cols.length; i++) {
                const leftX = i === 0 ? -Infinity : colCenter(cols[i - 1].colIdx);
                const rightX = i === cols.length ? Infinity : colCenter(cols[i].colIdx);
                if (viewportX >= leftX && viewportX < rightX) {
                    return { parentId: null, position: i, level: 1 };
                }
            }
            return null;
        }

        if (level === 2) {
            const cols = this._layoutL1 || [];
            for (const l1 of cols) {
                const colX = DIAGRAM_PADDING + l1.colIdx * (COLUMN_WIDTH + COLUMN_GAP);
                if (viewportX < colX || viewportX > colX + COLUMN_WIDTH) continue;
                const l2sInCol = (this._layoutL2 || []).filter((n) => n.colIdx === l1.colIdx);
                if (!l2sInCol.length) {
                    return { parentId: l1.id, position: 0, level: 2 };
                }
                let pos = 0;
                for (let i = 0; i < l2sInCol.length; i++) {
                    const mid = l2sInCol[i].y + l2sInCol[i].height / 2;
                    if (viewportY < mid) {
                        pos = i;
                        return { parentId: l1.id, position: pos, level: 2 };
                    }
                }
                return { parentId: l1.id, position: l2sInCol.length, level: 2 };
            }
            return null;
        }

        if (level === 3) {
            for (const l2 of this._layoutL2 || []) {
                if (viewportX < l2.x || viewportX > l2.x + l2.width) continue;
                if (viewportY < l2.y || viewportY > l2.y + l2.height) continue;
                const groups = l2.bulletGroups || [];
                if (!groups.length) {
                    return { parentId: l2.id, position: 0, level: 3 };
                }
                for (let i = 0; i < groups.length; i++) {
                    const firstLine = groups[i].lines[0];
                    const mid = firstLine.y;
                    if (viewportY < mid) {
                        return { parentId: l2.id, position: i, level: 3 };
                    }
                }
                return { parentId: l2.id, position: groups.length, level: 3 };
            }
            return null;
        }
        return null;
    }

    _buildDropIndicator(target) {
        if (!target) return null;
        if (target.level === 1) {
            const cols = this._layoutL1 || [];
            const x =
                target.position === 0
                    ? DIAGRAM_PADDING - 4
                    : cols[target.position - 1]
                      ? cols[target.position - 1].handleX - 8 + COLUMN_WIDTH + COLUMN_GAP / 2
                      : DIAGRAM_PADDING;
            const y1 = DIAGRAM_PADDING - 4;
            const y2 = DIAGRAM_PADDING + CHEVRON_HEIGHT + 4;
            return { x1: x, y1, x2: x, y2 };
        }
        if (target.level === 2) {
            const l2sInCol = (this._layoutL2 || []).filter((n) => {
                const l1 = (this._layoutL1 || []).find((c) => c.id === target.parentId);
                return l1 && n.colIdx === l1.colIdx;
            });
            const l1 = (this._layoutL1 || []).find((c) => c.id === target.parentId);
            if (!l1) return null;
            const colX = DIAGRAM_PADDING + l1.colIdx * (COLUMN_WIDTH + COLUMN_GAP);
            let y;
            if (l2sInCol.length === 0) {
                y = DIAGRAM_PADDING + CHEVRON_HEIGHT + BOX_GAP - 2;
            } else if (target.position >= l2sInCol.length) {
                const last = l2sInCol[l2sInCol.length - 1];
                y = last.y + last.height + 2;
            } else {
                y = l2sInCol[target.position].y - 2;
            }
            return { x1: colX, y1: y, x2: colX + COLUMN_WIDTH, y2: y };
        }
        if (target.level === 3) {
            const l2 = (this._layoutL2 || []).find((n) => n.id === target.parentId);
            if (!l2) return null;
            const groups = l2.bulletGroups || [];
            let y;
            if (groups.length === 0) {
                y = l2.y + 30;
            } else if (target.position >= groups.length) {
                const last = groups[groups.length - 1];
                const lastLine = last.lines[last.lines.length - 1];
                y = lastLine.y + LINE_HEIGHT / 2;
            } else {
                y = groups[target.position].lines[0].y - LINE_HEIGHT / 2;
            }
            return { x1: l2.x + BOX_PADDING, y1: y, x2: l2.x + l2.width - BOX_PADDING, y2: y };
        }
        return null;
    }

    _arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    _applyOptimisticReorder(movedId, newParentId, newLevel, newSiblings, oldSiblings) {
        const byId = new Map();
        this._capabilities.forEach((c) => byId.set(c.Id, JSON.parse(JSON.stringify(c))));

        const moved = byId.get(movedId);
        if (moved) {
            moved.bcm_Parent__c = newParentId;
            moved.bcm_Level__c = newLevel;
        }
        newSiblings.forEach((id, i) => {
            const c = byId.get(id);
            if (c) c.bcm_SortOrder__c = i + 1;
        });
        oldSiblings.forEach((id, i) => {
            const c = byId.get(id);
            if (c) c.bcm_SortOrder__c = i + 1;
        });

        // Cascade level recalc to descendants
        const childrenByParent = new Map();
        for (const c of byId.values()) {
            const p = c.bcm_Parent__c || null;
            if (!childrenByParent.has(p)) childrenByParent.set(p, []);
            childrenByParent.get(p).push(c);
        }
        const queue = [movedId];
        while (queue.length) {
            const pid = queue.shift();
            const parent = byId.get(pid);
            const children = childrenByParent.get(pid) || [];
            for (const child of children) {
                child.bcm_Level__c = (parent.bcm_Level__c || 0) + 1;
                queue.push(child.Id);
            }
        }

        this._capabilities = Array.from(byId.values());
    }

    handleSvgMouseDown(evt) {
        if (this.isDragging) return;
        if (evt.target.closest('.bcm-node, .bcm-band-node')) return;
        const hadFocus = this.focusedNodeId !== null;
        this.focusedNodeId = null;
        this._keyNavMode = false;
        if (hadFocus) this._buildLayout(this._capabilities);
        this._isDragging = true;
        this._dragStartX = evt.clientX;
        this._dragStartY = evt.clientY;
        this._panStartX = this.panX;
        this._panStartY = this.panY;
    }

    handleSvgMouseMove(evt) {
        if (!this._isDragging) return;
        this._panX = this._clampPanX(this._panStartX + (evt.clientX - this._dragStartX));
        this._panY = this._clampPanY(this._panStartY + (evt.clientY - this._dragStartY));
    }

    handleSvgMouseUp() {
        this._isDragging = false;
    }

    handleNodeClick(evt) {
        evt.stopPropagation();
        const targetLevel = evt.target.dataset?.nodeLevel;
        const targetId = evt.target.dataset?.nodeId;

        const nodeId = evt.currentTarget.dataset.nodeId;
        const nodeLevel = targetLevel || evt.currentTarget.dataset.nodeLevel;
        if (!nodeId) return;

        // Resolve clicked id (L3 may sit inside a group)
        const l3Group = evt.target.closest && evt.target.closest('[data-l3-group]');
        const resolvedId =
            nodeLevel === '3' && targetId ? targetId : l3Group ? l3Group.dataset.l3Group : nodeId;

        // Panel open -> any click refreshes panel directly
        if (this.detailCapability || this.detailIsLoading) {
            this.focusedNodeId = resolvedId;
            this._keyNavMode = true;
            this._buildLayout(this._capabilities);
            this.handleViewDetail({ detail: { id: resolvedId } });
            return;
        }

        // Panel closed: 1st click focuses, 2nd click on already-focused opens panel
        const alreadyFocused = this.focusedNodeId === resolvedId;
        this.focusedNodeId = resolvedId;
        this._keyNavMode = true;
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
        this.detailIsLoading = true;
        this.detailCapability = null;
        this.detailBreadcrumb = this._buildBreadcrumb(id);
        this.detailErrorMessage = null;
        getCapabilityDetail({ capabilityId: id })
            .then((rec) => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailCapability = rec;
            })
            .catch((err) => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailErrorMessage = err?.body?.message || 'Failed to load capability detail';
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
            Id: payload.id,
            Name: payload.name,
            bcm_Definition__c: payload.definition,
            bcm_StrategySupport__c: payload.strategySupport,
            bcm_ArchitecturalNuance__c: payload.architecturalNuance,
            bcm_HideFromDiagram__c: payload.hideFromDiagram
        };
        this.detailErrorMessage = null;
        const reqId = ++this._detailRequestSeq;
        updateCapability({ capability })
            .then(() => {
                if (reqId !== this._detailRequestSeq) return null;
                this._capabilities = (this._capabilities || []).map((c) => {
                    if (c.Id !== payload.id) return c;
                    return {
                        ...c,
                        Name: payload.name,
                        bcm_Definition__c: payload.definition,
                        bcm_StrategySupport__c: payload.strategySupport,
                        bcm_ArchitecturalNuance__c: payload.architecturalNuance,
                        bcm_HideFromDiagram__c: payload.hideFromDiagram
                    };
                });
                this._buildLayout(this._capabilities);
                this._refreshCapabilities();
                return getCapabilityDetail({ capabilityId: payload.id });
            })
            .then((rec) => {
                if (reqId !== this._detailRequestSeq) return;
                if (rec) this.detailCapability = rec;
            })
            .catch((err) => {
                if (reqId !== this._detailRequestSeq) return;
                this.detailErrorMessage = err?.body?.message || 'Failed to save capability';
            });
    }

    handleDetailClose() {
        this._detailRequestSeq++;
        this.detailCapability = null;
        this.detailBreadcrumb = [];
        this.detailIsLoading = false;
        this.detailErrorMessage = null;
    }

    _buildBreadcrumb(id) {
        const byId = new Map();
        (this._capabilities || []).forEach((c) => byId.set(c.Id, c));
        const chain = [];
        let cur = byId.get(id);
        while (cur) {
            chain.unshift({ id: cur.Id, label: cur.Name });
            cur = cur.bcm_Parent__c ? byId.get(cur.bcm_Parent__c) : null;
        }
        return chain;
    }

    handleKeyDown(evt) {
        if (this.isDragging) return;
        const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (ARROW_KEYS.includes(evt.key)) evt.preventDefault();
        if (!this._keyNavMode) {
            if (evt.key === 'ArrowLeft') this._panX = this._clampPanX(this._panX + PAN_STEP);
            if (evt.key === 'ArrowRight') this._panX = this._clampPanX(this._panX - PAN_STEP);
            if (evt.key === 'ArrowUp') this._panY = this._clampPanY(this._panY + PAN_STEP);
            if (evt.key === 'ArrowDown') this._panY = this._clampPanY(this._panY - PAN_STEP);
        } else {
            if (evt.key === 'Escape') {
                this._keyNavMode = false;
                this.focusedNodeId = null;
                this._buildLayout(this._capabilities);
            } else {
                this._navigateFromKey(evt.key);
            }
        }
    }

    _navigateFromKey(key) {
        const l1 = this._layoutL1 || [];
        const l2Map = new Map((this._layoutL2 || []).map((n) => [n.id, n]));

        // Determine if focused node is L1, L2, or L3
        const focusedL1 = l1.find((n) => n.id === this.focusedNodeId);
        const focusedL2 = l2Map.get(this.focusedNodeId);
        const focusedL3 = (this._layoutL3Map || new Map()).get(this.focusedNodeId);

        // L3 focus: ArrowUp/Down move between siblings, ArrowUp from first goes to parent L2,
        // ArrowLeft/Right are ignored (focus + pan unchanged).
        // Note: ArrowDown on the last sibling is a no-op — focus unchanged, no rebuild needed.
        if (!focusedL1 && !focusedL2 && focusedL3) {
            const siblings = (this._l3ByL2 || new Map()).get(focusedL3.parentL2Id) || [];
            const idx = focusedL3.siblingIdx;
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

export { isStrategic };
