"""Game thumbnail, 1:1 (1080 x 1080): the n Moi group photo in a gold-framed card on onyx,
with the game's caviar tins and the shark (docs/art-style.md).

    python tools/make-thumbnail.py <group-photo.jpg> [out.png]

The group photo is the one from the Jellyfish artist profile (page 4). Output defaults to
assets/brand/thumbnail.png.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path("C:/Windows/Fonts")
S = 1080
ONYX = (11, 10, 8)
GOLD = (201, 174, 120)
GOLD_BRIGHT = (226, 204, 152)
IVORY = (246, 239, 224)


def font(name, size):
    try:
        return ImageFont.truetype(str(FONTS / name), size)
    except OSError:
        return ImageFont.load_default()


def spaced(draw, y, text, fnt, fill, tracking):
    """Centred text with letter spacing."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = (S - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def main(photo, out):
    canvas = Image.new("RGBA", (S, S), ONYX + (255,))
    d = ImageDraw.Draw(canvas)

    # soft warm glow behind the card
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((90, 230, 990, 930), fill=GOLD + (70,))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))

    # frames
    d.rectangle((22, 22, S - 23, S - 23), outline=GOLD, width=2)
    d.rectangle((34, 34, S - 35, S - 35), outline=GOLD + (110,), width=1)

    # title
    spaced(d, 62, "n Moi", font("GARA.TTF", 40), GOLD, 4)
    spaced(d, 104, "CAVIAR", font("BOD_B.TTF", 132), GOLD_BRIGHT, 16)
    spaced(d, 250, "PRE-SAVE  GAME", font("GARABD.TTF", 34), GOLD, 9)

    # photo card: members from head to waist, centred
    src = Image.open(photo).convert("RGB")
    W, H = src.size
    cw, ch = 900, 560
    crop_w = int(W * 0.80)
    crop_h = int(crop_w * ch / cw)
    left = int(W * 0.105)
    src = src.crop((left, 0, left + crop_w, crop_h)).resize((cw, ch), Image.LANCZOS)
    cx, cy = (S - cw) // 2, 318
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((cx - 6, cy + 14, cx + cw + 6, cy + ch + 24), 26, fill=(0, 0, 0, 170))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((cx - 10, cy - 10, cx + cw + 10, cy + ch + 10), 26, fill=GOLD)
    d.rounded_rectangle((cx - 5, cy - 5, cx + cw + 5, cy + ch + 5), 22, fill=IVORY)
    canvas.paste(src, (cx, cy), rounded_mask((cw, ch), 18))

    # the game's caviar tins along the bottom, overlapping the card
    tins = ["imperial", "almas", "classic", "platinum", "whitepearl"]
    tw = 156
    gap = (S - 120 - tw * len(tins)) // (len(tins) - 1)
    for i, name in enumerate(tins):
        tin = Image.open(ROOT / "assets" / "landing" / ("tin-%s.webp" % name)).convert("RGBA")
        tin.thumbnail((tw, tw), Image.LANCZOS)
        x = 60 + i * (tw + gap) + (tw - tin.width) // 2
        y = 850 + (i % 2) * 14
        canvas.alpha_composite(tin, (x, y))

    # the shark, peeking in at the top right of the card
    shark = Image.open(ROOT / "assets" / "escape" / "shark.webp").convert("RGBA")
    shark.thumbnail((230, 230), Image.LANCZOS)
    shark = shark.rotate(-12, expand=True, resample=Image.BICUBIC)
    canvas.alpha_composite(shark, (S - shark.width - 24, cy - shark.height // 2 - 20))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, quality=95)
    print("thumbnail ->", out)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "assets" / "brand" / "thumbnail.png")
