"""Generate game art with the OpenAI Images API (same photographic look as the landing art).

    set OPENAI_API_KEY first (never commit it), then:
    python tools/gen-art.py                 # every item that has no file yet
    python tools/gen-art.py shark cracker   # only these (regenerates them)
    python tools/gen-art.py --list          # show the items

Writes the raw PNG to assets/source/gen/<id>.png and a trimmed, resized WebP to the
item's `out` path. Needs Pillow. Model: OPENAI_IMAGE_MODEL (default gpt-image-1).
Every image costs money on your OpenAI account (roughly $0.04-0.25 each by quality).
"""
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "source" / "gen"

STYLE = (
    "Photorealistic studio food photography, luxury fine-dining restaurant, soft warm key light, "
    "subtle shadow, ivory and gold palette, isolated object on a fully transparent background, "
    "no text, no logo, no hands, no people"
)
CUTE = (
    "cute chibi mobile-game illustration, clean dark-navy outlines, soft cel shading with glossy highlights, "
    "rounded friendly shapes, warm ivory and gold accents, isolated on a fully transparent background, "
    "no text, no logo, no faces on food"
)
TOP = "Seen from directly above (top-down, flat lay), centred, filling about 80% of the frame. "

ITEMS = {
    # Caviar Master Chef — cute illustration set in the shark's style (top-down, they sit on the plate)
    "plate": dict(out="assets/chef/plate.webp", px=640, style=CUTE,
                  prompt=TOP + "An empty round ivory porcelain plate with a thin gold rim."),
    "signature": dict(out="assets/chef/signature.webp", px=320, style=CUTE,
                      prompt=TOP + "An empty small round black caviar dish with a pearly iridescent rim."),
    "cracker": dict(out="assets/chef/cracker.webp", px=256, style=CUTE,
                    prompt=TOP + "One round golden cracker with little docking holes."),
    "cream": dict(out="assets/chef/cream.webp", px=256, style=CUTE,
                  prompt=TOP + "One soft swirl dollop of white cream."),
    "lemon": dict(out="assets/chef/lemon.webp", px=256, style=CUTE,
                  prompt=TOP + "One round slice of bright yellow lemon."),
    "herb": dict(out="assets/chef/herb.webp", px=256, style=CUTE,
                 prompt=TOP + "One small sprig of green dill."),
    "salmon": dict(out="assets/chef/salmon.webp", px=256, style=CUTE,
                   prompt=TOP + "One folded rose of pink smoked salmon."),
    "caviar-almas": dict(out="assets/chef/caviar-almas.webp", px=192, style=CUTE,
                        prompt=TOP + "A small neat mound of pale ivory-white caviar pearls."),
    "caviar-imperial": dict(out="assets/chef/caviar-imperial.webp", px=192, style=CUTE,
                        prompt=TOP + "A small neat mound of olive-green caviar pearls."),
    "caviar-classic": dict(out="assets/chef/caviar-classic.webp", px=192, style=CUTE,
                        prompt=TOP + "A small neat mound of glossy black caviar pearls."),
    "caviar-platinum": dict(out="assets/chef/caviar-platinum.webp", px=192, style=CUTE,
                        prompt=TOP + "A small neat mound of golden amber caviar pearls."),
    # Caviar Escape — the shark: a cute character, side view, facing right (+x); the game rotates
    # it to its heading and flips it when it swims left, so the fin stays on top.
    "shark": dict(out="assets/escape/shark.webp", px=384,
                  prompt="A cute chibi-style shark character mascot for a casual mobile game, side view, body "
                         "horizontal and facing right, full body visible, round chubby body, big shiny friendly "
                         "eyes, small smile with a couple of tiny rounded teeth, soft slate-blue and grey with a "
                         "cream belly, a small gold bow tie, clean soft cel shading, centred",
                  style="clean cel-shaded character art for a mobile game, isolated on a fully transparent "
                        "background, no text, no logo"),
}


def generate(prompt):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY is not set (see README: Game art).")
    body = json.dumps({
        "model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"),
        "prompt": prompt,
        "size": "1024x1024",
        "background": "transparent",
        "output_format": "png",
        "quality": os.environ.get("OPENAI_IMAGE_QUALITY", "medium"),
        "n": 1,
    }).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body, headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit("OpenAI error %s: %s" % (e.code, e.read().decode(errors="replace")[:400]))
    return base64.b64decode(data["data"][0]["b64_json"])


def finish(raw_png, out, px):
    im = Image.open(raw_png).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    im.thumbnail((px, px), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=88, method=6)


def main(args):
    if "--list" in args:
        for k, v in ITEMS.items():
            print("%-10s %s %s" % (k, v["out"], "(exists)" if (ROOT / v["out"]).exists() else ""))
        return
    names = [a for a in args if not a.startswith("-")] or [k for k, v in ITEMS.items() if not (ROOT / v["out"]).exists()]
    unknown = [n for n in names if n not in ITEMS]
    if unknown:
        sys.exit("unknown item(s): " + ", ".join(unknown))
    RAW.mkdir(parents=True, exist_ok=True)
    for name in names:
        item = ITEMS[name]
        print("generating", name, "...", flush=True)
        raw = RAW / (name + ".png")
        raw.write_bytes(generate(item["prompt"] + ". " + item.get("style", STYLE)))
        finish(raw, ROOT / item["out"], item["px"])
        print("  ->", item["out"])


if __name__ == "__main__":
    main(sys.argv[1:])
