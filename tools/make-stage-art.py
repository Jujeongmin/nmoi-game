"""Turn the chosen play-area backgrounds (assets/source/gen/stage-bg/*.png) into game WebPs.

    python tools/make-stage-art.py

Generated with codex in the landing table's painted style (docs/art-style.md); chosen 2026-10-02
from three candidates each. The games lay them under a dark veil so the pieces read first.
Needs Pillow.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source" / "gen" / "stage-bg"
PICKS = {
    "match-a": ROOT / "assets" / "match" / "table.webp",     # onyx velvet, damask, gold piping
    "chef-b": ROOT / "assets" / "chef" / "counter.webp",     # walnut counter, linen corner
}


def main():
    for name, out in PICKS.items():
        im = Image.open(SRC / f"{name}.png").convert("RGB")
        im.thumbnail((720, 1080), Image.LANCZOS)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "WEBP", quality=84, method=4)
        print(f"{out.relative_to(ROOT)}  {im.width}x{im.height}")


if __name__ == "__main__":
    main()
