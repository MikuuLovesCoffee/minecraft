"""Draws the two custom 64x64 skins (MikuuLovesCoffee, xxbabyxv).

Usage: python tools/make_skins.py <output_dir>
"""
import random
import sys
from pathlib import Path

from PIL import Image

T = (0, 0, 0, 0)


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (c[3],)


class Skin:
    def __init__(self, seed):
        self.img = Image.new("RGBA", (64, 64), T)
        self.px = self.img.load()
        self.rnd = random.Random(seed)

    def rect(self, x0, y0, x1, y1, color, noise=0.06):
        for y in range(y0, y1):
            for x in range(x0, x1):
                f = 1 + self.rnd.uniform(-noise, noise)
                self.px[x, y] = shade(color, f)

    def pattern(self, x0, y0, rows, palette):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch in palette and palette[ch] is not None:
                    self.px[x0 + dx, y0 + dy] = palette[ch]

    # Box faces: top, bottom, right, front, left, back for a part of size w x h x d.
    def box(self, u, v, w, h, d, side, top=None, bottom=None, front=None, back=None):
        self.rect(u + d, v, u + d + w, v + d, top or side)              # top
        self.rect(u + d + w, v, u + d + 2 * w, v + d, bottom or side)   # bottom
        self.rect(u, v + d, u + d, v + d + h, side)                     # right
        self.rect(u + d, v + d, u + d + w, v + d + h, front or side)    # front
        self.rect(u + d + w, v + d, u + 2 * d + w, v + d + h, side)     # left
        self.rect(u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h, back or side)  # back

    def save(self, path):
        self.img.save(path)


def boy(out):
    s = Skin(7)
    skin, hair, hair_d = hexc("f2c9a5"), hexc("5b3a29"), hexc("3f271b")
    hoodie, hoodie_d, cup, cup_d = hexc("efe3cf"), hexc("d8c7ab"), hexc("8b5a3c"), hexc("6b4128")
    jeans, shoe = hexc("3b4a6b"), hexc("f5f5f5")

    # Head: hair everywhere, skin on the face
    s.box(0, 0, 8, 8, 8, hair, top=hair, front=skin, back=hair)
    s.pattern(8, 8, [
        "HHHHHHHH",
        "HHhHHhHH",
        "HSHSSHSH",
        "SSSSSSSS",
        "SDWSSDWS",
        "SEESSEES",
        "SBSmmSBS",
        "SSSSSSSS",
    ], {"H": hair, "h": hair_d, "S": skin, "D": hexc("2b1d18"), "W": hexc("ffffff"),
        "E": hexc("6b4a3a"), "B": hexc("f4a3a8"), "m": hexc("c46a5a")})
    # Side hair over the ears
    for x0 in (0, 16):
        s.rect(x0, 8, x0 + 8, 13, hair)
    # Hat layer: fluffy fringe on top and sides
    s.pattern(40, 8, ["HhH  HhH", "h      h"], {"H": hair, "h": hair_d})
    s.rect(40, 0, 48, 8, hair, noise=0.12)

    # Body: cream hoodie with a coffee cup print
    s.box(16, 16, 8, 12, 4, hoodie, top=hoodie_d, bottom=hoodie_d)
    s.pattern(20, 20, [
        "dd    dd",
        " d    d ",
        "  cccc  ",
        "  cCCcc ",
        "  cCCc c",
        "  cccc  ",
        "   cc   ",
        "        ",
        "dddddddd",
        "d      d",
        "dddddddd",
        "        ",
    ], {"d": hoodie_d, "c": cup, "C": cup_d})
    # Arms (classic 4px): hoodie sleeves with skin hands
    for u, v in ((40, 16), (32, 48)):
        s.box(u, v, 4, 12, 4, hoodie, top=hoodie_d)
        s.rect(u, v + 14, u + 16, v + 16, skin)
    # Legs: jeans + white sneakers
    for u, v in ((0, 16), (16, 48)):
        s.box(u, v, 4, 12, 4, jeans, bottom=shoe)
        s.rect(u, v + 13, u + 16, v + 16, shoe)
    s.save(out / "mikuulovescoffee.png")


def girl(out):
    s = Skin(11)
    skin, hair, hair_l, hair_d = hexc("fbd9c4"), hexc("f49ac1"), hexc("ffc2dc"), hexc("d9709f")
    sweater, sweater_d, heart = hexc("ffb8d2"), hexc("f08db3"), hexc("e8456f")
    skirt, sock, shoe = hexc("fff4f8"), hexc("ffffff"), hexc("e35d8f")

    s.box(0, 0, 8, 8, 8, hair, top=hair_l, front=skin, back=hair)
    s.pattern(8, 8, [
        "HHHHHHHH",
        "HLHHHHLH",
        "HHSHHSHH",
        "HSSSSSSH",
        "HDWSSDWH",
        "SPPSSPPS",
        "SBSmmSBS",
        "SSSSSSSS",
    ], {"H": hair, "L": hair_l, "S": skin, "D": hexc("3a1f4a"), "W": hexc("ffffff"),
        "P": hexc("9b6bd6"), "B": hexc("ff9eb5"), "m": hexc("e06c8c")})
    for x0 in (0, 16):
        s.rect(x0, 8, x0 + 8, 16, hair)
    s.rect(24, 8, 32, 16, hair)
    # Hat layer: cat ears on top, long hair down the sides and back
    s.rect(40, 0, 48, 8, T, noise=0)
    s.pattern(40, 0, ["LL    LL", "LH    HL", "        "] + [" " * 8] * 5, {"L": hair_l, "H": hair_d})
    s.pattern(40, 8, ["H      H", "H      H", "H      H", "        "], {"H": hair})
    for x0 in (32, 48):
        s.rect(x0, 8, x0 + 8, 16, hair, noise=0.1)
    s.rect(56, 8, 64, 16, hair, noise=0.1)

    # Body: pink sweater with a heart, white skirt at the bottom
    s.box(16, 16, 8, 12, 4, sweater, top=sweater_d, bottom=skirt)
    s.pattern(20, 20, [
        "ss    ss",
        "        ",
        " hh  hh ",
        "hhhhhhhh",
        "hhhhhhhh",
        " hhhhhh ",
        "  hhhh  ",
        "   hh   ",
        "        ",
        "kkkkkkkk",
        "kkkkkkkk",
        "kkkkkkkk",
    ], {"s": sweater_d, "h": heart, "k": skirt})
    s.rect(16, 29, 40, 32, skirt)
    # Long hair falling down the back of the body (overlay layer)
    s.rect(32, 36, 40, 42, hair)
    # Slim arms (3px)
    for u, v in ((40, 16), (32, 48)):
        s.rect(u + 4, v, u + 7, v + 4, sweater_d)
        s.rect(u + 7, v, u + 10, v + 4, skin)
        s.rect(u, v + 4, u + 14, v + 16, sweater)
        s.rect(u, v + 14, u + 14, v + 16, skin)
    # Legs: white socks, pink shoes
    for u, v in ((0, 16), (16, 48)):
        s.box(u, v, 4, 12, 4, skin, bottom=shoe)
        s.rect(u, v + 8, u + 16, v + 14, sock)
        s.rect(u, v + 14, u + 16, v + 16, shoe)
    s.save(out / "xxbabyxv.png")


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    boy(out)
    girl(out)
    print("skins written to", out)
