#!/bin/bash
# Overnight national scrape — runs Domain scraper across all discovered states
# Then cleans data, maps LGAs/corridors, rebuilds dashboard
# Usage: nohup bash engine/overnight-scrape.sh > /tmp/overnight-scrape.log 2>&1 &

set -e
cd /root/.openclaw/workspace/rlp-project
export NODE_PATH=/root/.openclaw/workspace/rlp-project/node_modules

echo "[$(date '+%H:%M')] === OVERNIGHT SCRAPE STARTING ==="
echo "[$(date '+%H:%M')] DB before: $(node -e "const db=require('./engine/db').getDb();console.log(db.prepare('SELECT COUNT(*) as c FROM lots').get().c);db.close()")"

# Scrape each state sequentially via Domain
for STATE in VIC NSW QLD WA SA TAS NT ACT; do
  LOWER=$(echo $STATE | tr A-Z a-z)
  ACTIVE="engine/data/active-suburbs-${LOWER}.json"
  PROGRESS="engine/data/scrape-progress-${LOWER}.json"
  
  if [ ! -f "$ACTIVE" ]; then
    echo "[$(date '+%H:%M')] $STATE: No active suburbs file, skipping"
    continue
  fi
  
  SUBURB_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ACTIVE','utf8')).length)")
  
  # Check if already completed
  if [ -f "$PROGRESS" ]; then
    LAST=$(node -e "const d=JSON.parse(require('fs').readFileSync('$PROGRESS','utf8'));console.log(d.lastIndex)")
    if [ "$LAST" -ge "$SUBURB_COUNT" ] 2>/dev/null; then
      echo "[$(date '+%H:%M')] $STATE: Already completed ($SUBURB_COUNT suburbs)"
      continue
    fi
    echo "[$(date '+%H:%M')] $STATE: Resuming from $LAST/$SUBURB_COUNT"
  else
    echo "[$(date '+%H:%M')] $STATE: Starting fresh ($SUBURB_COUNT suburbs)"
  fi
  
  node engine/scrape-discovered.js $STATE 2>&1 | tail -5
  echo "[$(date '+%H:%M')] $STATE: Done"
done

echo "[$(date '+%H:%M')] === DOMAIN SCRAPING COMPLETE ==="
echo "[$(date '+%H:%M')] DB after scrape: $(node -e "const db=require('./engine/db').getDb();console.log(db.prepare('SELECT COUNT(*) as c FROM lots').get().c);db.close()")"

# Run data cleaning
echo "[$(date '+%H:%M')] === RUNNING DATA CLEANING ==="
node engine/clean-data.js 2>&1

# Rebuild and deploy dashboard
echo "[$(date '+%H:%M')] === REBUILDING DASHBOARD ==="
node build-v3.js 2>&1

echo "[$(date '+%H:%M')] === DEPLOYING ==="
CLOUDFLARE_API_TOKEN=$(cat /root/.openclaw-luna/credentials/cloudflare-token.txt) \
CLOUDFLARE_ACCOUNT_ID=c06d03e1f7ae57b77cb8413945fea6bc \
npx wrangler pages deploy deploy/ --project-name=rlp-dashboard --branch=main --commit-dirty=true 2>&1 | tail -5

echo "[$(date '+%H:%M')] === OVERNIGHT SCRAPE COMPLETE ==="
echo "[$(date '+%H:%M')] Final DB: $(node -e "const db=require('./engine/db').getDb();console.log(db.prepare('SELECT COUNT(*) as c FROM lots').get().c);db.close()")"
