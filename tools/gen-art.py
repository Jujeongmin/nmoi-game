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
TOP = "Seen from directly above (top-down, flat lay), centred, filling about 80% of the frame. "

ITEMS = {
    # Caviar Master Chef — plate, signature dish, ingredients (top-down, they sit on the plate)
    "plate": dict(out="assets/chef/plate.webp", px=640,
                  prompt=TOP + "An empty round fine-dining porcelain plate, warm ivory glaze, a thin hand-painted gold rim line."),
    "signature": dict(out="assets/chef/signature.webp", px=320,
                      prompt=TOP + "An empty small round black caviar serving dish, mother-of-pearl inlay rim, elegant."),
    "cracker": dict(out="assets/chef/cracker.webp", px=256,
                    prompt=TOP + "One round golden crisp cracker with fine docking holes."),
    "cream": dict(out="assets/chef/cream.webp", px=256,
                  prompt=TOP + "One neat quenelle of white crème fraîche, glossy and smooth."),
    "lemon": dict(out="assets/chef/lemon.webp", px=256,
                  prompt=TOP + "One thin wheel of fresh lemon, juicy and bright yellow."),
    "herb": dict(out="assets/chef/herb.webp", px=256,
                 prompt=TOP + "One small delicate sprig of fresh green dill."),
    "salmon": dict(out="assets/chef/salmon.webp", px=256,
                   prompt=TOP + "One folded rose of thinly sliced smoked salmon, glistening coral pink."),
    # Caviar Escape — the shark, drawn facing right (+x) and seen from above
    "shark": dict(out="assets/escape/shark.webp", px=384,
                  prompt="A sleek stylized shark seen from directly above, body horizontal and facing right, "
                         "dark slate-grey back with a subtle gold sheen along the fins, elegant rather than scary, "
                         "centred, filling about 85% of the width."),
}


def generate(prompt):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY is not set (see README: Game art).")
    body = json.dumps({
        "model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"),
        "prompt": prompt + ". " + STYLE,
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
        raw.write_bytes(generate(item["prompt"]))
        finish(raw, ROOT / item["out"], item["px"])
        print("  ->", item["out"])


if __name__ == "__main__":
    main(sys.argv[1:])
