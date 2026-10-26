# CraftMine SMP

A Donut-SMP-style Minecraft server (Paper **26.3**) for a small group of friends, set up to run
safely next to other projects on a shared Ubuntu 24.04 VPS.

**Join:** `mc.mikuuloves.coffee` (Java Edition 26.3 — official launcher or TLauncher) ·
**Website:** https://mc.mikuuloves.coffee · up to 50 players

If your network blocks port 25565, use `mc.mikuuloves.coffee:2223` (same server).

Older and newer clients can join too (ViaVersion, ViaBackwards and ViaRewind, from 1.7 up to 26.3).

## What's on the server

| World | How to get there | Rules |
|---|---|---|
| **SMP** (main) | `/spawn`, `/rtp` | Survival, PvP on, spawn castle safe zone, economy, land claims. `/rtp` always lands here |
| **Gladiator arena** | `/arena` | Colosseum with stands, two cells with iron gates and a floating scoreboard (see below) |
| **PvP pit** | `/pvp` | Walled pit north of the castle (SMP world): fight with your own items, they drop on death |
| **Creative** | `/creative` | Flat building world, creative mode, claims protect builds, no TNT/fire/lava |
| **Simple** | `/simple` | Separate fresh vanilla survival (own inventory, no economy), spawn on plains |
| **Private** | `/warp private` | Locked — only players added with `mcworld allow`, PvP on |

Every world has **its own inventory**, so creative or kit items can never reach survival.
`/sell`, `/ah` and `/rtp` only work in the survival worlds.

### Player commands
`/register <pass> <pass>` and `/login <pass>` (first join) · `/rtp` · `/tpa <player>` · `/tpaccept` ·
`/sethome` · `/home` (3 homes) · `/spawn` · `/bal` · `/pay` · `/baltop` · `/sell hand` · `/worth` ·
`/ah` (auction house) · `/warp` · `/msg` · `/sb` (scoreboard on/off, off by default) · `/skin <name>`

### Quiz and starter kit
- **CraftQuiz** (own plugin, `plugins/craftquiz`): every 5 minutes an Uzbek question in chat — simple math
  or Minecraft / general knowledge. First correct answer wins $50–200, with a 15% chance of a rare item
  (diamonds, emeralds, golden apples, totem, enchanted golden apple…). Items are only handed out in
  survival worlds. Questions live in `questions.yml`; `/quiz start|skip|reload` for admins.
- **Starter kit** on first join: wooden sword, pickaxe, axe and shovel, food for a day, a golden apple,
  torches and logs.

### Spawn castle
New players, logins and `/spawn` arrive in a stone castle at the world centre (walls, corner and gate
towers, fountain plaza, four cottages, gardens, welcome signs) built by `tools/spawn_castle.py`
(`tools/castle_preview.py` renders an isometric preview). The castle area is a WorldGuard safe zone:
nobody can be hurt or break anything there. `/rtp` always goes to the SMP world, 300–2500 blocks out.
Players log in at the castle (AuthMe) and are then sent back to where they logged out. New players first
type a short `/captcha <code>`, then `/register` (2 minutes each). After 10 wrong passwords the IP is
temporarily banned. Admins don't bypass spawn/arena protection unless they toggle `/rg bypass`.

### Land claims (GriefPrevention)
Players claim land with a golden shovel (in the starter kit) or `/claim`: inside a claim others can walk
around but can't break, place or open anything unless trusted (`/trust`, `/containertrust`, `/accesstrust`).
600 claim blocks to start, +300 per hour played. Admins can make admin claims (`/adminclaims` then the
shovel), give claim blocks (`/adjustbonusclaimblocks <player> <amount>`) and hand claims over
(`/transferclaim <player>`). Claims work in SMP, Nether, Simple, Creative and Private; not in the arena.

### Gladiator arena (CraftArena)
Own plugin (`plugins/craftarena`). `/arena` puts you in the stands (barrier walls: spectators can't jump in
or shoot). `/join` queues you; the first two go to the east/west cells and get 2 minutes of creative to pick
any gear (all weapons allowed; max 1 totem, 2 god apples; no spawn eggs/TNT/lava). Both type `/ready`, the
iron gates open and the round starts. A death is a point for the other fighter; both go back to their cells
with their loadout, the gates close and both `/ready` again. First to 3 wins; the champion stays for the next
challenger. A floating scoreboard above the arena shows both names, the score and each fighter's weapon,
spinning. `/loadout` re-picks gear between rounds, `/leave` gives up. Nothing drops; arena blocks can't be
broken, placed or used (WorldGuard).
Structures: `tools/arenas_build.py` (colosseum + PvP pit), shared RCON helpers in `tools/mcbuild.py`.

### Anti-cheat and protection
- **AuthMe**: every player registers a password (the server runs in offline mode for TLauncher players, so names must be protected)
- **GrimAC** anti-cheat (alerts admins, kicks at high violation levels), Paper **anti-xray**
- **CraftGuard** (own plugin): kicks modded clients that announce themselves (Forge, Fabric, Quilt,
  NeoForge, LabyMod brands; Forge/Fabric/World Downloader/Litematica channels). Owner/admins bypass.
- **CombatLog**: logging out during a fight kills you, no teleporting out of combat
- **Prism**: block logging and rollback · **InventoryRollbackPlus**: restore lost items
- **WorldGuard**: protected spawn

## Plugins
Paper 26.3 · EssentialsX (+Chat, Spawn) · LuckPerms · VaultUnlocked · Multiverse-Core / Inventories ·
WorldEdit · WorldGuard · GrimAC · Prism (+NBTAPI) · InventoryRollbackPlus · zAuctionHouse (+zMenu) ·
CombatLog · DonutScoreboard · PlaceholderAPI · Chunky · AuthMe Reloaded · SkinsRestorer ·
ViaVersion · ViaBackwards · ViaRewind

All plugins are downloaded from Modrinth / GitHub with checksum verification.

## Website (`web/` + `api/`)

Next.js 16 front end, NestJS 11 API, PostgreSQL 16.

- **Home** with a 3D scene of the owners (skinview3d with custom diamond / netherite armor), live player count
- **Guide**: intro, how to join, rules, all commands · **Leaderboard**: money, kills, quiz wins, playtime, blocks mined, deaths
- **Players**: every player with their 3D skin (SkinsRestorer → custom → Mojang → default) and stats
- **Help center**: FAQ and support tickets · **Admin panel**: all tickets, replies, status, server overview
- Uzbek and English

Players log in with their in-game name and the password they `/register`-ed with (AuthMe, read-only).
The API syncs stats from the game files into Postgres once a minute and never gets RCON access.

Security: httpOnly + SameSite=strict session cookie, login rate limits (Nest + nginx), strict DTO
validation, parameterised SQL, helmet + CSP/HSTS headers, read-only sandboxed systemd services.

```bash
# build (Node 20+)
cd api && npm ci && npm run build
cd web && npm ci && npm run build      # output: .next/standalone
# deploy: see deploy/deploy-web.sh (creates user, Postgres db, env file with generated secrets,
# systemd units, nginx site + Let's Encrypt). Secrets live only in /etc/craftmine/api.env.
```

The owners' skins are shown in HD (256×256, same body, 4× finer pixels) on the site, made by
`tools/hd_skins.py`; the 64×64 in-game versions are in `web/public/skins/ingame/`.
Skin credits: MikuuLovesCoffee wears Technoblade's skin; xxbabyxv wears
["devil's advocate" by viari](https://www.minecraftskins.com/skin/24198207/devil-s-advocate/) from The Skindex.

## Setup on a fresh server

```bash
# as root on Ubuntu 24.04
git clone https://github.com/MikuuLovesCoffee/minecraft.git && cd minecraft/scripts
install -m 755 mcworld /usr/local/bin/mcworld
./01-install.sh                       # Java 25, Paper, plugins, systemd unit, first boot
./02-configure.sh                     # worlds, permissions, protections, backups, firewall port
./03-offline-login-private-world.sh   # TLauncher support + AuthMe, private world, owner rank
./04-quiz-kit-50-players.sh CraftQuiz-1.0.0.jar   # quiz plugin, starter kit, 50 slots, Grim kicks
./05-spawn-castle-rtp-mods.sh ../tools/spawn_castle.py CraftGuard-1.0.0.jar   # castle, safe spawn, /rtp, mod blocker
./06-arenas-claims-simple.sh ../tools CraftArena-1.0.0.jar   # arena, PvP pit, land claims, green Simple spawn
./07-spawn-fix-login-gladiator.sh ../tools CraftArena-1.0.0.jar   # spawn fix, login captcha, gladiator arena
```

Build the plugins with `cd plugins/craftquiz && gradle build` and `cd plugins/craftskins && gradle build` (JDK 25).
**CraftSkins** keeps a fixed skin on chosen players (config `locked-skins`, default: MikuuLovesCoffee → `techno`,
xxbabyxv → `devil`): applied on every join, and `/skin` is blocked for them.

Edit `OWNER=` at the top of `03-offline-login-private-world.sh` first. The owner's AuthMe
password is generated on the server and saved to `/root/mc-owner-password.txt` (never in git).

### Isolation from other projects on the same box
Everything lives in `/opt/minecraft`, runs as its own `minecraft` user, and is capped by systemd
(`MemoryMax=6G` for a 4G heap, `CPUQuota=350%`), so it can't starve other services, and sandboxed with
`deploy/minecraft-hardening.conf` (read-only system, writes only to `/opt/minecraft`, no capabilities). The only shared change is
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
