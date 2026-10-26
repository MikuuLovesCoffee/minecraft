"""HD (256x256) skins for the website + matching 64x64 in-game versions.

- MikuuLovesCoffee: Technoblade's pig-king skin (64x64 reference from Mojang), redrawn in HD
- xxbabyxv: "devil's advocate" by viari (The Skindex), redrawn in HD

Same body proportions as a normal skin, just 4x more (smaller) pixels.
Usage: python tools/hd_skins.py <output_dir> <technoblade_64.png> <devils_advocate_64.png>
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw


K = 4  # HD scale: 64 -> 256

# Every face of every part in the 64x64 layout, as (x, y, w, h). Used for per-face shading.
def faces(u, v, w, h, d):
    return [(u + d, v, w, d), (u + d + w, v, w, d), (u, v + d, d, h), (u + d, v + d, w, h),
            (u + d + w, v + d, d, h), (u + 2 * d + w, v + d, w, h)]

PARTS = {
    "head": (0, 0, 8, 8, 8), "hat": (32, 0, 8, 8, 8),
    "body": (16, 16, 8, 12, 4), "jacket": (16, 32, 8, 12, 4),
    "rarm": (40, 16, 4, 12, 4), "rsleeve": (40, 32, 4, 12, 4),
    "larm": (32, 48, 4, 12, 4), "lsleeve": (48, 48, 4, 12, 4),
    "rleg": (0, 16, 4, 12, 4), "rpants": (0, 32, 4, 12, 4),
    "lleg": (16, 48, 4, 12, 4), "lpants": (0, 48, 4, 12, 4),
}


def hdify(img64, seed, noise=0.05, light=0.10):
    """Upscale 4x and give every face fine texture: per-pixel grain, a soft top-light gradient and darker edges."""
    rnd = random.Random(seed)
    hd = img64.resize((64 * K, 64 * K), Image.NEAREST)
    px = hd.load()
    for (u, v, w, h, d) in PARTS.values():
        for (fx, fy, fw, fh) in faces(u, v, w, h, d):
            x0, y0, x1, y1 = fx * K, fy * K, (fx + fw) * K, (fy + fh) * K
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = px[x, y]
                    if a == 0:
                        continue
                    t = (y - y0) / max(1, y1 - y0 - 1)
                    f = 1 + light * (0.5 - t) + rnd.uniform(-noise, noise)
                    if x in (x0, x1 - 1) or y in (y0, y1 - 1):
                        f *= 0.9
                    px[x, y] = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)), a)
    return hd


def dot(d, x, y, r, color):
    d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def technoblade(ref_path, out):
    ref = Image.open(ref_path).convert("RGBA")
    ref.save(out / "mikuulovescoffee-64.png")  # in-game version: the original skin
    hd = hdify(ref, 1)
    d = ImageDraw.Draw(hd)
    hx, hy = 8 * K, 8 * K  # head front origin
    # Shiny eyes: keep the dark pupils, add a white glint and a soft lower lash line
    for (ex, ey) in ((9.5, 11.5), (14.5, 11.5)):
        cx, cy = hx + (ex - 8) * K, hy + (ey - 8) * K
        dot(d, cx - 1, cy - 1, 1, (255, 255, 255, 255))
    # Snout: a rounded darker oval with two nostrils
    sx0, sy0 = hx + 2.5 * K, hy + 5 * K
    d.rounded_rectangle((sx0, sy0, sx0 + 3 * K, sy0 + 2 * K), radius=3, fill=(222, 128, 140, 255), outline=(190, 100, 112, 255))
    dot(d, sx0 + 0.9 * K, sy0 + 1 * K, 1.5, (120, 50, 60, 255))
    dot(d, sx0 + 2.1 * K, sy0 + 1 * K, 1.5, (120, 50, 60, 255))
    # Blush
    for bx in (hx + 1 * K, hx + 6.2 * K):
        d.ellipse((bx, hy + 5.6 * K, bx + 0.8 * K, hy + 6.2 * K), fill=(240, 140, 150, 160))
    # Crown band (hat layer, rows 8-9 all around): add gem highlights
    for x in range(32 * K, 64 * K):
        for y in range(8 * K, 10 * K + 2):
            r, g, b, a = hd.getpixel((x, y))
            if a and r > 200 and g > 180 and b < 120 and (x + y) % 7 == 0:  # gold: sparkle
                hd.putpixel((x, y), (255, 250, 200, 255))
            elif a and (b > 150 or (r > 150 and g < 80)) and (x % K == 1 and y % K == 1):  # gems: glint
                hd.putpixel((x, y), (255, 255, 255, 255))
    # Gold buttons on the shirt get a highlight
    for x in range(20 * K, 28 * K):
        for y in range(20 * K, 32 * K):
            r, g, b, a = hd.getpixel((x, y))
            if a and r > 230 and g > 200 and b < 80 and x % K == 1 and y % K == 1:
                hd.putpixel((x, y), (255, 255, 220, 255))
    hd.save(out / "mikuulovescoffee.png")


def from_reference(ref_path, out, name, seed):
    """HD version of a downloaded 64x64 skin: same design, 4x finer pixels with grain and shading."""
    ref = Image.open(ref_path).convert("RGBA")
    ref.save(out / f"{name}-64.png")
    hdify(ref, seed).save(out / f"{name}.png")


if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    technoblade(sys.argv[2], out)
    from_reference(sys.argv[3], out, "xxbabyxv", 2)
    print("written to", out)
