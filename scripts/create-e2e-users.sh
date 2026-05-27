#!/usr/bin/env bash
# Creates (or re-creates) the two static E2E test users in the target org.
# Credentials are read from .env — never stored in the Apex source file.
#
# Usage:
#   ./scripts/create-e2e-users.sh [org-alias]   (default: home-denispoc)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
APEX_TEMPLATE="$SCRIPT_DIR/create-e2e-users.apex"
APEX_TMP="$(mktemp /tmp/create-e2e-users.XXXXXX.apex)"
trap 'rm -f "$APEX_TMP"' EXIT

ORG="${1:-home-denispoc}"

# Load .env
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE" >&2
  echo "Copy .env.example to .env and fill in your credentials." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# Require the four credential vars
: "${SF_EDITOR_USERNAME:?SF_EDITOR_USERNAME must be set in .env}"
: "${SF_EDITOR_PASSWORD:?SF_EDITOR_PASSWORD must be set in .env}"
: "${SF_VIEWER_USERNAME:?SF_VIEWER_USERNAME must be set in .env}"
: "${SF_VIEWER_PASSWORD:?SF_VIEWER_PASSWORD must be set in .env}"

# Substitute placeholders → temp file (never written to disk permanently)
sed \
  -e "s|\${SF_EDITOR_USERNAME}|$SF_EDITOR_USERNAME|g" \
  -e "s|\${SF_EDITOR_PASSWORD}|$SF_EDITOR_PASSWORD|g" \
  -e "s|\${SF_VIEWER_USERNAME}|$SF_VIEWER_USERNAME|g" \
  -e "s|\${SF_VIEWER_PASSWORD}|$SF_VIEWER_PASSWORD|g" \
  "$APEX_TEMPLATE" > "$APEX_TMP"

echo "Creating E2E test users in org: $ORG"
sf apex run \
  --file "$APEX_TMP" \
  --target-org "$ORG"

echo ""
echo "Done. Users created/updated:"
echo "  Editor : $SF_EDITOR_USERNAME"
echo "  Viewer : $SF_VIEWER_USERNAME"
