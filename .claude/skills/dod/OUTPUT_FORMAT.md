# DoD output format

Emit the `/check-traceability` output first (unchanged), then append:

---

## Test execution

### Apex

Two tables — test classes first, then production classes.

| Class                        | Tests | Failures | Result |
| ---------------------------- | ----- | -------- | ------ |
| bcm_CapabilityTagTest        | 5     | 0        | ✅     |
| bcm_CapabilityValidationTest | 24    | 0        | ✅     |

| Production class      | Coverage | Result |
| --------------------- | -------- | ------ |
| bcm_CapabilityHandler | 95%      | ✅     |
| bcm_CapabilityTrigger | 100%     | ✅     |

- Test class result: ✅ if failures = 0, otherwise ❌
- Production class result: ✅ if coverage ≥ 90%, otherwise ❌
- `*Test*` names → first table only; all other `bcm_` names → second table only

If any test failed, append immediately below the table:

```
**Failures**
- bcm_CapabilityTagTest.viewer_cannotCreateJunction — System.AssertException: ...
```

### Playwright verification points

Emitted before the test run. Format mirrors parser output:

```
describe: Map selector — editor project
  test: Map combobox is present in diagram toolbar
    → expect(page.getByRole('combobox', { name: 'Map' }).first()).toBeVisible()
  test: Canvas shows no chevrons before a map is selected
    → expect(polygonCount).toBe(0)
describe: Diagram structure — editor project
  ...
```

If the parser emits a `⚠` warning line, include it verbatim.

### Playwright

| Total | Failures | Result |
| ----- | -------- | ------ |
| 37    | 0        | ✅     |

Result: ✅ if failures = 0, otherwise ❌.

If any test failed, append immediately below:

```
**Failures**
- [viewer project] Tags related list has no New button for Viewer
```

### FP count

Either:

```
⚠️  This step added functional processes (FP14, FP20–21). Run /cosmic-rule-coach
    to verify the FP count in docs/design/99-cosmic-function-point-count.md is up to date.
```

or:

```
ℹ️  No new functional processes in this step — FP count does not need updating.
```

### Static analysis

| Check                | Result |
| -------------------- | ------ |
| sf code-analyzer run | ✅     |

If failed, append the first violation line immediately below:

```
**sf code-analyzer run — first violation**
force-app/main/default/classes/bcm_CapabilityHandler.cls:12: AvoidDeeplyNestedIfStmts ...
```
