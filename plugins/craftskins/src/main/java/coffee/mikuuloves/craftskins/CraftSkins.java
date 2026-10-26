package coffee.mikuuloves.craftskins;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.skinsrestorer.api.SkinsRestorer;
import net.skinsrestorer.api.SkinsRestorerProvider;
import net.skinsrestorer.api.property.SkinIdentifier;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Keeps a fixed skin on chosen players: re-applied on every join, and /skin is blocked for them. */
public final class CraftSkins extends JavaPlugin implements Listener {

    private final Map<String, String> locked = new HashMap<>(); // lowercase name -> custom skin

    @Override
    public void onEnable() {
        saveDefaultConfig();
        var section = getConfig().getConfigurationSection("locked-skins");
        if (section != null) {
            for (String name : section.getKeys(false)) {
                String skin = section.getString(name);
                locked.put(name.toLowerCase(Locale.ROOT), skin);
                // Store right away under the offline-mode UUID (case-sensitive name), so it's set before the next join.
                store(offlineUuid(name), name, skin);
            }
        }
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Locked skins: " + locked);
    }

    private static UUID offlineUuid(String name) {
        return UUID.nameUUIDFromBytes(("OfflinePlayer:" + name).getBytes(StandardCharsets.UTF_8));
    }

    private void store(UUID uuid, String name, String skin) {
        try {
            SkinsRestorerProvider.get().getPlayerStorage().setSkinIdOfPlayer(uuid, SkinIdentifier.ofCustom(skin));
        } catch (Exception e) {
            getLogger().warning("Could not store skin " + skin + " for " + name + ": " + e.getMessage());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String skin = locked.get(player.getName().toLowerCase(Locale.ROOT));
        if (skin == null) return;
        // One tick later so it runs after SkinsRestorer's own join handling.
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (!player.isOnline()) return;
            store(player.getUniqueId(), player.getName(), skin);
            try {
                SkinsRestorer sr = SkinsRestorerProvider.get();
                sr.getSkinApplier(Player.class).applySkin(player);
            } catch (Exception e) {
                getLogger().warning("Could not apply skin to " + player.getName() + ": " + e.getMessage());
            }
        }, 20L);
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        if (!locked.containsKey(event.getPlayer().getName().toLowerCase(Locale.ROOT))) return;
        String label = event.getMessage().substring(1).split(" ", 2)[0].toLowerCase(Locale.ROOT);
        if (label.equals("skin") || label.equals("skinsrestorer:skin")) {
            event.setCancelled(true);
            event.getPlayer().sendMessage(Component.text("Your skin is locked by the server.", NamedTextColor.RED));
        }
    }
}
