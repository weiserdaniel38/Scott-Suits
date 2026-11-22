"""Inside view for the Your Jacket picture (jacket-studio.js).

Daniel (2026-11-22) sent an inside reference (assets/jacket-inside-reference-photo.png:
grey jacket held open, satin lining on both fronts with a welt pocket each,
"Scott Suits" written on the lining, white shirt, burgundy tie, the pants'
waistband below) and said "this is inside view reference". Built like the
back view (scripts/make_jacket_photo_back.py), same scale and placement:

- the writing on the lining is painted out (the page writes the customer's
  monogram),
- the jacket, lining and pants become one cloth shading
  (jacket-photo-shade-inside.webp); the lining's outline is printed below as
  picture coordinates for INSIDE_LINING in jacket-studio.js, which paints the
  chosen lining there,
- the shirt and tie stay in the base photo (jacket-photo-inside.webp); the
  page recolors the tie to the fabric like on the front.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = Image.open(os.path.join(ROOT, 'assets', 'jacket-inside-reference-photo.png')).convert('RGB')
g = np.asarray(src).astype(np.float32)
GH, GW = g.shape[:2]


def mask(polys=(), rects=(), W=GW, H=GH, ss=4):
    m = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(m)
    for p in polys: d.polygon([(x * ss, y * ss) for x, y in p], fill=255)
    for x0, y0, x1, y1 in rects: d.rectangle((x0 * ss, y0 * ss, x1 * ss, y1 * ss), fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255


def inpaint(img, holes, known, iters=1500):
    v = img.copy()
    v[holes] = img[known].mean(0)
    w = (known | holes).astype(np.float32)
    v = v * w[..., None]
    for _ in range(iters):
        p = np.pad(v, ((1, 1), (1, 1), (0, 0))); pw = np.pad(w, 1)
        s = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        sw = pw[:-2, 1:-1] + pw[2:, 1:-1] + pw[1:-1, :-2] + pw[1:-1, 2:]
        v[holes] = (s / np.maximum(sw, 1e-6)[..., None])[holes]
    return np.where(holes[..., None], v, g if img is g else img)


# Lining outlines in the photo (traced by hand).
LIN_L = [(380, 250), (330, 330), (270, 430), (225, 530), (208, 650), (205, 800), (207, 950), (212, 1100),
         (222, 1250), (240, 1372), (292, 1380), (298, 1240), (298, 1100), (302, 960), (312, 850),
         (335, 700), (345, 550), (350, 400), (360, 300)]
LIN_R = [(720, 232), (790, 250), (850, 350), (880, 450), (885, 600), (885, 750), (880, 950), (870, 1150),
         (855, 1300), (840, 1378), (800, 1380), (798, 1240), (796, 1100), (792, 960), (770, 850),
         (745, 700), (737, 550), (735, 400), (728, 300)]

R, G, B = g[..., 0], g[..., 1], g[..., 2]
L = g.mean(2)
bd = np.clip((R - B - 5) / 4, 0, 1) * np.clip((L - 195) / 20, 0, 1)
tie = np.clip((R - (G + B) / 2 - 12) / 12, 0, 1)
tie = np.asarray(Image.fromarray((tie * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
white = np.clip((L - 150) / 30, 0, 1) * (1 - bd) * (1 - tie)
lin = mask(polys=[LIN_L, LIN_R])

# Paint out the writing on the lining.
txt = mask(rects=[(742, 462, 856, 508)]) > 0.01
known = (lin > 0.9) & ~txt & (L < 200)
g = inpaint(g, txt, known)
L = g.mean(2)
R, G, B = g[..., 0], g[..., 1], g[..., 2]
# The shirt and tie between the two fronts (their grey shadows are shirt,
# not cloth).
SHIRT = [(425, 150), (440, 20), (650, 20), (662, 140), (720, 232), (728, 300), (735, 400), (737, 550),
         (745, 700), (770, 850), (782, 962), (303, 962), (312, 850), (335, 700), (345, 550), (350, 400),
         (360, 300), (380, 250)]
shirt = mask(polys=[SHIRT])
cloth = np.clip((1 - bd) * (1 - shirt) * (1 - tie), 0, 1)
# Below the hem the soft floor shadow is not cloth.
low = np.zeros_like(L); low[1360:] = 1
cloth *= 1 - low * np.clip((L - 112) / 22, 0, 1)
cloth = np.asarray(Image.fromarray((cloth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
jacket = np.clip(1 - bd, 0, 1)

W, H = 800, 952
S = 0.655
CX = 543.0
HEMY = 1425.0
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
gx = CX + (xx - 400) / S
gy = HEMY + (yy - 931) / S


def sample(arr):
    x0 = np.clip(np.floor(gx).astype(int), 0, GW - 2); y0 = np.clip(np.floor(gy).astype(int), 0, GH - 2)
    fx = np.clip(gx - x0, 0, 1); fy = np.clip(gy - y0, 0, 1)
    if arr.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    a00 = arr[y0, x0]; a01 = arr[y0, x0 + 1]; a10 = arr[y0 + 1, x0]; a11 = arr[y0 + 1, x0 + 1]
    out = a00 * (1 - fx) * (1 - fy) + a01 * fx * (1 - fy) + a10 * (1 - fx) * fy + a11 * fx * fy
    inside = (gx >= 0) & (gx <= GW - 1) & (gy >= 0) & (gy <= GH - 1)
    return out * (inside[..., None] if arr.ndim == 3 else inside)


Lw = sample(L); c = np.clip(sample(cloth), 0, 1)
Ls = np.asarray(Image.fromarray(np.clip(Lw, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32)
# The lining is lighter satin: shade it against its own median so a dark
# lining doesn't come out washed out, the cloth against the cloth's.
lw = sample(lin)
Lref_c = float(np.median(Ls[(c > 0.9) & (lw < 0.1)]))
Lref_l = float(np.median(Ls[(c > 0.9) & (lw > 0.9)]))
ref = Lref_c * (1 - lw) + Lref_l * lw
r = np.maximum(Ls, 1) / ref
r = np.where(r < 1, 1 - (1 - r) * 0.95, r)
A = c * 255
M1 = np.clip(r, 0, 1) * 255; M2 = np.clip(r - 1, 0, 1) * 255
top = np.dstack([M1, M1, M1, A]); bot = np.dstack([M2, M2, M2, A])
Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-shade-inside.webp'), quality=92, method=6)

PAGE = np.array([236, 228, 221], np.float32)
GLOW = np.array([245, 240, 233], np.float32)
rr = np.sqrt(((xx - 400) / 430.0) ** 2 + ((yy - 430) / 520.0) ** 2)
t = np.clip(rr, 0, 1); t = t * t * (3 - 2 * t)
field = GLOW[None, None, :] * (1 - t[..., None]) + PAGE[None, None, :] * t[..., None]
rgb = sample(g); jk = np.clip(sample(jacket), 0, 1)
base = field * (1 - jk[..., None]) + rgb * jk[..., None]
Image.fromarray(np.dstack([np.clip(base, 0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-inside.webp'), quality=95, method=6, use_sharp_yuv=True)

P = lambda x, y: (round(400 + (x - CX) * S, 1), round(931 + (y - HEMY) * S, 1))
for name, poly in (('L', LIN_L), ('R', LIN_R)):
    print('INSIDE_LINING', name, 'M' + ' L'.join('%g,%g' % P(x, y) for x, y in poly) + ' Z')
for name, (x, y) in {'tie top-left': (470, 130), 'tie bottom-right': (610, 1010), 'monogram R': (798, 488),
                     'welt L': (288, 541), 'welt R': (798, 541), 'pants top': (543, 950), 'hem': (543, 1425)}.items():
    print(name, P(x, y))
print('Lref cloth %.1f lining %.1f' % (Lref_c, Lref_l))
