"""Hip pocket reference pictures for the suit image generator.

Writes assets/jacket-hipref-<variant>.jpg: a close-up crop of the website's
own lower pocket graphic (assets/jacket-lowerpocket-new-<variant>.jpg),
cropped to the hip pockets and enlarged so their slant and any ticket pocket
are easy for the image model to see. Daniel: always use the website graphics
as the reference. Run from the repo root: python3 scripts/hipref_crop.py
"""
from PIL import Image

VARIANTS = [
    "sbslant", "dbslant", "slantflap", "slantflapsbt", "slantflapdbt", "slantflapft",
    "sbsbt", "dbdbt", "dbwflapsbt", "dbwflapdbt", "flapft",
    "patchsbt", "patchdbt", "patchhighbacksbt", "patchhighbackdbt",
]
BOX = (60, 230, 420, 445)  # both hip pockets and the ticket pocket, of 480x480
for v in VARIANTS:
    im = Image.open(f"assets/jacket-lowerpocket-new-{v}.jpg").convert("RGB").crop(BOX)
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    im.save(f"assets/jacket-hipref-{v}.jpg", quality=90)
print("ok")
