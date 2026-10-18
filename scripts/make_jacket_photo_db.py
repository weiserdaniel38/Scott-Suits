"""Builds the double breasted photo jacket for the Interactive Jacket.

Source: scripts/source/jacket-photo-source-db.jpg (Daniel's double breasted
mockup, 2026-10-18). It is scaled by 0.99 and shifted so the jacket lands on
the single breasted photo's crop (see make_jacket_photo.py): crop x =
0.99*x - 105, crop y = 0.99*y. Sleeves, cuffs, pockets and the hem then sit
where jacket-studio.js already draws them.

Writes (800x952, same formats as make_jacket_photo.py):
  assets/jacket-photo-front-db.webp
  assets/jacket-photo-shade-front-db.webp          peak lapels (the photo's)
  assets/jacket-photo-shade-front-db-{diamond,shawl}.webp
Run: python3 scripts/make_jacket_photo_db.py (needs numpy + Pillow).
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = Image.open(os.path.join(HERE, 'source', 'jacket-photo-source-db.jpg')).convert('RGB')
# The mockup ends just under the hem; repeat its last rows so the crop has
# backdrop all the way down.
s = np.asarray(src)
s = np.concatenate([s, np.repeat(s[-12:-11], 40, 0)], 0)
src = Image.fromarray(s)
W, H = 800, 952
im = src.transform((W, H), Image.AFFINE, (1 / 0.99, 0, 105 / 0.99, 0, 1 / 0.99, 0), resample=Image.BICUBIC)
a = np.asarray(im).astype(np.float32)
L = a.mean(2)
red = (a[..., 0] - a[..., 2]) > 18


def poly_cov(pts):
    S = 4
    m = Image.new('L', (W * S, H * S), 0)
    ImageDraw.Draw(m).polygon([(x * S, y * S) for x, y in pts], fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255


def shape_mask(circles=(), rects=(), polys=()):
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    for (x, y, r) in circles: d.ellipse((x - r, y - r, x + r, y + r), fill=1)
    for (x0, y0, x1, y1) in rects: d.rounded_rectangle((x0, y0, x1, y1), 6, fill=1)
    for p in polys: d.polygon(p, fill=1)
    return np.asarray(m) > 0


def lbl(x0, y0, x1, y1, p=8): return (x0 - p, y0 - p, x1 + p, y1 + p + 1)


R = 30
# Edges a hole crosses (crop pixels).
lapel_side = [(575, 152), (450, 340), (380, 340), (380, 152)]        # left of the lapel's outer edge
fabric_lapel = [(283, 225), (303, 295), (340, 295), (340, 225)]      # right of the left lapel's edge
lgap = [(193, 580), (168, 710), (100, 710), (100, 580)]               # backdrop left of the body
rgap = [(608, 580), (627, 700), (700, 700), (700, 580)]               # backdrop right of the body
front_edge = [(321.5, 650), (321.5, 715), (400, 715), (400, 650)]     # right of the overlap's edge
lsleeve_bg = [(0, 700), (38, 700), (35.5, 720), (30.5, 740), (28.5, 760), (27.5, 780), (26.5, 800), (27, 830), (0, 830)]
sleeve_gap = [(156.5, 760), (163.5, 760), (163.5, 840), (156.5, 840)]
sleeve_body = [(163.5, 760), (260, 760), (260, 840), (163.5, 840)]
rsleeve_bg = [(768.5, 760), (800, 760), (800, 830), (768.5, 830)]
holes = [
    # "Buttonhole" marker and label: they hide the peak, so that corner is
    # rebuilt from the other (mirrored) side.
    dict(m=shape_mask([(518, 135.5, R)], [lbl(551, 119.5, 657, 151)]), mirror=True),
    # Lapel buttonholes (drawn by the site).
    dict(m=shape_mask(polys=[[(522, 185), (549, 177), (551, 184), (524, 192)]])),
    dict(m=shape_mask(polys=[[(257, 183), (288, 184), (288, 191), (257, 190)]])),
    # Fabric marker and label.
    dict(m=shape_mask([(202.5, 222.5, R)], [lbl(215, 244, 286, 276)]), dom=[('lap', fabric_lapel)]),
    # Lapel marker; lapel label, pocket square and chest pocket.
    dict(m=shape_mask([(491, 250, R)])),
    dict(m=shape_mask([], [lbl(500, 267, 568, 300), (490, 262, 618, 338)]), dom=[('lap', lapel_side)]),
    # Front buttons and the buttonholes beside them.
    *[dict(m=shape_mask([(x + 3, y + 3, 20)])) for x, y in [(292.5, 422.5), (515, 422.5), (341.5, 535.5), (477.5, 540), (341.5, 652.5), (478.5, 652.5)]],
    dict(m=shape_mask([], [(353, 531, 376, 541), (353, 648, 376, 658)])),
    # "Front Buttons" marker and label (a button hides under the label).
    dict(m=shape_mask([(406, 515, R)], [lbl(437, 509, 557, 541)])),
    # Pocket flaps, "Pockets" marker and label.
    dict(m=shape_mask([(227.5, 646.5, R)], [lbl(241, 668, 325, 700), (172, 598, 286, 684)]), dom=[('bg', lgap), ('R', front_edge)]),
    dict(m=shape_mask([], [(518, 602, 632, 688)]), dom=[('bg', rgap)]),
    # Sleeve buttons, marker and label.
    dict(m=shape_mask([(64, 772.5, R)], [lbl(90, 784, 225, 817), (22, 724, 45, 812)]), dom=[('bg', lsleeve_bg), ('gap', sleeve_gap), ('body', sleeve_body)]),
    dict(m=shape_mask([(767, 793, 8)]), dom=[('bg', rsleeve_bg)]),
]


def diffuse(v, known, domain_px, hole, iters):
    w = (domain_px & (known | hole)).astype(np.float32)
    v = v.copy()
    mean = v[known].mean(0) if known.any() else np.zeros(3)
    v[hole] = mean
    v *= w[..., None]
    for _ in range(iters):
        p = np.pad(v, ((1, 1), (1, 1), (0, 0)))
        pw = np.pad(w, 1)
        s_ = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        sw = pw[:-2, 1:-1] + pw[2:, 1:-1] + pw[1:-1, :-2] + pw[1:-1, 2:]
        nv = s_ / np.maximum(sw, 1e-6)[..., None]
        v[hole] = nv[hole]
    return v


out = a.copy()
Lo = out.mean(2)
hp = Lo - np.asarray(Image.fromarray(np.clip(Lo, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32)
for h in holes:
    m = h['m']
    ys, xs = np.where(m)
    y0, y1, x0, x1 = max(ys.min() - 30, 0), min(ys.max() + 31, H), max(xs.min() - 30, 0), min(xs.max() + 31, W)
    sub = out[y0:y1, x0:x1]
    hm = m[y0:y1, x0:x1]
    Ls = L[y0:y1, x0:x1]
    rs = red[y0:y1, x0:x1]
    if h.get('mirror'):
        # Best mirror axis and offset on the ring around the hole, then a
        # seamless blend (the difference diffused in from the edge).
        ring = ~hm & (np.asarray(Image.fromarray(hm.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(15))) > 0)
        best = None
        for ax in range(780, 812):
            for dy in range(-6, 7):
                xs_ = np.clip(ax - np.arange(x0, x1), 0, W - 1)
                e = np.abs(hp[y0:y1, x0:x1] - hp[y0 + dy:y1 + dy][:, xs_])[ring].mean()
                if best is None or e < best[0]: best = (e, ax, dy)
        print('mirror', best)
        _, ax, dy = best
        xs_ = np.clip(ax - np.arange(x0, x1), 0, W - 1)
        mir = out[y0 + dy:y1 + dy][:, xs_]
        known = ~hm
        dv = diffuse(sub - mir, known, np.ones_like(hm), hm, 800)
        out[y0:y1, x0:x1] = np.where(hm[..., None], mir + dv, sub)
        continue
    covs = {}
    rest = np.ones(hm.shape, np.float32)
    for name, poly in h.get('dom', []):
        c = poly_cov(poly)[y0:y1, x0:x1] * rest
        covs[name] = covs.get(name, 0) + c
        rest = rest - c
    covs['fab'] = rest
    res = np.zeros_like(sub)
    for name, cov in covs.items():
        dp = cov > 0.5
        light = name in ('bg', 'gap')
        good = (Ls > 150) if light else ((Ls < 135) & ~rs)
        known = dp & ~hm & good
        hole = hm & (cov > 0)
        if not hole.any(): continue
        v = diffuse(sub, known, dp | hole, hole, 1500)
        res += v * cov[..., None]
    out[y0:y1, x0:x1] = np.where(hm[..., None], res, sub)

a = out
L = a.mean(2)
tie = a[..., 0] - a[..., 2]
alpha = np.clip((140 - L) / 45, 0, 1) * np.clip((22 - tie) / 8, 0, 1)
# In the shirt-and-tie V only blue-ish dark pixels are cloth.
_vm = Image.new('L', (W, H), 0)
ImageDraw.Draw(_vm).polygon([(330, 20), (472, 20), (466, 200), (420, 330), (395, 440), (372, 330), (338, 200)], fill=255)
_vm = np.asarray(_vm.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
blue = a[..., 2] - a[..., 0]
alpha = alpha * (1 - _vm * (1 - np.clip((blue - 3) / 7, 0, 1)))
al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
alpha = np.asarray(al).astype(np.float32) / 255
# Same reference brightness as the single breasted photo, so a fabric looks
# the same in both.
Lref = float(np.median(L[alpha > 0.9]))
GAMMA = 0.8
Lu = Image.fromarray(np.clip(L * 3, 0, 255).astype(np.uint8))
Ls = np.asarray(Lu.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 3
print('Lmed', np.median(L[alpha > 0.9]))

SS = 4


def aa_mask(draw_fn):
    m = Image.new('L', (W * SS, H * SS), 0)
    draw_fn(ImageDraw.Draw(m))
    return np.asarray(m.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255


def S(pts): return [(x * SS, y * SS) for x, y in pts]


def soft(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def seam(v, P, sx, shadow=(1.6, 1.2), dark=0.5):
    """A cloth edge along P: soft shadow on the side sx points to, a dark
    seam, and a faint highlight on the edge itself."""
    if shadow:
        m = aa_mask(lambda g: g.line(S([(x + sx * shadow[0], y + shadow[1]) for x, y in P]), fill=255, width=int(3.2 * SS), joint='curve'))
        v *= 1 - 0.3 * soft(m, 1.8)
        hi = aa_mask(lambda g: g.line(S([(x - sx * 1.3, y) for x, y in P]), fill=255, width=int(1.0 * SS), joint='curve'))
        v *= 1 + 0.1 * hi
    v *= 1 - dark * aa_mask(lambda g: g.line(S(P), fill=255, width=int(1.3 * SS), joint='curve'))
    return v


# Edges the painted-out labels crossed: the lapel's outer edge under the
# "Lapel" label and the overlap's front edge under the "Pockets" label.
Ls = seam(Ls, [(536, 252), (481, 342)], 1)
Ls = seam(Ls, [(320, 660), (320, 710)], 1, None, 0.3)
Ls *= 1 + 0.35 * aa_mask(lambda g: g.line(S([(322, 660), (322, 710)]), fill=255, width=int(1.0 * SS)))


def fill_zone(v, zone):
    ys, xs = np.where(zone)
    y0, y1, x0, x1 = ys.min() - 3, ys.max() + 4, xs.min() - 3, xs.max() + 4
    sub = v[y0:y1, x0:x1].copy()
    hz = zone[y0:y1, x0:x1]
    sub[hz] = sub[~hz].mean()
    for _ in range(1500):
        p = np.pad(sub, 1, mode='edge')
        nv = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
        sub[hz] = nv[hz]
    v[y0:y1, x0:x1] = sub


def save_shade(v, name):
    r = (np.maximum(v, 1) / Lref) ** GAMMA
    A = alpha * 255
    top = np.dstack([np.clip(r, 0, 1) * 255] * 3 + [A])
    bot = np.dstack([np.clip(r - 1, 0, 1) * 255] * 3 + [A])
    Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'assets', name), quality=92, method=6)


save_shade(Ls, 'jacket-photo-shade-front-db.webp')

# Backdrop: the same soft glow as the single breasted photo.
PAGE = np.array([236, 228, 221], np.float32)
GLOW = np.array([245, 240, 233], np.float32)
yy, xx = np.mgrid[0:H, 0:W]
rr = np.sqrt(((xx - 400) / 430.0) ** 2 + ((yy - 430) / 520.0) ** 2)
t = np.clip(rr, 0, 1)
t = t * t * (3 - 2 * t)
field = GLOW[None, None, :] * (1 - t[..., None]) + PAGE[None, None, :] * t[..., None]
warm = a[..., 0] - a[..., 2]
wbg = np.clip((warm - 4) / 4, 0, 1) * np.clip((L - 195) / 20, 0, 1)
wbg = np.asarray(Image.fromarray((wbg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
out_rgb = a * (1 - wbg[..., None]) + field * wbg[..., None]
base = np.dstack([np.clip(out_rgb, 0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8)
Image.fromarray(base, 'RGBA').save(os.path.join(ROOT, 'assets', 'jacket-photo-front-db.webp'), quality=95, method=6, use_sharp_yuv=True)

# ---- Diamond and shawl lapels -------------------------------------------------
# The photo has peak lapels. As in make_jacket_photo.py, the peak and the
# notch below it are wiped with smooth cloth shading and the new outer edge is
# drawn as a seam with a soft shadow on the body side. Points are for the top
# (viewer's right) lapel; the under lapel is mirrored across x = 401 and
# clipped where the top lapel crosses over it.
MX = 802
def mirror(pts): return [(MX - x, y) for x, y in pts]
def cubic(p0, c1, c2, p3, n=40):
    out_ = []
    for t_ in np.linspace(0, 1, n):
        k = [(1 - t_) ** 3, 3 * (1 - t_) ** 2 * t_, 3 * (1 - t_) * t_ * t_, t_ ** 3]
        out_.append((k[0] * p0[0] + k[1] * c1[0] + k[2] * c2[0] + k[3] * p3[0], k[0] * p0[1] + k[1] * c1[1] + k[2] * c2[1] + k[3] * p3[1]))
    return out_
GORGE = [(498, 72), (530, 92), (580, 126), (582, 146), (562, 166), (514, 166), (504, 120)]
OLD_EDGE = [(572, 140), (535, 257), (482, 340), (447, 390), (405, 443)]
# The top lapel's fold, from the shirt down to where the lapels end.
FOLD = [(440, 240), (417, 300), (407, 330), (395.5, 360), (384, 390), (372, 420), (359.5, 450), (346, 480), (330, 515), (330, 952), (800, 952), (800, 240)]
top_panel = aa_mask(lambda g: g.polygon(S(FOLD), fill=255))
DBLAPEL = {
    # One piece from the neck: straight out to a point level with the chest
    # pocket, then straight back in to where the lapels end.
    'diamond': [(500, 68), (558, 238), (397, 452)],
    # One smooth rounded edge from the neck down.
    'shawl': cubic((500, 68), (556, 104), (585, 250), (397, 452)),
}
for style, edge in DBLAPEL.items():
    v = Ls.copy()
    def zdraw(g):
        for f in (lambda q: q, mirror):
            g.polygon(S(f(GORGE)), fill=255)
            g.line(S(f(OLD_EDGE)), fill=255, width=int(16 * SS), joint='curve')
    zm = aa_mask(zdraw)
    zone = zm * np.where(np.arange(W)[None, :] < 401, 1 - top_panel, 1) > 0.3
    fill_zone(v, zone)
    # Top lapel first, then the under lapel's edge only where it shows.
    v = seam(v, edge, 1)
    under = seam(np.ones_like(v), mirror(edge), -1)
    v *= 1 - (1 - under) * (1 - top_panel)
    save_shade(v, 'jacket-photo-shade-front-db-' + style + '.webp')
