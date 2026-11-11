# Shaded copy of Daniel's arc lapel drawing for the picture generator: same
# outlines, jacket filled grey, lapels a lighter grey, shirt white, so the image
# model can tell lapel from jacket.  usage: arc_lapel_shaded.py <source.png> <repo>
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
src, repo = sys.argv[1], sys.argv[2]
g = np.array(Image.open(src).convert("L"))
ends = {}
for y in list(range(430, 445)) + list(range(598, 610)):
    row = g[y, 780:900] < 150; runs = []; s = None
    for i, v in enumerate(row):
        if v and s is None: s = i
        if not v and s is not None: runs.append((s, i)); s = None
    r = runs[1] if len(runs) > 1 else runs[0]
    ends[y] = 780 + r[1]
k, b = np.polyfit(list(ends), list(ends.values()), 1)
for y in range(440, 602): g[y, int(round(k * y + b)) + 2:1010] = 255   # chest pocket
g[670:1100, 320:400] = 255; g[670:1100, 855:935] = 255                 # darts
g[1090:1160, 230:440] = 255; g[1090:1160, 800:1010] = 255              # hip pockets
walls = Image.fromarray(np.where(g < 235, 0, 255).astype("uint8")).filter(ImageFilter.MinFilter(3))
def fill(seeds):
    im = walls.copy()
    for s in seeds: ImageDraw.floodfill(im, s, 128)
    return np.array(im) == 128
bg = fill([(5, 5), (1248, 5), (620, 5)])
shirt = fill([(560, 300), (680, 300), (600, 150), (650, 150)])
lapel = fill([(440, 400), (814, 400)])
out = np.zeros(g.shape + (3,), "uint8"); out[:] = (94, 100, 112)       # jacket
out[lapel] = (128, 134, 146); out[shirt] = (250, 250, 250); out[bg] = (240, 240, 240)
ink = np.array(Image.fromarray(g).filter(ImageFilter.MinFilter(5))) < 150
out[ink] = (30, 32, 38)
im = Image.fromarray(out)
im.crop((0, 0, 1254, 1060)).resize((1065, 900), Image.LANCZOS).save(repo + "/assets/jacket-lapelref-arc-v3.jpg", quality=90)
im.crop((330, 640, 930, 1030)).resize((1000, 650), Image.LANCZOS).save(repo + "/assets/jacket-lapelref-arc-tip-v2.jpg", quality=90)
