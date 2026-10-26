package coffee.mikuuloves.craftguard;

import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerRegisterChannelEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;
import java.util.Locale;

/**
 * Kicks modded clients. Only catches clients that announce themselves (brand / mod channels);
 * hacked clients that pretend to be vanilla are GrimAC's job.
 */
public final class CraftGuard extends JavaPlugin implements Listener {

    private List<String> brands;
    private List<String> channels;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        brands = lower(getConfig().getStringList("blocked-brands"));
        channels = lower(getConfig().getStringList("blocked-channels"));
        getServer().getPluginManager().registerEvents(this, this);
    }

    private static List<String> lower(List<String> list) {
        return list.stream().map(s -> s.toLowerCase(Locale.ROOT)).toList();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        // The brand packet arrives shortly after joining.
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (!player.isOnline() || player.hasPermission("craftguard.bypass")) return;
            String brand = player.getClientBrandName();
            if (brand != null && matches(brand, brands)) kick(player, "brand " + brand);
        }, 40L);
    }

    @EventHandler
    public void onChannel(PlayerRegisterChannelEvent event) {
        Player player = event.getPlayer();
        if (player.hasPermission("craftguard.bypass") || !matches(event.getChannel(), channels)) return;
        String channel = event.getChannel();
        Bukkit.getScheduler().runTask(this, () -> kick(player, "channel " + channel));
    }

    private static boolean matches(String value, List<String> words) {
        String v = value.toLowerCase(Locale.ROOT);
        return words.stream().anyMatch(v::contains);
    }

    private void kick(Player player, String reason) {
        if (!player.isOnline()) return;
        getLogger().info("Kicked " + player.getName() + " for modded client (" + reason + ")");
        player.kick(LegacyComponentSerializer.legacyAmpersand().deserialize(getConfig().getString("kick-message", "Mods are not allowed")));
    }
}
