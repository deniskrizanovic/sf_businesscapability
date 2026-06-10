# Token Cost Tracker — Claude Code Post-Session Hook

## Context

Capture per-session Claude Code token usage and USD cost into a per-project CSV for offline analysis. Hook is global (lives in `~/.claude/`), CSV is per-project (lives in repo at `tokencost/cost.csv`). Design grilled out via `/grill-with-docs` on 2026-06-04.

This plan documents the design only — the hook itself lives in `~/.claude/`, not in this repo. Plan stored here for reference / future reproduction.

## Design Decisions

| Branch         | Decision                                                                                                                                                     | Why                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Hook events    | `SessionEnd` (finalize) + `SessionStart` (backfill)                                                                                                          | Hybrid: SessionEnd for clean exits; SessionStart backfills sessions killed by Ctrl-C. |
| Cost source    | `ccusage` CLI (npm, installed globally) with `--offline`                                                                                                     | Purpose-built, no rate-table maintenance; offline avoids npm registry hit.            |
| Project root   | `$CLAUDE_PROJECT_DIR` env var                                                                                                                                | Official, handles worktrees, no `.git` walking.                                       |
| CSV location   | `<project_root>/tokencost/cost.csv`, committed                                                                                                               | Per-project, auto-created by hook. User decides per-project gitignore.                |
| Schema         | `session_id,started_at,ended_at,end_reason,total_cost_usd,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,total_tokens,models,git_branch` | Self-contained per-session view. Subagent costs rolled into total.                    |
| Dedup          | Read existing `session_id` set from CSV; overwrite row on resume                                                                                             | Single source of truth; resumed sessions get updated totals.                          |
| Backfill scope | All orphans in `~/.claude/projects/<encoded-cwd>/`, every `SessionStart` source                                                                              | Cheap when caught up; first run heals all gaps. Skip the starting `session_id` only.  |
| Concurrency    | `fcntl.flock` on CSV                                                                                                                                         | Prevents interleaved rows from concurrent sessions.                                   |
| Failure mode   | On ccusage failure: write row with `total_cost_usd=ERROR`, tokens parsed directly from JSONL                                                                 | Preserves session existence + token counts → dedup still works.                       |
| Timestamps     | UTC ISO8601 (raw from JSONL)                                                                                                                                 | Sortable, unambiguous, spreadsheet-convertible.                                       |
| Language       | Python 3 (stdlib only)                                                                                                                                       | Robust CSV escaping, no extra deps.                                                   |
| Script layout  | Single `~/.claude/hooks/cost-tracker.py`, mode arg (`finalize` / `backfill`)                                                                                 | Shared dedup/CSV logic.                                                               |

## Prereqs

- `npm i -g ccusage` (one-time, machine-wide)
- Verify `ccusage --version` resolves on `$PATH`

## Deliverables

### 1. New: `~/.claude/hooks/cost-tracker.py`

Single Python 3 script. Invoked by both hooks with mode arg.

**Inputs**:

- stdin: hook event JSON (Claude Code passes payload here)
- argv[1]: `finalize` | `backfill`
- env: `$CLAUDE_PROJECT_DIR`

**Behavior — `finalize` (SessionEnd)**:

1. Parse stdin JSON → `session_id`, `transcript_path`, `cwd`, `reason`
2. Resolve `project_root = $CLAUDE_PROJECT_DIR`
3. `csv_path = <project_root>/tokencost/cost.csv` — `mkdir -p`, write header if absent
4. Compute row (see [Row computation](#row-computation))
5. Acquire `flock` on CSV → upsert row by `session_id` → release

**Behavior — `backfill` (SessionStart)**:

1. Parse stdin → `session_id` (the starting session — to skip), `cwd`
2. Resolve `project_root = $CLAUDE_PROJECT_DIR`
3. Encoded transcript dir: replace `/` with `-` in `project_root` → `~/.claude/projects/<encoded>/`
4. List `*.jsonl` in that dir
5. Read CSV `session_id` set (or empty if missing)
6. For each JSONL session id not in CSV and != starting session id:
    - Compute row → upsert under flock

### Row computation

1. Run `ccusage session --json --offline --id <session_id>`
2. If exit 0: extract `totalCost`, sum tokens by type from JSON
3. If exit != 0 OR JSON parse fails: walk JSONL directly, sum `usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}` over `type==assistant` events, set `total_cost_usd=ERROR`
4. `started_at` = first event timestamp; `ended_at` = last; both raw UTC ISO8601
5. `models` = sorted unique `message.model` values from assistant events, comma-joined
6. `git_branch` = first non-empty `gitBranch` field from JSONL (or empty)
7. `end_reason` = `reason` from SessionEnd payload, or `backfill` for backfill path

### CSV write semantics

- Header on first creation only
- Upsert by `session_id`: if id exists, rewrite file with row replaced; else append
- All writes under `fcntl.flock(LOCK_EX)`
- CSV escaping via `csv.writer` (handles commas/quotes in `models`, branch names)

### 2. New: `~/.claude/settings.json` hook entries

Add under `hooks` key (merge with existing `notify-stop.sh` config):

```json
{
    "hooks": {
        "SessionStart": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": "python3 ~/.claude/hooks/cost-tracker.py backfill"
                    }
                ]
            }
        ],
        "SessionEnd": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": "python3 ~/.claude/hooks/cost-tracker.py finalize"
                    }
                ]
            }
        ]
    }
}
```

## Edge cases handled

- **Ctrl-C / SIGKILL**: SessionEnd does not fire → row picked up on next SessionStart backfill
- **Concurrent sessions, same project**: flock serializes appends
- **Resumed session (`claude --resume`)**: same session_id, SessionEnd fires again → upsert overwrites with latest totals
- **ccusage missing or fails**: row still written with token counts + `total_cost_usd=ERROR`
- **No `.claude/projects/<encoded>/` dir**: backfill no-ops silently
- **Subagent (sidechain) tokens**: included in session total via ccusage / direct JSONL sum
- **Active concurrent session B during backfill from session A startup**: B's id excluded explicitly → no partial row written

## Edge cases NOT handled

- **Pricing for newest models lagging in ccusage**: `costUSD` may report `0.0` until ccusage updates. Token counts still correct. User responsibility to `npm update -g ccusage` periodically.
- **CSV growth**: no rotation/archival. User can split manually if file gets large.
- **`.gitignore` of `tokencost/`**: hook does not touch `.gitignore`. User decides per-project.

## E2E test plan

Hook lives outside repo → no Apex / Salesforce e2e. Manual verification steps:

- [ ] `npm i -g ccusage && ccusage --version` succeeds
- [ ] Drop `cost-tracker.py` into `~/.claude/hooks/`, add hook entries to `~/.claude/settings.json`
- [ ] Start fresh Claude session in this repo, exchange one turn, `/exit`
- [ ] Verify `tokencost/cost.csv` created with header + 1 row, `end_reason=prompt_input_exit`, non-zero tokens
- [ ] Resume the session, exchange another turn, `/exit` → row updated in place (still 1 row, larger totals)
- [ ] Start session, Ctrl-C kill → CSV unchanged
- [ ] Start new session → backfill picks up the killed one, row appended with `end_reason=backfill`
- [ ] Run two concurrent sessions in same repo, both `/exit` near-simultaneously → 2 distinct rows, no corruption
- [ ] Temporarily rename `ccusage` binary → finalize still writes row with `total_cost_usd=ERROR` and correct token counts

## Function point table

N/A — out-of-repo tooling, no GH issue / FP tracking.
