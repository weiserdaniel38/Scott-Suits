"""Back view for the Your Jacket picture (jacket-studio.js).

Daniel (2026-11-22) sent a back reference (assets/jacket-back-reference-photo.png:
grey jacket from behind, centre back seam, side vents, collar rolling into
the shoulders with a little white shirt collar, four sleeve buttons, white
shirt cuffs) and said "use as back reference photo" and "remove buttons if
needed". The back view is built from that photo, like the Arc front:

- one uniform scale (the photo keeps its proportions), centre back seam at
  x 400 and the hem at y 931 of the 800 x 952 picture,
- its sleeve buttons and their buttonholes are painted out (the page draws
  the customer's own),
- its luminance becomes the cloth shading (same encoding as the other
  jacket-photo-shade-*.webp files): one with the photo's side vents and one
  with them painted out (no vent / centre vent, drawn by the page),
- the shirt collar and cuffs stay in the base photo; the backdrop becomes the
  same page glow as the front photo.

Writes assets/jacket-photo-back.webp, assets/jacket-photo-shade-back-vents.webp
and assets/jacket-photo-shade-back-plain.webp.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = Image.open(os.path.join(ROOT, 'assets', 'jacket-back-reference-photo.png')).convert('RGB')
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
    v[holes] = img[known].mean(0) if img.ndim == 3 else img[known].mean()
    w = (known | holes).astype(np.float32)
    v = v * (w[..., None] if img.ndim == 3 else w)
    for _ in range(iters):
        if img.ndim == 3:
            p = np.pad(v, ((1, 1), (1, 1), (0, 0)))
        else:
            p = np.pad(v, 1)
        pw = np.pad(w, 1)
        s = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        sw = pw[:-2, 1:-1] + pw[2:, 1:-1] + pw[1:-1, :-2] + pw[1:-1, 2:]
        nv = s / (np.maximum(sw, 1e-6)[..., None] if img.ndim == 3 else np.maximum(sw, 1e-6))
        v[holes] = nv[holes]
    return np.where(holes[..., None] if img.ndim == 3 else holes, v, img)


R, G, B = g[..., 0], g[..., 1], g[..., 2]
L = g.mean(2)
# Backdrop: light and pink (R above B); shirt: light and neutral.
bd = np.clip((R - B - 5) / 4, 0, 1) * np.clip((L - 195) / 20, 0, 1)
white = np.clip((L - 160) / 30, 0, 1) * (1 - bd)
# (A steep ramp: the soft floor shadow under the hem is not cloth.)
cloth = np.clip(1 - np.clip((L - 112) / 22, 0, 1), 0, 1)
jacket = np.clip(1 - bd, 0, 1)

# ---- paint out the sleeve buttons (and their buttonholes) ------------------
cloth_known = (L < 140)
btn = mask(rects=[(62, 1140, 110, 1300), (975, 1140, 1022, 1300)]) > 0.01
btn &= (L < 200) | (cloth > 0.2)
g = inpaint(g, btn, cloth_known & ~btn)
L = g.mean(2)

# ---- the side vents, and a copy with them painted out -----------------------
VL = [(266, 990), (296, 990), (276, 1432), (226, 1432)]
VR = [(790, 990), (820, 990), (862, 1432), (812, 1432)]
vm = mask(polys=[VL, VR]) > 0.01
Lp = inpaint(L, vm, cloth_known & ~vm & ~btn, 2500)
# Cloth outline across the vents: the same as just left and right of them.
cl_plain = cloth.copy()
for y in range(985, GH):
    for poly in (VL, VR):
        xs = np.where(vm[y, :])[0]
        xs = xs[(xs > poly[3][0] - 60) & (xs < poly[2][0] + 60)]
        if not len(xs):
            continue
        a, b = xs.min() - 3, xs.max() + 3
        t = (np.arange(a, b + 1) - a) / max(1, b - a)
        cl_plain[y, a:b + 1] = cloth[y, a] * (1 - t) + cloth[y, b] * t

# ---- map onto the 800 x 952 picture ----------------------------------------
W, H = 800, 952
S = 0.655
CX = 543.0  # centre back seam in the photo
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


def shade(Lsrc, cl, name):
    Lw = sample(Lsrc); c = np.clip(sample(cl), 0, 1)
    Lu = Image.fromarray(np.clip(Lw, 0, 255).astype(np.uint8))
    Ls = np.asarray(Lu.filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32)
    Lref = float(np.median(Ls[c > 0.9]))
    r = np.maximum(Ls, 1) / Lref
    r = np.where(r < 1, 1 - (1 - r) * 0.95, r)
    A = c * 255
    M1 = np.clip(r, 0, 1) * 255; M2 = np.clip(r - 1, 0, 1) * 255
    top = np.dstack([M1, M1, M1, A]); bot = np.dstack([M2, M2, M2, A])
    Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
        os.path.join(ROOT, 'assets', name), quality=92, method=6)
    print(name, 'Lref', Lref)


shade(L, cloth, 'jacket-photo-shade-back-vents.webp')
shade(Lp, cl_plain, 'jacket-photo-shade-back-plain.webp')

# ---- base photo: page glow, then the shirt collar and cuffs ----------------
PAGE = np.array([236, 228, 221], np.float32)
GLOW = np.array([245, 240, 233], np.float32)
rr = np.sqrt(((xx - 400) / 430.0) ** 2 + ((yy - 430) / 520.0) ** 2)
t = np.clip(rr, 0, 1); t = t * t * (3 - 2 * t)
field = GLOW[None, None, :] * (1 - t[..., None]) + PAGE[None, None, :] * t[..., None]
rgb = sample(g); jk = np.clip(sample(jacket), 0, 1)
base = field * (1 - jk[..., None]) + rgb * jk[..., None]
Image.fromarray(np.dstack([np.clip(base, 0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-back.webp'), quality=95, method=6, use_sharp_yuv=True)
for name, (x, y) in {'left buttons': (86, 1160), 'right buttons': (997, 1160), 'bottom button': (86, 1250),
                     'vent top L': (281, 1000), 'collar': (543, 60), 'shoulder seam L': (245, 230)}.items():
    print(name, round(400 + (x - CX) * S, 1), round(931 + (y - HEMY) * S, 1))
