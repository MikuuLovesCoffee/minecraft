"""Isometric preview of the spawn castle, simulated from the same commands spawn_castle.py sends.

Usage: python tools/castle_preview.py <out.png>
"""
import re
import sys

from PIL import Image, ImageDraw

import spawn_castle

COLORS = {
    "grass_block": (95, 159, 53), "dirt_path": (148, 122, 65), "dirt": (134, 96, 67), "stone": (125, 125, 125),
    "polished_andesite": (132, 135, 134), "stone_bricks": (122, 121, 122), "mossy_stone_bricks": (105, 120, 90),
    "cracked_stone_bricks": (110, 108, 108), "chiseled_stone_bricks": (118, 117, 118), "smooth_stone_slab": (160, 160, 160),
    "stone_brick_slab": (122, 121, 122), "water": (52, 92, 210), "sea_lantern": (190, 220, 210), "lantern": (240, 190, 90),
    "oak_fence": (162, 130, 78), "spruce_planks": (115, 85, 49), "oak_planks": (162, 130, 78), "birch_planks": (196, 179, 123),
    "cherry_planks": (226, 178, 172), "dark_oak_planks": (66, 43, 20), "oak_log": (109, 85, 50), "birch_log": (216, 215, 210),
    "spruce_log": (58, 37, 16), "cherry_log": (54, 33, 44), "spruce_slab": (115, 85, 49), "dark_oak_slab": (66, 43, 20),
    "glass_pane": (190, 220, 230), "oak_door": (140, 110, 60), "crafting_table": (120, 80, 50), "furnace": (100, 100, 100),
    "barrel": (130, 95, 55), "oak_wall_sign": (180, 150, 90),
}
FLOWER = (230, 80, 120)


def simulate():
    world = {}
    for cmd in spawn_castle.cmds:
        body = cmd.split(" run ", 1)[1]
        m = re.match(r"fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) ([a-z_]+)\S*\s*(hollow)?", body)
        if m:
            x1, y1, z1, x2, y2, z2 = map(int, m.groups()[:6])
            block, hollow = m.group(7), m.group(8)
            for x in range(min(x1, x2), max(x1, x2) + 1):
                for y in range(min(y1, y2), max(y1, y2) + 1):
                    for z in range(min(z1, z2), max(z1, z2) + 1):
                        edge = x in (x1, x2) or y in (y1, y2) or z in (z1, z2)
                        b = "air" if hollow and not edge else block
                        if b == "air":
                            world.pop((x, y, z), None)
                        elif y >= 62:  # only what's visible near the surface
                            world[(x, y, z)] = b
            continue
        m = re.match(r"setblock (-?\d+) (-?\d+) (-?\d+) ([a-z_]+)", body)
        if m:
            x, y, z = map(int, m.groups()[:3])
            if m.group(4) == "air":
                world.pop((x, y, z), None)
            else:
                world[(x, y, z)] = m.group(4)
        m = re.match(r"place feature minecraft:\S+ (-?\d+) (-?\d+) (-?\d+)", body)
        if m:  # rough tree: trunk + leaf ball
            x, y, z = map(int, m.groups())
            for dy in range(5):
                world[(x, y + dy, z)] = "oak_log"
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    for dy in range(3, 7):
                        if abs(dx) + abs(dz) + abs(dy - 5) < 4 and (dx, dz) != (0, 0) or dy == 6:
                            world[(x + dx, y + dy, z + dz)] = "leaves"
    return world


def render(world, out, s=5):
    W, H = 1300, 900
    img = Image.new("RGB", (W, H), (150, 190, 235))
    d = ImageDraw.Draw(img)
    ox, oy = W // 2, 300
    # draw back to front: larger (x + z) is closer to the viewer
    for (x, y, z) in sorted(world, key=lambda p: (p[0] + p[2], p[1])):
        b = world[(x, y, z)]
        col = (60, 140, 50) if b == "leaves" else COLORS.get(b, FLOWER)
        sx = ox + (x - z) * s
        sy = oy + (x + z) * s // 2 - (y - 69) * s
        top = [(sx, sy - s // 2), (sx + s, sy), (sx, sy + s // 2), (sx - s, sy)]
        left = [(sx - s, sy), (sx, sy + s // 2), (sx, sy + s // 2 + s), (sx - s, sy + s)]
        right = [(sx + s, sy), (sx, sy + s // 2), (sx, sy + s // 2 + s), (sx + s, sy + s)]
        d.polygon(left, fill=tuple(int(v * 0.72) for v in col))
        d.polygon(right, fill=tuple(int(v * 0.86) for v in col))
        d.polygon(top, fill=col)
    img.save(out)


if __name__ == "__main__":
    render(simulate(), sys.argv[1] if len(sys.argv) > 1 else "castle.png")
