"""Build a copy of the site for another storefront brand (see brand.js).

    python3 scripts/build_brand_site.py sw _site/sw [--domain example.com]

Copies the site files into the output folder and rewrites each page's
<head> so the brand is baked in (<html data-brand="sw">) and link previews,
the tab title and icons show that brand instead of Scott's Suits, with no
prices. The page itself still runs the same brand.js/main.js as
scottssuits.com, so every fix reaches both sites.

Run by .github/workflows/brand-sites.yml on every push to main, which
publishes the result to the site-<brand> branch for that domain's hosting.
"""

import argparse
import html
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BRANDS = {
    "sw": {
        "name": "S.W. Atelier",
        "title": "S.W. Atelier: Custom Suits & Formalwear",
        "description": "Design your custom suit online at S.W. Atelier: choose the fabric, lapels, pockets and buttons, send your measurements, and we build it for you.",
        "icon": "./assets/sw/icon-192.png",
        "favicon": "./assets/sw/favicon.ico",
        "apple_icon": "./assets/sw/apple-touch-icon.png",
        "share_image": "assets/sw/share-image.jpg",
        "logo": "./assets/sw/logo.png",
        "logo_size": (640, 552),
        # Coworkers only: keep it out of search engines.
        "noindex": True,
    },
}

# Never copied: tooling, database code and docs.
SKIP = {".git", ".github", "scripts", "supabase", "_site", "README.md", "node_modules"}

PAGE_TITLES = {
    "index.html": None,
    "contact.html": "Contact",
    "fabrics.html": "Fabrics",
    "privacy.html": "Privacy Policy",
}

# Head tags that name Scott's Suits or its prices; replaced as a set.
DROP = [
    r'<title>.*?</title>\s*',
    r'<meta name="description"[^>]*>\s*',
    r'<meta name="keywords"[^>]*>\s*',
    r'<meta property="og:[^>]*>\s*',
    r'<meta name="twitter:[^>]*>\s*',
    r'<link rel="canonical"[^>]*>\s*',
    r'<link rel="icon"[^>]*>\s*',
    r'<link rel="apple-touch-icon"[^>]*>\s*',
    r'<script type="application/ld\+json">.*?</script>\s*',
    r'<script data-goatcounter[^>]*></script>\s*',
]


def brand_head(b, page, domain):
    sub = PAGE_TITLES.get(page)
    title = b["name"] + ": " + sub if sub else b["title"]
    e = lambda s: html.escape(s, quote=True)
    tags = [
        "<title>%s</title>" % e(title),
        '<meta name="description" content="%s">' % e(b["description"]),
        '<link rel="icon" href="%s" sizes="any">' % b["favicon"],
        '<link rel="icon" type="image/png" href="%s" sizes="192x192">' % b["icon"],
        '<link rel="apple-touch-icon" href="%s">' % b["apple_icon"],
        '<meta property="og:site_name" content="%s">' % e(b["name"]),
        '<meta property="og:title" content="%s">' % e(title),
        '<meta property="og:description" content="%s">' % e(b["description"]),
        '<meta property="og:type" content="website">',
    ]
    if domain:
        url = "https://" + domain + "/"
        tags += [
            '<link rel="canonical" href="%s">' % (url + ("" if page == "index.html" else page)),
            '<meta property="og:url" content="%s">' % url,
            '<meta property="og:image" content="%s">' % (url + b["share_image"]),
            '<meta name="twitter:card" content="summary">',
            '<meta name="twitter:image" content="%s">' % (url + b["share_image"]),
        ]
    if b.get("noindex"):
        tags.append('<meta name="robots" content="noindex, nofollow">')
    return "\n".join(tags) + "\n"


def rewrite_page(path, brand_id, b, domain):
    with open(path, encoding="utf-8") as f:
        s = f.read()
    head_end = s.index("</head>")
    head, rest = s[:head_end], s[head_end:]
    for pat in DROP:
        head = re.sub(pat, "", head, flags=re.S)
    # Drop the HTML comments that sat above the removed tags.
    head = re.sub(r"<!--.*?-->\s*", "", head, flags=re.S)
    head = re.sub(
        r'(<meta name="viewport"[^>]*>\s*)',
        lambda m: m.group(1) + brand_head(b, os.path.basename(path), domain),
        head,
        count=1,
    )
    rest = re.sub(r'<script data-goatcounter[^>]*></script>\s*', "", rest)
    # The page text and logo too, so even the page source shows the brand
    # (brand.js does the same in the browser, plus the text main.js writes).
    rest = re.sub(r"Scott['\u2019]s Suits|Scott Suits", lambda m: b["name"], rest)
    rest = re.sub(
        r'src="\./assets/logo-full-new\.png"([^>]*?)width="779" height="420"',
        lambda m: 'src="%s"%swidth="%d" height="%d"' % (b["logo"], m.group(1), b["logo_size"][0], b["logo_size"][1]),
        rest,
    )
    s = head + rest
    s = re.sub(r"<html([^>]*)>", lambda m: '<html%s data-brand="%s">' % (m.group(1), brand_id), s, count=1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)


def build(brand_id, out, domain=None):
    b = BRANDS[brand_id]
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    for name in os.listdir(ROOT):
        if name in SKIP or name.startswith("."):
            continue
        src = os.path.join(ROOT, name)
        dst = os.path.join(out, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    for page in PAGE_TITLES:
        p = os.path.join(out, page)
        if os.path.exists(p):
            rewrite_page(p, brand_id, b, domain)
    for icon, src in (("favicon.ico", b["favicon"]), ("apple-touch-icon.png", b["apple_icon"])):
        shutil.copy2(os.path.join(ROOT, src), os.path.join(out, icon))
    if os.path.exists(os.path.join(out, "sitemap.xml")):
        os.remove(os.path.join(out, "sitemap.xml"))
    with open(os.path.join(out, "robots.txt"), "w") as f:
        f.write("User-agent: *\nDisallow: /\n" if b.get("noindex") else "User-agent: *\nAllow: /\n")
    if domain:
        with open(os.path.join(out, "CNAME"), "w") as f:
            f.write(domain + "\n")
    # Static hosts (GitHub Pages) skip files starting with "_" otherwise.
    open(os.path.join(out, ".nojekyll"), "w").close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("brand", choices=sorted(BRANDS))
    ap.add_argument("out")
    ap.add_argument("--domain", default=os.environ.get("BRAND_DOMAIN") or None)
    a = ap.parse_args()
    build(a.brand, a.out, a.domain)
    print("built", a.brand, "into", a.out, "for", a.domain or "(no domain yet)")
