"""Builds the seamless fabric tiles the interactive jacket paints with.

For every fabric in catalog.js that has a high-resolution zoom tile
(FABRIC_ZOOM_MAP), crop the cloth inside the pinked edges, shrink it and
mirror it into a 2x2 tile so it repeats without visible seams. Output:
assets/jacket-tex-<code>.webp (same <code> as the fabric's jacket-fabric-*.jpg
thumbnail). A fabric without a tile still works on the jacket: jacket-studio.js
falls back to the thumbnail.

Run from the repo root:  python3 scripts/make_jacket_textures.py
"""
import os
import re

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = open(os.path.join(ROOT, "catalog.js"), encoding="utf-8").read()
TILE = 1560  # FABRIC_ZOOM_TILE_SIZE
OUT_HALF = 256

zoom = {m.group(1): (m.group(2), int(m.group(3)), int(m.group(4))) for m in re.finditer(
    r'"([^"]+)": \{ sprite: "\./assets/([^"]+)", col: (\d+), row: (\d+) \}', CATALOG)}
thumbs = {m.group(1): m.group(2) for m in re.finditer(
    r'\{ name: "([^"]+)", displayName: "[^"]*", img: "\./assets/jacket-fabric-([^"]+)\.jpg"', CATALOG)}

sheets = {}
made = 0
for code, slug in sorted(thumbs.items()):
    if code not in zoom:
        print("no zoom tile:", code)
        continue
    sprite, col, row = zoom[code]
    if sprite not in sheets:
        sheets[sprite] = Image.open(os.path.join(ROOT, "assets", sprite)).convert("RGB")
    tile = sheets[sprite].crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))
    m = int(TILE * 0.1)  # stay inside the pinked edge
    cloth = tile.crop((m, m, TILE - m, TILE - m)).resize((OUT_HALF, OUT_HALF), Image.LANCZOS)
    out = Image.new("RGB", (OUT_HALF * 2, OUT_HALF * 2))
    out.paste(cloth, (0, 0))
    out.paste(ImageOps.mirror(cloth), (OUT_HALF, 0))
    out.paste(ImageOps.flip(cloth), (0, OUT_HALF))
    out.paste(ImageOps.flip(ImageOps.mirror(cloth)), (OUT_HALF, OUT_HALF))
    out.save(os.path.join(ROOT, "assets", "jacket-tex-" + slug + ".webp"), "WEBP", quality=80, method=6)
    made += 1
print("made", made, "of", len(thumbs))
