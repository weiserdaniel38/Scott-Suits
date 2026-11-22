"""Two repairs to the front shading maps, run AFTER make_jacket_photo*.py and
crisp_jacket_shading.py, once per rebuild (a second run finds nothing left
to do). It rewrites the maps in place.

1. The sliver between the body and each sleeve. Daniel 2026-11-22, on a
   zoomed lower flap pocket: "this got cut". The lower pockets run back
   round the side (his rule: they start from the back, never whole from the
   front), but on the photo a thin lens of backdrop shows between the body
   and the hanging sleeve from the elbow to the cuff, so the pocket stopped
   dead at that lens and looked chopped off. The lens is filled as cloth in
   deep shadow (the sleeve resting against the body, as on his 2026-11-22
   front reference photo), so the pocket runs on under the sleeve. Prints
   the sleeve's inner edge per row for SLEEVE_SIDES in jacket-studio.js.

2. The lapel's edge beside the chest pocket. Daniel 2026-11-22: "Fix lapel".
   Where the mockup's chest pocket was painted out, the shadow under the
   lapel's edge was painted out with it: the edge stopped in a blob above
   the pocket and started again below it, and the page drew a thin straight
   line across the gap a few pixels off, so the edge looked doubled. The
   edge's own shadow is now carried through the gap in the map (notch and
   peak maps; the other lapels have their own edge), and the page draws no
   line.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
NAMES = ['front', 'front-peak', 'front-diamond', 'front-shawl', 'front-db', 'front-db-diamond', 'front-db-shawl', 'front-arc-photo']
# Where the lens can be (picture units): beside the body, elbow to cuff.
WINDOWS = [(140, 400, 222, 842), (578, 400, 662, 842)]


def u8(m):
    return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))


def close(name):
    path = os.path.join(ROOT, 'assets', 'jacket-photo-shade-%s.webp' % name)
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    H = a.shape[0] // 2; W = a.shape[1]; k = W / 800.0
    m1 = a[:H, :, 0].copy(); m2 = a[H:, :, 0].copy(); al = a[:H, :, 3].copy() / 255
    lens = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in WINDOWS:
        X0, Y0, X1, Y1 = int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)
        hole = al[Y0:Y1, X0:X1] < 0.5
        # Anything joined to the window's border is the real backdrop, not the lens.
        im = u8(hole.astype(np.float32))
        w, h = im.size
        for x in range(w):
            for y in (0, h - 1):
                if im.getpixel((x, y)) == 255: ImageDraw.floodfill(im, (x, y), 100)
        for y in range(h):
            for x in (0, w - 1):
                if im.getpixel((x, y)) == 255: ImageDraw.floodfill(im, (x, y), 100)
        lens[Y0:Y1, X0:X1] = np.asarray(im) == 255
    if lens.sum() < 50:
        print(name, 'nothing to fill'); return None
    # The lens and the soft edges beside it.
    grow = int(round(2 * k))
    zone = np.asarray(u8(lens.astype(np.float32)).filter(ImageFilter.MaxFilter(2 * grow + 1))) > 127
    # The soft rim of the cloth either side of the lens was part see-through
    # (it faded into the backdrop); it is solid cloth now.
    rim = np.asarray(u8(lens.astype(np.float32)).filter(ImageFilter.MaxFilter(2 * int(round(6 * k)) + 1))) > 127
    al0 = al.copy()
    rows = {}
    for y in np.where(zone.any(1))[0]:
        for half in (slice(0, W // 2), slice(W // 2, W)):
            xs = np.where(zone[y, half])[0]
            if not len(xs): continue
            xa, xb = xs[0] + half.start, xs[-1] + half.start
            pad = int(round(3 * k))
            # The cloth's rim either side of the lens caught the backdrop's
            # light (a pale line once the lens is cloth): bring each rim down
            # to the cloth a little further in.
            R = int(round(5 * k)); F = int(round(4 * k))
            ref_l = float(np.median(m1[y, xa - R - F:xa - R])); ref_r = float(np.median(m1[y, xb + 1 + R:xb + 1 + R + F]))
            m1[y, xa - R:xa] = np.minimum(m1[y, xa - R:xa], ref_l); m2[y, xa - R:xa] = 0
            m1[y, xb + 1:xb + 1 + R] = np.minimum(m1[y, xb + 1:xb + 1 + R], ref_r); m2[y, xb + 1:xb + 1 + R] = 0
            vl = m1[y, max(0, xa - pad):xa].mean() if xa > pad else 120.0
            vr = m1[y, xb + 1:xb + 1 + pad].mean()
            t = np.linspace(0, 1, xb - xa + 1)
            # Body side to sleeve edge, sinking into shadow in between: the
            # sleeve lies on top, so the shadow is deepest close under its
            # edge (the sleeve is the outer side of each lens).
            wd = (xb - xa + 1) / k
            deep = 0.72 * min(1.0, wd / 9.0)
            ts = t if half.start else 1 - t
            m1[y, xa:xb + 1] = (vl + (vr - vl) * t) * (1 - deep * np.sin(np.pi * ts ** 1.7))
            m2[y, xa:xb + 1] = 0
            al[y, xa:xb + 1] = 1
            if half.start == 0: rows.setdefault(int(y), [None, None])[0] = xa / k
            else: rows.setdefault(int(y), [None, None])[1] = (xb + 1) / k
    # Smooth the fill down the rows (each row was filled on its own).
    sm = np.asarray(Image.fromarray(np.clip(m1, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2 * k / 2))).astype(np.float32)
    m1 = np.where(zone, sm, m1)
    al = np.where(rim & (al0 > 0.04), 1.0, al)
    out = np.concatenate([np.dstack([m1, m1, m1, al * 255]), np.dstack([m2, m2, m2, al * 255])], 0)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(path, quality=92, method=6)
    ys = sorted(rows)
    print(name, 'filled px', int(lens.sum()), 'rows %d..%d' % (ys[0] / k, ys[-1] / k))
    return rows, k


def lapel_edge(name):
    """Carry the lapel edge's shadow through the painted-out stretch."""
    path = os.path.join(ROOT, 'assets', 'jacket-photo-shade-%s.webp' % name)
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    H = a.shape[0] // 2; W = a.shape[1]; k = W / 800.0
    m1 = a[:H, :, 0].copy()

    def darkest(y, guess, span=7):
        row = m1[int(y * k)]
        x0 = int((guess - span) * k); x1 = int((guess + span) * k)
        return (x0 + int(np.argmin(row[x0:x1]))) / k, float(row[x0:x1].min())

    # The edge above the gap (around y 226) and below it (around y 346).
    top = [darkest(y, 548 - (y - 192) * 0.42) for y in (214, 220, 226)]
    bot = [darkest(y, 485 - (y - 342) * 0.45) for y in (344, 348, 352)]
    xa, xb = float(np.mean([t[0] for t in top])), float(np.mean([t[0] for t in bot]))
    ya, yb = 220.0, 348.0
    mid = darkest(294, xa + (xb - xa) * (294 - ya) / (yb - ya), 4)
    if mid[1] < 150:
        print(name, 'lapel edge already whole'); return
    depth = float(np.mean([t[1] for t in top] + [t[1] for t in bot]))
    yy, xx = np.mgrid[int(226 * k):int(346 * k), int(440 * k):int(580 * k)].astype(np.float32)
    yy /= k; xx /= k
    ex = xa + (xb - xa) * (yy - ya) / (yb - ya)
    d = xx - ex
    sub = m1[int(226 * k):int(346 * k), int(440 * k):int(580 * k)]
    # The blob where the old shadow stopped, and whatever is left of it: the
    # plain cloth either side of the edge, meeting at the edge.
    left = np.median(sub[(d > -16) & (d < -9)]); right = np.median(sub[(d > 9) & (d < 16)])
    flat = left + (right - left) * np.clip((d + 1.2) / 2.4, 0, 1)
    near = np.clip((9 - np.abs(d)) / 3, 0, 1)
    # Fade the repair in at both ends so it joins the photo's own edge.
    ends = np.clip((yy - 228) / 8, 0, 1) * np.clip((344 - yy) / 8, 0, 1)
    base = sub * (1 - near * ends) + flat * near * ends
    # The shadow under the edge: as dark and as wide as the photo's.
    line = np.exp(-0.5 * (d / 1.7) ** 2)
    target = depth + (base - depth) * 0  # the shadow's darkest level
    out = base * (1 - line * ends) + np.minimum(base, target) * line * ends
    m1[int(226 * k):int(346 * k), int(440 * k):int(580 * k)] = out
    a[:H, :, 0] = a[:H, :, 1] = a[:H, :, 2] = m1
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(path, quality=92, method=6)
    print(name, 'lapel edge carried from (%.1f, %d) to (%.1f, %d), level %d' % (xa, ya, xb, yb, depth))


if __name__ == '__main__':
    for n in ('front', 'front-peak'):
        lapel_edge(n)
    for n in NAMES:
        r = close(n)
        if r and n in ('front', 'front-arc-photo'):
            rows, k = r
            pts = []
            for y in range(520, 801, 40):
                c = [v for yy, v in rows.items() if abs(yy / k - y) < 1.5]
                l = [v[0] for v in c if v[0] is not None]; rr = [v[1] for v in c if v[1] is not None]
                pts.append([y, round(float(np.mean(l)), 1) if l else None, round(float(np.mean(rr)), 1) if rr else None])
            print('  SLEEVE_SIDES', n, pts)
