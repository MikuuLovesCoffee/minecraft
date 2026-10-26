# CraftMine SMP

A Donut-SMP-style Minecraft server (Paper **26.3**) for a small group of friends, set up to run
safely next to other projects on a shared Ubuntu 24.04 VPS.

**Join:** `mc.mikuuloves.coffee` (Java Edition 26.3 — official launcher or TLauncher)

## What's on the server

| World | How to get there | Rules |
|---|---|---|
| **SMP** (main) | `/spawn`, `/rtp` | Survival, PvP on, protected spawn (40 blocks), economy |
| **Creative** | `/creative` | Flat, creative mode, PvP on, no TNT/fire/lava |
| **Arena** | `/arena` or `/pvp` | Flat PvP arena, adventure mode, `/kit pvp`, keep inventory |
| **Simple** | `/simple` | Plain survival, PvP on |
| **Private** | `/warp private` | Locked — only players added with `mcworld allow`, PvP on |

Every world has **its own inventory**, so creative or kit items can never reach survival.
`/sell`, `/ah` and `/rtp` only work in the survival worlds.

### Player commands
`/register <pass> <pass>` and `/login <pass>` (first join) · `/rtp` · `/tpa <player>` · `/tpaccept` ·
`/sethome` · `/home` (3 homes) · `/spawn` · `/bal` · `/pay` · `/baltop` · `/sell hand` · `/worth` ·
`/ah` (auction house) · `/warp` · `/msg` · `/sb` (scoreboard on/off, off by default) · `/skin <name>`

### Anti-cheat and protection
- **AuthMe**: every player registers a password (the server runs in offline mode for TLauncher players, so names must be protected)
- **GrimAC** anti-cheat, Paper **anti-xray**
- **CombatLog**: logging out during a fight kills you, no teleporting out of combat
- **Prism**: block logging and rollback · **InventoryRollbackPlus**: restore lost items
- **WorldGuard**: protected spawn

## Plugins
Paper 26.3 · EssentialsX (+Chat, Spawn) · LuckPerms · VaultUnlocked · Multiverse-Core / Inventories ·
WorldEdit · WorldGuard · GrimAC · Prism (+NBTAPI) · InventoryRollbackPlus · zAuctionHouse (+zMenu) ·
CombatLog · DonutScoreboard · PlaceholderAPI · Chunky · AuthMe Reloaded · SkinsRestorer

All plugins are downloaded from Modrinth / GitHub with checksum verification.

## Setup on a fresh server

```bash
# as root on Ubuntu 24.04
git clone https://github.com/MikuuLovesCoffee/minecraft.git && cd minecraft/scripts
install -m 755 mcworld /usr/local/bin/mcworld
./01-install.sh                       # Java 25, Paper, plugins, systemd unit, first boot
./02-configure.sh                     # worlds, permissions, protections, backups, firewall port
./03-offline-login-private-world.sh   # TLauncher support + AuthMe, private world, owner rank
```

Edit `OWNER=` at the top of `03-offline-login-private-world.sh` first. The owner's AuthMe
password is generated on the server and saved to `/root/mc-owner-password.txt` (never in git).

### Isolation from other projects on the same box
Everything lives in `/opt/minecraft`, runs as its own `minecraft` user, and is capped by systemd
(`MemoryMax=5G`, `CPUQuota=350%`), so it can't starve other services. The only shared change is
one ufw rule for `25565/tcp`. RCON (25575) stays local.

## Managing it (server shell)

```bash
mcctl list                          # who is online
mcctl say Hello                     # any console command
systemctl restart minecraft         # restart
journalctl -u minecraft -f          # live log

mcworld create <name> [normal|flat|nether|end] [--private] [--creative] [--no-pvp]
mcworld allow <world> <player>      # let someone into a private world
mcworld deny  <world> <player>
mcworld list
```

Backups run daily at 05:00 into `/opt/minecraft/backups` (last 7 kept).

## Ranks
- **OWNER**: every command (`*`). Game mode stays survival — use `/gamemode creative` only when you want it.
- **ADMIN**: moderation tools (Essentials, WorldGuard, Prism, Grim, Multiverse).
- **default**: the player commands above only.

```
mcctl lp user <name> parent set admin
```
