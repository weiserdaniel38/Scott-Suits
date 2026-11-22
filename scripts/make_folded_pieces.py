"""Folded pants and vest for the Your Suit picture (jacket-studio.js).

Daniel (2026-11-22) sent two reference photos: charcoal pants folded flat
(assets/pants-folded-reference-photo.png: waistband on the right with two
belt loops, a slit back pocket with a button, the leg folded back under on
the left, plain hem) and a five-button V-neck vest laid flat
(assets/vest-reference-photo.png: pointed bottom, a chest welt, two lower
welts, dark lining in the neck). The pieces under the jacket are built from
them like the jacket's own views: the photo's light and shadow become a
shading map, and the page fills it with the chosen fabric.

Each piece gets two maps, both in the jacket maps' layout (top half: shadow
map with the cloth outline as alpha, bottom half: highlights):

- "classic": everything in the photo,
- "plain": belt loops, back pocket and its button (pants) / the three
  pockets (vest) painted out, for when the customer picks something else;
  the page then draws that pick, or shows the photo's own inside the boxes
  printed below.

Run: python3 scripts/make_folded_pieces.py [check-folder]
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHECK = sys.argv[1] if len(sys.argv) > 1 else None


def u8(a):
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))


def f32(im):
    return np.asarray(im).astype(np.float32) / 255


def blur(a, s):
    """Gaussian blur of a float image."""
    n = max(1, int(np.ceil(3 * s)))
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / s) ** 2); k /= k.sum()
    a = np.asarray(a, np.float32)
    for ax in (0, 1):
        pad = [(0, 0), (0, 0)]; pad[ax] = (n, n)
        q = np.pad(a, pad, mode='edge'); m = a.shape[ax]
        a = sum(k[i] * np.take(q, np.arange(i, i + m), axis=ax) for i in range(2 * n + 1)).astype(np.float32)
    return a


def inpaint_rect(L, rect):
    """Smooth fill of a box from the cloth just outside its four sides (a
    blend of the side-to-side and top-to-bottom runs, exact on the border)."""
    x0, y0, x1, y1 = rect
    sm = lambda v: np.convolve(np.pad(v, 6, mode='edge'), np.ones(13) / 13, mode='valid')
    lf = sm(L[y0:y1, x0 - 4:x0].mean(1)); rt = sm(L[y0:y1, x1:x1 + 4].mean(1))
    tp = sm(L[y0 - 4:y0, x0:x1].mean(0)); bt = sm(L[y1:y1 + 4, x0:x1].mean(0))
    u = np.linspace(0, 1, x1 - x0)[None, :]; v = np.linspace(0, 1, y1 - y0)[:, None]
    c00, c01, c10, c11 = (lf[0] + tp[0]) / 2, (rt[0] + tp[-1]) / 2, (lf[-1] + bt[0]) / 2, (rt[-1] + bt[-1]) / 2
    f = ((1 - u) * lf[:, None] + u * rt[:, None] + (1 - v) * tp[None, :] + v * bt[None, :]
         - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c01 + (1 - u) * v * c10 + u * v * c11))
    out = L.copy(); out[y0:y1, x0:x1] = f
    # Feather the border so no box shows.
    w = np.zeros(L.shape, np.float32); w[y0:y1, x0:x1] = 1
    w = blur(w, 2.0)
    return L * (1 - w) + blur(out, 1.5) * w * 0 + out * w


def cloth_alpha(L, thresh=104):
    """The backdrop (and the soft shadow on it) is bright and joined up:
    flood it from the corners; what is left is cloth, bright button rims and
    all."""
    H, W = L.shape
    Ls = blur(L, 0.7)
    bright = u8((Ls > thresh).astype(np.float32))
    fill = bright.copy()
    for seed in ((3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)):
        if fill.getpixel(seed) == 255: ImageDraw.floodfill(fill, seed, 128)
    bg = (np.asarray(fill) == 128).astype(np.float32)
    # Soft edge from the brightness itself, only next to the backdrop.
    near = f32(u8(bg).filter(ImageFilter.MaxFilter(5)))
    edge = np.clip((thresh + 14 - Ls) / 28, 0, 1)
    return np.clip(np.where(bg > 0.5, 0, np.where(near > 0.5, edge, 1)), 0, 1)


def shade_map(L, alpha, ref, detail=1.7):
    """Brightness against the cloth's own level; edge pixels take the cloth's
    brightness beside them, not the mix with the backdrop."""
    Lmin = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))).astype(np.float32)
    Le = np.where(alpha < 0.98, np.minimum(L, Lmin), L)
    # The photo's own cloth grain goes (the fabric tile brings the weave);
    # folds, seams and edges stay: fine detail is kept only where it is
    # stronger than the grain.
    base = blur(Le, 6.0)
    d = blur(Le, 0.6) - base
    inside = alpha > 0.99
    t = 1.5 * float(np.median(np.abs(d[inside]))) / 0.6745
    # A seam or an edge is strong along its whole run; grain is not.
    run = blur(np.abs(d), 1.6)
    keep = np.clip((run - t * 0.55) / (t * 0.55), 0, 1)
    # The photo is dark cloth with tone-on-tone details: they are deepened so
    # they still read on any fabric.
    Ls = base + d * keep * detail
    r = np.maximum(Ls, 1) / ref
    return np.where(r < 1, 1 - (1 - r) * 0.95, r)


def save(name, r, alpha, box, size):
    x0, y0, x1, y1 = box
    crop = lambda a: np.asarray(Image.fromarray(a[y0:y1, x0:x1].astype(np.float32), 'F').resize(size, Image.LANCZOS))
    R = crop(r); A = np.clip(crop(alpha), 0, 1) * 255
    hi = np.clip(R - 1, 0, None)
    hi = 0.7 * (1 - np.exp(-hi / 0.7))          # glints (button rims) eased off
    M1 = np.clip(R, 0, 1) * 255; M2 = np.clip(hi, 0, 1) * 255
    top = np.dstack([M1, M1, M1, A]); bot = np.dstack([M2, M2, M2, A])
    Image.fromarray(np.concatenate([top, bot], 0).astype(np.uint8), 'RGBA').save(
        os.path.join(ROOT, 'assets', name), quality=92, method=6)
    if CHECK:
        v = np.dstack([np.clip(R, 0, 1.6) / 1.6 * 255] * 3) * (A[..., None] / 255) + np.array([236, 228, 221]) * (1 - A[..., None] / 255)
        Image.fromarray(v.astype(np.uint8)).save(os.path.join(CHECK, name.replace('.webp', '.png')))


def local(box, S):
    return lambda x, y: (round((x - box[0]) * S, 1), round((y - box[1]) * S, 1))


def rect_local(P, r):
    a, b = P(r[0], r[1]), P(r[2], r[3])
    return [a[0], a[1], round(b[0] - a[0], 1), round(b[1] - a[1], 1)]


# ---- Pants ------------------------------------------------------------------
src = Image.open(os.path.join(ROOT, 'assets', 'pants-folded-reference-photo.png')).convert('RGB')
L = np.asarray(src).astype(np.float32).mean(2)
BOX = (40, 60, 1708, 918); S = 0.38          # 634 x 326 picture units
OUT = (1268, 652)                            # 2x
alpha = cloth_alpha(L)
ref = float(np.median(L[alpha > 0.99]))
# Loops, pocket and button (photo pixels). The loops' boxes stop just inside
# the waistband's edge; the edge itself is copied from the rows above.
LOOPS = [(1532, 184, 1632, 234), (1536, 616, 1632, 664)]
POCKET = (1424, 326, 1478, 658)
BUTTON = (1370, 454, 1424, 512)
# Painted out as one box (the button's tab joins the pocket).
POCKET_OUT = (1366, 322, 1484, 662)
save('suit-pants-folded-shade.webp', shade_map(L, alpha, ref), alpha, BOX, OUT)
Lp = L.copy(); ap = alpha.copy()
for x0, y0, x1, y1 in LOOPS:
    Lp[y0:y1, x1 - 2:] = L[y0 - 5, x1 - 2:][None, :]
    ap[y0:y1, x1 - 2:] = alpha[y0 - 5, x1 - 2:][None, :]
for r in LOOPS + [POCKET_OUT]: Lp = inpaint_rect(Lp, r)
save('suit-pants-folded-shade-plain.webp', shade_map(Lp, ap, ref), ap, BOX, OUT)
P = local(BOX, S)
print('PANTS size', [round((BOX[2] - BOX[0]) * S, 1), round((BOX[3] - BOX[1]) * S, 1)], 'Lref %.1f' % ref)
print('PANTS loops', [rect_local(P, (r[0], r[1], 1656, r[3])) for r in LOOPS])
print('PANTS pocket', rect_local(P, POCKET), 'button', rect_local(P, BUTTON), 'button centre', P(1418, 482))
print('PANTS waistband seam x', P(1557, 0)[0], 'edge x', P(1638, 0)[0], 'top y', P(0, 96)[1], 'bottom y', P(0, 800)[1])
print('PANTS hem', P(1097, 668), P(927, 883), 'leg edges run', (0.838, 0.547), (0.937, 0.349), 'units per cm %.2f' % (14.5 * S))

# ---- Vest -------------------------------------------------------------------
src = Image.open(os.path.join(ROOT, 'assets', 'vest-reference-photo.png')).convert('RGB')
L = np.asarray(src).astype(np.float32).mean(2)
BOX = (60, 120, 980, 1400); S = 0.25          # 230 x 320 picture units
OUT = (920, 1280)                             # the photo's own size (4x)
alpha = cloth_alpha(L)
LINING = [(371, 150), (655, 150), (655, 157), (511, 592), (371, 159)]
m = Image.new('L', (L.shape[1] * 2, L.shape[0] * 2), 0)
ImageDraw.Draw(m).polygon([(x * 2, y * 2) for x, y in LINING], fill=255)
lin = f32(m.resize((L.shape[1], L.shape[0]), Image.BOX))
ref_c = float(np.median(L[(alpha > 0.99) & (lin < 0.01)]))
ref_l = float(np.median(L[(alpha > 0.99) & (lin > 0.99)]))
ref = ref_c * (1 - lin) + ref_l * lin
CHEST = (672, 530, 832, 582)
LOWER = [(175, 950, 397, 996), (641, 950, 860, 996)]
save('suit-vest-shade.webp', shade_map(L, alpha, ref), alpha, BOX, OUT)
Lp = L.copy()
for r in [CHEST] + LOWER: Lp = inpaint_rect(Lp, r)
save('suit-vest-shade-plain.webp', shade_map(Lp, alpha, ref), alpha, BOX, OUT)
P = local(BOX, S)
print('VEST size', [230, 320], 'Lref cloth %.1f lining %.1f' % (ref_c, ref_l))
print('VEST lining', 'M' + ' L'.join('%g,%g' % P(x, y) for x, y in LINING) + ' Z')
print('VEST chest', rect_local(P, CHEST), 'lower', [rect_local(P, r) for r in LOWER])
print('VEST centre x', P(516, 0)[0], 'top y', P(0, 158)[1], 'point y', P(0, 1378)[1])
print('VEST welts: chest', rect_local(P, (680, 538, 824, 574)), 'lower', rect_local(P, (183, 958, 389, 988)), rect_local(P, (649, 958, 852, 988)))
