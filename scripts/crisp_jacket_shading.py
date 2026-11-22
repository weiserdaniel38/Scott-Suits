"""Cleans and sharpens the jacket picture's shading maps and base photos.

Daniel 2026-11-22: "make sure there are no blurs on any preview". The maps
made by make_jacket_photo*.py are 800 px wide and carry soft smudges where
the mockup's pockets, buttons and labels were painted out. This pass, run
AFTER those scripts, rewrites each asset in place at twice the size:

- smudges: areas with no cloth grain (the paint-outs) outside the lapels are
  filled again from clean cloth around them (a smooth fill from a median of
  the surroundings, so the old pocket shadows don't leak back in),
- the back's smoothed body becomes one gentle gradient instead of blotches,
- the mockup's own cloth grain is taken out of the shading (the fabric tile
  supplies the weave), keeping folds and edges,
- everything is enlarged 2x (Lanczos), folds lightly sharpened, and the
  cloth outline tightened so the silhouette is crisp,
- the base photos (shirt, tie, cuffs, backdrop) are enlarged 2x and
  lightly sharpened.

jacket-studio.js draws both in picture units, so the size change needs no
code change. Run: python3 scripts/crisp_jacket_shading.py [--src DIR]
(DIR = folder holding the 800 px originals; default = assets as they are,
so only run it once per rebuild).
"""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import os, re, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets')
if '--src' in sys.argv: SRC = sys.argv[sys.argv.index('--src') + 1]
OUT = os.path.join(ROOT, 'assets')
W, H = 800, 952

js = open(os.path.join(ROOT, 'jacket-studio.js')).read()
PROFILES = json.loads(re.search(r'const LAPEL_PROFILES = (\{.*?\});', js).group(1))


def F(a): return Image.fromarray(a.astype(np.float32), 'F')
def _box(a, r, axis):
    if r < 1: return a
    pad = [(0, 0), (0, 0)]; pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def gauss(a, s):
    """Gaussian blur of a float image (three box passes)."""
    a = np.asarray(a, np.float32)
    w = np.sqrt(12 * s * s / 3 + 1); r = max(0, int(round((w - 1) / 2)))
    if r < 1:  # small sigma: exact small kernel
        k = np.exp(-0.5 * (np.arange(-3, 4) / max(s, 1e-3)) ** 2); k /= k.sum()
        for ax in (0, 1):
            pad = [(0, 0), (0, 0)]; pad[ax] = (3, 3)
            q = np.pad(a, pad, mode='edge'); n = a.shape[ax]
            a = sum(k[i] * np.take(q, np.arange(i, i + n), axis=ax) for i in range(7)).astype(np.float32)
        return a
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a
def u8(m): return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
def dilate(m, r): return np.asarray(u8(m).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127
def erode(m, r): return np.asarray(u8(m).filter(ImageFilter.MinFilter(2 * r + 1))) > 127
def median(a, k, hi=2.5): return np.asarray(u8(a / hi).filter(ImageFilter.MedianFilter(k))).astype(np.float32) / 255 * hi


def poly(pts, w=W, h=H):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return np.asarray(m) > 127


def lapel_zone(kind, pad=8):
    """Collar and lapels: left alone (their edges are drawn into the map)."""
    if kind == 'db':
        R, Lp = PROFILES['dbR'], PROFILES['dbL']
        right = [(r[2] + pad, r[0]) for r in R]
        left = [(r[2] - pad, r[0]) for r in Lp]
    else:
        R = PROFILES[kind]
        right = [(r[2] + pad, r[0]) for r in R]
        left = [(803 - r[2] - pad, r[0]) for r in R]
    top = min(p[1] for p in right + left)
    bot = max(p[1] for p in right + left) + pad
    pts = [(left[0][0], 0), (right[0][0], 0)] + right + [(right[-1][0], bot), (left[-1][0], bot)] + left[::-1]
    return poly(pts)


def load(name):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGBA')).astype(np.float32)
    assert a.shape[1] == W and a.shape[0] == 2 * H, (name, a.shape, 'already processed? use --src')
    return a[:H, :, 0] / 255 + a[H:, :, 0] / 255, a[:H, :, 3] / 255


def grainless(r, cloth):
    """Where the map has no cloth grain: the paint-outs and redrawn parts."""
    hp = r - gauss(r, 2.0)
    e = np.sqrt(np.maximum(gauss(hp * hp, 5.0), 0))
    ref = np.median(e[cloth])
    return (e < 0.45 * ref) & cloth


def refill(r, hole, known, iters=700):
    """Smooth fill of `hole` from the median level of the `known` cloth around it."""
    base = median(r, 9)
    k = (known & ~hole).astype(np.float32)
    v = gauss(base * k, 14) / np.maximum(gauss(k, 14), 1e-4)   # first guess
    v = np.where(hole, v, base)
    fixed = ~hole
    wgt = (known | hole).astype(np.float32)
    for _ in range(iters):
        p = np.pad(v * wgt, 1); pw = np.pad(wgt, 1)
        s = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        sw = pw[:-2, 1:-1] + pw[2:, 1:-1] + pw[1:-1, :-2] + pw[1:-1, 2:]
        nv = s / np.maximum(sw, 1e-6)
        v = np.where(fixed, v, nv)
    return v


def guided(r, rad, eps):
    """Edge keeping smoothing (guided filter, the map guiding itself)."""
    box = lambda a: gauss(a, rad)
    m = box(r); v = box(r * r) - m * m
    a = v / (v + eps); b = m - a * m
    return box(a) * r + box(b)


def decloud(r, cloth, inner, lo=0.28, hi=0.44):
    """Inside the lapels (away from their edges) the cloudy patches left from
    repainting go; only drawn lines stay. Edges and the chest are untouched."""
    k = cloth.astype(np.float32)
    base = gauss(median(r, 15) * k, 26) / np.maximum(gauss(k, 26), 1e-4)
    d = r - base
    m = gauss(np.asarray(F(np.abs(d)).filter(ImageFilter.MaxFilter(5))), 1.5)
    t = np.clip((m - lo) / (hi - lo), 0, 1); t = t * t * (3 - 2 * t)
    iw = np.clip(gauss(inner.astype(np.float32), 3.0), 0, 1)
    return np.where(cloth, r * (1 - iw) + (base + d * t) * iw, r)


def save(name, r, alpha):
    """2x, folds sharpened, outline tightened; same encoding as before."""
    big = lambda a: np.asarray(F(a).resize((2 * W, 2 * H), Image.LANCZOS))
    R = big(r)
    R = R + 0.6 * (R - gauss(R, 2.2))          # light unsharp on folds / edges
    A = np.clip(big(alpha), 0, 1)
    A = np.clip((A - 0.30) / 0.40, 0, 1); A = A * A * (3 - 2 * A)
    R = np.clip(R, 0.02, 2)
    M1 = np.clip(R, 0, 1) * 255; M2 = np.clip(R - 1, 0, 1) * 255; AA = A * 255
    top = np.dstack([M1, M1, M1, AA]); bot = np.dstack([M2, M2, M2, AA])
    Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
        os.path.join(OUT, name), quality=90, method=6)


BODY_SIDES = [[520, 200, 603], [560, 196, 607], [600, 188, 613], [640, 181, 621], [680, 175, 629], [720, 170, 632], [760, 165, 638], [800, 161, 642]]


def side_shadows(r, alpha, y0=690, y1=905, depth=34):
    """The sleeve's shadow down each side of the body was broken into two
    smudges by a paint-out: make it one even band again (a tall median along
    the body's edge)."""
    ys = np.arange(y0, y1)
    out = r.copy()
    for col, sign in ((1, 1), (2, -1)):
        xe = np.interp(ys, [b[0] for b in BODY_SIDES], [b[col] for b in BODY_SIDES])
        xe += np.where(ys > 800, (ys - 800) * (-0.1 * sign), 0)   # the side keeps running out to the hem
        strip = np.zeros((len(ys), depth), np.float32)
        cols = np.arange(W, dtype=np.float32)
        for i, y in enumerate(ys):
            strip[i] = np.interp(xe[i] + sign * (np.arange(depth) + 2), cols, r[y])
        win = 45
        pad = np.pad(strip, ((win, win), (0, 0)), mode='edge')
        med = np.stack([np.median(pad[i:i + 2 * win + 1], axis=0) for i in range(len(ys))])
        med = gauss(med, 2.0)
        wd = np.clip((depth - np.arange(depth)) / 8.0, 0, 1)
        wy = np.clip(np.minimum(ys - y0, y1 - 1 - ys) / 12.0, 0, 1)
        for i, y in enumerate(ys):
            lo, hi = sorted((int(xe[i] + sign * 1), int(xe[i] + sign * (depth + 2))))
            xs = np.arange(max(0, lo), min(W, hi + 1))
            d = sign * (xs - xe[i]) - 2                       # depth in from the edge
            inb = (d >= 0) & (d <= depth - 1)
            w = np.interp(d, np.arange(depth), wd) * wy[i] * inb * (alpha[y, xs] > 0.9)
            out[y, xs] = out[y, xs] * (1 - w) + np.interp(d, np.arange(depth), med[i]) * w
    return out


# The opening below the bottom button (flat on purpose) and the collar.
SB_WEDGE = poly([(400, 690), (470, 912), (330, 912)])
WEDGE_EDGE = [(400, 697), (396, 720), (390, 760), (383, 790), (372, 820), (358, 850), (347, 880), (337, 907)]


def capsule(x0, y0, x1, y1, hw):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    d.line([(x0, y0), (x1, y1)], fill=255, width=2 * hw)
    for x, y in ((x0, y0), (x1, y1)): d.ellipse([x - hw, y - hw, x + hw, y + hw], fill=255)
    return np.asarray(m) > 127


# Stray dark dabs left from the first lapel shape (x0, y0, x1, y1, half width).
DB_OLD_PEAK = [(578, 158, 548, 236, 13), (216, 138, 238, 190, 14)]
STRAYS = {'sb': [(266, 214, 266, 222, 13)], 'db-shawl': DB_OLD_PEAK, 'db-diamond': DB_OLD_PEAK}


def front(name, kind, strays=()):
    r, alpha = load(name)
    cloth = alpha > 0.9
    keep = lapel_zone(kind) | (SB_WEDGE if kind != 'db' else np.zeros((H, W), bool))
    g = grainless(r, cloth) & ~keep
    g = dilate(erode(g, 2), 2)                  # drop specks
    hole = dilate(g, 9) & cloth & ~keep
    for c in strays: hole |= capsule(*c) & cloth
    fill = refill(r, hole, cloth)               # continuous with the lapels too
    soft = np.clip(gauss(hole.astype(np.float32), 2.0) * 1.6 - 0.3, 0, 1)
    r2 = r * (1 - soft) + fill * soft
    if kind != 'db':
        r2 = side_shadows(r2, alpha)
        # The front edge beside the opening was stair-stepped with dark
        # specks of the photo showing through: close the gaps, smooth the line.
        band = dilate(poly(WEDGE_EDGE + [(x + 1, y) for x, y in WEDGE_EDGE[::-1]]), 9)
        closed = erode(dilate(alpha > 0.5, 4), 4)
        alpha = np.where(band & closed, 1.0, alpha)
        bw = np.clip(gauss(band.astype(np.float32), 2.0), 0, 1)
        r2 = r2 * (1 - bw) + gauss(r2, 1.4) * bw
    r2 = guided(r2, 3.0, 0.03 ** 2)             # mockup grain out, folds kept
    r2 = decloud(r2, cloth, erode(lapel_zone(kind, 10), 11))
    r2 = np.where(alpha > 0.02, r2, r)
    save(name, r2, alpha)
    return hole


def back(name):
    r, alpha = load(name)
    cloth = alpha > 0.9
    hp = r - gauss(r, 2.0)
    e = np.sqrt(np.maximum(gauss(hp * hp, 5.0), 0))
    g = (e < 0.35 * np.percentile(e[cloth], 90)) & cloth
    body = dilate(erode(dilate(g, 6), 22), 18)  # the smoothed body only (not calm spots on the sleeves)
    k = cloth.astype(np.float32)
    broad = gauss(r * k, 60) / np.maximum(gauss(k, 60), 1e-4)
    calm = 1 + (broad - 1) * 0.55               # one gentle gradient
    soft = np.clip(gauss(body.astype(np.float32), 5.0) * 1.4 - 0.2, 0, 1)
    r2 = r * (1 - soft) + calm * soft
    # Smudges on the sleeves (paint-outs carried over from the front): refill.
    spots = dilate(g & ~dilate(body, 6), 9) & cloth & ~body
    fill = refill(r2, spots, cloth)
    sw = np.clip(gauss(spots.astype(np.float32), 2.0) * 1.6 - 0.3, 0, 1)
    r2 = r2 * (1 - sw) + fill * sw
    # The sleeves' cloudy patches go; their folds and form stay.
    r2 = guided(r2, 9.0, 0.09 ** 2)
    save(name, r2, alpha)
    return body


def photo(name):
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    assert im.size == (W, H), (name, im.size)
    big = im.resize((2 * W, 2 * H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    big.save(os.path.join(OUT, name), quality=90, method=6, use_sharp_yuv=True)


if __name__ == '__main__':
    jobs = [('jacket-photo-shade-front.webp', 'notch'), ('jacket-photo-shade-front-peak.webp', 'peak'),
            ('jacket-photo-shade-front-diamond.webp', 'diamond'), ('jacket-photo-shade-front-shawl.webp', 'shawl'),
            ('jacket-photo-shade-front-db.webp', 'db'), ('jacket-photo-shade-front-db-diamond.webp', 'db'),
            ('jacket-photo-shade-front-db-shawl.webp', 'db')]
    for n, k in jobs:
        hole = front(n, k, STRAYS.get('sb' if k != 'db' else n[len('jacket-photo-shade-front-'):-5], ())); print(n, 'refilled px', int(hole.sum()))
    b = back('jacket-photo-shade-back.webp'); print('back body px', int(b.sum()))
    # The Arc map comes from a clean, pocketless photo: enlarge and sharpen only.
    r, alpha = load('jacket-photo-shade-front-arc-photo.webp'); save('jacket-photo-shade-front-arc-photo.webp', guided(r, 2.0, 0.03 ** 2), alpha)
    for n in ('jacket-photo-front.webp', 'jacket-photo-front-db.webp', 'jacket-photo-front-arc.webp'):
        photo(n)
