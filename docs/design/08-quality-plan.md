# Quality Plan

## Overview

This document is the single reference for quality in the Business Capability Map
project. It covers four concerns:

1. **Prevention** — static analysis and formatting enforced before code is committed
2. **Specification** — how requirements are written and how they frame the application
3. **Verification** — the test layers that prove the application behaves correctly
4. **Measurement** — coverage thresholds and traceability completeness

This is a single-developer project. There is no CI pipeline or peer review. All
quality gates are enforced locally via pre-commit hooks and developer discipline.
If the project becomes multi-developer, a CI pipeline should be added as the first
step — running `npm run lint`, `npm run scan`, and `npm run test:unit` on every
push to `main`.

---

## 1. Prevention

### Static analysis and formatting (pre-commit)

Every `git commit` triggers a Husky pre-commit hook that runs lint-staged over the
staged files:

| Files | Tool | What it enforces |
|---|---|---|
| `**/*.{cls,trigger}` | `sf code-analyzer run -s 2` | PMD + CPD rules at severity ≥ 2 |
| `**/{aura,lwc}/**/*.js` | ESLint (`@salesforce/eslint-config-lwc`) | LWC component quality rules |
| `**/lwc/**` | Jest (`--bail --findRelatedTests --passWithNoTests`) | Related LWC unit tests must pass |
| All source files | Prettier | Consistent formatting (auto-fixed before commit) |

`code-analyzer.yml` configures the engines: PMD and CPD use Java 17 Temurin; SFGE
and Flow analysis are disabled for this project.

Running tools manually:

```bash
npm run lint          # ESLint only
npm run scan          # sf code-analyzer across all of force-app at severity ≥ 2
npm run prettier      # auto-format everything
npm run prettier:verify  # check formatting without writing
```

### What the tools do not catch

The pre-commit hook cannot enforce:

- Missing `Tested by:` or `Deferred:` markers in spec files
- Missing `@spec` traceability comments in test methods
- FP count not updated after adding a functional process
- Implementation plan step not marked complete

These are enforced by the **definition of done checklist** in Section 5.

---

## 2. Specification

### Acceptance Criteria and spec files

Every feature is specified in `docs/specs/` before implementation begins. Specs use
Gherkin-style BDD scenarios (Given / When / Then). Each scenario is a concrete,
verifiable statement of behaviour — not a description of implementation.

Specs are the primary framing document for the application. A feature does not exist
unless it has a scenario in a spec file. A scenario that cannot be tested (by Apex,
Playwright, or a documented deferral) is incomplete.

### Function Points as a gap-identification and AC-authorship tool

This project uses COSMIC v5.0 (ISO 19761) functional size measurement, documented
in `docs/design/99-cosmic-function-point-count.md`. The FP exercise has served two
purposes:

**Gap identification.** Enumerating data movements (Entry, Exit, Read, Write) for
each functional process forces explicit decisions about what the system does and does
not do. During initial FP counting, this exercise surfaced gaps in both requirements
(things the system needed to do that were not yet written down) and test coverage
(requirements that were written but had no test assigned).

**AC authorship framework.** From Step 5 onwards, new functional processes are
enumerated before spec scenarios are written. The data movements become the checklist
for AC completeness: a scenario is required for every observable Exit and every Write
that can fail. This approach is to be formalised as a process rule.

> ADR pending: FP-driven AC authorship — recording the decision to derive
> Acceptance Criteria from COSMIC functional process enumeration rather than from
> wireframes or user stories.

### Traceability: spec → test (forward)

Every scenario in `docs/specs/` carries a coverage marker immediately below its
heading. Three forms are valid:

| Marker | When to use |
|---|---|
| `> Tested by: ClassName.methodName` | Apex or e2e test exists and passes |
| `> Tested by: ClassName.methodName (not yet written — see docs/handoff/<file>.md)` | Method name agreed, test not written yet; handoff doc must exist |
| `> Deferred: <one-line reason>` | Consciously skipped — platform-enforced constraint, genuinely out of scope |

`UI only` and `not yet covered` are banned.

### Traceability: test → spec (reverse)

Every Apex test method carries a `@spec` comment immediately above the `@IsTest`
annotation, linking it back to the scenario it covers:

```apex
// @spec capability-object.md · "Feature title" · "Scenario title"
@IsTest
static void myTest() { ... }
```

Every Playwright test carries a `// spec:` comment inside the test body:

```typescript
test('editor can create a map', async ({ page }) => {
    // spec: map-object.md · "Feature title" · "Scenario title"
```

The feature and scenario titles must match the exact wording in the spec file.
Running `grep -r "@spec"` across the codebase produces the full reverse traceability
map. Running the same against the spec `Tested by:` markers produces the forward map.

Bi-directional traceability was introduced retroactively at Step 4 completion and
applies to all test methods from that point forward.

---

## 3. Verification

The project uses three test layers. Two are active; one is deferred.

### Layer 1: Apex Unit Tests

**Tooling:** Salesforce Apex test framework (`@IsTest`)

**Owns:** Any behaviour enforced in Apex — validation rules, Level derivation, Sort
Order derivation, cascade delete behaviour, and DML-layer permission enforcement
(insert/update/delete blocked by `with sharing`).

Apex tests run entirely in-process in an isolated test context (`SeeAllData=false`).
They are fast, deterministic, and do not require a browser or a deployed org.

**Does not own:** Field visibility on forms, button presence/absence, related list
rendering, LWC component output, or anything that requires a rendered Lightning UI.

**Tiebreaker:** If Apex already enforces a constraint at DML, do not duplicate that
check in Playwright. "Level 0 is rejected" is an Apex concern — a Playwright test
for the same would be fragile and redundant.

### Layer 2: Playwright E2E Tests

**Tooling:** Playwright (`@playwright/test`), run against a deployed Salesforce org.

**Owns:** Any behaviour only verifiable through a real browser session:
- Field presence and layout on Lightning record forms
- UI permission enforcement — button/tab presence or absence based on permission set
- Related list visibility and content
- LWC component rendering in the browser (colour swatch, diagram canvas, etc.)
- Drag-and-drop interactions once the diagram LWC is built

Playwright tests authenticate as real users against the target org and exercise the
Lightning Experience UI directly.

**Does not own:** Business logic already validated by Apex. Playwright tests assume
valid data and do not re-test Apex constraints through the UI.

### Layer 3: Jest LWC Unit Tests (deferred)

**Tooling:** `@salesforce/sfdx-lwc-jest`

**Would own:** LWC component logic that is purely JavaScript — computed properties,
conditional rendering driven by JS state, custom event firing and handling, and any
pure-function utilities in component files.

**Current status:** Deferred until Steps 7–8 when `bcm_CapabilityMap` and
`bcm_CapabilityNode` are implemented. `jest.config.js` is present and the dependency
is installed.

### Test Users

Two static users exist in the target org:

| User | Permission Set | Purpose |
|---|---|---|
| `bcm-editor-test@...` | `bcm_Editor` | Full access — creates, edits, deletes records |
| `bcm-viewer-test@...` | `bcm_Viewer` | Read-only — verifies write controls are absent |

Both users are assigned the `AutomatedTester - Minimum Access Clone` profile with
`BypassMFAForUiLogins` and `SkipIdentityConfirmation` to allow headless login.

See `docs/design/08-testing-strategy.md` (archived) for full test user setup,
authentication, data management, and `playwright.config.ts` walkthrough.

---

## 4. Measurement

### Apex coverage

Salesforce enforces a 75% overall Apex coverage floor at deploy time. This is a
platform minimum, not a target.

**Project target: 90% per class.** Every Apex class (excluding `TestDataFactory`)
must achieve at least 90% line coverage. This is not automatically enforced by
tooling — it is verified manually when running:

```bash
sf apex run test --test-level RunLocalTests --target-org <alias> --code-coverage
```

Classes falling below 90% are a blocker for marking an implementation step complete.

### Jest coverage

Jest is configured to run related tests on pre-commit (`--findRelatedTests`). Once
Jest tests are actively written (Steps 7–8), a coverage threshold will be added to
`jest.config.js`:

```js
coverageThreshold: {
    global: { lines: 90, functions: 90, branches: 80 }
}
```

This is not yet active — it will be added when the first Jest test is written.

### Traceability completeness

Before closing an implementation step, every scenario in the relevant spec file must
carry a valid `Tested by:` or `Deferred:` marker. An unmarked scenario is a
quality gap, not an acceptable state.

---

## 5. Definition of Done

Before marking any implementation step complete, verify each item:

- [ ] Every new spec scenario has a `Tested by:` or `Deferred:` marker
- [ ] Every new Apex test method has a `@spec` comment pointing to the correct scenario
- [ ] Every new Playwright test has a `// spec:` comment inside the test body
- [ ] All Apex classes in scope are at or above 90% line coverage
- [ ] `npm run lint` passes with no errors
- [ ] `npm run scan` passes with no severity ≥ 2 violations
- [ ] FP count updated in `docs/design/99-cosmic-function-point-count.md` if new functional processes were added
- [ ] Implementation plan row marked complete with date in `docs/plan/implementation-plan.md`

---

## Running the Tests

```bash
# Apex tests (requires target org)
sf apex run test --test-level RunLocalTests --target-org <alias>
sf apex run test --test-level RunLocalTests --target-org <alias> --code-coverage

# E2E tests (requires .env configured with org URL and test user credentials)
npx playwright test
npx playwright test tests/e2e/map.spec.ts   # single spec
npx playwright test --project=editor        # editor project only
npx playwright show-report                  # open HTML report

# LWC unit tests
npm run test:unit
npm run test:unit:coverage

# Linting and scanning
npm run lint
npm run scan
```

Prerequisites for E2E: copy `.env.example` → `.env`, fill in org URL and credentials,
ensure both test users exist via `./scripts/create-e2e-users.sh [org-alias]`.
