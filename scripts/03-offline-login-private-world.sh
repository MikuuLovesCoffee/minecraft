#!/bin/bash
# Phase 3: TLauncher (offline mode) + AuthMe login, SkinsRestorer, scoreboard toggle,
# private world, owner rank for MikuuLovesCoffee.
set -uo pipefail
S=/opt/minecraft/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }
c(){ echo "> $*"; mcctl "$@" | sed 's/^/    /' | head -4; }
OWNER=MikuuLovesCoffee
OWNER_UUID=$(python3 -c "
import hashlib,uuid
h=bytearray(hashlib.md5(b'OfflinePlayer:$OWNER').digest()); h[6]=(h[6]&15)|48; h[8]=(h[8]&63)|128
print(uuid.UUID(bytes=bytes(h)))")
echo "owner offline uuid: $OWNER_UUID"

log "world access locks"
c mv config enforce-access true
for w in world world_nether world_the_end creative arena simple; do
  mcctl lp group default permission set mv.access.$w true >/dev/null
done
for w in creative arena simple; do mcctl lp group default permission set essentials.warps.$w true >/dev/null; done
sed -i 's/^per-warp-permission: false/per-warp-permission: true/' $P/Essentials/config.yml
grep -n "^per-warp-permission" $P/Essentials/config.yml

log "private world"
/usr/local/bin/mcworld create private normal --private

log "owner rank"
mcctl lp user $OWNER_UUID parent set owner >/dev/null
mcctl lp user $OWNER_UUID parent add world-private >/dev/null

log "stop"
systemctl stop minecraft; for i in $(seq 1 30); do systemctl is-active -q minecraft || break; sleep 2; done

log "offline mode for TLauncher players"
sed -i -e 's/^online-mode=.*/online-mode=false/' -e 's/^enforce-secure-profile=.*/enforce-secure-profile=false/' $S/server.properties
grep -E "^(online-mode|enforce-secure-profile)" $S/server.properties

log "AuthMe + SkinsRestorer"
python3 - <<'PY'
import json,urllib.request,urllib.parse,hashlib
H={"User-Agent":"mc-setup"}
ld=urllib.parse.quote('["paper","bukkit","spigot"]')
for s in ["authmereloaded","skinsrestorer"]:
    vs=json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.modrinth.com/v2/project/{s}/version?loaders={ld}",headers=H)))
    v=([x for x in vs if "26.3" in x["game_versions"] and x["version_type"]=="release"] or [x for x in vs if "26.3" in x["game_versions"]] or vs)[0]
    f=next((f for f in v["files"] if f["primary"]), v["files"][0])
    d=urllib.request.urlopen(urllib.request.Request(f["url"],headers=H)).read(); assert hashlib.sha1(d).hexdigest()==f["hashes"]["sha1"]
    open("/opt/minecraft/server/plugins/"+f["filename"],"wb").write(d); print(" ",s,v["version_number"])
PY

log "scoreboard: off by default, /sb toggles"
python3 - <<'PY'
import re
p="/opt/minecraft/server/plugins/DonutScoreboard/config.yml"; t=open(p).read()
t=re.sub(r'(toggle:\n  command: "sb"\n  command-enabled:) false', r'\1 true', t)
t=re.sub(r'(\n  default-on:) true', r'\1 false', t, count=1)
open(p,"w").write(t)
print(re.search(r"toggle:.*?default-on: \w+", t, re.S).group(0))
PY

chown -R minecraft:minecraft /opt/minecraft
log "start"
SINCE=$(date "+%F %T"); systemctl start minecraft
for i in $(seq 1 60); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q 'Done (' && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|ERROR|SEVERE|Could not|Exception" | cut -c50-240 | head -15

log "reserve owner name with a password"
PW=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 12)
c authme register $OWNER $PW
echo "$OWNER password: $PW" > /root/mc-owner-password.txt; chmod 600 /root/mc-owner-password.txt
c chunky continue
c plugins
grep -nE "^\s+(sessions|enabled|timeout|preventOtherCase|kickNonRegistered|allowedNicknameCharacters|ForceSingleSession|maxRegPerIp|maxLoginPerIp|minPasswordLength)" $P/AuthMe/config.yml | head -20
log "phase3 finished"
