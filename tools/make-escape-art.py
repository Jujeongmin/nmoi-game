"""Cut the generated Caviar Escape art (assets/source/gen/escape-*) into game WebPs.

    python tools/make-escape-art.py [bg] [fx] [menu]     (default: all)

The raw sheets come from GPT image generation (codex exec, see docs/art-style.md):
  escape-bg/base.png     the background without kelp, rays or bubbles
  escape-bg/layers.png   3 columns: left kelp · light rays · right kelp (transparent)
  escape-fx/sheet-fx.png 4 x 3 grid of effect sprites (transparent)
  escape-fx/sheet-menu.png 4 x 2 grid of menu-card ornaments in the campaign's look (thin gold line
                         art, garnet, wax seal) — they replace the glossy pieces of the first sheet

Writes assets/escape/bg/*.webp and assets/escape/fx/*.webp. Needs Pillow and numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "assets" / "source" / "gen"
OUT_BG = ROOT / "assets" / "escape" / "bg"
OUT_FX = ROOT / "assets" / "escape" / "fx"
OUT_MENU = ROOT / "assets" / "menu"     # menu-card ornaments shared by all games

# Faint alpha noise around glows (the generator leaves coloured specks) is cut below this.
ALPHA_FLOOR = 28

# None: on the sheet but not used (glossy casual-game pieces replaced by sheet-menu, the shield was cut).
FX_GRID = ["pearl", "twinkle", "bubble", None,
           None, None, "glow", None,
           None, None, "confetti", "pearl-burst"]
FX_SIZE = {"glow": 192}   # longest side; default 128

MENU_GRID = ["warn", "chevron", "reticle", "seal",
             "sparks", "gold-leaf", "divider", "ring"]
MENU_SIZE = {"seal": 192, "divider": 360, "ring": 256, "sparks": 192}



def clean(im):
    """Drop alpha specks and the colour hidden under fully transparent pixels."""
    a = np.array(im.convert("RGBA"))
    alpha = a[..., 3]
    alpha[alpha < ALPHA_FLOOR] = 0
    a[alpha == 0, :3] = 0
    return Image.fromarray(a)


def trim(im, pad=4):
    box = im.getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def fit(im, longest):
    k = longest / max(im.size)
    if k >= 1:
        return im
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def save(im, path, quality=88):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=4)
    print(f"{path.relative_to(ROOT)}  {im.width}x{im.height}")


def main(parts):
    if "bg" in parts:
        _bg()
    if "fx" in parts:
        _fx()
    if "menu" in parts:
        _menu()


def _bg():
    # Background (the renderer dims it a little so sharks, pearls and members read on top).
    base = Image.open(GEN / "escape-bg" / "base.png").convert("RGB")
    save(fit(base, 1080), OUT_BG / "base.webp", quality=84)

    layers = clean(Image.open(GEN / "escape-bg" / "layers.png"))
    w3 = layers.width // 3
    for i, name in enumerate(["kelp-left", "rays", "kelp-right"]):
        part = trim(layers.crop((i * w3, 0, (i + 1) * w3, layers.height)))
        save(fit(part, 720), OUT_BG / f"{name}.webp")


def _fx():
    fx = clean(Image.open(GEN / "escape-fx" / "sheet-fx.png"))
    cw, ch = fx.width // 4, fx.height // 3
    for i, name in enumerate(FX_GRID):
        if not name:
            continue
        cell = fx.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        save(fit(trim(cell), FX_SIZE.get(name, 128)), OUT_FX / f"{name}.webp")


def _menu():
    sheet = clean(Image.open(GEN / "escape-fx" / "sheet-menu.png"))
    cw, ch = sheet.width // 4, sheet.height // 2
    for i, name in enumerate(MENU_GRID):
        cell = sheet.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        out = OUT_MENU if name in ("seal", "divider", "gold-leaf", "ring") else OUT_FX   # shared by every game
        save(fit(trim(cell), MENU_SIZE.get(name, 128)), out / f"{name}.webp")


if __name__ == "__main__":
    main(sys.argv[1:] or ["bg", "fx", "menu"])
