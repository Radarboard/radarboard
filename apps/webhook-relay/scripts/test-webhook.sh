#!/usr/bin/env bash
#
# Manual integration test for the webhook relay.
#
# Usage:
#   RELAY_URL=https://webhook-relay.vercel.app \
#   RELAY_POLL_SECRET=your-secret \
#   WEBHOOK_SECRET_GITHUB=your-github-secret \
#   bash scripts/test-webhook.sh
#
set -euo pipefail

: "${RELAY_URL:?RELAY_URL is required}"
: "${RELAY_POLL_SECRET:?RELAY_POLL_SECRET is required}"
: "${WEBHOOK_SECRET_GITHUB:?WEBHOOK_SECRET_GITHUB is required}"

PAYLOAD='{"action":"opened","repository":{"full_name":"owner/test-repo","name":"test-repo"},"sender":{"login":"test-user"},"pull_request":{"number":42,"title":"Test PR from script","html_url":"https://github.com/owner/test-repo/pull/42","merged":false,"user":{"login":"test-user"}}}'

# Compute HMAC-SHA256 signature
SIGNATURE="sha256=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET_GITHUB" | awk '{print $NF}')"

echo "==> Sending signed GitHub webhook to $RELAY_URL/api/webhooks/github"
WEBHOOK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$RELAY_URL/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Delivery: $(uuidgen || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo test-delivery)" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$WEBHOOK_RESPONSE" | tail -1)
BODY=$(echo "$WEBHOOK_RESPONSE" | head -n -1)

echo "    Status: $HTTP_CODE"
echo "    Body:   $BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: Expected 200, got $HTTP_CODE"
  exit 1
fi

echo ""
echo "==> Polling events from $RELAY_URL/api/events?since=0"
sleep 1

POLL_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "$RELAY_URL/api/events?since=0&limit=10" \
  -H "Authorization: Bearer $RELAY_POLL_SECRET")

HTTP_CODE=$(echo "$POLL_RESPONSE" | tail -1)
BODY=$(echo "$POLL_RESPONSE" | head -n -1)

echo "    Status: $HTTP_CODE"
echo "    Body:   $BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: Expected 200, got $HTTP_CODE"
  exit 1
fi

# Check that at least one event was returned
if echo "$BODY" | grep -q '"integration":"github"'; then
  echo ""
  echo "PASS: Webhook received and event appears in poll response."
else
  echo ""
  echo "FAIL: Event not found in poll response."
  exit 1
fi
