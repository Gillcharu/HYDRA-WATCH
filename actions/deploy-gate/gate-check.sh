#!/usr/bin/env bash
set -eo pipefail

PROVIDER="${1:-AWS}"
REGION="${2:-ap-south-1}"
MIN_SCORE="${3:-40.0}"
MIN_TIER="${4:-V0}"
API_KEY="$5"
API_URL="${6:-http://localhost:8080}"

echo "=================================================="
echo "HydraWatch Deploy Gate checking: $PROVIDER / $REGION"
echo "Minimum score required: $MIN_SCORE"
echo "Minimum verification tier: $MIN_TIER"
echo "API Server: $API_URL"
echo "=================================================="

# Build URL
GATE_URL="${API_URL}/api/gate?provider=${PROVIDER}&region_code=${REGION}&min_score=${MIN_SCORE}&min_tier=${MIN_TIER}"

# Build Headers
HEADER_ARG=()
if [ -n "$API_KEY" ]; then
  HEADER_ARG=(-H "X-API-Key: ${API_KEY}")
  echo "Tenant Authenticated check."
fi

# Call endpoint
RESPONSE=$(curl -s "${HEADER_ARG[@]}" -X POST "${GATE_URL}")

# Parse results
PASSED=$(echo "$RESPONSE" | grep -o '"passed":\s*true' || true)
SCORE=$(echo "$RESPONSE" | grep -o '"score":\s*[0-9.]*' | cut -d: -f2 | xargs || echo "N/A")
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":\s*"[^"]*"' | cut -d: -f2 | xargs || echo "N/A")
RECOMMENDATION=$(echo "$RESPONSE" | grep -o '"recommendation":\s*"[^"]*"' | cut -d: -f2 | xargs || echo "None")

if [ -n "$PASSED" ]; then
  echo "🟢 DEPLOY GATE PASSED"
  echo "Sustainability score: $SCORE/100"
  echo "Verification details: $MESSAGE"
  exit 0
else
  echo "🔴 DEPLOY GATE FAILED"
  echo "Target region score ($SCORE) is below acceptable sustainability threshold!"
  echo "Message: $MESSAGE"
  if [ "$RECOMMENDATION" != "None" ] && [ -n "$RECOMMENDATION" ]; then
    echo "💡 Recommendation: Dispatch workload to alternative region: $RECOMMENDATION"
  fi
  exit 1
fi
