---
name: dod
description: Full Definition of Done check for a completed Business Capability Map implementation step. Runs traceability checks, executes all Apex tests with coverage, runs the full Playwright e2e suite, and runs static analysis. Use when marking a step complete, verifying DoD for a step, or running `/dod step N` or `/dod <spec-filename>`.
---

# Skill: dod

## When to invoke

- `dod step 4` — check step 4 by number
- `dod capability-tag-object.md` — check by spec filename

## Execution

### Step 0 — resolve step inputs

Read `docs/plans/implementation-plan.md`. Find the section for the requested step. Extract:

- **Spec file** — filename in the `**Spec:**` line
- **E2E spec** — path in the `` `npx playwright test tests/e2e/<file>` `` checklist line

### Step 1 — traceability check

Read `.claude/skills/check-traceability/SKILL.md` and follow its instructions for the resolved spec file. Do NOT use the Skill tool — execute the checks directly so this skill retains control and continues to Steps 2–4.

### Step 1.5 — Playwright verification preview

Run the parser against the resolved E2E spec file:

```
python3 .claude/skills/dod/parse_playwright_assertions.py <e2e-spec-path>
```

Emit the output as the **Playwright verification points** section (see OUTPUT_FORMAT.md) before running any tests. This is a preview — the test run in Step 3 is the authoritative result.

### Steps 2, 3, 4 — run in parallel (fully independent)

**Apex** — read `SF_ORG_ALIAS` from `.env`. Discover every `*Test*.cls` under `force-app/`, exclude `TestDataFactory`, then:

```
sf apex run test \
  --class-names <Class1> \
  --class-names <Class2> \
  --code-coverage \
  --result-format json \
  --wait 10 \
  --target-org <SF_ORG_ALIAS> \
| python3 .claude/skills/dod/parse_apex_results.py
```

The script prints `=== Tests ===`, `=== Coverage ===`, and `=== Failures ===` sections.

**Playwright** — run the full e2e suite:

```
npx playwright test tests/e2e/ --reporter=list
```

Parse stdout for the summary line (e.g. `37 passed (1.4m)` or `2 failed`). If failures, collect the failed test names from the list output.

**Static analysis**:

```
sf code-analyzer run -t force-app -s 2 --view table
```

Report pass (exit 0) or fail (exit non-zero). If failed, copy the first non-progress-log line from the violation table.

### Step 5 — FP count prompt

Read the "FPs Unlocked" column for the step in the progress tracker:

- Value is `—` → emit the "no new FPs" note
- Value lists FP identifiers → emit the `/cosmic-rule-coach` prompt

Do not run `/cosmic-rule-coach` — only emit the prompt.

## Output format

See [OUTPUT_FORMAT.md](OUTPUT_FORMAT.md) for the exact table layouts and pass/fail rules.
