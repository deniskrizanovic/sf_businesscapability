#!/usr/bin/env bash
#
# e2e-verify.sh — run the Playwright e2e suite in both auth modes and emit a
# heartbeat every 60s so a watching session can see live progress.
#
# Sequence:
#   1. SF_AUTH_MODE=web  full suite   (6.1 regression — needs aliases already CLI-authed)
#   2. sf org logout for both aliases (cold-start: strips CLI refresh tokens)
#   3. SF_AUTH_MODE=jwt  full suite   (6.2 cold-start proof — ensureAuthed re-auths via JWT)
#
# Never prints secrets. Playwright output is teed to per-mode log files; this
# script only echoes the tail line, never env values.
#
# Usage: scripts/e2e-verify.sh [logdir]   (default logdir: /tmp/e2e-verify)

set -uo pipefail
cd "$(dirname "$0")/.."

LOGDIR="${1:-/tmp/e2e-verify}"
mkdir -p "$LOGDIR"
STATUS="$LOGDIR/status.log"
: > "$STATUS"

# Load aliases from .env without exporting secrets into the log.
EDITOR_ALIAS="$(grep -E '^SF_EDITOR_ALIAS=' .env | cut -d= -f2-)"
VIEWER_ALIAS="$(grep -E '^SF_VIEWER_ALIAS=' .env | cut -d= -f2-)"

hb() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$STATUS"; }

# run_phase <mode> <logfile>
# Launches the suite in the background, heartbeats every 60s until it exits,
# returns the suite's exit code.
run_phase() {
  local mode="$1" log="$2"
  hb "PHASE START mode=$mode -> $log"
  SF_AUTH_MODE="$mode" npm run test:e2e >"$log" 2>&1 &
  local pid=$!
  local start elapsed
  start=$(date +%s)
  while kill -0 "$pid" 2>/dev/null; do
    sleep 60
    elapsed=$(( $(date +%s) - start ))
    hb "mode=$mode running ${elapsed}s | tail: $(tail -n 1 "$log" 2>/dev/null | tr -d '\r')"
  done
  wait "$pid"
  local rc=$?
  local summary
  summary="$(grep -E '[0-9]+ (passed|failed|flaky|skipped)' "$log" | tail -n 1 | tr -d '\r')"
  if [ "$rc" -eq 0 ]; then
    hb "PHASE PASS mode=$mode rc=0 | $summary"
  else
    hb "PHASE FAIL mode=$mode rc=$rc | $summary"
    hb "  last 5 lines of $log:"
    tail -n 5 "$log" | sed 's/^/    /' | tee -a "$STATUS"
  fi
  return "$rc"
}

overall=0

run_phase web "$LOGDIR/web.log" || overall=1

hb "COLD-START: sf org logout $EDITOR_ALIAS + $VIEWER_ALIAS"
sf org logout -o "$EDITOR_ALIAS" --no-prompt >>"$STATUS" 2>&1 || hb "  logout $EDITOR_ALIAS returned nonzero (may already be logged out)"
sf org logout -o "$VIEWER_ALIAS" --no-prompt >>"$STATUS" 2>&1 || hb "  logout $VIEWER_ALIAS returned nonzero (may already be logged out)"

run_phase jwt "$LOGDIR/jwt.log" || overall=1

# 6.3 secret hygiene: confirm no private key or frontdoor token leaked into logs.
hb "SECRET SCAN: grep logs for key material / frontdoor sid"
if grep -REl 'BEGIN [A-Z ]*PRIVATE KEY|frontdoor.jsp|sid=' "$LOGDIR"/*.log >/dev/null 2>&1; then
  hb "  WARNING: possible secret pattern found in logs — inspect $LOGDIR"
  overall=1
else
  hb "  clean: no private key / frontdoor sid in logs"
fi

hb "ALL DONE overall_rc=$overall"
exit "$overall"
