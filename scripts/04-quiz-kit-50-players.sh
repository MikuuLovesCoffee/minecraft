#!/bin/bash
# Phase 4: CraftQuiz plugin, starter kit for new players, 50 player slots, Grim kicks.
# Usage: 04-quiz-kit-50-players.sh /path/to/CraftQuiz-1.0.0.jar
set -uo pipefail
JAR=${1:?CraftQuiz jar}
S=/opt/minecraft/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }

log "CraftQuiz"
rm -f $P/CraftQuiz-*.jar
install -m 644 "$JAR" $P/

log "starter kit + 50 slots + Grim kicks"
python3 - <<'PY'
import re, yaml
S="/opt/minecraft/server"; P=S+"/plugins"

# Starter kit: wooden tools, a day of food, one golden apple. Given once on first join.
k=yaml.safe_load(open(P+"/Essentials/kits.yml"))
k["kits"]["starter"]={"delay":-1,"items":[
    "wooden_sword 1","wooden_pickaxe 1","wooden_axe 1","wooden_shovel 1",
    "bread 16","cooked_beef 8","apple 4","golden_apple 1","torch 16","oak_log 8"]}
yaml.safe_dump(k,open(P+"/Essentials/kits.yml","w"),sort_keys=False)
c=P+"/Essentials/config.yml"; t=open(c).read()
t=re.sub(r"(\nnewbies:(?:\n.*?)*?\n  kit:) \S+", r"\1 starter", t, count=1); open(c,"w").write(t)
print("newbies kit ->", re.search(r"\nnewbies:(?:\n.*?)*?\n  kit: (\S+)", t).group(1))

p=S+"/server.properties"; t=open(p).read()
t=re.sub(r"^max-players=.*$", "max-players=50", t, flags=re.M); open(p,"w").write(t)

# Grim: keep alerts, add kicks only at high violation levels (no auto-bans).
g=P+"/GrimAC/punishments.yml"; t=open(g).read()
kicks={"Simulation":"300:0", "Reach":"10:0", "Hitboxes":"20:0", "Misc":"60:0", "Autoclicker":"40:0"}
for group, vl in kicks.items():
    if f'"{vl} kick %player%' in t:
        continue
    t=re.sub(rf'(\n  {group}:\n(?:    .*\n)*?    commands:\n)', rf'\1      - "{vl} kick %player% Cheat detected ({group})"\n', t, count=1)
open(g,"w").write(t)
PY
grep -c "kick %player%" $P/GrimAC/punishments.yml
chown -R minecraft:minecraft /opt/minecraft

log "restart"
mcctl say Server 15 soniyadan keyin qayta ishga tushadi: viktorina va starter kit qo\'shilmoqda! ; sleep 15
SINCE=$(date "+%H:%M:%S"); systemctl restart minecraft
for i in $(seq 1 60); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q "Done (" && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|CraftQuiz|SEVERE|Exception" | grep -v "Loading server plugin" | cut -c50-220 | head -10
sleep 3; mcctl chunky continue >/dev/null; mcctl list
log "phase4 finished"
