"""Bottom-buttonhole contrast versions of the sleeve cuff reference pictures.

For each assets/jacket-cuffref-*.jpg writes assets/jacket-cuffref-*-accent.jpg
with the LOWEST buttonhole's stitching recolored green, so the image model
sees which of the buttonholes gets the contrast thread ("Bottom Sleeve
Buttonhole") instead of adding one more. The prompt says the green only marks
that buttonhole and names the real thread color.

Usage: python3 scripts/cuffref_accent.py assets
"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from PIL import ImageFilter

ACCENT = np.array([40, 150, 70])


def dilate(mask, r):
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))
    return np.asarray(img) > 0


def label(mask):
    """4-connected components; returns (labels, count)."""
    lab = np.zeros(mask.shape, int)
    n = 0
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        stack = [(y0, x0)]
        lab[y0, x0] = n
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    stack.append((yy, xx))
    return lab, n

for path in sorted(glob.glob(os.path.join(sys.argv[1], "jacket-cuffref-*.jpg"))):
    if path.endswith("-accent.jpg"):
        continue
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    # buttonhole stitching
    # (light pixels inside the sleeve; the light background touches the edges)
    light_all = a.mean(axis=2) > 150
    blab, bn = label(light_all)
    edge = set(np.unique(np.concatenate([blab[0], blab[-1], blab[:, 0], blab[:, -1]]))) - {0}
    hole = light_all & ~np.isin(blab, list(edge))
    lab, n = label(dilate(hole, 4))
    comps = [(np.nonzero(hole & (lab == i))[0].mean(), i) for i in range(1, n + 1) if (hole & (lab == i)).sum() > 150]
    if not comps:
        print("no buttonholes found", path)
        continue
    lowest = max(comps)[1]
    region = dilate(lab == lowest, 3)
    # recolor every light pixel in that buttonhole, keeping its shading
    light = region & (a.mean(axis=2) > 110) & (np.abs(a[..., 0] - a[..., 2]) < 40)
    lum = (a.mean(axis=2) / 240.0)[..., None]
    out = a.copy()
    out[light] = np.clip(ACCENT * (0.55 + 0.6 * lum[light]), 0, 255)
    Image.fromarray(out.astype(np.uint8)).save(path[:-4] + "-accent.jpg", quality=90)
    print("ok", os.path.basename(path), len(comps), "holes")
