package coffee.mikuuloves.craftarena;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.TextDisplay;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Transformation;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gladiator duel arena. Spectators watch from the stands; the first two players in the /join queue go to the
 * two cells, pick gear in creative (2 minutes, or /ready), and fight when both are ready and the gates open.
 * Each death is a point; the first to rounds-to-win takes the match and stays for the next challenger.
 */
public final class CraftArena extends JavaPlugin implements Listener {

    private enum Phase { SETUP, FIGHT }

    private static final class Fighter {
        final UUID id;
        final String cell;
        int score;
        boolean ready;
        BukkitTask prepTask;
        BossBar bar;

        Fighter(UUID id, String cell) {
            this.id = id;
            this.cell = cell;
        }

        Player player() {
            return Bukkit.getPlayer(id);
        }
    }

    private final Map<String, Fighter> slots = new HashMap<>(); // "a" / "b"
    // each entry is one player, or two players who challenged each other (they fight each other)
    private final LinkedList<List<UUID>> queue = new LinkedList<>();
    private final Map<UUID, UUID> invites = new HashMap<>(); // challenger -> challenged
    private final Map<String, Integer> caps = new HashMap<>();
    private Phase phase = Phase.SETUP;
    private int round;
    private List<String> banned;
    private File loadoutFile;
    private YamlConfiguration loadouts;
    private TextDisplay board;
    private ItemDisplay itemA, itemB;
    private float spin;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        banned = getConfig().getStringList("banned");
        ConfigurationSection capSection = getConfig().getConfigurationSection("caps");
        if (capSection != null) capSection.getKeys(false).forEach(k -> caps.put(k, capSection.getInt(k)));
        loadoutFile = new File(getDataFolder(), "loadouts.yml");
        loadouts = YamlConfiguration.loadConfiguration(loadoutFile);
        getServer().getPluginManager().registerEvents(this, this);
        Bukkit.getScheduler().runTask(this, () -> {
            setDoors(false);
            for (Player p : Bukkit.getOnlinePlayers()) if (inArena(p)) toSpectator(p);
        });
        // Spin the weapons on the scoreboard and keep it alive while anyone is watching.
        Bukkit.getScheduler().runTaskTimer(this, () -> {
            World w = arena();
            if (w == null || w.getPlayers().isEmpty()) return;
            spin += 6f;
            if (itemA != null && itemA.isValid()) itemA.setRotation(spin, 0);
            if (itemB != null && itemB.isValid()) itemB.setRotation(-spin, 0);
            if (board == null || !board.isValid()) updateBoard();
        }, 40L, 2L);
    }

    @Override
    public void onDisable() {
        slots.values().forEach(this::stopPrep);
        setDoors(false);
        removeBoard();
        saveLoadouts();
    }

    // ---------------- helpers ----------------

    private World arena() {
        return Bukkit.getWorld(getConfig().getString("world", "arena"));
    }

    private boolean inArena(Player p) {
        World w = arena();
        return w != null && p.getWorld().equals(w);
    }

    private Location loc(String path) {
        ConfigurationSection s = getConfig().getConfigurationSection(path);
        return new Location(arena(), s.getDouble("x"), s.getDouble("y"), s.getDouble("z"), (float) s.getDouble("yaw"), 0);
    }

    private Fighter fighter(Player p) {
        for (Fighter f : slots.values()) if (f.id.equals(p.getUniqueId())) return f;
        return null;
    }

    private Fighter opponent(Fighter f) {
        return slots.get(f.cell.equals("a") ? "b" : "a");
    }

    private void tell(Player p, String msg, NamedTextColor color) {
        if (p != null) p.sendMessage(Component.text("⚔ " + msg, color));
    }

    private void announce(String msg, NamedTextColor color) {
        World w = arena();
        if (w != null) w.getPlayers().forEach(p -> tell(p, msg, color));
    }

    private static void heal(Player p) {
        var max = p.getAttribute(Attribute.MAX_HEALTH);
        p.setHealth(max != null ? max.getValue() : 20);
        p.setFoodLevel(20);
        p.setSaturation(10);
        p.setFireTicks(0);
        p.getActivePotionEffects().forEach(e -> p.removePotionEffect(e.getType()));
    }

    private void setDoors(boolean open) {
        World w = arena();
        if (w == null) return;
        for (String cell : List.of("a", "b")) {
            ConfigurationSection d = getConfig().getConfigurationSection("cells." + cell + ".door");
            for (int x = d.getInt("x1"); x <= d.getInt("x2"); x++)
                for (int y = d.getInt("y1"); y <= d.getInt("y2"); y++)
                    for (int z = d.getInt("z1"); z <= d.getInt("z2"); z++)
                        w.getBlockAt(x, y, z).setType(open ? Material.AIR : Material.IRON_BARS);
        }
    }

    // ---------------- spectators and queue ----------------

    private void toSpectator(Player p) {
        p.setGameMode(GameMode.ADVENTURE);
        p.getInventory().clear();
        heal(p);
        p.teleport(loc("spectator-spawn"));
        tell(p, "Tribunadasiz. /join - jangga navbat olish", NamedTextColor.YELLOW);
        updateBoard();
    }

    private boolean queued(UUID id) {
        return queue.stream().anyMatch(e -> e.contains(id));
    }

    /** Takes a player out of the queue; if they were in a pair, their partner stays queued alone. */
    private boolean dequeue(Player p) {
        UUID id = p.getUniqueId();
        for (int i = 0; i < queue.size(); i++) {
            List<UUID> entry = queue.get(i);
            if (!entry.contains(id)) continue;
            List<UUID> rest = entry.stream().filter(u -> !u.equals(id)).toList();
            if (rest.isEmpty()) {
                queue.remove(i);
            } else {
                queue.set(i, rest);
                tell(Bukkit.getPlayer(rest.get(0)), p.getName() + " navbatdan chiqdi — siz yolg'iz navbatdasiz.", NamedTextColor.GRAY);
            }
            return true;
        }
        return false;
    }

    private int queuedPlayers() {
        return queue.stream().mapToInt(List::size).sum();
    }

    private void join(Player p) {
        if (fighter(p) != null || queued(p.getUniqueId())) {
            tell(p, "Siz allaqachon navbatdasiz yoki jangdasiz.", NamedTextColor.GRAY);
            return;
        }
        queue.addLast(List.of(p.getUniqueId()));
        tell(p, "Navbatga yozildingiz. Oldingizda: " + (queuedPlayers() - 1) + " kishi", NamedTextColor.GREEN);
        fillSlots();
    }

    /** /join <name>: challenge a player; when they /join you back, you two queue as a pair and fight each other. */
    private void challenge(Player p, String name) {
        Player target = Bukkit.getPlayerExact(name);
        if (target == null || target.equals(p)) {
            tell(p, "Bunday o'yinchi onlayn emas.", NamedTextColor.RED);
            return;
        }
        if (fighter(p) != null || fighter(target) != null) {
            tell(p, "Jangdagi o'yinchini chaqirib bo'lmaydi.", NamedTextColor.GRAY);
            return;
        }
        if (p.getUniqueId().equals(invites.get(target.getUniqueId()))) {
            invites.remove(target.getUniqueId());
            queue.removeIf(e -> e.contains(p.getUniqueId()) || e.contains(target.getUniqueId()));
            queue.addLast(List.of(target.getUniqueId(), p.getUniqueId()));
            tell(p, target.getName() + " bilan jang navbatga qo'shildi!", NamedTextColor.GREEN);
            tell(target, p.getName() + " chaqiruvni qabul qildi! Navbatdasiz.", NamedTextColor.GREEN);
            fillSlots();
            return;
        }
        invites.put(p.getUniqueId(), target.getUniqueId());
        tell(p, target.getName() + " jangga chaqirildi. U /join " + p.getName() + " yozsa, navbatga tushasiz.", NamedTextColor.YELLOW);
        tell(target, p.getName() + " sizni arenada jangga chaqirdi! Qabul qilish: /arena keyin /join " + p.getName(), NamedTextColor.GOLD);
    }

    /** Drops queue entries whose players went offline or left the arena; a broken pair keeps the one still here. */
    private List<UUID> nextEntry() {
        while (!queue.isEmpty()) {
            List<UUID> head = queue.peekFirst();
            List<UUID> here = head.stream().filter(id -> { Player p = Bukkit.getPlayer(id); return p != null && inArena(p); }).toList();
            if (here.size() == head.size()) return head;
            queue.pollFirst();
            if (!here.isEmpty()) {
                queue.addFirst(here);
                return here;
            }
        }
        return null;
    }

    private void seat(UUID id, String cell) {
        Fighter f = new Fighter(id, cell);
        slots.put(cell, f);
        Player p = f.player();
        announce((p != null ? p.getName() : "?") + " arenaga chiqdi!", NamedTextColor.GOLD);
        startPrep(f);
    }

    /** Puts the next players from the queue into the cells. A waiting pair takes both cells once no fight is on. */
    private void fillSlots() {
        if (phase != Phase.FIGHT) {
            List<UUID> head;
            while ((head = nextEntry()) != null) {
                if (head.size() == 2) {
                    // anyone sitting in a cell without a fight goes back to the front of the queue
                    for (Fighter f : new ArrayList<>(slots.values())) {
                        stopPrep(f);
                        slots.remove(f.cell);
                        queue.add(1, List.of(f.id));
                        Player p = f.player();
                        if (p != null) {
                            tell(p, "Do'stlar jangi boshlanmoqda — siz navbat boshidasiz.", NamedTextColor.YELLOW);
                            toSpectator(p);
                        }
                    }
                    queue.pollFirst();
                    round = 0;
                    seat(head.get(0), "a");
                    seat(head.get(1), "b");
                    break;
                }
                String cell = !slots.containsKey("a") ? "a" : !slots.containsKey("b") ? "b" : null;
                if (cell == null) break;
                queue.pollFirst();
                seat(head.get(0), cell);
            }
        }
        updateBoard();
    }

    /** Removes a fighter (left, quit, gave up). The opponent wins the match. */
    private void forfeit(Fighter f) {
        stopPrep(f);
        slots.remove(f.cell);
        Fighter other = opponent(f);
        if (phase == Phase.FIGHT) {
            phase = Phase.SETUP;
            setDoors(false);
        }
        if (other != null && other.player() != null) {
            announce(other.player().getName() + " g'olib (raqib chiqib ketdi)!", NamedTextColor.GOLD);
            resetForNextMatch(other);
        }
        fillSlots();
    }

    // ---------------- preparation ----------------

    private void startPrep(Fighter f) {
        Player p = f.player();
        if (p == null) return;
        stopPrep(f);
        f.ready = false;
        p.teleport(loc("cells." + f.cell + ".spawn"));
        p.setGameMode(GameMode.CREATIVE);
        p.getInventory().setContents(loadout(f.id));
        heal(p);
        int seconds = getConfig().getInt("prep-seconds", 120);
        f.bar = BossBar.bossBar(Component.text("Qurol tanlash: " + seconds + "s · /ready"), 1f, BossBar.Color.GREEN, BossBar.Overlay.PROGRESS);
        p.showBossBar(f.bar);
        p.showTitle(Title.title(Component.text("QUROL TANLANG", NamedTextColor.GOLD, TextDecoration.BOLD),
                Component.text("Creative inventardan istalgan narsa · /ready", NamedTextColor.YELLOW)));
        int[] left = {seconds};
        f.prepTask = Bukkit.getScheduler().runTaskTimer(this, () -> {
            if (--left[0] <= 0) {
                finishPrep(f);
                return;
            }
            f.bar.name(Component.text("Qurol tanlash: " + left[0] + "s · /ready"));
            f.bar.progress(Math.max(0f, left[0] / (float) seconds));
            if (left[0] <= 10) f.bar.color(BossBar.Color.RED);
        }, 20L, 20L);
        updateBoard();
    }

    private void stopPrep(Fighter f) {
        if (f.prepTask != null) f.prepTask.cancel();
        f.prepTask = null;
        Player p = f.player();
        if (f.bar != null && p != null) p.hideBossBar(f.bar);
        f.bar = null;
    }

    private boolean preparing(Fighter f) {
        return f.prepTask != null;
    }

    private void finishPrep(Fighter f) {
        stopPrep(f);
        Player p = f.player();
        if (p == null || !inArena(p)) return;
        ItemStack[] kit = sanitize(p.getInventory().getContents());
        saveLoadout(f.id, kit);
        p.getInventory().setContents(kit);
        p.setGameMode(GameMode.ADVENTURE);
        heal(p);
        markReady(f);
    }

    private void markReady(Fighter f) {
        f.ready = true;
        Fighter other = opponent(f);
        tell(f.player(), other == null ? "Tayyor! Raqib kutilmoqda..." : other.ready ? "Tayyor!" : "Tayyor! Raqib /ready yozishini kuting.", NamedTextColor.GREEN);
        if (other != null && other.ready && phase == Phase.SETUP) startRound();
        updateBoard();
    }

    // ---------------- rounds ----------------

    private void startRound() {
        phase = Phase.FIGHT;
        round++;
        setDoors(true);
        for (Fighter f : slots.values()) {
            Player p = f.player();
            if (p != null) p.showTitle(Title.title(Component.text("JANG!", NamedTextColor.RED, TextDecoration.BOLD),
                    Component.text("Darvozalar ochildi · Raund " + round, NamedTextColor.GRAY),
                    Title.Times.times(Duration.ofMillis(150), Duration.ofSeconds(2), Duration.ofMillis(400))));
        }
        announce("Raund " + round + " boshlandi!", NamedTextColor.RED);
        updateBoard();
    }

    private void endRound(Fighter winner, Fighter loser) {
        phase = Phase.SETUP;
        setDoors(false);
        winner.score++;
        Player wp = winner.player();
        announce((wp != null ? wp.getName() : "?") + " raundni yutdi! " + scoreText(), NamedTextColor.GOLD);
        int toWin = getConfig().getInt("rounds-to-win", 3);
        if (winner.score >= toWin) {
            announce((wp != null ? wp.getName() : "?") + " MATCHNI YUTDI! Chempion qoladi, keyingi raqib: /join", NamedTextColor.GOLD);
            slots.remove(loser.cell); // the loser goes to the stands in onRespawn
            resetForNextMatch(winner);
            fillSlots();
            return;
        }
        winner.ready = loser.ready = false;
        if (wp != null) backToCell(winner);
        // the loser is sent to the cell in onRespawn
        updateBoard();
    }

    private void resetForNextMatch(Fighter champion) {
        champion.score = 0;
        champion.ready = false;
        round = 0;
        backToCell(champion);
    }

    private void backToCell(Fighter f) {
        Player p = f.player();
        if (p == null) return;
        p.teleport(loc("cells." + f.cell + ".spawn"));
        p.setGameMode(GameMode.ADVENTURE);
        p.getInventory().setContents(loadout(f.id));
        heal(p);
        tell(p, "Keyingi raund: /ready  ·  qurolni almashtirish: /loadout", NamedTextColor.YELLOW);
    }

    private String scoreText() {
        Fighter a = slots.get("a"), b = slots.get("b");
        return "(" + (a != null ? a.score : 0) + " : " + (b != null ? b.score : 0) + ")";
    }

    // ---------------- scoreboard above the arena ----------------

    private ItemStack weapon(UUID id) {
        ItemStack[] kit = loadout(id);
        for (int i = 0; i < 9 && i < kit.length; i++) {
            ItemStack item = kit[i];
            if (item == null) continue;
            String n = item.getType().name();
            if (n.endsWith("_SWORD") || n.endsWith("_AXE") || n.endsWith("_SPEAR") || n.equals("MACE") || n.equals("TRIDENT")
                    || n.equals("BOW") || n.equals("CROSSBOW")) return item;
        }
        for (int i = 0; i < 9 && i < kit.length; i++) if (kit[i] != null) return kit[i];
        return new ItemStack(Material.IRON_SWORD);
    }

    private void removeBoard() {
        // List.of() rejects nulls, and these are null until the board is first spawned
        for (Entity e : new Entity[] {board, itemA, itemB}) {
            if (e != null) e.remove();
        }
        board = null;
        itemA = itemB = null;
    }

    private void updateBoard() {
        World w = arena();
        if (w == null) return;
        Location at = loc("board");
        if (!at.isChunkLoaded()) return;
        if (board == null || !board.isValid()) {
            removeBoard();
            board = w.spawn(at, TextDisplay.class, d -> {
                d.setPersistent(false);
                d.setBillboard(Display.Billboard.CENTER);
                d.setBackgroundColor(Color.fromARGB(170, 10, 8, 20));
                d.setShadowed(true);
                d.setLineWidth(400);
                d.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(3.5f), new AxisAngle4f()));
            });
            itemA = spawnItem(at.clone().add(9, 1, 0));
            itemB = spawnItem(at.clone().add(-9, 1, 0));
        }
        Fighter a = slots.get("a"), b = slots.get("b");
        Component text = Component.text("⚔ ARENA ⚔\n", NamedTextColor.GOLD, TextDecoration.BOLD);
        if (a == null && b == null) {
            text = text.append(Component.text("Jang yo'q · /join\n", NamedTextColor.GRAY).decoration(TextDecoration.BOLD, false));
        } else {
            text = text.append(Component.text(name(a), NamedTextColor.AQUA))
                    .append(Component.text("  " + (a != null ? a.score : 0) + " : " + (b != null ? b.score : 0) + "  ", NamedTextColor.WHITE))
                    .append(Component.text(name(b), NamedTextColor.LIGHT_PURPLE))
                    .append(Component.text("\n" + status(a, b), phase == Phase.FIGHT ? NamedTextColor.RED : NamedTextColor.YELLOW)
                            .decoration(TextDecoration.BOLD, false));
        }
        text = text.append(Component.text("\nNavbat: " + queuedPlayers() + " · birinchi " + getConfig().getInt("rounds-to-win", 3)
                + " ochko yutadi", NamedTextColor.DARK_GRAY).decoration(TextDecoration.BOLD, false));
        board.text(text);
        itemA.setItemStack(a != null ? weapon(a.id) : null);
        itemB.setItemStack(b != null ? weapon(b.id) : null);
    }

    private ItemDisplay spawnItem(Location at) {
        return at.getWorld().spawn(at, ItemDisplay.class, d -> {
            d.setPersistent(false);
            d.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(5f), new AxisAngle4f()));
            d.setBrightness(new Display.Brightness(15, 15));
        });
    }

    private String name(Fighter f) {
        Player p = f == null ? null : f.player();
        return p == null ? "???" : p.getName();
    }

    private String status(Fighter a, Fighter b) {
        if (phase == Phase.FIGHT) return "Raund " + round + " · JANG!";
        if (a == null || b == null) return "Raqib kutilmoqda... /join";
        String wa = a.ready ? "✔" : preparing(a) ? "qurol tanlamoqda" : "/ready kutilmoqda";
        String wb = b.ready ? "✔" : preparing(b) ? "qurol tanlamoqda" : "/ready kutilmoqda";
        return wa + "  |  " + wb;
    }

    // ---------------- loadouts ----------------

    private ItemStack[] sanitize(ItemStack[] contents) {
        Map<Material, Integer> used = new HashMap<>();
        ItemStack[] out = new ItemStack[contents.length];
        for (int i = 0; i < contents.length; i++) {
            ItemStack item = contents[i];
            if (item == null || item.getType().isAir()) continue;
            String id = item.getType().name();
            if (banned.stream().anyMatch(id::contains)) continue;
            Integer cap = caps.get(id);
            if (cap != null) {
                int room = cap - used.getOrDefault(item.getType(), 0);
                if (room <= 0) continue;
                item = item.clone();
                item.setAmount(Math.min(item.getAmount(), room));
                used.merge(item.getType(), item.getAmount(), Integer::sum);
            }
            out[i] = item;
        }
        return out;
    }

    private ItemStack[] loadout(UUID id) {
        ItemStack[] contents = new ItemStack[41];
        List<String> raw = loadouts.getStringList(id.toString());
        for (int i = 0; i < raw.size() && i < contents.length; i++) {
            if (!raw.get(i).isEmpty()) contents[i] = ItemStack.deserializeBytes(Base64.getDecoder().decode(raw.get(i)));
        }
        return contents;
    }

    private void saveLoadout(UUID id, ItemStack[] contents) {
        List<String> raw = new ArrayList<>();
        for (ItemStack item : contents) {
            raw.add(item == null || item.getType().isAir() ? "" : Base64.getEncoder().encodeToString(item.serializeAsBytes()));
        }
        loadouts.set(id.toString(), raw);
        saveLoadouts();
    }

    private void saveLoadouts() {
        try {
            loadouts.save(loadoutFile);
        } catch (IOException e) {
            getLogger().warning("Could not save loadouts: " + e.getMessage());
        }
    }

    // ---------------- events ----------------

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        Player p = event.getPlayer();
        if (event.getFrom().equals(arena())) leaveArena(p);
        if (inArena(p)) {
            // after Multiverse's own gamemode/inventory switch
            Bukkit.getScheduler().runTaskLater(this, () -> { if (p.isOnline() && inArena(p)) toSpectator(p); }, 5L);
        }
    }

    private void leaveArena(Player p) {
        dequeue(p);
        invites.remove(p.getUniqueId());
        Fighter f = fighter(p);
        if (f != null) forfeit(f);
        updateBoard();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        Bukkit.getScheduler().runTaskLater(this, () -> { if (p.isOnline() && inArena(p)) toSpectator(p); }, 10L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        leaveArena(event.getPlayer());
    }

    /** In the arena only the two fighters can hurt each other, and only while the gates are open. */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (!(event.getEntity() instanceof Player victim) || !inArena(victim)) return;
        Fighter vf = fighter(victim);
        if (vf == null || phase != Phase.FIGHT) {
            event.setCancelled(true);
            return;
        }
        if (event instanceof EntityDamageByEntityEvent byEntity) {
            Entity damager = byEntity.getDamager();
            if (damager instanceof Projectile proj && proj.getShooter() instanceof Entity shooter) damager = shooter;
            if (damager instanceof Player dp && fighter(dp) == null) event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent event) {
        if (inArena(event.getPlayer())) event.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onDeath(PlayerDeathEvent event) {
        Player p = event.getPlayer();
        if (!inArena(p)) return;
        event.getDrops().clear();
        event.setDroppedExp(0);
        event.setKeepLevel(true);
        Fighter loser = fighter(p);
        if (loser != null && phase == Phase.FIGHT) {
            Fighter winner = opponent(loser);
            if (winner != null) endRound(winner, loser);
        }
    }

    // HIGHEST so this wins over EssentialsSpawn (which would send everyone to the castle)
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onRespawn(PlayerRespawnEvent event) {
        Player p = event.getPlayer();
        if (!inArena(p)) return;
        Fighter f = fighter(p);
        event.setRespawnLocation(f != null ? loc("cells." + f.cell + ".spawn") : loc("spectator-spawn"));
        Bukkit.getScheduler().runTask(this, () -> {
            if (!p.isOnline() || !inArena(p)) return;
            if (f != null && slots.containsValue(f)) backToCell(f);
            else toSpectator(p);
        });
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player p)) return false;
        if (!inArena(p)) {
            tell(p, "Bu buyruq faqat arenada ishlaydi: /arena", NamedTextColor.RED);
            return true;
        }
        Fighter f = fighter(p);
        switch (command.getName()) {
            case "join" -> {
                if (args.length > 0) challenge(p, args[0]);
                else join(p);
            }
            case "leave" -> {
                if (f != null) {
                    tell(p, "Jangdan chiqdingiz.", NamedTextColor.GRAY);
                    forfeit(f);
                    toSpectator(p);
                } else if (dequeue(p)) {
                    tell(p, "Navbatdan chiqdingiz.", NamedTextColor.GRAY);
                    updateBoard();
                }
            }
            case "ready" -> {
                if (f == null) tell(p, "Avval /join bilan navbatga yoziling.", NamedTextColor.GRAY);
                else if (phase == Phase.FIGHT) tell(p, "Jang ketmoqda!", NamedTextColor.GRAY);
                else if (preparing(f)) finishPrep(f);
                else if (!f.ready) markReady(f);
            }
            case "loadout" -> {
                if (f == null) tell(p, "Avval /join bilan navbatga yoziling.", NamedTextColor.GRAY);
                else if (phase == Phase.FIGHT) tell(p, "Jang paytida qurolni almashtirib bo'lmaydi.", NamedTextColor.GRAY);
                else startPrep(f);
            }
            default -> {
                return false;
            }
        }
        return true;
    }
}
