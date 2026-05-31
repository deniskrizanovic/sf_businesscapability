# Step 7 Adjustments: Visualisation Tab

## Context

Step 7 originally surfaced the `bcm_CapabilityMap` LWC behind a quick-action button (`bcm_VisualisationButton`) on the bcm_Map__c record page — the user had to navigate to a map record and click a modal action to see the diagram. This adjustment promotes the visualisation to a first-class navigation tab in the Business Capability Map Lightning app, so users reach it directly from the app nav bar without first opening a record.

The VisualisationButton LWC and its quick action become redundant and are fully deleted.

See also: `docs/plan/step7-diagram-lwc.md` (original Step 7 build plan).

## Deliverables

### 1. New: `bcm_VisualisationPage` FlexiPage (AppPage)
- Skill: `generating-flexipage`
- Type: AppPage, full-width single-region layout
- Region `main` → `c:bcm_CapabilityMap`
- File: `force-app/main/default/flexiPages/bcm_VisualisationPage.flexipage-meta.xml`

### 2. New: `bcm_Visualisation` custom tab (flexiPage tab)
- Skill: `generating-custom-tab`
- Points at `bcm_VisualisationPage`
- Label: "Visualisation"
- Icon: Custom45 (monitor/screen motif — adjust if not available)
- File: `force-app/main/default/tabs/bcm_Visualisation.tab-meta.xml`

### 3. Edit: `bcm_BusinessCapabilityMap` Lightning App
- Skill: `generating-custom-application`
- Add `bcm_Visualisation` to navItems, second slot (after bcm_Map__c, before bcm_Capability__c)
- File: `force-app/main/default/applications/bcm_BusinessCapabilityMap.app-meta.xml`

### 4. Edit: `bcm_MapRecordPage` FlexiPage
- Skill: `generating-flexipage`
- Remove `bcm_Map__c.Visualisation` from dynamicHighlights actions list
- Reduce visible action count from 4 → 3
- File: `force-app/main/default/flexiPages/bcm_MapRecordPage.flexipage-meta.xml`

### 5. Delete: `bcm_Map__c.Visualisation` quick action
- File: `force-app/main/default/quickActions/bcm_Map__c.Visualisation.quickAction-meta.xml`
- Must be removed from org before deleting from source (destructive deploy)

### 6. Delete: `bcm_VisualisationButton` LWC
- Entire directory: `force-app/main/default/lwc/bcm_VisualisationButton/`
- Must be removed from org before deleting from source (destructive deploy)

### 7. Edit: `bcm_CapabilityMap` LWC meta.xml
- Add `lightning__AppPage` to targets so component is placeable on the new AppPage
- File: `force-app/main/default/lwc/bcm_CapabilityMap/bcm_CapabilityMap.js-meta.xml`

### 8. Edit: Permission Sets — tab visibility
- Skill: `generating-permission-set`
- Add `bcm_Visualisation` tab visibility (Visible = true) to both:
  - `force-app/main/default/permissionsets/bcm_Editor.permissionset-meta.xml`
  - `force-app/main/default/permissionsets/bcm_Viewer.permissionset-meta.xml`

### 9. Edit: `tests/e2e/diagram.spec.ts` — adjust for tab navigation

Current tests use `openDiagram()` which navigates to a map record URL then clicks the "Visualisation" button to open a modal. With the tab approach, the diagram is at a fixed app tab URL, not behind a modal.

Changes required:
- Replace `openDiagram(page, mapUrl)` helper: instead of going to a record URL and clicking a button, navigate directly to the Visualisation tab URL (e.g. `/lightning/n/bcm_Visualisation`) and wait for `.bcm-canvas` to appear
- The `Map selector — editor project` beforeAll still needs to create the map and import data (keep that logic); but seeding no longer depends on navigating to a record page for the visualisation entry point
- Remove: `await page.getByRole('button', { name: 'Visualisation', exact: true }).click()` from all callers
- Update `Permission — viewer project` test: currently checks viewer can see the Visualisation button then open it; change to navigate to the tab URL directly and assert no `.bcm-drag-handle` elements
- The `DIAGRAM_URL_FILE` file-based URL sharing between editor/viewer test projects: still needed for `mapUrl` used in Import seeding; keep but rename to make intent clear (`DIAGRAM_SEED_MAP_URL_FILE`)

### 10. Edit: `docs/plan/implementation-plan.md`
- In Step 7 row, append note: "See also: `step7-adjustments.md` (visualisation tab variant)"
- Keep Step 7 checkbox and CFP count unchanged

## Build Sequence

1. Edit `bcm_CapabilityMap` meta.xml — add `lightning__AppPage` target
2. Run `generating-flexipage` skill → `bcm_VisualisationPage` AppPage
3. Run `generating-custom-tab` skill → `bcm_Visualisation` tab
4. Run `generating-custom-application` skill → update app navItems
5. Run `generating-flexipage` skill → update `bcm_MapRecordPage` (remove Visualisation action)
6. Run `generating-permission-set` skill → update both permission sets
7. Destructive deploy: remove quick action + LWC from org (`package.xml` with `DestructiveChanges`)
8. Delete source files: quickAction file, lwc directory
9. Deploy remaining changes: `sf project deploy start --source-dir force-app`
10. Update `tests/e2e/diagram.spec.ts` per section 9 above
11. Run Playwright tests
12. Edit `docs/plan/implementation-plan.md` cross-reference

## Verification

- App nav bar shows "Visualisation" tab between Maps and Capabilities
- Clicking tab loads `bcm_CapabilityMap` LWC with Map combobox visible
- bcm_Map__c record page has no "Visualisation" action button (only Edit, Delete, Import)
- Both Editor and Viewer permission sets can access the tab
- Playwright suite passes with updated `openDiagram` navigation
