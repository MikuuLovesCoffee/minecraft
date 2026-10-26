"""Builds the kit-arena colosseum (arena world) and the PvP pit (SMP world, north of the castle).

Run on the server:  python3 arenas_build.py --run
"""
import math
import random
import sys

from mcbuild import Build

rnd = random.Random(7)

# ---------------- colosseum in the flat arena world (grass top at y=-61) ----------------
A = Build("minecraft:arena")
F = -61  # floor level
for y in range(F + 1, -29, 3):
    A.fill(-48, y, -48, 48, min(y + 2, -30), 48, "air")
A.ring(0, 0, 0, 29.5, F, F, "smooth_sandstone")
A.ring(0, 0, 13.5, 14.5, F, F, "cut_red_sandstone")
A.ring(0, 0, 0, 3.5, F, F, "chiseled_sandstone")
A.ring(0, 0, 0, 1.5, F, F, "red_sandstone")
# arena wall and its top
A.ring(0, 0, 29.5, 31.5, F, F + 6, "stone_bricks")
A.ring(0, 0, 29.5, 31.5, F + 7, F + 7, "chiseled_stone_bricks")
# spectator tiers rising outwards
for i in range(4):
    top = F + 7 + i
    A.ring(0, 0, 31.5 + 2 * i, 33.5 + 2 * i, F, top - 1, "stone_bricks")
    A.ring(0, 0, 31.5 + 2 * i, 33.5 + 2 * i, top, top, "polished_andesite")
A.ring(0, 0, 39.5, 41.5, F, F + 14, "stone_bricks")
for deg in range(0, 360, 20):
    a = math.radians(deg)
    A.setb(round(30.5 * math.cos(a)), F + 8, round(30.5 * math.sin(a)), "lantern")
    A.setb(round(40.5 * math.cos(a)), F + 15, round(40.5 * math.sin(a)), "lantern")
# cover: 6 pillars and 4 low walls
for deg in range(0, 360, 60):
    a = math.radians(deg + 30)
    x, z = round(17 * math.cos(a)), round(17 * math.sin(a))
    A.fill(x, F + 1, z, x + 1, F + 4, z + 1, "stone_bricks")
    for _ in range(3):
        A.setb(x + rnd.randint(0, 1), F + rnd.randint(1, 4), z + rnd.randint(0, 1), "mossy_stone_bricks")
    A.setb(x, F + 5, z, "lantern")
for x1, z1, x2, z2 in ((-1, 8, 1, 8), (-1, -8, 1, -8), (8, -1, 8, 1), (-8, -1, -8, 1)):
    A.fill(x1, F + 1, z1, x2, F + 2, z2, "stone_brick_wall")
A.c("worldborder center 0 0")
A.c("worldborder set 84")
A.c("setworldspawn 0 -60 0")

# ---------------- PvP pit in the SMP world, north of the castle ----------------
P = Build("minecraft:overworld")
G, CZ = 69, -100
for y in range(G + 1, 111, 10):
    P.fill(-26, y, CZ - 26, 26, min(y + 9, 110), CZ + 26, "air")
P.fill(-26, 55, CZ - 26, 26, 61, CZ + 26, "stone")
P.fill(-26, 62, CZ - 26, 26, 68, CZ + 26, "dirt")
P.fill(-26, G, CZ - 26, 26, G, CZ + 26, "grass_block")
# path from the castle's north gate
P.fill(-2, G + 1, CZ + 26, 2, G + 11, -48, "air")
P.fill(-2, 60, CZ + 26, 2, G - 1, -48, "dirt")
P.fill(-2, G, CZ + 15, 2, G, -48, "dirt_path")
# pit floor, wall, entrance facing the castle
P.ring(0, CZ, 0, 13.5, G, G, "coarse_dirt")
for _ in range(60):
    a, r = rnd.uniform(0, 2 * math.pi), 13 * math.sqrt(rnd.random())
    P.setb(round(r * math.cos(a)), G, CZ + round(r * math.sin(a)), rnd.choice(["gravel", "packed_mud", "rooted_dirt"]))
P.ring(0, CZ, 13.5, 15.5, G + 1, G + 4, "stone_bricks")
P.ring(0, CZ, 13.5, 15.5, G + 5, G + 5, "chiseled_stone_bricks")
P.fill(-1, G + 1, CZ + 13, 1, G + 3, CZ + 16, "air")
for deg in range(0, 360, 30):
    a = math.radians(deg)
    P.setb(round(14.5 * math.cos(a)), G + 6, CZ + round(14.5 * math.sin(a)), "lantern")
for x in (-3, 3):
    P.fill(x, G + 1, CZ + 17, x, G + 3, CZ + 17, "stone_brick_wall")
    P.setb(x, G + 4, CZ + 17, "lantern")

if __name__ == "__main__":
    if "--run" in sys.argv:
        import mcbuild
        mcbuild.run(A.cmds + P.cmds)
    else:
        print("\n".join(A.cmds + P.cmds))
