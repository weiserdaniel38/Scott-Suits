"""Arc lapel front for the Your Jacket picture (jacket-studio.js).

Daniel (2026-11-19): the Arc must look exactly like the approved Arc photo the
suit picture generator uses (assets/jacket-lapelref-arc-approved.jpg, a grey
jacket). Drawing the Arc edge as a line on the notch photo never looked right,
so the single breasted Arc front is built from that photo itself:

- the grey jacket (left 600 px of the reference) is warped onto the main
  photo's layout (800x952 crop: shoulders, collar, top button and sleeve ends
  line up with jacket-photo-front.webp, so the drawn pockets, buttons and cuffs
  land in the same places),
- its own buttons and sleeve buttons are painted out (the page draws them),
- its luminance becomes the cloth shading (same encoding as
  jacket-photo-shade-front*.webp), and
- the lining showing in the opening and the backdrop stay in the base photo.

Writes assets/jacket-photo-front-arc.webp and
assets/jacket-photo-shade-front-arc-photo.webp.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = Image.open(os.path.join(ROOT, 'assets', 'jacket-lapelref-arc-approved.jpg')).convert('RGB').crop((0, 0, 600, 800))
g = np.asarray(src).astype(np.float32)
GH, GW = g.shape[:2]
GL = g.mean(2)


def mask(polys=(), circles=(), rects=(), W=GW, H=GH, ss=4):
    m = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(m)
    for p in polys: d.polygon([(x * ss, y * ss) for x, y in p], fill=255)
    for x, y, r in circles: d.ellipse(((x - r) * ss, (y - r) * ss, (x + r) * ss, (y + r) * ss), fill=255)
    for x0, y0, x1, y1 in rects: d.rectangle((x0 * ss, y0 * ss, x1 * ss, y1 * ss), fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255


# ---- paint out the photo's buttons, buttonhole and sleeve buttons ----------
holes = mask(circles=[(295, 477, 15), (275, 590, 15)],
             rects=[(306, 469, 327, 483), (563, 670, 590, 752), (0, 680, 24, 752)]) > 0.01
# Keep the white backdrop out of the fill so the sleeve edges stay cloth.
cloth_known = (GL < 200) & ~holes
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
# a touch of the cloth's grain back on the filled spots
rng = np.random.default_rng(3)
g2[holes] += rng.normal(0, 2.0, (holes.sum(), 1))
GL2 = g2.mean(2)

# ---- masks: backdrop, lining in the opening, cloth ----------------------
# The right edge sits on the damask, not on the plain grey facing strip beside
# it, so the right lapel's cloth covers that strip (Daniel 2026-11-19).
OPEN_TOP = [(226, 52), (359, 52), (361, 120), (355, 200), (339, 258), (317, 318), (299, 368), (293, 398),
            (282, 370), (263, 302), (246, 232), (233, 150)]
OPEN_BOT = [(295, 614), (306, 650), (318, 700), (330, 760), (250, 760), (262, 700), (280, 650)]
opening = mask(polys=[OPEN_TOP, OPEN_BOT])
bg = np.clip((GL2 - 222) / 14, 0, 1)
bg = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
cloth = np.clip((1 - bg) * (1 - opening), 0, 1)
jacket = np.clip(1 - bg, 0, 1)  # cloth + lining

# ---- warp onto the main photo's layout (800x952) -------------------------
W, H = 800, 952
# x: shoulders (85 -> 135, 515 -> 665); y: collar 25 -> 40, shoulders 100 -> 130,
# top button 477 -> 525, sleeve ends 770 -> 858, hem 795 -> 885.
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
gx = 85 + (xx - 135) * 430.0 / 530.0
gy = np.interp(yy, [0, 40, 130, 525, 858, 885, 952], [0 - 40 * 25 / 40 + 25, 25, 100, 477, 770, 795, 795 + 67 * 0.92])


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
# The photo's lapel edge is a thin near-black line; on the customer's cloth it
# read as a hard drawn outline (Daniel 2026-11-19). Soften it: blur the
# shading a touch and pull the darkest values back toward the cloth.
r = np.asarray(Image.fromarray(np.clip(r * 100, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 100
r = np.where(r < 1, 1 - (1 - r) * 0.62, r)
A = np.clip(cl, 0, 1) * 255
M1 = np.clip(r, 0, 1) * 255; M2 = np.clip(r - 1, 0, 1) * 255
top = np.dstack([M1, M1, M1, A]); bot = np.dstack([M2, M2, M2, A])
Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-shade-front-arc-photo.webp'), quality=92, method=6)

# ---- base photo: the page glow backdrop, the jacket (its lining shows) ----
PAGE = np.array([236, 228, 221], np.float32)
GLOW = np.array([245, 240, 233], np.float32)
rr = np.sqrt(((xx - 400) / 430.0) ** 2 + ((yy - 430) / 520.0) ** 2)
t = np.clip(rr, 0, 1); t = t * t * (3 - 2 * t)
field = GLOW[None, None, :] * (1 - t[..., None]) + PAGE[None, None, :] * t[..., None]
base = field * (1 - jk[..., None]) + rgb * jk[..., None]
Image.fromarray(np.dstack([np.clip(base, 0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-front-arc.webp'), quality=95, method=6, use_sharp_yuv=True)
print('Lref', Lref)
