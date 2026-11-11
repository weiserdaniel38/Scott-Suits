# Arc Lapel card icon + picture-generator reference from Daniel's arc drawing.
# Removes the chest pocket and dart lines, swaps the tight double lapel edge for
# one bold edge plus the thin grey inner line the other lapel icons have, and
# thickens lines to match them.  usage: arc_lapel_icon.py <source.png> <repo>
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np
src, repo = sys.argv[1], sys.argv[2]
g = np.array(Image.open(src).convert("L"))
# chest pocket: everything right of the lapel edge in its rows
ends = {}
for y in list(range(430, 445)) + list(range(598, 610)):
    row = g[y, 780:900] < 150; runs = []; s = None
    for i, v in enumerate(row):
        if v and s is None: s = i
        if not v and s is not None: runs.append((s, i)); s = None
    r = runs[1] if len(runs) > 1 else runs[0]
    ends[y] = 780 + r[1]
k, b = np.polyfit(list(ends), list(ends.values()), 1)
for y in range(440, 602): g[y, int(round(k * y + b)) + 2:1010] = 255
# dart lines
g[670:1100, 320:400] = 255; g[670:1100, 855:935] = 255
H, W = g.shape
def fill(seeds):
    # walls = any ink, fattened 1 px so the hairline inner edge has no gaps
    im = Image.fromarray(np.where(g < 235, 0, 255).astype("uint8")).filter(ImageFilter.MinFilter(3))
    for s in seeds: ImageDraw.floodfill(im, s, 128)
    return np.array(im) == 128
def dil(m, r): return np.array(Image.fromarray((m * 255).astype("uint8")).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0
body = fill([(300, 500), (950, 500), (300, 40), (950, 40)])
shirt = fill([(600, 400), (650, 400)])
inner = (g < 250) & dil(body, 15) & ~dil(body, 8) & ~dil(shirt, 7)
g[inner] = 255
face = fill([(440, 400), (814, 400)])
band = dil(body, 29) & ~dil(body, 26) & face & ~dil(shirt, 9)
band[:150] = False   # like the other icons, the grey line starts at the shoulder
def frame(a):
    c = Image.fromarray(a).crop((272, 0, 984, 1075)); sq = Image.new("L", (1075, 1075), 255); sq.paste(c, ((1075 - 712) // 2, 0)); return sq
lines = frame(g).resize((960, 960), Image.LANCZOS).filter(ImageFilter.MinFilter(3))
grey = frame(np.where(band, 0, 255).astype("uint8")).resize((960, 960), Image.LANCZOS)
grey = Image.eval(grey, lambda v: 255 - (255 - v) * 110 // 255)   # mid grey like the other icons
out = ImageChops.darker(lines, grey)
a = np.array(out).astype(float); a = np.clip((a - 20) * 255 / 215, 0, 255); out = Image.fromarray(a.astype("uint8")).convert("RGB")
out.resize((480, 480), Image.LANCZOS).save(repo + "/assets/jacket-collar-new-arc-v6.jpg", quality=92)
out.resize((900, 900), Image.LANCZOS).save(repo + "/assets/jacket-lapelref-arc-v2.jpg", quality=90)
