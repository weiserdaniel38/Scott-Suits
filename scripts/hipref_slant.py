"""Hip pocket reference pictures for the suit image generator.

Writes assets/jacket-hipref3-<variant>.jpg: the lower front of a gray jacket
with the chosen hip pockets, plus a ticket pocket above the wearer's right
pocket where chosen. Slant variants are clearly SLANTED (end nearest the
front button higher, end toward the side seam lower, mirrored); the catalog
drawings were only faintly slanted, so the image model kept drawing level
pockets. (hipref2 was the same at 17 degrees and still came out level.)
"""
import math
import random
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
S = 3  # supersample
W, H = 1000, 640
ANGLE = 22  # degrees

BG = (244, 244, 244)
CLOTH = (92, 99, 110)
CLOTH_DARK = (52, 57, 65)
FLAP = (100, 107, 118)
BTN = (98, 66, 44)
BTN_RIM = (70, 46, 30)


def rot(pts, cx, cy, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def pocket(d, cx, cy, width, kind, deg):
    """kind: sb | db | flap. cy is the pocket opening line."""
    hw = width / 2
    if kind == "sb":
        d.polygon(rot([(cx - hw, cy - 5 * S), (cx + hw, cy - 5 * S), (cx + hw, cy + 5 * S), (cx - hw, cy + 5 * S)], cx, cy, deg), fill=CLOTH_DARK)
        d.line(rot([(cx - hw, cy), (cx + hw, cy)], cx, cy, deg), fill=(30, 33, 38), width=3 * S)
    elif kind == "db":
        d.polygon(rot([(cx - hw, cy - 11 * S), (cx + hw, cy - 11 * S), (cx + hw, cy + 11 * S), (cx - hw, cy + 11 * S)], cx, cy, deg), fill=CLOTH_DARK)
        d.line(rot([(cx - hw, cy), (cx + hw, cy)], cx, cy, deg), fill=(25, 28, 32), width=3 * S)
    elif kind == "patch":
        ph = width * 0.85
        box = rot([(cx - hw, cy), (cx + hw, cy), (cx + hw, cy + ph), (cx - hw, cy + ph)], cx, cy, deg)
        d.polygon([(x + 4 * S, y + 5 * S) for x, y in box], fill=(70, 76, 85))
        d.polygon(box, fill=FLAP, outline=CLOTH_DARK)
        d.line(rot([(cx - hw, cy), (cx + hw, cy)], cx, cy, deg), fill=CLOTH_DARK, width=4 * S)
    else:
        fh = width * 0.36
        d.polygon(rot([(cx - hw, cy - 6 * S), (cx + hw, cy - 6 * S), (cx + hw, cy + 2 * S), (cx - hw, cy + 2 * S)], cx, cy, deg), fill=CLOTH_DARK)
        shadow = rot([(cx - hw, cy), (cx + hw, cy), (cx + hw, cy + fh), (cx - hw, cy + fh)], cx, cy, deg)
        d.polygon([(x + 5 * S, y + 6 * S) for x, y in shadow], fill=(62, 67, 75))
        d.polygon(shadow, fill=FLAP, outline=CLOTH_DARK)
        # stitch line just inside the flap edge
        inner = rot([(cx - hw + 10 * S, cy + 4 * S), (cx - hw + 10 * S, cy + fh - 10 * S), (cx + hw - 10 * S, cy + fh - 10 * S), (cx + hw - 10 * S, cy + 4 * S)], cx, cy, deg)
        for (x1, y1), (x2, y2) in zip(inner, inner[1:]):
            n = int(math.hypot(x2 - x1, y2 - y1) / (14 * S))
            for i in range(n):
                t0, t1 = i / n, (i + 0.55) / n
                d.line([x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1], fill=(78, 84, 94), width=2 * S)


def draw(main, ticket, slant=True):
    w, h = W * S, H * S
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    mid = w // 2
    # two jacket fronts, the right one overlapping at the button, cutaway hem
    d.polygon([(60 * S, 0), (mid + 30 * S, 0), (mid + 30 * S, 470 * S), (mid - 40 * S, 600 * S), (60 * S, 610 * S)], fill=CLOTH)
    d.polygon([(mid - 30 * S, 0), (w - 60 * S, 0), (w - 60 * S, 610 * S), (mid + 40 * S, 600 * S), (mid - 30 * S, 470 * S)], fill=CLOTH)
    rnd = random.Random(7)
    for _ in range(14000):
        x, y = rnd.randint(0, w - 70 * S), rnd.randint(8 * S, h - 1)
        if img.getpixel((x, y)) == CLOTH:
            d.line([x, y, x + 6 * S, y - 6 * S], fill=(86, 93, 104), width=S)
    d.line([(mid - 30 * S, 0), (mid - 30 * S, 470 * S), (mid + 40 * S, 600 * S)], fill=CLOTH_DARK, width=4 * S)
    # front button at the top
    r = 26 * S
    d.ellipse([mid - 30 * S - r, 90 * S - r, mid - 30 * S + r, 90 * S + r], fill=BTN_RIM)
    d.ellipse([mid - 30 * S - r + 5 * S, 90 * S - r + 5 * S, mid - 30 * S + r - 5 * S, 90 * S + r - 5 * S], fill=BTN)
    pw = 250 * S
    ang = ANGLE if slant else 0
    # viewer's left = wearer's right: end nearest the centre (right end) is higher -> negative angle
    pocket(d, 270 * S, 330 * S, pw, main, -ang)
    pocket(d, w - 270 * S, 330 * S, pw, main, ang)
    if ticket:
        # outer (side seam) end lined up over the hip pocket's outer end
        pocket(d, 270 * S - pw * 0.16, 195 * S + pw * 0.16 * math.tan(math.radians(ang)), pw * 0.68, ticket, -ang)
    img = img.filter(ImageFilter.GaussianBlur(S * 0.6)).resize((W, H), Image.LANCZOS)
    return img


VARIANTS = {
    "sbslant": ("sb", None, True),
    "dbslant": ("db", None, True),
    "slantflap": ("flap", None, True),
    "slantflapsbt": ("flap", "sb", True),
    "slantflapdbt": ("flap", "db", True),
    "slantflapft": ("flap", "flap", True),
    "sbsbt": ("sb", "sb", False),
    "dbdbt": ("db", "db", False),
    "flapsbt": ("flap", "sb", False),
    "flapdbt": ("flap", "db", False),
    "flapft": ("flap", "flap", False),
    "patchsbt": ("patch", "sb", False),
    "patchdbt": ("patch", "db", False),
}
for name, (main, ticket, slant) in VARIANTS.items():
    draw(main, ticket, slant).save(f"{OUT}/jacket-hipref3-{name}.jpg", quality=90)
print("ok")
