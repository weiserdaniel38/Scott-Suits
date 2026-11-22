// ============================================================
// YOUR JACKET PEEK (was "Interactive Jacket" mode)
// Since 2026-11-19 (Daniel): a small read-only picture of the jacket beside
// the step-by-step questions on the Jacket page, following every pick; tap
// it to see the jacket big (Front / Back / Inside, zoom). The questions stay
// the only way to choose. See "Peek" near the end of this file. The code
// below still holds the old clickable mode (parts with markers that opened
// the designer's own option cards); it is no longer offered.
//
// Original notes:
// It keeps NO selections of its own. Everything it shows is read from the
// jacket designer (jacketDesigner in main.js), and every pick is made with the
// designer's own option cards: clicking a part of the jacket moves the
// designer's options element into this panel (embedOptions) for the
// questions that part covers. So both modes always share one set of answers,
// the same catalog (catalog.js), the same prices and the same order data, and
// a fabric or style added to the catalog shows up here by itself.
//
// The picture is drawn on a canvas from a photo (made from Daniel's mockup by
// scripts/make_jacket_photo.py):
//   assets/jacket-photo-front.webp        the photo, pockets/buttons painted out
//   assets/jacket-photo-shade-*.webp      the cloth's light and shadow
// The chosen fabric (assets/jacket-tex-*.webp, seamless tiles made by
// scripts/make_jacket_textures.py) is laid over the cloth and lit with that
// shading, so every fabric shows on the same jacket. Pockets, buttons,
// buttonholes, the lining and the lapel style are then drawn on top from the
// customer's answers. Unanswered questions are drawn with a classic look
// (PREVIEW_DEFAULTS) without being saved.
// ============================================================
(function () {
  if (typeof jacketDesigner === "undefined" || typeof JACKET_CATALOG === "undefined") return;
  const homeHost = document.getElementById("studioHomeHost");
  const designerHost = document.getElementById("studioDesignerHost");
  const designerModeBar = document.getElementById("designerModeBar");
  const homeModeBar = document.getElementById("homeModeBar");
  if (!designerHost) return;

  const D = jacketDesigner;
  const CAT = JACKET_CATALOG;
  // Picture coordinates: the photo crop is 800 x 952.
  const VBW = 800;
  const VBH = 952;
  const MODE_KEY = "scottSuitsDesignMode";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PHOTO = "./assets/jacket-photo-front.webp?v=17";
  const SHADE = { front: "./assets/jacket-photo-shade-front.webp?v=16", back: "./assets/jacket-photo-shade-back.webp?v=15" };
  // The photo has notch lapels; the other styles have their own front shading
  // with the lapels redrawn (scripts/make_jacket_photo.py).
  const SHADE_LAPEL = {
    "Peak Lapel": "./assets/jacket-photo-shade-front-peak.webp?v=13",
    "Semi-Peak Lapel": "./assets/jacket-photo-shade-front-peak.webp?v=13",
    "Diamond Lapel": "./assets/jacket-photo-shade-front-diamond.webp?v=13",
    "Shawl": "./assets/jacket-photo-shade-front-shawl.webp?v=13",
    "Arc Lapel": "./assets/jacket-photo-shade-front-shawl.webp?v=13",
  };
  // Double breasted fronts use their own photo (peak lapels, the front
  // crossing over; scripts/make_jacket_photo_db.py).
  const PHOTO_ARC = "./assets/jacket-photo-front-arc.webp?v=15";
  const SHADE_ARC = "./assets/jacket-photo-shade-front-arc-photo.webp?v=16";
  // The lining seen in the Arc photo's opening below the second button (in
  // picture space; scripts/make_jacket_photo_arc.py LINING, mapped).
  // The same opening on the main photo (traced from its shading).
  const SB_OPENING = "M400,697 L403,705 L412,740 L420,770 L430,800 L441,830 L450,860 L458,885 L463,907 L337,907 L347,880 L358,850 L372,820 L383,790 L390,760 L396,720 Z";
  const ARC_OPENING = "M398.8,679 L403.1,700 L412.4,749.5 L427.9,799 L444,842.4 L448.3,856 L343.7,856 L351.2,842.4 L363.5,823.8 L375.3,792.8 L384.6,749.5 L393.9,700 Z";
  const PHOTO_DB = "./assets/jacket-photo-front-db.webp?v=11";
  // Lapel widths (Daniel 2026-11-20: "lapel widths reflected accurately, on
  // all lapels"). Each photo shows the Standard width. Per picture row:
  // [y, roll line x, lapel edge x] for the viewer's right lapel (measured
  // from the shading; the left one is mirrored, DB has both). The band from
  // the roll line to the edge is stretched or squeezed to the chosen width.
  const LAPEL_PROFILES = {"notch":[[136,468,468],[150,468,561],[162,466,558],[174,464,554],[186,462,550],[198,460,545],[210,458,541],[222,456,536],[234,452,531],[246,451,525],[258,449,518],[270,447,513],[282,444,511],[294,442,503],[306,439,498],[318,437,493],[330,434,491],[342,432,485],[354,429,480],[366,426,474],[378,424,468],[390,421,462],[402,418,456],[414,414,450],[426,411,443],[438,408,436],[450,404,428],[462,402,421],[474,402,413],[486,402,406],[500,402,402]],"peak":[[106,472,472],[120,472,570],[132,469,565],[144,468,561],[156,467,557],[168,465,556],[180,463,552],[192,461,548],[204,459,543],[216,457,538],[228,454,534],[240,452,528],[252,450,523],[264,448,516],[276,446,510],[288,443,505],[300,441,503],[312,438,495],[324,435,494],[336,433,488],[348,430,482],[360,428,477],[372,425,471],[384,422,465],[396,419,459],[408,416,453],[420,412,446],[432,409,439],[444,406,432],[456,402,425],[468,402,417],[480,402,409],[494,402,402]],"shawl":[[66,477,477],[80,477,522],[92,476,531],[104,474,537],[116,472,540],[128,470,542],[140,469,544],[152,467,544],[164,465,544],[176,464,543],[188,462,541],[200,460,539],[212,458,536],[224,456,533],[236,452,530],[248,451,526],[260,449,523],[272,446,518],[284,444,513],[296,441,509],[308,439,503],[320,436,498],[332,434,492],[344,432,486],[356,429,480],[368,426,474],[380,423,467],[392,420,461],[404,417,454],[416,414,447],[428,411,441],[440,407,434],[452,402,427],[464,402,419],[476,402,414],[488,402,402]],"diamond":[[66,477,477],[80,477,517],[92,476,520],[104,474,523],[116,472,527],[128,470,530],[140,469,534],[152,467,537],[164,465,540],[176,464,544],[188,462,547],[200,460,551],[212,458,548],[224,456,542],[236,452,535],[248,451,529],[260,449,522],[272,446,516],[284,444,509],[296,441,503],[308,439,496],[320,436,490],[332,434,483],[344,432,477],[356,429,470],[368,426,464],[380,423,457],[392,420,451],[404,417,444],[416,414,438],[428,411,431],[440,407,425],[452,402,418],[464,402,412],[476,402,405],[488,402,402]],"arc":[[86,468,468],[100,468,524],[112,467,527],[124,465,528],[136,463,530],[148,461,533],[160,459,536],[172,457,534],[184,455,533],[196,453,531],[208,450,530],[220,433,529],[232,433,526],[244,433,524],[256,433,522],[268,434,520],[280,434,518],[292,433,515],[304,432,512],[316,430,510],[328,428,507],[340,425,505],[352,423,502],[364,420,499],[376,418,497],[388,415,494],[400,413,490],[412,409,487],[440,404,470],[470,401,450],[490,400,425],[500,400,402]],"dbR":[[50,480,480],[80,476,520],[160,462,570],[250,443,540],[350,400,480],[430,368,410],[515,335,335]],"dbL":[[50,325,325],[80,328,280],[155,340,222],[270,362,260],[350,400,310],[380,400,345],[400,400,400]]};
  const LAPEL_STD = { "Semi-Notch Lapel": 8.3, "Semi-Peak Lapel": 8.3, "Peak Lapel": 8.9, "Shawl": 8.9, "Arc Lapel": 8.9, "Diamond Lapel": 8 };
  // Where the body meets the sleeve (the gap between them), per picture row,
  // for the lower pockets to run back under the sleeve: [y, left x, right x].
  const BODY_SIDES = {
    sb: [[520, 200, 603], [560, 196, 607], [600, 188, 613], [640, 181, 621], [680, 175, 629], [720, 170, 632], [760, 165, 638], [800, 161, 642]],
    arc: [[520, 217, 580], [560, 211, 586], [600, 204, 593], [640, 198, 598], [680, 193, 602], [720, 190, 607], [760, 187, 611], [800, 184, 615]],
  };
  // Where the chest meets the sleeve on the viewer's right: [y, x].
  const CHEST_SIDE = {
    sb: [[220, 642], [300, 634], [380, 620]],
    arc: [[220, 610], [300, 601], [380, 593]],
  };
  const SHADE_DB = "./assets/jacket-photo-shade-front-db.webp?v=11";
  const SHADE_DB_LAPEL = {
    "Diamond Lapel": "./assets/jacket-photo-shade-front-db-diamond.webp?v=11",
    "Shawl": "./assets/jacket-photo-shade-front-db-shawl.webp?v=11",
    "Arc Lapel": "./assets/jacket-photo-shade-front-db-shawl.webp?v=11",
  };
  const isDB = (v) => /^Double/.test(String(v.frontbutton || ""));
  // One fabric tile (two swatches, ~16 cm of cloth) in picture pixels.
  const TILE = 176;

  // ---- Classic look for anything not picked yet (drawing only) ----------
  function firstNavySolid() {
    const solid = (CAT.fabric.patternTypes || []).find((t) => t.name === "Solid");
    const navy = solid && solid.colorFamilies.find((f) => /navy|blue/i.test(f.name));
    const list = (navy ? navy.options : CAT.fabric.options).filter((o) => !o.isNew);
    // A mid navy, not the darkest one, so the cloth reads as navy at a glance.
    const sorted = list.slice().sort((a, b) => lum(b.hex) - lum(a.hex));
    return (sorted[Math.floor(sorted.length / 3)] || CAT.fabric.options[0]).name;
  }
  const PREVIEW_DEFAULTS = {
    fabric: firstNavySolid(),
    collar: "Notch Lapel",
    lapelwidth: "9 cm",
    lapelbuttonhole: "Standard",
    lapelButtonholeStyle: "Machine Sewn",
    frontbutton: "Single Breasted Two Buttons",
    pockettype: "Normal Pocket",
    lowerpocket: "Double Besom W/ Flap",
    sleevecuffstyle: "Imitation Button Hole On Sleeve Cuff",
    cuffbuttons: "4 Flat Button",
    backvent: "Side Vent",
    facing: "Round Shape Facing",
    insidepocket: "Regular Inner Pocket",
    monogram: "No Monogram Need",
    buttonNail: "X Shape Sewing Button",
    sleevecrown: "Regular Armhole",
    feltundercollar: "Match Felt Undercollar",
  };

  // ---- Parts of the jacket and the questions each one opens --------------
  // view: the view the part is seen in. keys: designer questions, in order.
  // lp: "below" puts the marker's label below and to the right of it.
  // at: where its marker sits in each view (picture pixels, or the name of a
  // point worked out while drawing). Any jacket question not listed here is
  // collected under "More Details" automatically, so nothing in the catalog
  // is ever unreachable.
  const AREAS = [
    { id: "fabric", label: "Fabric", view: "front", lp: "below", keys: ["fabric"], at: { front: [201, 217], back: [400, 300] } },
    { id: "lapel", label: "Lapel", view: "front", lp: "below", keys: ["collar", "lapelwidth"], at: { front: [489, 240] } },
    { id: "buttons", label: "Front Buttons", view: "front", keys: ["frontbutton", "buttoncolor", "threadColor", "buttonNail", "frontButtonholeThreadColor", "buttonholeColorPlacement"], at: { front: "topButton" } },
    { id: "pockets", label: "Pockets", view: "front", lp: "below", keys: ["lowerpocket", "pockettype"], at: { front: "pocket" } },
    { id: "cuff", label: "Sleeve Buttons", view: "front", lp: "below", keys: ["cuffbuttons", "sleevecuffstyle"], at: { front: [62, 772], back: [62, 772] }, zoom: { front: [130, 740, 2.4], back: [130, 740, 2.4] } },
    { id: "lining", label: "Lining", view: "inside", keys: ["lining", "facing", "insidepocket"], at: { inside: [400, 560] } },
    { id: "lapelhole", label: "Buttonhole", view: "front", keys: ["lapelbuttonhole", "lapelButtonholeStyle", "buttonholeThreadColor"], at: { front: "lapelHole" }, zoom: { front: [520, 200, 2.2] } },
    { id: "vents", label: "Back Vents", view: "back", keys: ["backvent"], at: { back: [400, 820] } },
    { id: "monogram", label: "Monogram", view: "inside", keys: ["monogram", "monogramFont", "monogramThreadColor"], at: { inside: [520, 400] } },
    { id: "collar", label: "Under Collar", view: "back", keys: ["feltundercollar", "feltColor"], at: { back: [400, 52], inside: [400, 52] } },
    { id: "facing", label: "Facing", view: "inside", keys: ["facing"], at: { inside: [222, 640] } },
    { id: "ipocket", label: "Inside Pockets", view: "inside", keys: ["insidepocket"], at: { inside: [270, 318] } },
    { id: "shoulder", label: "Shoulders", view: "back", keys: ["sleevecrown", "construction"], at: { back: [160, 190] } },
  ];
  const mapped = {};
  AREAS.forEach((a) => a.keys.forEach((k) => { mapped[k] = true; }));
  const extraKeys = D.keys.filter((k) => !mapped[k]);
  if (extraKeys.length) AREAS.push({ id: "more", label: "More Details", view: "front", keys: extraKeys, at: { front: [400, 905] } });
  // Questions the photo can't show: the panel says so instead of the picture
  // inventing a look for them.
  const NON_VISUAL = {
    construction: "Construction is the hidden structure inside the chest. It changes how the jacket drapes and wears in, not how it looks here.",
    feltundercollar: "The felt sits under the collar, against your shirt. Open the Inside view to see its color.",
        buttonNail: "Shown on the front buttons up close. Use + to zoom in.",
  };

  // ---- Small helpers ----------------------------------------------------
  function hexRgb(h) {
    const s = String(h || "#1F2B4D").replace("#", "");
    return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
  }
  function lum(h) { const c = hexRgb(h); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function mix(h, toward, amt) {
    const a = hexRgb(h), b = hexRgb(toward);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, "0")).join("");
  }
  function rgba(h, a) { const c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function opt(key, name) { return ((CAT[key] && CAT[key].options) || []).find((o) => o.name === name) || null; }

  // Current answers, raw (exactly what the order stores), plus the classic
  // look for anything unanswered.
  function hoverOf(designer) {
    return designer && designer.hoverSelection ? designer.hoverSelection() : null;
  }
  // A designer's raw answers with the hovered option laid over them.
  function withHover(designer, raw) {
    const hv = hoverOf(designer);
    if (!hv) return raw;
    const out = Object.assign({}, raw);
    out[hv.key] = hv.value;
    return out;
  }
  function current() {
    // Desktop hover preview: the option under the mouse is shown, not picked.
    const raw = withHover(D, D.rawSelections());
    const v = {};
    Object.keys(PREVIEW_DEFAULTS).forEach((k) => { v[k] = PREVIEW_DEFAULTS[k]; });
    Object.keys(raw).forEach((k) => { if (raw[k] && (D.isShown(k) || (D.isAutoSet && D.isAutoSet(k)))) v[k] = raw[k]; });
    v._raw = raw;
    return v;
  }

  // ---- Images -------------------------------------------------------------
  const imgs = {}; // url -> { img, state: "loading" | "ok" | "bad" }
  function img(url) {
    if (!url) return null;
    let e = imgs[url];
    if (!e) {
      e = imgs[url] = { img: new Image(), state: "loading" };
      e.img.decoding = "async";
      e.img.onload = () => { e.state = "ok"; scheduleDraw(); };
      e.img.onerror = () => { e.state = "bad"; scheduleDraw(); };
      e.img.src = url;
    }
    return e.state === "ok" ? e.img : null;
  }
  function imgBad(url) { return !!(imgs[url] && imgs[url].state === "bad"); }
  function texUrlFor(fabricOpt) {
    return fabricOpt && fabricOpt.img ? fabricOpt.img.replace("jacket-fabric-", "jacket-tex-").replace(/\.jpg$/, ".webp") : null;
  }

  // ---- Paints (fabric / lining) -------------------------------------------
  // A paint is what fills a piece of cloth: a tile image or a flat color,
  // plus how strongly the photo's light and shadow apply to it (pale cloth
  // gets softer highlights so it doesn't wash out).
  function strengthFor(hex) {
    const t = Math.max(0, Math.min(1, (lum(hex) - 60) / 150));
    return { a: 1 - 0.42 * t, b: 1 - 0.85 * t };
  }
  function edgeFor(hex) { return 0.55 - 0.27 * Math.max(0, Math.min(1, (lum(hex) - 60) / 150)); }
  function fabricPaint(fab) {
    const hex = (fab && fab.hex) || "#1F2B4D";
    const tex = texUrlFor(fab);
    const p = { key: "f:" + (fab ? fab.name : ""), hex: hex, strength: strengthFor(hex), size: TILE, ready: true };
    if (tex && !imgBad(tex)) {
      const im = img(tex);
      if (im) { p.img = im; p.key += ":t"; }
      else p.ready = false;
    } else if (fab && fab.img) {
      // No tile yet: use the cloth inside the thumbnail's pinked edges.
      const im = img(fab.img);
      if (im) { p.img = im; p.crop = 0.14; p.size = TILE / 2; p.key += ":th"; }
      else if (!imgBad(fab.img)) p.ready = false;
    }
    return p;
  }
  function liningPaint(v, fabP) {
    const raw = v._raw.lining;
    const o = opt("lining", raw);
    if (o && o.uploadPhoto) {
      const photo = D.getLiningPhoto ? D.getLiningPhoto() : null;
      const im = photo ? img(photo) : null;
      return { key: "l:upload:" + (photo ? photo.length : 0) + (im ? "ok" : ""), hex: "#8a8378", img: im, size: 220, strength: { a: 0.75, b: 0.35 }, ready: !photo || !!im || imgBad(photo), sheen: true };
    }
    if (o && o.img && !o.matchesFabric) {
      const im = img(o.img);
      return { key: "l:" + o.name + (im ? ":t" : ""), hex: o.hex || "#555", img: im, size: 150, crop: 0.06, strength: { a: 0.75, b: 0.4 }, ready: !!im || imgBad(o.img), sheen: true };
    }
    // "Match Fabric" (or not chosen yet): a satin a shade off the cloth.
    const hex = lum(fabP.hex) < 70 ? mix(fabP.hex, "#ffffff", 0.1) : mix(fabP.hex, "#000000", 0.1);
    return { key: "l:match:" + hex, hex: hex, size: 0, strength: { a: 0.75, b: 0.4 }, ready: true, sheen: true };
  }

  // ---- Canvas drawing --------------------------------------------------------
  function mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  // Resolution: a bit above the photo so stitching stays crisp when zoomed.
  // It follows the screen and the zoom (setRes below), so the picture is
  // never stretched: Daniel 2026-11-22, "no blurs on any preview".
  const BASE_RES = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
  let RES = BASE_RES;
  let CW = Math.round(VBW * RES), CH = Math.round(VBH * RES);
  let tileCache = {};
  // The shading maps and photos are stored larger than the picture's units
  // (scripts/crisp_jacket_shading.py); k = their pixels per unit.
  const unitK = (im) => (im.naturalWidth || im.width) / VBW;
  function paintStyle(g, p) {
    if (!p.img || !p.size) return p.hex;
    const k = p.key + "@" + p.size;
    let t = tileCache[k];
    if (!t) {
      const px = Math.max(8, Math.round(p.size * RES));
      t = mk(px, px);
      const tg = t.getContext("2d");
      const iw = p.img.naturalWidth, ih = p.img.naturalHeight;
      const c = p.crop || 0;
      tg.drawImage(p.img, iw * c, ih * c, iw * (1 - 2 * c), ih * (1 - 2 * c), 0, 0, px, px);
      tileCache[k] = t;
    }
    return g.createPattern(t, "repeat");
  }
  // Cloth lit by the photo: each region gets its paint, multiplied by the
  // shadow map and brightened by the highlight map, all inside the cloth mask.
  let scratch = null;
  function shadedLayer(shade, regions) {
    const out = mk(CW, CH);
    const og = out.getContext("2d");
    if (!scratch) scratch = mk(CW, CH);
    regions.forEach((rg) => {
      const t = mk(CW, CH);
      const tg = t.getContext("2d");
      tg.save();
      if (rg.path) { tg.scale(RES, RES); tg.clip(new Path2D(rg.path), "evenodd"); tg.setTransform(1, 0, 0, 1, 0, 0); }
      tg.fillStyle = paintStyle(tg, rg.paint);
      tg.fillRect(0, 0, CW, CH);
      // Highlights: paint x highlight map, added on.
      const hg = scratch.getContext("2d");
      hg.globalCompositeOperation = "source-over";
      hg.globalAlpha = 1;
      hg.clearRect(0, 0, CW, CH);
      hg.fillStyle = paintStyle(hg, rg.paint);
      hg.fillRect(0, 0, CW, CH);
      hg.globalCompositeOperation = "multiply";
      const sk = unitK(shade);
      hg.drawImage(shade, 0, VBH * sk, VBW * sk, VBH * sk, 0, 0, CW, CH);
      const s = rg.paint.strength;
      tg.globalCompositeOperation = "multiply";
      tg.globalAlpha = s.a;
      tg.drawImage(shade, 0, 0, VBW * sk, VBH * sk, 0, 0, CW, CH);
      tg.globalCompositeOperation = "lighter";
      tg.globalAlpha = s.b * (rg.highlight == null ? 1 : rg.highlight);
      tg.drawImage(scratch, 0, 0);
      // Cut to the cloth with the region's clip lifted: under the clip its
      // soft edge would be left behind as a faint line where there is no cloth.
      tg.restore();
      tg.globalAlpha = 1;
      tg.globalCompositeOperation = "destination-in";
      tg.drawImage(shade, 0, 0, VBW * sk, VBH * sk, 0, 0, CW, CH);
      og.drawImage(t, 0, 0);
    });
    return out;
  }
  // The lit cloth for a view is cached (it only changes with the fabric,
  // lining or facing), so picking a button color redraws in a blink.
  const layerCache = [];
  function cachedLayer(key, make) {
    const hit = layerCache.find((e) => e.key === key);
    if (hit) return hit.canvas;
    const c = make();
    layerCache.unshift({ key: key, canvas: c });
    if (layerCache.length > 5) layerCache.pop();
    return c;
  }

  // The tie (Daniel 2026-11-22: "Have the tie automatically match the suit
  // fabric color"). Every front photo has the mockup's burgundy tie; its
  // pixels are found by their redness (nothing else in the photos is red)
  // and repainted in tieHex(fabric), keeping the tie's own light and
  // shadow. One recolored photo per photo + color, cached.
  // Later the same day: "can contrast but should still match the palette".
  // So the tie is a tonal partner of the cloth, not the same shade: the
  // fabric's hue turned a little (analogous), richer, and lighter on dark
  // cloth / deeper on light cloth so it stands out from the jacket.
  function tieHex(hex) {
    const [r, g, b] = hexRgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    const H = (h + 14 + 360) % 360;
    const S = Math.min(0.45, s < 0.08 ? s + 0.08 : s * 1.05 + 0.04);
    const L = l < 0.32 ? Math.min(0.36, l + 0.07 + (0.32 - l) * 0.15) : Math.max(0.12, l - 0.18);
    const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - C / 2;
    const seg = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(H / 60) % 6];
    return "#" + seg.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  const tieCache = [];
  function tiePhoto(photo, url, hex, box) {
    const key = url + "|" + hex;
    const hit = tieCache.find((e) => e.key === key);
    if (hit) return hit.canvas;
    // At the photo's own size, so the shirt and tie stay as sharp as the photo.
    const pk = unitK(photo);
    const c = mk(Math.round(VBW * pk), Math.round(VBH * pk)), cg = c.getContext("2d");
    cg.drawImage(photo, 0, 0, c.width, c.height);
    try {
      // The tie sits in this box on every photo.
      const bx = box || [330, 60, 150, 400];
      const X0 = Math.round(bx[0] * pk), Y0 = Math.round(bx[1] * pk), W = Math.round(bx[2] * pk), H = Math.round(bx[3] * pk);
      const d = cg.getImageData(X0, Y0, W, H), px = d.data, N = W * H;
      // The tie's own red and its average brightness, from the pixels that
      // are clearly tie, so its mid tone becomes the new color.
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] - Math.max(px[i + 1], px[i + 2]) >= 22) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++; }
      }
      if (n) {
        const dg = sg / sr, db = sb / sr, den = 1 - (dg + db) / 2;
        const lumK = 0.299 + 0.587 * dg + 0.114 * db;
        const meanR = sr / n, mean = meanR * lumK, t = hexRgb(hex);
        // The tie, plus the few pixels around it where tie and shirt mix.
        const rad = Math.max(2, Math.round(3 * pk));
        const tie = new Uint8Array(N), rows = new Uint8Array(N), near = new Uint8Array(N);
        for (let j = 0, i = 0; j < N; j++, i += 4) {
          const r = px[i] - (px[i + 1] + px[i + 2]) / 2;
          if (r > 6 && r > 0.45 * px[i]) tie[j] = 1;
        }
        const spread = (src, dst, len, count, step, stride) => {
          for (let a = 0; a < count; a++) {
            const o = a * stride;
            let last = -1e9;
            for (let b = 0; b < len; b++) { if (src[o + b * step]) last = b; if (b - last <= rad) dst[o + b * step] = 1; }
            last = 1e9;
            for (let b = len - 1; b >= 0; b--) { if (src[o + b * step]) last = b; if (last - b <= rad) dst[o + b * step] = 1; }
          }
        };
        spread(tie, rows, W, H, 1, W);
        spread(rows, near, H, W, W, 1);
        // Each pixel is some tie red plus what is left (white shirt, shadow,
        // shine). Only the tie part changes color, so an edge pixel that is
        // mostly shirt stays mostly shirt: no pale or red rim around the tie.
        for (let j = 0, i = 0; j < N; j++, i += 4) {
          if (!near[j]) continue;
          const R = px[i], G = px[i + 1], B = px[i + 2];
          let q = (R - (G + B) / 2) / den;
          if (q <= 0) continue;
          if (q > R) q = R;
          let r0 = R - q, g0 = Math.max(0, G - q * dg), b0 = Math.max(0, B - q * db);
          // Well inside the tie what is left is plain light, not color.
          const m = Math.min(r0, g0, b0), wn = Math.min(1, q / (0.4 * meanR));
          r0 += (m - r0) * wn; g0 += (m - g0) * wn; b0 += (m - b0) * wn;
          const k = q * lumK / mean;
          px[i] = Math.min(255, Math.round(r0 + t[0] * k));
          px[i + 1] = Math.min(255, Math.round(g0 + t[1] * k));
          px[i + 2] = Math.min(255, Math.round(b0 + t[2] * k));
        }
        cg.putImageData(d, X0, Y0);
      }
    } catch (e) { /* canvas unreadable: keep the photo's tie */ }
    tieCache.unshift({ key: key, canvas: c });
    if (tieCache.length > 4) tieCache.pop();
    return c;
  }

  // Thread / button colors. "Match Fabric Color" follows the cloth.
  function threadHex(key, v, fabricHex) {
    const o = opt(key, v[key] || v._raw[key]);
    if (o && o.hex) return o.hex;
    return lum(fabricHex) < 60 ? mix(fabricHex, "#000000", 0.3) : mix(fabricHex, "#000000", 0.38);
  }
  // The front & sleeve buttonhole color goes on the front, the sleeves, or
  // only the bottom sleeve buttonhole, or only the top front buttonhole
  // (buttonholeColorPlacement); the rest
  // match the fabric.
  function buttonholeHexes(v, fabricHex) {
    const color = threadHex("frontButtonholeThreadColor", v, fabricHex);
    const plain = threadHex("_matched", { _raw: {} }, fabricHex);
    const place = v.buttonholeColorPlacement || v._raw.buttonholeColorPlacement || "Front & Sleeves";
    return {
      front: place === "Front & Sleeves" ? color : plain,
      frontTop: place === "Front & Sleeves" || place === "Top Front Buttonhole" ? color : plain,
      sleeve: place === "Bottom Sleeve Buttonhole" || place === "Top Front Buttonhole" ? plain : color,
      cuff1: place === "Top Front Buttonhole" ? plain : color,
    };
  }
  function feltHex(v, fabricHex) {
    if (v.feltundercollar === "Customer-Appointed Felt") {
      const o = opt("feltColor", v._raw.feltColor);
      if (o && o.hex) return o.hex;
    }
    return mix(fabricHex, "#000000", 0.18);
  }
  function buttonLook(v, fabricHex) {
    const o = opt("buttoncolor", v._raw.buttoncolor);
    if (o && o.img && !o.matchesFabric) return { img: img(o.img), hex: o.hex || "#2a221d" };
    // Best match to the fabric (or not chosen yet): a horn tone near the cloth.
    return { img: null, hex: lum(fabricHex) > 150 ? mix(fabricHex, "#3b2f26", 0.55) : mix(fabricHex, "#161210", 0.6) };
  }

  // ---- Layout of the parts drawn on top -------------------------------------
  // Picture pixels. The photo's own buttons sat at (409,525) and (387,649).
  function frontLayout(name) {
    const n = String(name || "");
    // One button at the waist (where the lapels end); three buttons with the
    // lapels rolling to the top one.
    if (/^Single Breasted One/.test(n)) return { db: false, buttons: [{ x: 409, y: 525, fast: true }] };
    if (/^Single Breasted Three/.test(n)) return { db: false, buttons: [{ x: 409, y: 525, fast: true }, { x: 395, y: 607, fast: false }, { x: 381, y: 689, fast: false }] };
    if (/^Single Breasted/.test(n)) return { db: false, buttons: [{ x: 409, y: 525, fast: true }, { x: 387, y: 649, fast: false }] };
    // Double breasted (drawn on the double breasted photo, whose lapels roll
    // to the fastening row at y 537): rows of [y, left x, right x]; the
    // fastening button is the left one in the row marked true.
    const R1 = [422, 293, 515], R2 = [537, 342, 478], R3 = [652, 342, 478];
    const DB = {
      "Double Breasted 6X2": { rows: [R1, R2.concat(true), R3] },
      "Double Breasted 4X2": { rows: [R2.concat(true), R3] },
      "Double Breasted 6X3": { rows: [R2.concat(true), [612, 342, 478], [687, 342, 478]] },
      "Double Breasted 4X1": { rows: [R1, R2.concat(true)] },
      "Double Breasted One Button": { rows: [R2.concat(true)], leftOnly: true },
      "Double Breasted 2X1": { rows: [R2.concat(true)] },
      "Double Breasted 6X1": { rows: [[405, 285, 523], [471, 312, 500], R2.concat(true)] },
    };
    const d = DB[n] || DB["Double Breasted 6X2"];
    const buttons = [];
    let fastY = 0;
    d.rows.forEach((r) => {
      if (r[3]) fastY = r[0];
      buttons.push({ x: r[1], y: r[0], fast: !!r[3], db: true, left: true });
      if (!d.leftOnly) buttons.push({ x: r[2], y: r[0], fast: false, db: true });
    });
    // Buttonholes show beside the left buttons from the fastening row down.
    buttons.forEach((b) => { b.holed = b.left && b.y >= fastY; });
    return { db: true, buttons: buttons };
  }
  function lapelHolesFor(v) {
    const n = String(v.lapelbuttonhole || "");
    if (!n || n === "No Lapel Buttonhole") return { left: 0, right: 0 };
    if (n === "Standard" || /Only For Shawl/.test(n)) return { left: 1, right: 0 };
    if (n === "Right") return { left: 0, right: 1 };
    if (n === "Right & Left") return { left: 1, right: 1 };
    if (n === "Left Two") return { left: 2, right: 0 };
    if (n === "Right Two") return { left: 0, right: 2 };
    if (n === "Left Three") return { left: 3, right: 0 };
    if (n === "Left Three, Right Two") return { left: 3, right: 2 };
    if (/^4 /.test(n)) return { left: 4, right: 0 };
    return { left: 1, right: 0 };
  }
  function parseLowerPocket(name) {
    const n = String(name || "");
    if (/No Front Pocket/.test(n)) return { main: "none", ticket: null, slant: false };
    const parts = n.split(/ \+ | And /);
    const m = parts[0], t = parts[1] || "";
    let main = "db";
    if (/Highly Back/.test(m)) main = "highpatch";
    else if (/^Patch/.test(m)) main = "patch";
    else if (/Slant Pocket Flap/.test(m)) main = "flap";
    else if (/W\/ Flap/.test(m)) main = "flap";
    else if (/^Diamond Flap With Buttons/.test(m)) main = "pointbtn";
    else if (/^Diamond Flap/.test(m)) main = "point";
    else if (/Flat Welt/.test(m)) main = "welt";
    else if (/^Single Besom/.test(m)) main = "sb";
    const slant = /Slant/.test(m);
    let ticket = null;
    if (t) ticket = /Flap|Flat Ticket/.test(t) ? "flap" : /Double Besom/.test(t) ? "db" : "sb";
    return { main: main, ticket: ticket, slant: slant };
  }
  function chestKind(name) {
    return {
      "Normal Pocket": "welt", "Boat Shape Pocket": "boat", "Single Besom Pocket": "sb", "Double Besom Pocket": "db",
      "Patch Pocket No Flap": "patch", "No Pocket": "none",
    }[name] || "welt";
  }
  function cuffLayout(v) {
    const n = String(v.cuffbuttons || "");
    const style = String(v.sleevecuffstyle || "");
    const count = parseInt(n, 10) || 4;
    const none = /Button Less/.test(n);
    // holeTilt: the slits tilt up away from the buttons ("Slant" buttons);
    // ventSlant: the vent is diagonal and the buttons climb along it.
    return { count: none ? 0 : count, holes: none ? 4 : count, overlap: /Overlap/.test(n), holeTilt: /Slant/.test(n), ventSlant: /Slant/.test(style), working: /^Working/.test(style) };
  }

  // ---- Drawing pieces (canvas, picture pixels) -------------------------------
  // A piece of the same cloth sewn on top (flap, patch, welt): its shadow,
  // the cloth itself (taken from the lit layer), then its edges.
  let curShade = null; // the shading map of the view being drawn
  let edgeA = 0.55; // how dark seams and edges are drawn (lighter on pale cloth)
  const edge = (k) => "rgba(0,0,0," + (edgeA * (k == null ? 1 : k)).toFixed(3) + ")";
  function clothPiece(g, layer, path, opts) {
    opts = opts || {};
    const p = new Path2D(path);
    if (opts.shadow !== 0 && curShade) {
      // The piece's shadow, kept on the cloth (never on the shirt or the
      // background), drawn in a small box around the piece.
      const nums = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
        y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
      }
      x0 = Math.max(0, Math.floor(x0 - 20)); y0 = Math.max(0, Math.floor(y0 - 20));
      x1 = Math.min(VBW, Math.ceil(x1 + 20)); y1 = Math.min(VBH, Math.ceil(y1 + 24));
      const bw = x1 - x0, bh = y1 - y0;
      if (bw > 0 && bh > 0) {
        const t = mk(Math.ceil(bw * RES), Math.ceil(bh * RES));
        const tg = t.getContext("2d");
        tg.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
        tg.shadowColor = "rgba(0,0,0," + (opts.shadow == null ? 0.55 : opts.shadow) + ")";
        tg.shadowBlur = (opts.blur || 7) * RES;
        tg.shadowOffsetY = (opts.drop == null ? 3 : opts.drop) * RES;
        tg.fillStyle = "rgba(0,0,0,0.9)";
        tg.fill(p);
        tg.setTransform(1, 0, 0, 1, 0, 0);
        tg.globalCompositeOperation = "destination-in";
        const sk = unitK(curShade);
        tg.drawImage(curShade, x0 * sk, y0 * sk, bw * sk, bh * sk, 0, 0, t.width, t.height);
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(t, x0 * RES, y0 * RES);
        g.restore();
      }
    }
    // offset: take the cloth from that far away (to cover a seam or notch
    // that is part of the photo).
    const off = opts.offset || [0, 0];
    g.save();
    g.clip(p);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layer, off[0] * RES, off[1] * RES);
    g.restore();
    g.save();
    if (opts.grad) {
      const gr = g.createLinearGradient(0, opts.grad[0], 0, opts.grad[1]);
      // Black only: a white to black blend passes through grey, which showed
      // every pocket as a lighter block on dark cloth.
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, "rgba(0,0,0,0.2)");
      g.fillStyle = gr;
      g.fill(p);
    }
    if (!opts.noStroke) {
      g.lineWidth = 1.1;
      g.strokeStyle = edge();
      g.stroke(p);
    }
    if (opts.stitch) {
      g.setLineDash([1.6, 1.7]);
      g.lineWidth = 0.7;
      g.strokeStyle = "rgba(255,255,255,0.075)";
      g.stroke(new Path2D(opts.stitch));
      g.setLineDash([]);
    }
    g.restore();
  }
  // Draws fn's pieces, then keeps only what lands on the jacket's cloth, so a
  // pocket never pokes out past the jacket's side.
  function onCloth(g, fn) {
    if (!curShade) { fn(g); return; }
    const t = mk(g.canvas.width, g.canvas.height);
    const tg = t.getContext("2d");
    tg.setTransform(g.getTransform());
    fn(tg);
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = "destination-in";
    const sk = unitK(curShade);
    tg.drawImage(curShade, 0, 0, VBW * sk, VBH * sk, 0, 0, t.width, t.height);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(t, 0, 0); g.restore();
  }
  function rotPath(pts, cx, cy, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return pts.map((p) => [cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c]);
  }
  const PT = (p) => p[0].toFixed(1) + "," + p[1].toFixed(1);
  // A rectangle-ish outline (with rounded bottom corners r) around (cx, top).
  function boxPath(cx, top, w, h, deg, r, backDrop) {
    const hw = w / 2;
    const k = r ? Math.min(r, h / 2, hw) : 0;
    const raw = [[-hw, backDrop && backDrop < 0 ? backDrop : 0], [hw, backDrop && backDrop > 0 ? -backDrop : 0]];
    const pts = rotPath([raw[0], raw[1], [hw, h - k], [hw - k, h], [-hw + k, h], [-hw, h - k]], cx, top, deg);
    const ctrl = rotPath([[hw, h], [-hw, h]], cx, top, deg);
    return "M" + PT(pts[0]) + " L" + PT(pts[1]) + " L" + PT(pts[2]) + " Q" + PT(ctrl[0]) + " " + PT(pts[3]) + " L" + PT(pts[4]) + " Q" + PT(ctrl[1]) + " " + PT(pts[5]) + " Z";
  }
  // A slit pocket (besom): one or two lips and a dark mouth.
  function besom(g, layer, cx, cy, w, deg, two) {
    const h = two ? 11 : 6;
    clothPiece(g, layer, boxPath(cx, cy - h / 2, w, h, deg, 0), { shadow: 0.35, blur: 2.5, drop: 1 });
    const a = rotPath([[-w / 2 + 1, two ? 0 : -h / 2 + 0.6], [w / 2 - 1, two ? 0 : -h / 2 + 0.6]], cx, cy, deg);
    g.save();
    g.strokeStyle = edge(1.35);
    g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(a[0][0], a[0][1]); g.lineTo(a[1][0], a[1][1]); g.stroke();
    g.restore();
  }
  // Pocket shapes follow Daniel's option drawings (assets/jacket-lowerpocket-new-*
  // and jacket-pockettype-new-*), compared side by side 2026-11-20.
  // A path from points in the pocket's own space (x along the mouth, y down
  // from the mouth), turned by deg around (cx, top).
  function pocketPath(cmds, cx, top, deg) {
    return cmds.map((c) => c[0] + rotPath(c.slice(1), cx, top, deg).map(PT).join(" ")).join(" ") + " Z";
  }
  function flap(g, layer, cx, top, w, h, deg) {
    // The jetting above the flap, then the flap hanging from it: about 2.3
    // times as wide as tall, bottom corners rounded.
    besom(g, layer, cx, top, w + 2, deg, false);
    const r = 8;
    clothPiece(g, layer, boxPath(cx, top + 2, w, h, deg, r), { grad: [top, top + h], stitch: boxPath(cx, top + 5, w - 7, h - 7, deg, r - 2) });
  }
  // Pointed ("diamond") flap: straight sides a third of the width tall, then
  // down to a point in the middle; optionally a button in the middle.
  function pointFlap(g, layer, cx, top, w, wv, deg, mid, look) {
    besom(g, layer, cx, top, w + 2, deg, false);
    const hw = w / 2, sh = wv * 0.3, ph = wv * 0.5;
    const shape = (i) => pocketPath([["M", [-hw + i, 2 + i]], ["L", [hw - i, 2 + i]], ["L", [hw - i, sh - i * 0.4]], ["L", [mid, ph - i * 1.3]], ["L", [-hw + i, sh - i * 0.4]]], cx, top, deg);
    clothPiece(g, layer, shape(0), { grad: [top, top + ph], stitch: shape(3.5) });
    if (look) {
      const c = rotPath([[mid, wv * 0.25]], cx, top, deg)[0];
      button(g, c[0], c[1], Math.max(5, wv * 0.075), look, {});
    }
  }
  // Patch pocket: taller than wide, bottom corners rounded, stitched all
  // round. high: the top edge sweeps up to the back (side seam) corner.
  function patchPocket(g, layer, cx, top, w, h, deg, outward, high) {
    const hw = w / 2, r = 15, o = outward;
    const shape = (i) => {
      const a = hw - i, b = h - i, k = Math.max(4, r - i);
      const cmds = [["M", [-o * a, i]]];
      if (high) cmds.push(["Q", [o * a * 0.35, i + 2], [o * a, i - w * 0.5]]);
      else cmds.push(["L", [o * a, i]]);
      cmds.push(["L", [o * a, b - k]], ["Q", [o * a, b], [o * (a - k), b]], ["L", [-o * (a - k), b]], ["Q", [-o * a, b], [-o * a, b - k]]);
      return pocketPath(cmds, cx, top, deg);
    };
    clothPiece(g, layer, shape(0), { shadow: 0.5, blur: 5, drop: 2, grad: [top, top + h], stitch: shape(4.5) });
    // The turned-down hem across a straight top.
    if (!high) {
      const hem = rotPath([[-hw + 4, 10], [hw - 4, 10]], cx, top, deg);
      line(g, hem, "rgba(255,255,255,0.09)", 0.7, [1.6, 1.7]);
      line(g, hem.map((q) => [q[0], q[1] + 0.9]), edge(0.35), 0.7, [1.6, 1.7]);
    }
  }
  // A button seen face on (front) or edge on (sleeves: squashed).
  function button(g, x, y, r, look, opts) {
    opts = opts || {};
    const sx = opts.sx || 1;
    g.save();
    g.translate(x, y);
    if (opts.rot) g.rotate(opts.rot);
    g.scale(sx, 1);
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 3 * RES;
    g.shadowOffsetY = 1.4 * RES;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = look.hex; g.fill();
    g.shadowColor = "transparent";
    if (look.img) {
      g.save(); g.clip();
      g.drawImage(look.img, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
      g.restore();
    } else {
      g.beginPath(); g.arc(0, 0, r * 0.74, 0, Math.PI * 2);
      g.strokeStyle = rgba(mix(look.hex, "#000000", 0.5), 0.8); g.lineWidth = 0.9; g.stroke();
    }
    // Light from the upper left.
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, 0, 0, 0, r * 1.05);
    gr.addColorStop(0, "rgba(255,255,255,0.32)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.04)");
    gr.addColorStop(1, "rgba(0,0,0,0.38)");
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = gr; g.fill();
    if (opts.thread && sx > 0.6) {
      const h = r * 0.26;
      g.strokeStyle = opts.thread; g.lineWidth = Math.max(0.9, r * 0.13); g.lineCap = "round";
      g.beginPath();
      if (opts.nail === "II Shape Sewing Button") { g.moveTo(-h, -h); g.lineTo(-h, h); g.moveTo(h, -h); g.lineTo(h, h); }
      else if (opts.nail === "Square Shape Sewing Button") { g.rect(-h, -h, 2 * h, 2 * h); }
      else { g.moveTo(-h, -h); g.lineTo(h, h); g.moveTo(h, -h); g.lineTo(-h, h); }
      g.stroke();
    }
    g.restore();
  }
  // A buttonhole: a short thread-colored keyhole bar.
  function hole(g, a, b, hex, w) {
    w = w || 2.6;
    g.save();
    g.lineCap = "round";
    g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = w + 1.4;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = hex; g.lineWidth = w;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.beginPath(); g.arc(a[0], a[1], w * 0.7, 0, Math.PI * 2); g.fillStyle = hex; g.fill();
    g.restore();
  }
  function line(g, pts, color, width, dash) {
    g.save();
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
    if (dash) g.setLineDash(dash);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
    g.restore();
  }
  function monogramText(g, x, y, v, size, rot) {
    const t = (D.getTextsRaw().monogram || "").trim() || "ABC";
    const o = opt("monogramThreadColor", v._raw.monogramThreadColor);
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    const f = opt("monogramFont", v._raw.monogramFont);
    g.font = f ? (f.weight || 400) + " " + Math.round(size * (f.size || 1)) + "px " + f.css : "italic 600 " + size + "px 'Playfair Display', Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = (o && o.hex) || "#c9b48a";
    g.fillText(t.split("(/)")[0].slice(0, 12), 0, 0);
    g.restore();
  }

  // Lapel buttonholes are placed for the wearer's left lapel (viewer's right)
  // and mirrored across x = 401.5 for the other side.
  const MIRROR_X = 803;
  const mirrorPts = (pts) => pts.map((p) => [MIRROR_X - p[0], p[1]]);
  function lapelHoleSpots(v) {
    // Wearer's left lapel = viewer's right. Each hole runs across the lapel.
    const h = lapelHolesFor(v);
    const shawl = v.collar === "Shawl" || v.collar === "Arc Lapel" || v.collar === "Diamond Lapel";
    // On the double breasted photo the holes sit where its own one was.
    const base = isDB(v) ? (shawl ? [[512, 196], [533, 189]] : [[525, 188], [547, 181]]) : shawl ? [[506, 176], [526, 183]] : [[515, 156], [536, 164]];
    const st = isDB(v) ? [-6, 10] : [-4.2, 10.5];
    const at = (i) => [[base[0][0] + st[0] * i, base[0][1] + st[1] * i], [base[1][0] + st[0] * i, base[1][1] + st[1] * i]];
    const out = [];
    for (let i = 0; i < h.left; i++) out.push(at(i));
    for (let i = 0; i < h.right; i++) out.push(mirrorPts(at(i)));
    return out;
  }

  // ---- FRONT VIEW --------------------------------------------------------------
  const lerpRows = (rows, y, i) => {
    if (y <= rows[0][0]) return rows[0][i];
    for (let k = 1; k < rows.length; k++) if (y <= rows[k][0]) {
      const a = rows[k - 1], b = rows[k], t = (y - a[0]) / (b[0] - a[0]);
      return a[i] + (b[i] - a[i]) * t;
    }
    return rows[rows.length - 1][i];
  };
  function lapelSides(v, db, arc) {
    if (db) return [LAPEL_PROFILES.dbR, LAPEL_PROFILES.dbL];
    const c = v.collar;
    const k = arc ? "arc" : /Peak/.test(c) ? "peak" : c === "Diamond Lapel" ? "diamond" : c === "Shawl" ? "shawl" : "notch";
    const R = LAPEL_PROFILES[k], m = arc ? 797 : MIRROR_X;
    return [R, R.map((r) => [r[0], m - r[1], m - r[2]])];
  }
  function lapelFactor(v) {
    const w = parseFloat(v.lapelwidth);
    if (!w) return 1;
    const f = w / (LAPEL_STD[v.collar] || 9);
    return Math.abs(f - 1) < 0.02 ? 1 : f;
  }
  // Stretch (f > 1) or squeeze each lapel between its roll line and its edge,
  // moving the cloth beyond the edge along with it (out to MARGIN past it).
  function lapelWarp(g, sides, f) {
    if (f === 1) return;
    const cv = g.canvas, T = g.getTransform();
    const tmp = mk(cv.width, cv.height);
    tmp.getContext("2d").drawImage(cv, 0, 0);
    const X = (x) => T.a * x + T.e;
    const MARGIN = 70;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    sides.forEach((rows) => {
      for (let y = rows[0][0]; y < rows[rows.length - 1][0]; y++) {
        const roll = lerpRows(rows, y + 0.5, 1), edge = lerpRows(rows, y + 0.5, 2);
        const w = edge - roll;
        if (Math.abs(w) < 1) continue;
        const sg = Math.sign(w), ne = roll + f * w, B = edge + sg * MARGIN;
        const Y0 = Math.floor(T.d * y + T.f), Y1 = Math.floor(T.d * (y + 1) + T.f), h = Math.max(1, Y1 - Y0);
        const seg = (s0, s1, d0, d1) => {
          const sx = X(Math.min(s0, s1)), sw = Math.abs(X(s1) - X(s0));
          const dx = X(Math.min(d0, d1)), dw = Math.abs(X(d1) - X(d0));
          if (sw < 0.5 || dw < 0.5) return;
          g.clearRect(dx - 0.25, Y0, dw + 0.5, h);
          g.drawImage(tmp, sx, Y0, sw, h, dx - 0.25, Y0, dw + 0.5, h);
        };
        seg(roll, edge, roll, ne);
        seg(edge, B, ne, B);
      }
    });
    g.restore();
  }
  function drawFront(g, v, anchors) {
    const db = isDB(v);
    // Single breasted Arc: its own photo, built from the generator's approved
    // Arc reference (scripts/make_jacket_photo_arc.py), so it looks like it.
    const arc = !db && v.collar === "Arc Lapel";
    const shadeUrl = arc ? SHADE_ARC : db ? SHADE_DB_LAPEL[v.collar] || SHADE_DB : SHADE_LAPEL[v.collar] || SHADE.front;
    const photo = img(arc ? PHOTO_ARC : db ? PHOTO_DB : PHOTO), shade = img(shadeUrl);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!photo || !shade || !fp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    let layer = cachedLayer("front|" + shadeUrl + "|" + fp.key, () => shadedLayer(shade, [{ path: null, paint: fp }]));
    const fabricHex = fp.hex;
    const photoUrl = arc ? PHOTO_ARC : db ? PHOTO_DB : PHOTO;
    g.drawImage(tiePhoto(photo, photoUrl, tieHex(fabricHex)), 0, 0, VBW, VBH);
    floorShadow(g);
    // Arc: once a lining is picked it shows in the opening under the second
    // button, in place of the reference photo's grey damask (Daniel
    // 2026-11-20). Unlined jackets show the cloth's back there.
    const showLining = v._raw.lining || v.facing === "No Lining Construction";
    const openingLining = (d, x0, y0, x1, y1) => {
      const lpaint = v.facing === "No Lining Construction" ? fp : liningPaint(v, fp);
      if (!lpaint.ready) return;
      const P = new Path2D(d);
      g.save();
      g.clip(P);
      g.fillStyle = paintStyle(g, lpaint);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Shadow deep in the opening and under the fronts' edges.
      const sh = g.createLinearGradient(0, y0, 0, y1);
      sh.addColorStop(0, "rgba(0,0,0,0.55)"); sh.addColorStop(0.35, "rgba(0,0,0,0.28)"); sh.addColorStop(1, "rgba(0,0,0,0.12)");
      g.fillStyle = sh; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 10;
      g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 6; g.stroke(P);
      g.shadowBlur = 0;
      if (lpaint.sheen) {
        const gr = g.createLinearGradient(x0 + 10, 0, x1 - 10, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.45, "rgba(255,255,255,0.08)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      g.restore();
    };
    if (arc && showLining) openingLining(ARC_OPENING, 330, 670, 460, 870);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
    // Every other single breasted front (Daniel 2026-11-20: "didn't catch my
    // lining"): the photo's fronts open below the bottom button too, so the
    // chosen lining shows there the same way, on top of the cloth shading.
    if (!db && !arc && showLining) openingLining(SB_OPENING, 330, 690, 470, 912);

    // The lapel's outer edge where the mockup's labels were painted out
    // (diamond and shawl lapels have their own edge in their shading).
    if (!db && v.collar !== "Diamond Lapel" && v.collar !== "Shawl" && v.collar !== "Arc Lapel") {
      line(g, [[541, 196], [482, 338]], "rgba(0,0,0,0.32)", 1.3);
      line(g, [[539.5, 196], [480.5, 338]], "rgba(255,255,255,0.07)", 0.9);
    }

    // Lapel width.
    const lapF = lapelFactor(v), lapS = lapelSides(v, db, arc);
    lapelWarp(g, lapS, lapF);
    // Pockets and other cloth pieces take their cloth from the layer, so it
    // gets the same lapel width (else the old lapel edge shows through).
    if (lapF !== 1) {
      const wl = mk(layer.width, layer.height), wg = wl.getContext("2d");
      wg.drawImage(layer, 0, 0);
      wg.setTransform(g.getTransform());
      lapelWarp(wg, lapS, lapF);
      layer = wl;
    }

    // Chest pocket, kept clear of the lapel's edge (further right on the
    // double breasted photo, whose lapel is wider).
    const ck = chestKind(v.pockettype);
    // The Arc photo's lapel is wider: the pocket stays put and its end tucks
    // under the lapel (Daniel 2026-11-19: "peeking out from under").
    const arcFront = !db && v.collar === "Arc Lapel";
    // The Arc photo keeps the reference's own proportions (narrower than the
    // main photo), so the drawn pockets and cuffs move toward the middle by
    // the same amount (ARC_K in scripts/make_jacket_photo_arc.py).
    const AX = (x, k) => (arcFront ? 398.5 + (x - 398.5) * k : x);
    const AW = (w, k) => (arcFront ? w * k : w);
    const squeeze = (k, fn) => {
      if (!arcFront) { fn(); return; }
      g.save(); g.translate(398.5, 0); g.scale(k, 1); g.translate(-398.5, 0); fn(); g.restore();
    };
    // Daniel 2026-11-20: on every style the chest pocket peeks out from under
    // the lapel: its inner end sits 16 px under the lapel's edge (at the
    // chosen width), and the pocket keeps its full size.
    const lapR = lapS[0];
    const edgeAt = (y) => { const r = lerpRows(lapR, y, 1); return r + lapF * (lerpRows(lapR, y, 2) - r); };
    // Chest pocket length (Daniel 2026-11-20: first "too small", then to the
    // sleeve was "too far, use online references"): tailoring references give
    // a breast welt of 4 to 4.5 in (about 10.8 cm), two thirds of a 6 to 6.5 in
    // hip pocket, about 1 in tall. Here that is 124 px; it always stops at
    // least 12 px short of the sleeve seam.
    const L0 = edgeAt(310) - 20;
    const C12 = Math.cos(12 * Math.PI / 180);
    const R0 = Math.min(L0 + AW(124, 0.9) * C12, lerpRows(CHEST_SIDE[arcFront ? "arc" : "sb"], 286, 1) - 12);
    const CW = (R0 - L0) / C12, CX = (L0 + R0) / 2;
    // The pocket's inner end tucks under the lapel when the lapel reaches it
    // (Arc, wide lapels): clip away everything left of the lapel's edge.
    {
      const R = lapS[0];
      let d = "M0,0 H" + VBW + " V" + VBH + " H0 Z M300," + R[0][0];
      R.forEach((r) => { d += " L" + (r[1] + lapF * (r[2] - r[1])).toFixed(1) + "," + r[0]; });
      d += " L300," + R[R.length - 1][0] + " Z";
      g.save();
      g.clip(new Path2D(d), "evenodd");
    }
    // In the drawings the chest pocket climbs toward the shoulder (about 12
    // degrees), is about 4.6 times as long as tall, and its low end goes
    // under the lapel.
    const CA = -12, CY = 300, hwc = CW / 2;
    if (ck === "patch") patchPocket(g, layer, CX, CY - 26, CW * 0.92, CW * 0.97, CA / 2, 1, false);
    else if (ck === "boat") {
      const boat = (i) => pocketPath([["M", [-hwc + i, -13 + i]], ["Q", [0, -5 + i], [hwc - i, -13 + i]], ["L", [hwc - i, 10 - i]], ["Q", [0, 28 - i], [-hwc + i, 10 - i]]], CX, CY, CA);
      clothPiece(g, layer, boat(0), { shadow: 0.4, blur: 3, drop: 1.5, grad: [CY - 18, CY + 20], stitch: boat(3) });
    } else if (ck === "welt") clothPiece(g, layer, boxPath(CX, CY - 13, CW, 26, CA, 0), { shadow: 0.4, blur: 3, drop: 1.5, grad: [CY - 18, CY + 18], stitch: boxPath(CX, CY - 10, CW - 6, 20, CA, 0) });
    else if (ck === "sb" || ck === "db") besom(g, layer, CX, CY, CW, CA, ck === "db");
    g.restore();

    // Lower pockets (and the ticket pocket on the wearer's right).
    const lp = parseLowerPocket(v.lowerpocket);
    // Daniel 2026-11-20: the pockets start at the back and wrap toward the
    // front. Each one runs from the front out past the side of the body and
    // is cut off where the body turns away under the sleeve.
    const sides = BODY_SIDES[arcFront ? "arc" : "sb"];
    let bodyD = "M" + sides.map((r) => r[1] + "," + r[0]).join(" L");
    bodyD += " L" + sides.slice().reverse().map((r) => r[2] + "," + r[0]).join(" L") + " Z";
    onCloth(g, (g) => {
      g.save();
      g.clip(new Path2D(bodyD));
      // From the drawings: level pockets dip a little toward the front
      // buttons (about 5 degrees); slanted ones do the opposite, high at the
      // front and dropping toward the side seam (about 15 degrees), like an
      // upside-down V.
      const tilt = lp.slant ? -15 : 5;
      // Daniel 2026-11-20: every lower pocket starts at the back and wraps
      // around to the front: it runs on past the side of the body and is cut
      // off where the body turns away under the sleeve (no outer end shows).
      const WRAP = 26;
      const span = (y, inner, s) => {
        const outer = s < 0 ? lerpRows(sides, y, 1) - WRAP : lerpRows(sides, y, 2) + WRAP;
        return [(outer + inner) / 2, Math.abs(inner - outer)];
      };
      if (lp.main !== "none") {
        // Classic placement (2026-11-20, tailoring references): the hip
        // pockets sit level with the bottom button of a two button front,
        // start near the front dart and run to the side.
        const K = 0.845, TOP = 628;
        const inL = AX(db ? 290 : 306, K), inR = AX(db ? 513 : 497, K);
        const A = span(TOP + 8, inL, -1), B = span(TOP + 8, inR, 1);
        const wv = A[1] - WRAP;
        const isPatch = /patch/.test(lp.main);
        const plook = lp.main === "pointbtn" ? buttonLook(v, fabricHex) : null;
        [[A, -1, tilt, inL], [B, 1, -tilt, inR]].forEach((q) => {
          const P = q[0], o = q[1], deg = q[2], inner = q[3];
          if (lp.main === "flap") flap(g, layer, P[0], TOP, P[1], wv / 2.3, deg);
          else if (lp.main === "point" || lp.main === "pointbtn") {
            // The point sits in the middle of the part in view.
            const mid = (inner + o * wv / 2) - P[0];
            pointFlap(g, layer, P[0], TOP, P[1], wv, deg, mid, plook);
          } else if (lp.main === "db" || lp.main === "sb") besom(g, layer, P[0], TOP + 6, P[1], deg, lp.main === "db");
          else if (lp.main === "welt") clothPiece(g, layer, boxPath(P[0], TOP - 4, P[1], wv / 3.6, deg, 0), { shadow: 0.4, blur: 3, drop: 1.5, grad: [TOP - 4, TOP + 22], stitch: boxPath(P[0], TOP - 1, P[1] - 6, wv / 3.6 - 6, deg, 0) });
          else if (isPatch) {
            // Patch pockets wrap around the side too; the part in view sets the height.
            const edgeX = o < 0 ? lerpRows(sides, TOP + 60, 1) : lerpRows(sides, TOP + 60, 2);
            const side = edgeX + o * WRAP;
            const inn = inner + o * 6, pw = Math.abs(inn - side);
            patchPocket(g, layer, (side + inn) / 2, TOP - 10, pw, Math.abs(inn - edgeX) * 1.4, deg * 0.6, o, lp.main === "highpatch");
          }
        });
        if (lp.ticket) {
          // Ticket pocket: same width as the pocket below it, parallel to it.
          const gap = lp.ticket === "flap" ? wv * 0.6 : isPatch ? wv * 0.48 : wv * 0.5;
          const ty = TOP - gap;
          const T = span(ty + 8, inL, -1);
          if (lp.ticket === "flap") flap(g, layer, T[0], ty, T[1], wv / 2.3 * 0.85, tilt);
          else besom(g, layer, T[0], ty + 6, T[1], tilt, lp.ticket === "db");
        }
      }
      // Daniel 2026-11-22: "they should not be visible edge to edge from the
      // front". Toward the side the pocket turns away with the body: it
      // darkens into the side's shadow, so it reads as coming from the back.
      if (lp.main !== "none") {
        g.globalCompositeOperation = "source-atop";
        const TURN = 34;
        for (let y = 540; y < 800; y += 4) {
          [[lerpRows(sides, y + 2, 1), 1], [lerpRows(sides, y + 2, 2), -1]].forEach((q) => {
            const gr = g.createLinearGradient(q[0], 0, q[0] + q[1] * TURN, 0);
            gr.addColorStop(0, "rgba(0,0,0,0.42)"); gr.addColorStop(0.45, "rgba(0,0,0,0.16)"); gr.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = gr;
            g.fillRect(Math.min(q[0], q[0] + q[1] * TURN), y, TURN, 4.2);
          });
        }
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
    });
    anchors.pocket = /patch/.test(lp.main) ? [244, 640] : [229, 636];

    // Lapel buttonholes.
    const lapelHoleHex = threadHex("buttonholeThreadColor", v, fabricHex);
    const spots = lapelHoleSpots(v);
    // A handmade lapel buttonhole (2026-11-03) shows as a thicker, raised
    // corded hole with a bigger eye; the exact shapes are in the factory photos.
    const handHole = !!v.lapelButtonholeStyle && v.lapelButtonholeStyle !== "Machine Sewn";
    spots.forEach((s) => hole(g, s[1], s[0], lapelHoleHex, handHole ? 3.4 : 2.4));
    anchors.lapelHole = spots.length ? [spots[0][0][0] + 4, spots[0][0][1] - 22] : [520, 134];
    if (v.monogram === "Monogram Placement On Left Button") monogramText(g, 520, 214, v, 10, -1.17);

    // Front buttons and their buttonholes.
    const lay = frontLayout(v.frontbutton);
    const look = buttonLook(v, fabricHex);
    const threadV = threadHex("threadColor", v, fabricHex);
    const holes = buttonholeHexes(v, fabricHex);
    // The top front buttonhole can carry its own color (Top Front
    // Buttonhole Only); the rest use holes.front.
    let firstHole = true;
    const holeHexNext = () => { const h = firstHole ? holes.frontTop : holes.front; firstHole = false; return h; };
    lay.buttons.forEach((b) => {
      if (lay.db) { if (b.holed) hole(g, [b.x + 14, b.y + 1], [b.x + 31, b.y + 1], holeHexNext(), 2.4); }
      else if (b.fast) hole(g, [b.x - 2, b.y], [b.x + 13, b.y], holeHexNext(), 2.4);
      else if (!b.rolled) hole(g, [b.x + 41, b.y], [b.x + 57, b.y], holeHexNext(), 2.4);
      button(g, b.x, b.y, 11.5, look, { thread: threadV, nail: v.buttonNail });
    });
    const top = lay.buttons.find((b) => b.fast) || lay.buttons[0];
    anchors.topButton = [top.x, top.y];

    // Sleeve buttons: seen edge on at the back of each cuff.
    squeeze(0.822, () => drawCuffs(g, v, look, holes, false));
    squeeze(0.92, () => sleeveHeads(g, v, [[141, 130], [150, 180], [163, 213], [170, 243], [180, 290]]));
    return true;
  }
  // Sleeve heads (pts: the viewer's left armhole seam from the shoulder down;
  // mirrored for the right). Naples: small gathers at the top of the sleeve;
  // close seam: a line of topstitching beside the seam.
  function sleeveHeads(g, v, pts) {
    const sc = v.sleevecrown;
    if (sc !== "Naples Sleeve" && sc !== "Close Seam Sleeve") return;
    [1, -1].forEach((s) => {
      const P = pts.map((p) => [s > 0 ? p[0] : MIRROR_X - p[0], p[1]]);
      if (sc === "Close Seam Sleeve") {
        line(g, P.slice(0, 4).map((p) => [p[0] - 3.2 * s, p[1]]), "rgba(255,255,255,0.32)", 0.9, [2.2, 2]);
        line(g, P.slice(0, 4).map((p) => [p[0] - 3.2 * s, p[1] + 0.8]), "rgba(0,0,0,0.3)", 0.7, [2.2, 2]);
      } else {
        // Puckers fanning out from the seam onto the sleeve.
        for (let i = 0; i < 6; i++) {
          const t = i / 5, k = Math.min(P.length - 2, Math.floor(t * 2));
          const a = P[k], b = P[k + 1], f = t * 2 - k;
          const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
          g.save(); g.lineCap = "round";
          g.strokeStyle = "rgba(0,0,0,0.38)"; g.lineWidth = 1.1;
          g.beginPath(); g.moveTo(x - 1 * s, y); g.quadraticCurveTo(x - 6 * s, y + 1, x - 10 * s, y + 5); g.stroke();
          g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(x - 1 * s, y + 2); g.quadraticCurveTo(x - 6 * s, y + 3, x - 10 * s, y + 7); g.stroke();
          g.restore();
        }
      }
    });
  }
  function drawCuffs(g, v, look, holes, back) {
    const c = cuffLayout(v);
    const step = c.overlap ? 14.5 : 19;
    const n = c.holes;
    for (let i = 0; i < n; i++) {
      const y = 796 - i * step;
      // A diagonal vent: the lowest button sits furthest toward the middle of
      // the sleeve, each higher one further toward the back seam.
      const dx = c.ventSlant ? (n - 1 - i) * 3.2 : 0;
      // The buttonhole beside each button on the sleeve's face (viewer's left
      // sleeve), level or tilted up away from the button.
      const a = c.holeTilt ? -0.61 : 0;
      const hx = 32 + dx + (c.count ? 5 : 0);
      hole(g, [hx, y], [hx + 11 * Math.cos(a), y + 11 * Math.sin(a)], i === 0 ? holes.cuff1 : holes.sleeve, 1.8);
      if (!c.count) continue;
      // Viewer's left sleeve: the button edge faces us.
      button(g, 32 + dx, y, 9.5, look, { sx: 0.62, rot: -0.04 });
      // Viewer's right sleeve: only a sliver shows.
      button(g, 769 - dx, y, 9, look, { sx: 0.26 });
    }
    if (c.working && c.count) line(g, [[38, 808], [38, 822]], "rgba(0,0,0,0.6)", 1.4);
    if (v.monogram && /Sleeve Cuff/.test(v.monogram)) {
      const leftCuff = /Left/.test(v.monogram);
      // Wearer's left sleeve is the viewer's right one (front), and the
      // viewer's left one from behind.
      if (leftCuff !== back) monogramText(g, 742, 722, v, 9, -1.52);
      else monogramText(g, 60, 722, v, 9, 1.52);
    }
  }

  // ---- BACK VIEW ----------------------------------------------------------------
  const HEM = 931;
  function floorShadow(g) {
    g.save();
    const gr = g.createRadialGradient(400, HEM + 8, 0, 400, HEM + 8, 260);
    gr.addColorStop(0, "rgba(0,0,0,0.16)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.translate(0, HEM + 8); g.scale(1, 0.08); g.translate(0, -(HEM + 8));
    g.fillRect(100, HEM - 260, 600, 520);
    g.restore();
  }
  // ---- FOLDED PANTS UNDER THE JACKET (Daniel 2026-11-22) ----------------------
  // A full suit shows its pants folded flat under the jacket, in the pants
  // fabric. Until the pants are designed they show a classic look (belt
  // loops, a slit back pocket with a button, plain hem); the pants answers
  // replace it as they are picked. Drawn in the picture's own pixels, in a
  // band PANTS_H tall below the jacket photo (seen from the back: waistband
  // on the right, the leg folded back under on the left).
  const PANTS_H = 350;
  const PANTS_DEFAULTS = { beltLoops: "Belt Loops", backPocket: "Double Besom Pocket", bottomStyle: "Turn Up Bottom" };
  function pantsInOrder() {
    try {
      return typeof hasPantsStep === "function" && typeof hasJacketStep === "function" && hasPantsStep() && hasJacketStep();
    } catch (e) { return false; }
  }
  // Which pieces the picture shows, and its height.
  function pictureLayout() {
    let jacket = true, pants = false, vest = false;
    try {
      jacket = hasJacketStep();
      pants = hasPantsStep();
      vest = isVestOnlyType(currentSuitType);
      // A three-piece: a classic buttoned vest beside the pants that only
      // follows the fabric (Daniel 2026-11-22).
      if (currentSuitType === "threePiece") vest = "fixed";
    } catch (e) { /* main.js not ready: the jacket alone */ }
    const h = jacket ? VBH + (pants || vest ? PANTS_H : 0) : vest ? 800 : Math.round(PANTS_H * 1.3) + 60;
    return { jacket: jacket, pants: pants, vest: vest, h: h };
  }
  function pantsAnswers(v) {
    const P = typeof pantsDesigner !== "undefined" ? pantsDesigner : null;
    const raw = P && P.rawSelections ? withHover(P, P.rawSelections()) : {};
    const out = {};
    Object.keys(PANTS_DEFAULTS).forEach((k) => {
      out[k] = raw[k] && (!P.isShown || P.isShown(k) || (P.isAutoSet && P.isAutoSet(k))) ? raw[k] : PANTS_DEFAULTS[k];
    });
    // "Same as Jacket" (or not picked yet) = the jacket's fabric.
    const f = raw.fabric;
    out.fabric = f && !/^__same_as__/.test(f) && opt("fabric", f) ? f : v.fabric;
    return out;
  }
  function drawPants(g, v, oy) {
    const pa = pantsAnswers(v);
    const fab = opt("fabric", pa.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!fp.ready) return false;
    const hex = fp.hex;
    const st = fp.strength;
    const T = (pts) => pts.map((p) => [p[0], p[1] + oy]);
    // Outline points: A top fold corner, B waist top, C waist bottom,
    // H2 hem's inner end, L leg fold bottom, H1 hem's outer end.
    const A = [178, 20], B = [664, 16], C = [668, 252], H2 = [470, 226], L = [134, 184], H1 = [416, 292];
    const main = new Path2D();
    main.moveTo(A[0], A[1] + oy);
    main.quadraticCurveTo(420, 12 + oy, B[0], B[1] + oy);
    main.lineTo(C[0], C[1] + oy);
    main.quadraticCurveTo(570, 236 + oy, H2[0], H2[1] + oy);
    main.quadraticCurveTo(300, 120 + oy, A[0], A[1] + oy);
    main.closePath();
    const leg = new Path2D();
    leg.moveTo(A[0], A[1] + oy);
    leg.quadraticCurveTo(300, 120 + oy, H2[0], H2[1] + oy);
    leg.lineTo(H1[0], H1[1] + oy);
    leg.lineTo(L[0], L[1] + oy);
    leg.quadraticCurveTo(146, 96 + oy, A[0], A[1] + oy);
    leg.closePath();
    const fill = (path, shadow) => {
      g.save();
      if (shadow) {
        g.shadowColor = "rgba(0,0,0," + shadow[0] + ")";
        g.shadowBlur = shadow[1] * RES;
        g.shadowOffsetX = shadow[2] * RES;
        g.shadowOffsetY = shadow[3] * RES;
        g.fillStyle = hex;
        g.fill(path);
        g.shadowColor = "transparent";
      }
      g.clip(path);
      const m = g.getTransform();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = paintStyle(g, fp);
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.setTransform(m);
      return true;
    };
    const shadeGrad = (x0, y0, x1, y1, stops) => {
      const gr = g.createLinearGradient(x0, y0 + oy, x1, y1 + oy);
      stops.forEach((s) => gr.addColorStop(s[0], s[1]));
      g.fillStyle = gr;
      g.fillRect(0, oy, VBW, PANTS_H);
    };
    const dk = (a) => "rgba(0,0,0," + (a * st.a).toFixed(3) + ")";
    const lt = (a) => "rgba(255,255,255," + (a * st.b).toFixed(3) + ")";
    // Upper pants (seat and thigh), lying flat on the floor.
    fill(main, [0.28, 14, 0, 6]);
    shadeGrad(200, 20, 560, 250, [[0, lt(0.07)], [0.55, "rgba(0,0,0,0)"], [1, dk(0.16)]]);
    g.restore();
    // Waistband along the right edge.
    const W = 24;
    const band = new Path2D();
    band.moveTo(B[0] - W, B[1] + 1 + oy); band.lineTo(B[0], B[1] + oy); band.lineTo(C[0], C[1] + oy); band.lineTo(C[0] - W, C[1] - 1 + oy); band.closePath();
    g.save(); g.clip(main);
    g.fillStyle = dk(0.1); g.fill(band);
    line(g, T([[B[0] - W, B[1] + 1], [C[0] - W, C[1] - 1]]), dk(0.55), 1.3);
    line(g, T([[B[0] - W + 1.6, B[1] + 1], [C[0] - W + 1.6, C[1] - 1]]), lt(0.12), 1);
    line(g, T([[B[0] - 3, B[1] + 2], [C[0] - 3, C[1] - 2]]), lt(0.1), 1.2);
    g.restore();
    // Belt loops across the waistband.
    const loopAt = (y) => {
      const x0 = B[0] - W - 3, x1 = B[0] + 1, h = 9;
      const yy = y + oy;
      g.save();
      g.shadowColor = "rgba(0,0,0,0.4)"; g.shadowBlur = 3 * RES; g.shadowOffsetY = 1.5 * RES;
      g.fillStyle = mix(hex, "#000000", 0.04); g.fillRect(x0, yy - h / 2, x1 - x0, h);
      g.restore();
      line(g, [[x0 + 2, yy - h / 2 + 1.5], [x1 - 2, yy - h / 2 + 1.5]], lt(0.14), 1);
      line(g, [[x0 + 2, yy + h / 2 - 1], [x1 - 2, yy + h / 2 - 1]], dk(0.35), 1);
    };
    if (pa.beltLoops === "Belt Loops") { loopAt(54); loopAt(214); }
    else if (pa.beltLoops === "X Loops") {
      [54, 214].forEach((y) => {
        const x0 = B[0] - W - 2, x1 = B[0];
        line(g, [[x0, y - 7 + oy], [x1, y + 7 + oy]], dk(0.5), 6);
        line(g, [[x0, y + 7 + oy], [x1, y - 7 + oy]], dk(0.5), 6);
        line(g, [[x0, y - 7 + oy], [x1, y + 7 + oy]], mix(hex, "#000000", 0.05), 4.5);
        line(g, [[x0, y + 7 + oy], [x1, y - 7 + oy]], mix(hex, "#000000", 0.05), 4.5);
      });
    }
    // Back pocket, parallel to the waistband.
    const bp = String(pa.backPocket || "");
    const btnHex = lum(hex) > 150 ? mix(hex, "#3b2f26", 0.55) : mix(hex, "#161210", 0.6);
    const button = (x, y) => {
      g.save();
      g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 2.5 * RES; g.shadowOffsetY = 1 * RES;
      g.beginPath(); g.arc(x, y + oy, 6.5, 0, Math.PI * 2); g.fillStyle = btnHex; g.fill();
      g.restore();
      g.beginPath(); g.arc(x, y + oy, 6.5, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; g.stroke();
      g.fillStyle = "rgba(0,0,0,0.55)";
      [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach((d) => { g.beginPath(); g.arc(x + d[0], y + oy + d[1], 0.9, 0, Math.PI * 2); g.fill(); });
    };
    const PX = 604, PY0 = 104, PY1 = 214;
    if (bp && bp !== "No Pocket") {
      if (/Flap/.test(bp)) {
        // Flap over the slit, pointing toward the leg.
        const tip = /Rhombus/.test(bp);
        const fx = PX + 2, fw = 30;
        const flap = new Path2D();
        flap.moveTo(fx, PY0 + oy); flap.lineTo(fx, PY1 + oy);
        if (tip) { flap.lineTo(fx - fw + 8, PY1 - 2 + oy); flap.lineTo(fx - fw - 10, (PY0 + PY1) / 2 + oy); flap.lineTo(fx - fw + 8, PY0 + 2 + oy); }
        else { flap.lineTo(fx - fw + 6, PY1 - 1 + oy); flap.bezierCurveTo(fx - fw - 22, PY1 - 30 + oy, fx - fw - 22, PY0 + 30 + oy, fx - fw + 6, PY0 + 1 + oy); }
        flap.closePath();
        g.save();
        g.shadowColor = "rgba(0,0,0,0.42)"; g.shadowBlur = 4 * RES; g.shadowOffsetX = -1.5 * RES; g.shadowOffsetY = 1.5 * RES;
        g.fillStyle = hex; g.fill(flap);
        g.restore();
        g.save(); g.clip(flap); const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = paintStyle(g, fp); g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.setTransform(m);
        g.fillStyle = lt(0.05); g.fill(flap);
        g.restore();
        g.save(); g.strokeStyle = dk(0.45); g.lineWidth = 1; g.setLineDash([2.5, 2.5]);
        g.translate(fx - fw / 2, (PY0 + PY1) / 2 + oy); g.scale(0.86, 0.9); g.translate(-(fx - fw / 2), -((PY0 + PY1) / 2 + oy));
        g.stroke(flap); g.restore();
        line(g, T([[PX + 2, PY0], [PX + 2, PY1]]), dk(0.6), 1.4);
        button(fx - fw - (tip ? 2 : 4), (PY0 + PY1) / 2);
      } else {
        // Slit (double besom) pocket: two lips with a dark opening.
        g.save();
        g.beginPath(); g.moveTo(PX - 4, PY0 + oy); g.lineTo(PX + 4, PY0 + oy); g.lineTo(PX + 4.6, PY1 + oy); g.lineTo(PX - 3.4, PY1 + oy); g.closePath();
        g.fillStyle = dk(0.16); g.fill(); g.restore();
        line(g, T([[PX, PY0], [PX + 0.6, PY1]]), "rgba(0,0,0,0.75)", 1.5);
        line(g, T([[PX - 4, PY0], [PX - 3.4, PY1]]), dk(0.35), 0.9);
        line(g, T([[PX + 4, PY0], [PX + 4.6, PY1]]), dk(0.35), 0.9);
        line(g, T([[PX - 2.2, PY0 + 1], [PX - 1.6, PY1 - 1]]), lt(0.12), 0.8);
        line(g, T([[PX - 6, PY0 - 1], [PX + 6, PY0 - 1]]), dk(0.4), 1);
        line(g, T([[PX - 5.4, PY1 + 1], [PX + 6.6, PY1 + 1]]), dk(0.4), 1);
        const withButton = !/No Button/.test(bp);
        if (withButton) {
          button(PX - 18, (PY0 + PY1) / 2);
          // The button loop from the pocket.
          line(g, T([[PX - 1, (PY0 + PY1) / 2], [PX - 12, (PY0 + PY1) / 2]]), dk(0.5), 1.2);
        }
      }
    }
    // The leg, folded back under the seat.
    fill(leg, [0.42, 10, 3, 4]);
    shadeGrad(170, 40, 330, 280, [[0, lt(0.1)], [0.35, "rgba(0,0,0,0)"], [1, dk(0.22)]]);
    g.restore();
    // Fold edge (left) catches the light; the leg's top edge casts a shadow.
    g.save(); g.clip(leg);
    g.strokeStyle = lt(0.2); g.lineWidth = 3;
    g.beginPath(); g.moveTo(L[0] + 2, L[1] - 2 + oy); g.quadraticCurveTo(148, 98 + oy, A[0] + 2, A[1] + 3 + oy); g.stroke();
    g.restore();
    g.save(); g.strokeStyle = dk(0.38); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(A[0], A[1] + oy); g.quadraticCurveTo(300, 120 + oy, H2[0], H2[1] + oy); g.stroke(); g.restore();
    // Pressed crease down the leg.
    line(g, T([[232, 104], [404, 220]]), lt(0.08), 1.4);
    line(g, T([[232, 106], [404, 222]]), dk(0.12), 1);
    // Hem, or a turned-up cuff.
    const cuff = /Cuff\s*([\d.]+)/.exec(String(pa.bottomStyle || ""));
    const ux = H1[0] - L[0], uy = H1[1] - L[1];
    const len = Math.hypot(ux, uy);
    const nx = uy / len, ny = -ux / len; // into the leg (up-left of the hem)
    const off = (d) => [[L[0] + 4 + nx * d, L[1] + 1 + ny * d], [H1[0] - 2 + nx * d, H1[1] - 2 + ny * d]];
    if (cuff) {
      const d = 4 * parseFloat(cuff[1]);
      g.save(); g.clip(leg);
      const pts = off(d);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + oy); g.lineTo(pts[1][0], pts[1][1] + oy); g.lineTo(H1[0], H1[1] + oy); g.lineTo(L[0], L[1] + oy); g.closePath();
      g.fillStyle = lt(0.05); g.fill();
      g.restore();
      line(g, T(off(d)), dk(0.6), 1.6);
      line(g, T(off(d + 2)), dk(0.18), 2.5);
      line(g, T(off(d - 1.6)), lt(0.16), 1);
    } else {
      line(g, T(off(5)), dk(0.12), 1);
    }
    line(g, T([[L[0] + 1, L[1]], [H1[0], H1[1]]]), dk(0.3), 1.2);
    return true;
  }

  // ---- VEST ON ITS OWN (Daniel 2026-11-22: a picture for Vest Only too) -------
  // A vest laid flat, front view, in its own local space: x -130..130,
  // y 0..310, drawn at (cx, oy) scaled by s. Suits never show the vest
  // (Daniel 2026-11-22: "when designing a suit do not have the vest there").
  const VEST_DEFAULTS = { frontbutton: "5 Buttons", bottom: "Pointed", collar: "V-Neck", chestpocket: "Left Welt", lowerpocket: "Welt", pickStitch: "No Stitching" };
  function vestAnswers(v, fixed) {
    const VD = typeof vestDesigner !== "undefined" ? vestDesigner : null;
    const raw = VD && VD.rawSelections ? withHover(VD, VD.rawSelections()) : {};
    const out = {};
    Object.keys(VEST_DEFAULTS).forEach((k) => {
      out[k] = !fixed && raw[k] && (!VD.isShown || VD.isShown(k) || (VD.isAutoSet && VD.isAutoSet(k))) ? raw[k] : VEST_DEFAULTS[k];
    });
    const f = raw.fabric;
    out.fabric = f && !/^__same_as__/.test(f) && opt("fabric", f) ? f : v.fabric;
    return out;
  }
  function drawVest(g, v, cx, oy, s, fixed) {
    const va = vestAnswers(v, fixed);
    const fab = opt("fabric", va.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!fp.ready) return false;
    const hex = fp.hex, st = fp.strength;
    const dk = (a) => "rgba(0,0,0," + (a * st.a).toFixed(3) + ")";
    const lt = (a) => "rgba(255,255,255," + (a * st.b).toFixed(3) + ")";
    const fb = String(va.frontbutton || "");
    const db = /^Double/.test(fb);
    const nBtn = parseInt((/(\d)/.exec(fb) || [0, 5])[1], 10);
    const rows = db ? nBtn / 2 : nBtn;
    const collar = String(va.collar || "V-Neck");
    // Depth of the V: fewer buttons, deeper opening.
    const vDepth = db ? (fb.indexOf("Low") !== -1 ? 170 : 130) : ({ 3: 150, 4: 132, 5: 114, 6: 98 }[nBtn] || 114);
    const edgeX = db ? 34 : 0; // where the top front's edge runs (viewer's right of centre)
    const bottom = String(va.bottom || "Pointed");
    g.save();
    g.translate(cx, oy);
    g.scale(s, s);
    // Outline: right half (viewer's right) mirrored.
    const half = (sx) => {
      const p = new Path2D();
      const X = (x) => x * sx;
      p.moveTo(X(36), 0);
      p.lineTo(X(70), 8);
      p.bezierCurveTo(X(76), 60, X(96), 104, X(122), 116);
      p.lineTo(X(124), 236);
      if (bottom === "Straight") { p.lineTo(X(124), 286); p.lineTo(X(0), 286); }
      else if (bottom === "Rounded") { p.lineTo(X(124), 262); p.bezierCurveTo(X(80), 286, X(40), 292, X(12), 290); p.quadraticCurveTo(X(2), 290, X(0), 282); }
      else if (bottom === "Small Point") { p.lineTo(X(124), 262); p.lineTo(X(10), 296); p.lineTo(X(0), 286); }
      else { p.lineTo(X(124), 246); p.lineTo(X(8), 306); p.lineTo(X(0), 292); }
      p.lineTo(X(0), vDepth);
      p.closePath();
      return p;
    };
    const L = half(-1), R = half(1);
    const body = new Path2D();
    body.addPath(L); body.addPath(R);
    // Drop shadow and cloth.
    g.save();
    g.shadowColor = "rgba(0,0,0,0.3)"; g.shadowBlur = 14 * RES; g.shadowOffsetY = 6 * RES;
    g.fillStyle = hex; g.fill(L); g.fill(R);
    g.restore();
    // The back lining seen in the V.
    const vee = new Path2D();
    if (collar === "U-Neck") { vee.moveTo(-36, 0); vee.bezierCurveTo(-36, vDepth * 0.9, 36, vDepth * 0.9, 36, 0); }
    else { vee.moveTo(-36, 0); vee.lineTo(0, vDepth); vee.lineTo(36, 0); }
    vee.closePath();
    g.fillStyle = lum(hex) < 70 ? mix(hex, "#ffffff", 0.08) : mix(hex, "#000000", 0.25); g.fill(vee);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fill(vee);
    [L, R].forEach((P) => {
      g.save(); g.clip(P);
      const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = paintStyle(g, fp); g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.setTransform(m);
      const gr = g.createLinearGradient(-124, 0, 124, 300);
      gr.addColorStop(0, lt(0.08)); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(1, dk(0.18));
      g.fillStyle = gr; g.fillRect(-140, -10, 280, 330);
      // Armhole edge and side shading.
      const sg = g.createLinearGradient(-124, 0, 124, 0);
      sg.addColorStop(0, dk(0.18)); sg.addColorStop(0.18, "rgba(0,0,0,0)"); sg.addColorStop(0.82, "rgba(0,0,0,0)"); sg.addColorStop(1, dk(0.18));
      g.fillStyle = sg; g.fillRect(-140, -10, 280, 330);
      g.restore();
    });
    // U-Neck: the V opening is rounded off.
    if (collar === "U-Neck") {
      g.save(); g.clip(body); g.fillStyle = lum(hex) < 70 ? mix(hex, "#ffffff", 0.06) : mix(hex, "#000000", 0.3); g.fill(vee); g.restore();
    }
    // Front edge where the two fronts meet (the top front on the viewer's left
    // for single breasted; double breasted laps across).
    const frontBottom = bottom === "Straight" ? 286 : bottom === "Rounded" ? 284 : bottom === "Small Point" ? 290 : 298;
    if (db) {
      g.save(); g.strokeStyle = dk(0.55); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(edgeX * 0.25, vDepth - 6); g.lineTo(edgeX, vDepth + 18); g.lineTo(edgeX, frontBottom - 12); g.stroke(); g.restore();
    } else {
      g.save(); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 3 * RES; g.shadowOffsetX = 1 * RES;
      g.strokeStyle = dk(0.6); g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(0, vDepth); g.lineTo(0, frontBottom - 6); g.stroke(); g.restore();
    }
    // Lapels along the V.
    if (/Lapel/.test(collar)) {
      const w = 15;
      const lapel = (sx) => {
        const p = new Path2D();
        p.moveTo(36 * sx, 0); p.lineTo((36 + w) * sx, 2);
        if (/Shawl/.test(collar)) p.quadraticCurveTo((30 + w) * sx, vDepth * 0.55, 0, vDepth);
        else p.lineTo(4 * sx, vDepth - 6);
        p.lineTo(0, vDepth);
        p.closePath();
        return p;
      };
      [-1, 1].forEach((sx) => {
        const P = lapel(sx);
        g.save(); g.shadowColor = "rgba(0,0,0,0.4)"; g.shadowBlur = 4 * RES; g.shadowOffsetX = sx * 1.5 * RES;
        g.fillStyle = hex; g.fill(P); g.restore();
        g.save(); g.clip(P); const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = paintStyle(g, fp); g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.setTransform(m);
        g.fillStyle = lt(0.06); g.fill(P); g.restore();
        g.save(); g.strokeStyle = dk(0.5); g.lineWidth = 1; g.stroke(P); g.restore();
        // Notch or peak near the top.
        if (!/Shawl/.test(collar)) {
          const y = 34, x = 36 + w - 2 - y * (w + 30) / vDepth;
          g.save(); g.strokeStyle = dk(0.7); g.lineWidth = 1.4; g.beginPath();
          if (/Peak/.test(collar)) { g.moveTo(sx * (x + 2), y); g.lineTo(sx * (x + 10), y - 12); }
          else { g.moveTo(sx * (x + 1), y); g.lineTo(sx * (x - 9), y + 3); }
          g.stroke(); g.restore();
        }
      });
    }
    // Darts.
    [-1, 1].forEach((sx) => line(g, [[sx * 64, 150], [sx * 66, 200], [sx * 64, 246]], dk(0.28), 1));
    // Pockets: lower pockets on both sides, chest pocket on the wearer's left
    // (viewer's right) or both.
    const welt = (x0, y0, len, slant, kind) => {
      const a = slant ? -0.17 : 0;
      g.save(); g.translate(x0, y0); g.rotate(a);
      if (kind === "patch") {
        g.save(); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 3 * RES; g.shadowOffsetY = 1 * RES;
        g.strokeStyle = dk(0.45); g.lineWidth = 1.1; g.strokeRect(0, 0, len, len * 0.62); g.restore();
        g.save(); g.setLineDash([2, 2]); g.strokeStyle = dk(0.4); g.lineWidth = 0.8; g.strokeRect(2.5, 2.5, len - 5, len * 0.62 - 5); g.restore();
      } else if (kind === "flap") {
        g.fillStyle = dk(0.12); g.fillRect(0, 0, len, 13);
        g.strokeStyle = dk(0.55); g.lineWidth = 1.1; g.strokeRect(0, 0, len, 13);
        g.fillStyle = lt(0.08); g.fillRect(0, 0, len, 2);
      } else if (kind === "besom") {
        g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0, -0.8, len, 1.6);
        g.strokeStyle = dk(0.35); g.lineWidth = 0.8; g.strokeRect(0, -3.5, len, 7);
      } else {
        const h = kind === "narrow" ? 6 : 10;
        g.fillStyle = lt(0.04); g.fillRect(0, -h, len, h);
        g.strokeStyle = dk(0.55); g.lineWidth = 1.1; g.strokeRect(0, -h, len, h);
        g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, -h - 0.6, len, 1.2);
      }
      g.restore();
    };
    const kindOf = (name) => /Patch/.test(name) ? "patch" : /Flap/.test(name) ? "flap" : /Besom/.test(name) ? "besom" : /Narrow/.test(name) ? "narrow" : "welt";
    const lp = String(va.lowerpocket || "");
    if (lp && !/^No /.test(lp)) {
      const sl = /Slant/.test(lp), k = kindOf(lp);
      welt(-96, 212, 58, sl, k);
      welt(38 + (db ? 6 : 0), 212 + (sl ? 10 : 0), 58, sl, k);
      if (sl) { /* the right one leans the same way */ }
    }
    const cp = String(va.chestpocket || "");
    if (cp && !/^No /.test(cp)) {
      const k = kindOf(cp);
      const y = Math.max(vDepth * 0.55, 70) + 34;
      welt(54, y, 40, false, k);
      if (/^Both/.test(cp)) welt(-94, y, 40, false, k);
    }
    // Buttons and buttonholes.
    const btnHex = lum(hex) > 150 ? mix(hex, "#3b2f26", 0.55) : mix(hex, "#161210", 0.6);
    const button = (x, y) => {
      g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 2.5 * RES; g.shadowOffsetY = 1 * RES;
      g.beginPath(); g.arc(x, y, 5.2, 0, Math.PI * 2); g.fillStyle = btnHex; g.fill(); g.restore();
      g.beginPath(); g.arc(x, y, 5.2, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,0.16)"; g.lineWidth = 0.9; g.stroke();
      g.fillStyle = "rgba(0,0,0,0.55)";
      [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].forEach((d) => { g.beginPath(); g.arc(x + d[0], y + d[1], 0.75, 0, Math.PI * 2); g.fill(); });
    };
    const y0 = vDepth + 16, y1 = frontBottom - 30;
    for (let i = 0; i < rows; i++) {
      const y = rows === 1 ? y0 : y0 + (y1 - y0) * i / (rows - 1);
      if (db) { button(-edgeX + 6, y); button(edgeX - 10, y); }
      else button(-6, y);
    }
    // Pick stitching along the edges.
    if (/^Pick/.test(String(va.pickStitch || ""))) {
      g.save(); g.setLineDash([1.6, 3]); g.strokeStyle = lt(0.35); g.lineWidth = 0.9;
      g.translate(0, 0); g.scale(0.97, 0.98); g.translate(0, 3);
      g.stroke(L); g.stroke(R); g.restore();
    }
    g.restore();
    return true;
  }

  // ---- BACK VIEW ---------------------------------------------------------------
  // Built from Daniel's back reference (2026-11-22, "use as back reference
  // photo"; scripts/make_jacket_photo_back.py): the photo keeps the shirt
  // collar and cuffs, its luminance lights the chosen cloth. Its sleeve
  // buttons are painted out ("remove buttons if needed") and drawn from the
  // customer's picks; it has two shadings, with the photo's side vents and
  // with them painted out (no vent, or a centre vent drawn here).
  const PHOTO_BACK = "./assets/jacket-photo-back.webp?v=1";
  const SHADE_BACK_VENTS = "./assets/jacket-photo-shade-back-vents.webp?v=1";
  const SHADE_BACK_PLAIN = "./assets/jacket-photo-shade-back-plain.webp?v=1";
  // Where the photo's sleeve buttons were (bottom button; picture pixels).
  const BACK_CUFF = { lx: 101, rx: 697, y: 816 };
  function drawBackCuffs(g, v, look, holes) {
    const c = cuffLayout(v);
    const step = c.overlap ? 12.5 : 16;
    const n = c.holes;
    for (let i = 0; i < n; i++) {
      const y = BACK_CUFF.y - i * step;
      const dx = c.ventSlant ? (n - 1 - i) * 2.6 : 0;
      const a = c.holeTilt ? -0.61 : 0;
      [[BACK_CUFF.lx + dx, -1], [BACK_CUFF.rx - dx, 1]].forEach((b) => {
        const x = b[0], s = b[1];
        // The buttonhole runs from each button toward the back of the sleeve.
        const hx = x + s * (c.count ? 8 : 0);
        hole(g, [hx, y], [hx + s * 7 * Math.cos(a), y + 7 * Math.sin(a)], i === 0 ? holes.cuff1 : holes.sleeve, 1.5);
        if (c.count) button(g, x, y, 7.2, look, {});
      });
    }
    if (c.working && c.count) {
      line(g, [[BACK_CUFF.lx + 2, BACK_CUFF.y + 10], [BACK_CUFF.lx + 2, BACK_CUFF.y + 22]], "rgba(0,0,0,0.6)", 1.3);
      line(g, [[BACK_CUFF.rx - 2, BACK_CUFF.y + 10], [BACK_CUFF.rx - 2, BACK_CUFF.y + 22]], "rgba(0,0,0,0.6)", 1.3);
    }
    if (v.monogram && /Sleeve Cuff/.test(v.monogram)) {
      // From behind, the wearer's left sleeve is the viewer's left one.
      if (/Left/.test(v.monogram)) monogramText(g, 122, 742, v, 8, 1.5);
      else monogramText(g, 676, 742, v, 8, -1.5);
    }
  }
  function drawBack(g, v, anchors) {
    const sideVents = v.backvent === "Side Vent";
    const shadeUrl = sideVents ? SHADE_BACK_VENTS : SHADE_BACK_PLAIN;
    const photo = img(PHOTO_BACK), shade = img(shadeUrl);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!photo || !shade || !fp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    const layer = cachedLayer("back|" + shadeUrl + "|" + fp.key, () => shadedLayer(shade, [{ path: null, paint: fp }]));
    g.drawImage(photo, 0, 0, VBW, VBH);
    floorShadow(g);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
    // Sleeve heads (Naples / close seam), along the photo's armhole seam.
    sleeveHeads(g, v, [[205, 148], [208, 187], [213, 227], [220, 292], [228, 364]].map((p) => [p[0] + 3, p[1]]));
    // A centre vent on the centre back seam (side vents are in the photo).
    if (v.backvent === "Center Vent") {
      const top = 652;
      g.save();
      const gr = g.createLinearGradient(390, 0, 410, 0);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(390, top + 40, 20, HEM - top - 44);
      g.beginPath(); g.moveTo(400, top + 110); g.lineTo(403.5, HEM - 2); g.lineTo(396.5, HEM - 2); g.closePath();
      g.fillStyle = "rgba(0,0,0,0.45)"; g.fill();
      g.restore();
      line(g, [[400, top], [400, HEM - 2]], "rgba(0,0,0,0.7)", 1.8);
      line(g, [[402.5, top], [402.5, HEM - 2]], "rgba(255,255,255,0.16)", 1.2);
      line(g, [[391, top + 6], [409, top - 4]], "rgba(0,0,0,0.45)", 1.2);
    }
    if (v.monogram === "Monogram On Middle Under Collar") monogramText(g, 400, 40, v, 8, 0);
    drawBackCuffs(g, v, buttonLook(v, fp.hex), buttonholeHexes(v, fp.hex));
    anchors.vent = [400, 820];
    return true;
  }

  // ---- INSIDE VIEW (the jacket held open) ----------------------------------------
  // Built from Daniel's inside reference (2026-11-22;
  // scripts/make_jacket_photo_inside.py): shirt and tie in the photo (the tie
  // takes the fabric color like on the front), the jacket, lining and pants
  // lit from its shading. The chosen lining fills INSIDE_LINING; its welt
  // pockets are in the photo; the monogram is written on the lining.
  const PHOTO_INSIDE = "./assets/jacket-photo-inside.webp?v=2";
  const SHADE_INSIDE = "./assets/jacket-photo-shade-inside.webp?v=2";
  const INSIDE_LINING = "M299.8,160.1 L295.2,167.9 L273.6,200.7 L255.9,226.9 L236.2,261.6 L214.6,298.9 L193,327.1 L186.5,346.7 L183.8,369 L179.3,423.4 L176.6,488.9 L176.6,554.4 L178.6,587.1 L181.2,619.9 L181.2,652.6 L178.6,685.4 L176.6,718.1 L173.4,750.9 L168.8,783.6 L162.2,807.9 L155.7,832.8 L149.8,857 L146.5,881.9 L147.2,895 L155.7,906.1 L170.1,911.4 L195,909.4 L212,903.5 L215.9,865.5 L221.2,826.2 L223.8,803.3 L225.8,760.7 L230.4,719.4 L235.6,685.4 L240.8,659.2 L244.8,630.4 L261.8,626.4 L267,587.1 L276.9,521.6 L283.4,456.1 L288,357.9 L291.9,259.6 L298.5,194.1 Z " +
    "M498.2,161.4 L504.8,166 L537.5,218.4 L568.3,261.6 L594.5,292.4 L609.6,323.2 L618.8,346.7 L622,379.5 L622.7,423.4 L622.7,554.4 L620.7,587.1 L618.8,619.9 L618.1,652.6 L620.7,685.4 L624,718.1 L628.6,750.9 L633.8,783.6 L640.4,807.9 L646.9,832.8 L651.5,857 L654.8,881.9 L653.5,896.3 L646.9,905.5 L630.6,910.7 L607.6,908.1 L589.3,902.2 L587.3,883.2 L582.7,842.6 L578.8,809.8 L577.5,800 L572.9,760.7 L568.3,719.4 L563.1,685.4 L560.5,659.2 L557.2,630.4 L542.1,626.4 L530.3,587.1 L525.8,521.6 L519.2,456.1 L510.7,357.9 L502.8,259.6 L496.3,194.1 Z";
  // Half lining: across the chest only.
  const INSIDE_HALF = "M299.8,160.1 L295.2,167.9 L273.6,200.7 L255.9,226.9 L236.2,261.6 L214.6,298.9 L193,327.1 L186.5,346.7 L183.8,369 L179.3,423.4 L177.4,470 L282,470 L283.4,456.1 L288,357.9 L291.9,259.6 L298.5,194.1 Z " +
    "M498.2,161.4 L504.8,166 L537.5,218.4 L568.3,261.6 L594.5,292.4 L609.6,323.2 L618.8,346.7 L622,379.5 L622.7,423.4 L622.7,470 L520.6,470 L519.2,456.1 L510.7,357.9 L502.8,259.6 L496.3,194.1 Z";
  function drawInside(g, v, anchors) {
    const photo = img(PHOTO_INSIDE), shade = img(SHADE_INSIDE);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    const lp = liningPaint(v, fp);
    if (!photo || !shade || !fp.ready || !lp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    const facing = v.facing;
    const lined = facing !== "No Lining Construction";
    const half = facing === "Half Lining W/ Fabric Facing";
    const linPath = half ? INSIDE_HALF : INSIDE_LINING;
    const regions = [{ path: null, paint: fp }];
    if (lined) regions.push({ path: linPath, paint: lp, highlight: 0.9 });
    const layer = cachedLayer("inside|" + fp.key + "|" + lp.key + "|" + facing, () => shadedLayer(shade, regions));
    g.drawImage(tiePhoto(photo, PHOTO_INSIDE, tieHex(fp.hex), [340, 70, 116, 600]), 0, 0, VBW, VBH);
    floorShadow(g);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
    if (half && lined) {
      // Where the half lining stops, a piped edge.
      const pipe = mix(lp.hex, "#ffffff", 0.18);
      line(g, [[177.5, 470], [262.5, 470]], pipe, 1.4);
      line(g, [[532.5, 470], [622.5, 470]], pipe, 1.4);
    }
    // Inside pockets: the photo's two chest welts are the standard ones.
    // "Extra Lower Pocket" adds one lower on the viewer's left, "Extra Pen
    // Pockets" a pen pocket on the right; "No Inside Pockets" covers the
    // welts with the lining just above them.
    const ip = String(v.insidepocket || "");
    if (/^No Inner/.test(ip)) {
      [[233, 352], [567, 352]].forEach((c) => {
        const x0 = (c[0] - 44) * RES, y0 = (c[1] - 9) * RES, w = 88 * RES, h = 18 * RES;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(layer, x0, y0 - 20 * RES, w, h, x0, y0, w, h);
        g.restore();
      });
    }
    if (/^Fashion/.test(ip)) besom(g, layer, 212, 610, 40, 0, true);
    if (/^Combination/.test(ip)) {
      clothPiece(g, layer, "M582,402 C591,414 594,424 594,430 C594,438 588,443 582,443 C576,443 570,438 570,430 C570,424 573,414 582,402 Z", { shadow: 0.35, blur: 3, drop: 1.5, stitch: "M582,407 C589,417 591,425 591,430 C591,436 587,440 582,440 C577,440 573,436 573,430 C573,425 575,417 582,407 Z" });
      line(g, [[574, 416], [590, 416]], "rgba(0,0,0,0.55)", 1.2);
    }
    const mg = v.monogram;
    if (mg === "On Left Inside Pocket") monogramText(g, 567, 322, v, 12, 0);
    else if (mg === "On Right Inside Pocket") monogramText(g, 233, 322, v, 12, 0);
    else if (mg === "On Right Inside Pocket, Monogram On Satin") {
      g.save(); g.fillStyle = "#f1ece2"; g.fillRect(535, 312, 64, 20); g.restore();
      monogramText(g, 567, 322, v, 12, 0);
    }
    anchors.monogram = mg === "On Right Inside Pocket" ? [233, 340] : [567, 340];
    return true;
  }

  // ---- Studio UI ------------------------------------------------------------------
  const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const ICON_RESET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4v5h5"/></svg>';
  const ICON_FIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M9.5 15.5 12 8.5l2.5 7M10.4 13h3.2"/></svg>';

  const shell = document.createElement("div");
  shell.className = "studio-shell";
  shell.id = "jacketStudio";
  shell.innerHTML =
    '<div class="studio-main">' +
      '<div class="studio-stage">' +
        '<div class="studio-views" role="tablist" aria-label="Jacket view">' +
          '<button type="button" role="tab" data-view="front" class="active" aria-selected="true">Front</button>' +
          '<button type="button" role="tab" data-view="back" aria-selected="false">Back</button>' +
          '<button type="button" role="tab" data-view="inside" aria-selected="false">Inside</button>' +
        "</div>" +
        '<div class="studio-canvas loading">' +
          '<div class="studio-art"><canvas class="studio-photo" role="img" aria-label="Your jacket"></canvas></div>' +
          '<div class="studio-markers"></div>' +
          '<div class="studio-zoom" role="group" aria-label="Zoom">' +
            '<button type="button" data-zoom="in" aria-label="Zoom in">' + ICON_PLUS + "</button>" +
            '<button type="button" data-zoom="out" aria-label="Zoom out">' + ICON_MINUS + "</button>" +
            '<button type="button" data-zoom="reset" aria-label="Reset the view">' + ICON_RESET + "</button>" +
            '<button type="button" data-zoom="fit" aria-label="Fit the jacket">' + ICON_FIT + "</button>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<aside class="studio-panel" aria-live="polite">' +
        '<div class="studio-sheet" hidden>' +
          '<div class="studio-sheet-head"><div><div class="hiw-eyebrow studio-sheet-eyebrow">Customize</div><h3 class="studio-sheet-title"></h3></div>' +
            '<button type="button" class="studio-sheet-close" aria-label="Close">&times;</button></div>' +
          '<div class="studio-chips" role="tablist"></div>' +
          '<p class="studio-note" hidden></p>' +
          '<div class="studio-options designer-grid"></div>' +
          '<div class="studio-sheet-foot"><button type="button" class="btn-ghost studio-done">Done</button></div>' +
        "</div>" +
      "</aside>" +
    "</div>" +
    '<div class="studio-foot"><div class="studio-price"><span>Estimated total</span><b class="studio-price-val"></b></div>' +
      '<button type="button" class="btn-primary studio-continue"></button></div>';

  const canvasBox = shell.querySelector(".studio-canvas");
  const art = shell.querySelector(".studio-art");
  const photoCanvas = shell.querySelector(".studio-photo");
  const markersEl = shell.querySelector(".studio-markers");
  const sheetEl = shell.querySelector(".studio-sheet");
  const chipsEl = shell.querySelector(".studio-chips");
  const noteEl = shell.querySelector(".studio-note");
  const optsHost = shell.querySelector(".studio-options");
  const titleEl = shell.querySelector(".studio-sheet-title");
  const continueBtn = shell.querySelector(".studio-continue");
  const priceEl = shell.querySelector(".studio-price-val");
  photoCanvas.width = CW;
  photoCanvas.height = CH;
  const pg = photoCanvas.getContext("2d");

  let view = "front";
  // Picture height: the jacket photo, plus the folded pants for a full suit.
  let picH = VBH;
  function setPicH(h) {
    picH = h;
    photoCanvas.height = Math.round(h * RES);
    canvasBox.style.aspectRatio = VBW + " / " + h;
    zoom = { s: 1, cx: VBW / 2, cy: h / 2 };
    applyZoom();
    if (typeof sizePeek === "function") sizePeek();
  }
  let zoom = { s: 1, cx: VBW / 2, cy: VBH / 2 };
  let openArea = null;
  let openKey = null;
  let context = null; // "home" | "designer" | null (not showing)
  let anchors = {};

  function areaById(id) { return AREAS.find((a) => a.id === id); }
  function shownKeys(area) { return area.keys.filter((k) => D.isShown(k)); }

  // -- drawing --
  let drawRaf = 0;
  function scheduleDraw() {
    if (drawRaf) return;
    drawRaf = requestAnimationFrame(() => { drawRaf = 0; draw(); });
  }
  function draw() {
    if (!context) return;
    const v = current();
    const a = {};
    let ok = false;
    pg.setTransform(1, 0, 0, 1, 0, 0);
    // What the order holds: a suit = the jacket with its pants folded under
    // it; pants or a vest on their own = just that piece.
    const lay = pictureLayout();
    const h = lay.h;
    const next = mk(CW, Math.round(h * RES));
    const g = next.getContext("2d");
    g.scale(RES, RES);
    try {
      ok = lay.jacket ? (view === "back" ? drawBack(g, v, a) : view === "inside" ? drawInside(g, v, a) : drawFront(g, v, a)) : true;
      // The pants / vest sit on the same backdrop as the jacket photo.
      if (ok && (lay.pants || lay.vest)) {
        const y0 = lay.jacket ? VBH : 0;
        // (The back and inside views have no photo behind them: no fill, so
        // the pants sit on the same plain card as the jacket.)
        let bg = lay.jacket ? null : "#ECE6DF";
        if (lay.jacket) {
          try {
            const d = g.getImageData(4 * RES, (VBH - 3) * RES, 1, 1).data;
            if (d[3] > 200) bg = "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")";
          } catch (e) { /* no fill */ }
        }
        if (bg) { g.fillStyle = bg; g.fillRect(0, y0, VBW, h - y0); }
      }
      if (ok && lay.pants) {
        if (lay.jacket && lay.vest) {
          // Three-piece: vest on the left, pants a little smaller on the right.
          ok = drawVest(g, v, 160, VBH + 24, 0.92, true);
          if (ok) {
            g.save(); g.translate(290, VBH + 40); g.scale(0.85, 0.85); g.translate(-134, 0);
            ok = drawPants(g, v, 0);
            g.restore();
          }
        } else if (lay.jacket) ok = drawPants(g, v, VBH + 10);
        else {
          // Pants on their own: bigger, centred.
          g.save(); g.translate(400, 30); g.scale(1.3, 1.3); g.translate(-400, 0);
          ok = drawPants(g, v, 0);
          g.restore();
        }
      }
      if (ok && lay.vest && !lay.jacket) ok = drawVest(g, v, 400, 40, 2.3);
    } catch (e) {
      ok = false;
      if (window.console) console.error(e);
    }
    if (ok) {
      // Swap in one go so a redraw never flickers.
      if (h !== picH) setPicH(h);
      if (photoCanvas.width !== next.width || photoCanvas.height !== next.height) { photoCanvas.width = next.width; photoCanvas.height = next.height; }
      pg.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
      pg.drawImage(next, 0, 0);
      anchors = a;
      canvasBox.classList.remove("loading");
      if (typeof copyToPeek === "function") copyToPeek();
    }
    renderMarkers();
    syncChips();
    syncFoot();
  }

  // -- zoom & pan --
  // The picture is fitted into the frame, then scaled by zoom.s around the
  // point (zoom.cx, zoom.cy), which sits in the middle of the frame.
  let fit = { k: 1, w: 0, h: 0 };
  // Zoom stops where the photo's own detail runs out.
  const MAX_ZOOM = 3;
  // The picture is redrawn at the size it is shown (screen pixels per
  // picture unit), in steps, a moment after the zoom or the frame settles.
  // Phones stay at 2 (canvas memory); bigger screens go to 3.
  let resTimer = 0;
  function wantedRes() {
    const dpr = window.devicePixelRatio || 1;
    const shown = art.getBoundingClientRect().width * dpr / VBW;
    const cap = window.matchMedia && window.matchMedia("(min-width: 901px)").matches ? 3 : 2;
    const need = Math.min(cap, shown * 0.95);
    return [BASE_RES, 2, 3].find((r) => r >= need && r >= BASE_RES) || cap;
  }
  function checkRes() {
    resTimer = 0;
    if (!context || !art.getBoundingClientRect().width) return;
    const r = wantedRes();
    if (r === RES) return;
    RES = r;
    CW = Math.round(VBW * RES); CH = Math.round(VBH * RES);
    tileCache = {};
    layerCache.length = 0;
    scratch = null;
    draw();
  }
  function measure() {
    const r = canvasBox.getBoundingClientRect();
    // On wider screens keep room at the sides for the zoom buttons.
    const side = r.width > 600 ? 70 : 0;
    fit = { w: r.width, h: r.height, k: Math.min((r.width - 2 * side) / VBW, r.height / picH) || 1 };
  }
  function clampZoom(z) {
    const s = Math.max(1, Math.min(MAX_ZOOM, z.s));
    const k = fit.k * s;
    const halfW = fit.w / (2 * k), halfH = fit.h / (2 * k);
    const cx = VBW <= halfW * 2 ? VBW / 2 : Math.max(halfW, Math.min(VBW - halfW, z.cx));
    const cy = picH <= halfH * 2 ? picH / 2 : Math.max(halfH, Math.min(picH - halfH, z.cy));
    return { s: s, cx: cx, cy: cy };
  }
  function toScreen(x, y) {
    const k = fit.k * zoom.s;
    return [fit.w / 2 + (x - zoom.cx) * k, fit.h / 2 + (y - zoom.cy) * k];
  }
  function applyZoom() {
    measure();
    zoom = clampZoom(zoom);
    const k = fit.k * zoom.s;
    art.style.width = VBW * fit.k + "px";
    art.style.height = picH * fit.k + "px";
    const tx = fit.w / 2 - zoom.cx * k, ty = fit.h / 2 - zoom.cy * k;
    art.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + zoom.s.toFixed(4) + ")";
    positionMarkers();
    canvasBox.classList.toggle("zoomed", zoom.s > 1.01);
    if (resTimer) clearTimeout(resTimer);
    resTimer = setTimeout(checkRes, 180);
  }
  function animateZoom(target) {
    measure();
    target = clampZoom(target);
    const from = Object.assign({}, zoom);
    if (reduceMotion) { zoom = target; applyZoom(); return; }
    const t0 = performance.now();
    const dur = 420;
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      zoom = { s: from.s + (target.s - from.s) * e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e };
      applyZoom();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function zoomTo(cx, cy, s) { animateZoom({ s: s, cx: cx, cy: cy }); }
  function resetZoom() { animateZoom({ s: 1, cx: VBW / 2, cy: picH / 2 }); }

  function anchorFor(area) {
    const a = area.at && area.at[view];
    if (!a) return null;
    return typeof a === "string" ? anchors[a] || null : a;
  }
  function renderMarkers() {
    markersEl.innerHTML = "";
    AREAS.forEach((area) => {
      const pt = anchorFor(area);
      if (!pt || !shownKeys(area).length) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "studio-marker" + (area.lp === "below" ? " label-below" : "") + (openArea === area.id ? " active" : "");
      b.setAttribute("aria-label", "Change " + area.label);
      b.dataset.x = pt[0];
      b.dataset.y = pt[1];
      b.dataset.area = area.id;
      b.innerHTML = '<span class="studio-marker-dot" aria-hidden="true"></span><span class="studio-marker-label">' + esc(area.label) + "</span>";
      b.onclick = (e) => { e.stopPropagation(); openAreaPanel(area.id); };
      markersEl.appendChild(b);
    });
    positionMarkers();
  }
  function positionMarkers() {
    markersEl.querySelectorAll(".studio-marker").forEach((b) => {
      const p = toScreen(parseFloat(b.dataset.x), parseFloat(b.dataset.y));
      const inside = p[0] > 8 && p[0] < fit.w - 8 && p[1] > 8 && p[1] < fit.h - 8;
      b.hidden = !inside;
      b.style.left = p[0].toFixed(1) + "px";
      b.style.top = p[1].toFixed(1) + "px";
      b.classList.toggle("label-left", p[0] > fit.w * 0.68);
    });
  }

  function setView(next, keepZoom) {
    if (next === view) return;
    view = next;
    shell.querySelectorAll(".studio-views button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
      b.setAttribute("aria-selected", b.dataset.view === view ? "true" : "false");
    });
    if (!keepZoom) { zoom = { s: 1, cx: VBW / 2, cy: picH / 2 }; applyZoom(); }
    draw();
  }
  shell.querySelectorAll(".studio-views button").forEach((b) => { b.onclick = () => setView(b.dataset.view); });
  shell.querySelectorAll(".studio-zoom button").forEach((b) => {
    b.onclick = () => {
      const z = b.dataset.zoom;
      if (z === "fit") return resetZoom();
      if (z === "reset") {
        closePanel();
        if (view !== "front") setView("front");
        return resetZoom();
      }
      zoomTo(zoom.cx, zoom.cy, Math.max(1, Math.min(MAX_ZOOM, zoom.s * (z === "in" ? 1.5 : 1 / 1.5))));
    };
  });
  // Drag to look around while zoomed in; pinch or ctrl+wheel to zoom.
  let drag = null;
  const pointers = new Map();
  let pinch = null;
  canvasBox.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".studio-marker") || e.target.closest(".studio-zoom")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const ps = Array.from(pointers.values());
      pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), s: zoom.s };
      drag = null;
      return;
    }
    if (zoom.s <= 1.01) return;
    drag = { x: e.clientX, y: e.clientY, z: Object.assign({}, zoom), id: e.pointerId };
  });
  window.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const ps = Array.from(pointers.values());
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      zoom = clampZoom({ s: pinch.s * d / Math.max(1, pinch.d), cx: zoom.cx, cy: zoom.cy });
      applyZoom();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const k = fit.k * drag.z.s;
    zoom = clampZoom({ s: drag.z.s, cx: drag.z.cx - (e.clientX - drag.x) / k, cy: drag.z.cy - (e.clientY - drag.y) / k });
    applyZoom();
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) drag = null;
  };
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);
  // In the big picture the mouse wheel zooms on its own (Daniel 2026-11-22:
  // "zooming on preview w the scroller on mouse should work"), toward the
  // spot under the mouse; elsewhere only ctrl+wheel (a trackpad pinch).
  canvasBox.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey && !(typeof bigOpen !== "undefined" && bigOpen)) return;
    e.preventDefault();
    if (!e.deltaY) return;
    measure();
    const r = canvasBox.getBoundingClientRect();
    const mx = e.clientX - r.left - fit.w / 2, my = e.clientY - r.top - fit.h / 2;
    const k0 = fit.k * zoom.s;
    const px = zoom.cx + mx / k0, py = zoom.cy + my / k0;
    const step = Math.pow(1.0018, -Math.max(-120, Math.min(120, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY)));
    const s1 = Math.max(1, Math.min(MAX_ZOOM, zoom.s * step));
    const k1 = fit.k * s1;
    zoom = clampZoom({ s: s1, cx: px - mx / k1, cy: py - my / k1 });
    applyZoom();
  }, { passive: false });

  // -- the cards under the jacket --
  // -- the panel --
  function syncChips() {
    if (!openArea) return;
    const area = areaById(openArea);
    const keys = shownKeys(area);
    if (!keys.length) { closePanel(); return; }
    if (keys.indexOf(openKey) === -1) { showKey(keys[0]); return; }
    chipsEl.hidden = keys.length < 2;
    chipsEl.innerHTML = keys.map((k) => {
      const val = D.displayValue(k);
      return '<button type="button" role="tab" class="studio-chip' + (k === openKey ? " active" : "") + (val ? " done" : "") + '" data-k="' + k + '" aria-selected="' + (k === openKey) + '">' + esc(CAT[k].label) + "</button>";
    }).join("");
    chipsEl.querySelectorAll(".studio-chip").forEach((c) => { c.onclick = () => showKey(c.dataset.k); });
    const raw = D.rawSelections()[openKey];
    const nv = NON_VISUAL[openKey];
    const msg = nv || (!raw ? "Not chosen yet. The jacket shows a classic look until you pick." : "");
    noteEl.textContent = msg;
    noteEl.hidden = !msg;
  }
  function showKey(k) {
    openKey = k;
    D.embedOptions(optsHost, k, { quiet: context === "home" });
    syncChips();
  }
  function openAreaPanel(id, key) {
    const area = areaById(id);
    if (!area || !context) return;
    const keys = shownKeys(area);
    if (!keys.length) return;
    openArea = id;
    titleEl.textContent = area.label;
    sheetEl.hidden = false;
    shell.classList.add("sheet-open");
    document.body.classList.add("studio-sheet-up");
    // Turn the jacket to where the part is, and lean in on small details.
    if (!(area.at && area.at[view]) && area.view !== view) setView(area.view);
    else if (id === "lining" && view !== "inside") setView("inside");
    // The frame changes size when the panel opens.
    applyZoom();
    const z = area.zoom && area.zoom[view];
    const phone = window.innerWidth <= 900;
    if (z) zoomTo(z[0], z[1], z[2]);
    else if (phone) {
      const pt = anchorFor(area);
      if (pt && id !== "fabric" && id !== "lining") zoomTo(pt[0], pt[1], 1.8);
      else resetZoom();
    }
    showKey(key && keys.indexOf(key) !== -1 ? key : keys[0]);
    renderMarkers();
    if (phone) {
      // Keep the jacket in sight above the sheet.
      const top = canvasBox.getBoundingClientRect().top + window.scrollY - (typeof getNavClearance === "function" ? getNavClearance() : 80) - 8;
      if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      // Bring the whole jacket and panel into view.
      const r = shell.querySelector(".studio-main").getBoundingClientRect();
      const nav = typeof getNavClearance === "function" ? getNavClearance() : 80;
      if (Math.abs(r.top - nav - 8) > 30) window.scrollTo({ top: r.top + window.scrollY - nav - 8, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }
  function closePanel() {
    if (D.isEmbedded()) D.unembedOptions();
    if (!openArea) return;
    openArea = null;
    openKey = null;
    sheetEl.hidden = true;
    shell.classList.remove("sheet-open");
    document.body.classList.remove("studio-sheet-up");
    applyZoom();
    if (zoom.s > 1.01) resetZoom();
    renderMarkers();
  }
  shell.querySelector(".studio-sheet-close").onclick = closePanel;
  shell.querySelector(".studio-done").onclick = closePanel;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openArea && !document.querySelector(".lightbox.open")) closePanel(); });

  function syncFoot() {
    const total = document.getElementById("totalPrice");
    priceEl.textContent = total ? total.textContent : "";
    continueBtn.textContent = context === "designer" ? "Review & Continue" : "Continue";
  }
  continueBtn.onclick = () => {
    closePanel();
    if (context === "designer") { D.openReview(); return; }
    setMode("interactive");
    if (typeof startDesigning === "function") startDesigning();
  };

  // ---- Peek (2026-11-19, Daniel) -------------------------------------------
  // The step-by-step designer stays the only way to choose. This jacket is a
  // small, read-only picture on the side of the Jacket page that follows the
  // picks as they are made; tapping it opens the same jacket big (Front /
  // Back / Inside, zoom) with nothing to click on it. The old "Interactive
  // Jacket" mode (clickable parts, mode switch) is kept in the code but no
  // longer offered.
  const mode = "browse";
  function setMode() { /* Interactive Jacket mode is no longer offered */ }
  if (designerModeBar) designerModeBar.innerHTML = "";
  if (homeModeBar) homeModeBar.innerHTML = "";
  shell.classList.add("studio-readonly");

  const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
  const peek = document.createElement("button");
  peek.type = "button";
  peek.className = "suit-peek";
  peek.hidden = true;
  peek.setAttribute("aria-label", "See your jacket so far");
  peek.innerHTML = '<span class="suit-peek-pic loading"><canvas aria-hidden="true"></canvas></span>' +
    '<span class="suit-peek-label">Your jacket</span><span class="suit-peek-icon">' + ICON_EXPAND + "</span>";
  const peekCanvas = peek.querySelector("canvas");
  const peekPic = peek.querySelector(".suit-peek-pic");
  // The jacket fills most of the photo; crop a little of the empty edges.
  const PEEK_CROP = { x: 40, y: 20, w: 720, h: 912 };
  peekCanvas.width = 240;
  const peekG = peekCanvas.getContext("2d");
  const peekLabel = peek.querySelector(".suit-peek-label");
  // Taller for a full suit (the pants under the jacket).
  function sizePeek() {
    const lay = pictureLayout();
    const suit = lay.jacket && (lay.pants || lay.vest);
    const word = suit ? "suit" : lay.jacket ? "jacket" : lay.vest ? "vest" : "pants";
    shell.querySelector(".studio-views").style.display = lay.jacket ? "" : "none";
    PEEK_CROP.h = picH - 40;
    // As many pixels as the card shows on this screen (never stretched).
    const pw = Math.max(240, Math.min(720, Math.round(120 * (window.devicePixelRatio || 1))));
    peekCanvas.width = pw;
    peekCanvas.height = Math.round(pw * PEEK_CROP.h / PEEK_CROP.w);
    peekG.imageSmoothingQuality = "high";
    peekPic.style.aspectRatio = PEEK_CROP.w + " / " + PEEK_CROP.h;
    peekLabel.textContent = "Your " + word;
    peek.setAttribute("aria-label", "See your " + word + " so far");
    big.setAttribute("aria-label", "Your " + word + " so far");
    big.querySelector(".suit-peek-eyebrow").textContent = "Your " + word + " so far";
    copyToPeek();
    positionPeek();
  }
  document.body.appendChild(peek);

  const big = document.createElement("div");
  big.className = "suit-peek-view";
  big.hidden = true;
  big.setAttribute("role", "dialog");
  big.setAttribute("aria-label", "Your jacket so far");
  big.innerHTML = '<div class="suit-peek-card">' +
    '<div class="suit-peek-head"><div><div class="suit-peek-eyebrow">Your jacket so far</div>' +
    '<p class="suit-peek-sub">Updates as you choose. Anything not picked yet shows a classic look.</p>' +
    "</div>" +
    '<button type="button" class="suit-peek-close" aria-label="Close">&times;</button></div>' +
    '<div class="suit-peek-stage"></div></div>';
  big.querySelector(".suit-peek-stage").appendChild(shell);
  document.body.appendChild(big);

  let bigOpen = false;
  let bigPushed = false;
  function copyToPeek() {
    if (view !== "front" || canvasBox.classList.contains("loading")) return;
    peekG.clearRect(0, 0, peekCanvas.width, peekCanvas.height);
    peekG.drawImage(photoCanvas, PEEK_CROP.x * RES, PEEK_CROP.y * RES, PEEK_CROP.w * RES, PEEK_CROP.h * RES, 0, 0, peekCanvas.width, peekCanvas.height);
    peekPic.classList.remove("loading");
  }
  // Where the small picture sits: in the empty space to the right of the
  // questions when there is room, otherwise a small card in the corner just
  // above the Back / Next bar.
  function positionPeek() {
    if (peek.hidden) return;
    const grid = document.getElementById(peekPage === "pants" ? "pantsGrid" : peekPage === "vest" ? "vestGrid" : "designerGrid");
    const r = grid ? grid.getBoundingClientRect() : null;
    const room = r ? window.innerWidth - r.right : 0;
    const side = !!r && r.width > 0 && room >= 200;
    peek.classList.toggle("side", side);
    if (side) {
      const w = Math.min(118, room - 48);
      peek.style.width = w + "px";
      peek.style.left = Math.round(r.right + Math.min(56, (room - w) / 2)) + "px";
      peek.style.right = "auto";
      const nav = typeof getNavClearance === "function" ? getNavClearance() : 120;
      peek.style.top = Math.round(Math.max(nav + 24, Math.min(r.top, window.innerHeight * 0.3))) + "px";
      peek.style.bottom = "auto";
    } else {
      peek.style.width = "";
      peek.style.left = "auto";
      peek.style.right = "";
      peek.style.top = "auto";
      const bar = document.querySelector((peekPage === "pants" ? "#pantsSection" : peekPage === "vest" ? "#vestSection" : "#designer") + " .wiz-bar");
      const br = bar ? bar.getBoundingClientRect() : null;
      const barTop = br && br.height && br.top < window.innerHeight ? br.top : window.innerHeight;
      peek.style.bottom = Math.round(window.innerHeight - barTop + 12) + "px";
    }
  }
  function openBig() {
    if (bigOpen || !context) return;
    bigOpen = true;
    big.hidden = false;
    document.documentElement.classList.add("suit-peek-open");
    document.body.classList.add("suit-peek-open");
    requestAnimationFrame(() => { big.classList.add("in"); applyZoom(); draw(); });
    bigPushed = false;
    try {
      window.history.pushState(Object.assign({}, window.history.state || {}, { suitPeek: true }), "", window.location.href);
      bigPushed = true;
    } catch (e) { /* the X still closes it */ }
  }
  function closeBig(fromHistory) {
    if (!bigOpen) return;
    if (!fromHistory && bigPushed && window.history.state && window.history.state.suitPeek) { window.history.back(); return; }
    bigOpen = false;
    bigPushed = false;
    big.classList.remove("in");
    big.hidden = true;
    document.documentElement.classList.remove("suit-peek-open");
    document.body.classList.remove("suit-peek-open");
    zoom = { s: 1, cx: VBW / 2, cy: picH / 2 };
    if (view !== "front") setView("front");
    else applyZoom();
  }
  peek.onclick = openBig;
  big.querySelector(".suit-peek-close").onclick = () => closeBig();
  // Close on a click on the dark backdrop only when the press started there
  // too: dragging the zoomed picture and letting go off it must not close
  // it (Daniel 2026-11-22).
  let downOnBackdrop = false;
  big.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === big; });
  big.addEventListener("click", (e) => {
    const ok = downOnBackdrop && e.target === big;
    downOnBackdrop = false;
    if (ok) closeBig();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && bigOpen) closeBig(); });
  window.addEventListener("popstate", () => { if (bigOpen) closeBig(true); });
  window.addEventListener("scroll", positionPeek, { passive: true });
  window.addEventListener("resize", positionPeek);

  // Shows the small picture while the customer is on the Jacket page (and the
  // Pants page of a full suit).
  let peekPage = "jacket";
  function place() {
    const jacketSec = document.getElementById("designer");
    const designing = document.body.classList.contains("designing");
    const onJacketPage = designing && jacketSec && jacketSec.classList.contains("active");
    // A full suit: also beside the pants questions, so the pants picks show.
    // Also beside the pants and vest questions (Daniel 2026-11-22), for
    // suits and for pants or a vest on their own.
    const pantsSec = document.getElementById("pantsSection");
    const vestSec = document.getElementById("vestSection");
    const onPantsPage = !!(designing && pantsSec && pantsSec.classList.contains("active"));
    const onVestPage = !!(designing && vestSec && vestSec.classList.contains("active"));
    const next = onJacketPage || onPantsPage || onVestPage ? "peek" : null;
    const page = onPantsPage ? "pants" : onVestPage ? "vest" : "jacket";
    if (page !== peekPage) { peekPage = page; if (context) scheduleDraw(); }
    // (Only touch the class when it is there: a classList change fires the
    // observer below, which calls place() again.)
    if (jacketSec && jacketSec.classList.contains("studio-on")) jacketSec.classList.remove("studio-on");
    peek.hidden = !next;
    if (next === context) { positionPeek(); return; }
    closePanel();
    if (!next) closeBig();
    context = next;
    D.setReviewRowHandler(null);
    if (context) { applyZoom(); draw(); positionPeek(); }
  }

  // Picking a fabric closes the fabric panel so the customer sees it on the
  // jacket straight away.
  let lastFabric = D.rawSelections().fabric;
  if (typeof pantsDesigner !== "undefined" && pantsDesigner.onChange) pantsDesigner.onChange(() => { if (context) scheduleDraw(); });
  if (typeof vestDesigner !== "undefined" && vestDesigner.onChange) vestDesigner.onChange(() => { if (context) scheduleDraw(); });
  // Desktop hover preview (Daniel 2026-11-22): resting the mouse on an option
  // shows it in the picture; leaving puts the real pick back.
  [D, typeof pantsDesigner !== "undefined" ? pantsDesigner : null, typeof vestDesigner !== "undefined" ? vestDesigner : null].forEach((d) => {
    if (d && d.onHover) d.onHover(() => { if (context) scheduleDraw(); });
  });
  D.onChange(() => {
    if (context) scheduleDraw();
    const f = D.rawSelections().fabric;
    if (f !== lastFabric) {
      lastFabric = f;
      if (f && openArea === "fabric" && openKey === "fabric") setTimeout(closePanel, 0);
    }
  });
  if (window.MutationObserver) {
    const mo = new MutationObserver(() => place());
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const jacketSec = document.getElementById("designer");
    if (jacketSec) mo.observe(jacketSec, { attributes: true, attributeFilter: ["class"] });
    ["pantsSection", "vestSection"].forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) mo.observe(sec, { attributes: true, attributeFilter: ["class"] });
    });
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (context) applyZoom(); }).observe(canvasBox);
  else window.addEventListener("resize", applyZoom);
  place();
  // For testing in the browser console.
  window.jacketStudio = { open: openAreaPanel, close: closePanel, setView: setView, setMode: setMode, draw: draw, zoomTo: zoomTo };
})();
