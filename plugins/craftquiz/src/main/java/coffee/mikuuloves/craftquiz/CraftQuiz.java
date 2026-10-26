package coffee.mikuuloves.craftquiz;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicReference;

/** Asks an Uzbek chat question every few minutes; the first correct answer wins money and sometimes a rare item. */
public final class CraftQuiz extends JavaPlugin implements Listener {

    private record Question(String text, Set<String> answers, String shownAnswer) {}

    private record RareItem(Material material, int amount, int weight) {}

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacySection();

    private final AtomicReference<Question> active = new AtomicReference<>();
    private final List<Question> bank = new ArrayList<>();
    private final List<RareItem> rareItems = new ArrayList<>();
    private QuizStore store;
    private BukkitTask loop;
    private BukkitTask timeout;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        if (!new File(getDataFolder(), "questions.yml").exists()) {
            saveResource("questions.yml", false);
        }
        store = new QuizStore(this);
        loadSettings();
        getServer().getPluginManager().registerEvents(this, this);
    }

    @Override
    public void onDisable() {
        store.save();
    }

    private void loadSettings() {
        reloadConfig();
        bank.clear();
        YamlConfiguration q = YamlConfiguration.loadConfiguration(new File(getDataFolder(), "questions.yml"));
        for (Map<?, ?> m : q.getMapList("questions")) {
            List<?> raw = (List<?>) m.get("answers");
            Set<String> answers = new java.util.HashSet<>();
            for (Object a : raw) answers.add(normalize(String.valueOf(a)));
            bank.add(new Question(String.valueOf(m.get("q")), answers, String.valueOf(raw.get(0))));
        }
        rareItems.clear();
        for (Map<?, ?> m : getConfig().getMapList("rare-items")) {
            Material mat = Material.matchMaterial(String.valueOf(m.get("material")));
            if (mat == null) {
                getLogger().warning("Unknown material in rare-items: " + m.get("material"));
                continue;
            }
            rareItems.add(new RareItem(mat, ((Number) m.get("amount")).intValue(), ((Number) m.get("weight")).intValue()));
        }
        if (loop != null) loop.cancel();
        long period = getConfig().getLong("interval-minutes", 5) * 60 * 20;
        loop = Bukkit.getScheduler().runTaskTimer(this, this::ask, period, period);
        getLogger().info("Loaded " + bank.size() + " questions, " + rareItems.size() + " rare items.");
    }

    // ---- quiz flow ----

    private void ask() {
        if (active.get() != null) return;
        if (Bukkit.getOnlinePlayers().size() < getConfig().getInt("min-players", 1)) return;
        Question question = ThreadLocalRandom.current().nextDouble() < getConfig().getDouble("math-chance", 0.5) || bank.isEmpty()
                ? mathQuestion() : bank.get(ThreadLocalRandom.current().nextInt(bank.size()));
        active.set(question);
        int seconds = getConfig().getInt("answer-seconds", 60);
        broadcast("");
        broadcast("§6§l❓ VIKTORINA §8» §f" + question.text());
        broadcast("§7Javobni chatga yozing! §e" + seconds + " soniya§7 vaqtingiz bor.");
        broadcast("");
        timeout = Bukkit.getScheduler().runTaskLater(this, () -> {
            if (active.compareAndSet(question, null)) {
                broadcast("§c⌛ Hech kim topa olmadi. To'g'ri javob: §f" + question.shownAnswer());
            }
        }, seconds * 20L);
    }

    private Question mathQuestion() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        int a, b, result;
        String text;
        switch (r.nextInt(4)) {
            case 0 -> { a = r.nextInt(10, 100); b = r.nextInt(10, 100); result = a + b; text = a + " + " + b; }
            case 1 -> { a = r.nextInt(30, 150); b = r.nextInt(5, a); result = a - b; text = a + " - " + b; }
            case 2 -> { a = r.nextInt(2, 13); b = r.nextInt(2, 13); result = a * b; text = a + " × " + b; }
            default -> {
                a = r.nextInt(2, 10); b = r.nextInt(2, 10);
                int c = r.nextInt(1, 30);
                result = a * b + c; text = a + " × " + b + " + " + c;
            }
        }
        return new Question("Hisoblang: §e" + text + " §f= ?", Set.of(String.valueOf(result)), String.valueOf(result));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        Question question = active.get();
        if (question == null) return;
        String said = normalize(PlainTextComponentSerializer.plainText().serialize(event.message()));
        if (!question.answers().contains(said)) return;
        Player player = event.getPlayer();
        // Award on the main thread; compareAndSet makes sure only the first correct answer wins.
        Bukkit.getScheduler().runTask(this, () -> {
            if (!active.compareAndSet(question, null)) return;
            if (timeout != null) timeout.cancel();
            reward(player, question);
        });
    }

    private void reward(Player player, Question question) {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        int money = r.nextInt(getConfig().getInt("reward.money-min", 50), getConfig().getInt("reward.money-max", 200) + 1);
        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), getConfig().getString("reward.money-command", "eco give {player} {amount}")
                .replace("{player}", player.getName()).replace("{amount}", String.valueOf(money)));
        store.addWin(player.getUniqueId(), player.getName(), money);

        String prize = "§e$" + money;
        if (!rareItems.isEmpty() && r.nextDouble() < getConfig().getDouble("reward.item-chance", 0.15)) {
            RareItem item = pickRare();
            ItemStack stack = new ItemStack(item.material(), item.amount());
            prize += " §d+ " + item.amount() + "x " + pretty(item.material());
            if (inItemWorld(player)) {
                give(player, stack);
            } else {
                store.addPending(player.getUniqueId(), stack);
                player.sendMessage(LEGACY.deserialize("§eSovg'angiz survival dunyosiga kirganingizda beriladi."));
            }
        }
        broadcast("§a§l✔ " + player.getName() + " §ato'g'ri javob berdi: §f" + question.shownAnswer() + "§a! Mukofot: " + prize);
        store.save();
    }

    private RareItem pickRare() {
        int total = rareItems.stream().mapToInt(RareItem::weight).sum();
        int roll = ThreadLocalRandom.current().nextInt(total);
        for (RareItem item : rareItems) {
            roll -= item.weight();
            if (roll < 0) return item;
        }
        return rareItems.getLast();
    }

    // ---- pending items for winners who were in creative/arena ----

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        deliverPending(event.getPlayer());
    }

    @EventHandler
    public void onWorldChange(PlayerChangedWorldEvent event) {
        deliverPending(event.getPlayer());
    }

    private void deliverPending(Player player) {
        if (!inItemWorld(player)) return;
        List<ItemStack> items = store.takePending(player.getUniqueId());
        if (items.isEmpty()) return;
        items.forEach(item -> give(player, item));
        player.sendMessage(LEGACY.deserialize("§aViktorina sovg'alaringiz berildi!"));
        store.save();
    }

    private boolean inItemWorld(Player player) {
        return getConfig().getStringList("item-worlds").contains(player.getWorld().getName());
    }

    private static void give(Player player, ItemStack stack) {
        player.getInventory().addItem(stack).values()
                .forEach(left -> player.getWorld().dropItemNaturally(player.getLocation(), left));
    }

    // ---- helpers ----

    /** Lowercase, unify the many apostrophe characters Uzbek players type, and drop other punctuation. */
    static String normalize(String s) {
        String t = s.toLowerCase(java.util.Locale.ROOT).replaceAll("[ʻʼ‘’`´]", "'").replaceAll("[^\\p{L}\\p{N}' ]", " ");
        return t.replace("'", "").trim().replaceAll("\\s+", " ");
    }

    private static String pretty(Material material) {
        String name = material.name().toLowerCase(java.util.Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    private static void broadcast(String legacy) {
        Bukkit.broadcast(LEGACY.deserialize(legacy));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        String sub = args.length > 0 ? args[0].toLowerCase(java.util.Locale.ROOT) : "";
        switch (sub) {
            case "start" -> {
                if (active.get() != null) sender.sendMessage("A question is already running.");
                else ask();
            }
            case "skip" -> {
                Question q = active.getAndSet(null);
                if (timeout != null) timeout.cancel();
                sender.sendMessage(q == null ? "No question is running." : "Skipped. Answer was: " + q.shownAnswer());
            }
            case "reload" -> {
                loadSettings();
                sender.sendMessage("CraftQuiz reloaded: " + bank.size() + " questions.");
            }
            default -> {
                return false;
            }
        }
        return true;
    }
}
