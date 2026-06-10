# Plan: Playwright E2E Backfill + Forward Implementation Plan Updates

## Context

Steps 1–3 are deployed to `home-denispoc`. Despite the ADR (0003) committing to Playwright, zero E2E tests exist. The following scenarios have no automated coverage at all:

- Every scenario in `map-object.md` (no markers written)
- 7 `UI only` scenarios in `capability-object.md`
- 3 `UI only` scenarios in `tag-object.md`

In addition, Step 3's implementation plan description omits the deployed colour swatch LWC component.

This plan has two tracks:

1. **Playwright infrastructure + backfill** — set up Playwright and write tests for Steps 1–3
2. **Implementation plan amendments** — wire Playwright into Steps 4–8 so each step's checkbox requires passing tests

---

## Decisions

| Decision            | Choice                                     | Rationale                                                                     |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Auth method         | Env vars (`.env` + dotenv)                 | Stored sessions expire silently; env vars are explicit and rotatable          |
| Test users          | 2 static users created manually in org     | Programmatic user provisioning in Salesforce is slow and fragile              |
| Scope               | All uncovered scenarios in Steps 1–3       | `map-object.md` is 100% uncovered; capability + tag have `UI only` gaps       |
| Forward integration | Playwright inside each step (not trailing) | Checkbox can't be ticked until browser behavior verified, not just deployment |

---

## Track 1: Playwright Infrastructure

### Files to create

**`package.json`** — add `@playwright/test` to devDependencies; add test script:

```json
"test:e2e": "playwright test"
```

**`playwright.config.ts`** (root) — configure:

- `testDir: './tests/e2e'`
- `use.baseURL` from `process.env.SF_BASE_URL`
- Two named projects: `editor` and `viewer`, each with a `storageState` fixture path
- `reporter: 'html'`

**`.env.example`** (committed):

```
SF_BASE_URL=https://your-org.lightning.force.com
SF_EDITOR_USERNAME=bcm-editor-test@example.com
SF_EDITOR_PASSWORD=
SF_VIEWER_USERNAME=bcm-viewer-test@example.com
SF_VIEWER_PASSWORD=
```

**`.env`** (gitignored — add to `.gitignore`)

**`tests/e2e/fixtures/auth.setup.ts`** — global setup that:

1. Logs in as editor via username/password, saves `storageState` to `tests/e2e/.auth/editor.json`
2. Logs in as viewer, saves to `tests/e2e/.auth/viewer.json`

**`tests/e2e/.auth/`** — gitignored (add to `.gitignore`)

### Static test users (manual action — not part of code)

Create in `home-denispoc` org:

- `bcm-editor-test@...` with `bcm_Editor` permission set assigned
- `bcm-viewer-test@...` with `bcm_Viewer` permission set assigned

Document usernames in `.env.example` comments.

---

## Track 1: Backfill Test Files

### `tests/e2e/map.spec.ts`

Covers all 10 scenarios from `docs/specs/map-object.md`:

| Test                                | User   | Action                                 | Assert                               |
| ----------------------------------- | ------ | -------------------------------------- | ------------------------------------ |
| Editor creates Map with description | editor | New record with name + RTF description | Saves; description renders formatted |
| Editor edits Map name               | editor | Edit record, change name               | Updated name saved                   |
| Editor deletes Map                  | editor | Delete record                          | Record removed, returned to list     |
| Viewer reads Map                    | viewer | Navigate to Map record                 | Detail page loads                    |
| Viewer cannot create Map            | viewer | Attempt New record                     | No New button / access denied        |
| Viewer cannot edit Map              | viewer | Attempt edit on record                 | No Edit button / access denied       |
| BCM app in App Launcher             | editor | Open App Launcher                      | "Business Capability Map" listed     |
| Maps tab visible to Editor          | editor | Open BCM app                           | Maps tab present in nav              |
| Maps tab hidden from Viewer         | viewer | Open BCM app                           | Maps tab absent from nav             |
| Maps tab navigates to list          | editor | Click Maps tab                         | Maps list displayed                  |

### `tests/e2e/capability.spec.ts`

Covers 7 `UI only` scenarios from `docs/specs/capability-object.md`:

| Test                                               | Scenario                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Capability form shows all expected fields          | New record shows Map, Parent, Level, Sort Order, External ID, Definition, Strategy Support, Architectural Nuance |
| Parent Capability lookup only returns Capabilities | Lookup filter enforced                                                                                           |
| Definition field renders formatted text            | RTF saves and displays                                                                                           |
| Map record page includes Capabilities section      | Related list present                                                                                             |
| Linked Capability appears in Map related list      | Record visible without refresh                                                                                   |
| Capabilities tab visible to Editor                 | Nav bar check                                                                                                    |
| Capabilities tab visible to Viewer                 | Nav bar check                                                                                                    |

### `tests/e2e/tag.spec.ts`

Covers 3 `UI only` scenarios from `docs/specs/tag-object.md`:

| Test                                     | Scenario                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| Colour swatch renders on Tag record page | `lightning-card` tile with colour visible above detail tabs |
| Tags tab visible to Editor               | Nav bar check                                               |
| Tags tab visible to Viewer               | Nav bar check                                               |

---

## Track 1: Spec File Updates

**`docs/specs/map-object.md`** — add `> Tested by:` markers to all 10 scenarios:

```
> Tested by: e2e/map.spec.ts::"test name"
```

**`docs/specs/capability-object.md`** — replace 7 `UI only` markers:

```
> Tested by: e2e/capability.spec.ts::"test name"
```

**`docs/specs/tag-object.md`** — replace 3 `UI only` markers:

```
> Tested by: e2e/tag.spec.ts::"test name"
```

---

## Track 1: Implementation Plan Corrections (Steps 1–3)

**`docs/plan/implementation-plan.md`** — Step 3:

- Add to "What gets built": `bcm_TagSwatch` LWC (colour tile on Tag record page) + `bcm_TagRecordPage` FlexiPage assigning the component
- Add to "Skills to invoke": `generating-flexipage` for the Tag record page
- Add to manual inspection checklist: `[ ] npx playwright test tests/e2e/tag.spec.ts passes with zero failures`
- Step 3 checkbox stays `[ ]` until Playwright tag tests pass

---

## Track 2: Implementation Plan Forward Amendments (Steps 4–8)

Add to each step in `docs/plan/implementation-plan.md`:

**"What gets built" addition:**

```
- Playwright tests in `tests/e2e/<spec-name>.spec.ts` covering all UI-visible scenarios from the step's spec file
```

**"Manual inspection checklist" addition:**

```
- [ ] `npx playwright test tests/e2e/<spec>.spec.ts` passes with zero failures
```

**Spec-to-test file mapping:**

| Step | Spec file                  | Playwright test file               |
| ---- | -------------------------- | ---------------------------------- |
| 4    | `capability-tag-object.md` | `tests/e2e/capability-tag.spec.ts` |
| 5    | `app-structure.md`         | `tests/e2e/app-structure.spec.ts`  |
| 6    | `import.md`                | `tests/e2e/import.spec.ts`         |
| 7    | `diagram.md`               | `tests/e2e/diagram.spec.ts`        |
| 8    | `drag-drop.md`             | `tests/e2e/drag-drop.spec.ts`      |

Each spec's `UI only` markers are updated to `Tested by: e2e/<file>.spec.ts::"..."` as each step is completed.

---

## Verification

1. `npm install` — `@playwright/test` installs without error
2. Copy `.env.example` → `.env`, fill in org URL + test user credentials
3. `npx playwright test --project=editor` — all editor tests pass
4. `npx playwright test --project=viewer` — all viewer tests pass
5. `tests/e2e/.auth/` contains two session files (gitignored, not committed)
6. All `UI only` markers in Steps 1–3 specs replaced with `e2e/...` references
7. Step 3 in `implementation-plan.md` documents the swatch LWC

---

## Critical Files

| File                               | Change                                              |
| ---------------------------------- | --------------------------------------------------- |
| `package.json`                     | Add `@playwright/test` devDep + `test:e2e` script   |
| `playwright.config.ts`             | New — two projects, env-var base URL                |
| `.env.example`                     | New — committed credential template                 |
| `.gitignore`                       | Add `.env` and `tests/e2e/.auth/`                   |
| `tests/e2e/fixtures/auth.setup.ts` | New — login + session save for both users           |
| `tests/e2e/map.spec.ts`            | New — 10 map scenarios                              |
| `tests/e2e/capability.spec.ts`     | New — 7 capability UI scenarios                     |
| `tests/e2e/tag.spec.ts`            | New — 3 tag UI scenarios                            |
| `docs/specs/map-object.md`         | Add 10 coverage markers                             |
| `docs/specs/capability-object.md`  | Update 7 `UI only` markers                          |
| `docs/specs/tag-object.md`         | Update 3 `UI only` markers                          |
| `docs/plan/implementation-plan.md` | Step 3 swatch docs + Steps 4–8 Playwright additions |
