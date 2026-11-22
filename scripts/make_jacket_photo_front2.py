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
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ARGS = sys.argv[1:]
CHECK = ARGS[0] if ARGS and os.path.isdir(ARGS[0]) else None
ONLY = [a for a in ARGS if not os.path.isdir(a)]
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
        if len(xs) > 20: rollL[y] = c0 + xs[0]; rollR[y] = c0 + xs[-1]
    V_LEFT, V_RIGHT = c['v_left'], c['v_right']
    ys = sorted(y for y in rollL if y <= c['auto_to'])
    vee = [(rollL[y] - 0.5, y) for y in ys] + V_LEFT + V_RIGHT[::-1] + [(rollR[y] + 1.5, y) for y in reversed(ys)]
    VEE = poly(vee, L.shape)
    TOP = c['tie_top']

    # ---- The tie: the dark part of the V, recoloured to the old photo's
    # burgundy. (Dark and joined up; the shirt's shadow beside the knot is
    # lighter than any part of the tie.)
    tie_core = (Ls < 92) & (VEE > 0.5) & (yy > TOP)
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
    for lp in c['lapels']:
        side = lp['side']; e = lp['edge']
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
        print('  LAPEL_PROFILE %s' % lp['name'], str([[round(r[0]), round(r[1]), round(r[2])] for r in rows]).replace(' ', ''))
    yq = min(300, ys[-1])
    print('  lapel mirror x (sum of the two roll lines at y %d px): %.1f' % (yq, U(rollL[yq], 0)[0] + U(rollR[yq], 0)[0]))

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
    print('  BODY_SIDES', str(body).replace(' ', '')); print('  SLEEVE_SIDES', str(sleeve).replace(' ', ''))
    r = runs_at(800); print('  sleeve outer edges at y 800: %.1f %.1f' % (r[0][0], r[-1][1]))

    if c.get('opening_seed'):
        # The opening below the bottom button (the jacket's inside shows):
        # the dark region between the fronts.
        Rf_s = blur(Rf, 1.5)
        dark = u8(((Rf_s < 0.74) & (Af > 0.9)).astype(np.float32))
        sd = U(*c['opening_seed']); seed = (int(sd[0] * K), int(sd[1] * K))
        ImageDraw.floodfill(dark, seed, 128)
        op = np.asarray(dark) == 128
        oy = np.where(op.any(1))[0]
        left, right = [], []
        for yu in range(int(oy[0] / K) + 2, int(oy[-1] / K), 14):
            xs = np.where(op[int(yu * K)])[0]
            if len(xs): left.append((round(xs[0] / K, 1), yu)); right.append((round((xs[-1] + 1) / K, 1), yu))
        pts = [(round((left[0][0] + right[0][0]) / 2, 1), round(oy[0] / K, 1))] + right + [(right[-1][0], round(oy[-1] / K, 1)), (left[-1][0], round(oy[-1] / K, 1))] + left[::-1]
        print('  SB_OPENING', 'M' + ' L'.join('%g,%g' % p for p in pts) + ' Z')
        print('  opening box', round(min(p[0] for p in pts)), round(oy[0] / K), round(max(p[0] for p in pts)), round(oy[-1] / K))


if __name__ == '__main__':
    for name, cfg in PHOTOS.items():
        if not ONLY or name in ONLY: build(name, cfg)
