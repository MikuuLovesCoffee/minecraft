#!/bin/bash
# Phase 8: stable ping/MSPT. Run as root on the server, then restart minecraft.
#  - CPU: hard CPUQuota=350% was throttling the JVM (thousands of stalls -> tick spikes).
#    Replaced by a soft CPUWeight: Minecraft may use all 6 cores when idle, but the other
#    projects win whenever they need CPU.
#  - RAM: heap 4G -> 5G, cgroup cap 6G -> 7G.
#  - JVM: compact object headers (JDK 25), THP, GC log.
#  - Network: BBR congestion control + fq pacing (long, lossy UZ -> FR route).
#  - Paper/Spigot: slower chunk send bursts, 3 min item despawn, cheaper redstone/explosions/mobs.
#  - Gamerule log_admin_commands=false: /gamemode etc. no longer echoed to other admins' chat.
set -euo pipefail
S=/opt/minecraft/server

# --- systemd limits
mkdir -p /etc/systemd/system/minecraft.service.d
cat > /etc/systemd/system/minecraft.service.d/perf.conf <<'EOF'
[Service]
CPUQuota=
CPUWeight=60
IOWeight=60
MemoryMax=7G
EOF
rm -f /etc/systemd/system.control/minecraft.service.d/50-MemoryMax.conf
systemctl daemon-reload

# --- JVM
cat > /opt/minecraft/start.sh <<'EOF'
#!/bin/bash
cd /opt/minecraft/server
exec /usr/bin/java -Xms5G -Xmx5G \
 -XX:+UseCompactObjectHeaders -XX:+UseTransparentHugePages \
 -XX:ReservedCodeCacheSize=400M -XX:-ClassUnloadingWithConcurrentMark -XX:MetaspaceSize=512M \
 -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem \
 -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 \
 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 \
 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 \
 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 \
 -XX:SurvivorRatio=32 -Xlog:gc:file=logs/gc.log:time,uptime:filecount=5,filesize=10M \
 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true \
 -jar server.jar --nogui
EOF
chmod 755 /opt/minecraft/start.sh

# --- network (host-wide, harmless for the web projects)
cat > /etc/sysctl.d/90-bbr.conf <<'EOF'
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing = 1
EOF
modprobe tcp_bbr
echo tcp_bbr > /etc/modules-load.d/bbr.conf
sysctl -p /etc/sysctl.d/90-bbr.conf
tc qdisc replace dev "$(ip route | awk '/default/{print $5; exit}')" root fq

# --- game configs
cp -a $S/config/paper-global.yml $S/config/paper-global.yml.bak-phase8
cp -a $S/config/paper-world-defaults.yml $S/config/paper-world-defaults.yml.bak-phase8
cp -a $S/spigot.yml $S/spigot.yml.bak-phase8
cp -a $S/bukkit.yml $S/bukkit.yml.bak-phase8
python3 - <<'EOF'
import yaml
S = "/opt/minecraft/server/"
def edit(path, fn):
    with open(S + path) as f: d = yaml.safe_load(f)
    fn(d)
    with open(S + path, "w") as f: yaml.safe_dump(d, f, sort_keys=False, allow_unicode=True)

def glob(d):
    c = d["chunk-loading-basic"]
    c["player-max-chunk-send-rate"] = 40.0      # smaller bursts -> no queueing on slow links
    c["player-max-chunk-generate-rate"] = 30.0
edit("config/paper-global.yml", glob)

VALUABLE = ["diamond", "diamond_block", "netherite_ingot", "netherite_scrap", "ancient_debris",
    "netherite_sword", "netherite_pickaxe", "netherite_axe", "netherite_shovel", "netherite_hoe",
    "netherite_helmet", "netherite_chestplate", "netherite_leggings", "netherite_boots",
    "diamond_sword", "diamond_pickaxe", "diamond_axe", "diamond_shovel", "diamond_helmet",
    "diamond_chestplate", "diamond_leggings", "diamond_boots", "elytra", "totem_of_undying",
    "enchanted_book", "enchanted_golden_apple", "nether_star", "beacon", "trident", "mace",
    "heart_of_the_sea", "shulker_box", "emerald_block"]
def world(d):
    ch = d["chunks"]
    ch["entity-per-chunk-save-limit"] = {"arrow": 16, "ender_pearl": 8, "experience_orb": 16,
        "fireball": 8, "small_fireball": 8, "snowball": 8}
    ch["max-auto-save-chunks-per-tick"] = 8
    ch["prevent-moving-into-unloaded-chunks"] = True
    d["collisions"]["max-entity-collisions"] = 2
    sp = d["entities"]["spawning"]
    # base despawn is 3 min (spigot.yml); valuables keep the vanilla 5 min
    sp["alt-item-despawn-rate"] = {"enabled": True, "items": {k: 6000 for k in VALUABLE}}
    sp["despawn-ranges"]["monster"] = {"hard": 56, "soft": 30}
    env = d["environment"]
    env["optimize-explosions"] = True
    env["treasure-maps"]["find-already-discovered"] = {"loot-tables": True, "villager-trade": True}
    d["hopper"]["ignore-occluding-blocks"] = True
    d["misc"]["redstone-implementation"] = "ALTERNATE_CURRENT"
    d["misc"]["update-pathfinding-on-block-update"] = False
    tr = d["tick-rates"]
    tr["grass-spread"] = 4
    tr["mob-spawner"] = 2
edit("config/paper-world-defaults.yml", world)

def spigot(d):
    w = d["world-settings"]["default"]
    w["merge-radius"] = {"item": 3.5, "exp": 4.0}
    w["item-despawn-rate"] = 3600        # dropped items vanish after 3 minutes
    w["arrow-despawn-rate"] = 300
    w["trident-despawn-rate"] = 1200
    w["nerf-spawner-mobs"] = True
    w["mob-spawn-range"] = 6
edit("spigot.yml", spigot)

def bukkit(d):
    d["spawn-limits"]["monsters"] = 50
    d["ticks-per"]["monster-spawns"] = 2
edit("bukkit.yml", bukkit)

# easy teleport aliases (Essentials does the work and keeps its permissions)
def cmds(d):
    a = d.setdefault("aliases", {})
    a.update({
        "tpto":  ["tpa $1"],          # ask to go to a player
        "call":  ["tpahere $1"],      # ask a player to come to you
        "ta":    ["tpaccept"], "yes": ["tpaccept"],
        "td":    ["tpdeny"],   "no":  ["tpdeny"],
        "bring": ["tphere $1"],       # admins: pull a player to you
        "goto":  ["tp $1"],           # admins: jump to a player
    })
edit("commands.yml", cmds)
EOF
chown -R minecraft:minecraft $S/config $S/spigot.yml $S/bukkit.yml $S/commands.yml
echo "phase 8 applied; restart minecraft, then run the gamerule step"
