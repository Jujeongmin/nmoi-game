"""Cut the generated Caviar Escape art (assets/source/gen/escape-*) into game WebPs.

    python tools/make-escape-art.py [bg] [fx] [ui]     (default: all)

The raw sheets come from GPT image generation (codex exec, see docs/art-style.md):
  escape-bg/base.png     the background without kelp, rays or bubbles
  escape-bg/layers.png   3 columns: left kelp · light rays · right kelp (transparent)
  escape-fx/sheet-fx.png 4 x 3 grid of effect sprites (transparent)
  escape-fx/sheet-ui.png banner / badge / medallion / 3 2 1 GO! (transparent, free layout)

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

# Faint alpha noise around glows (the generator leaves coloured specks) is cut below this.
ALPHA_FLOOR = 28

FX_GRID = ["pearl", "twinkle", "bubble", "ring",
           "impact", None, "glow", "warn",          # None: drawn but not used (the shield was cut)
           "reticle", "chevron", "confetti", "pearl-burst"]
FX_SIZE = {"ring": 256, "glow": 192, "impact": 192}   # longest side; default 128

# sheet-ui.png pieces (left, top, right, bottom) — the generated layout is fixed, the islands touch.
UI_BOXES = {
    "banner": (20, 10, 1004, 232),
    "badge": (70, 250, 650, 456),
    "medallion": (652, 210, 956, 520),
    "n3": (236, 508, 448, 756),
    "n2": (572, 508, 796, 756),
    "n1": (186, 764, 384, 1004),
    "go": (416, 764, 912, 1004),
}
UI_SIZE = {"banner": 720, "badge": 360, "medallion": 192, "go": 360}   # default 240


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
    if "ui" in parts:
        _ui()


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


def _ui():
    ui_path = GEN / "escape-fx" / "sheet-ui.png"
    if ui_path.exists():
        ui = clean(Image.open(ui_path))
        for name, box in UI_BOXES.items():
            save(fit(trim(ui.crop(box)), UI_SIZE.get(name, 240)), OUT_FX / f"{name}.webp")


if __name__ == "__main__":
    main(sys.argv[1:] or ["bg", "fx", "ui"])
