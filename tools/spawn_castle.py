"""Builds the spawn castle in the SMP world with vanilla /fill and /setblock commands.

Centre (0, 0), ground at y=69, floor y=70. Castle walls at +-30, flattened grass plateau +-47.
Run on the server:  python3 spawn_castle.py --run      (or without --run to just print the commands)
"""
import random
import sys

G = 69          # ground (top block) height
R = 30          # wall line
P = 47          # plateau half-size
rnd = random.Random(26)
cmds = []


def c(cmd):
    cmds.append(f"execute in minecraft:overworld run {cmd}")


def fill(x1, y1, z1, x2, y2, z2, block, mode=""):
    c(f"fill {x1} {y1} {z1} {x2} {y2} {z2} {block} {mode}".strip())


def setb(x, y, z, block):
    c(f"setblock {x} {y} {z} {block}")


# --- terrain: clear the air above, solid ground below, grass on top ---
for y in range(G + 1, 141, 3):
    fill(-P, y, -P, P, min(y + 2, 140), P, "air")
for y in range(50, G, 3):
    fill(-P, y, -P, P, min(y + 2, G - 1), P, "stone" if y < 63 else "dirt")
fill(-P, G, -P, P, G, P, "grass_block")

# --- courtyard: andesite plaza, stone-brick cross paths, grass gardens in the quadrants ---
fill(-R + 2, G, -R + 2, R - 2, G, R - 2, "polished_andesite")
for sx in (-1, 1):
    for sz in (-1, 1):
        fill(sx * 6, G, sz * 6, sx * (R - 3), G, sz * (R - 3), "grass_block")
fill(-2, G, -R, 2, G, R, "stone_bricks")
fill(-R, G, -2, R, G, 2, "stone_bricks")
# paths out of both gates
fill(-2, G, R + 1, 2, G, P, "dirt_path")
fill(-2, G, -P, 2, G, -R - 1, "dirt_path")

# --- walls with battlements ---
H = G + 9  # wall top
fill(-R, G + 1, -R, R, H, -R + 1, "stone_bricks")
fill(-R, G + 1, R - 1, R, H, R, "stone_bricks")
fill(-R, G + 1, -R, -R + 1, H, R, "stone_bricks")
fill(R - 1, G + 1, -R, R, H, R, "stone_bricks")
# some mossy / cracked bricks so the wall doesn't look flat
for _ in range(90):
    side = rnd.randrange(4)
    t = rnd.randint(-R, R)
    y = rnd.randint(G + 1, H)
    x, z = [(t, -R), (t, R), (-R, t), (R, t)][side]
    setb(x, y, z, rnd.choice(["mossy_stone_bricks", "cracked_stone_bricks"]))
for t in range(-R, R + 1, 2):
    for x, z in ((t, -R), (t, R), (-R, t), (R, t)):
        setb(x, H + 1, z, "stone_bricks")

# --- corner towers ---
TH = G + 19
for sx in (-1, 1):
    for sz in (-1, 1):
        cx, cz = sx * R, sz * R
        fill(cx - 3, G + 1, cz - 3, cx + 3, TH, cz + 3, "stone_bricks", "hollow")
        for t in range(-3, 4, 2):
            for x, z in ((cx + t, cz - 3), (cx + t, cz + 3), (cx - 3, cz + t), (cx + 3, cz + t)):
                setb(x, TH + 1, z, "stone_bricks")
        setb(cx, TH + 1, cz, "lantern")
        for y in (G + 6, G + 12):  # arrow slits
            for x, z in ((cx + 3 * sx, cz), (cx, cz + 3 * sz)):
                setb(x, y, z, "air")
                setb(x, y + 1, z, "air")

# --- gates (south and north) with gate towers ---
for sz in (-1, 1):
    z0, z1 = sz * (R - 1), sz * R
    fill(-3, G + 1, min(z0, z1), 3, G + 6, max(z0, z1), "air")
    fill(-3, G + 7, min(z0, z1), 3, G + 7, max(z0, z1), "chiseled_stone_bricks")
    for gx in (-6, 6):
        fill(gx - 2, G + 1, sz * R - 2, gx + 2, G + 15, sz * R + 2, "stone_bricks", "hollow")
        for t in range(-2, 3, 2):
            for x, z in ((gx + t, sz * R - 2), (gx + t, sz * R + 2), (gx - 2, sz * R + t), (gx + 2, sz * R + t)):
                setb(x, G + 16, z, "stone_bricks")
    for gx in (-3, 3):  # hanging lanterns under the gate arch
        setb(gx, G + 6, sz * R, "lantern[hanging=true]")

# --- fountain in the centre ---
fill(-5, G, -5, 5, G, 5, "stone_bricks")
fill(-4, G + 1, -4, 4, G + 1, 4, "smooth_stone_slab")
fill(-3, G + 1, -3, 3, G + 1, 3, "air")
fill(-3, G, -3, 3, G, 3, "water")
fill(0, G, 0, 0, G + 4, 0, "chiseled_stone_bricks")
setb(0, G + 5, 0, "sea_lantern")
for x, z in ((-1, 0), (1, 0), (0, -1), (0, 1)):
    setb(x, G + 4, z, "stone_brick_slab")

# --- lamp posts along the paths ---
for t in list(range(-24, -7, 8)) + list(range(8, 25, 8)):
    for x, z in ((-4, t), (4, t), (t, -4), (t, 4)):
        fill(x, G + 1, z, x, G + 3, z, "oak_fence")
        setb(x, G + 4, z, "lantern")


# --- four cottages, doors facing the plaza ---
def cottage(cx, cz, door_side, wall, log, roof, roof_slab, bed_color):
    fill(cx - 4, G, cz - 3, cx + 4, G, cz + 3, "spruce_planks")
    fill(cx - 4, G + 1, cz - 3, cx + 4, G + 4, cz + 3, wall, "hollow")
    fill(cx - 3, G + 1, cz - 2, cx + 3, G + 3, cz + 2, "air")
    for x in (cx - 4, cx + 4):
        for z in (cz - 3, cz + 3):
            fill(x, G + 1, z, x, G + 4, z, log)
    # stepped roof
    fill(cx - 5, G + 5, cz - 4, cx + 5, G + 5, cz + 4, roof)
    fill(cx - 4, G + 6, cz - 3, cx + 4, G + 6, cz + 3, roof)
    fill(cx - 3, G + 7, cz - 2, cx + 3, G + 7, cz + 2, roof)
    fill(cx - 2, G + 8, cz - 1, cx + 2, G + 8, cz + 1, roof_slab)
    # door towards the plaza (z side), windows on the x sides
    dz = cz - 3 if door_side == "north" else cz + 3
    setb(cx, G + 1, dz, f"oak_door[facing={door_side},half=lower]")
    setb(cx, G + 2, dz, f"oak_door[facing={door_side},half=upper]")
    setb(cx, G + 3, dz, "lantern")
    for x in (cx - 4, cx + 4):
        fill(x, G + 2, cz - 1, x, G + 3, cz + 1, "glass_pane")
    for x in (cx - 2, cx + 2):
        setb(x, G + 2, dz, "glass_pane")
    # furniture
    back = cz + 2 if door_side == "north" else cz - 2
    setb(cx - 3, G + 1, back, "crafting_table")
    setb(cx - 2, G + 1, back, "furnace")
    setb(cx + 3, G + 1, back, "barrel")
    foot_dir = "north" if door_side == "south" else "south"
    setb(cx + 3, G + 1, cz, f"{bed_color}_bed[facing={foot_dir},part=foot]")
    head_z = cz + 1 if foot_dir == "south" else cz - 1
    setb(cx + 3, G + 1, head_z, f"{bed_color}_bed[facing={foot_dir},part=head]")
    setb(cx - 3, G + 1, cz, "potted_red_tulip")


cottage(-16, -16, "south", "oak_planks", "oak_log", "spruce_planks", "spruce_slab", "red")
cottage(16, -16, "south", "birch_planks", "birch_log", "dark_oak_planks", "dark_oak_slab", "light_blue")
cottage(-16, 16, "north", "spruce_planks", "spruce_log", "dark_oak_planks", "dark_oak_slab", "lime")
cottage(16, 16, "north", "cherry_planks", "cherry_log", "spruce_planks", "spruce_slab", "pink")

# --- gardens: trees and flowers ---
for x, z in ((-24, -8), (24, -8), (-24, 8), (24, 8), (-9, -24), (9, -24), (-9, 24), (9, 24)):
    c(f"place feature minecraft:{rnd.choice(['oak', 'birch', 'fancy_oak'])} {x} {G + 1} {z}")
flowers = ["poppy", "dandelion", "cornflower", "oxeye_daisy", "allium", "pink_tulip", "azure_bluet"]
for _ in range(70):
    sx, sz = rnd.choice((-1, 1)), rnd.choice((-1, 1))
    x, z = sx * rnd.randint(7, 26), sz * rnd.randint(7, 26)
    if abs(abs(x) - 16) <= 5 and abs(abs(z) - 16) <= 4:
        continue  # not inside a cottage
    setb(x, G + 1, z, rnd.choice(flowers))

# --- welcome board between the spawn point (z=16) and the fountain, signs facing the player ---
fill(-2, G + 1, 12, 2, G + 3, 12, "spruce_planks")
lines = [
    ('{text:"CraftMine SMP",color:"gold",bold:true}', '"Xush kelibsiz!"', '""', '{text:"mc.mikuuloves.coffee",color:"aqua"}'),
    ('{text:"/rtp",color:"green",bold:true}', '"tasodifiy joyga"', '"sayohat"', '""'),
    ('{text:"/spawn",color:"green",bold:true}', '"shu qasrga"', '"qaytish"', '""'),
]
for x, msg in zip((-1, 0, 1), lines):
    c("setblock %d %d 13 oak_wall_sign[facing=south]{front_text:{messages:[%s]}}" % (x, G + 2, ",".join(msg)))

# spawn point: south of the board, looking north at it and the fountain behind it
c(f"setworldspawn 0 {G + 1} 16 180")


if __name__ == "__main__":
    if "--run" in sys.argv:
        import mcbuild
        mcbuild.run(cmds)
    else:
        print("\n".join(cmds))
