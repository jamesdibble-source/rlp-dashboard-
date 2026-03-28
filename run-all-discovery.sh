#!/bin/bash
cd /root/.openclaw/workspace/rlp-project
export NODE_PATH=./node_modules

for STATE in NSW QLD WA SA TAS NT ACT; do
  LOWER=$(echo $STATE | tr A-Z a-z)
  ACTIVE="engine/data/active-suburbs-${LOWER}.json"
  if [ -f "$ACTIVE" ]; then
    echo "[$(date +%H:%M)] $STATE already done, skipping"
    continue
  fi
  echo "[$(date +%H:%M)] Starting $STATE discovery..."
  node engine/discover-fast.js $STATE
  echo "[$(date +%H:%M)] $STATE finished"
done
echo "[$(date +%H:%M)] ALL STATES COMPLETE"
