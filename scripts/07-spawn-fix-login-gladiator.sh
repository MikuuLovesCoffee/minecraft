#!/bin/bash
# Phase 7: spawn fix (no more fountain/water), admins don't bypass spawn protection by default,
# castle rebuild, slower login with a captcha before /register, gladiator arena (cells, gates, scoreboard).
# Usage: 07-spawn-fix-login-gladiator.sh <tools dir> <CraftArena jar>
set -uo pipefail
TOOLS=${1:?tools dir}; ARENA_JAR=${2:?CraftArena jar}
S=/opt/minecraft/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }

log "spawn: Multiverse + saved logout spots on the fountain -> castle square"
mcctl mvsetspawn world:0.5,70,16.5,180,0
python3 - <<'PY'
import sqlite3
c = sqlite3.connect("/opt/minecraft/server/plugins/AuthMe/authme.db")
n = c.execute("UPDATE authme SET world='world', x=0.5, y=70, z=16.5, yaw=180, pitch=0 "
              "WHERE (abs(x) < 6 AND abs(z) < 6) OR (x = 0 AND y = 0 AND z = 0)").rowcount
c.commit(); print("  logout spots moved:", n)
PY

log "WorldGuard: admins must /rg bypass to edit protected areas"
sed -i -E 's/^(\s+disable-bypass-by-default:) false/\1 true/; s/^(\s+announce-bypass-status:) false/\1 true/' $P/WorldGuard/config.yml
grep -nE "disable-bypass-by-default|announce-bypass-status" $P/WorldGuard/config.yml
mcctl wg reload >/dev/null

log "AuthMe: 2 minutes to log in / register, captcha before /register, tempban after 10 wrong passwords"
sed -i -E 's/^(\s+loginTimeout:) 30/\1 120/; s/^(\s+registerTimeout:) 30/\1 120/;
           s/^(\s+useCaptcha:) false/\1 true/; s/^(\s+captchaLength:) 5/\1 4/;
           s/^(\s+requireForRegistration:) false/\1 true/; s/^(\s+enableTempban:) false/\1 true/' $P/AuthMe/config.yml
grep -nE "loginTimeout|registerTimeout|useCaptcha|captchaLength|requireForRegistration|enableTempban" $P/AuthMe/config.yml
mcctl authme reload

log "rebuild the spawn castle (restores anything broken)"
mcctl execute in minecraft:overworld run forceload add -48 -48 48 48 >/dev/null; sleep 5
(cd "$TOOLS" && python3 spawn_castle.py --run)
mcctl execute in minecraft:overworld run forceload remove -48 -48 48 48 >/dev/null

log "gladiator arena: rebuild colosseum with cells and gates"
mcctl execute in minecraft:arena run forceload add -48 -48 48 48 >/dev/null; sleep 5
(cd "$TOOLS" && python3 -c "import arenas_build as ab, mcbuild; mcbuild.run(ab.A.cmds)")
mcctl execute in minecraft:arena run forceload remove -48 -48 48 48 >/dev/null
python3 - <<'PY'
import yaml
p = "/opt/minecraft/server/plugins/Essentials/warps/arena.yml"
w = yaml.safe_load(open(p)); w.update({"x": 0.5, "y": -51.0, "z": 36.5, "yaw": 180.0}); yaml.safe_dump(w, open(p, "w"), sort_keys=False)
PY
mcctl essentials reload >/dev/null
rm -f $P/CraftArena/config.yml  # new layout: regenerate from the jar
install -m 644 "$ARENA_JAR" $P/
chown -R minecraft:minecraft /opt/minecraft

log "restart"
mcctl say Server 15 soniyadan keyin qayta ishga tushadi: gladiator arena tayyor!; sleep 15
SINCE=$(date "+%H:%M:%S"); systemctl restart minecraft
for i in $(seq 1 60); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q "Done (" && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|CraftArena|SEVERE|Exception" | grep -v "Loading server plugin" | cut -c50-220 | head -8
log "phase7 finished"
