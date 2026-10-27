#!/bin/bash
# Auction listings keep the 2-day limit; expired/bought items wait 30 days to be claimed (was 1 week, then deleted).
set -euo pipefail
cd /opt/minecraft/server/plugins/zAuctionHouse
cp -a config.yml config.yml.bak-$(date +%F)
python3 - <<'PY'
p = "config.yml"; s = open(p).read()
for k in ("expire", "purchase"):
    s = s.replace("  %s:\n    default-expiration: 604800   # 1 week" % k, "  %s:\n    default-expiration: 2592000   # 30 days" % k)
open(p, "w").write(s)
PY
mcctl "ah admin reload"
