#!/bin/bash
# Legacy daily scrape pipeline — retained for source-specific fallback only.
# Original behavior: Domain buy + sold, REA buy (queue-runner path) + sold (legacy), clean, build, deploy.
# This file preserves the pre-cutover path. The official unattended production buy-side entrypoint is now:
#   bash engine/production-buy-side-cycle.sh

# NEVER exit on error — log and continue
set +e

cd "$(dirname "$0")/.." || exit 1
export NODE_PATH="$(pwd)/node_modules${NODE_PATH:+:$NODE_PATH}"
export PATH="${PATH}"

DATE=$(date '+%Y-%m-%d')
START_TIME=$(date +%s)

echo ""
echo "=========================================="
echo "  DAILY SCRAPE: $DATE"
echo "  Started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

# 0. Run schema migrations
echo "[$(date '+%H:%M')] Running migrations..."
node engine/migrate.js 2>&1 || echo "  Migration warning (non-fatal)"

# 1. Reset scrape progress (so we re-check all suburbs for new/changed lots)
echo "[$(date '+%H:%M')] Resetting scrape progress..."
rm -f engine/data/scrape-progress-*.json
rm -f engine/data/rea-progress-*.json

# 2. Weekly discovery refresh (Sundays only — find new suburbs with land listings)
DOW=$(date +%u) # 7 = Sunday
if [ "$DOW" = "7" ]; then
  echo "[$(date '+%H:%M')] === WEEKLY DISCOVERY REFRESH ==="
  for STATE in VIC NSW QLD WA SA TAS NT ACT; do
    LOWER=$(echo $STATE | tr A-Z a-z)
    rm -f "engine/data/active-suburbs-${LOWER}.json"
    rm -f "engine/data/discover-progress-${LOWER}.json"
    timeout 600 node engine/discover-fast.js $STATE 2>&1 | tail -2 || echo "  $STATE discovery failed (non-fatal)"
    echo "[$(date '+%H:%M')] $STATE discovery done"
  done
fi

# 3. Domain BUY scrape — all states
echo ""
echo "[$(date '+%H:%M')] === DOMAIN BUY SCRAPE ==="
TOTAL_DOMAIN_NEW=0
for STATE in VIC NSW QLD WA SA TAS NT ACT; do
  LOWER=$(echo $STATE | tr A-Z a-z)
  ACTIVE="engine/data/active-suburbs-${LOWER}.json"
  [ ! -f "$ACTIVE" ] && continue
  
  SUBURB_COUNT=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$ACTIVE','utf8')).length)}catch(e){console.log(0)}" 2>/dev/null)
  echo "[$(date '+%H:%M')] $STATE ($SUBURB_COUNT suburbs)..."
  
  # Timeout: max 2 hours per state
  timeout 7200 node engine/scrape-discovered.js $STATE 2>&1 | tee /tmp/scrape-${LOWER}.log | tail -3
  
  # Count new lots from output
  NEW=$(grep -c "^✓" /tmp/scrape-${LOWER}.log 2>/dev/null || echo 0)
  TOTAL_DOMAIN_NEW=$((TOTAL_DOMAIN_NEW + NEW))
  echo "[$(date '+%H:%M')] $STATE done: $NEW suburbs with data"
done
echo "[$(date '+%H:%M')] Domain buy total: $TOTAL_DOMAIN_NEW suburbs with new data"

# 4. Domain SOLD scrape — all states (sold listings for historical data)
echo ""
echo "[$(date '+%H:%M')] === DOMAIN SOLD SCRAPE ==="
for STATE in VIC NSW QLD WA SA; do
  LOWER=$(echo $STATE | tr A-Z a-z)
  ACTIVE="engine/data/active-suburbs-${LOWER}.json"
  [ ! -f "$ACTIVE" ] && continue
  
  echo "[$(date '+%H:%M')] $STATE sold listings..."
  # Sold scrape uses different script — scrape-sold.js
  if [ -f "engine/scrape-sold.js" ]; then
    timeout 3600 node engine/scrape-sold.js $STATE 2>&1 | tail -3 || echo "  $STATE sold scrape failed (non-fatal)"
  fi
  echo "[$(date '+%H:%M')] $STATE sold done"
done

# 5. REA scrape via Apify (if token exists)
APIFY_TOKEN_FILE="/root/.openclaw-luna/credentials/apify-token.txt"
if [ -f "$APIFY_TOKEN_FILE" ]; then
  echo ""
  echo "[$(date '+%H:%M')] === REA SCRAPE (APIFY) ==="

  # REA BUY via shared queue/orchestrator path
  for STATE in VIC NSW QLD WA SA; do
    echo "[$(date '+%H:%M')] REA buy $STATE via queue-runner..."
    timeout 7200 node engine/queue-runner.js \
      --states "$STATE" \
      --sources rea \
      --mode bulk \
      --maxJobs 9999 \
      --queueName "daily-rea-buy-${STATE,,}" 2>&1 | tail -5 || echo "  REA buy $STATE failed (non-fatal)"
  done

  # REA SOLD remains on legacy batch path until sold is migrated into scrape-sources/queue-runner
  for STATE in VIC NSW QLD WA SA; do
    echo "[$(date '+%H:%M')] REA sold $STATE (legacy path)..."
    timeout 3600 node engine/scrape-rea.js $STATE sold 25 --legacy 2>&1 | tail -3 || echo "  REA sold $STATE failed (non-fatal)"
    rm -f "engine/data/rea-progress-${STATE,,}-sold.json"
  done
else
  echo "[$(date '+%H:%M')] Skipping REA (no Apify token)"
fi

# 6. Data cleaning (dedup, outliers, stale detection, corridors)
echo ""
echo "[$(date '+%H:%M')] === DATA CLEANING ==="
node engine/clean-data.js 2>&1 || echo "  Clean failed (non-fatal)"

# 7. Get DB stats after cleaning
echo ""
echo "[$(date '+%H:%M')] === POST-CLEAN STATS ==="
node -e "
const db=require('./engine/db').getDb();
const total=db.prepare('SELECT COUNT(*) as c FROM lots').get().c;
const listing=db.prepare(\"SELECT COUNT(*) as c FROM lots WHERE status='listing'\").get().c;
const sold=db.prepare(\"SELECT COUNT(*) as c FROM lots WHERE status='sold'\").get().c;
const subs=db.prepare('SELECT COUNT(DISTINCT suburb) as c FROM lots').get().c;
const states=db.prepare('SELECT state, COUNT(*) as c FROM lots GROUP BY state ORDER BY c DESC').all();
console.log('Total:', total, '| Listing:', listing, '| Sold:', sold, '| Suburbs:', subs);
states.forEach(s => console.log('  '+s.state+':', s.c));
db.close();
" 2>&1

# 8. Rebuild dashboard
echo ""
echo "[$(date '+%H:%M')] === REBUILDING DASHBOARD ==="
node build-v3.js 2>&1 || echo "  Dashboard build failed (non-fatal)"

# 9. Deploy
echo "[$(date '+%H:%M')] === DEPLOYING ==="
if [ -f "/root/.openclaw-luna/credentials/cloudflare-token.txt" ]; then
  CLOUDFLARE_API_TOKEN=$(cat /root/.openclaw-luna/credentials/cloudflare-token.txt) \
  CLOUDFLARE_ACCOUNT_ID=c06d03e1f7ae57b77cb8413945fea6bc \
  npx wrangler pages deploy deploy/ --project-name=rlp-dashboard --branch=main --commit-dirty=true 2>&1 | tail -5 || echo "  Deploy failed (non-fatal)"
else
  echo "  No Cloudflare token, skipping deploy"
fi

# 10. Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))

echo ""
echo "=========================================="
echo "  DAILY SCRAPE COMPLETE"
echo "  Duration: ${MINUTES}m ${DURATION}s"
echo "  Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

# Always exit 0 — errors are logged above, never fatal
exit 0
