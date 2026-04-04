#!/bin/bash
# Official unattended production buy-side cycle for this workspace.
# Queue-first, machine-correct, scheduler-safe.
#
# Default behavior:
# - repo-relative paths only (no /root assumptions)
# - weekly discovery refresh on Sundays
# - national queue-runner buy-side ingest in delta mode
# - automatic REA inclusion when APIFY token is present (queue-runner will skip if unavailable)
# - clean -> build -> deploy after the queue drains
# - logs to tmp/logs/
#
# Non-destructive verification:
#   bash engine/production-buy-side-cycle.sh --dry-run

set +e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

export NODE_PATH="$ROOT/node_modules${NODE_PATH:+:$NODE_PATH}"
export PATH="$PATH"

DATE="$(date '+%Y-%m-%d')"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_DIR="$ROOT/tmp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/production-buy-side-${STAMP}.log"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

STATES="${RLP_PROD_STATES:-VIC,NSW,QLD,WA,SA,TAS,NT,ACT}"
SOURCES="${RLP_PROD_SOURCES:-domain,rea}"
MODE="${RLP_PROD_MODE:-delta}"
QUEUE_NAME="${RLP_PROD_QUEUE_NAME:-prod-national-buy-side}"
MAX_JOBS_PER_PASS="${RLP_PROD_MAX_JOBS_PER_PASS:-100}"
MAX_PASSES="${RLP_PROD_MAX_PASSES:-500}"
RUN_DISCOVERY="${RLP_PROD_RUN_DISCOVERY:-auto}"
RUN_CLEAN="${RLP_PROD_RUN_CLEAN:-1}"
RUN_BUILD="${RLP_PROD_RUN_BUILD:-1}"
RUN_DEPLOY="${RLP_PROD_RUN_DEPLOY:-1}"
DEPLOY_PROJECT="${RLP_DEPLOY_PROJECT_NAME:-rlp-dashboard}"
CLOUDFLARE_ACCOUNT_ID_VALUE="${CLOUDFLARE_ACCOUNT_ID:-c06d03e1f7ae57b77cb8413945fea6bc}"
APIFY_TOKEN_FILE="${APIFY_TOKEN_FILE:-}"
CLOUDFLARE_TOKEN_FILE="${CLOUDFLARE_TOKEN_FILE:-}"

resolve_existing_file() {
  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

APIFY_TOKEN_FILE="$(resolve_existing_file \
  "$APIFY_TOKEN_FILE" \
  "$ROOT/credentials/apify-token.txt" \
  "$HOME/.openclaw-luna/credentials/apify-token.txt" \
  "$HOME/.openclaw/credentials/apify-token.txt" \
  "$HOME/credentials/apify-token.txt" \
  || true)"

CLOUDFLARE_TOKEN_FILE="$(resolve_existing_file \
  "$CLOUDFLARE_TOKEN_FILE" \
  "$ROOT/credentials/cloudflare-token.txt" \
  "$HOME/.openclaw-luna/credentials/cloudflare-token.txt" \
  "$HOME/.openclaw/credentials/cloudflare-token.txt" \
  "$HOME/credentials/cloudflare-token.txt" \
  || true)"

log() {
  echo "$@" | tee -a "$LOG_FILE"
}

run_and_log() {
  log "> $*"
  "$@" >> "$LOG_FILE" 2>&1
  return $?
}

should_run_discovery() {
  case "$RUN_DISCOVERY" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    0|false|FALSE|no|NO|off|OFF)
      return 1
      ;;
    auto|AUTO|'')
      [ "$(date +%u)" = "7" ]
      return $?
      ;;
    *)
      [ "$(date +%u)" = "7" ]
      return $?
      ;;
  esac
}

print_plan() {
  cat <<EOF | tee -a "$LOG_FILE"
Production buy-side plan
- root: $ROOT
- log: $LOG_FILE
- states: $STATES
- sources: $SOURCES
- mode: $MODE
- queue: $QUEUE_NAME
- maxJobsPerPass: $MAX_JOBS_PER_PASS
- maxPasses: $MAX_PASSES
- discovery: $RUN_DISCOVERY
- clean: $RUN_CLEAN
- build: $RUN_BUILD
- deploy: $RUN_DEPLOY
- apifyTokenPresent: $( [ -f "$APIFY_TOKEN_FILE" ] && echo yes || echo no )
- cloudflareTokenPresent: $( [ -f "$CLOUDFLARE_TOKEN_FILE" ] && echo yes || echo no )
EOF
}

run_discovery_refresh() {
  if ! should_run_discovery; then
    log "[discovery] skipped"
    return 0
  fi

  log "[discovery] weekly refresh starting"
  OLD_IFS="$IFS"
  IFS=','
  for STATE in $STATES; do
    STATE="$(printf '%s' "$STATE" | xargs)"
    [ -z "$STATE" ] && continue
    log "[discovery] $STATE"
    timeout 1800 node engine/discover-fast.js "$STATE" >> "$LOG_FILE" 2>&1 || log "[discovery] $STATE failed (non-fatal)"
  done
  IFS="$OLD_IFS"
}

extract_queue_summary_json() {
  local summary_file="$1"
  node - "$summary_file" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
for (let i = raw.lastIndexOf('{'); i >= 0; i = raw.lastIndexOf('{', i - 1)) {
  const candidate = raw.slice(i).trim();
  try {
    const parsed = JSON.parse(candidate);
    process.stdout.write(JSON.stringify(parsed));
    process.exit(0);
  } catch {}
}
console.error(`No JSON object found in ${file}`);
process.exit(1);
NODE
}

run_queue_pass() {
  local pass="$1"
  local summary_file="$LOG_DIR/production-buy-side-summary-${STAMP}-pass-${pass}.json"

  log "[queue] pass=$pass queue=$QUEUE_NAME"
  node engine/queue-runner.js \
    --states "$STATES" \
    --sources "$SOURCES" \
    --mode "$MODE" \
    --maxJobs "$MAX_JOBS_PER_PASS" \
    --queueName "$QUEUE_NAME" \
    > "$summary_file" 2>> "$LOG_FILE"
  local status=$?

  if [ $status -ne 0 ]; then
    log "[queue] pass=$pass failed status=$status summary=$summary_file"
    return $status
  fi

  cat "$summary_file" >> "$LOG_FILE"
  printf '\n' >> "$LOG_FILE"

  local summary_json
  summary_json="$(extract_queue_summary_json "$summary_file")" || {
    log "[queue] pass=$pass could not parse JSON summary from $summary_file"
    return 1
  }

  local summary_line
  summary_line="$(node -e "const s=JSON.parse(process.argv[1]); console.log('processedThisRun=' + s.processedThisRun + ' done=' + s.done + ' partial=' + s.partial + ' pending=' + s.pending + ' sources=' + s.sources.join(','));" "$summary_json" 2>/dev/null)"
  log "[queue] $summary_line"

  node -e "const s=JSON.parse(process.argv[1]); process.exit(Number(s.pending || 0) > 0 ? 10 : 0);" "$summary_json"
  local pending_exit=$?
  if [ $pending_exit -eq 10 ]; then
    return 10
  fi
  return 0
}

run_post_steps() {
  if [ "$RUN_CLEAN" = "1" ]; then
    log "[post] clean-data"
    run_and_log node engine/clean-data.js || log "[post] clean-data failed (non-fatal)"
  fi

  if [ "$RUN_BUILD" = "1" ]; then
    log "[post] build-v3"
    run_and_log node build-v3.js || log "[post] build-v3 failed (non-fatal)"
  fi

  if [ "$RUN_DEPLOY" = "1" ]; then
    if [ -f "$CLOUDFLARE_TOKEN_FILE" ]; then
      log "[post] deploy"
      CLOUDFLARE_API_TOKEN="$(cat "$CLOUDFLARE_TOKEN_FILE")" \
      CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID_VALUE" \
      npx wrangler pages deploy deploy/ --project-name="$DEPLOY_PROJECT" --branch=main --commit-dirty=true >> "$LOG_FILE" 2>&1 || log "[post] deploy failed (non-fatal)"
    else
      log "[post] deploy skipped (no Cloudflare token file)"
    fi
  fi
}

log "=========================================="
log "PRODUCTION BUY-SIDE START $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "=========================================="
print_plan

if [ "$DRY_RUN" = "1" ]; then
  log "dry-run only; no commands executed"
  exit 0
fi

log "[preflight] migrate"
run_and_log node engine/migrate.js || log "[preflight] migrate failed (non-fatal)"
run_discovery_refresh

PASS=1
QUEUE_STATUS=0
while [ "$PASS" -le "$MAX_PASSES" ]; do
  run_queue_pass "$PASS"
  QUEUE_STATUS=$?
  if [ $QUEUE_STATUS -eq 0 ]; then
    log "[queue] drained after pass=$PASS"
    break
  fi
  if [ $QUEUE_STATUS -ne 10 ]; then
    log "[queue] stopping after error status=$QUEUE_STATUS"
    break
  fi
  PASS=$((PASS + 1))
done

if [ "$PASS" -gt "$MAX_PASSES" ] && [ $QUEUE_STATUS -eq 10 ]; then
  log "[queue] reached max passes with work still pending"
fi

run_post_steps

log "PRODUCTION BUY-SIDE END $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "log_file=$LOG_FILE"
log "=========================================="

exit 0
