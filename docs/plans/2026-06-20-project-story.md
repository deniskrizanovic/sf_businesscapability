# Business Capability Map — Project Story

## The Beginning (May 23–25)

The project started as a blank repo on May 23 — just config, docs, and tooling. Two days of design work followed: record page layouts, a Cosmic Function Point sizing exercise, and a docs reorganisation. By the afternoon of May 25 the master plan was committed.

---

## The Master Plan (May 25)

The `2026-05-25-19:20-implementation-plan.md` was the spine of the whole project. It laid out 7 deployable slices (an 8th, drag-drop, was always known but kept separate), each gated on the previous one being manually verified and ticked off. The plan was unusually disciplined: no step could start unless the prior checkbox was `[x]`, the branch had to be clean, and every Salesforce metadata file had to be generated via a skill — no hand-written XML except one deliberate exception (`bcm_CanEdit`). The function point table gave the build a quantifiable shape: 119 CFPs across 8 steps.

---

## Steps 1–4: The Data Model (May 25–28)

Each step landed within roughly one day.

**Step 1 (May 25)** — `bcm_Map__c` was the foundation: the object, the two permission sets (`bcm_Viewer` / `bcm_Editor`), the Maps tab, and the Lightning App. Done and deployed the same evening the plan was written.

**Step 2 (May 26)** — `bcm_Capability__c` was the most complex data layer step. A self-referencing lookup for parent-child hierarchy, a trigger that derived `Level` and auto-assigned `SortOrder`, four validation rules as safety guards, a full Apex test class with permission boundary tests, and a Map Record Page with the Capabilities related list. The spec was rewritten mid-step from technical to business language — a sign that the team was sharpening how they thought about acceptance criteria.

**Step 3 (May 27)** — `bcm_Tag__c` added the colour classification system. A restricted picklist with 10 hex-coded pastel values, and the `bcm_ColourSwatch` LWC — a colour-filled tile rendered on the Tag record page. Small step, but it introduced the first custom LWC component.

**Step 4 (May 27–28)** — `bcm_CapabilityTag__c` was the junction object tying Capabilities to Tags. Two Master-Detail relationships, cascade deletes, permission additions. Completed quickly. What followed immediately after was more significant: the Playwright e2e scaffold landed on May 28 as its own block of work — global Apex teardown, `RUN_ID` isolation, shared helpers, auto-dismissal of banners. The test infrastructure was becoming a first-class concern.

---

## Step 5: App Shell (May 29–30)

Step 5 built the scaffolding the UI would hang from: the `bcm_CanEdit` Custom Permission (the one deliberate XML exception), stub modals for Visualisation and Import wired into the Map Record Page header, and Visualisation tab visibility in the permission sets. No real functionality yet — just the load-bearing walls.

---

## Step 6: Import (May 30)

The Import flow arrived fast. `bcm_ImportController` with `@InvocableMethod` (no `@AuraEnabled` — a deliberate design choice that avoided a separate Aura wrapper), `bcm_Import_Flow` as a Screen Flow with success/error screens, and the `bcm_ImportButton` LWC updated to embed it. One adjustment plan arrived the same day: the Import button moved from the record page header to the Map list-view action row and was relabelled "JSON Import".

---

## Step 7: The Diagram (May 30 – June 6)

Step 7 was the centrepiece and it expanded far beyond its original scope. The plan opened on May 30 but didn't close until June 5 — six days, a dozen sub-plans, and the bulk of the commit log.

**The original scope** was a read-only SVG diagram: L1 chevrons, L2 boxes, L3 bullets, zoom/pan, tag colourisation, a context menu stub, and the `bcm_VisualisationModal` promoted to host the real LWC.

**What actually shipped** was much more:

- The context menu stub was scrapped and replaced by a Detail Panel slide-in (GH #22, #23) — read-only first, then editable.
- `bcm_IsCrossCutting__c` field added to mark capabilities that span the whole map (GH #29).
- A full-width cross-cutting band at the canvas bottom, with a toolbar toggle hidden by default and reset on map switch (GH #30, #31).
- `bcm_HideFromDiagram__c` field with a Show Hidden toggle and dashed-border rendering.
- Keyboard navigation — Arrow keys for pan and node navigation, Escape to clear focus.
- Fit-to-window and Reset View toolbar buttons.
- SessionStorage persistence for the selected map with stale-ID fallback (GH #26).
- Canvas focus outline suppressed (GH #34), SVG viewport boundary removed (GH #35), Detail Panel anchored to LWC root to fix clipping (GH #41).
- L3 tag colourisation — tinted background rect when the selected tag matched (GH #46).

Several adjustment plans were written mid-flight: `step7-adjustments` promoted Visualisation from a modal into an app nav tab; `step7-visualiser-adjustments` added text wrap, pinned L1 chevrons, and the hide flag. The step closed with a formal `step7-closeout` plan that reconciled everything.

Also during Step 7: the Jest unit test suite was born. The Playwright coverage PRD identified gaps, and a systematic Jest scaffold was added — first zoom/pan state machine tests, then node click UX, context menu, and keyboard nav. The project gained two independent test layers.

---

## Step 8 and the Post-Diagram Polish (June 6–12)

Step 8 (drag-drop) was planned on June 6 and delivered quickly: `bcm_DragDropController` with reorder and reparent methods, ghost elements, drop indicator lines, optimistic local state, and Apex error revert with toast. A permission fix landed a day later when editor users were found to be blocked from saving.

What followed from June 7 to June 12 was a focused quality pass driven by a growing issue backlog:

- Tag colour combobox refresh on focus (GH #50) — the wire wasn't refreshing stale data.
- Record page link added to Detail Panel (GH #45).
- E2e Apex-seed migration: global test setup rewritten to seed data via Apex rather than through the UI, with seed IDs persisted to JSON for cross-suite use. This eliminated a whole class of flakiness.
- Persist selected Tag to sessionStorage across reloads (GH #54).
- Strategic Support toggle on toolbar (GH #49).
- Toolbar dropdown clipping fix (GH #61).
- Visual language refresh — a `tokens` module replaced hard-coded colour and sizing values (GH #43).
- Vertical and horizontal pan clamping to keep the map in view (GH #71, #72).
- A Playwright flakiness audit (GH #60) hardened timeouts, replaced `waitForTimeout` with DOM assertions, and added `drainSpinners`/`gotoLightning` helpers.
- An authoritative `bcm_CapabilityMap` design doc was written, superseding earlier scattered files.
- The token tracker script landed (GH #42) — a Python tool that parses cost CSVs and regenerates a markdown cost table while preserving user-written preamble.

---

## Where It Stands (June 20)

The most recent commit added error/confirmation message exits to all write-path function points. Step 8 checkbox is still `[ ]` — drag-drop is deployed but not formally signed off. The function point count sits at 107 of 119, with the drag-drop FPs (FP5–6) still open. The project has a complete data model, a working import pipeline, a feature-rich interactive diagram, a hardened e2e suite seeded via Apex, and a token cost tracker to measure the cost of building it all.
