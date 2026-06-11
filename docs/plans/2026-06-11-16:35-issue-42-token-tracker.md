# Token Tracker — `scripts/generate_token_tracker.py`

## Context

GitHub issue: [#42 — Create a token tracker](https://github.com/deniskrizanovic/sf_businesscapability/issues/42)

Reads `tokencost/cost.csv` (produced by the `~/.claude/hooks/cost-tracker.py` global hook — see `docs/plans/2026-06-04-11:20-cost-tracker-hook.md`), aggregates cost per `git_branch`, resolves `sf_businesscapability-N` branches to GitHub issues, and writes/updates `docs/economics/token-tracker.md`.

Design grilled out via `/grill-with-docs` on 2026-06-11. Decisions below.

## Design decisions

| #   | Branch                    | Decision                                                                                                | Why                                                                         |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Branch → issue match      | Regex `sf_businesscapability-(\d+)$` (anchored to end)                                                  | Catches `feature/sf_businesscapability-22` form too.                        |
| 2   | ERROR row treatment       | Exclude from sum; mixed → `$X.XX (some sessions errored)`; all-errored → `$0.00 (all sessions errored)` | Distinct wording surfaces the all-error case clearly.                       |
| 3   | Summary source            | GitHub issue **title** (not body first sentence)                                                        | Deterministic, no markdown stripping, no truncation.                        |
| 4   | gh fetch strategy         | In-place md update; gh called only for **new** branches                                                 | Existing rows cache title; typical regen does 0 gh calls.                   |
| 5   | Update mode               | In-place modify of `token-tracker.md`; preserve Issue/Summary/Notes per branch                          | Notes preservation = free; idempotent.                                      |
| 6   | Row order                 | Total row at **top**; data rows sorted descending by cost (recomputed every run)                        | User wants expensive branches always visible at top.                        |
| 7   | `main` branch             | Single row, no special casing                                                                           | Total row stays = sum of visible rows. User can annotate Notes.             |
| 8   | Empty `git_branch`        | Synthesize `(no branch)` row                                                                            | Surfaces detached/no-git sessions instead of hiding.                        |
| 9   | Missing CSV               | Exit `1`, message to stderr: `error: tokencost/cost.csv not found at <abs path>`                        | Standard Python convention.                                                 |
| 9b  | Header-only CSV           | Not an error; emit md with just Total row ($0.00)                                                       | Graceful "no sessions yet".                                                 |
| 10  | gh unavailable / unauth   | Soft-fail per branch: emit Issue link, Summary=`(title unavailable)`, stderr warning, exit 0            | New branches retry on next run (treat `(title unavailable)` as cache miss). |
| 11  | Repo URL source           | Parse `git remote get-url origin` (HTTPS + SSH); hardcoded fallback                                     | Survives rename/fork, no extra gh call.                                     |
| 12  | Markdown parse            | Strict pipe-split; header regex; row count mismatch → stderr warning, preserve raw                      | Document "avoid `\|` in Notes" in file preamble.                            |
| 13  | Branches dropped from CSV | Removed from md on regen                                                                                | CSV is source of truth for "branch existed".                                |
| 14  | Test framework            | stdlib `unittest`, `scripts/tests/test_generate_token_tracker.py`                                       | Zero deps, matches "stdlib only" stance.                                    |

## Deliverables

### 1. New: `scripts/generate_token_tracker.py`

Single Python 3 script, stdlib only. Run manually: `python3 scripts/generate_token_tracker.py`.

**High-level flow:**

1. Resolve repo root (via `git rev-parse --show-toplevel` or script's own location).
2. Open `tokencost/cost.csv`. If missing → exit 1, stderr message.
3. Aggregate CSV → per-branch `{cost_sum, n_sessions, n_errors}`. Empty branches grouped under `(no branch)`.
4. Parse existing `docs/economics/token-tracker.md` (if any) → `{branch: {issue, summary, notes}}`.
5. For each branch in CSV:
    - Reuse cached `{issue, summary, notes}` if present (and summary != `(title unavailable)`).
    - Else if branch matches regex → derive issue `#N`, fetch title via `gh issue view N --json title -q .title`. On gh failure → Summary=`(title unavailable)`, stderr warning.
    - Else → Issue=`—`, Summary=`—`.
    - Notes default `—` for new rows.
6. Compute repo URL via `git remote get-url origin` parse → build issue links.
7. Emit md: preamble + table header + Total row (sum across all branches) + data rows sorted descending by cost.

**Cost cell formatting:**

- All-error: `$0.00 (all sessions errored)`
- Mixed: `$X.XX (some sessions errored)`
- Clean: `$X.XX`

**File preamble** (constant, written every run):

```markdown
# Token Tracker

Generated by `scripts/generate_token_tracker.py`. Notes column is human-editable — avoid `|` characters.
```

### 2. New: `docs/economics/token-tracker.md`

Created by first run. Format:

```markdown
# Token Tracker

Generated by `scripts/generate_token_tracker.py`. Notes column is human-editable — avoid `|` characters.

| Branch                   | Issue                                   | Summary             | Total Cost (USD) | Notes |
| ------------------------ | --------------------------------------- | ------------------- | ---------------- | ----- |
| **Total**                | —                                       | —                   | $123.45          | —     |
| main                     | —                                       | —                   | $80.12           | —     |
| sf_businesscapability-32 | [#32](https://github.com/.../issues/32) | Remove context menu | $5.23            | —     |
| ...                      | ...                                     | ...                 | ...              | ...   |
```

### 3. New: `scripts/tests/test_generate_token_tracker.py`

Stdlib `unittest`. Run: `python3 -m unittest scripts.tests.test_generate_token_tracker`.

**Test cases (pure functions, no I/O):**

1. `test_branch_to_issue_number_matches` — `sf_businesscapability-42` → 42.
2. `test_branch_to_issue_number_feature_prefix` — `feature/sf_businesscapability-22` → 22.
3. `test_branch_to_issue_number_no_match` — `main`, `random-branch` → None.
4. `test_aggregate_sum_clean` — multiple non-error rows → correct sum.
5. `test_aggregate_excludes_error` — ERROR rows excluded from sum, flag set.
6. `test_aggregate_all_error` — every row ERROR → sum=0, all-error flag.
7. `test_aggregate_empty_branch` — blank branch col → bucketed under `(no branch)`.
8. `test_format_cost_clean` — `$5.23`.
9. `test_format_cost_mixed_error` — `$5.23 (some sessions errored)`.
10. `test_format_cost_all_error` — `$0.00 (all sessions errored)`.
11. `test_parse_existing_md_roundtrip` — given a known md table string, parsed dict matches expected.
12. `test_parse_existing_md_skips_total_row` — Total row not returned in branch dict.
13. `test_parse_existing_md_pipe_in_notes_warns` — row with extra pipes triggers warning, raw line preserved (verified via captured stderr).
14. `test_emit_md_sorts_desc_total_at_top` — given branch dict, output has Total row directly after separator, then rows in descending cost order.
15. `test_emit_md_em_dash_for_missing` — non-issue branches show `—`.
16. `test_repo_url_parse_https` — `https://github.com/foo/bar.git` → `https://github.com/foo/bar`.
17. `test_repo_url_parse_ssh` — `git@github.com:foo/bar.git` → `https://github.com/foo/bar`.
18. `test_fetch_title_injection` — main entry point accepts a `fetch_title` callable; tests pass a fake to avoid real `gh` calls.

`gh` and `git` calls are isolated behind small functions and dependency-injected into the orchestration function so tests never shell out.

## Acceptance criteria mapping

| Issue AC                                                                    | Covered by                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Produces `docs/economics/token-tracker.md` with one row per unique branch   | Test 14, 15; manual verify                            |
| `sf_businesscapability-N` branches show linked issue + summary              | Test 1, 2, 18; manual verify                          |
| Cost summed, formatted `$X.XX`; ERROR excluded; cell notes errored sessions | Test 4, 5, 6, 8, 9, 10                                |
| Notes column preserved on regeneration                                      | Test 11 (cached values reused on emit); manual verify |
| `main` and other non-issue branches show `—`                                | Test 3, 15                                            |
| Exits non-zero with clear message if CSV missing                            | Manual verify (subprocess test optional)              |

## E2E test plan

N/A — repo tooling, no Salesforce surface, no Playwright/Apex impact.

**Manual verification steps:**

- [ ] `python3 scripts/generate_token_tracker.py` on fresh repo (no existing md) → creates `docs/economics/token-tracker.md` with Total row at top, branches sorted desc by cost, `sf_businesscapability-N` rows have issue links + titles
- [ ] Edit a Notes cell in the generated md → rerun script → Notes value preserved; cost recomputed
- [ ] Manually delete a row from md → rerun → row reappears (CSV is source of truth) with default `—` Notes
- [ ] Add a non-existent branch row to md → rerun → row dropped (not in CSV)
- [ ] Temporarily move `tokencost/cost.csv` aside → rerun → exits 1 with stderr message including absolute path
- [ ] Disconnect network / `gh auth logout` → rerun (with at least one new branch) → Summary=`(title unavailable)`, stderr warning, exit 0; rerun online → Summary fills in
- [ ] Inject a row in CSV with `total_cost_usd=ERROR` for an existing branch → rerun → that branch's cost cell shows `(some sessions errored)`
- [ ] Run unit tests: `python3 -m unittest scripts.tests.test_generate_token_tracker` → all pass
