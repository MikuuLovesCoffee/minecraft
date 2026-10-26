"""Draws a set of cute skin options (4 boy, 4 girl) plus a labelled preview sheet.

Usage: python tools/skin_options.py <output_dir>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from make_skins import T, Skin, hexc, shade


def face(s, skin, hair, eyes, mouth="c46a5a", blush="f4a3a8", long=False, lashes=False):
    H, S = hair, hexc(skin)
    s.pattern(8, 8, [
        "HHHHHHHH",
        "HHHHHHHH",
        "HSHSSHSH" if not long else "HHSHHSHH",
        "SSSSSSSS" if not long else "HSSSSSSH",
        ("SDWSSDWS" if not lashes else "HDWSSDWH") if long else "SDWSSDWS",
        "SEESSEES" if not long else "SEESSEES",
        "SBSmmSBS",
        "SSSSSSSS",
    ], {"H": H, "S": S, "D": hexc("2b1d28"), "W": hexc("ffffff"), "E": hexc(eyes),
        "B": hexc(blush), "m": hexc(mouth)})


def body_print(s, rows, palette):
    s.pattern(20, 20, rows, palette)


def build(spec, out):
    s = Skin(hash(spec["id"]) & 0xFFFF)
    skin = hexc(spec["skin"])
    hair, hair_l, hair_d = hexc(spec["hair"]), shade(hexc(spec["hair"]), 1.25), shade(hexc(spec["hair"]), 0.75)
    top, top_d = hexc(spec["top"]), shade(hexc(spec["top"]), 0.85)
    pants, shoes = hexc(spec["pants"]), hexc(spec["shoes"])
    slim, long = spec["slim"], spec["long"]

    # Head
    s.box(0, 0, 8, 8, 8, hair, top=hair_l if long else hair, front=skin, back=hair)
    face(s, spec["skin"], hair, spec["eyes"], long=long, lashes=slim)
    for x0 in (0, 16):
        s.rect(x0, 8, x0 + 8, 16 if long else 13, hair)
    if long:  # hair volume on the hat layer, falling past the shoulders
        s.rect(32, 8, 40, 16, hair, noise=0.1)
        s.rect(48, 8, 56, 16, hair, noise=0.1)
        s.rect(56, 8, 64, 16, hair, noise=0.1)
        s.pattern(40, 8, ["H      H", "H      H", "H      H"], {"H": hair})
        s.rect(32, 36, 40, 42, hair)

    # Body
    s.box(16, 16, 8, 12, 4, top, top=top_d, bottom=pants if not spec.get("skirt") else hexc(spec["skirt"]))
    if spec.get("print"):
        body_print(s, *spec["print"])
    if spec.get("skirt"):
        s.rect(16, 29, 40, 32, hexc(spec["skirt"]))

    # Arms
    if slim:
        for u, v in ((40, 16), (32, 48)):
            s.rect(u + 4, v, u + 7, v + 4, top_d)
            s.rect(u + 7, v, u + 10, v + 4, skin)
            s.rect(u, v + 4, u + 14, v + 16, top)
            s.rect(u, v + 14, u + 14, v + 16, skin)
    else:
        for u, v in ((40, 16), (32, 48)):
            s.box(u, v, 4, 12, 4, top, top=top_d)
            s.rect(u, v + 14, u + 16, v + 16, skin)

    # Legs
    for u, v in ((0, 16), (16, 48)):
        legs = skin if spec.get("skirt") else pants
        s.box(u, v, 4, 12, 4, legs, bottom=shoes)
        if spec.get("socks"):
            s.rect(u, v + 8, u + 16, v + 14, hexc(spec["socks"]))
        s.rect(u, v + 13, u + 16, v + 16, shoes)

    # Accessories on the hat layer (top face = 40..48 x 0..8, front = 40..48 x 8..16)
    acc = spec.get("acc")
    if acc == "cat_ears":
        s.pattern(40, 0, ["LL    LL", "LH    HL"], {"L": hair_l, "H": hair_d})
    elif acc == "bunny_ears":
        w, p = hexc("ffffff"), hexc("ffb3c7")
        s.pattern(40, 0, [" WW  WW ", " WP  PW ", " WP  PW ", " WW  WW "], {"W": w, "P": p})
    elif acc == "bow":
        r = hexc(spec.get("acc_color", "e8456f"))
        s.pattern(40, 8, ["      RR", "     RRR", "      RR"], {"R": r})
    elif acc == "headphones":
        k, c = hexc("2b2b38"), hexc(spec.get("acc_color", "4aedd9"))
        s.rect(40, 0, 48, 2, k)
        s.pattern(40, 8, ["K      K", "K      K", "C      C", "C      C", "K      K"], {"K": k, "C": c})
        s.rect(32, 10, 34, 14, c)
        s.rect(54, 10, 56, 14, c)
    elif acc == "glasses":
        g = hexc("1c1c24")
        s.pattern(40, 8, ["", "", "", "", "GGG  GGG", " G GG G "], {"G": g})
    elif acc == "frog_hood":
        gr, gd, w, k = hexc("6cc24a"), hexc("4e9a34"), hexc("ffffff"), hexc("1c1c24")
        s.rect(40, 0, 48, 8, gr)
        s.pattern(40, 0, ["WW    WW", "WK    KW"], {"W": w, "K": k})
        s.pattern(40, 8, ["GGGGGGGG", "G      G", "G      G", "G      G", "g      g"], {"G": gr, "g": gd})
        s.rect(32, 8, 40, 16, gr)
        s.rect(48, 8, 56, 16, gr)
        s.rect(56, 8, 64, 16, gr)
    elif acc == "beret":
        r, rd = hexc("d6334a"), hexc("a82237")
        s.rect(40, 0, 48, 8, r)
        s.pattern(40, 8, ["RRRRRRRR", "rrrrrrr "], {"R": r, "r": rd})
        s.rect(32, 8, 40, 10, r)
        s.rect(48, 8, 56, 10, r)
        s.rect(56, 8, 64, 10, r)

    path = out / f"{spec['id']}.png"
    s.save(path)
    return path


HEART = (["        ", "        ", " hh  hh ", "hhhhhhhh", "hhhhhhhh", " hhhhhh ", "  hhhh  ", "   hh   "], )
STAR = ["        ", "   yy   ", "   yy   ", "yyyyyyyy", " yyyyyy ", "  yyyy  ", " yy  yy ", "y      y"]
CUP = ["        ", "        ", "  cccc  ", "  cCCcc ", "  cCCc c", "  cccc  ", "   cc   "]

SPECS = [
    # --- for MikuuLovesCoffee ---
    {"id": "boy1-coffee", "label": "B1 Coffee hoodie", "skin": "f2c9a5", "hair": "5b3a29", "eyes": "6b4a3a",
     "top": "efe3cf", "pants": "3b4a6b", "shoes": "f5f5f5", "slim": False, "long": False,
     "print": (CUP, {"c": hexc("8b5a3c"), "C": hexc("6b4128")})},
    {"id": "boy2-gamer", "label": "B2 Gamer + headphones", "skin": "f0c8a8", "hair": "1f1b24", "eyes": "3a6bd6",
     "top": "2d3a6e", "pants": "1f2233", "shoes": "e8e8f0", "slim": False, "long": False, "acc": "headphones",
     "acc_color": "4aedd9", "print": (STAR, {"y": hexc("ffd84a")})},
    {"id": "boy3-frog", "label": "B3 Frog hoodie", "skin": "f5cfae", "hair": "e8c46a", "eyes": "3d8f4a",
     "top": "6cc24a", "pants": "5a4636", "shoes": "ffffff", "slim": False, "long": False, "acc": "frog_hood"},
    {"id": "boy4-glasses", "label": "B4 Silver hair + glasses", "skin": "f2d0b8", "hair": "d8dbe6", "eyes": "7a5cc4",
     "top": "6b4bb3", "pants": "2a2a35", "shoes": "1c1c24", "slim": False, "long": False, "acc": "glasses"},
    # --- for xxbabyxv ---
    {"id": "girl1-catpink", "label": "G1 Pink cat ears", "skin": "fbd9c4", "hair": "f49ac1", "eyes": "9b6bd6",
     "top": "ffb8d2", "pants": "fff4f8", "shoes": "e35d8f", "slim": True, "long": True, "acc": "cat_ears",
     "skirt": "fff4f8", "socks": "ffffff", "print": (HEART[0], {"h": hexc("e8456f")})},
    {"id": "girl2-bow", "label": "G2 Black hair + red bow", "skin": "fbdcc8", "hair": "1f1a22", "eyes": "c23b4e",
     "top": "f7f7fb", "pants": "c23b4e", "shoes": "2b2b38", "slim": True, "long": True, "acc": "bow",
     "acc_color": "e8456f", "skirt": "c23b4e", "socks": "ffffff"},
    {"id": "girl3-bunny", "label": "G3 Bunny ears lavender", "skin": "fde0cf", "hair": "f3d27a", "eyes": "4a8fd6",
     "top": "c9b3f2", "pants": "efe6ff", "shoes": "ffffff", "slim": True, "long": True, "acc": "bunny_ears",
     "skirt": "efe6ff", "socks": "ffffff", "print": (HEART[0], {"h": hexc("ff9ec4")})},
    {"id": "girl4-strawberry", "label": "G4 Strawberry beret", "skin": "f7d4bd", "hair": "7a4a2e", "eyes": "3d8f4a",
     "top": "e8455a", "pants": "e8455a", "shoes": "6b3a2a", "slim": True, "long": True, "acc": "beret",
     "skirt": "e8455a", "socks": "ffffff"},
]


def front(path, slim, scale=8):
    s = Image.open(path).convert("RGBA")
    aw = 3 if slim else 4
    p = Image.new("RGBA", (8 + 2 * aw, 32), T)
    p.alpha_composite(s.crop((8, 8, 16, 16)), (aw, 0))
    p.alpha_composite(s.crop((40, 8, 48, 16)), (aw, 0))
    p.alpha_composite(s.crop((20, 20, 28, 32)), (aw, 8))
    p.alpha_composite(s.crop((44, 20, 44 + aw, 32)), (0, 8))
    p.alpha_composite(s.crop((36, 52, 36 + aw, 64)), (aw + 8, 8))
    p.alpha_composite(s.crop((4, 20, 8, 32)), (aw, 20))
    p.alpha_composite(s.crop((20, 52, 24, 64)), (aw + 4, 20))
    return p.resize((p.width * scale, p.height * scale), Image.NEAREST)


def sheet(paths, out):
    cell_w, cell_h = 180, 310
    img = Image.new("RGBA", (cell_w * 4 + 40, cell_h * 2 + 100), (30, 22, 64, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 12), "Boy options (MikuuLovesCoffee)", fill=(74, 237, 217, 255))
    d.text((20, cell_h + 56), "Girl options (xxbabyxv)", fill=(255, 126, 182, 255))
    for i, (spec, path) in enumerate(zip(SPECS, paths)):
        row, col = divmod(i, 4)
        f = front(path, spec["slim"])
        x = 20 + col * cell_w + (cell_w - f.width) // 2
        y = 36 + row * (cell_h + 44)
        img.alpha_composite(f, (x, y))
        d.text((20 + col * cell_w + 10, y + f.height + 8), spec["label"], fill=(236, 232, 255, 255))
    img.save(out / "options-preview.png")


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    paths = [build(spec, out) for spec in SPECS]
    sheet(paths, out)
    print("written:", ", ".join(p.name for p in paths), "+ options-preview.png")
