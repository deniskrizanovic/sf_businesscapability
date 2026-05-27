#!/usr/bin/env bash
# Creates (or re-creates) the two static E2E test users in home-denispoc.
# Usage: ./scripts/create-e2e-users.sh
set -euo pipefail

ORG="home-denispoc"

echo "Creating E2E test users in org: $ORG"
sf apex run \
  --file "$(dirname "$0")/create-e2e-users.apex" \
  --target-org "$ORG"

echo ""
echo "Done. Add the following to your .env file:"
echo ""
echo "  SF_EDITOR_USERNAME=bcm-editor-test@home-denispoc.e2e"
echo "  SF_EDITOR_PASSWORD=Bcm@E2Etest1"
echo "  SF_VIEWER_USERNAME=bcm-viewer-test@home-denispoc.e2e"
echo "  SF_VIEWER_PASSWORD=Bcm@E2Etest1"
