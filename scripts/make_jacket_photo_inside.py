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


# Lining outlines in the photo, traced along the seam where the lining meets
# the cloth facing. Towards the shirt they run past the edge on purpose: the
# shirt is cut out of the cloth below, so the edge there comes from the photo.
LIN_L = [(390, 248), (383, 260), (350, 310), (323, 350), (293, 403), (260, 460), (227, 503), (217, 533),
         (213, 567), (206, 650), (202, 750), (202, 850), (205, 900), (209, 950), (209, 1000), (205, 1050),
         (202, 1100), (197, 1150), (190, 1200), (180, 1237), (170, 1275), (161, 1312), (156, 1350),
         (157, 1370), (170, 1387), (192, 1395), (230, 1392), (256, 1383), (262, 1325), (270, 1265),
         (274, 1230), (277, 1165), (284, 1102), (292, 1050), (300, 1010), (306, 966), (332, 960),
         (340, 900), (355, 800), (365, 700), (372, 550), (378, 400), (388, 300)]
LIN_R = [(693, 250), (703, 257), (753, 337), (800, 403), (840, 450), (863, 497), (877, 533), (882, 583),
         (883, 650), (883, 850), (880, 900), (877, 950), (876, 1000), (880, 1050), (885, 1100),
         (892, 1150), (900, 1200), (910, 1237), (920, 1275), (927, 1312), (932, 1350), (930, 1372),
         (920, 1386), (895, 1394), (860, 1390), (832, 1381), (829, 1352), (822, 1290), (816, 1240),
         (814, 1225), (807, 1165), (800, 1102), (792, 1050), (788, 1010), (783, 966), (760, 960),
         (742, 900), (735, 800), (725, 700), (712, 550), (700, 400), (690, 300)]
# The half lining stops here (picture y 470).
HALF_Y = 1425.0 + (470 - 931) / 0.655

R, G, B = g[..., 0], g[..., 1], g[..., 2]
L = g.mean(2)
bd = np.clip((R - B - 5) / 4, 0, 1) * np.clip((L - 195) / 20, 0, 1)
tie = np.clip((R - (G + B) / 2 - 12) / 12, 0, 1)
tie = np.asarray(Image.fromarray((tie * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
lin = mask(polys=[LIN_L, LIN_R])

# Paint out the writing on the lining.
txt = mask(rects=[(742, 462, 856, 508)]) > 0.01
known = (lin > 0.9) & ~txt & (L < 200)
g = inpaint(g, txt, known)
# A crease in the sheen at each bottom corner of the lining reads as a stray
# white tick once the lining is recolored: smooth the sheen there.
soft = np.asarray(Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32)
tick = mask(rects=[(170, 1325, 240, 1385), (848, 1325, 918, 1385)])
tick = np.asarray(Image.fromarray((tick * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
g = g * (1 - tick[..., None]) + soft * tick[..., None]
L = g.mean(2)
R, G, B = g[..., 0], g[..., 1], g[..., 2]


def u8(a):
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))


def f32(im):
    return np.asarray(im).astype(np.float32) / 255


# Everything that is not cloth: the backdrop, the shirt, its collar and
# cuffs. All of it is bright and joined up, so it is flood-filled from the
# corner and the shirt front (thin bright lines such as the shine on a folded
# edge are too narrow to let the fill through), then grown into the soft
# shadow the jacket throws on the shirt, which is still shirt.
Ls0 = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32)
bright = Ls0 > 150
core_in = u8(bright.astype(np.float32)).filter(ImageFilter.MinFilter(5))
fill = core_in.copy()
for seed in ((5, 5), (GW - 6, 5), (5, GH - 6), (GW - 6, GH - 6), (500, 400), (600, 400), (500, 800), (600, 800)):
    if fill.getpixel(seed) == 255:
        ImageDraw.floodfill(fill, seed, 128)
core = (np.asarray(fill) == 128)
core = (f32(u8(core.astype(np.float32)).filter(ImageFilter.MaxFilter(5))) > 0.5) & bright
soft_ok = Ls0 > 100
grown = core.copy()
for _ in range(12):
    grown = (f32(u8(grown.astype(np.float32)).filter(ImageFilter.MaxFilter(3))) > 0.5) & soft_ok
# Inside the collar and beside the knot the shirt is in shadow (grey, not
# bright).
NECK = [(450, 40), (638, 40), (640, 70), (610, 150), (600, 195), (543, 200), (486, 195), (476, 150), (446, 70)]
neck = mask(polys=[NECK])
notcloth = np.maximum(np.maximum(core, neck), grown * np.clip((Ls0 - 100) / 35, 0, 1))
cloth = np.clip((1 - bd) * (1 - notcloth) * (1 - tie), 0, 1)
# Below the hem the soft floor shadow is not cloth.
low = np.zeros_like(L); low[1360:] = 1
cloth *= 1 - low * np.clip((L - 112) / 22, 0, 1)
cloth = f32(u8(cloth).filter(ImageFilter.GaussianBlur(0.6)))
# On the cloth's own edge a pixel is part cloth, part bright backdrop or
# shirt: shade it like the cloth beside it, not like the mix, or dark
# fabrics get a pale rim.
Lmin = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))).astype(np.float32)
L = np.where(cloth < 0.98, np.minimum(L, Lmin), L)
jacket = np.clip(1 - bd, 0, 1)

# The picture is 800 x 952 units; the files are K times that, close to the
# reference's own sharpness (jacket-studio.js reads the size from the file).
K = 1.5
W, H = int(800 * K), int(952 * K)
S = 0.655
CX = 543.0
HEMY = 1425.0
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
xx = (xx + 0.5) / K - 0.5
yy = (yy + 0.5) / K - 0.5
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
# Satin throws small hard glints (the lining's bottom corners): ease the
# lining's highlights off so they stay a sheen.
hi = np.clip(r - 1, 0, None)
hi = hi * (1 - lw) + 0.6 * (1 - np.exp(-hi / 0.6)) * lw
M1 = np.clip(r, 0, 1) * 255; M2 = np.clip(hi, 0, 1) * 255
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
    os.path.join(ROOT, 'assets', 'jacket-photo-inside.webp'), quality=92, method=6, use_sharp_yuv=True)

P = lambda x, y: (round(400 + (x - CX) * S, 1), round(931 + (y - HEMY) * S, 1))


def cut(poly, ymax):
    """The part of a polygon above ymax."""
    out = []
    for i, (x, y) in enumerate(poly):
        px, py = poly[i - 1]
        if (py <= ymax) != (y <= ymax):
            t = (ymax - py) / (y - py)
            out.append((px + (x - px) * t, ymax))
        if y <= ymax: out.append((x, y))
    return out


path = lambda poly: 'M' + ' L'.join('%g,%g' % P(x, y) for x, y in poly) + ' Z'
print('INSIDE_LINING = "%s " +\n  "%s";' % (path(LIN_L), path(LIN_R)))
print('INSIDE_HALF = "%s " +\n  "%s";' % (path(cut(LIN_L, HALF_Y)), path(cut(LIN_R, HALF_Y))))
for name, (x, y) in {'tie top-left': (470, 130), 'tie bottom-right': (610, 1010), 'monogram R': (798, 488),
                     'welt L': (288, 541), 'welt R': (798, 541), 'pants top': (543, 950), 'hem': (543, 1425)}.items():
    print(name, P(x, y))
print('Lref cloth %.1f lining %.1f' % (Lref_c, Lref_l))
# A look at the masks, for checking by eye: python3 make_jacket_photo_inside.py /tmp/check.png
import sys
if len(sys.argv) > 1:
    v = np.asarray(src).astype(np.float32) * 0.5
    v[..., 0] += cloth * 110 * (1 - lin); v[..., 2] += cloth * 110 * lin; v[..., 1] += tie * 110
    Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(sys.argv[1])
