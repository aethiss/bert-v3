#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <IP> <PORT> <OTP> <ALIAS> <SEARCH_ID> [CYCLE_CODE] [MEMBER_ID]"
  echo "Example: $0 192.168.1.10 4860 123456 client-test 2000000617 242 119293"
  exit 1
fi

IP="$1"
PORT="$2"
OTP="$3"
ALIAS="$4"
SEARCH_ID="$5"
CYCLE_CODE="${6:-}"
MEMBER_ID="${7:-}"
BASE_URL="http://${IP}:${PORT}"

header() {
  printf "\n========== %s ==========\n" "$1"
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required. Install it (e.g. brew install jq)."
    exit 1
  fi
}

HTTP_CODE=""
HTTP_BODY=""

http_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local auth="${4:-}"

  local response
  if [[ -n "$data" && -n "$auth" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${auth}" \
      -d "$data")
  elif [[ -n "$data" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [[ -n "$auth" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer ${auth}")
  else
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "$url")
  fi

  HTTP_CODE=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

require_jq

header "HEALTH"
http_json "GET" "${BASE_URL}/health"
echo "HTTP ${HTTP_CODE}"
echo "$HTTP_BODY" | jq .
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Health check failed"
  exit 1
fi

header "LOGIN"
LOGIN_PAYLOAD=$(jq -nc --arg alias "$ALIAS" --arg otp "$OTP" '{alias:$alias, oneTimePassword:$otp}')
http_json "POST" "${BASE_URL}/auth/login" "$LOGIN_PAYLOAD"
echo "HTTP ${HTTP_CODE}"
echo "$HTTP_BODY" | jq .
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Login failed"
  exit 1
fi
ACCESS_TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken // empty')
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "Missing accessToken in login response"
  exit 1
fi

echo "Token acquired (length: ${#ACCESS_TOKEN})"

header "SEARCH"
http_json "GET" "${BASE_URL}/search?id=${SEARCH_ID}" "" "$ACCESS_TOKEN"
echo "HTTP ${HTTP_CODE}"
echo "$HTTP_BODY" | jq .
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Search failed"
  exit 1
fi

RES_MEMBER_ID=$(echo "$HTTP_BODY" | jq -r '.result.member.id // empty')
RES_CYCLE_CODE=$(echo "$HTTP_BODY" | jq -r '.result.member.cycleCode // empty')

if [[ -z "$MEMBER_ID" ]]; then
  MEMBER_ID="$RES_MEMBER_ID"
fi
if [[ -z "$CYCLE_CODE" ]]; then
  CYCLE_CODE="$RES_CYCLE_CODE"
fi

if [[ -z "$MEMBER_ID" || -z "$CYCLE_CODE" ]]; then
  echo "Cannot derive memberId/cycleCode. Provide them manually as arg6/arg7."
else
  header "DISTRIBUTION"
  DIST_PAYLOAD=$(jq -nc --arg sub "$ALIAS" --argjson cycle "$CYCLE_CODE" --argjson member "$MEMBER_ID" '{subOperator:$sub, cycleCode:$cycle, memberId:$member}')
  http_json "POST" "${BASE_URL}/distribution" "$DIST_PAYLOAD" "$ACCESS_TOKEN"
  echo "HTTP ${HTTP_CODE}"
  echo "$HTTP_BODY" | jq .

  header "DISTRIBUTION DUPLICATE CHECK"
  http_json "POST" "${BASE_URL}/distribution" "$DIST_PAYLOAD" "$ACCESS_TOKEN"
  echo "HTTP ${HTTP_CODE}"
  echo "$HTTP_BODY" | jq .
fi

header "PING"
http_json "GET" "${BASE_URL}/ping" "" "$ACCESS_TOKEN"
echo "HTTP ${HTTP_CODE}"
echo "$HTTP_BODY" | jq .

header "UNAUTHORIZED CHECK"
http_json "GET" "${BASE_URL}/search?id=${SEARCH_ID}"
echo "HTTP ${HTTP_CODE}"
echo "$HTTP_BODY" | jq .

printf "\nDone.\n"
