# E2E Test Architecture

This document explains the design of the Playwright end-to-end suite under `tests/e2e/`. It complements:

- [ADR 0003 — Playwright for E2E testing](../adr/0003-playwright-e2e-testing.md): why Playwright, alternatives rejected.
- [ADR 0004 — Drag-drop test strategy](../adr/0004-playwright-drag-drop-test-strategy.md): hybrid gesture + outcome-only approach.
- [Quality Plan §3 Layer 2](08-quality-plan.md): how e2e fits into the overall test stack and what it owns.

This doc is the *how* and *why* of the suite mechanics — authentication, seeding, isolation, helpers, ordering, teardown — and the constraints that forced each choice.

---

## 1. Constraints

The suite runs against a **deployed Salesforce org**, not a local stub. Every test logs in over the public web, navigates Lightning Experience, and exercises real Apex / LWC. This single fact dictates most of the architecture:

| Constraint | Consequence for design |
|---|---|
| Org is shared across runs and users | Test data must be namespaced per run so concurrent runs (CI + local + WebStorm) cannot collide |
| Login is slow (5–15 s) and rate-limited | Cannot log in per test; sessions are reused |
| Lightning UI mounts onboarding overlays asynchronously | Helpers must strip overlays before they steal focus from controls |
| `sf apex run` is the only out-of-band write path | Seed and teardown go through Apex, not REST or the UI |
| Salesforce permission model is the system under test | Two real users (Editor + Viewer) are required; mocking permissions defeats the test |
| Concurrent UI sessions on one org cause cross-talk | Workers must be limited; project ordering must be deterministic |

The suite is intentionally a thin layer on top of the real org. We do not abstract Salesforce away. We build small helpers around its idiosyncrasies and let the tests be plain Playwright.

---

## 2. Suite layout

```
tests/e2e/
├── fixtures/
│   ├── auth.setup.ts        Logs in as editor + viewer, saves storage state
│   ├── helpers.ts           setupAutoDismiss, selectMap, openDiagram, gotoLightning,
│   │                        flow, clickFlowNext, recordIdFromUrl, RUN_ID
│   ├── run-id.ts            Reads .run_id from disk
│   └── seeds.ts             Aggregator: runs all SeedSpecs through bcm_ImportController,
│                            writes Name->Id map to .seed-ids.json, exposes getSeedIds()
├── *.seed.ts                Per-feature payloads + exported MAP_NAME / cap names
├── *.spec.ts                Per-feature scenarios
├── global-setup.ts          Writes .run_id, then calls runAllSeeds([…])
├── global-teardown.ts       Deletes everything matching %RUN_ID% in FK-safe order
└── .run_id, .seed-ids.json, .auth/*.json    Generated, gitignored
```

`playwright.config.ts` ties it together:

- **`globalSetup`** runs once per `playwright test` invocation. Writes the RUN_ID, then seeds all maps via a single `sf apex run`.
- **`globalTeardown`** runs once at end. Single Apex script wipes everything by RUN_ID.
- **Three projects**: `setup` (auth), `editor`, `viewer`. Editor/viewer each consume their respective `storageState`.
- **`fullyParallel: false`** plus **`workers: 2`** — see §7.

---

## 3. Authentication: setup project + storageState

Logging in over the Salesforce login page costs roughly ten seconds and occasionally trips MFA prompts. Doing it per test would dominate the run time and introduce flake unrelated to the system under test.

`fixtures/auth.setup.ts` is a Playwright **setup project** that runs before any spec. It logs in once as editor and once as viewer, then writes the browser's cookies + localStorage to `tests/e2e/.auth/editor.json` and `tests/e2e/.auth/viewer.json`. The `editor` and `viewer` projects each declare the setup project as a dependency and load the appropriate `storageState`.

Two test users are created once and reused indefinitely (`scripts/create-e2e-users.sh`). They use a custom profile (`AutomatedTester - Minimum Access Clone`) with `BypassMFAForUiLogins` and `SkipIdentityConfirmation`. Without those, headless login would stall on the second-factor and identity-confirmation interstitials. The profile hides all `bcm_*` tabs at the profile level so the e2e tab-visibility tests are genuinely exercising permission sets, not profile defaults.

Test users live in `.env` (gitignored); `.env.example` documents the variables.

---

## 4. RUN_ID isolation

Every run needs a unique stamp so that:

1. Two developers running the suite simultaneously against the same org do not collide.
2. A run that crashes mid-test leaves behind data that the next run does not collide with — eventual cleanup is enough.
3. Teardown can find exactly its own records and not delete a colleague's seed.

`global-setup.ts` writes `Date.now().toString()` to `tests/e2e/.run_id`. `fixtures/run-id.ts` reads it. `helpers.ts` re-exports the value as `RUN_ID`. Every record name embeds it: `E2E DragDrop Map 1716900000000`, `Domain Alpha 1716900000000`, etc.

The RUN_ID is read **eagerly at module load** by `fixtures/run-id.ts`. This forces an explicit ordering inside `global-setup.ts`: the `.run_id` file must be written **before** any seed module is required, because the seed modules embed the RUN_ID into their `MAP_NAME` constants at module-load time.

```ts
// global-setup.ts
fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');
const { dragDropSeed } = require('./drag-drop.seed');  // reads RUN_ID now
```

`require()` is used (not dynamic `import()`) because Playwright's CommonJS-style loader does not handle top-level `await import()` reliably in the global-setup hook.

---

## 5. Seeding: one `sf apex run`, in `globalSetup`

### Earlier approach (rejected)

The original suite seeded data inside `beforeAll` blocks in each spec, driving the JSON Import Flow through the UI. That meant:

- Each spec's `beforeAll` opened the Import Flow iframe, pasted JSON, and clicked Next/Import. Slow (10–20 s per spec) and flaky (iframe selectors, focus-trap collisions).
- Editor and Viewer projects ran the same `beforeAll` independently, each creating its own Map. With `fullyParallel`, they raced — both projects sometimes seeded, then one's teardown ran before the other's tests.
- A single Map name with two records caused `selectMap` to throw a strict-mode violation deep inside an unrelated test.
- One late hold-out (`capability-tag.spec.ts`) seeded a Map + Capability + Tag through the new-record forms inside `beforeAll`. On a sluggish sandbox the three sequential UI saves blew the default 30 s hook timeout; the failed-record retry then hit the Lightning "Check your Internet connection" interrupt screen with no recovery. Both went away when the spec was migrated to a `*.seed.ts` payload + `postSeedApex` (see below).

### Current approach

`globalSetup` runs **once per invocation**, before any project, and seeds all features in a single Apex transaction. Each feature exports a `SeedSpec` payload from its `*.seed.ts` file:

```ts
// fixtures/seeds.ts
export interface SeedSpec {
    label: string;
    payload: unknown;            // accepted by bcm_ImportController.importCapabilities
    postSeedApex?: string;       // optional follow-up DML the importer can't do
}
```

`runAllSeeds` concatenates each payload into one Apex script that calls `bcm_ImportController.importCapabilities('<json>')` per seed and asserts success. The script is written to a temp `.apex` file and executed via `sf apex run --file`. Total seed time: roughly one Apex round-trip regardless of how many features are added.

### Properties this gives us

- **Idempotent.** `bcm_ImportController` upserts by `externalId`. Re-running globalSetup after a crashed run is safe.
- **Single failure surface.** If a seed fails, the whole run fails fast at globalSetup, not five minutes into a spec with a confusing UI error.
- **No editor/viewer race.** Both projects see the same already-seeded data.
- **Specs are read-only against seed data** (with one exception: the drag-drop gesture test mutates sort order, then asserts; subsequent drag-drop tests don't depend on the original order).

### `postSeedApex` for things the importer can't do

`bcm_ImportController.importCapabilities` only handles Map + Capability hierarchies. Anything else is `postSeedApex`:

- **`diagram.seed.ts`** flips `bcm_IsCrossCutting__c = true` on two seeded capabilities (the importer doesn't expose the field).
- **`capability-tag.seed.ts`** inserts a `bcm_Tag__c` and **transfers ownership to the editor user** so the editor's UI session can save a `bcm_CapabilityTag__c` master-detail junction without `insufficient access rights on cross-reference id`. The Tag is read-write OWD but the integration user that runs the seed is not the editor; without the ownership transfer, sharing-recalc lag intermittently blocks the cross-reference write.

When a spec needs a record the importer doesn't model, prefer `postSeedApex` over per-spec UI setup. UI setup pulls Salesforce sandbox latency back into the test timeline.

The current registered seeds (see `global-setup.ts`) are: `dragDropSeed`, `capabilityDetailSeed`, `diagramSeed`, `capabilityTagSeed`, `capabilityRelatedListSeed`, `capabilityRtfSeed`, `viewerReadMapSeed`. The last three were migrated from per-spec UI `beforeAll` into apex-seed payloads to remove sandbox latency and editor/viewer ordering races; the same playbook applies to any future spec that needs a pre-existing Map or Capability.

### Seed-ids capture: `.seed-ids.json` + `getSeedIds()`

Specs that need to deep-link to a seeded record (`/lightning/r/bcm_Capability__c/<id>/view`) used to run a per-test `sf data query` to resolve Name->Id. That added 1–3 s per spec and another sandbox round-trip that could fail.

`runAllSeeds` now appends a final Apex block to the seed script that queries every `bcm_Capability__c`, `bcm_Map__c`, and `bcm_Tag__c` whose Name matches `%RUN_ID%`, JSON-serialises the `Name -> Id` map, base64-encodes it, and emits a single `System.debug('BCM_SEED_IDS:<base64>')` line. The TS side captures `sf apex run` stdout, anchors on the `USER_DEBUG|...|DEBUG|BCM_SEED_IDS:` marker (so the echoed Apex source doesn't false-match), decodes the JSON, and writes `tests/e2e/.seed-ids.json`.

Specs read it through `getSeedIds()` from `fixtures/seeds.ts`:

```ts
const id = getSeedIds().capabilities[RTF_CAP_NAME];
await page.goto(`/lightning/r/bcm_Capability__c/${id}/view`);
```

The base64 wrapper is load-bearing: the Lightning debug-log pipeline HTML-entity-encodes raw quotes in `System.debug` output, mangling JSON. Base64 encoding survives it cleanly.

`.seed-ids.json` is gitignored and rewritten on every globalSetup; it is not a contract surface beyond the current run.

---

## 6. Map selection helper

Most diagram-based specs follow the pattern:

```ts
await openDiagram(page);             // navigate, wait for canvas
await selectMap(page, MAP_NAME);     // open combobox, click option, wait for SVG
```

`selectMap` (in `fixtures/helpers.ts`) hardens three known flakes:

1. **Onboarding overlays close the dropdown.** Lightning mounts `RUNTIME_THP_LEARNING-*`, `SALES_YUKON-*`, etc. wrapped in `<lightning-focus-trap>`. The trap steals focus and silently closes any open combobox. `setupAutoDismiss` (called by every test before navigation) installs a `MutationObserver` via `addInitScript` that strips matching elements *as they mount*. Earlier attempts using `addLocatorHandler` fired mid-click and stole focus instead of restoring it.

2. **Late banners (Live Preview, June-2026 security nag).** Same pattern: `setupAutoDismiss` removes them before they can intercept clicks.

3. **Duplicate seed.** If two Maps end up with the same name (e.g. a stale partial run), the option locator matches twice and Playwright's strict mode throws cryptically. `selectMap` checks the option count, throws a clear "duplicate seed — check globalSetup ran exactly once" diagnostic.

After clicking the option, `selectMap` waits for `.bcm-canvas polygon` to be visible. The combobox click is wrapped in `expect.toPass` so a transient overlay-mount can be retried.

### `gotoLightning` for record-page navigation

Salesforce sandboxes intermittently render a "Sorry to interrupt — Check your Internet connection / Try Again" page in place of the requested record or app page on first paint. Without recovery, the next locator wait fails against the wrong DOM with a confusing "element not found" error.

`openDiagram` has handled this for the Visualisation tab from the start. The same pattern is now exposed as a generic helper:

```ts
await gotoLightning(page, '/lightning/r/bcm_Capability__c/<id>/view');
```

`gotoLightning` does up to three goto attempts; if the interrupt screen appears after a goto, it clicks Refresh/Try Again and re-navigates. Use it whenever a spec calls `page.goto(<lightning-url>)` directly (record pages, list views, app launchers). Plain `page.goto` is fine for non-Lightning URLs.

---

## 7. Worker count and project ordering

### Why `workers: 2` + `fullyParallel: false`

The earlier `workers: 1` setting was adopted while three different sources of cross-worker flake were in play:

1. **Cross-spec teardown collision** — `diagram.spec.ts` deleted capabilities by `Map.Name LIKE '%RUN_ID%'` with no Map filter, wiping other suites' caps before they ran. **Fixed in §8** (single global teardown).
2. **Same-user UI cross-talk** — two workers logged in as the same user steal each other's modal focus / close combobox dropdowns / etc.
3. **Org-side throttles** on parallel login + refresh-apex storms.

(2) and (3) are the structural reasons that survive any teardown fix. They only bite *within the same project* — the `editor` and `viewer` projects authenticate as different users with separate `storageState`s, so cross-project parallelism does not trigger same-user cross-talk and the throttle headroom is fine for two workers.

`fullyParallel: false + workers: 2` therefore lets `editor` and `viewer` projects run concurrently while spec files within each project remain serial. That preserves the deterministic ordering specs rely on (§8), retains all single-project flake protection, and recovers most of the wall-clock cost of the prior `workers: 1` setting.

If cross-project flake returns (rare — both projects need to touch the same record), revert to `workers: 1` and document the regression.

### Why deterministic order matters

Within each project, `workers: 2 + fullyParallel: false` still runs spec files in alphabetical order. That ordering must not matter — a spec must not depend on (or be broken by) another spec's after-effects. This invariant is enforced by §8.

---

## 8. Teardown: single source

There is **one** teardown: `global-teardown.ts`. It generates an Apex script that deletes everything matching `%RUN_ID%` in FK-safe order:

1. `bcm_CapabilityTag__c` (junction)
2. `bcm_Tag__c`
3. `bcm_Capability__c`
4. `bcm_Map__c`

Tags are deleted before Capabilities because `bcm_CapabilityTag__c` is master-detail to *both* Capability and Tag; deleting Capabilities cascades junction records, and a same-transaction Tag delete afterwards conflicts with the in-flight cascade.

### Pitfall: per-spec `afterAll` teardowns are dangerous

Earlier versions of `diagram.spec.ts` and `capability-detail.spec.ts` each had their own `afterAll` block running an Apex DELETE. Two failure modes:

- **`diagram.spec.ts`** deleted capabilities by `bcm_Map__r.Name LIKE '%${RUN_ID}%'` — *no Map-name filter on the cap-delete*. Because every seed uses the same RUN_ID, that one query nuked drag-drop and capability-detail capabilities too. Under `workers: 1` (alphabetical order), `diagram.spec.ts` runs before `drag-drop.spec.ts`, so drag-drop's seed was wiped before its tests ran. Symptom: `selectMap` finds the Map but waits 20 s for `.bcm-canvas polygon` that never paints (no caps to render).
- **`capability-detail.spec.ts`** correctly scoped its delete to its own MAP_NAME but ran in editor's `afterAll`. If viewer's tests on the same spec ran after editor's, they saw a deleted Map.

**Both per-spec teardowns have been removed.** The rule is now: **only `global-teardown.ts` deletes data.** A spec that needs to mutate seed data should make changes that don't affect other specs; if isolation is genuinely needed, define a fresh seed in a new `*.seed.ts` file.

---

## 9. Drag-drop: hybrid gesture + outcome-only

Documented in [ADR 0004](../adr/0004-playwright-drag-drop-test-strategy.md). Summary:

- **One** real-mouse gesture test (`L2 reorder within column`) drives `mouse.down → move(8 steps) → up` against handle bounding boxes. Proves the SVG hit-testing + optimistic update path end-to-end.
- **Five** outcome-only tests (`L2 reparent`, `L1 reorder`, `L3 reorder`, `L3 reparent`, etc.) skip the gesture and mutate `bcm_Parent__c` / `bcm_SortOrder__c` directly via `sf apex run`, then reload and assert structure. Proves the persistence permutations without combinatorial flake.
- Cancel paths and Apex-error revert are Jest-only.

The gesture test waits for the optimistic→server roundtrip via a `[data-bcm-saving="true|false"]` attribute toggle on the canvas container. This avoids `waitForTimeout` and races with auto-dismiss toasts.

`parseDragDropOrder` runs an ad-hoc Apex query and parses the debug log, anchoring on the `USER_DEBUG` marker. The anchor is necessary because `sf apex run` echoes the source file in its output — the source itself contains the `DRAG_DROP_RESULT:` string, which would otherwise match first.

---

## 10. Spec → test traceability

Every spec scenario in `docs/specs/` carries a `> Tested by:` marker. For Playwright specs the marker is the test description string verbatim:

```
> Tested by: e2e/map.spec.ts::"editor creates a Map record with a description"
```

If a test description changes, the marker updates in the same commit. Verified by `/check-traceability` (see `docs/design/08-quality-plan.md` §1).

This means **test descriptions are part of the contract** — renaming a test for stylistic reasons silently breaks traceability. Use `sed`-style global rename or update the spec in the same PR.

---

## 11. Running the suite

```bash
# Whole suite
npx playwright test

# One spec
npx playwright test tests/e2e/drag-drop.spec.ts

# One project
npx playwright test --project=editor

# HTML report (opens last run's results)
npx playwright show-report
```

`globalTeardown` runs even when only one spec is selected, so partial runs leave the org clean.

Pre-flight: `.env` populated, `SF_ORG_ALIAS` matches `sf` CLI alias, both test users created (`./scripts/create-e2e-users.sh <alias>`).

---

## 12. What is intentionally not in the suite

- **No mocked Salesforce.** The whole point is to test against the real platform.
- **No CI integration yet.** The suite is run manually before merging. Adding GitHub Actions is the first step if the project becomes multi-developer.
- **One retry, used for diagnosis.** `playwright.config.ts` sets `retries: 1`. The retry exists so that a transient sandbox jitter does not fail a whole run, but the suite's stance is that flake should be diagnosed and fixed, not papered over with bigger retry counts. The HTML report flags any test that needed its retry as `flaky` — treat those as an open question, not a pass.
- **No visual regression.** Screenshots are saved on failure for diagnosis, not asserted.
- **No load testing.** This is functional only.
