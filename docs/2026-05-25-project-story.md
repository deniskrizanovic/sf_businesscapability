# The Story of Business Capability Map
*Written 2026-05-25 — all times are Sydney time (AEST, UTC+10)*

---

## Where It Started

On the morning of Saturday 23 May 2026, a Salesforce DX project was created and a single commit was pushed: the boilerplate README that every new SFDX project ships with. Eighteen lines of documentation links. No code, no design, no direction — just the shell of something that hadn't decided what it was yet.

Two days passed.

---

## The Real-World Spark

On Monday 25 May, the project woke up with purpose. The first commit of the day — at 8:07am AEST — added a detailed strategy mapping document: a real business capability model for Homes NSW, comparing their documented capabilities against some external benchmark. It was a dense, 780-line analysis of what a housing agency actually does, expressed as a hierarchy of capabilities.

One minute later, at 8:08am AEST, it was gone. The file was removed from the repository and added to `.gitignore`.

The document had served its purpose: it was the seed, the real-world example that would inform the shape of the data model, the vocabulary of the domain, and the structure of the diagram. It just didn't belong checked into a codebase. That instinct — to use real artefacts for inspiration but not commit sensitive material — is visible in the two-commit sequence that ended that thread.

---

## The Foundation

At 8:05am AEST in the same session (these commits arrived out of order, with the Homes NSW removal following the foundation commit almost immediately), a much larger commit landed. It was the project's true beginning.

In a single push, the repository went from a blank SFDC skeleton to a fully scaffolded, documented system. The commit message said it plainly: *"Add project config, docs, and tooling setup."* What it contained was more than that.

**The tooling arrived first.** ESLint was wired up with the SFDX-recommended ruleset, Jest was configured for LWC unit tests, and `package.json` carried the full dependency tree. The scratch org definition was written. The `.forceignore` was set to exclude IDE files, node modules, and the sensitive strategy document. These weren't afterthoughts — they were first things.

**Then came the architecture.** Two Architecture Decision Records were written:

*ADR-0001* addressed a fundamental problem: in a Salesforce org, if you store capability records directly without a container, every Level 1 root node is implicitly part of "the one map." Multiple business units, multiple versions, multiple clients — all contaminated together. The decision was to introduce `bcm_Map__c` as a first-class object. Every capability record would carry a required lookup to a Map. The diagram, import utility, and list views would all scope to a single selected Map. Tags, however, would be org-wide — a tag applied to one map's capabilities could conceptually apply across maps.

*ADR-0002* made the architecture call on the Apex layer. Enterprise frameworks like FFLIB (Apex Enterprise Patterns, with its Domain/UnitOfWork abstractions) were considered and rejected. The reason was proportionality: at three domain objects, the framework overhead exceeds the benefit. Instead, a clean four-layer architecture was specified — Trigger → TriggerHandler → Service → Selector — with a thin Controller for LWC-facing methods. The LWC conventions were equally deliberate: `@wire` for reads, imperative for mutations, and a strict container/presentational component split where no child calls Apex directly.

**The design docs covered everything.** Six planning documents arrived in this commit:

- `01-data-model.md` defined the four objects (`bcm_Map__c`, `bcm_Capability__c`, `bcm_Tag__c`, `bcm_CapabilityTag__c`), their fields, relationship types, delete constraints, and validation rules. The self-referencing parent lookup on `bcm_Capability__c` required a subtle decision: Salesforce does not allow `Restrict` or `Cascade` delete constraints on self-referencing lookups. The constraint must be `SetNull` — a deployment failure waiting to happen if hand-written and not caught. It was caught here, in the spec.

- `02-import.md` designed the mechanism for loading data. A nested JSON tree would be pasted into a textarea component by an admin. An Apex controller would parse it, upsert the Map, upsert Tags, upsert Capabilities in two passes (first without parent links to avoid ordering issues, then a second pass to wire up the hierarchy), and finally rebuild the junction records for capability-tag associations. The two-pass upsert for capabilities was a deliberate design choice to avoid the problem of inserting a child before its parent exists.

- `03-diagram-layout.md` worked out the SVG coordinate geometry — how to calculate column widths, row heights, chevron shapes for Level 1, rounded rectangles for Level 2, and bullet lists for Level 3.

- `04-drag-drop.md` handled the interactive structural editing. Two operations were defined: *reorder* (drag within the same parent, updating `bcm_SortOrder__c` for all siblings) and *reparent* (drag to a different parent, updating `bcm_Parent__c`, `bcm_Level__c` for the moved node and all its descendants, and rewriting sort orders for both the old and new sibling groups).

- `05-lwc-architecture.md` specified the component tree and every piece of tracked state in `bcm_CapabilityMap`. It also identified a known LWC constraint: child components cannot return SVG fragments directly into a parent SVG. The recommendation was to skip LWC child components for node rendering entirely, and instead implement node renderers as pure JavaScript classes called from the parent template. This keeps all SVG inside one component's single template and sidesteps the SVG-in-shadow-DOM problem.

- `06-app-structure.md` defined the Lightning App (`bcm_BusinessCapabilityMap`), its tabs, and the two Permission Sets. `bcm_Viewer` gets read-only access, drag handles hidden. `bcm_Editor` gets full access, drag handles visible. The visibility of drag handles is controlled not by the permission set directly but by a Custom Permission (`bcm_CanEdit`) checked at runtime in the LWC — the idiomatic Salesforce approach for conditional UI.

A `CONTEXT.md` was written as a domain glossary: Business Capability, Level, Tag, Sort Order, Diagram, Map, Import, External ID, Rendering Mode, Permission Sets, Diagram Page, and every LWC component — all defined precisely. This document became the shared vocabulary for the project.

`CLAUDE.md` arrived alongside — the project rules file. Its central rule: *never hand-write Salesforce metadata XML.* A table mapped each metadata type to the skill that must be invoked first. The reasoning was pragmatic and painful: hand-written Salesforce XML fails deployment due to strict XSD element ordering, deprecated elements per API version, and org-specific values. Only one explicit exception was granted: the Custom Permission XML, which is simple enough to get right by hand.

---

## A False Start, Then Clarity

At 1:04pm AEST, a commit arrived titled *"Remove botched build order docs."* Something had gone wrong with an earlier attempt to sequence the build steps. The details aren't in the commit message, but the removal was clean — no replacement yet, just the acknowledgement that the approach needed rethinking.

Five minutes later, the folder was renamed: `docs/plan` became `docs/design`. The design artefacts were design documents, not a plan. The naming distinction mattered.

Then came `07-record-pages.md`. This document filled a gap identified during functional analysis: the Map object had no tab in the app. Without a tab, Editors had no in-app path to create or delete Maps — they'd need to navigate to the object URL directly. The document added a Maps tab to the Lightning App, but restricted its visibility to `bcm_Editor` users only. Viewers reach Map data through the diagram combobox, not through tab navigation.

---

## The Size of the Thing

Also at 1:59pm AEST, `08-cosmic-function-point-count.md` arrived. This was unusual.

COSMIC (Common Software Measurement International Consortium, ISO 19761) is a formal software sizing method. It counts functional size in CFP — COSMIC Function Points — by identifying every data movement that crosses the software boundary: Entries (data coming in from a user), Exits (data going out to a user), Reads (from persistent storage), and Writes (to persistent storage, including deletes).

The measurement was methodical. Four data groups were identified (Map, Capability, Tag, CapabilityTag). Twenty-eight functional processes were defined and sized. Certain processes were excluded on principle — SVG layout calculation, zoom and pan state, tag colour highlight rendering — because they involve no data movement across the software boundary. These aren't functional processes under COSMIC; they're internal computation.

The careful work of the count shows the thinking: FP4 (Import) scored 11 CFP because the two-pass capability upsert, the delete-then-insert of junction records, and the multi-object read cycle each required separate Write movements under COSMIC Rule 14 — which counts multiple writes to the same object within one functional process when the FURs explicitly require it. FP6 (Reparent) scored 8 CFP for similar reasons.

The total: **111 CFP**.

This is a project that was being sized before it was being built.

---

## The Build Plan

The final commit of the day landed at 7:20pm AEST: *"Add implementation plan, BDD specs, and update design docs."*

The implementation plan divided the work into eight deployable steps, each gated on the previous step's checkbox being ticked. The gate is enforced in the plan document itself, with an explicit instruction that work must stop and ask if a prior step isn't complete before the next one begins.

The steps follow a strict bottom-up sequence:
1. `bcm_Map__c` — the container object, permission sets, Maps tab, app
2. `bcm_Capability__c` — the core object, validation rules, Capabilities tab
3. `bcm_Tag__c` — the label object, colour validation
4. `bcm_CapabilityTag__c` — the junction
5. App structure — Custom Permission, FlexiPage stubs, tab wiring
6. Import — the Apex import controller and the ImportUtility LWC
7. Diagram — the read-only CapabilityMap LWC: layout, SVG rendering, zoom, pan, tag highlight
8. Drag-drop — the DragDropController and the LWC interactions

Each step has a corresponding BDD spec file in `docs/specs/`. Acceptance criteria are written in Given/When/Then form. Every Apex test class must test permission boundaries using `System.runAs()` — at minimum one Viewer test user and one Editor test user, with assertions about which operations throw and which succeed.

No step had been started. All eight progress checkboxes were empty.

---

## Where It Stands

As of the end of 25 May 2026, the project is fully designed and not yet built.

The foundation is unusually solid for a pre-build state. The data model is specified to field-level detail, including delete constraints that would cause deployment failures if wrong. The architecture decisions are recorded with their rejected alternatives. The LWC constraints are documented alongside their workarounds. The app has been sized in 111 CFP under ISO 19761. The build sequence is gated, each step deployable independently, each with formal acceptance criteria.

The target org is `home-denispoc`. The first thing to be deployed is a single custom object with one field and two permission sets.

The rest follows from there.
