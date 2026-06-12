# Playwright Salesforce Flakiness — Audit Checklist

Audit checklist derived from [`Playwright Salesforce Test Flakiness Mitigation.md`](./Playwright%20Salesforce%20Test%20Flakiness%20Mitigation.md). Walk current e2e suite (`tests/e2e/`, `playwright.config.ts`) once, tick each item, file follow-ups for misses.

Format: each box is a check to perform. The sub-bullet (`Why:`) is the failure mode it prevents.

---

## 1. Locators

- [ ] No absolute XPath, auto-generated IDs, or `slds-*` class chains as primary selectors.
    - Why: dynamic IDs (`id="21:1886;a"`) and SLDS class names mutate every release/session → selector rot.
- [ ] Every interactive locator uses `getByRole`, `getByLabel`, `getByPlaceholder`, or `getByTestId` (in that priority order).
    - Why: semantic queries survive layout/CSS shifts because they bind to a11y tree, not DOM structure.
- [ ] Locators that could match multiple elements are scoped under a stable parent (`page.locator('records-record-layout-section').filter({ hasText: ... })`) or filtered by visibility.
    - Why: repeating tables/sections trigger strict-mode violations on loose locators.
- [ ] Salesforce comboboxes/lookups use the click → fill → `waitFor` option → click pattern, not `selectOption`.
    - Why: SF comboboxes are custom components with async option loading; treating them as `<select>` fails or races.
- [ ] If `data-id` / `data-target` is the chosen test-id attribute, `testIdAttribute` is configured in `playwright.config.ts` once.
    - Why: prevents one-off `[data-id="..."]` strings scattered through specs.

## 2. Synchronization & waits

- [ ] No `page.waitForTimeout(...)` in production specs (only allowed in throwaway debug code).
    - Why: hardcoded sleeps mask race conditions and inflate runtime; they don't guarantee state.
- [ ] State-changing actions are paired with `waitForResponse(...)` on the specific UI-API endpoint when behaviour depends on the result.
    - Why: SPA background traffic prevents `networkidle`; targeted response waits sync to the actual mutation.
- [ ] A `awaitSalesforcePageLoad`-style helper waits for `.slds-spinner_container, .loadingBox, .forceIconSpinner` to detach before interacting after navigation.
    - Why: spinners intercept clicks and cause "element is not visible / pointer-events" flakes.
- [ ] Re-render-prone interactions (post-Apex callback edits) re-resolve the locator after the state change rather than reusing a stored handle.
    - Why: LWC re-renders detach the verified node mid-action → "Element is not attached to the DOM".
- [ ] Visual/screenshot assertions pass `animations: 'disabled'` and mask dynamic regions (avatars, timestamps).
    - Why: animation pixels and live data drift cause snapshot diffs unrelated to the change under test.

## 3. Hybrid architecture (JSForce / API setup)

- [ ] Test data preconditions are seeded via API/Apex (JSForce, `sf data`, Apex anonymous), not by clicking through the UI.
    - Why: UI seeding is 10×+ slower and inherits every flake mode of the page being tested.
- [ ] Specs navigate directly to the target record/page (`page.goto('/lightning/r/.../view')`) instead of clicking through navigation menus.
    - Why: each menu step is an independent flake source; direct nav skips them.
- [ ] Each spec's `afterAll` (or fixture teardown) deletes records it created.
    - Why: leftover data from prior runs collides with name-uniqueness, query filters, and assertion counts.
- [ ] Cross-checks of state changes use API reads (`conn.sobject(...).retrieve(...)`) when the UI signal is ambiguous or async.
    - Why: API truth is faster and unaffected by render timing.

## 4. Auth & session reuse

- [ ] `storageState` is captured once in a `setup` project and reused across spec projects (already wired in `playwright.config.ts:23-41`).
    - Why: full UI login per test adds 5–15 s and depends on unstable login screen states.
- [ ] Login uses programmatic auth (frontdoor.jsp via `sf org open --url-only`, JWT bearer, or stored sfdxAuthUrl) — not username/password typed into the UI.
    - Why: UI login trips MFA, identity verification, and rate limits.
- [ ] If MFA is on, TOTP is generated via `otplib` from a secret in env, not entered manually or scraped from email.
    - Why: human-in-the-loop and inbox scraping are non-deterministic and brittle.
- [ ] If app uses IndexedDB for session data, `storageState({ ..., indexedDB: true })` is set (Playwright ≥ 1.51).
    - Why: default `storageState` skips IndexedDB → tests start unauthenticated for IDB-backed flows.
- [ ] If app uses `sessionStorage`, it's serialized in setup and re-injected via `addInitScript` per context.
    - Why: `storageState` ignores `sessionStorage`; missing keys silently break re-auth.
- [ ] `.auth/*.json` storage files and any `authFile.json` / `server.key` are in `.gitignore`.
    - Why: leaked refresh tokens / private keys grant org access.

## 5. Config & CI

- [ ] `playwright.config.ts` sets SF-appropriate timeouts: `timeout: 60_000`, `expect.timeout: 10_000`, `actionTimeout: 15_000`, `navigationTimeout: 30_000`.
    - Why: SF Lightning pages routinely exceed Playwright's 30 s default under CI load → premature failures.
- [ ] Heavy pages (CPQ-style detail layouts, large diagrams) call `test.slow()`.
    - Why: triples the per-test budget for known-slow flows without bloating the global timeout.
- [ ] CI runs Playwright's official Docker image (or `npx playwright install-deps chromium` is invoked) and caches `~/.cache/ms-playwright`.
    - Why: rendering-lib drift between local and CI causes "works on my machine" flakes; uncached installs add minutes per build.
- [ ] `NODE_TLS_REJECT_UNAUTHORIZED=0` / `strict-ssl=false` are scoped to scratch-org local runs, never set in main CI.
    - Why: globally disabling TLS validation hides MITM/cert issues and can mask broken endpoints.
- [ ] `retries` is finite (1–2) and retried failures are logged, not silently passed.
    - Why: unlimited retries hide real regressions; zero retries surface infra blips as test failures.

## 6. Process & culture

- [ ] CI failures with no associated code change open a P2 defect (or equivalent label), not just "rerun".
    - Why: rerun-until-green normalises flake; tracking each one is the only way to drive the rate down.
- [ ] Newly flaky tests are quarantined (skipped/tagged) within one business day, not left blocking the pipeline.
    - Why: an unblocked main pipeline keeps the team's trust in red builds.
- [ ] Before merging a new/modified spec, author runs `npx playwright test <file> --repeat-each=20 --workers=4`.
    - Why: a single green run can pass a race condition that surfaces 1-in-20; stress runs catch it pre-merge.
- [ ] Trace Viewer artefacts from CI failures are uploaded and linked from the defect ticket.
    - Why: post-hoc DOM/network traces are the only practical way to diagnose intermittent failures.
- [ ] When a flake is fixed, the fix references the root cause (selector, wait, shared state) — not just "added retry" or "added sleep".
    - Why: retry/sleep fixes return as flakes elsewhere; root-cause fixes don't.

---

## How to use

1. Walk top-to-bottom against `tests/e2e/` and `playwright.config.ts`. Tick or leave blank.
2. For each unticked box, file an issue (link this checklist + the offending file:line). Tag `flake-debt`.
3. Re-run after each batch of fixes; the goal is all-green, not partial credit.
