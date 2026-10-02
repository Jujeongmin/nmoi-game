"""Cut the generated landing light (assets/source/gen/landing-fx.png) into WebPs.

    python tools/make-landing-art.py

landing-fx.png (GPT image generation via codex, transparent): left half a four-pointed glint like
the sparkles painted on the table, right half a warm candle halo. landing/motion.js places them on
the table picture. Soft edges are the point here, so only alpha below 4 is dropped.
Needs Pillow and numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source" / "gen" / "landing-fx.png"
OUT = ROOT / "assets" / "landing"


def main():
    a = np.array(Image.open(SRC).convert("RGBA"))
    a[a[..., 3] < 4] = 0
    im = Image.fromarray(a)
    half = im.width // 2
    for name, box in (("glint", (0, 0, half, im.height)), ("candle", (half, 0, im.width, im.height))):
        piece = im.crop(box)
        piece = piece.crop(piece.getbbox())
        piece.thumbnail((256, 256), Image.LANCZOS)
        piece.save(OUT / f"{name}.webp", "WEBP", quality=90, method=4)
        print(f"assets/landing/{name}.webp  {piece.width}x{piece.height}")


if __name__ == "__main__":
    main()
