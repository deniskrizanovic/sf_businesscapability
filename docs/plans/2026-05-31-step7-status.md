# Step 7 Visualiser Adjustments — Execution Status

| Adjustment              | Status  | Notes                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 — Text wrapping       | ✅ done | Removed `truncateText`, uncapped `wrapText` for L2 header (cap 10), wrapped L3 bullets (cap 5 per item), dynamic `boxHeight` via `headerHeight + bulletLines * LINE_HEIGHT + BOX_PADDING`. Template unchanged (flat bulletLines array).                                                     |
| 3 — Pinned L1 chevrons  | ✅ done | SVG split into two `<g>` layers: L1 uses `l1Transform` (panX + zoom, no panY); L2 uses `viewportTransform` (full pan + zoom) with `clipPath` clipping below chevron row. `l2ClipY` computed property. `canvasWidth` updated to count visible cols.                                          |
| 1 — Hide From Diagram   | ✅ done | `bcm_HideFromDiagram__c` field deployed, added to SOQL SELECT. Two-pass BFS cascade in `_buildLayout`. `showHidden` toggle + `handleToggleHidden`. Dashed border via `strokeDash` on layout nodes. Toggle available to all roles. FLS added to `bcm_Editor` + `bcm_Viewer` permission sets. |
| 2 — Keyboard navigation | ✅ done | `focusedNodeId` state, `handleKeyDown` (pan mode + navigate mode), `_navigateFromKey` with `_colMap`/`_l2ByCol` column maps. Focus ring + fill via `isFocused` flag in layout nodes. SVG gets `tabindex="0"` and `onkeydown`. Click sets focus.                                             |

## Playwright Results

Final run after FLS fix: **21/21 passed** (2.1m)

Previous runs:

- Pre-deploy (old code): 14/15 pass — 1 context-menu timeout (org load)
- Post-deploy (new code, missing FLS): 9/15 pass — SOQL error `No such column 'bcm_HideFromDiagram__c'` on USER_MODE query
- Post-FLS deploy: in progress

## Open Issues

None. The SOQL error was resolved by adding `bcm_HideFromDiagram__c` field permissions to `bcm_Editor` and `bcm_Viewer` permission sets.
