#!/bin/bash
# Phase 5: spawn castle, safe spawn region, /rtp always to SMP, login at the castle, CraftGuard mod blocker.
# Usage: 05-spawn-castle-rtp-mods.sh <spawn_castle.py> <CraftGuard.jar>
set -uo pipefail
CASTLE=${1:?spawn_castle.py}; GUARD=${2:?CraftGuard jar}
S=/opt/minecraft/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }

log "castle (forceloading the spawn chunks while building)"
mcctl execute in minecraft:overworld run forceload add -48 -48 48 48 >/dev/null
sleep 5
python3 "$CASTLE" --run
mcctl execute in minecraft:overworld run forceload remove -48 -48 48 48 >/dev/null

log "spawn region: bigger, invincible, doors usable"
python3 - <<'PY'
import yaml
p="/opt/minecraft/server/plugins/WorldGuard/worlds/world/regions.yml"
d=yaml.safe_load(open(p)); r=d["regions"]["spawn"]
r["min"]={"x":-48,"y":-64,"z":-48}; r["max"]={"x":48,"y":320,"z":48}
r["flags"].update({"invincible":"allow","use":"allow","chest-access":"deny","vehicle-place":"deny",
    "item-frame-rotation":"deny","greeting":"&aSpawn qasriga xush kelibsiz &7(xavfsiz zona)",
    "farewell":"&cSpawndan chiqdingiz &7- PvP yoqilgan!"})
yaml.safe_dump(d,open(p,"w"),sort_keys=False)
PY
mcctl rg load -w world

log "Essentials spawn + /rtp always to the SMP world + welcome message"
python3 - <<'PY'
import yaml
P="/opt/minecraft/server/plugins/Essentials"
loc={"world":"36a4664f-0e71-4fbf-9f62-d1b00e2c6827","world-name":"world","x":0.5,"y":70.0,"z":16.5,"yaw":180.0,"pitch":0.0}
yaml.safe_dump({"spawns":{"default":loc,"newbies":loc}},open(P+"/spawn.yml","w"),sort_keys=False)
t=yaml.safe_load(open(P+"/tpr.yml")); t["default-location"]="world"
t["locations"]["world"]["center"].update({"x":0.0,"y":70.0,"z":0.0})
yaml.safe_dump(t,open(P+"/tpr.yml","w"),sort_keys=False)
open(P+"/motd.txt","w").write(
 "&6&lCraftMine SMP &7- &eXush kelibsiz, {PLAYER}!\n"
 "&7Siz spawn qasridasiz &a(xavfsiz zona)&7.\n"
 "&a/rtp &7- tasodifiy joyga sayohat  &8|  &a/spawn &7- qasrga qaytish\n"
 "&7Sayt: &bhttps://mc.mikuuloves.coffee\n")
PY
for w in world world_nether world_the_end simple; do mcctl lp group default permission unset essentials.tpr world=$w >/dev/null; done
mcctl lp group default permission set essentials.tpr true >/dev/null
mcctl essentials reload

log "AuthMe: log in at the castle, then go back to where you left"
sed -i -E 's/^(\s+teleportUnAuthedToSpawn:) false/\1 true/; s/^(\s+SaveQuitLocation:) false/\1 true/' $P/AuthMe/config.yml
grep -nE "teleportUnAuthedToSpawn|SaveQuitLocation" $P/AuthMe/config.yml
mcctl authme reload

log "CraftGuard (needs a restart)"
install -m 644 -o minecraft -g minecraft "$GUARD" $P/
chown -R minecraft:minecraft /opt/minecraft
mcctl list
mcctl say Server 15 soniyadan keyin qayta ishga tushadi: yangi spawn qasri tayyor!; sleep 15
SINCE=$(date "+%H:%M:%S"); systemctl restart minecraft
for i in $(seq 1 60); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q "Done (" && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|CraftGuard|SEVERE|Exception" | grep -v "Loading server plugin" | cut -c50-220 | head -8
sleep 3; mcctl chunky continue >/dev/null
log "phase5 finished"
