"""Straight-vent sleeve cuff reference pictures for the suit image generator.

Writes assets/jacket-cuffref-straight-<flat|overlap><n>.jpg: a gray sleeve end
with a straight vertical vent and exactly n brown buttons in a vertical column,
each with a horizontal stitched buttonhole. Same look as jacket-cuffref-vent-*.
"""
import random
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
S = 3  # supersample
W = H = 900

BG = (244, 244, 244)
CLOTH = (92, 99, 110)
CLOTH_DARK = (60, 66, 75)
BTN = (98, 66, 44)
BTN_RIM = (70, 46, 30)
BTN_DARK = (40, 26, 16)
HOLE = (236, 232, 222)


def draw(n, overlap):
    w, h = W * S, H * S
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    L, R, top, hem = 90 * S, 830 * S, 0, 760 * S
    # sleeve body with a rounded hem
    d.rectangle([L, top, R, hem], fill=CLOTH)
    d.ellipse([L - 20 * S, hem - 60 * S, R + 20 * S, hem + 60 * S], fill=CLOTH)
    d.rectangle([0, 0, L - 1, h], fill=BG)
    d.rectangle([R + 1, 0, w, h], fill=BG)
    # fine twill texture
    rnd = random.Random(7)
    for _ in range(9000):
        x = rnd.randint(L, R - 8 * S)
        y = rnd.randint(0, hem + 50 * S)
        if img.getpixel((x, y)) == CLOTH:
            d.line([x, y, x + 6 * S, y - 6 * S], fill=(86, 93, 104), width=S)
    # hem stitch line
    for x in range(L + 10 * S, R - 10 * S, 18 * S):
        d.line([x, hem - 12 * S, x + 10 * S, hem - 12 * S], fill=CLOTH_DARK, width=2 * S)

    diam = 88 * S
    step = int(diam * (0.82 if overlap else 1.18))
    cx = 600 * S
    bottom_cy = hem - 120 * S
    ys = [bottom_cy - i * step for i in range(n)]
    # straight vertical vent line, right of the buttons, from hem to above top button
    vx = cx + diam // 2 + 70 * S
    d.line([vx, hem - 4 * S, vx, ys[-1] - diam], fill=CLOTH_DARK, width=5 * S)
    # buttonholes first (under the buttons), then buttons bottom to top
    for cy in ys:
        x1, x2 = cx - 150 * S, cx
        d.rectangle([x1, cy - 9 * S, x2, cy + 9 * S], fill=HOLE)
        d.rectangle([x1 + 6 * S, cy - 2 * S, x2, cy + 2 * S], fill=CLOTH_DARK)
        for x in range(x1 + 4 * S, x2, 9 * S):
            d.line([x, cy - 9 * S, x, cy - 3 * S], fill=(170, 165, 155), width=S)
            d.line([x, cy + 3 * S, x, cy + 9 * S], fill=(170, 165, 155), width=S)
    for cy in ys:
        r = diam // 2
        d.ellipse([cx - r + 6 * S, cy - r + 8 * S, cx + r + 6 * S, cy + r + 8 * S], fill=(50, 54, 60))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BTN_RIM)
        d.ellipse([cx - r + 7 * S, cy - r + 7 * S, cx + r - 7 * S, cy + r - 7 * S], fill=BTN)
        for dx in (-11, 11):
            for dy in (-11, 11):
                hx, hy = cx + dx * S, cy + dy * S
                d.ellipse([hx - 5 * S, hy - 5 * S, hx + 5 * S, hy + 5 * S], fill=BTN_DARK)
    img = img.filter(ImageFilter.GaussianBlur(S * 0.6)).resize((W, H), Image.LANCZOS)
    return img


for n in (3, 4, 5):
    draw(n, False).save(f"{OUT}/jacket-cuffref-straight-flat{n}.jpg", quality=90)
for n in (4, 5, 6):
    draw(n, True).save(f"{OUT}/jacket-cuffref-straight-overlap{n}.jpg", quality=90)
print("ok")
