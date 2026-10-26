#!/bin/bash
# Phase 1: install Java, Paper, plugins, systemd unit; first boot to generate configs.
# Touches only: /opt/minecraft, user "minecraft", minecraft.service, openjdk-25 package.
set -euo pipefail
MC=/opt/minecraft
VER=26.3
log(){ echo "[$(date +%T)] $*"; }

log "java"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q openjdk-25-jre-headless >/dev/null
java -version 2>&1 | head -1

log "user + dirs"
id minecraft >/dev/null 2>&1 || useradd -r -m -d $MC -s /usr/sbin/nologin minecraft
mkdir -p $MC/server/plugins $MC/backups
cd $MC/server

log "paper $VER"
python3 - <<PY
import json,urllib.request,hashlib
H={"User-Agent":"mc-setup"}
b=json.load(urllib.request.urlopen(urllib.request.Request("https://fill.papermc.io/v3/projects/paper/versions/$VER/builds/latest",headers=H)))
d=b["downloads"]["server:default"]
data=urllib.request.urlopen(urllib.request.Request(d["url"],headers=H)).read()
assert hashlib.sha256(data).hexdigest()==d["checksums"]["sha256"], "checksum mismatch"
open("server.jar","wb").write(data); print("paper build",b["id"])
PY

log "plugins"
python3 - <<'PY'
import json,urllib.request,urllib.parse,hashlib,time
H={"User-Agent":"mc-setup"}
def get(u,raw=False):
  for i in range(5):
    try:
      r=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read()
      return r if raw else json.loads(r)
    except Exception as e: err=e; time.sleep(3)
  raise err
ld=urllib.parse.quote('["paper","bukkit","spigot"]')
mods=["luckperms","vaultunlocked","multiverse-core","multiverse-inventories","worldedit","worldguard",
      "prism","inventoryrollbackplus","grimac","zauctionhouse","zmenu","simple-combatlog","placeholderapi","chunky",
      "donutscoreboard","nbtapi"]
for s in mods:
  vs=get(f"https://api.modrinth.com/v2/project/{s}/version?loaders={ld}")
  ok=[v for v in vs if "26.3" in v["game_versions"] and v["version_type"]=="release"] or \
     [v for v in vs if "26.3" in v["game_versions"]] or vs
  v=ok[0]; f=next((f for f in v["files"] if f["primary"]), v["files"][0])
  data=get(f["url"],raw=True)
  assert hashlib.sha1(data).hexdigest()==f["hashes"]["sha1"]
  open("plugins/"+f["filename"],"wb").write(data)
  print(f"  {s:24} {v['version_number']:22} 26.3={'26.3' in v['game_versions']}")
rel=get("https://api.github.com/repos/EssentialsX/Essentials/releases/latest")
for a in rel["assets"]:
  if any(a["name"].startswith(p+"-") for p in ["EssentialsX","EssentialsXChat","EssentialsXSpawn"]) and a["name"].split("-")[0] in ("EssentialsX","EssentialsXChat","EssentialsXSpawn"):
    open("plugins/"+a["name"],"wb").write(get(a["browser_download_url"],raw=True)); print("  "+a["name"])
PY

log "server files"
echo "eula=true" > eula.txt
RCON_PASS=$(openssl rand -hex 16)
cat > server.properties <<EOF
motd=§b§lCraftMine §7SMP §8| §eSurvival §7• §cPvP §7• §aCreative
server-port=25565
online-mode=false
enforce-secure-profile=false
max-players=20
difficulty=normal
gamemode=survival
pvp=true
spawn-protection=0
view-distance=8
simulation-distance=6
allow-flight=false
white-list=false
enable-command-block=false
level-name=world
enable-rcon=true
rcon.port=25575
rcon.password=$RCON_PASS
broadcast-rcon-to-ops=false
sync-chunk-writes=false
EOF
chmod 600 server.properties

cat > $MC/start.sh <<'EOF'
#!/bin/bash
cd /opt/minecraft/server
exec /usr/bin/java -Xms4G -Xmx4G \
 -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem \
 -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 \
 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 \
 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 \
 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 \
 -XX:SurvivorRatio=32 -jar server.jar --nogui
EOF
chmod +x $MC/start.sh

# Console commands go through RCON on localhost (25575 is not opened in ufw).
cat > /usr/local/bin/mcctl <<'EOF'
#!/usr/bin/env python3
"""mcctl <command...>  - run a Minecraft console command via local RCON."""
import socket,struct,sys,re
props=dict(l.strip().split("=",1) for l in open("/opt/minecraft/server/server.properties") if "=" in l and not l.startswith("#"))
s=socket.create_connection(("127.0.0.1",int(props["rcon.port"])),timeout=15)
def pkt(i,t,b):
    d=struct.pack("<ii",i,t)+b.encode()+b"\0\0"; s.sendall(struct.pack("<i",len(d))+d)
    n=struct.unpack("<i",s.recv(4))[0]; r=b""
    while len(r)<n: r+=s.recv(n-len(r))
    return r[8:-2].decode(errors="replace")
pkt(1,3,props["rcon.password"])
print(re.sub("§.","",pkt(2,2," ".join(sys.argv[1:]))))
EOF
chmod 755 /usr/local/bin/mcctl

cat > /etc/systemd/system/minecraft.service <<'EOF'
[Unit]
Description=Minecraft Paper server (CraftMine SMP)
After=network-online.target
Wants=network-online.target

[Service]
User=minecraft
Group=minecraft
WorkingDirectory=/opt/minecraft/server
ExecStart=/opt/minecraft/start.sh
ExecStop=/usr/local/bin/mcctl stop
TimeoutStopSec=90
KillSignal=SIGTERM
SuccessExitStatus=0 1 143
Restart=on-failure
RestartSec=20
# Shared box: hard caps so Minecraft can never starve the other projects.
MemoryMax=5G
CPUQuota=350%
Nice=2

[Install]
WantedBy=multi-user.target
EOF

chown -R minecraft:minecraft $MC
systemctl daemon-reload

log "first boot"
systemctl start minecraft
for i in $(seq 1 120); do
  journalctl -u minecraft --since "-10min" --no-pager | grep -q 'Done (' && break; sleep 5
done
journalctl -u minecraft --since "-10min" --no-pager | grep -E "Done \(|ERROR|WARN.*(plugin|Could not)|Disabling|not compatible|Unsupported" | cut -c1-300 | tail -40
mcctl plugins || true
log "install finished"
