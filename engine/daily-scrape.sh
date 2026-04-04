#!/bin/bash
# Legacy compatibility shim.
# The official unattended production buy-side entrypoint is now:
#   bash engine/production-buy-side-cycle.sh
#
# This shim preserves existing cron/npm entrypoints while routing them to the
# queue-first production path for this workspace.

set +e

cd "$(dirname "$0")/.." || exit 1

echo "[daily-scrape] legacy shim -> production-buy-side-cycle.sh"
bash engine/production-buy-side-cycle.sh "$@"
exit 0
