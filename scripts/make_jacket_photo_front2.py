"""Jacket fronts for the Your Suit picture, from Daniel's reference photos
(2026-11-22): a charcoal jacket on a ghost mannequin with a white shirt and a
charcoal tie, one photo per front (PHOTOS below).

Like the back and inside views: the photo keeps the shirt, tie and cuffs;
its light and shadow on the cloth become a shading map that the page fills
with the chosen fabric. The photo's own buttons, buttonholes, chest welt and
flap pockets are painted out, and the page draws the customer's picks.

Per photo it writes (1.5x the 800 x 952 picture):
  assets/jacket-photo-<out>.webp          shirt, tie (recoloured to the old
                                          photo's burgundy so the page's tie
                                          recolour finds it), cuffs and the
                                          jacket's soft floor shadow, on the
                                          page colour
  assets/jacket-photo-shade-<out>.webp    shading (top half: shadows + cloth
                                          alpha, bottom half: highlights)
and prints the measurements jacket-studio.js needs (FRONT2 there).

A new photo needs its own entry: every generated photo sits a little
differently, so the hand points (photo px) are read off that photo.

Run: python3 scripts/make_jacket_photo_front2.py [check-folder] [name ...]
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ARGS = sys.argv[1:]
CHECK = ARGS[0] if ARGS and os.path.isdir(ARGS[0]) else None
TRACE = '--trace' in ARGS                         # only the traced lines (fast), into the check folder
ONLY = [a for a in ARGS if not os.path.isdir(a) and a != '--trace']
PAGE = np.array([236, 228, 221], np.float32)      # #ECE4DD
K = 1.5                                           # output px per unit
VBW, VBH = 800, 952
TIE_RGB = np.array([76.1, 32.1, 41.6], np.float32)

PHOTOS = {
    # Single breasted, two buttons, notch lapels.
    'sb-notch': dict(
        src='jacket-front-sb-reference-photo.png', out='front2',
        # Picture units: x = (photo px - CX) * S + 400, y = photo px * S + OY.
        # Chosen so the photo's two front buttons land where the page already
        # draws them (409,525 and 387,649).
        S=0.681, CX=556.3, OY=19.0,
        # Between the body and each hanging sleeve the backdrop is brighter
        # than elsewhere (as bright as the shirt cuffs).
        gaps=[(186, 520, 300, 1238), (812, 520, 926, 1238)],
        # The ghost mannequin's neck (nearly the backdrop's brightness).
        neck=[(446, 62), (458, 36), (480, 26), (560, 22), (640, 27), (658, 40), (672, 62), (700, 480), (420, 480)],
        floor_y=1180, hem_y=1300, tie_top=125,
        # The shirt V: found per row down to auto_to, then by hand to where
        # the fronts meet.
        v_cols=(400, 720), v_rows=(70, 480), auto_to=438,
        v_left=[(527, 500), (540, 550), (551, 600), (564, 648)],
        v_right=[(599, 500), (588, 550), (577, 600), (565, 648)],
        # The shadow under each shirt cuff is not cloth: (x0, x1) at rows y0..y1.
        cuffs=[(30, 215), (910, 1095)], cuff_rows=(1239, 1285),
        # Painted out (the page draws the customer's picks).
        discs=[(566, 745, 25), (538, 927, 25)],
        rects=[(575, 731, 612, 758), (556, 912, 626, 941), (28, 1070, 62, 1184), (1060, 1070, 1098, 1184)],
        polys=[[(712, 212), (760, 228), (756, 246), (708, 230)],
               [(222, 876), (412, 885), (414, 1006), (330, 1011), (220, 1003)],
               [(710, 885), (902, 876), (904, 1003), (796, 1011), (708, 1006)]],
        # The chest welt, only right of the lapel's outer edge (two points on it).
        welt=[(684, 412), (852, 379), (855, 431), (684, 462)], welt_edge=(787, 222, 672, 470), welt_rows=(392, 470),
        # Where a flap or the sleeve buttons stuck out past the outline, it
        # is redrawn straight (at and right beside the painted-out pixels): (y0, y1, side, x0, x1,
        # inner: a column inside the cloth).
        straighten=[(878, 1004, -1, 219, 300, 262), (878, 1004, 1, 820, 902, 858), (1068, 1186, -1, 20, 80, 62), (1068, 1186, 1, 1040, 1100, 1060)],
        # Lapels for the page: outer edge through these points.
        lapels=[dict(name='R', side='R', edge=[(787, 222), (672, 470), (566, 690)], fit=2)],
        opening_seed=(558, 1200),
        landmarks={'top button': (566, 743), 'bottom button': (538, 925), 'V apex': (564.5, 648), 'sleeve end': (0, 1243), 'sleeve buttons bottom': (0, 1168), 'hem': (0, 1355)},
    ),
    # Double breasted 6x2, peak lapels. The viewer's right front lies on top:
    # its lapel folds from the neck down to the fastening button.
    'db-peak': dict(
        src='jacket-front-db-reference-photo.png', out='front2-db',
        S=0.681, CX=566.5, OY=26.0,
        gaps=[(200, 560, 330, 1215), (810, 560, 940, 1215)],
        neck=[(455, 60), (465, 45), (480, 30), (520, 23), (600, 23), (645, 28), (662, 38), (676, 58), (705, 480), (430, 480)],
        floor_y=1160, hem_y=1285, tie_top=120,
        v_cols=(420, 720), v_rows=(60, 360), auto_to=348,
        v_left=[(530, 380), (538, 400), (542, 420), (548, 440), (555, 460), (560, 480), (563, 497)],
        v_right=[(610, 368), (603, 392), (598, 407), (593, 420), (585, 443), (578, 462), (572, 480), (563, 497)],
        cuffs=[(40, 222), (915, 1097)], cuff_rows=(1214, 1262),
        discs=[(406.5, 590, 23), (729, 591.5, 23), (483.5, 763, 23), (675, 762, 23), (484, 927.5, 23), (675, 927.5, 23)],
        rects=[(498, 753, 536, 774), (498, 918, 537, 939), (26, 1038, 66, 1154), (1072, 1038, 1112, 1154)],
        polys=[[(730, 256), (778, 238), (782, 256), (734, 274)],
               [(248, 878), (418, 888), (420, 980), (330, 984), (236, 972)],
               [(720, 888), (884, 878), (897, 972), (808, 984), (718, 980)]],
        welt=[(690, 418), (866, 378), (868, 424), (690, 462)], welt_edge=(760, 342, 694, 462), welt_rows=(420, 462), welt_pad=0, keep_edges=True,
        straighten=[(874, 988, -1, 215, 300, 266), (874, 988, 1, 838, 925, 872), (1036, 1156, -1, 20, 84, 66), (1036, 1156, 1, 1054, 1118, 1072)],
        lapels=[dict(name='R', side='R', edge=[(817, 182), (800, 270), (760, 355), (720, 430), (700, 450), (650, 520), (600, 593), (550, 650), (500, 700), (470, 737)], refine=1,
                     fold=[(563, 497), (550, 540), (523, 607), (500, 663), (473, 727), (467, 747)]),
                dict(name='L', side='L', edge=[(322, 182), (350, 270), (400, 355), (440, 450), (500, 547), (527, 587)], refine=1, under='R')],
        landmarks={'buttons top': (406.5, 590), 'top right': (729, 591.5), 'mid': (483.5, 763), 'mid right': (675, 762), 'bottom': (484, 927.5), 'bottom right': (675, 927.5),
                   'V apex': (563, 497), 'lapel hole a': (737, 264), 'lapel hole b': (775, 249), 'sleeve end': (0, 1220), 'sleeve buttons bottom': (0, 1136), 'sleeve buttons top': (0, 1057), 'hem': (0, 1345)},
    ),
}

# ---- Daniel's 14 clean photos (2026-11-22, Scott_Suits_Lapel_Options.pdf):
# the same jacket once per lapel, no pockets, buttons or buttonholes, so
# nothing is painted out. They share the first photos' framing; the V, the
# lapels' edges and the front edge are traced by the script. Per photo: the
# lapel tips (photo px), and waypoints where an edge curves.
SB_CLEAN = dict(
    S=0.681, CX=556.3, OY=19.0,
    gaps=[(186, 520, 300, 1238), (812, 520, 926, 1238)],
    neck=[(446, 62), (458, 36), (480, 26), (560, 22), (640, 27), (658, 40), (672, 62), (700, 480), (420, 480)],
    floor_y=1180, hem_y=1300, tie_top=125,
    v_cols=(400, 720), v_rows=(70, 480), v_auto=True,
    cuffs=[(30, 215), (910, 1095)], cuff_rows=(1239, 1285),
    opening_seed=(558, 1200), keep_edges=True,
)


def clean(base, lapel, **kw):
    kind = 'sb' if base is SB_CLEAN else 'db'
    return dict(base, src='reference/jacket-front-%s-%s.webp' % (kind, lapel), out='front-%s-%s' % (kind, lapel), **kw)


PHOTOS.update({
    'sb-notch-clean': clean(SB_CLEAN, 'notch', lapels=[
        dict(name='R', side='R', dp=True, edge=[(781, 218)]),
        dict(name='L', side='L', dp=True, edge=[(331, 218)])]),
    'sb-peak-clean': clean(SB_CLEAN, 'peak', lapels=[
        dict(name='R', side='R', dp=True, edge=[(816, 167)]),
        dict(name='L', side='L', dp=True, edge=[(296, 167)])]),
    'sb-semi-notch-clean': clean(SB_CLEAN, 'semi-notch', lapels=[
        dict(name='R', side='R', dp=True, edge=[(777, 195)]),
        dict(name='L', side='L', dp=True, edge=[(347, 196)])]),
    'sb-semi-peak-clean': clean(SB_CLEAN, 'semi-peak', lapels=[
        dict(name='R', side='R', dp=True, edge=[(799, 182)]),
        dict(name='L', side='L', dp=True, edge=[(318, 184)])]),
    # Diamond: one collar from the neck out to a point, then in.
    'sb-diamond-clean': clean(SB_CLEAN, 'diamond', lapels=[
        dict(name='R', side='R', dp=True, edge=[(740, 135), (793, 219)]),
        dict(name='L', side='L', dp=True, edge=[(375, 140), (325.5, 222)])]),
    # Shawl and Arc: the collar's outer edge curves all the way, so it is
    # guided by hand points down to its end.
    'sb-shawl-clean': clean(SB_CLEAN, 'shawl', lapels=[
        dict(name='R', side='R', dp=True, end=True, half=12, edge=[(760, 127), (763, 193), (764, 260), (755, 327), (737, 393), (705, 460), (693, 500), (680, 540), (660, 580), (635, 620), (607, 660), (576, 700), (550, 730)]),
        dict(name='L', side='L', dp=True, end=True, half=12, edge=[(360, 127), (359, 260), (373, 327), (390, 393), (412, 460), (430, 500), (451, 540), (472, 580), (492, 620), (513, 660), (536, 700), (545, 715)])]),
    'sb-arc-clean': clean(SB_CLEAN, 'arc', lapels=[
        dict(name='R', side='R', dp=True, end=True, half=14, edge=[(757, 125), (757, 227), (757, 340), (752, 407), (741, 473), (712, 540), (702, 590), (693, 633), (682, 673), (667, 707), (647, 730), (620, 748), (593, 760), (567, 770), (547, 780)]),
        dict(name='L', side='L', dp=True, end=True, half=14, edge=[(361, 125), (361, 227), (361, 340), (367, 407), (377, 473), (403, 540), (413, 600), (427, 650), (443, 690), (460, 717), (480, 737), (500, 748), (520, 757), (537, 761)])]),
})


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


def shade_map(L, alpha, ref, detail=1.25, grain=2.6, fine=0.9, keep=None):
    """Brightness against the cloth's own level (as scripts/make_folded_pieces.py)."""
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
    # its knots are not. Detail is kept where it is strong around the pixel
    # (the grain is not) and along a short straight run through it (a knot
    # is not).
    ki = np.clip((blur(np.abs(d), 1.6) - t * 0.55) / (t * 0.55), 0, 1)
    tl = t * 0.5
    kn = blur(ki * np.clip((-along(np.minimum(d, 0)) - tl) / tl, 0, 1), 1.3)
    if keep is not None: kn = np.maximum(kn, keep)
    # The broad shading again, without the dark lines just found (their
    # blur would darken the cloth either side, and what is left beside them
    # would read as a pale fringe).
    fineL = blur(Le, fine)
    base = blur(fineL - np.minimum(d, 0) * kn, 6.0)
    d = fineL - base
    kp = ki * np.clip((along(np.maximum(d, 0)) - 2.5 * tl) / tl, 0, 1) * 0.6
    # Only the dark details are deepened.
    Lsm = base + np.minimum(d, 0) * kn * detail + np.maximum(d, 0) * kp
    r = np.maximum(Lsm, 1) / ref
    return np.where(r < 1, 1 - (1 - r) * 0.95, r)


def dp_line(cost, guide_y, guide_x, half, start=3, end=5, bend=0.35):
    """The cheapest line through `cost`, one x per row, kept within `half`
    px of the guide (rows guide_y, columns guide_x) and bending gently
    against it. Returns {y: x}."""
    n = len(guide_y); w = 2 * half + 1
    C = np.empty((n, w), np.float32)
    off = np.abs(np.arange(w) - half)
    for i, (y, gx) in enumerate(zip(guide_y, guide_x)):
        x0 = int(round(gx)) - half
        C[i] = cost[int(y), x0:x0 + w] + 0.01 * off * off
    acc = C[0] + np.where(off <= start, 0, 1e6); back = np.zeros((n, w), np.int8)
    for i in range(1, n):
        best = acc.copy(); bk = np.zeros(w, np.int8)
        for d in (-1, 1):
            sh = np.roll(acc, d) + bend
            sh[0 if d > 0 else -1] = 1e9
            better = sh < best; best = np.where(better, sh, best); bk = np.where(better, -d, bk)
        acc = best + C[i]; back[i] = bk
    j = int(np.argmin(acc + np.where(off <= end, 0, 1e6)))
    out = {}
    for i in range(n - 1, -1, -1):
        out[int(guide_y[i])] = float(int(round(guide_x[i])) - half + j)
        j += int(back[i][j])
    return out


def build(name, c):
    S, CX, OY = c['S'], c['CX'], c['OY']
    U = lambda x, y: (round((x - CX) * S + 400, 1), round(y * S + OY, 1))
    src = Image.open(os.path.join(ROOT, 'assets', c['src'])).convert('RGB')
    A = np.asarray(src).astype(np.float32)
    H, W = A.shape[:2]
    L = A.mean(2)
    Ls = blur(L, 0.7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    print('==== %s (%d x %d) ====' % (name, W, H))

    # ---- Backdrop: bright and joined to the border (the floor shadow too).
    # The limit stops at 245 so the fill does not run into the shirt cuffs.
    ok = ((Ls >= 226) & (Ls <= 245)) | ((yy > c['floor_y']) & (Ls >= 172) & (Ls <= 245))
    for x0, y0, x1, y1 in c['gaps']:
        ok |= (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & (Ls >= 226)
    # (The fill must not run down the mannequin's neck and across the collar.)
    ok &= poly(c['neck'], L.shape) < 0.5
    f = u8(ok.astype(np.float32))
    for seed in ((2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3), (W // 2, H - 3), (2, H // 2), (W - 3, H // 2)):
        if f.getpixel(seed) == 255: ImageDraw.floodfill(f, seed, 128)
    # (Where a cuff rests against the body the gap beside the sleeve is closed
    # off from the rest of the backdrop: it is filled from inside.)
    for x0, y0, x1, y1 in c['gaps']:
        for y in range(y0 + 20, y1, 40):
            xs = np.nonzero(ok[y, x0:x1])[0]
            if len(xs) and f.getpixel((int(x0 + np.median(xs)), y)) == 255:
                ImageDraw.floodfill(f, (int(x0 + np.median(xs)), y), 128)
    backdrop = np.asarray(f) == 128

    # ---- The shirt V: between the two lapel roll lines. Per row, where the
    # bright shirt meets the lapels; below where the tie covers the shirt,
    # traced by hand down to where the fronts meet.
    shirt = (Ls > 150) & ~backdrop
    rollL, rollR = {}, {}
    c0, c1 = c['v_cols']
    for y in range(*c['v_rows']):
        xs = np.where(shirt[y, c0:c1])[0]
        if len(xs) > (5 if c.get('v_auto') else 20): rollL[y] = c0 + xs[0]; rollR[y] = c0 + xs[-1]
    if c.get('v_auto'):
        # Clean photos: the shirt shows as a sliver either side of the tie
        # down to auto_to; below it the V's sides are the tie's own edges
        # (cloth, a dark crease, then the tie on the viewer's left; the tie,
        # then the bright roll of the lapel on the right), followed row by
        # row down to where they meet.
        G = blur(L, 1.2)
        tcx = float(np.median(np.where((Ls[250, c0:c1] < 92) & (np.arange(c0, c1) > rollL[250]) & (np.arange(c0, c1) < rollR[250]))[0])) + c0
        both = [y for y in sorted(rollL) if y > 250 and (shirt[y, int(rollL[y]):int(tcx)].sum() >= 2) and (shirt[y, int(tcx):int(rollR[y]) + 1].sum() >= 2)]
        auto_to = max(q for q in both if all(k in both for k in range(q - 5, q))) - 2
        gl = G[:, 3:] - G[:, :-3]                     # brightness change over 3 px, at x + 1.5
        costL = np.pad(gl, ((0, 0), (1, 2)), mode='edge')            # a drop (cloth to crease)
        costR = np.pad(-gl, ((0, 0), (1, 2)), mode='edge')           # a rise (tie to lapel roll)
        y = auto_to; xl, xr = float(rollL[y]), float(rollR[y]); vl, vr = [], []
        lim = c.get('v_limit', 760)
        while y < lim:
            y += 1
            cand = np.arange(int(round(xl)) - 1, int(round(xl)) + 4); xl = float(cand[np.argmin(costL[y, cand])])
            cand = np.arange(int(round(xr)) - 3, int(round(xr)) + 2); xr = float(cand[np.argmin(costR[y, cand])])
            if xr - xl < c.get('v_close', 7): break
            vl.append((xl, y)); vr.append((xr, y))
        med = lambda pts: [(float(np.median([p[0] for p in pts[max(0, i - 4):i + 5]])), p[1]) for i, p in enumerate(pts)]
        vl, vr = med(vl), med(vr)
        APEX = (round((vl[-1][0] + vr[-1][0]) / 2, 1), vl[-1][1] + 2)
        V_LEFT = vl[5::8] + [APEX]; V_RIGHT = vr[5::8] + [APEX]
        c = dict(c, auto_to=auto_to)
        print('  V found: shirt to row %d, apex %s' % (auto_to, APEX))
    else:
        V_LEFT, V_RIGHT = c['v_left'], c['v_right']
        APEX = V_LEFT[-1]
    ys = sorted(y for y in rollL if y <= c['auto_to'])
    vee = [(rollL[y] - 0.5, y) for y in ys] + V_LEFT + V_RIGHT[::-1] + [(rollR[y] + 1.5, y) for y in reversed(ys)]
    VEE = poly(vee, L.shape)
    TOP = c['tie_top']

    # ---- The tie: the dark part of the V, recoloured to the old photo's
    # burgundy. (Dark and joined up; the shirt's shadow beside the knot is
    # lighter than any part of the tie.)
    tie_core = (Ls < 92) & (VEE > 0.5) & (yy > TOP)
    shirt_fix = None
    if c.get('v_auto'):
        mx = lambda m, n: np.asarray(u8(m.astype(np.float32)).filter(ImageFilter.MaxFilter(n))) > 127
        mn = lambda m, n: np.asarray(u8(m.astype(np.float32)).filter(ImageFilter.MinFilter(n))) > 127
        # Only the tie itself: the dark shadow under each collar point hangs
        # on to the knot by a thread, and recoloured it shows as a dot.
        knot = yy < TOP + 140
        tie_core = np.where(knot, mx(mn(tie_core, 5), 5) & tie_core, tie_core)
        ty = TOP + 200
        f = u8(tie_core.astype(np.float32))
        ImageDraw.floodfill(f, (int(np.median(np.nonzero(tie_core[ty])[0])), ty), 128)
        f = u8((np.asarray(f) == 128).astype(np.float32))
        ImageDraw.floodfill(f, (0, 0), 128)                     # the outside; what is left is the tie, sheen included
        tie_full = np.asarray(f) != 128
        tie_in = mn(tie_full, 3)
        # An edge pixel is part tie, part shirt. How much of each comes from
        # the tie's shade just inside and the shirt's shade just past the
        # photo's bright fringe; left as they are, the mixed pixels and the
        # fringe show as an outline around a recoloured tie.
        wt = blur(tie_in.astype(np.float32), 2.0)
        tie_L = blur(L * tie_in, 2.0) / np.maximum(wt, 1e-3)
        far = ~mx(tie_full, 9) & (VEE > 0.5)
        wf = blur(far.astype(np.float32), 3.0)
        shirt = np.dstack([blur(A[..., ch] * far, 3.0) / np.maximum(wf, 1e-3) for ch in range(3)])
        have = (wf > 0.02) & (wt > 0.02)
        band = mx(tie_full, 5) & ~tie_in
        t_mix = np.clip((shirt.mean(2) - L) / np.maximum(shirt.mean(2) - tie_L, 20), 0, 1)
        t_old = np.clip((190 - L) / 100, 0, 1) * mx(tie_full, 3)
        tie_t = np.where(tie_in, 1.0, np.where(band, np.where(have, t_mix, t_old), 0.0)) * (VEE > 0.02) * (yy > TOP)
        tie_mean = float(L[tie_in].mean())
        tie_col = TIE_RGB[None, None, :] * (np.clip(np.where(tie_in, L, tie_L), 8, 96) / tie_mean)[..., None]
        w = np.clip(blur(mx(tie_full, 7).astype(np.float32), 1.0) * 1.6, 0, 1) * have * (VEE > 0.5)
        shirt_fix = (shirt, w[..., None])
    else:
        tie_near = f32(u8(tie_core.astype(np.float32)).filter(ImageFilter.MaxFilter(3)))
        tie_t = np.maximum(tie_core, tie_near * np.clip((190 - L) / 100, 0, 1)) * (VEE > 0.02) * (yy > TOP)
        tie_mean = float(L[tie_t > 0.95].mean())
        tie_col = TIE_RGB[None, None, :] * (np.clip(L, 8, 96) / tie_mean)[..., None]

    # ---- Cloth: dark, outside the V, not the shadow under the shirt cuffs.
    # (Under the hem the floor's contact shadow is nearly as dark as the
    # cloth's lit edge: the limit is tighter there.)
    HEM_Y = c['hem_y']
    solid = Ls < np.where(yy > HEM_Y, 80, 112)
    near = f32(u8(solid.astype(np.float32)).filter(ImageFilter.MaxFilter(5))) > 0.5
    alpha = np.where(solid, 1.0, np.where(near, np.where(yy > HEM_Y, np.clip((115 - Ls) / 50, 0, 1), np.clip((170 - Ls) / 70, 0, 1)), 0.0)).astype(np.float32)
    alpha *= (1 - np.clip(VEE * 1.0, 0, 1) * (yy > TOP))
    for x0, x1 in c['cuffs']:
        box = (yy >= c['cuff_rows'][0]) & (yy <= c['cuff_rows'][1]) & (xx >= x0) & (xx <= x1)
        alpha = np.where(box & (Ls > 96), 0, alpha)
    alpha[backdrop] = 0

    # ---- The lapels' lines (photo px): roll lines and outer edges ---------
    # The roll lines (the V's two sides), per photo row.
    roll = {'L': {}, 'R': {}}
    for y in ys: roll['L'][y] = rollL[y] - 0.5; roll['R'][y] = rollR[y] + 1.5
    for side, pts in (('L', V_LEFT), ('R', V_RIGHT)):
        prev = (roll[side][ys[-1]], ys[-1])
        for x, y in pts:
            for q in range(int(prev[1]), int(y) + 1): roll[side][q] = prev[0] + (x - prev[0]) * (q - prev[1]) / max(1, y - prev[1])
            prev = (x, y)
    Lb = blur(L, 1.2)
    folds = {}
    for lp in c['lapels']:
        # A fold line that carries on below the V (the top lapel of a double
        # breasted front): added to its roll line.
        if lp.get('fold'):
            fpts = lp['fold']
            for q in range(int(fpts[0][1]), int(fpts[-1][1]) + 1): roll[lp['side']][q] = float(np.interp(q, [p[1] for p in fpts], [p[0] for p in fpts]))
            folds[lp['name']] = lp['side']
    edges = {}
    ridge = Lb - blur(L, 5.0)                         # negative on a thin dark line
    # The fold below the V and the top front's edge under it (the buttons sit
    # beside it): the dark line followed down from where the V closes.
    front = {}
    if c.get('v_auto'):
        x = float(APEX[0])
        for q in range(int(APEX[1]), min(H - 40, int(APEX[1]) + c.get('front_rows', 300))):
            cand = np.arange(int(round(x)) - 2, int(round(x)) + 3)
            x = float(cand[np.argmin(ridge[q, cand])]); front[q] = x
        fy = sorted(front); fx = np.polyval(np.polyfit(fy, [front[q] for q in fy], 4), fy)
        front = dict(zip(fy, [float(v) for v in fx]))

    def smooth(curve, n=7):
        qs = sorted(curve); xs = np.array([curve[q] for q in qs], np.float32)
        xs = np.convolve(np.pad(xs, n, mode='edge'), np.ones(2 * n + 1) / (2 * n + 1), 'valid')
        return dict(zip(qs, [float(v) for v in xs]))

    def trace(lp):
        """A lapel's outer edge: the thin shadow under it, followed as one
        line from the tip (through any waypoints). Without end=True the edge
        is taken to run straight on to where it meets the fold (viewer's
        right lapel) or goes under the other front (viewer's left)."""
        e = list(lp['edge']); side = lp['side']; half = lp.get('half', 16)
        if not lp.get('end'):
            tip = e[0]; ystop = int(APEX[1]) - 120
            tgt = (APEX[0] + (10 if side == 'R' else -10), APEX[1] + 40)
            ey = np.arange(tip[1], ystop + 1)
            gx = np.interp(ey, [p[1] for p in e + [tgt]], [p[0] for p in e + [tgt]])
            first = dp_line(ridge, ey, gx, half, end=half)
            qs = sorted(first)[-100:]; a, b = np.polyfit(qs, [first[q] for q in qs], 1)
            end = None
            if side == 'R':
                for q in sorted(front):
                    if a * q + b <= front[q] + 1: end = (front[q], q); break
                if end is None: end = (a * (APEX[1] + 90) + b, APEX[1] + 90)
            else:
                for q in range(ystop, int(APEX[1])):
                    if q in roll['L'] and a * q + b >= roll['L'][q] - 1: end = (roll['L'][q], q); break
                if end is None:
                    for q in sorted(front):
                        if a * q + b >= front[q] - 1: end = (front[q], q); break
                if end is None: end = (APEX[0], int(APEX[1]))
            e = [(first[q], q) for q in sorted(first)[::20]] + [(float(end[0]), int(end[1]))]
            half = 6
        ey = np.arange(int(e[0][1]), int(e[-1][1]) + 1)
        gx = np.interp(ey, [p[1] for p in e], [p[0] for p in e])
        lp['edge'] = [(round(float(x), 1), int(y)) for x, y in e]
        return smooth(dp_line(ridge, ey, gx, half))

    for lp in c['lapels']:
        side = lp['side']
        if lp.get('dp'):
            edges[lp['name']] = trace(lp)
            if front:
                # Below the V the lapel's roll line is the fold, down to where the edge meets it.
                for q in range(int(APEX[1]), int(lp['edge'][-1][1]) + 1):
                    if q in front: roll[side][q] = front[q]
            continue
        e = lp['edge']
        ey = np.arange(e[0][1], e[-1][1] + 1)
        if lp.get('fit'):
            ex = np.polyval(np.polyfit([p[1] for p in e], [p[0] for p in e], lp['fit']), ey)
        else:
            ex = np.interp(ey, [p[1] for p in e], [p[0] for p in e])
            if lp.get('refine'):
                # The thin shadow under the edge, found near the hand points
                # and smoothed.
                fx = []
                for y, x0 in zip(ey, ex):
                    cc = int(round(x0)); seg = Lb[int(y), cc - 7:cc + 8]; fx.append(cc - 7 + int(np.argmin(seg)))
                ex = np.polyval(np.polyfit(ey, fx, 5), ey)
        edges[lp['name']] = dict(zip(ey.tolist(), ex.tolist()))

    if CHECK and c.get('v_auto'):
        # The traced lines over the photo, to check by eye.
        bx = c.get('trace_box', (240, 60, 900, 780)); Z = 1.5
        im = src.crop(bx).resize((int((bx[2] - bx[0]) * Z), int((bx[3] - bx[1]) * Z)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        P = lambda x, y: ((x - bx[0]) * Z, (y - bx[1]) * Z)
        d.line([P(x, y) for x, y in vee] + [P(*vee[0])], fill=(0, 255, 0), width=1)
        for nm, curve in edges.items():
            d.line([P(curve[q], q) for q in sorted(curve)], fill=(255, 40, 40), width=1)
        if front: d.line([P(front[q], q) for q in sorted(front)], fill=(255, 220, 0), width=1)
        for lp in c['lapels']:
            for x, y in lp['edge']: d.ellipse([P(x, y)[0] - 3, P(x, y)[1] - 3, P(x, y)[0] + 3, P(x, y)[1] + 3], outline=(0, 200, 255))
        for gx in range(bx[0] // 50 * 50 + 50, bx[2], 50):
            d.line([P(gx, bx[1]), P(gx, bx[1] + 8)], fill=(255, 255, 0)); d.text((P(gx, 0)[0] + 2, 2), str(gx), fill=(255, 255, 0))
        for gy in range(bx[1] // 50 * 50 + 50, bx[3], 50):
            d.line([P(bx[0], gy), P(bx[0] + 8, gy)], fill=(0, 255, 255)); d.text((10, P(0, gy)[1] - 5), str(gy), fill=(0, 255, 255))
        im.save(os.path.join(CHECK, '%s-trace.png' % c['out']))
    if TRACE: return

    # ---- Painted out: the photo's own buttons, buttonholes and pockets.
    hole = np.zeros(L.shape, bool)
    for x, y, r in c.get('discs', []): hole |= disc(x, y, r, L.shape) > 0.5
    for r in c.get('rects', []): hole |= rect(*r, L.shape) > 0.5
    for p in c.get('polys', []): hole |= poly(p, L.shape) > 0.5
    if c.get('welt'):
        ex0, ey0, ex1, ey1 = c['welt_edge']
        hole |= (poly(c['welt'], L.shape) > 0.5) & (xx > ex0 + (yy - ey0) * (ex1 - ex0) / (ey1 - ey0) + c.get('welt_pad', 4))

    hole_near = np.asarray(u8(hole.astype(np.float32)).filter(ImageFilter.MaxFilter(11))) > 127

    def edge_at(y, side, inner):
        # Outward from a point inside the cloth to the first pixel that is not.
        x = inner
        while 0 < x < W - 1 and alpha[y, x + side] > 0.5: x += side
        return x
    for y0, y1, side, x0, x1, inner in c.get('straighten', []):
        # Rows y0..y1: the cloth's edge inside x0..x1 runs straight from its
        # place at y0 to its place at y1 (side -1: the cloth's left edge).
        ea, eb = edge_at(y0, side, inner), edge_at(y1, side, inner)
        for y in range(y0, y1 + 1):
            e = ea + (eb - ea) * (y - y0) / (y1 - y0)
            xs = np.arange(x0, x1)
            cov = np.clip((xs - e) + 0.5, 0, 1) if side < 0 else np.clip((e - xs) + 0.5, 0, 1)
            alpha[y, x0:x1] = np.where(hole_near[y, x0:x1] & ((xs < inner) if side < 0 else (xs > inner)), cov, alpha[y, x0:x1])
        print('  outline redrawn rows %d..%d from x %d to %d' % (y0, y1, ea, eb))
    cloth = alpha > 0.98
    Lp = inpaint(L, hole, cloth & ~hole)
    if c.get('welt'):
        # The lapel's outer edge ran under the chest welt's end: its thin
        # shadow is carried through the painted-out stretch, as deep as it
        # is just above.
        ex0, ey0, ex1, ey1 = c['welt_edge']; ya, yb = c['welt_rows']
        line = lambda y: ex0 + (y - ey0) * (ex1 - ex0) / (ey1 - ey0)
        xs, dep = [], []
        for y in range(ya - 70, ya - 6):
            cc = int(round(line(y))); seg = Lp[y, cc - 6:cc + 7]
            xs.append((y, cc - 6 + int(np.argmin(seg)))); dep.append(float(np.median(Lp[y, cc + 9:cc + 15]) - seg.min()))
        fx = np.polyfit([q[0] for q in xs], [q[1] for q in xs], 1); depth = min(20.0, float(np.median(dep)))
        for y in range(ya - 4, yb + 5):
            e = np.polyval(fx, y); cc = int(round(e)); xr = np.arange(cc - 8, cc + 9)
            w = np.clip((y - (ya - 4)) / 6, 0, 1) * np.clip(((yb + 4) - y) / 6, 0, 1)
            Lp[y, cc - 8:cc + 9] -= depth * w * np.exp(-0.5 * ((xr - e) / 1.6) ** 2)
        print('  lapel edge carried through the welt, depth %.1f' % depth)

    ref = float(np.median(L[cloth & ~hole]))
    keep = None
    if c.get('keep_edges'):
        # The lapels' edges and fold stay whole lines (found piece by piece
        # they come out dashed where the shadow under them is faint).
        keep = np.zeros(L.shape, np.float32)
        for nm, curve in list(edges.items()) + [('fold', dict((q, roll[sd][q]) for lp2 in c['lapels'] if lp2.get('fold') for sd in [lp2['side']] for q in range(int(lp2['fold'][0][1]), int(lp2['fold'][-1][1]) + 1)))]:
            for q, x in curve.items():
                cc = int(round(x)); keep[int(q), cc - 3:cc + 4] = 1
        keep = blur(keep, 1.0)
    R = shade_map(Lp, alpha, ref, keep=keep)

    # ---- Onto the picture frame.
    OW, OH = int(VBW * K), int(VBH * K)
    def frame(a, fill):
        """Photo px -> the 800 x 952 picture at K px per unit."""
        x0 = CX - 400 / S; y0 = -OY / S; x1 = CX + 400 / S; y1 = (VBH - OY) / S
        im = Image.fromarray(np.asarray(a, np.float32), 'F')
        return np.asarray(im.transform((OW, OH), Image.EXTENT, (x0, y0, x1, y1), Image.BICUBIC, fillcolor=fill))
    Rf = frame(R, 1.0); Af = np.clip(frame(alpha, 0.0), 0, 1)
    hi = np.clip(Rf - 1, 0, None); hi = 0.6 * (1 - np.exp(-hi / 0.6))
    M1 = np.clip(Rf, 0, 1) * 255; M2 = np.clip(hi, 0, 1) * 255; AA = Af * 255
    Image.fromarray(np.concatenate([np.dstack([M1, M1, M1, AA]), np.dstack([M2, M2, M2, AA])], 0).astype(np.uint8), 'RGBA').save(
        os.path.join(ROOT, 'assets', 'jacket-photo-shade-%s.webp' % c['out']), quality=92, method=6)

    # ---- The photo: shirt, tie and cuffs on the page colour; behind the
    # cloth, whatever is beside it (so the cloth's soft edge blends into the
    # right thing).
    base = A.copy()
    if shirt_fix:
        base = base * (1 - shirt_fix[1]) + shirt_fix[0] * shirt_fix[1]
    base = base * (1 - tie_t[..., None]) + tie_col * tie_t[..., None]
    # (The thin rim between the cloth and the backdrop, a mix of the two with
    # the photo's bright fringe, goes with the backdrop: left as it is, it
    # shows as a dotted line beside a light fabric.)
    grow = lambda m: np.asarray(u8(m.astype(np.float32)).filter(ImageFilter.MaxFilter(7))) > 127
    rim = grow(backdrop) & grow(alpha > 0.5) & (alpha <= 0.02) & ~backdrop
    bd = np.maximum(blur((backdrop | rim).astype(np.float32), 0.8), backdrop | rim)[..., None]
    # The backdrop becomes the page colour; the soft shadow the jacket casts
    # on the floor stays, as a shadow on the page colour, fading out before
    # the picture's bottom edge (the folded pants sit right below it).
    BG_L = float(np.median(L[backdrop & (yy < 1100)]))
    fade = np.clip(((VBH - 3 - OY) / S - yy) / (12 / S), 0, 1)
    shadow = 1 - (1 - np.clip(blur(L, 1.5) / (BG_L * 0.96), 0, 1)) * fade * (yy > c['floor_y'])
    # (No floor shadow in the narrow gaps beside the sleeves: there the blur
    # picks up the cloth on both sides and draws a grey line.)
    for x0, y0, x1, y1 in c['gaps']:
        shadow[y0:y1, x0:x1] = 1
    base = base * (1 - bd) + (PAGE[None, None, :] * shadow[..., None]) * bd
    # (Where a painted-out flap or sleeve button stuck out past the outline,
    # the page colour takes its place.)
    base[hole & (alpha <= 0.02)] = PAGE
    behind = alpha > 0.02
    for ch in range(3):
        base[..., ch] = inpaint(base[..., ch], behind, ~behind)
    photo = np.dstack([frame(base[..., ch], float(PAGE[ch])) for ch in range(3)])
    Image.fromarray(np.clip(photo, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(ROOT, 'assets', 'jacket-photo-%s.webp' % c['out']), quality=90, method=6)
    if CHECK:
        v = np.dstack([np.clip(Rf, 0, 1.6) / 1.6 * 255] * 3) * Af[..., None] + photo * (1 - Af[..., None])
        Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, '%s-check.png' % c['out']))
        Image.fromarray(np.clip(photo, 0, 255).astype(np.uint8)).save(os.path.join(CHECK, '%s-photo.png' % c['out']))
    print('  ref L %.1f tie mean %.1f backdrop L %.1f' % (ref, tie_mean, BG_L))
    print('  landmarks', {k: U(*v) for k, v in c.get('landmarks', {}).items()})

    # ---- Measurements for jacket-studio.js (picture units) -----------------
    M = {'profiles': {}}
    for lp in c['lapels']:
        side = lp['side']; e = lp['edge']; edge = edges[lp['name']]
        # Under the other lapel's fold the roll line is that fold.
        rl = dict(roll[side])
        if lp.get('under'):
            other = roll[folds[lp['under']]]
            for q in other:
                if q > V_LEFT[-1][1]: rl[q] = other[q]
        ytip = e[0][1]; rows = []
        first = min(q for q in rl if q >= ytip - 14)
        rows.append([U(0, first)[1], U(rl[first], 0)[0], U(rl[first], 0)[0]])
        y = float(ytip); yend = min(max(rl), e[-1][1])
        while y < yend:
            rows.append([U(0, y)[1], U(rl[int(y)], 0)[0], U(edge[int(y)], 0)[0]])
            y += 12 / S
        rows.append([U(0, yend)[1], U(rl[int(yend)], 0)[0], U(edge[int(yend)], 0)[0]])
        if lp.get('fit'):
            # (Single breasted: the edge runs on down to where it meets the front edge.)
            rows[-1][2] = U(float(np.polyval(np.polyfit([p[1] for p in e], [p[0] for p in e], lp['fit']), V_RIGHT[-1][1])), 0)[0]
            rows.append([U(0, e[-1][1])[1], U(e[-1][0], 0)[0], U(e[-1][0], 0)[0]])
        M['profiles'][lp['name']] = [[round(r[0]), round(r[1]), round(r[2])] for r in rows]
        print('  LAPEL_PROFILE %s' % lp['name'], str(M['profiles'][lp['name']]).replace(' ', ''))
    yq = min(300, ys[-1])
    M['mirror'] = round(U(rollL[yq], 0)[0] + U(rollR[yq], 0)[0], 1)
    print('  lapel mirror x (sum of the two roll lines at y %d px): %.1f' % (yq, M['mirror']))

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
        else: print('  (row %d: body and sleeves not apart: %s)' % (yu, [(round(a), round(b)) for a, b in r]))
    M['sides'] = body; M['sleeves'] = sleeve
    print('  BODY_SIDES', str(body).replace(' ', '')); print('  SLEEVE_SIDES', str(sleeve).replace(' ', ''))
    r = runs_at(800); print('  sleeve outer edges at y 800: %.1f %.1f' % (r[0][0], r[-1][1]))
    # Where the viewer's left sleeve ends (down its middle), and the cuffs'
    # place for the page from it: [scale, x shift, y shift].
    mid = int((r[0][0] + r[0][1]) / 2 * K); col = Af[int(800 * K):, mid] > 0.5
    send = 800 + (int(np.argmin(col)) if not col.all() else len(col)) / K
    sc = (r[-1][1] - r[0][0]) / 738.14
    M['cuffs'] = [round(sc, 3), round(r[0][0] - sc * 31.16, 2)]; M['sleeveEnd'] = round(send, 1)
    print('  sleeve end y %.1f  CUFFS [%.3f, %.2f, y shift = this sleeve end - the first photo\'s + its shift]' % (send, sc, r[0][0] - sc * 31.16))
    if front:
        M['frontEdge'] = [[U(0, q)[1], U(front[q], 0)[0]] for q in sorted(front)[::15]]
        M['apex'] = list(U(*APEX)); M['ends'] = {lp['name']: list(U(*lp['edge'][-1])) for lp in c['lapels']}; M['tips'] = {lp['name']: list(U(*lp['edge'][0])) for lp in c['lapels']}
        print('  FRONT_EDGE', str(M['frontEdge'][::2]).replace(' ', ''))
        print('  APEX', U(*APEX), ' lapel ends', {lp['name']: U(*lp['edge'][-1]) for lp in c['lapels']}, ' tips', {lp['name']: U(*lp['edge'][0]) for lp in c['lapels']})

    if c.get('opening_seed'):
        # The opening below the bottom button (the jacket's inside shows):
        # the dark region between the fronts.
        Rf_s = blur(Rf, 1.5)
        sd = U(*c['opening_seed']); seed = (int(sd[0] * K), int(sd[1] * K))
        if c.get('v_auto'):
            # Row by row from the seed: the dark run between the fronts, up
            # to where it closes (a thin crease above it is not the opening).
            thr = min(0.84, (float(np.median(Rf_s[seed[1] - 6:seed[1] + 7, seed[0] - 6:seed[0] + 7])) + 1.0) / 2)
            dk = (Rf_s < thr) & (Af > 0.9)
            op = np.zeros(dk.shape, bool)
            for step in (-1, 1):
                cx = seed[0]; y = seed[1]
                while 0 < y < dk.shape[0] - 1:
                    if not dk[y, cx]:
                        near = np.where(dk[y, max(0, cx - 12):cx + 13])[0]
                        if not len(near): break
                        cx = max(0, cx - 12) + int(near[np.argmin(np.abs(near - 12))])
                    x0 = cx
                    while x0 > 0 and dk[y, x0 - 1]: x0 -= 1
                    x1 = cx
                    while x1 < dk.shape[1] - 1 and dk[y, x1 + 1]: x1 += 1
                    if x1 - x0 < 10: break
                    op[y, x0:x1 + 1] = True; cx = (x0 + x1) // 2; y += step
        else:
            dark = u8(((Rf_s < 0.74) & (Af > 0.9)).astype(np.float32))
            ImageDraw.floodfill(dark, seed, 128)
            op = np.asarray(dark) == 128
        oy = np.where(op.any(1))[0]
        left, right = [], []
        for yu in range(int(oy[0] / K) + 2, int(oy[-1] / K), 14):
            xs = np.where(op[int(yu * K)])[0]
            if len(xs): left.append((round(xs[0] / K, 1), yu)); right.append((round((xs[-1] + 1) / K, 1), yu))
        if c.get('v_auto'):
            # (The opening only widens toward the hem: a paler patch of the
            # inside must not dent its sides.)
            def undent(side, sign):
                xs = [q[0] * sign for q in side]; good = [0]
                for i in range(1, len(xs)):
                    if xs[i] <= min(xs[:i]): good.append(i)
                fx = np.interp(range(len(xs)), good, [xs[i] for i in good])
                return [(round(float(v) * sign, 1), q[1]) for v, q in zip(fx, side)]
            left, right = undent(left, 1), undent(right, -1)
        pts = [(round((left[0][0] + right[0][0]) / 2, 1), round(oy[0] / K, 1))] + right + [(right[-1][0], round(oy[-1] / K, 1)), (left[-1][0], round(oy[-1] / K, 1))] + left[::-1]
        M['opening'] = 'M' + ' L'.join('%g,%g' % p for p in pts) + ' Z'
        M['openingBox'] = [round(min(p[0] for p in pts)) - 6, round(oy[0] / K) - 6, round(max(p[0] for p in pts)) + 6, round(oy[-1] / K) + 4]
        print('  SB_OPENING', M['opening'])
        print('  opening box', M['openingBox'])
        if CHECK:
            v = Image.open(os.path.join(CHECK, '%s-check.png' % c['out'])).convert('RGB'); d = ImageDraw.Draw(v)
            d.line([(x * K, y * K) for x, y in pts] + [(pts[0][0] * K, pts[0][1] * K)], fill=(255, 0, 0), width=2)
            v.save(os.path.join(CHECK, '%s-check.png' % c['out']))
    if CHECK:
        json.dump(M, open(os.path.join(CHECK, '%s.json' % c['out']), 'w'))


if __name__ == '__main__':
    for name, cfg in PHOTOS.items():
        if not ONLY or name in ONLY: build(name, cfg)
