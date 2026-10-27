#!/bin/bash
# Auction listings stay until bought or cancelled (was 2 days); expired/bought items kept 30 days (was 1 week, then deleted).
set -euo pipefail
cd /opt/minecraft/server/plugins/zAuctionHouse
cp -a config.yml config.yml.bak-$(date +%F)
python3 - <<'PY'
p = "config.yml"; s = open(p).read()
a = '    # After this time, unsold items move to the "expired items" section.\n    default-expiration: 172800'
if a in s:
    s = s.replace(a, a.replace("172800", "315360000   # 10 years = stays until bought (or cancelled)"))
for k in ("expire", "purchase"):
    s = s.replace("  %s:\n    default-expiration: 604800   # 1 week" % k, "  %s:\n    default-expiration: 2592000   # 30 days" % k)
open(p, "w").write(s)
PY
mcctl "ah admin reload"
# Existing listings keep the expiry they were created with; extend them too (applies after next restart).
python3 -c "
import sqlite3; c = sqlite3.connect('database.db', timeout=10)
c.execute(\"update zauctionhousev4_items set expired_at = expired_at - 172800000 + 315360000000 where storage_type = 'LISTED' and expired_at < 1800000000000\"); c.commit()"
