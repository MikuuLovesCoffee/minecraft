package coffee.mikuuloves.craftquiz;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.inventory.ItemStack;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Win statistics (read by the website leaderboard) and items still owed to winners.
 * stats.yml layout: players.&lt;uuid&gt;.{name, wins, money, last-win}
 */
final class QuizStore {

    private final CraftQuiz plugin;
    private final File statsFile;
    private final File pendingFile;
    private final YamlConfiguration stats;
    private final YamlConfiguration pending;

    QuizStore(CraftQuiz plugin) {
        this.plugin = plugin;
        this.statsFile = new File(plugin.getDataFolder(), "stats.yml");
        this.pendingFile = new File(plugin.getDataFolder(), "pending.yml");
        this.stats = YamlConfiguration.loadConfiguration(statsFile);
        this.pending = YamlConfiguration.loadConfiguration(pendingFile);
    }

    void addWin(UUID id, String name, int money) {
        String base = "players." + id + ".";
        stats.set(base + "name", name);
        stats.set(base + "wins", stats.getInt(base + "wins") + 1);
        stats.set(base + "money", stats.getLong(base + "money") + money);
        stats.set(base + "last-win", System.currentTimeMillis());
    }

    void addPending(UUID id, ItemStack item) {
        List<String> list = new ArrayList<>(pending.getStringList(id.toString()));
        list.add(Base64.getEncoder().encodeToString(item.serializeAsBytes()));
        pending.set(id.toString(), list);
    }

    List<ItemStack> takePending(UUID id) {
        List<ItemStack> items = new ArrayList<>();
        for (String encoded : pending.getStringList(id.toString())) {
            items.add(ItemStack.deserializeBytes(Base64.getDecoder().decode(encoded)));
        }
        pending.set(id.toString(), null);
        return items;
    }

    void save() {
        try {
            stats.save(statsFile);
            pending.save(pendingFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Could not save quiz data: " + e.getMessage());
        }
    }
}
