"""Arc lapel front for the Your Jacket picture (jacket-studio.js).

Daniel (2026-11-20) sent a new Arc reference (assets/jacket-arc-reference-photo.jpg:
grey two button Arc jacket with white shirt, burgundy tie, shirt cuffs and the
damask lining showing below the buttons). The single breasted Arc front is
built from that photo itself (drawing the Arc edge as lines never looked
right):

- the photo is warped onto the main photo's layout (800x952: one linear map
  in y through shoulders / top button / sleeve ends, and per row an x scale
  that matches the silhouette width, so the drawn pockets, buttons and cuffs
  land where they do on jacket-photo-front.webp),
- its own buttons, buttonhole and sleeve buttons are painted out (the page
  draws them),
- its luminance becomes the cloth shading (same encoding as
  jacket-photo-shade-front*.webp), and
- the shirt, tie, shirt cuffs and lining stay in the base photo; the backdrop
  becomes the page glow.

Writes assets/jacket-photo-front-arc.webp and
assets/jacket-photo-shade-front-arc-photo.webp.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = Image.open(os.path.join(ROOT, 'assets', 'jacket-arc-reference-photo.jpg')).convert('RGB')
g = np.asarray(src).astype(np.float32)
GH, GW = g.shape[:2]
GL = g.mean(2)
BACKDROP = np.array([247, 239, 231], np.float32)


def mask(polys=(), circles=(), rects=(), W=GW, H=GH, ss=4):
    m = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(m)
    for p in polys: d.polygon([(x * ss, y * ss) for x, y in p], fill=255)
    for x, y, r in circles: d.ellipse(((x - r) * ss, (y - r) * ss, (x + r) * ss, (y + r) * ss), fill=255)
    for x0, y0, x1, y1 in rects: d.rectangle((x0 * ss, y0 * ss, x1 * ss, y1 * ss), fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255


# ---- paint out the photo's buttons, buttonhole and sleeve buttons ----------
# Sleeve buttons stick out past the sleeve edge (x 50 left, 1030 right): the
# part outside becomes backdrop, the part on the sleeve becomes cloth.
g[1168:1306, 30:50] = BACKDROP
g[1168:1306, 1031:1050] = BACKDROP
GL = g.mean(2)
holes = mask(circles=[(544, 841, 21), (510, 1030, 21)],
             rects=[(558, 831, 593, 849), (49, 1168, 56, 1306), (1023, 1168, 1031, 1306)]) > 0.01
cloth_known = (GL < 170) & ~holes
v = g.copy()
v[holes] = g[cloth_known].mean(0)
w = (cloth_known | holes).astype(np.float32)
v *= w[..., None]
for _ in range(1500):
    p = np.pad(v, ((1, 1), (1, 1), (0, 0))); pw = np.pad(w, 1)
    s = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    sw = pw[:-2, 1:-1] + pw[2:, 1:-1] + pw[1:-1, :-2] + pw[1:-1, 2:]
    nv = s / np.maximum(sw, 1e-6)[..., None]
    v[holes] = nv[holes]
g2 = np.where(holes[..., None], v, g)
rng = np.random.default_rng(3)
g2[holes] += rng.normal(0, 2.0, (holes.sum(), 1))
GL2 = g2.mean(2)
R, G, B = g2[..., 0], g2[..., 1], g2[..., 2]

# ---- masks: backdrop (warm cream), shirt (neutral white), tie (red), lining --
bd = np.clip((R - B - 6) / 6, 0, 1) * np.clip((GL2 - 190) / 20, 0, 1)
white = np.clip((GL2 - 145) / 35, 0, 1)
tie = np.clip((R - (G + B) / 2 - 12) / 12, 0, 1)
# grow the tie a pixel so its dark rim doesn't turn into a cloth halo
tie = np.asarray(Image.fromarray((tie * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
LINING = [(539, 1086), (546, 1120), (561, 1200), (586, 1280), (612, 1350), (626, 1394),
          (434, 1394), (462, 1350), (482, 1320), (501, 1270), (516, 1200), (531, 1120)]
lining = mask(polys=[LINING])
# Shirt collar and tie knot: their grey shadows are shirt, not cloth.
NECK = [(452, 30), (640, 30), (634, 250), (604, 330), (488, 330), (456, 250)]
lining = np.maximum(lining, mask(polys=[NECK]))
cloth = np.clip((1 - bd) * (1 - white) * (1 - tie) * (1 - lining), 0, 1)
cloth = np.asarray(Image.fromarray((cloth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
jacket = np.clip(1 - bd, 0, 1)  # cloth + shirt + tie + lining

# ---- warp onto the main photo's layout (800x952) -------------------------
W, H = 800, 952
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
# y: main shoulders 140 / top button 525 / sleeve ends 852 <-> ref 215 / 838 / 1365.
gy = 215 + (yy - 140) * 1.616


def widths(Lum, thr, rows):
    out = []
    for y in rows:
        xs = np.where(Lum[int(y)] < thr)[0]
        out.append(xs.max() - xs.min() if len(xs) else 0)
    return np.array(out, np.float32)


main = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'jacket-photo-front.webp')).convert('L')).astype(np.float32)
rows = np.arange(140, 841, 4, dtype=np.float32)
wm = widths(main, 190, rows)
wr = widths(GL, 200, np.clip(215 + (rows - 140) * 1.616, 0, GH - 1))
scale = wr / np.maximum(wm, 1)
scale = np.convolve(np.pad(scale, 6, mode='edge'), np.ones(13) / 13, mode='valid')
sy = np.interp(yy[:, 0], rows, scale)[:, None]  # clamps above / below
CM, CR = 398.5, 538.5
gx = CR + (xx - CM) * sy
print('x scale shoulders %.3f sleeves %.3f' % (scale[0], scale[-1]))


def sample(arr):
    x0 = np.clip(np.floor(gx).astype(int), 0, GW - 2); y0 = np.clip(np.floor(gy).astype(int), 0, GH - 2)
    fx = np.clip(gx - x0, 0, 1); fy = np.clip(gy - y0, 0, 1)
    if arr.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    a00 = arr[y0, x0]; a01 = arr[y0, x0 + 1]; a10 = arr[y0 + 1, x0]; a11 = arr[y0 + 1, x0 + 1]
    out = a00 * (1 - fx) * (1 - fy) + a01 * fx * (1 - fy) + a10 * (1 - fx) * fy + a11 * fx * fy
    inside = (gx >= 0) & (gx <= GW - 1) & (gy >= 0) & (gy <= GH - 1)
    return out * (inside[..., None] if arr.ndim == 3 else inside)


rgb = sample(g2)
Lw = sample(GL2)
cl = sample(cloth)
jk = sample(jacket)

# ---- shading (same encoding as make_jacket_photo.py) ---------------------
GAMMA = 0.8
Lu = Image.fromarray(np.clip(Lw, 0, 255).astype(np.uint8))
Ls = np.asarray(Lu.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32)
Lref = float(np.median(Ls[cl > 0.9]))
r = (np.maximum(Ls, 1) / Lref) ** GAMMA
# Keep the lapel edges soft so they read as cloth, not a drawn outline.
r = np.asarray(Image.fromarray(np.clip(r * 100, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))).astype(np.float32) / 100
r = np.where(r < 1, 1 - (1 - r) * 0.7, r)
A = np.clip(cl, 0, 1) * 255
M1 = np.clip(r, 0, 1) * 255; M2 = np.clip(r - 1, 0, 1) * 255
top = np.dstack([M1, M1, M1, A]); bot = np.dstack([M2, M2, M2, A])
Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-shade-front-arc-photo.webp'), quality=92, method=6)

# ---- base photo: the page glow backdrop, then the jacket with shirt/tie/lining
PAGE = np.array([236, 228, 221], np.float32)
GLOW = np.array([245, 240, 233], np.float32)
rr = np.sqrt(((xx - 400) / 430.0) ** 2 + ((yy - 430) / 520.0) ** 2)
t = np.clip(rr, 0, 1); t = t * t * (3 - 2 * t)
field = GLOW[None, None, :] * (1 - t[..., None]) + PAGE[None, None, :] * t[..., None]
base = field * (1 - jk[..., None]) + rgb * jk[..., None]
Image.fromarray(np.dstack([np.clip(base, 0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-front-arc.webp'), quality=95, method=6, use_sharp_yuv=True)
print('Lref', Lref)
