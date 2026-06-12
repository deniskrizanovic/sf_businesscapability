# Playwright Flakiness Audit — Report

**Date:** 2026-06-12  
**Branch:** sf_businesscapability-60  
**Scope:** `tests/e2e/`, `playwright.config.ts`

---

## Summary

| Section                     | Pass   | Fail   | N/A   |
| --------------------------- | ------ | ------ | ----- |
| 1 — Locators                | 4      | 1      | 0     |
| 2 — Synchronization & waits | 2      | 3      | 0     |
| 3 — Hybrid architecture     | 4      | 0      | 0     |
| 4 — Auth & session reuse    | 4      | 2      | 0     |
| 5 — Config & CI             | 2      | 3      | 0     |
| 6 — Process & culture       | 0      | 5      | 0     |
| **Total**                   | **16** | **14** | **0** |

---

## Section 1 — Locators

### ✅ No absolute XPath or dynamic IDs as primary selectors

All specs use semantic queries (`getByRole`, `getByLabel`, `getByPlaceholder`, or scoped `locator(...)`) as primary selectors. No `xpath=` or `id=` patterns found.

### ✅ Interactive locators use semantic queries

`getByRole`, `getByLabel`, `getByPlaceholder` used throughout all spec files. `capability-detail.spec.ts` and `map.spec.ts` pass consistently.

### ✅ Multi-match locators scoped or filtered

`selectMap()` in `helpers.ts:100` uses `.first()` and a strict-mode count guard. SVG node locators scope by `data-node-level`/`data-node-name` attributes. No loose unscoped repeating-element matches found.

### ✅ Combobox pattern is correct

`selectMap()` (`helpers.ts:99–116`) and tag-filter interactions in `diagram.spec.ts:311–315` all use click → wait-for-option → click with `toPass` retry. No `selectOption` calls.

### ❌ `testIdAttribute` not configured; `[data-id="..."]` strings scattered through specs

`playwright.config.ts` has no `testIdAttribute` setting. Raw `[data-id="..."]` attribute selectors appear in:

- `diagram.spec.ts:70,93,111,124` — `lightning-button-icon[data-id="cross-cutting-toggle"]`
- `visual-language.spec.ts:45,58` — `[data-id="cross-cutting-toggle"]`, `[data-id="strategic-support-toggle"]`
- `__visual__/capture.spec.ts:48,55` — same

**Risk:** low individually (stable custom attribute), but inconsistent with the rest of the suite and not discoverable via `getByTestId`.  
**Fix:** add `testIdAttribute: 'data-id'` to `playwright.config.ts`; replace raw `[data-id="..."]` strings with `page.getByTestId(...)`.

---

## Section 2 — Synchronization & waits

### ❌ `waitForTimeout` present in production specs

`visual-language.spec.ts` (lines 47, 60, 80) and `__visual__/capture.spec.ts` (lines 21, 27, 33, 40, 43, 50, 57, 63) contain `page.waitForTimeout(200–500)`.

- `visual-language.spec.ts` is **not** guarded by a skip condition — it runs in the suite.
- `__visual__/capture.spec.ts` is guarded by `process.env.BCM_CAPTURE === '1'` (skip otherwise), so it is lower risk but still a debt item.

**Fix:** replace each `waitForTimeout` with an attribute or DOM-state assertion (e.g. wait for `rect.bcm-strategy-stripe` to be visible, or the toggle's `aria-pressed` to change).

### ✅ State-changing actions use targeted wait signals

`clickFlowNext` (`helpers.ts:209–221`) waits for `flowruntime-lwc-body` detach + re-attach. `openDiagram` waits for `.bcm-canvas` to be visible. No `networkidle` usage found.

### ❌ No `awaitSalesforcePageLoad`-style spinner guard

No helper waits for `.slds-spinner_container`, `.loadingBox`, or `.forceIconSpinner` to detach before interacting post-navigation. `openDiagram` waits for `.bcm-canvas` (adequate for that entry point), but `map.spec.ts`, `import.spec.ts`, and `capability.spec.ts` call `page.goto(...)` or `setupAutoDismiss(page)` without a spinner drain.

**Risk:** SF sandboxes occasionally leave a spinner overlapping the first interactive element, causing "element not visible / pointer-events: none" flakes.  
**Fix:** add a `drainSpinners(page)` helper that waits for all three SF spinner selectors to detach; call it after `page.goto()` at the top of each spec's setup.

### ❌ Re-render locator handles not re-resolved after save

`capability-detail.spec.ts:143–163` (Save persists name change) stores `panel` from `openDetailPanelOnL2()` before the save call and re-uses it after. After the Apex callback, LWC may re-render the panel host — the stored handle is safe here because `.bcm-detail-panel[data-open="true"]` is a component-level selector, not a leaf input, but the `nameInput` handle (`panel.locator('.bcm-detail-input-name input')`) created before save is re-used to fill the reset value at line 161. If a re-render detaches that node between save and the reset fill, this will fail.

**Fix:** re-resolve `nameInput` after the save assertion before the reset fill.

### ✅ Visual/screenshot assertions

`__visual__/capture.spec.ts` captures PNGs with no `toMatchSnapshot` diff assertions — there is no pixel-diff test in CI. No snapshot `animations` or `mask` config is needed until diff-based visual tests are added.

---

## Section 3 — Hybrid architecture

### ✅ Test data seeded via API/Apex

`global-setup.ts` calls `runAllSeeds()` which executes Apex via `sf apex run`. No spec seeds data through the UI.

### ✅ Specs navigate directly to target records

`map.spec.ts:58`, `capability-detail.spec.ts` (via `openDiagram` + direct nav), `import.spec.ts:49` all use `page.goto('/lightning/...')` directly. No multi-click navigation chains.

### ✅ Teardown deletes created records

`global-teardown.ts` deletes CapabilityTag → Tag → Capability → Map in FK order. Specs that create additional records during the test (map.spec.ts CRUD tests: Create, Edit, Delete) clean up via the Delete test itself or leave cleanup to teardown.

**Note:** The CRUD create/edit tests (`E2E Map Create`, `E2E Map Edit`) leave records behind if they pass (teardown uses run-id LIKE pattern — those names contain `RUN_ID`, so they are caught). This is acceptable.

### ✅ State cross-checks use API reads where applicable

Seed verification uses `sf apex run` Apex queries. Tests use DOM assertions for rendered state, which is the correct pattern here (no ambiguous async UI signals that require API cross-check).

---

## Section 4 — Auth & session reuse

### ✅ `storageState` captured once and reused

`playwright.config.ts:29,38` wires `storageState` per project; `auth.setup.ts` writes `.auth/editor.json` and `.auth/viewer.json` in the `setup` project, which both `editor` and `viewer` depend on.

### ✅ Login uses username/password typed into the UI — correct pattern given automation user config

`auth.setup.ts:13–18` navigates to `https://test.salesforce.com`, fills `Username`/`Password` fields, and clicks `Log In to Sandbox`. This is stable and appropriate **if** the automation user has an MFA-exempt profile and trusted IP ranges scoped to CI egress IPs.

**UI login + IP restriction is the Salesforce-recommended pattern.** The IP restriction acts as the network-level second factor — a leaked password is useless outside the allowed range. Do not migrate to frontdoor.jsp (undocumented, no IP binding on the OAuth token, history of silent breakage). If runner IPs are dynamic and cannot be pinned, escalate to JWT Bearer Flow instead.

**Action required:** confirm the automation user's profile has `Multi-Factor Authentication for User Interface Logins = off` and that trusted IP ranges are configured. Without IP restriction, a leaked password grants full access from any network.

### ❌ No TOTP/MFA handling

No `otplib` or TOTP generation found. If MFA is currently off on the sandbox this is fine, but there is no guard. If MFA is ever enabled, login silently hangs.

**Fix:** document MFA status; if enabled, add `otplib` TOTP injection.

### ❌ `indexedDB` not set in `storageState`

`auth.setup.ts:27–28` calls `page.context().storageState({ path: editorAuthFile })` without `indexedDB: true`. Playwright ≥ 1.51 supports this.

**Risk:** if the BCM app stores session tokens in IndexedDB, tests start unauthenticated for those flows.  
**Fix:** confirm whether BCM LWC uses IndexedDB (check `bcm_VisualToken` / `bcm_CapabilityMap` JS for `indexedDB` calls); add `indexedDB: true` if so.

### ✅ `.auth/*.json` files in `.gitignore`

`.gitignore` contains `tests/e2e/.auth/` — auth session files are not committed.

---

## Section 5 — Config & CI

### ❌ Timeouts below recommended SF values

Current `playwright.config.ts` has no explicit `timeout`, `expect.timeout`, `actionTimeout`, or `navigationTimeout`. Playwright defaults apply:

| Setting              | Default             | Recommended for SF |
| -------------------- | ------------------- | ------------------ |
| `timeout` (per test) | 30 000 ms           | 60 000 ms          |
| `expect.timeout`     | 5 000 ms            | 10 000 ms          |
| `actionTimeout`      | 0 (browser default) | 15 000 ms          |
| `navigationTimeout`  | 0 (browser default) | 30 000 ms          |

`import.spec.ts:6` overrides to `60_000` for that describe block; `openImportPanel` hardcodes `waitFor(..., timeout: 40000)`. Other specs rely on default 30 s test timeout, which is tight for SF sandbox under CI load.  
**Fix:** add `timeout: 60_000`, `expect: { timeout: 10_000 }`, `use: { actionTimeout: 15_000, navigationTimeout: 30_000 }` to `playwright.config.ts`.

### ❌ No `test.slow()` on heavy pages

Drag-drop, diagram render with full seed, and detail-panel edit-save are known-slow flows. None call `test.slow()`. `import.spec.ts` manually bumps `test.describe.configure({ timeout: 60_000 })` instead, which is redundant once global timeout is raised.  
**Fix:** after raising global timeout, audit each describe block for flows that need `test.slow()` (3× budget) rather than a flat override.

### ✅ `retries: 1` set

`playwright.config.ts:11` sets `retries: 1`. Trace captured on first retry via `trace: 'on-first-retry'`.

### ❌ No CI config found

No `.github/` directory. Cannot audit Docker image, playwright-deps caching, `NODE_TLS_REJECT_UNAUTHORIZED`, or trace artifact upload. All CI items are unverifiable.  
**Recommendation:** when CI is wired, ensure official Playwright Docker image or `npx playwright install-deps chromium` + cache `~/.cache/ms-playwright`; upload `playwright-report/` and trace zip as build artifacts; never set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the main pipeline.

---

## Section 6 — Process & culture

All five items are process/culture practices that cannot be verified from code alone. Treating them as unverified rather than pass/fail:

| Item                                                | Status                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| CI failures with no code change → P2 defect         | No CI / no issue tracker convention found in repo                       |
| Flaky tests quarantined within 1 business day       | No quarantine tag/label convention in specs                             |
| Pre-merge `--repeat-each=20 --workers=4` stress run | Not documented (no CONTRIBUTING.md)                                     |
| Trace Viewer artifacts uploaded and linked          | No CI, cannot verify                                                    |
| Flake fixes reference root cause                    | Commit messages in scope do reference root cause; good practice present |

**Recommendation:** add a `CONTRIBUTING.md` or update `CLAUDE.md` with the stress-run gate; add a `@flake-debt` tag convention for quarantine.

---

## Prioritised Fix List

| Priority | Item                                                                                                       | File(s)                                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~P1~~   | ~~Raise global timeouts to SF-appropriate values~~ ✅ done 2026-06-12                                      | `playwright.config.ts`                                                                                                                                                                                                               |
| ~~P1~~   | ~~Confirm automation user has MFA-exempt profile + trusted IP ranges on CI egress IPs~~ ✅ done 2026-06-12 | Salesforce org config (Setup → Network Access / Profile Login IP Ranges)                                                                                                                                                             |
| ~~P2~~   | ~~Add `drainSpinners` helper; call after `page.goto()` in all specs~~ ✅ done 2026-06-12                   | `fixtures/helpers.ts` (helper added, integrated into `gotoLightning`); `map.spec.ts`, `import.spec.ts`, `capability.spec.ts` migrated to `gotoLightning`                                                                             |
| ~~P2~~   | ~~Re-resolve `nameInput` after save in capability-detail save test~~ ✅ not applicable 2026-06-12          | `capability-detail.spec.ts:161` already uses `panel.locator(...)` inline — Playwright `Locator` is lazy (re-resolves on each action); no stale handle possible                                                                       |
| ~~P2~~   | ~~Replace `waitForTimeout` in `visual-language.spec.ts` with DOM assertions~~ ✅ done 2026-06-12           | `tests/e2e/visual-language.spec.ts` — removed 3 `waitForTimeout` calls; lines 47/60 drop timeout (preceding `toBeVisible()` already retries); line 80 replaced `getAttribute` + `expect` with `toHaveAttribute` (retrying assertion) |
| ~~P3~~   | ~~Add `testIdAttribute: 'data-id'`; replace raw `[data-id=...]` strings~~ ✅ done 2026-06-12               | `playwright.config.ts`, `diagram.spec.ts`, `visual-language.spec.ts`, `__visual__/capture.spec.ts`                                                                                                                                   |
| P3       | Add `indexedDB: true` to storageState calls (confirm need first)                                           | `tests/e2e/fixtures/auth.setup.ts`                                                                                                                                                                                                   |
| P3       | Add `test.slow()` to known-slow describe blocks                                                            | `drag-drop.spec.ts`, `capability-detail.spec.ts`                                                                                                                                                                                     |
| P3       | Replace `waitForTimeout` in `__visual__/capture.spec.ts` (lower risk, skip-guarded)                        | `tests/e2e/__visual__/capture.spec.ts`                                                                                                                                                                                               |
| P4       | Document MFA status; add TOTP handling if MFA ever enabled                                                 | `tests/e2e/fixtures/auth.setup.ts`                                                                                                                                                                                                   |
| P4       | Add quarantine tag convention + pre-merge stress-run gate to CONTRIBUTING                                  | new `CONTRIBUTING.md`                                                                                                                                                                                                                |
