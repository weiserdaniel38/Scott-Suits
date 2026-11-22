"""Single breasted front for the Your Suit picture, from Daniel's reference
photo (2026-11-22, "jacket": a charcoal two-button notch-lapel jacket on a
shirt and tie, assets/jacket-front-sb-reference-photo.png).

Like the back and inside views: the photo keeps the shirt, tie and cuffs;
its light and shadow on the cloth become a shading map that the page fills
with the chosen fabric. The photo's own buttons, buttonholes, chest welt and
flap pockets are painted out, and the page draws the customer's picks.

Writes (1.5x the 800 x 952 picture):
  assets/jacket-photo-front2.webp            shirt, tie (recoloured to the old
                                             photo's burgundy so the page's tie
                                             recolour finds it), cuffs, on the
                                             page colour
  assets/jacket-photo-shade-front2.webp      shading, notch lapels (top half:
                                             shadows + cloth alpha, bottom
                                             half: highlights)
Prints the measurements jacket-studio.js needs.

Run: python3 scripts/make_jacket_photo_front2.py [check-folder]
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHECK = sys.argv[1] if len(sys.argv) > 1 else None
PAGE = np.array([236, 228, 221], np.float32)      # #ECE4DD
# Picture units: x = (photo px - CX) * S + 400, y = photo px * S + OY.
# Chosen so the photo's two front buttons land where the page already draws
# them (409,525 and 387,649) and the lapels mirror about x 401.5.
S = 0.681; CX = 556.3; OY = 19.0
K = 1.5                                           # output px per unit
VBW, VBH = 800, 952


def U(x, y): return (round((x - CX) * S + 400, 1), round(y * S + OY, 1))


def u8(a): return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).copy()


def f32(im): return np.asarray(im).astype(np.float32) / 255


def blur(a, s):
    n = max(1, int(np.ceil(3 * s)))
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / s) ** 2); k /= k.sum()
    a = np.asarray(a, np.float32)
    for ax in (0, 1):
        pad = [(0, 0), (0, 0)]; pad[ax] = (n, n)
        q = np.pad(a, pad, mode='edge'); m = a.shape[ax]
        a = sum(k[i] * np.take(q, np.arange(i, i + m), axis=ax) for i in range(2 * n + 1)).astype(np.float32)
    return a


def poly(pts, shape, ss=4):
    m = Image.new('L', (shape[1] * ss, shape[0] * ss), 0)
    ImageDraw.Draw(m).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return f32(m.resize((shape[1], shape[0]), Image.BOX))


def disc(x, y, r, shape): 
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return ((xx - x) ** 2 + (yy - y) ** 2 <= r * r).astype(np.float32)


def rect(x0, y0, x1, y1, shape):
    m = np.zeros(shape, np.float32); m[y0:y1, x0:x1] = 1; return m


def inpaint(L, hole, src):
    """Fill `hole` smoothly from the `src` pixels around it (pull-push)."""
    val = np.where(src, L, 0).astype(np.float32); wt = src.astype(np.float32)
    pyr = []
    while min(val.shape) > 2 and (wt < 1).any():
        pyr.append((val, wt))
        h, w = val.shape; h2, w2 = (h + 1) // 2 * 2, (w + 1) // 2 * 2
        v = np.pad(val * wt, ((0, h2 - h), (0, w2 - w))); q = np.pad(wt, ((0, h2 - h), (0, w2 - w)))
        sv = v.reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3)); sw = q.reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
        val = np.where(sw > 0, sv / np.maximum(sw, 1e-6), 0).astype(np.float32); wt = np.minimum(sw, 1).astype(np.float32)
    for v, q in reversed(pyr):
        up = np.asarray(Image.fromarray(val, 'F').resize((v.shape[1], v.shape[0]), Image.BILINEAR))
        val = v * q + up * (1 - q)
    out = L.copy()
    sm = blur(val, 2.0)
    out[hole] = sm[hole]
    return out


src = Image.open(os.path.join(ROOT, 'assets', 'jacket-front-sb-reference-photo.png')).convert('RGB')
A = np.asarray(src).astype(np.float32)
H, W = A.shape[:2]
L = A.mean(2)
Ls = blur(L, 0.7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# ---- Backdrop: bright and joined to the border (the floor shadow too) ------
ok = ((Ls >= 226) & (Ls <= 245)) | ((yy > 1180) & (Ls >= 172) & (Ls <= 245))
# Between the body and each hanging sleeve the backdrop is brighter still
# (as bright as the shirt cuffs, which is why the limit above stops at 245).
GAPS = [(186, 520, 300, 1238), (812, 520, 926, 1238)]
for x0, y0, x1, y1 in GAPS:
    ok |= (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & (Ls >= 226)
# (The ghost mannequin's neck is nearly the backdrop's brightness: the fill
# must not run down into it and across the shirt collar.)
NECK = [(446, 62), (458, 36), (480, 26), (560, 22), (640, 27), (658, 40), (672, 62), (700, 480), (420, 480)]
ok &= poly(NECK, L.shape) < 0.5
f = u8(ok.astype(np.float32))
for seed in ((2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3), (W // 2, H - 3), (2, H // 2), (W - 3, H // 2)):
    if f.getpixel(seed) == 255: ImageDraw.floodfill(f, seed, 128)
backdrop = np.asarray(f) == 128

# ---- The shirt V: between the two lapel roll lines --------------------------
# Per row, where the bright shirt meets the lapels; below where the tie
# covers the shirt, the roll lines carry on straight to the top button.
TOPBTN = (566, 743)
shirt = (Ls > 150) & ~backdrop
rollL, rollR = {}, {}
for y in range(70, 480):
    xs = np.where(shirt[y, 400:720])[0]
    if len(xs) > 20: rollL[y] = 400 + xs[0]; rollR[y] = 400 + xs[-1]
def fit(d, y0, y1):
    ys = np.array([y for y in d if y0 <= y <= y1]); return np.polyfit(ys, [d[y] for y in ys], 1)
fl, fr = fit(rollL, 330, 440), fit(rollR, 300, 420)
print('roll fits at 400/743: L %.1f %.1f  R %.1f %.1f' % (np.polyval(fl, 400), np.polyval(fl, 743), np.polyval(fr, 400), np.polyval(fr, 743)))
# Below the last row where the shirt shows beside the tie, traced by hand
# down to where the fronts meet (photo px).
V_LEFT = [(527, 500), (540, 550), (551, 600), (564, 648)]
V_RIGHT = [(599, 500), (588, 550), (577, 600), (565, 648)]
ys = sorted(y for y in rollL if y <= 438)
vee = [(rollL[y] - 0.5, y) for y in ys] + V_LEFT + V_RIGHT[::-1] + [(rollR[y] + 1.5, y) for y in reversed(ys)]
VEE = poly(vee, L.shape)
# Above the first traced row everything between the jacket's collar ends is
# shirt (bright), so nothing dark there is cloth except the collar itself.

# ---- The tie: the dark part of the V, recoloured to the old photo's burgundy
TIE_RGB = np.array([76.1, 32.1, 41.6], np.float32); TIE_L = 49.9
# (Dark and joined up; the shirt's shadow beside the knot is not tie.)
tie_core = (Ls < 92) & (VEE > 0.5) & (yy > 125)
tie_near = f32(u8(tie_core.astype(np.float32)).filter(ImageFilter.MaxFilter(3)))
tie_t = np.maximum(tie_core, tie_near * np.clip((190 - L) / 100, 0, 1)) * (VEE > 0.02) * (yy > 125)
tie_mean = float(L[tie_t > 0.95].mean())
tie_col = TIE_RGB[None, None, :] * (np.clip(L, 8, 96) / tie_mean)[..., None]

# ---- Cloth: dark, outside the V, not the shadow under the shirt cuffs ------
# (Under the hem the floor's contact shadow is nearly as dark as the cloth's
# lit edge: the limit is tighter there.)
HEM_Y = 1300
solid = Ls < np.where(yy > HEM_Y, 80, 112)
near = f32(u8(solid.astype(np.float32)).filter(ImageFilter.MaxFilter(5))) > 0.5
alpha = np.where(solid, 1.0, np.where(near, np.where(yy > HEM_Y, np.clip((115 - Ls) / 50, 0, 1), np.clip((170 - Ls) / 70, 0, 1)), 0.0)).astype(np.float32)
alpha *= (1 - np.clip(VEE * 1.0, 0, 1) * (yy > 125))
for x0, x1 in ((30, 215), (910, 1095)):
    box = (yy >= 1239) & (yy <= 1285) & (xx >= x0) & (xx <= x1)
    alpha = np.where(box & (Ls > 96), 0, alpha)
alpha[backdrop] = 0

# ---- Painted out: the photo's own buttons, buttonholes and pockets ---------
# (the page draws the customer's picks). Photo px.
def right_of(x0, y0, x1, y1, pad):          # right of the line through two points
    return (xx > x0 + (yy - y0) * (x1 - x0) / (y1 - y0) + pad)
LAPEL_EDGE_R = (787, 222, 672, 470)         # the viewer's right lapel's outer edge
holes = {
    'top button': np.maximum(disc(566, 745, 25, L.shape), rect(575, 731, 612, 758, L.shape)),
    'bottom button': np.maximum(disc(538, 927, 25, L.shape), rect(556, 912, 626, 941, L.shape)),
    'chest welt': poly([(684, 412), (852, 379), (855, 431), (684, 462)], L.shape) * right_of(*LAPEL_EDGE_R, 4),
    'lapel buttonhole': poly([(712, 212), (760, 228), (756, 246), (708, 230)], L.shape),
    'flap L': poly([(222, 876), (412, 885), (414, 1006), (330, 1011), (220, 1003)], L.shape),
    'flap R': poly([(710, 885), (902, 876), (904, 1003), (796, 1011), (708, 1006)], L.shape),
    'sleeve buttons L': rect(28, 1070, 62, 1184, L.shape),
    'sleeve buttons R': rect(1060, 1070, 1098, 1184, L.shape),
}
hole = np.zeros(L.shape, bool)
for m in holes.values(): hole |= m > 0.5
# The flaps and sleeve buttons stick out past the cloth's outline: there the
# outline is redrawn straight between its points above and below.
def edge_at(y, side, x0, x1):
    xs = np.where(alpha[y, x0:x1] > 0.5)[0]
    return x0 + (xs[0] if side < 0 else xs[-1])
def restraighten(y0, y1, side, x0, x1, inner):
    """Rows y0..y1: the cloth's edge inside x0..x1 runs straight from its
    place at y0 to its place at y1 (side -1: the cloth's left edge)."""
    ea, eb = edge_at(y0, side, x0, x1), edge_at(y1, side, x0, x1)
    for y in range(y0, y1 + 1):
        e = ea + (eb - ea) * (y - y0) / (y1 - y0)
        xs = np.arange(x0, x1)
        cov = np.clip((xs - e) + 0.5, 0, 1) if side < 0 else np.clip((e - xs) + 0.5, 0, 1)
        a = alpha[y, x0:x1]
        alpha[y, x0:x1] = np.where((xs < inner) if side < 0 else (xs > inner), cov, a)
    return ea, eb
print('body edge at flap L', restraighten(878, 1004, -1, 219, 300, 262), 'R', restraighten(878, 1004, 1, 820, 902, 858))
print('sleeve edge at buttons L', restraighten(1068, 1186, -1, 20, 80, 62), 'R', restraighten(1068, 1186, 1, 1040, 1100, 1060))
cloth = alpha > 0.98
Lp = inpaint(L, hole, cloth & ~hole)
# The lapel's outer edge ran under the chest welt's end: its thin shadow is
# carried through the painted-out stretch, as deep as it is just above.
def carry_edge(Lp, x0, y0, x1, y1, ya, yb):
    line = lambda y: x0 + (y - y0) * (x1 - x0) / (y1 - y0)
    xs, dep = [], []
    for y in range(ya - 70, ya - 6):
        c = int(round(line(y))); seg = Lp[y, c - 6:c + 7]
        xs.append((y, c - 6 + int(np.argmin(seg)))); dep.append(float(np.median(Lp[y, c + 9:c + 15]) - seg.min()))
    fx = np.polyfit([q[0] for q in xs], [q[1] for q in xs], 1); depth = float(np.median(dep))
    for y in range(ya - 4, yb + 5):
        e = np.polyval(fx, y); c = int(round(e)); xr = np.arange(c - 8, c + 9)
        w = np.clip((y - (ya - 4)) / 6, 0, 1) * np.clip(((yb + 4) - y) / 6, 0, 1)
        Lp[y, c - 8:c + 9] -= depth * w * np.exp(-0.5 * ((xr - e) / 1.6) ** 2)
    return depth
print('lapel edge carried through the welt, depth %.1f' % carry_edge(Lp, *LAPEL_EDGE_R, 392, 470))

# ---- Shading map (as scripts/make_folded_pieces.py) ------------------------
def along(a, n=8, dirs=8):
    """Per pixel, the strongest average of `a` along a straight run of
    2n + 1 px through it, over `dirs` directions."""
    best = None
    for i in range(dirs):
        th = np.pi * i / dirs; c, sn = np.cos(th), np.sin(th)
        acc = np.zeros_like(a)
        for k in range(-n, n + 1): acc += np.roll(a, (int(round(k * sn)), int(round(k * c))), (0, 1))
        acc /= 2 * n + 1
        best = acc if best is None else np.where(np.abs(acc) > np.abs(best), acc, best)
    return best


def shade_map(L, alpha, ref, detail=1.25, grain=2.6, fine=0.9):
    # The cloth's brightness is carried outward past its outline first, so
    # neither the backdrop nor the shirt leaks into the cloth's rim (a pale
    # or dark ragged line along the silhouette otherwise).
    core = np.asarray(u8((alpha > 0.98).astype(np.float32)).filter(ImageFilter.MinFilter(5))) > 127
    Le = inpaint(L, ~core, core)
    # Stray pale fibres and dark specks go (single dots, not seams).
    Le = np.asarray(Image.fromarray(np.clip(Le, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))).astype(np.float32)
    base = blur(Le, 6.0)
    d = blur(Le, fine) - base
    t = grain * float(np.median(np.abs(d[alpha > 0.99]))) / 0.6745
    # A seam or an edge is strong along its whole run; the cloth's grain and
    # its knots are not: detail is kept by its strength averaged along a
    # short straight run through each pixel.
    # (Both tests: strong around the pixel, which the grain is not, and
    # strong along a run, which a knot is not.)
    ki = np.clip((blur(np.abs(d), 1.6) - t * 0.55) / (t * 0.55), 0, 1)
    tl = t * 0.5
    kn = blur(ki * np.clip((-along(np.minimum(d, 0)) - tl) / tl, 0, 1), 1.3)
    # The broad shading again, without the dark lines just found (their
    # blur would darken the cloth either side, and what is left beside them
    # would read as a pale fringe).
    fineL = blur(Le, fine)
    base = blur(fineL - np.minimum(d, 0) * kn, 6.0)
    d = fineL - base
    kp = ki * np.clip((along(np.maximum(d, 0)) - 2.5 * tl) / tl, 0, 1) * 0.6
    # Only the dark details are deepened; light ones (stray pale fibres, the
    # glow beside a seam) stay as they are, less the grain.
    Lsm = base + np.minimum(d, 0) * kn * detail + np.maximum(d, 0) * kp
    r = np.maximum(Lsm, 1) / ref
    return np.where(r < 1, 1 - (1 - r) * 0.95, r)

ref = float(np.median(L[cloth & ~hole]))
R = shade_map(Lp, alpha, ref)

# ---- Onto the picture frame -------------------------------------------------
OW, OH = int(VBW * K), int(VBH * K)
def frame(a, fill, resample=Image.LANCZOS):
    """Photo px -> the 800 x 952 picture at K px per unit."""
    x0 = CX - 400 / S; y0 = -OY / S; x1 = CX + 400 / S; y1 = (VBH - OY) / S
    im = Image.fromarray(np.asarray(a, np.float32), 'F')
    return np.asarray(im.transform((OW, OH), Image.EXTENT, (x0, y0, x1, y1), Image.BICUBIC, fillcolor=fill))

Rf = frame(R, 1.0); Af = np.clip(frame(alpha, 0.0), 0, 1)
hi = np.clip(Rf - 1, 0, None); hi = 0.6 * (1 - np.exp(-hi / 0.6))
M1 = np.clip(Rf, 0, 1) * 255; M2 = np.clip(hi, 0, 1) * 255; AA = Af * 255
Image.fromarray(np.concatenate([np.dstack([M1, M1, M1, AA]), np.dstack([M2, M2, M2, AA])], 0).astype(np.uint8), 'RGBA').save(
    os.path.join(ROOT, 'assets', 'jacket-photo-shade-front2.webp'), quality=92, method=6)

# ---- The photo: shirt, tie and cuffs on the page colour; behind the cloth,
# whatever is beside it (so the cloth's soft edge blends into the right thing).
base = A.copy()
base = base * (1 - tie_t[..., None]) + tie_col * tie_t[..., None]
bd = blur(backdrop.astype(np.float32), 0.8)[..., None]
# The backdrop becomes the page colour; the soft shadow the jacket casts on
# the floor stays, as a shadow on the page colour, fading out before the
# picture's bottom edge (the folded pants sit right below it).
BG_L = float(np.median(L[backdrop & (yy < 1100)]))
fade = np.clip(((VBH - 3 - OY) / S - yy) / (12 / S), 0, 1)
shadow = 1 - (1 - np.clip(blur(L, 1.5) / (BG_L * 0.96), 0, 1)) * fade * (yy > 1180)
base = base * (1 - bd) + (PAGE[None, None, :] * shadow[..., None]) * bd
# (Where a painted-out flap or sleeve button stuck out past the outline, the
# backdrop takes its place.)
base[hole & (alpha <= 0.02)] = PAGE
behind = alpha > 0.02
for c in range(3):
    base[..., c] = inpaint(base[..., c], behind, ~behind)
photo = np.dstack([frame(base[..., c], float(PAGE[c])) for c in range(3)])
Image.fromarray(np.clip(photo, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(ROOT, 'assets', 'jacket-photo-front2.webp'), quality=90, method=6)

if CHECK:
    v = np.dstack([np.clip(Rf, 0, 1.6) / 1.6 * 255] * 3) * Af[..., None] + photo * (1 - Af[..., None])
    Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, 'front2-check.png'))
    Image.fromarray(np.clip(photo, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, 'front2-photo.png'))
print('ref L %.1f tie mean %.1f' % (ref, tie_mean))
print('top button', U(566, 743), 'bottom button', U(538, 925), 'V apex', U(564.5, 648))

# ---- Measurements for jacket-studio.js (picture units) ----------------------
# Lapel profile, viewer's right lapel: [y, roll line x, outer edge x] per row.
# The roll line is the V's right side; the outer edge runs through three
# points read off the photo: the lapel's tip, the middle, and where it meets
# the front edge (photo px).
EDGE_R = [(787, 222), (672, 470), (566, 690)]
ec = np.polyfit([p[1] for p in EDGE_R], [p[0] for p in EDGE_R], 2)
vr = dict((y, rollR[y] + 1.5) for y in ys)
for (xa, ya), (xb, yb) in zip([(vr[ys[-1]], ys[-1])] + V_RIGHT[:-1], V_RIGHT):
    for y in range(int(ya), int(yb) + 1): vr[y] = xa + (xb - xa) * (y - ya) / max(1, yb - ya)
rows = []
ytip = EDGE_R[0][1]
rows.append([U(0, ytip - 14)[1], round(U(vr[ytip - 14], 0)[0]), round(U(vr[ytip - 14], 0)[0])])
y = ytip
while y < V_RIGHT[-1][1]:
    rows.append([U(0, y)[1], round(U(vr[int(y)], 0)[0]), round(U(np.polyval(ec, y), 0)[0])])
    y += 12 / S
xe = U(V_RIGHT[-1][0], V_RIGHT[-1][1])
rows += [[xe[1], round(xe[0]), round(U(np.polyval(ec, V_RIGHT[-1][1]), 0)[0])], [U(0, EDGE_R[-1][1])[1], round(U(EDGE_R[-1][0], 0)[0]), round(U(EDGE_R[-1][0], 0)[0])]]
print('LAPEL_PROFILE', str([[round(r[0]), r[1], r[2]] for r in rows]).replace(' ', ''))
print('lapel mirror x (sum of the two roll lines at y 300 px): %.1f' % (U(rollL[300], 0)[0] + U(rollR[300], 0)[0]))

def runs_at(yu):
    r = Af[int(yu * K)] > 0.5
    xs = np.where(r)[0]; out = []; s0 = p0 = xs[0]
    for x in xs[1:]:
        if x != p0 + 1: out.append((s0, p0)); s0 = x
        p0 = x
    out.append((s0, p0))
    return [(q[0] / K, (q[1] + 1) / K) for q in out if q[1] - q[0] > 8]
body, sleeve = [], []
for yu in range(520, 801, 40):
    r = runs_at(yu)
    if len(r) == 3:
        body.append([yu, float(round(r[1][0], 1)), float(round(r[1][1], 1))]); sleeve.append([yu, float(round(r[0][1], 1)), float(round(r[2][0], 1))])
print('BODY_SIDES', str(body).replace(' ', '')); print('SLEEVE_SIDES', str(sleeve).replace(' ', ''))
r = runs_at(800); print('sleeve outer edges at y 800: %.1f %.1f' % (r[0][0], r[-1][1]))

# The opening below the bottom button (the jacket's inside shows): the dark
# region between the fronts.
Rf_s = blur(Rf, 1.5)
dark = u8(((Rf_s < 0.74) & (Af > 0.9)).astype(np.float32)).copy()
seed = (int(U(558, 1200)[0] * K), int(U(558, 1200)[1] * K))
ImageDraw.floodfill(dark, seed, 128)
op = np.asarray(dark) == 128
oy = np.where(op.any(1))[0]
left, right = [], []
for yu in range(int(oy[0] / K) + 2, int(oy[-1] / K), 14):
    xs = np.where(op[int(yu * K)])[0]
    if len(xs): left.append((round(xs[0] / K, 1), yu)); right.append((round((xs[-1] + 1) / K, 1), yu))
pts = [(round((left[0][0] + right[0][0]) / 2, 1), round(oy[0] / K, 1))] + right + [(right[-1][0], round(oy[-1] / K, 1)), (left[-1][0], round(oy[-1] / K, 1))] + left[::-1]
print('SB_OPENING', 'M' + ' L'.join('%g,%g' % p for p in pts) + ' Z')
print('opening box', round(min(p[0] for p in pts)), round(oy[0] / K), round(max(p[0] for p in pts)), round(oy[-1] / K))
print('sleeve end y', U(0, 1243)[1], 'sleeve buttons bottom y', U(0, 1168)[1], 'hem y', U(0, 1355)[1])
