---
name: check-doc-consistency
description: Use when a plan, design doc, or spec has been added or changed — verifies all documentation layers stay in sync. Covers COSMIC arithmetic, new FP coverage for new Apex methods, LWC architecture tables, spec coverage markers, plan FP table, and CONTEXT.md glossary.
---

# Skill: check-doc-consistency

## When to invoke

After any session that changes:

- `docs/plans/*.md` (new feature plan)
- `docs/design/05-lwc-architecture.md` (new component or Apex method)
- `docs/design/99-cosmic-function-point-count.md` (new FPs)
- `docs/specs/*.md` (new scenarios)
- `CONTEXT.md` (new terms)

## Checks

Run all checks and emit the summary table, then violations grouped by layer.

---

### Check 1 — COSMIC arithmetic

File: `docs/design/99-cosmic-function-point-count.md`

1. Sum all individual FP sizes (CFP column in section 3/4).
2. Compare to summary table total row (section 5).
3. Compare to "Total COSMIC Functional Size: N CFP" sentence.
4. Verify each row: E + X + R + W = CFP stated.

**FAIL** if any number mismatches.

---

### Check 2 — Plan FP table vs COSMIC

File: `docs/plans/<plan>.md` (check the most-recently-modified plan, or all plans modified in this session)

1. Locate "New Functional Processes (COSMIC)" table.
2. For each FP listed: verify it appears in `99-cosmic-function-point-count.md` with the same CFP size.
3. Verify running total stated in plan (e.g. `111 → 119 CFP`) matches COSMIC doc grand total.

**FAIL** if FP missing from COSMIC doc, CFP mismatch, or running total wrong.

---

### Check 3 — LWC architecture tables

File: `docs/design/05-lwc-architecture.md`

1. **Component table** — for every LWC component directory under `force-app/main/default/lwc/`, check a row exists in the Component Overview table. Ignore `bcm_CapabilityNode` (documented as pure JS, may not have a row).
2. **Apex controllers table** — for every `@AuraEnabled` method in every `*Controller.cls` file, check a corresponding entry exists in the Apex Controllers table.
3. **Tracked State block** — any `@track` or reactive property added to `bcm_CapabilityMap.js` should appear in the Tracked State block.

**FAIL** if component or Apex method is undocumented.

---

### Check 4 — Spec coverage markers

Files: `docs/specs/diagram.md` (and any spec modified this session)

1. Every scenario block must end with `> Tested by:` or `> Deferred:`.
2. No banned markers: `not yet covered`, `UI only`.
3. `Tested by:` references pointing to `capability-detail.spec.ts` — verify the quoted test description exists in `tests/e2e/capability-detail.spec.ts` if that file exists. If the file does not exist yet, flag as **PENDING** (not FAIL).
4. Checklist items in the relevant plan's acceptance checklist — every item must have a corresponding spec scenario. Report mismatches.

**FAIL** if bare scenario (no marker) or banned marker found.  
**WARN** if Tested by reference points to non-existent test description (file exists).  
**PENDING** if test file doesn't exist yet.

---

### Check 5 — New FP coverage

This check goes the **other direction**: given new code in this session, are all new boundary-crossing operations documented as Functional Processes?

A new FP is required whenever new code introduces a data movement across the software boundary (human user ↔ software). The COSMIC boundary rules from `docs/design/99-cosmic-function-point-count.md` section 1.2 apply.

**Triggers for a new FP:**

| New code                                       | Data movement type                             | Requires FP?                                           |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| New `@AuraEnabled` read method                 | E (trigger) + R (query) + X (data to UI)       | Yes                                                    |
| New `@AuraEnabled` write method                | E (trigger) + W (DML) + X (confirmation to UI) | Yes                                                    |
| New LWC component that displays data from Apex | X (data sent to human)                         | Covered by controller's FP — no new FP if same trigger |
| Pure client-side JS (zoom, pan, layout)        | No boundary crossing                           | No FP needed                                           |
| New field added to existing SOQL query         | Additional R in existing FP                    | Update existing FP, not new one                        |

**Steps:**

1. List all new `@AuraEnabled` methods introduced in this session (from the plan's "Files to modify/create" or by diffing `*Controller.cls` files against what existed before).
2. For each new method: check `99-cosmic-function-point-count.md` for a corresponding FP with that method in the `FUR source` or `Implements` field.
3. List all new LWC components introduced: check whether they trigger new Apex calls not covered by existing FPs.
4. Check the plan's "New Functional Processes (COSMIC)" table — does it list an FP for every new boundary-crossing operation?

**FAIL** if a new `@AuraEnabled` method has no corresponding FP in the COSMIC doc.  
**WARN** if a new LWC component is introduced but no new FP exists and no existing FP appears to cover its data loads.

---

### Check 6 — CONTEXT.md glossary

File: `CONTEXT.md`

For every domain term introduced in this session's plan or design docs, verify a definition exists in `CONTEXT.md`. Look for the term name as a `## TermName` heading.

**FAIL** if a term used in spec or plan has no glossary entry.

---

## Output format

### Summary table (always shown)

```
| Layer                         | Check                              | Result   |
|-------------------------------|------------------------------------|----------|
| COSMIC arithmetic             | Row sums + grand total             | ✅/❌    |
| Plan FP table                 | FPs present in COSMIC doc          | ✅/❌    |
| LWC architecture — components | All LWC dirs documented            | ✅/❌    |
| LWC architecture — Apex       | All @AuraEnabled documented        | ✅/❌    |
| Spec markers                  | No bare/banned scenarios           | ✅/❌    |
| Spec markers                  | Test refs resolvable               | ✅/⚠️/⏳ |
| Spec ↔ plan checklist         | All checklist items in spec        | ✅/❌    |
| New FP coverage               | New @AuraEnabled methods have FP   | ✅/⚠️/❌ |
| CONTEXT.md glossary           | New terms defined                  | ✅/❌    |
```

### Violations (only when failures/warnings exist)

Group by layer. For each violation, quote the exact text and state what is wrong.

### Pending items (always shown at bottom)

List test files referenced in spec markers that do not yet exist:

```
## Pending (test files not yet written)
- tests/e2e/capability-detail.spec.ts — referenced by N scenarios in diagram.md
```
