#!/usr/bin/env bash
set -euo pipefail

# Simulazione 3 client concorrenti per test sezione Operations.
# Default configurati con i parametri forniti.

SERVER_IP="${SERVER_IP:-127.0.0.1}"
SERVER_PORT="${SERVER_PORT:-4860}"
SERVER_OTP="${SERVER_OTP:-test}"
TARGET_DURATION_SECONDS="${TARGET_DURATION_SECONDS:-60}"
PING_INTERVAL_SECONDS="${PING_INTERVAL_SECONDS:-15}"

ALIASES=(
  "M. Ali"
  "Ahmed"
  "Mohamed Yousef"
)

# Formato: memberId|cycleCode
DISTRIBUTIONS=(
  "119429|3367"
  "121304|3367"
  "121306|3367"
  "121307|3367"
  "121308|3367"
  "121310|3367"
  "127480|3367"
  "127513|3367"
  "129559|3367"
  "118684|3301"
  "118685|3301"
  "118686|3301"
  "118697|3301"
  "118698|3301"
  "118699|3301"
  "118700|3301"
  "118701|3301"
  "118702|3301"
  "118703|3301"
  "118704|3301"
  "118705|3301"
  "118706|3301"
  "118707|3301"
  "118708|3301"
  "118709|3301"
  "118710|3301"
  "118711|3301"
  "118712|3301"
  "118713|3301"
  "118714|3301"
)

BASE_URL="http://${SERVER_IP}:${SERVER_PORT}"
RUN_ID="$(date +%Y%m%d_%H%M%S)"
TMP_DIR="/tmp/bert_ops_sim_${RUN_ID}"
mkdir -p "$TMP_DIR"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required (brew install jq)."
  exit 1
fi

header() {
  printf "\n========== %s ==========\n" "$1"
}

HTTP_CODE=""
HTTP_BODY=""

request_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token="${4:-}"

  local response
  if [[ -n "$body" && -n "$token" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${token}" \
      -d "$body")
  elif [[ -n "$body" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$body")
  elif [[ -n "$token" ]]; then
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Authorization: Bearer ${token}")
  else
    response=$(curl -sS -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}")
  fi

  HTTP_CODE=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

ping_loop() {
  local alias="$1"
  local token="$2"
  while true; do
    curl -sS -X GET "${BASE_URL}/ping" -H "Authorization: Bearer ${token}" >/dev/null || true
    sleep "$PING_INTERVAL_SECONDS"
  done
}

client_worker() {
  local alias="$1"
  local input_file="$2"
  local worker_id="$3"

  local summary_file="$TMP_DIR/summary_${worker_id}.txt"
  local error_file="$TMP_DIR/errors_${worker_id}.log"

  : >"$summary_file"
  : >"$error_file"

  local login_payload
  login_payload=$(jq -nc --arg alias "$alias" --arg otp "$SERVER_OTP" '{alias:$alias, oneTimePassword:$otp}')

  request_json "POST" "/auth/login" "$login_payload"
  local login_code="$HTTP_CODE"
  local login_body="$HTTP_BODY"

  if [[ "$login_code" != "200" ]]; then
    echo "[$alias] LOGIN FAILED (HTTP ${login_code}) ${login_body}" | tee -a "$error_file"
    echo "alias=${alias}" >>"$summary_file"
    echo "login_ok=0" >>"$summary_file"
    echo "success=0" >>"$summary_file"
    echo "failed=0" >>"$summary_file"
    return
  fi

  local token
  token=$(echo "$login_body" | jq -r '.accessToken // empty')
  if [[ -z "$token" ]]; then
    echo "[$alias] LOGIN FAILED (missing token) ${login_body}" | tee -a "$error_file"
    echo "alias=${alias}" >>"$summary_file"
    echo "login_ok=0" >>"$summary_file"
    echo "success=0" >>"$summary_file"
    echo "failed=0" >>"$summary_file"
    return
  fi

  local total_tasks
  total_tasks=$(wc -l <"$input_file" | tr -d ' ')
  local base_delay=1
  if [[ "$total_tasks" -gt 0 ]]; then
    base_delay=$(( TARGET_DURATION_SECONDS / total_tasks ))
    if [[ "$base_delay" -lt 1 ]]; then
      base_delay=1
    fi
  fi

  ping_loop "$alias" "$token" &
  local ping_pid=$!

  local success=0
  local failed=0

  while IFS='|' read -r member_id cycle_code; do
    [[ -z "${member_id}" || -z "${cycle_code}" ]] && continue

    local dist_payload
    dist_payload=$(jq -nc \
      --arg sub "$alias" \
      --argjson member "$member_id" \
      --argjson cycle "$cycle_code" \
      '{subOperator:$sub, memberId:$member, cycleCode:$cycle}')

    request_json "POST" "/distribution" "$dist_payload" "$token"
    local dist_code="$HTTP_CODE"
    local dist_body="$HTTP_BODY"

    if [[ "$dist_code" == "201" ]]; then
      success=$((success + 1))
      echo "[$alias] OK memberId=${member_id} cycle=${cycle_code}" >>"$summary_file"
    else
      failed=$((failed + 1))
      echo "[$alias] FAIL HTTP ${dist_code} memberId=${member_id} cycle=${cycle_code} body=${dist_body}" >>"$error_file"
    fi

    # Ritardo "umano" con leggero jitter
    local jitter=$(( RANDOM % 3 ))
    sleep $(( base_delay + jitter ))
  done <"$input_file"

  kill "$ping_pid" >/dev/null 2>&1 || true
  wait "$ping_pid" 2>/dev/null || true

  echo "alias=${alias}" >>"$summary_file"
  echo "login_ok=1" >>"$summary_file"
  echo "success=${success}" >>"$summary_file"
  echo "failed=${failed}" >>"$summary_file"
}

header "HEALTH"
request_json "GET" "/health"
echo "HTTP ${HTTP_CODE}"
echo "${HTTP_BODY}" | jq .
if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "Server health check failed."
  exit 1
fi

header "PREPARE WORKLOAD"
for i in 0 1 2; do
  : >"$TMP_DIR/client_${i}.txt"
done

for i in "${!DISTRIBUTIONS[@]}"; do
  idx=$(( i % 3 ))
  echo "${DISTRIBUTIONS[$i]}" >>"$TMP_DIR/client_${idx}.txt"
done

for i in 0 1 2; do
  count=$(wc -l <"$TMP_DIR/client_${i}.txt" | tr -d ' ')
  echo "${ALIASES[$i]} -> ${count} requests"
done

action_start_epoch=$(date +%s)
header "START 3 CONCURRENT CLIENTS"

pids=()
for i in 0 1 2; do
  client_worker "${ALIASES[$i]}" "$TMP_DIR/client_${i}.txt" "$i" &
  pids+=("$!")
done

for pid in "${pids[@]}"; do
  wait "$pid"
done

action_end_epoch=$(date +%s)
duration=$(( action_end_epoch - action_start_epoch ))

header "SUMMARY"
total_success=0
total_failed=0
for i in 0 1 2; do
  summary_file="$TMP_DIR/summary_${i}.txt"
  error_file="$TMP_DIR/errors_${i}.log"

  alias=$(grep '^alias=' "$summary_file" | tail -n1 | cut -d'=' -f2-)
  login_ok=$(grep '^login_ok=' "$summary_file" | tail -n1 | cut -d'=' -f2-)
  success=$(grep '^success=' "$summary_file" | tail -n1 | cut -d'=' -f2-)
  failed=$(grep '^failed=' "$summary_file" | tail -n1 | cut -d'=' -f2-)

  echo "- ${alias}: login_ok=${login_ok}, success=${success}, failed=${failed}"
  total_success=$(( total_success + success ))
  total_failed=$(( total_failed + failed ))

  if [[ -s "$error_file" ]]; then
    echo "  errors -> $error_file"
  fi
done

echo "Total success: ${total_success}"
echo "Total failed : ${total_failed}"
echo "Duration     : ${duration}s (target ~${TARGET_DURATION_SECONDS}s)"
echo "Logs folder  : $TMP_DIR"

echo
header "TIP"
echo "Apri la sezione Operations durante l'esecuzione per vedere aggiornamenti realtime."
