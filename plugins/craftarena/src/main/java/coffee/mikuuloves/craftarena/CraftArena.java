package coffee.mikuuloves.craftarena;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Kit arena: on entering, players get creative mode for a while to pick any gear; then they fight in
 * adventure mode and always respawn with the loadout they picked. Nothing drops on death.
 */
public final class CraftArena extends JavaPlugin implements Listener {

    private record Prep(BukkitTask task, BossBar bar) {}

    private final Map<UUID, Prep> preparing = new HashMap<>();
    private final Map<String, Integer> caps = new HashMap<>();
    private List<String> banned;
    private File loadoutFile;
    private YamlConfiguration loadouts;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        banned = getConfig().getStringList("banned");
        var capSection = getConfig().getConfigurationSection("caps");
        if (capSection != null) capSection.getKeys(false).forEach(k -> caps.put(k, capSection.getInt(k)));
        loadoutFile = new File(getDataFolder(), "loadouts.yml");
        loadouts = YamlConfiguration.loadConfiguration(loadoutFile);
        getServer().getPluginManager().registerEvents(this, this);
        // Players already in the arena after a reload start a fresh preparation.
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (inArena(p)) startPrep(p, true);
        }
    }

    @Override
    public void onDisable() {
        preparing.forEach((id, prep) -> {
            prep.task().cancel();
            Player p = Bukkit.getPlayer(id);
            if (p != null) p.hideBossBar(prep.bar());
        });
        saveLoadouts();
    }

    private World arena() {
        return Bukkit.getWorld(getConfig().getString("world", "arena"));
    }

    private boolean inArena(Player p) {
        World w = arena();
        return w != null && p.getWorld().equals(w);
    }

    private Location randomSpot() {
        World w = arena();
        double r = getConfig().getDouble("spawn-radius", 22) * Math.sqrt(ThreadLocalRandom.current().nextDouble());
        double a = ThreadLocalRandom.current().nextDouble(Math.PI * 2);
        Location loc = new Location(w, getConfig().getDouble("center.x") + r * Math.cos(a), getConfig().getDouble("center.y"),
                getConfig().getDouble("center.z") + r * Math.sin(a));
        loc.setYaw((float) Math.toDegrees(Math.atan2(r * Math.cos(a), -r * Math.sin(a))));
        return loc;
    }

    // ---- preparation phase ----

    private void startPrep(Player p, boolean teleport) {
        cancelPrep(p);
        int seconds = getConfig().getInt("prep-seconds", 120);
        p.setGameMode(GameMode.CREATIVE);
        p.getInventory().setContents(loadout(p.getUniqueId()));
        if (teleport) p.teleport(randomSpot());
        BossBar bar = BossBar.bossBar(Component.text("Tayyorlanish: " + seconds + "s"), 1f, BossBar.Color.GREEN, BossBar.Overlay.PROGRESS);
        p.showBossBar(bar);
        p.showTitle(Title.title(Component.text("ARENA", NamedTextColor.GOLD, TextDecoration.BOLD),
                Component.text("Creative inventardan istalgan narsani oling", NamedTextColor.YELLOW)));
        p.sendMessage(Component.text("» " + seconds + " soniya: creative inventardan qurol, zirh va ovqat oling. ", NamedTextColor.YELLOW)
                .append(Component.text("/ready", NamedTextColor.GREEN)).append(Component.text(" — tayyor bo'lsangiz.", NamedTextColor.YELLOW)));
        int[] left = {seconds};
        BukkitTask task = Bukkit.getScheduler().runTaskTimer(this, () -> {
            left[0]--;
            if (left[0] <= 0) {
                finishPrep(p);
                return;
            }
            bar.name(Component.text("Tayyorlanish: " + left[0] + "s  ·  /ready"));
            bar.progress(Math.max(0f, left[0] / (float) seconds));
            if (left[0] <= 10) bar.color(BossBar.Color.RED);
        }, 20L, 20L);
        preparing.put(p.getUniqueId(), new Prep(task, bar));
    }

    private void cancelPrep(Player p) {
        Prep prep = preparing.remove(p.getUniqueId());
        if (prep != null) {
            prep.task().cancel();
            p.hideBossBar(prep.bar());
        }
    }

    private void finishPrep(Player p) {
        cancelPrep(p);
        if (!p.isOnline() || !inArena(p)) return;
        ItemStack[] kit = sanitize(p.getInventory().getContents());
        saveLoadout(p.getUniqueId(), kit);
        p.getInventory().setContents(kit);
        p.setGameMode(GameMode.ADVENTURE);
        heal(p);
        p.showTitle(Title.title(Component.text("JANG!", NamedTextColor.RED, TextDecoration.BOLD),
                Component.text("O'lsangiz shu to'plam bilan qaytasiz", NamedTextColor.GRAY),
                Title.Times.times(Duration.ofMillis(200), Duration.ofSeconds(2), Duration.ofMillis(500))));
    }

    private static void heal(Player p) {
        var max = p.getAttribute(Attribute.MAX_HEALTH);
        p.setHealth(max != null ? max.getValue() : 20);
        p.setFoodLevel(20);
        p.setSaturation(10);
        p.setFireTicks(0);
        p.getActivePotionEffects().forEach(e -> p.removePotionEffect(e.getType()));
    }

    /** Drops banned items and trims capped ones so every loadout stays fair. */
    private ItemStack[] sanitize(ItemStack[] contents) {
        Map<Material, Integer> used = new HashMap<>();
        ItemStack[] out = new ItemStack[contents.length];
        for (int i = 0; i < contents.length; i++) {
            ItemStack item = contents[i];
            if (item == null || item.getType().isAir()) continue;
            String id = item.getType().name();
            if (banned.stream().anyMatch(b -> id.startsWith(b) || id.endsWith(b) || id.contains(b))) continue;
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

    // ---- loadout storage ----

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

    // ---- events ----

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        Player p = event.getPlayer();
        if (inArena(p)) {
            // A few ticks later so Multiverse's own gamemode/inventory switch has happened first.
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (p.isOnline() && inArena(p)) startPrep(p, true);
            }, 5L);
        } else if (preparing.containsKey(p.getUniqueId())) {
            cancelPrep(p);
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (p.isOnline() && inArena(p)) startPrep(p, true);
        }, 10L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        cancelPrep(event.getPlayer());
    }

    /** Nobody can hurt or be hurt by a player who is still picking gear. */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDamage(EntityDamageByEntityEvent event) {
        Entity damager = event.getDamager();
        if (damager instanceof Projectile proj && proj.getShooter() instanceof Entity shooter) damager = shooter;
        if (preparing.containsKey(event.getEntity().getUniqueId()) || preparing.containsKey(damager.getUniqueId())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent event) {
        if (inArena(event.getPlayer())) event.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onDeath(PlayerDeathEvent event) {
        if (!inArena(event.getPlayer())) return;
        event.getDrops().clear();
        event.setDroppedExp(0);
        event.setKeepLevel(true);
    }

    // HIGHEST so this runs after EssentialsSpawn (which would send everyone to the castle)
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onRespawn(PlayerRespawnEvent event) {
        Player p = event.getPlayer();
        if (!inArena(p)) return;
        event.setRespawnLocation(randomSpot());
        Bukkit.getScheduler().runTask(this, () -> {
            if (!p.isOnline() || !inArena(p) || preparing.containsKey(p.getUniqueId())) return;
            p.getInventory().setContents(loadout(p.getUniqueId()));
            p.setGameMode(GameMode.ADVENTURE);
            heal(p);
        });
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player p)) return false;
        if (!inArena(p)) {
            p.sendMessage(Component.text("Bu buyruq faqat arenada ishlaydi: /arena", NamedTextColor.RED));
            return true;
        }
        if (command.getName().equals("ready")) {
            if (preparing.containsKey(p.getUniqueId())) finishPrep(p);
            else p.sendMessage(Component.text("Siz allaqachon jangdasiz. /loadout - to'plamni o'zgartirish", NamedTextColor.GRAY));
        } else {
            startPrep(p, false);
        }
        return true;
    }
}
