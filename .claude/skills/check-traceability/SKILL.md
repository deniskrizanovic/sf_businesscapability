# Skill: check-traceability

Checks bi-directional traceability between spec files and test code for all
completed implementation steps. Reports a pass/fail summary table followed by
violations grouped by spec file.

## When to invoke

Use after completing any implementation step, or any time you want to verify the
traceability health of completed steps. Accepts an optional single spec filename
to narrow the check (e.g. `check-traceability capability-object.md`).

## Inputs

- `docs/plan/implementation-plan.md` — source of truth for which steps are `[x]` complete
- `docs/specs/*.md` — spec files for completed steps
- `force-app/main/default/classes/*.cls` — Apex test classes
- `tests/e2e/*.spec.ts` — Playwright test files

## Checks

| Column header     | Direction | What is checked                                                                                                               |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| All covered       | Forward   | Every spec scenario has a `> Tested by:` or `> Deferred:` marker — no bare scenarios                                          |
| Apex refs valid   | Forward   | Every `Tested by:` Apex reference (`ClassName.methodName`) resolves to a real method in the `.cls` file                       |
| e2e refs valid    | Forward   | Every `Tested by:` e2e reference (`` `e2e/foo.spec.ts::"desc"` ``) resolves to a test with that exact description in the file |
| @spec back-refs   | Reverse   | Every `// @spec foo.md · "Feature" · "Scenario"` in Apex resolves to a real feature + scenario in the named spec file         |
| No banned markers | Format    | Any banned marker (`not yet covered`, `UI only`) is flagged as a format violation                                             |

## Scope

By default, only spec files whose corresponding implementation step is marked `[x]`
in `docs/plan/implementation-plan.md` are checked. The step-to-spec mapping is:

| Step | Spec file                  |
| ---- | -------------------------- |
| 1    | `map-object.md`            |
| 2    | `capability-object.md`     |
| 3    | `tag-object.md`            |
| 4    | `capability-tag-object.md` |
| 5    | `app-structure.md`         |
| 6    | `import.md`                |
| 7    | `diagram.md`               |
| 8    | `drag-drop.md`             |

If an optional filename argument is provided (e.g. `capability-object.md`), check
only that file regardless of step completion status.

## Output format

### Summary table (always shown)

```
| Spec file                  | All covered | Apex refs valid | e2e refs valid | @spec back-refs | No banned markers | Result |
|----------------------------|-------------|-----------------|----------------|-----------------|-------------------|--------|
| capability-object.md       | PASS        | PASS            | PASS           | PASS            | PASS              | ✅     |
| capability-tag-object.md   | PASS        | FAIL            | PASS           | PASS            | PASS              | ❌     |
```

### Violations (shown only when there are failures, grouped by spec file)

```
#### capability-tag-object.md

**Apex refs valid — method not found**
> Tested by: `bcm_CapabilityTagTest.editor_insertsJunction_succeeds`
  Method `editor_insertsJunction_succeeds` not found in bcm_CapabilityTagTest.cls

**@spec back-refs — scenario not found**
  // @spec capability-tag-object.md · "Feature X" · "Scenario Y"
  Scenario "Scenario Y" not found under feature "Feature X" in capability-tag-object.md
```

### Manual items (always shown at the bottom)

Remind the user of the DoD items the skill cannot automate:

```
## Manual checks still required
- [ ] Org: all objects/fields visible in Setup → Object Manager
- [ ] Org: Apex test classes pass with ≥ 90% coverage per class
- [ ] Org: manual CRUD and cascade-delete scenarios verified in the browser
- [ ] Playwright: npx playwright test tests/e2e/<spec>.spec.ts passes with zero failures
```

## Step-to-spec mapping maintenance

When a new step is added to the implementation plan, add a row to the mapping table
above. The spec filename is the base name of the file in `docs/specs/`.
