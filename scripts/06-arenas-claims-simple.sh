#!/bin/bash
# Phase 6: kit arena (CraftArena + colosseum), PvP pit, GriefPrevention land claims, green Simple spawn.
# Usage: 06-arenas-claims-simple.sh <tools dir> <CraftArena jar>
set -uo pipefail
TOOLS=${1:?tools dir}; ARENA_JAR=${2:?CraftArena jar}
S=/opt/minecraft/server; P=$S/plugins
log(){ echo "[$(date +%T)] $*"; }

log "plugins: GriefPrevention + CraftArena"
python3 - <<'PY'
import json,urllib.request,urllib.parse,hashlib
H={"User-Agent":"mc-setup"}
ld=urllib.parse.quote('["paper","bukkit","spigot"]')
vs=json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.modrinth.com/v2/project/griefprevention/version?loaders={ld}",headers=H)))
v=[x for x in vs if "26.3" in x["game_versions"]][0]; f=next((f for f in v["files"] if f["primary"]), v["files"][0])
d=urllib.request.urlopen(urllib.request.Request(f["url"],headers=H)).read(); assert hashlib.sha1(d).hexdigest()==f["hashes"]["sha1"]
open("/opt/minecraft/server/plugins/"+f["filename"],"wb").write(d); print("  GriefPrevention", v["version_number"])
PY
install -m 644 "$ARENA_JAR" $P/
chown -R minecraft:minecraft /opt/minecraft

log "restart"
mcctl say Server 15 soniyadan keyin qayta ishga tushadi: yangi arena va hududlarni himoyalash qo\'shilmoqda!; sleep 15
SINCE=$(date "+%H:%M:%S"); systemctl restart minecraft
for i in $(seq 1 60); do journalctl -u minecraft --since "$SINCE" --no-pager | grep -q "Done (" && break; sleep 5; done
journalctl -u minecraft --since "$SINCE" --no-pager | grep -E "Done \(|CraftArena|GriefPrevention.*(Enabl|rror)|SEVERE|Exception" | grep -v "Loading server plugin" | cut -c50-220 | head -8
sleep 3

log "build colosseum + PvP pit"
mcctl execute in minecraft:arena run forceload add -48 -48 48 48 >/dev/null
mcctl execute in minecraft:overworld run forceload add -26 -126 26 -48 >/dev/null
sleep 5
(cd "$TOOLS" && python3 arenas_build.py --run)
mcctl execute in minecraft:arena run forceload remove -48 -48 48 48 >/dev/null
mcctl execute in minecraft:overworld run forceload remove -26 -126 26 -48 >/dev/null

log "protection: arena world fully, PvP pit region"
python3 - <<'PY'
import os,yaml
W="/opt/minecraft/server/plugins/WorldGuard/worlds"
os.makedirs(W+"/arena",exist_ok=True)
yaml.safe_dump({"regions":{"__global__":{"type":"global","priority":0,"owners":{},"members":{},"flags":{
    "build":"deny","chest-access":"deny","use":"deny","item-drop":"deny","mob-spawning":"deny","tnt":"deny",
    "other-explosion":"deny","fire-spread":"deny","lava-flow":"deny","water-flow":"deny","vehicle-place":"deny",
    "enderpearl":"allow","pvp":"allow"}}}},open(W+"/arena/regions.yml","w"),sort_keys=False)
p=W+"/world/regions.yml"; d=yaml.safe_load(open(p))
d["regions"]["pvppit"]={"type":"cuboid","priority":10,"min":{"x":-26,"y":-64,"z":-126},"max":{"x":26,"y":320,"z":-74},
    "owners":{},"members":{},"flags":{"build":"deny","chest-access":"deny","pvp":"allow","tnt":"deny","fire-spread":"deny",
    "lava-flow":"deny","other-explosion":"deny","creeper-explosion":"deny","mob-spawning":"deny",
    "greeting":"&cPvP maydoni &7- o'lsangiz buyumlaringiz tushadi!","farewell":"&7PvP maydonidan chiqdingiz"}}
yaml.safe_dump(d,open(p,"w"),sort_keys=False)
PY
mcctl rg load -w arena; mcctl rg load -w world

log "warps, commands, permissions, starter kit"
python3 - <<'PY'
import yaml
S="/opt/minecraft/server"; E=S+"/plugins/Essentials"
def warp(name, world, uid, x, y, z, yaw):
    yaml.safe_dump({"world":uid or world,"world-name":world,"x":x,"y":y,"z":z,"yaw":yaw,"pitch":0.0,"name":name},
                   open(f"{E}/warps/{name}.yml","w"),sort_keys=False)
warp("pvp","world","36a4664f-0e71-4fbf-9f62-d1b00e2c6827",0.5,70.0,-88.5,180.0)
warp("arena","arena",None,0.5,-60.0,0.5,0.0)
c=yaml.safe_load(open(S+"/commands.yml")); c["aliases"]["pvp"]=["warp pvp"]
yaml.safe_dump(c,open(S+"/commands.yml","w"),sort_keys=False)
k=yaml.safe_load(open(E+"/kits.yml"))
if "golden_shovel 1" not in k["kits"]["starter"]["items"]:
    k["kits"]["starter"]["items"].append("golden_shovel 1")
yaml.safe_dump(k,open(E+"/kits.yml","w"),sort_keys=False)
PY
mcctl lp group default permission set essentials.warps.pvp true >/dev/null
mcctl lp group default permission unset essentials.kit world=arena >/dev/null
mcctl lp group default permission unset essentials.kits.pvp world=arena >/dev/null
mcctl essentials reload >/dev/null

log "Simple world: spawn on green plains"
python3 - <<'PY'
import re, sys, time, yaml
sys.path.insert(0, "/root/phase6/tools")
import mcbuild
send = mcbuild.rcon()
D = "execute in minecraft:simple run "
send(D + "forceload add -96 -96 -32 -32"); time.sleep(4)
send(D + "summon armor_stand -64 200 -64 {Tags:[\"probe\"],NoGravity:1b,Invisible:1b}")
send(D + "spreadplayers -64 -64 0 1 false @e[type=armor_stand,tag=probe,limit=1]")
out = send(D + "data get entity @e[type=armor_stand,tag=probe,limit=1] Pos")
send(D + "kill @e[type=armor_stand,tag=probe]")
send(D + "forceload remove -96 -96 -32 -32")
nums = re.findall(r"(-?\d+\.\d+)d", out)
print("probe:", out[:120])
if len(nums) == 3:
    x, y, z = (float(n) for n in nums)
    send(D + f"setworldspawn {int(x)} {int(y)} {int(z)}")
    E = "/opt/minecraft/server/plugins/Essentials/warps/simple.yml"
    w = yaml.safe_load(open(E)); w.update({"x": x, "y": y, "z": z}); yaml.safe_dump(w, open(E, "w"), sort_keys=False)
    send("essentials reload")
    print(f"simple spawn -> {x} {y} {z}")
PY
mcctl mv help setspawn | head -3

chown -R minecraft:minecraft /opt/minecraft
mcctl chunky continue >/dev/null
log "phase6 finished"
