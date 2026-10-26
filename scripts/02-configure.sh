#!/bin/bash
# Phase 2: worlds, permissions, plugin configs, firewall port, backups.
# Touches only /opt/minecraft, minecraft*.service/timer, mcctl, and one ufw rule (25565/tcp).
set -uo pipefail
MC=/opt/minecraft; S=$MC/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }
c(){ echo "> $*"; mcctl "$@" | sed 's/^/    /' | head -6; }
sed -i 's/timeout=15/timeout=180/' /usr/local/bin/mcctl

log "worlds"
c mv create creative NORMAL --world-type FLAT --no-structures
c mv create arena NORMAL --world-type FLAT --no-structures
c mv create simple NORMAL
for kv in "creative gamemode creative" "creative pvp true" "creative difficulty peaceful" "creative hunger false" \
          "creative allow-flight true" "creative portal-form none" \
          "arena gamemode adventure" "arena pvp true" "arena difficulty peaceful" "arena hunger false" "arena portal-form none" \
          "simple pvp true" "world pvp true" "world_nether pvp true" "world_the_end pvp true"; do
  set -- $kv; c mv modify "$1" set "$2" "$3"
done
for g in "keep_inventory true arena" "spawn_mobs false creative" "spawn_mobs false arena" "advance_time false creative" \
         "advance_time false arena" "advance_weather false creative" "advance_weather false arena" \
         "mob_griefing false creative" "spawn_phantoms false world"; do
  set -- $g; c mv gamerule set "$1" "$2" "$3"
done

log "separate inventories per world group"
for g in creative arena simple; do
  c mvinv create-group $g; c mvinv add-worlds $g $g; c mvinv add-shares $g all
done

log "ranks + permissions"
c lp creategroup admin
c lp creategroup owner
c lp group admin parent add default
c lp group owner parent add admin
c lp group owner permission set '*' true
c lp group admin permission set essentials.* true
c lp group admin permission set worldguard.* true
c lp group admin permission set prism.* true
c lp group admin permission set inventoryrollbackplus.* true
c lp group admin permission set grim.* true
c lp group admin permission set multiverse.* true
c 'lp group owner meta setprefix 100 "&c&lOWNER &r"'
c 'lp group admin meta setprefix 50 "&6&lADMIN &r"'
c lp group default meta setprefix 1 '&7'
for p in essentials.spawn essentials.home essentials.sethome essentials.delhome essentials.tpa essentials.tpahere \
         essentials.tpaccept essentials.tpdeny essentials.tpacancel essentials.balance essentials.balancetop \
         essentials.pay essentials.worth essentials.msg essentials.reply essentials.ignore essentials.warp \
         essentials.warp.list essentials.help essentials.list essentials.motd essentials.rules essentials.afk \
         essentials.seen essentials.mail essentials.mail.send donutscoreboard.view donutscoreboard.toggle; do
  mcctl lp group default permission set $p true >/dev/null
done
# Things that move items/money between worlds: survival worlds only, so creative/kit items can't leak.
for w in world world_nether world_the_end simple; do
  for p in essentials.sell zauctionhouse.use zauctionhouse.sell zauctionhouse.open; do
    mcctl lp group default permission set $p true world=$w >/dev/null
  done
done
# /rtp only where tpr.yml has a location (no nether-roof drops)
for w in world simple; do mcctl lp group default permission set essentials.tpr true world=$w >/dev/null; done
c lp group default permission set essentials.kit true world=arena
c lp group default permission set essentials.kits.pvp true world=arena
c lp group default permission info

log "scoreboard placeholders"
c papi ecloud refresh; sleep 8
for e in Vault Statistic Player Server; do c papi ecloud download $e; sleep 2; done

log "world data for warps / rtp / regions"
python3 - <<'PY' > /tmp/mc-worlds.json
import json,uuid,yaml
w=yaml.safe_load(open("/opt/minecraft/server/plugins/Multiverse-Core/worlds.yml"))
out={}
for key,v in w.items():
    name=key.split(":")[1] if key!="minecraft:overworld" else "world"
    name={"the_nether":"world_nether","the_end":"world_the_end"}.get(name,name)
    try: u=str(uuid.UUID(bytes=open(f"/opt/minecraft/server/{name}/uid.dat","rb").read()[:16]))
    except Exception: u=None
    sp=v.get("spawn-location") or {}
    out[name]={"uid":u,"x":sp.get("x",0),"y":sp.get("y",64),"z":sp.get("z",0)}
print(json.dumps(out))
PY
cat /tmp/mc-worlds.json; echo

log "firewall: open 25565/tcp"
ufw allow 25565/tcp comment 'Minecraft CraftMine' | tail -1

log "stop server for file edits"
systemctl stop minecraft
for i in $(seq 1 30); do systemctl is-active -q minecraft || break; sleep 2; done

log "config files"
python3 - <<'PY'
import json,re,yaml,os
S="/opt/minecraft/server"; P=S+"/plugins"
W=json.load(open("/tmp/mc-worlds.json"))
def sub(path,pat,rep,flags=re.M):
    t=open(path).read(); n=re.subn(pat,rep,t,flags=flags); open(path,"w").write(n[0]); print(f"  {os.path.basename(path)}: {pat[:40]!r} x{n[1]}")
def loc(name,dx=0.5,dz=0.5):
    w=W[name]; return {"world":w["uid"] or name,"world-name":name,"x":float(w["x"])+dx,"y":float(w["y"]),"z":float(w["z"])+dz,"yaw":0.0,"pitch":0.0}

# Essentials
ec=P+"/Essentials/config.yml"
sub(ec,r"^starting-balance: .*","starting-balance: 500")
sub(ec,r"^teleport-delay: .*","teleport-delay: 3")
sub(ec,r"^teleport-cooldown: .*","teleport-cooldown: 5")
os.makedirs(P+"/Essentials/warps",exist_ok=True)
for name in ["creative","arena","simple"]:
    if name in W:
        d=loc(name); d["name"]=name
        yaml.safe_dump(d,open(f"{P}/Essentials/warps/{name}.yml","w"),sort_keys=False)
t=yaml.safe_load(open(P+"/Essentials/tpr.yml")) or {}
t["locations"]={n:{"name":n,"center":loc(n,0,0),"min-range":300.0,"max-range":2500.0} for n in ["world","simple"] if n in W}
yaml.safe_dump(t,open(P+"/Essentials/tpr.yml","w"),sort_keys=False)
k=yaml.safe_load(open(P+"/Essentials/kits.yml")) or {}
k.setdefault("kits",{})["pvp"]={"delay":20,"items":[
    "diamond_sword 1 sharpness:2","bow 1 power:2","arrow 32","iron_helmet 1 protection:2","iron_chestplate 1 protection:2",
    "iron_leggings 1 protection:2","iron_boots 1 protection:2","shield 1","golden_apple 3","cooked_beef 16"]}
yaml.safe_dump(k,open(P+"/Essentials/kits.yml","w"),sort_keys=False)

# Short commands
cy=S+"/commands.yml"; c=yaml.safe_load(open(cy)) or {}
c["aliases"]={"rtp":["tpr $1-"],"wild":["tpr $1-"],"creative":["warp creative"],"arena":["warp arena"],
              "pvp":["warp arena"],"simple":["warp simple"],"smp":["spawn"],"hub":["spawn"],"lobby":["spawn"]}
yaml.safe_dump(c,open(cy,"w"),sort_keys=False)

# Combat log: logging out in combat = death; no teleport escapes
cl=P+"/CombatLog/config.yml"
sub(cl,r"(logout:\n\s+mode:) none",r"\1 kill")
sub(cl,r"(teleporting:\n\s+disabled-in-combat:) false",r"\1 true")

# Scoreboard
sb=P+"/DonutScoreboard/config.yml"; d=yaml.safe_load(open(sb))
d["scoreboard"]["title"]="&#00C8FC&lCraftMine &f&lSMP"
d["scoreboard"]["lines"]=[" ",
    "&#00FF00&l$ &fMoney &#00FF00%vault_eco_balance_formatted%",
    "&#FF0000\U0001F5E1 &fKills &#FF0000%statistic_player_kills%",
    "&#FC7703☠ &fDeaths &#FC7703%statistic_deaths%",
    "&#FFE600⌚ &fPlaytime &#FFE600%statistic_time_played%",
    "&#00A6FF☺ &fOnline &#00A6FF%server_online%",
    " ",
    "&7/rtp /tpa /ah /sell &8| &7%player_ping%ms"]
yaml.safe_dump(d,open(sb,"w"),sort_keys=False,allow_unicode=True)

# Anti-xray (server side, no client mods can see hidden ores)
sub(S+"/config/paper-world-defaults.yml",r"(anti-xray:\n\s+enabled:) false",r"\1 true")

# WorldGuard: protected spawn in SMP, no explosions/fire in creative
def region_file(world,regions):
    p=f"{P}/WorldGuard/worlds/{world}"; os.makedirs(p,exist_ok=True)
    yaml.safe_dump({"regions":regions},open(p+"/regions.yml","w"),sort_keys=False); print("  regions",world,list(regions))
sx,sz=int(W["world"]["x"]),int(W["world"]["z"])
region_file("world",{"spawn":{"type":"cuboid","priority":10,"min":{"x":sx-40,"y":-64,"z":sz-40},"max":{"x":sx+40,"y":320,"z":sz+40},
    "flags":{"build":"deny","pvp":"deny","mob-spawning":"deny","tnt":"deny","creeper-explosion":"deny","other-explosion":"deny",
             "fire-spread":"deny","lava-fire":"deny","fall-damage":"deny","enderpearl":"deny","greeting":"&aYou entered spawn &7(safe zone)",
             "farewell":"&cYou left spawn &7- PvP is on!"},"owners":{},"members":{}}})
region_file("creative",{"__global__":{"type":"global","priority":0,"flags":{"tnt":"deny","other-explosion":"deny","fire-spread":"deny",
    "lava-fire":"deny","lava-flow":"deny","item-drop":"deny","wither-damage":"deny"},"owners":{},"members":{}}})
PY
# No auction listings from creative/arena (kit + creative items stay out of the economy)
python3 - <<'PY'
import re
p="/opt/minecraft/server/plugins/zAuctionHouse/config.yml"; t=open(p).read()
t=re.sub(r'(\n  (auction|rent|bid):\n    - "world_the_end")', r'\1\n    - "creative"\n    - "arena"', t); open(p,"w").write(t)
PY
chown -R minecraft:minecraft $MC

log "backups (daily 05:00, keep 7)"
cat > $MC/backup.sh <<'EOF'
#!/bin/bash
# Daily world + plugin-data backup; keeps the last 7.
cd /opt/minecraft/server
mcctl save-off >/dev/null; mcctl save-all flush >/dev/null; sleep 10
tar -czf /opt/minecraft/backups/craftmine-$(date +%F).tar.gz world world_nether world_the_end creative arena simple plugins server.properties commands.yml
mcctl save-on >/dev/null
find /opt/minecraft/backups -name 'craftmine-*.tar.gz' -mtime +6 -delete
EOF
chmod +x $MC/backup.sh
cat > /etc/systemd/system/minecraft-backup.service <<'EOF'
[Unit]
Description=Backup Minecraft worlds
[Service]
Type=oneshot
ExecStart=/opt/minecraft/backup.sh
Nice=10
IOSchedulingClass=idle
EOF
cat > /etc/systemd/system/minecraft-backup.timer <<'EOF'
[Unit]
Description=Daily Minecraft backup
[Timer]
OnCalendar=*-*-* 05:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable -q minecraft minecraft-backup.timer

log "start"
SINCE=$(date "+%F %T")
systemctl start minecraft
for i in $(seq 1 120); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q 'Done (' && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|ERROR|SEVERE|Could not|Disabling|not supported|Exception" | cut -c50-260 | head -30
c plugins
c mv list
c warp
log "pre-generate SMP world (radius 3000) + world border"
c execute in minecraft:overworld run worldborder set 10000
c chunky world world
c chunky radius 3000
c chunky start
free -h | head -2
log "phase2 finished"
