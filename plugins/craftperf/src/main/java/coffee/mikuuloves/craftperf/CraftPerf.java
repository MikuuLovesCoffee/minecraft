package coffee.mikuuloves.craftperf;

import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Per-player performance modes (view/simulation distance), /ping, /lag, and a server-wide
 * eco mode that kicks in automatically while ticks are slow.
 * Lower view distance = fewer chunks to send over the long UZ -> FR link and more client FPS.
 */
public final class CraftPerf extends JavaPlugin implements Listener {

    enum Mode {
        LOW(4, 3), BALANCED(6, 5), HIGH(8, 6);
        final int view, sim;
        Mode(int view, int sim) { this.view = view; this.sim = sim; }
    }

    // Caps applied on top of each player's mode.
    private static final int NORMAL_VIEW = 8, NORMAL_SIM = 6, ECO_VIEW = 5, ECO_SIM = 4;
    private static final double ECO_ON_MSPT = 40, ECO_OFF_MSPT = 25;

    private NamespacedKey modeKey;
    private String serverMode; // auto | normal | eco
    private boolean eco;
    private int slowChecks, fastChecks;

    @Override
    public void onEnable() {
        modeKey = new NamespacedKey(this, "mode");
        serverMode = getConfig().getString("server-mode", "auto");
        eco = serverMode.equals("eco");
        getServer().getPluginManager().registerEvents(this, this);
        Bukkit.getScheduler().runTaskTimer(this, this::checkLag, 200L, 200L);
        Bukkit.getOnlinePlayers().forEach(this::apply);
    }

    private void checkLag() {
        if (!serverMode.equals("auto")) return;
        double mspt = Bukkit.getAverageTickTime();
        if (mspt > ECO_ON_MSPT) { slowChecks++; fastChecks = 0; }
        else if (mspt < ECO_OFF_MSPT) { fastChecks++; slowChecks = 0; }
        if (!eco && slowChecks >= 2) setEco(true, String.format(Locale.ROOT, "%.1f", mspt));
        else if (eco && fastChecks >= 6) setEco(false, String.format(Locale.ROOT, "%.1f", mspt));
    }

    private void setEco(boolean on, String mspt) {
        eco = on;
        slowChecks = fastChecks = 0;
        Bukkit.getOnlinePlayers().forEach(this::apply);
        getLogger().info("Eco mode " + (on ? "ON" : "OFF") + " (mspt " + mspt + ")");
        for (Player p : Bukkit.getOnlinePlayers())
            if (p.hasPermission("craftperf.admin"))
                send(p, "&8[&eCraftPerf&8] &7Eco rejim " + (on ? "&cyoqildi" : "&ao'chirildi") + " &7(mspt " + mspt + ")");
    }

    private Mode modeOf(Player player) {
        String name = player.getPersistentDataContainer().get(modeKey, PersistentDataType.STRING);
        try { return name == null ? Mode.BALANCED : Mode.valueOf(name); }
        catch (IllegalArgumentException e) { return Mode.BALANCED; }
    }

    private void apply(Player player) {
        Mode mode = modeOf(player);
        int view = Math.min(mode.view, eco ? ECO_VIEW : NORMAL_VIEW);
        int sim = Math.min(mode.sim, eco ? ECO_SIM : NORMAL_SIM);
        player.setSimulationDistance(sim);
        player.setViewDistance(view + 1); // load distance, must exceed send distance
        player.setSendViewDistance(view);
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        Bukkit.getScheduler().runTask(this, () -> { if (player.isOnline()) apply(player); });
    }

    @EventHandler
    public void onWorld(PlayerChangedWorldEvent event) {
        apply(event.getPlayer());
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        switch (command.getName()) {
            case "mode" -> mode(sender, args);
            case "ping" -> ping(sender, args);
            case "lag" -> lag(sender);
            case "servermode" -> serverMode(sender, args);
        }
        return true;
    }

    private void mode(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) { sender.sendMessage("Players only"); return; }
        if (args.length == 0) {
            Mode m = modeOf(player);
            send(player, "&6Rejim: &e" + m.name().toLowerCase(Locale.ROOT) + " &7(ko'rish " + m.view + ", simulyatsiya " + m.sim + ")"
                    + (eco ? " &c[server eco rejimida]" : ""));
            send(player, "&7/mode low &8- &fko'proq FPS, kam ping");
            send(player, "&7/mode balanced &8- &foddiy");
            send(player, "&7/mode high &8- &fuzoqni ko'rish (kuchli kompyuter uchun)");
            return;
        }
        Mode mode = parse(args[0]);
        if (mode == null) { send(player, "&cFoydalanish: /mode <low|balanced|high>"); return; }
        player.getPersistentDataContainer().set(modeKey, PersistentDataType.STRING, mode.name());
        apply(player);
        send(player, "&aRejim: &e" + mode.name().toLowerCase(Locale.ROOT) + " &7(ko'rish " + mode.view + " chunk)");
    }

    private static Mode parse(String arg) {
        return switch (arg.toLowerCase(Locale.ROOT)) {
            case "low", "fps", "past", "potato" -> Mode.LOW;
            case "balanced", "normal", "orta", "o'rta" -> Mode.BALANCED;
            case "high", "yuqori", "quality" -> Mode.HIGH;
            default -> null;
        };
    }

    private void ping(CommandSender sender, String[] args) {
        Player target = args.length > 0 ? Bukkit.getPlayerExact(args[0]) : sender instanceof Player p ? p : null;
        if (target == null) { send(sender, "&cO'yinchi topilmadi"); return; }
        int ping = target.getPing();
        String color = ping < 120 ? "&a" : ping < 250 ? "&e" : "&c";
        send(sender, "&7" + target.getName() + " ping: " + color + ping + "ms"
                + (ping >= 250 && target == sender ? " &7- &f/mode low &7yordam beradi" : ""));
    }

    private void lag(CommandSender sender) {
        double[] tps = Bukkit.getTPS();
        double mspt = Bukkit.getAverageTickTime();
        String color = mspt < 30 ? "&a" : mspt < 50 ? "&e" : "&c";
        send(sender, String.format(Locale.ROOT, "&7TPS: &a%.1f &8/ &a%.1f &8/ &a%.1f &7 MSPT: %s%.1f &7 Server: &e%s%s",
                Math.min(20, tps[0]), Math.min(20, tps[1]), Math.min(20, tps[2]), color, mspt, serverMode, eco ? " (eco)" : ""));
    }

    private void serverMode(CommandSender sender, String[] args) {
        List<String> modes = Arrays.asList("auto", "normal", "eco");
        if (args.length == 0 || !modes.contains(args[0].toLowerCase(Locale.ROOT))) {
            send(sender, "&7Server rejimi: &e" + serverMode + (eco ? " (eco)" : "") + " &7- /servermode <auto|normal|eco>");
            return;
        }
        serverMode = args[0].toLowerCase(Locale.ROOT);
        getConfig().set("server-mode", serverMode);
        saveConfig();
        eco = serverMode.equals("eco");
        slowChecks = fastChecks = 0;
        Bukkit.getOnlinePlayers().forEach(this::apply);
        send(sender, "&aServer rejimi: &e" + serverMode);
    }

    private static void send(CommandSender to, String legacy) {
        to.sendMessage(LegacyComponentSerializer.legacyAmpersand().deserialize(legacy));
    }
}
