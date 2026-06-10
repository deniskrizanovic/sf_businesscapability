# Testing Strategy

## Overview

This document describes how the Business Capability Map application is tested: what
layers exist, what each layer owns, how test users and data are managed, and how to
run the tests. It is the single reference for anyone writing or reviewing tests in
this project.

The decision to use Playwright for browser-layer testing — including the alternatives
considered and rejected — is recorded in
[ADR 0003: Playwright for E2E testing](../adr/0003-playwright-e2e-testing.md).

---

## Traceability

Every scenario in `docs/specs/` carries a coverage marker immediately below its
heading. Three forms are valid:

| Marker                                                                             | When to use                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `> Tested by: ClassName.methodName`                                                | Apex or e2e test exists and passes                                         |
| `> Tested by: ClassName.methodName (not yet written — see docs/handoff/<file>.md)` | Method name agreed, test not written yet; handoff doc must exist           |
| `> Deferred: <one-line reason>`                                                    | Consciously skipped — platform-enforced constraint, genuinely out of scope |

`UI only` is not valid. Every scenario that requires browser verification must be
covered by a named Playwright test and marked with its test reference.

This traceability is the connective tissue between the specs and the test suite.
When reading a spec you can see exactly which test exercises each scenario; when
reading a test you can find the scenario it was written for. Coverage gaps are
visible at a glance — an unmarked scenario means no test exists for it yet.

---

## Test Layers

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
check in Playwright. For example, "Level 0 is rejected" is an Apex concern — writing
a Playwright test that fills in Level 0 and checks the error message would be fragile
and redundant.

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
pure-function utilities in component files. These tests run in Node, require no org
connection, and are fast.

**Current status:** `jest.config.js` is present and the dependency is available, but
no tests have been written. Jest has been deferred because the diagram and drag-drop
LWC components (the most logic-heavy components) are not yet built. Jest will become
relevant at Steps 7–8 when `bcm_CapabilityMap` and `bcm_CapabilityNode` are
implemented.

---

## Test Users

Two static users exist in the target org. They are created once and never recreated
by the test suite.

| User                  | Permission Set | Purpose                                             |
| --------------------- | -------------- | --------------------------------------------------- |
| `bcm-editor-test@...` | `bcm_Editor`   | Full access — creates, edits, and deletes records   |
| `bcm-viewer-test@...` | `bcm_Viewer`   | Read-only — verifies that write controls are absent |

Static users are used rather than programmatic provisioning because Salesforce user
creation from Apex is slow and unreliable in automated contexts. The usernames and
passwords are stored in `.env` (gitignored). `.env.example` documents the required
variables.

### Profile

Both users are assigned the `AutomatedTester - Minimum Access Clone` profile
(committed to source at
`force-app/main/default/profiles/AutomatedTester - Minimum Access Clone.profile-meta.xml`).
This profile is a clone of Minimum Access — the lowest-privilege standard profile —
with three deliberate additions:

- **`BypassMFAForUiLogins`** — prevents Salesforce from prompting for a second
  factor during username/password login. Without this, Playwright's login flow
  stalls at the MFA screen.
- **`SkipIdentityConfirmation`** — suppresses the "Verify your identity" interstitial
  that Salesforce shows for logins from unfamiliar IP addresses. Without this, the
  test runner would be blocked on first login from any new CI machine or developer
  laptop.
- **`ActivitiesAccess` and `ChatterInternalUser`** — standard permissions required
  for Lightning Experience to load correctly.

All `bcm_` tabs (`bcm_Map__c`, `bcm_Capability__c`, `bcm_Tag__c`) are set to
`Hidden` at the profile level. Tab visibility for these objects is granted
exclusively via the `bcm_Editor` and `bcm_Viewer` permission sets. This is
intentional: it means the Playwright tests for tab visibility are genuinely
testing that the permission sets do their job, not that the profile grants access.

### Creating the test users

`scripts/create-e2e-users.sh` creates (or idempotently re-creates) both users in
the target org. It reads credentials from `.env`, substitutes them into
`scripts/create-e2e-users.apex` at runtime, executes the Apex via `sf apex run`,
then discards the substituted file. Credentials are never written to disk
permanently.

```bash
./scripts/create-e2e-users.sh [org-alias]
```

The Apex script uses `Database.upsert` on `User.Fields.Username`, so re-running it
is safe — it updates the existing users rather than attempting to create duplicates.
Permission set assignments are checked before insert to avoid duplicate-assignment
errors.

### Authentication

`tests/e2e/fixtures/auth.setup.ts` runs as a Playwright setup project before any
spec. It logs in as each user via the Salesforce login page, then saves the browser
session to `tests/e2e/.auth/editor.json` and `tests/e2e/.auth/viewer.json`
(gitignored). Subsequent test projects consume the saved session via `storageState`,
avoiding repeated logins.

Sessions are refreshed on every `npx playwright test` invocation and are not
persisted between runs.

---

## Data Management

### RUN_ID isolation

Every Playwright test run is assigned a `RUN_ID` — a timestamp written to
`tests/e2e/.run_id` by `global-setup.ts` at the start of the run. Every test that
creates a record embeds the RUN_ID in the record name (e.g.
`E2E Map Create 1716900000000`). This namespaces all test data to the current run,
so concurrent runs on different machines do not interfere with each other.

### Teardown

`global-teardown.ts` runs after all specs complete. It generates an Apex script that
deletes every record whose name contains the RUN_ID, in FK-safe order:

1. `bcm_CapabilityTag__c` — junction records first
2. `bcm_Capability__c`
3. `bcm_Tag__c`
4. `bcm_Map__c`

The script is executed via `sf apex run` against the org identified by
`SF_ORG_ALIAS` in `.env`. After execution the script file is removed.

Teardown is unconditional — it runs whether tests pass or fail.

### Per-test data creation

Each test creates the data it needs inline. There is no pre-seeded fixture dataset.
This means every test is independently runnable without prior setup, and there is
no shared global state that a failing test can corrupt.

### `beforeAll` for shared read-only fixtures

`beforeAll` is permitted within a `describe` block when:

1. The setup is expensive enough to justify sharing (e.g. creating a record that
   multiple assertions will verify)
2. **All tests in the block are read-only with respect to the shared data** — no
   test mutates, deletes, or depends on the mutation of the shared record

A test that mutates shared data must use inline setup or `beforeEach` instead.
Violating this rule causes ordering-dependent failures that are hard to diagnose.

---

## Running the Tests

### Prerequisites

1. Copy `.env.example` to `.env` and fill in the org URL and test user credentials.
2. Ensure `SF_ORG_ALIAS` in `.env` matches your target org alias in `sf` CLI.
3. Ensure both test users exist in the org with the correct permission sets assigned.

### Commands

```bash
# Run all e2e tests
npx playwright test

# Run a single spec
npx playwright test tests/e2e/map.spec.ts

# Run only the editor project
npx playwright test --project=editor

# Open the HTML report after a run
npx playwright show-report

# Run Apex tests (requires target org)
sf apex run test --test-level RunLocalTests --target-org <alias>
```

---
