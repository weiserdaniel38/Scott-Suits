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
- "plain" (pants): belt loops, back pocket and its button painted out, for
  when the customer picks something else; the page then draws that pick, or
  shows the photo's own inside the boxes printed below.

The vest photo dresses the three-piece's vest as it is. The Vest Only
picture is built on the same photo with its buttons, buttonholes and welts
painted out (last section); the three welts are lifted out on their own
(suit-vest-welts.webp) and put back when the customer picks a welt.

The vest's back (Daniel 2026-11-22, assets/vest-back-reference-photo.png: a
plain satin back with a centre seam and two darts, no strap) gets one map in
the vest's own piece space, scaled to the front's height; the page fills it
with the lining and draws the adjuster strap and buckle the customer picks.

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


def shade_map(L, alpha, ref, detail=1.7, grain=1.5, fine=0.6, calm_light=False):
    """Brightness against the cloth's own level; edge pixels take the cloth's
    brightness beside them, not the mix with the backdrop."""
    Lmin = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))).astype(np.float32)
    Le = np.where(alpha < 0.98, np.minimum(L, Lmin), L)
    # The photo's own cloth grain goes (the fabric tile brings the weave);
    # folds, seams and edges stay: fine detail is kept only where it is
    # stronger than the grain.
    base = blur(Le, 6.0)
    d = blur(Le, fine) - base
    inside = alpha > 0.99
    t = grain * float(np.median(np.abs(d[inside]))) / 0.6745
    # A seam or an edge is strong along its whole run; grain is not.
    run = blur(np.abs(d), 1.6)
    keep = np.clip((run - t * 0.55) / (t * 0.55), 0, 1)
    # The photo is dark cloth with tone-on-tone details: they are deepened so
    # they still read on any fabric.
    if calm_light:
        # Only the dark details are deepened; light ones (stray pale fibres,
        # the glow beside a seam) are left as they are, less the grain.
        Ls = base + np.minimum(d, 0) * keep * detail + np.maximum(np.maximum(d, 0) - 0.8 * t, 0)
    else:
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
OUT = (690, 960)                              # 3x (scaled down, as the pants are, which evens out the grain)
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
VEST_MAP = dict(grain=2.0, calm_light=True)
save('suit-vest-shade.webp', shade_map(L, alpha, ref, **VEST_MAP), alpha, BOX, OUT)
Lp = L.copy()
for r in [CHEST] + LOWER: Lp = inpaint_rect(Lp, r)
vest_src, vest_Lp, vest_alpha, VEST_BOX = src, Lp, alpha, BOX
# The photo's three welts on their own, for the Vest Only picture (which is
# built on this photo without them): the photo's light over the same cloth with the
# welt painted out. One cell per welt (chest, viewer's left lower, right
# lower), the shadow in the left column (black by alpha), the light in the
# right one (white by alpha at 3x).
Rc, Rp = shade_map(L, alpha, ref, **VEST_MAP), shade_map(Lp, alpha, ref, **VEST_MAP)
PAD, CW, CHH = 10, 244, 72
sheet = np.zeros((3 * CHH, 2 * CW, 4), np.uint8); sheet[..., :3] = 0; sheet[:, CW:, :3] = 255
cells = []
for i, (x0, y0, x1, y1) in enumerate([CHEST] + LOWER):
    bx = (x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD)
    q = Rc[bx[1]:bx[3], bx[0]:bx[2]] / np.maximum(Rp[bx[1]:bx[3], bx[0]:bx[2]], 0.05)
    h, w = q.shape
    fy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]; fx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    fade = np.clip(np.minimum(fy, fx) / 6.0, 0, 1)
    sh = (1 - np.minimum(q, 1)) * fade; li = 3 * 0.6 * (1 - np.exp(-np.maximum(q - 1, 0) / 0.6)) * fade
    # The welt's long lines are evened along their length (a thin line that
    # comes and goes reads as dashes on pale cloth); its two ends stay.
    kx = np.exp(-0.5 * (np.arange(-20, 21) / 7.0) ** 2); kx /= kx.sum()
    run = lambda a: np.stack([np.convolve(np.pad(r_, 20, mode='edge'), kx, mode='valid') for r_ in a])
    mid = np.clip((np.minimum(np.arange(w), np.arange(w)[::-1]) - PAD - 18) / 10.0, 0, 1)[None, :]
    sh = sh * (1 - mid) + run(sh) * mid; li = li * (1 - mid) + run(li) * mid
    sheet[i * CHH:i * CHH + h, 0:w, 3] = np.clip(sh, 0, 1) * 255
    sheet[i * CHH:i * CHH + h, CW:CW + w, 3] = np.clip(li, 0, 1) * 255
    cells.append([0, i * CHH, w, h])
Image.fromarray(sheet, 'RGBA').save(os.path.join(ROOT, 'assets', 'suit-vest-welts.webp'), quality=94, method=6)
print('VEST welt cells [x, y, w, h] (light: x +%d)' % CW, cells, 'pad', PAD)
if CHECK:
    v = np.full(sheet.shape[:2] + (3,), 120.0)
    v = v * (1 - sheet[..., 3:4] / 255.0 * np.where(sheet[..., :1] == 0, 1, 0)) + (255 - v) * (sheet[..., 3:4] / 255.0 / 3) * np.where(sheet[..., :1] == 255, 1, 0)
    Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, 'suit-vest-welts.png'))
P = local(BOX, S)
print('VEST size', [230, 320], 'Lref cloth %.1f lining %.1f' % (ref_c, ref_l))
print('VEST lining', 'M' + ' L'.join('%g,%g' % P(x, y) for x, y in LINING) + ' Z')
print('VEST chest', rect_local(P, CHEST), 'lower', [rect_local(P, r) for r in LOWER])
print('VEST centre x', P(516, 0)[0], 'top y', P(0, 158)[1], 'point y', P(0, 1378)[1])
print('VEST welts: chest', rect_local(P, (680, 538, 824, 574)), 'lower', rect_local(P, (183, 958, 389, 988)), rect_local(P, (649, 958, 852, 988)))

# ---- Vest back ---------------------------------------------------------------
src = Image.open(os.path.join(ROOT, 'assets', 'vest-back-reference-photo.png')).convert('RGB')
L = np.asarray(src).astype(np.float32).mean(2)
alpha = cloth_alpha(L)
rows = np.where((alpha > 0.5).sum(1) > 50)[0]
TOP, BOT = int(rows[0]), int(rows[-1])
xs = np.where(alpha[TOP + 30] > 0.5)[0]
CXB = (xs[0] + xs[-1]) / 2
# Same piece space as the front (230 x 320, centre x 114, top y 9.5), the
# back as tall as the front from its top to its point (301.25 units).
S = 301.25 / (BOT - TOP)
BOX = (int(round(CXB - 114 / S)), int(round(TOP - 9.5 / S)), int(round(CXB + 116 / S)), int(round(TOP + 310.5 / S)))
ref = float(np.median(L[alpha > 0.99]))
# Satin: no weave to remove, so the photo's own soft light is kept as it is.
save('suit-vest-back-shade.webp', shade_map(L, alpha, ref, detail=1.3, grain=2.4, calm_light=True), alpha, BOX, OUT)
P = local(BOX, S)
side = lambda y: (round(P(int(np.argmax(alpha[y] > 0.5)), y)[0], 1), round(P(int(L.shape[1] - 1 - np.argmax(alpha[y][::-1] > 0.5)), y)[0], 1))
print('VEST BACK box', BOX, 'scale %.4f' % S, 'Lref %.1f' % ref, 'centre x', P(CXB, 0)[0], 'top y', P(0, TOP)[1], 'bottom y', P(0, BOT)[1])
print('VEST BACK sides [y, left x, right x]', [[round(P(0, y)[1], 1)] + list(side(y)) for y in range(TOP + 200, BOT - 40, 100)])

# ---- Vest front, plain (Vest Only) --------------------------------------------
# Daniel 2026-11-22: "I don't like the way you did the vest at all ... no weird
# shapes, each line is straight". Vest Only is built on the first vest photo
# (the three-piece's), not on the second, blank one (its front edge was wavy):
# the photo with its buttons, buttonholes and welts painted out. The page
# draws the picked buttons, pockets, lapels, neck and bottom on this cloth.
# Three maps, all in the vest's piece space:
# - suit-vest-plain-shade.webp: the photo (cloth and the lining in the neck),
# - suit-vest-plain-cloth.webp: the cloth's light carried smoothly across
#   everything that is not plain front cloth (the neck, the front edge, the
#   darts, the gap between the points, the backdrop), for cloth the page adds,
# - suit-vest-plain-lining.webp: the same for the lining in the neck.
src, L, alpha, BOX, S, OUT = vest_src, vest_Lp.copy(), vest_alpha, VEST_BOX, 0.25, (690, 960)
PH, PW = L.shape
BUTTONS = [664, 782, 903, 1024, 1143]          # photo y of the five buttons (x 520)
for yc in BUTTONS: L = inpaint_rect(L, (501, yc - 25, 566, yc + 25))
# The two front darts run on behind the lower welts: with the welts painted
# out they are drawn through (the dart's own dark line from just below).
DARTS = [[(298, 690), (294, 950), (297, 996), (289, 1090), (273, 1240)], [(733, 690), (737, 950), (748, 996), (760, 1180), (764, 1245)]]
dart_x = lambda d, y: np.interp(y, [q[1] for q in d], [q[0] for q in d])
Dl = blur(L, 1.2) - blur(L, 7)
for d in DARTS:
    prof = np.mean([Dl[y, int(round(dart_x(d, y))) - 6:int(round(dart_x(d, y))) + 7] for y in range(1010, 1110)], 0)
    prof = np.minimum(prof - np.median(prof), 0) * np.hanning(15)[1:-1] ** 0.5
    for y in range(946, 1000):
        x = int(round(dart_x(d, y)))
        L[y, x - 6:x + 7] += prof * min(1, (y - 945) / 4.0, (1000 - y) / 4.0)
# Each dart is evened along its length (a faint line that comes and goes
# reads as dashes on pale cloth), both to the same depth.
def dart_line(d):
    ys = np.arange(d[0][1], d[-1][1])
    xs = []
    for y in ys:
        c = int(round(dart_x(d, y))); seg = Dl2[y, c - 6:c + 7]
        xs.append(c - 6 + int(np.argmin(seg)) if seg.min() < -2.5 else c)
    xs = np.array(xs, np.float32)
    xs = np.array([np.median(xs[max(0, i - 30):i + 31]) for i in range(len(xs))])
    return ys, np.convolve(np.pad(xs, 20, mode='edge'), np.ones(41) / 41, mode='valid')


Dl2 = blur(L, 1.2) - blur(L, 7)
ky = np.exp(-0.5 * (np.arange(-60, 61) / 25.0) ** 2); ky /= ky.sum()
lines = []
for d in DARTS:
    ys, xs = dart_line(d)
    band = np.stack([Dl2[y, int(round(x)) - 7:int(round(x)) + 8] for y, x in zip(ys, xs)])
    even = np.stack([np.convolve(np.pad(band[:, j], 60, mode='edge'), ky, mode='valid') for j in range(band.shape[1])], 1)
    lines.append((ys, xs, band, even))
depth = np.mean([-e.min(1).mean() for _, _, _, e in lines])
for ys, xs, band, even in lines:
    even = np.minimum(even - np.median(even, 1, keepdims=True), 0) * (depth / max(-even.min(1).mean(), 1e-3))
    ends = np.clip(np.minimum(np.arange(len(ys)), np.arange(len(ys))[::-1]) / 40.0, 0, 1)[:, None]
    win = np.hanning(17)[1:-1][None, :] ** 0.35
    for i, (y, x) in enumerate(zip(ys, xs)):
        x = int(round(x))
        L[y, x - 7:x + 8] += ((even[i] * ends[i] - band[i]) * win[0])
CXF = 515.5
P = local(BOX, S)
Ls = blur(L, 1.2)
gx = np.zeros_like(Ls); gx[:, 1:-1] = Ls[:, 2:] - Ls[:, :-2]


def trace(y0, y1, prior, sign, win=14):
    """Per row, the x of the strongest brightness step of the given sign
    near the prior line, then smoothed along the run."""
    ys = np.arange(y0, y1)
    out = []
    for y in ys:
        c = int(round(prior(y)))
        seg = gx[y, c - win:c + win + 1] * sign
        out.append(c - win + int(np.argmax(seg)))
    out = np.array(out, np.float32)
    med = np.array([np.median(out[max(0, i - 6):i + 7]) for i in range(len(out))])
    return ys, np.convolve(np.pad(med, 8, mode='edge'), np.ones(17) / 17, mode='valid')


# The neck: the thin binding along the back of the neck (its lower edge is the
# lining's top) and the two V edges. The top front's edge (viewer's right)
# runs on past the bottom of the V, turns down and is one vertical line to
# its corner, then follows its hem to the top of the gap.
SEAM = lambda x: 180 - 17 * ((x - 513) / 142.0) ** 2           # the binding's lower edge (photo y)
YV0 = 172
pL = lambda y: 371 + (y - 158) * 0.3226
pR = lambda y: 655 - (y - 158) * 0.3213
def smooth_edge(ys, xs, deg=2):
    """A traced edge as one smooth curve: a low polynomial through it, the
    rows where the trace caught something else left out."""
    keep = np.ones(len(ys), bool)
    for _ in range(4):
        c = np.polyfit(ys[keep], xs[keep], deg)
        keep = np.abs(xs - np.polyval(c, ys)) < 2.0
    return np.polyval(c, ys).astype(np.float32)


def cross(y0, y1, prior, sign, thr=52.0, win=14):
    """Per row, where the cloth (bright) gives way to the lining (dark),
    coming from the cloth's side (the lining's own shadow beside the edge
    is then never taken for it)."""
    ys = np.arange(y0, y1)
    out = []
    for y in ys:
        c = int(round(prior(y)))
        xs_ = np.arange(c - sign * win, c + sign * win + sign, sign)
        row = Ls[y, xs_]
        j = int(np.argmax(row < thr)) if (row < thr).any() else win
        f = (row[j - 1] - thr) / max(row[j - 1] - row[j], 1e-3) if j > 0 else 0
        out.append(xs_[j] - sign * (1 - f))
    out = np.array(out, np.float32)
    med = np.array([np.median(out[max(0, i - 6):i + 7]) for i in range(len(out))])
    return ys, np.convolve(np.pad(med, 8, mode='edge'), np.ones(17) / 17, mode='valid')


ysL, VL = cross(YV0, 600, pL, +1)
ysR, VR = cross(YV0, 600, pR, -1)
fit = ysL < 575
VLs, VRs = smooth_edge(ysL[fit], VL[fit]), smooth_edge(ysR[fit], VR[fit])
print('plain: V edges, trace off the smooth curve (px, median): left %.2f right %.2f' % (np.median(np.abs(VL[fit] - VLs)), np.median(np.abs(VR[fit] - VRs))))
VL[:len(VLs)] = VLs; VR[:len(VRs)] = VRs
# The bottom of the V: where the left edge runs in under the top front.
gap = VR - VL
iv = int(np.argmax(gap < 2.5)) if (gap < 2.5).any() else len(gap) - 1
YV1 = int(ysL[iv]); XVB = float((VL[iv] + VR[iv]) / 2)
ysL, VL, ysR, VR = ysL[:iv + 1], VL[:iv + 1], ysR[:iv + 1], VR[:iv + 1]
cols = np.arange(int(CXF) - 40, int(CXF) + 40)
bottom = np.array([np.max(np.where(alpha[:, x] > 0.5)[0]) for x in cols])
APEX = (int(cols[np.argmin(bottom)]), int(bottom.min()))
prior_pts = [(YV1, XVB), (640, 497), (680, 491), (720, 490), (1200, 490), (1225, 495), (APEX[1], APEX[0])]
prior = lambda y: np.interp(y, [p[0] for p in prior_pts], [p[1] for p in prior_pts])
ysC, CLt = trace(YV1 + 1, APEX[1] - 2, prior, +1, win=9)
# Its long middle is one vertical line (the median of the trace).
EDGE_X = float(np.median(CLt[(ysC > 720) & (ysC < 1180)]))
print('plain: front edge x %.1f, off it (px): %.2f' % (EDGE_X, np.abs(CLt[(ysC > 720) & (ysC < 1180)] - EDGE_X).max()))
i0 = int(np.argmax(np.abs(CLt - EDGE_X) < 0.75)); i1 = len(CLt) - 1 - int(np.argmax(np.abs(CLt[::-1] - EDGE_X) < 0.75))
CLs = CLt.copy(); CLs[i0:i1 + 1] = EDGE_X
# The hem: side corners, points, the gap's top.
hem = np.array([np.max(np.where(alpha[:, x] > 0.5)[0]) if (alpha[:, x] > 0.5).any() else 0 for x in range(PW)])
xl = int(np.argmax(hem[:int(CXF)])); xr = int(CXF) + int(np.argmax(hem[int(CXF):]))
PTL, PTR = (xl, int(hem[xl])), (xr, int(hem[xr]))
side = lambda y: (int(np.argmax(alpha[y] > 0.5)), int(PW - 1 - np.argmax(alpha[y][::-1] > 0.5)))
# The side's bottom corner: where the outline turns from the side into the hem.
corner = []
for sgn in (0, 1):
    pts = [(side(y)[sgn], y) for y in range(1000, PTL[1])]
    xs_ = np.array([p[0] for p in pts]); best = xs_.min() if sgn == 0 else xs_.max()
    ys_ = [p[1] for p in pts if p[0] == best]
    corner.append((int(best), int(round(np.mean(ys_)))))
# The sides just above the corners (for a longer side, other bottoms), and
# the shoulders' top line.
sides = [[side(y)[0], side(y)[1], y] for y in range(880, corner[0][1] - 8, 40)]
sh = [np.argmax(alpha[:, x] > 0.5) for x in (260, 340, 700, 780)]
print('plain: BOX', BOX, 'apex', APEX, 'points', PTL, PTR, 'corners', corner, 'V bottom (%.1f, %d)' % (XVB, YV1))

# Lining region (photo pixels): under the binding, between the V edges.
poly = [(float(VL[0]) - 2, 150), (float(VL[0]), YV0)] + [(float(x), int(y)) for y, x in zip(ysL, VL)][::20] + [(XVB, YV1 + 3)] + [(float(x), int(y)) for y, x in zip(ysR, VR)][::-20] + [(float(VR[0]), YV0), (float(VR[0]) + 2, 150)]
m = Image.new('L', (PW * 2, PH * 2), 0)
ImageDraw.Draw(m).polygon([(x * 2, y * 2) for x, y in poly], fill=255)
lin = f32(m.resize((PW, PH), Image.BOX))
yy, xx = np.mgrid[0:PH, 0:PW]
lin = lin * np.clip(yy - SEAM(xx) + 0.5, 0, 1)
ref_c = float(np.median(L[(alpha > 0.99) & (lin < 0.01)]))
ref_l = float(np.median(L[(alpha > 0.99) & (lin > 0.99)]))
ref = ref_c * (1 - lin) + ref_l * lin
VEST_MAP = dict(grain=2.0, calm_light=True)
def carry(R, valid):
    """R where valid; elsewhere R's own smooth run carried across (coarse to
    fine, each scale used where enough valid cloth is near)."""
    v = valid.astype(np.float32)
    out = None
    for s in (96, 48, 24, 12, 6, 3):
        w = blur(v, s); est = blur(R * v, s) / np.maximum(w, 1e-4)
        if out is None: out = np.where(w > 1e-3, est, float(np.median(R[valid])))
        else:
            a = np.clip((w - 0.12) / 0.3, 0, 1)
            out = out * (1 - a) + est * a
    f = blur(v, 2.0); f = np.clip((f - 0.75) / 0.25, 0, 1)
    return out * (1 - f) + R * f


def grow(mask, n):
    return f32(u8(mask.astype(np.float32)).filter(ImageFilter.MaxFilter(2 * n + 1))) > 0.5


R = shade_map(L, alpha, ref, **VEST_MAP)
# Along the outline the photo's last pixels are speckled (the backdrop's light
# and the cloth's shadow mixed): there the map is the cloth just inside,
# carried out to the edge and eased a little darker toward it.
rim = (alpha > 0.02) & grow(alpha < 0.99, 13) & (lin < 0.01)
near = np.clip((1 - blur((alpha > 0.5).astype(np.float32), 6.0)) / 0.5, 0, 1)
R = np.where(rim, carry(R, ~(grow(alpha < 0.99, 14) | grow(lin > 0.01, 6))) * (1 - 0.14 * near), R)
save('suit-vest-plain-shade.webp', R, alpha, BOX, OUT)

closing = np.zeros(L.shape, bool)
for y, x in zip(ysC, CLs): closing[int(y), int(x) - 46:int(x) + 22] = True
closing[YV1 - 30:YV1 + 10][:, int(XVB) - 50:int(XVB) + 28] = True
closing[APEX[1] - 16:APEX[1] + 4][:, APEX[0] - 26:APEX[0] + 26] = True
darts = np.zeros(L.shape, bool)
for d in DARTS:
    for y in range(d[0][1] - 20, min(PH, d[-1][1] + 40)):
        x = int(round(dart_x(d, min(max(y, d[0][1]), d[-1][1])))); darts[y, x - 9:x + 10] = True
not_cloth = grow(alpha < 0.99, 14) | grow(lin > 0.01, 12) | closing | darts | (yy < SEAM(xx) + 8) & (xx > VL[0] - 20) & (xx < VR[0] + 20)
FIELD = carry(R, ~not_cloth)
ones = np.ones(L.shape, np.float32)
save('suit-vest-plain-cloth.webp', FIELD, ones, BOX, OUT)
not_lin = ~((lin > 0.99) & ~grow(lin < 0.99, 12))
FLIN = carry(R, ~not_lin)
save('suit-vest-plain-lining.webp', FLIN, ones, BOX, (345, 480))

pt = lambda p: [P(p[0], p[1])[0], P(p[0], p[1])[1]]
r2 = lambda v: round(float(v), 2)
crow = [pt((XVB, YV1))] + [pt((CLs[i], y)) for i, y in enumerate(ysC) if (i % 10 == 0 and (i < i0 or i > i1)) or i in (i0, i1)] + [pt(APEX)]
seam = [[P(x, 0)[0], P(0, SEAM(x))[1]] for x in np.linspace(VL[0], VR[0], 9)]
vrows = [[P(0, y)[1], P(VL[i], 0)[0], P(VR[i], 0)[0]] for i, y in enumerate(ysL) if i % 40 == 0 or i == len(ysL) - 1]
print('const VEST_PLAIN = ' + __import__('json').dumps({
    'cx': P(CXF, 0)[0],
    'v': vrows, 'vb': pt((XVB, YV1)),
    'seam': seam, 'edgeX': r2((EDGE_X - BOX[0]) * S), 'close': crow, 'apex': pt(APEX),
    'points': [pt(PTL), pt(PTR)], 'corners': [pt(corner[0]), pt(corner[1])],
    'sides': [[r2((a - BOX[0]) * S), r2((b - BOX[0]) * S), r2((y - BOX[1]) * S)] for a, b, y in sides],
    'shoulders': [[r2((x - BOX[0]) * S), r2((int(y) - BOX[1]) * S)] for x, y in zip((260, 340, 700, 780), sh)],
    'buttons': [[r2((520 - BOX[0]) * S), r2((y - BOX[1]) * S)] for y in BUTTONS],
    'lining': 'M' + ' L'.join('%g,%g' % P(x, y) for x, y in [q for q in poly if q[1] > 151] + [(x, SEAM(x)) for x in np.linspace(VR[0], VL[0], 9)]) + ' Z'}) + ';')
print('plain: Lref cloth %.1f lining %.1f' % (ref_c, ref_l))
if CHECK:
    ov = src.copy(); d = ImageDraw.Draw(ov)
    d.line([(float(x), int(y)) for y, x in zip(ysL, VL)], fill=(255, 60, 60)); d.line([(float(x), int(y)) for y, x in zip(ysR, VR)], fill=(255, 60, 60))
    d.line([(float(x), int(y)) for y, x in zip(ysC, CLs)], fill=(60, 255, 60)); d.line([(x, SEAM(x)) for x in range(372, 655, 6)], fill=(60, 160, 255))
    for p in (APEX, PTL, PTR, corner[0], corner[1]): d.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), outline=(255, 255, 0))
    ov.save(os.path.join(CHECK, 'vest-plain-trace.png'))
    Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, 'vest-plain-L.png'))
