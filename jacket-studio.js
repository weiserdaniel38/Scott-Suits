// ============================================================
// INTERACTIVE JACKET ("Interactive Jacket" mode)
// A photo of a jacket the customer can click to customize, shown on the
// homepage and, as an alternative to the step-by-step questions, on the
// Jacket page.
//
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
  if (!homeHost || !designerHost) return;

  const D = jacketDesigner;
  const CAT = JACKET_CATALOG;
  // Picture coordinates: the photo crop is 800 x 952.
  const VBW = 800;
  const VBH = 952;
  const MODE_KEY = "scottSuitsDesignMode";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PHOTO = "./assets/jacket-photo-front.webp?v=6";
  const SHADE = { front: "./assets/jacket-photo-shade-front.webp?v=4", back: "./assets/jacket-photo-shade-back.webp?v=3" };
  // One fabric tile (two swatches, ~16 cm of cloth) in picture pixels.
  const TILE = 176;

  // ---- Classic look for anything not picked yet (drawing only) ----------
  function firstNavySolid() {
    const solid = (CAT.fabric.patternTypes || []).find((t) => t.name === "Solid");
    const navy = solid && solid.colorFamilies.find((f) => /navy|blue/i.test(f.name));
    const list = navy ? navy.options : CAT.fabric.options;
    // A mid navy, not the darkest one, so the cloth reads as navy at a glance.
    const sorted = list.slice().sort((a, b) => lum(b.hex) - lum(a.hex));
    return (sorted[Math.floor(sorted.length / 3)] || CAT.fabric.options[0]).name;
  }
  const PREVIEW_DEFAULTS = {
    fabric: firstNavySolid(),
    collar: "Notch Lapel",
    lapelwidth: "9 cm",
    lapelbuttonhole: "Standard",
    frontbutton: "Single Breasted Two Buttons",
    pockettype: "Normal Pocket",
    lowerpocket: "Double Besom W/ Flap",
    sleevecuffstyle: "Imitation Button Hole On Sleeve Cuff",
    cuffbuttons: "4 Flat Button",
    backvent: "Side Vent",
    facing: "Round Shape Facing",
    insidepocket: "Normal Inside Pocket W/ Pen Pocket",
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
    { id: "buttons", label: "Front Buttons", view: "front", keys: ["frontbutton", "buttoncolor", "threadColor", "buttonNail", "frontButtonholeThreadColor"], at: { front: "topButton" } },
    { id: "pockets", label: "Pockets", view: "front", lp: "below", keys: ["lowerpocket", "pockettype"], at: { front: "pocket" } },
    { id: "cuff", label: "Sleeve Buttons", view: "front", lp: "below", keys: ["cuffbuttons", "sleevecuffstyle"], at: { front: [62, 772], back: [62, 772] }, zoom: { front: [130, 740, 2.4], back: [130, 740, 2.4] } },
    { id: "lining", label: "Lining", view: "inside", keys: ["lining", "facing", "insidepocket"], at: { inside: [400, 560] } },
    { id: "lapelhole", label: "Buttonhole", view: "front", keys: ["lapelbuttonhole", "buttonholeThreadColor"], at: { front: "lapelHole" }, zoom: { front: [520, 200, 2.2] } },
    { id: "vents", label: "Back Vents", view: "back", keys: ["backvent"], at: { back: [400, 820] } },
    { id: "monogram", label: "Monogram", view: "inside", keys: ["monogram", "monogramThreadColor"], at: { inside: [520, 400] } },
    { id: "collar", label: "Under Collar", view: "back", keys: ["feltundercollar", "feltColor"], at: { back: [400, 52], inside: [400, 52] } },
    { id: "facing", label: "Facing", view: "inside", keys: ["facing"], at: { inside: [222, 640] } },
    { id: "ipocket", label: "Inside Pockets", view: "inside", keys: ["insidepocket"], at: { inside: [270, 318] } },
    { id: "shoulder", label: "Shoulders & Structure", view: "front", keys: ["sleevecrown", "construction"], at: {} },
  ];
  const mapped = {};
  AREAS.forEach((a) => a.keys.forEach((k) => { mapped[k] = true; }));
  const extraKeys = D.keys.filter((k) => !mapped[k]);
  if (extraKeys.length) AREAS.push({ id: "more", label: "More Details", view: "front", keys: extraKeys, at: {} });
  // The cards under the jacket (as in Daniel's mockup), then the rest as
  // smaller links.
  const CARD_AREAS = ["fabric", "lapel", "buttons", "pockets", "cuff", "lining", "lapelhole"];
  const MORE_AREAS = ["vents", "monogram", "collar", "facing", "ipocket", "shoulder", "more"];
  // Questions the photo can't show: the panel says so instead of the picture
  // inventing a look for them.
  const NON_VISUAL = {
    construction: "Construction is the hidden structure inside the chest. It changes how the jacket drapes and wears in, not how it looks here.",
    feltundercollar: "The felt sits under the collar, against your shirt. Open the Inside view to see its color.",
    sleevecrown: "This is where the sleeve meets the shoulder. Naples sleeves get small gathers at the top of the sleeve.",
    lapelwidth: "Your lapel is cut to the width you pick. The photo keeps a standard width so the jacket stays true to life.",
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
  function current() {
    const raw = D.rawSelections();
    const v = {};
    Object.keys(PREVIEW_DEFAULTS).forEach((k) => { v[k] = PREVIEW_DEFAULTS[k]; });
    Object.keys(raw).forEach((k) => { if (raw[k] && D.isShown(k)) v[k] = raw[k]; });
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
  const RES = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
  const CW = Math.round(VBW * RES), CH = Math.round(VBH * RES);
  const tileCache = {};
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
      hg.drawImage(shade, 0, VBH, VBW, VBH, 0, 0, CW, CH);
      const s = rg.paint.strength;
      tg.globalCompositeOperation = "multiply";
      tg.globalAlpha = s.a;
      tg.drawImage(shade, 0, 0, VBW, VBH, 0, 0, CW, CH);
      tg.globalCompositeOperation = "lighter";
      tg.globalAlpha = s.b * (rg.highlight == null ? 1 : rg.highlight);
      tg.drawImage(scratch, 0, 0);
      tg.globalAlpha = 1;
      tg.globalCompositeOperation = "destination-in";
      tg.drawImage(shade, 0, 0, VBW, VBH, 0, 0, CW, CH);
      tg.restore();
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

  // Thread / button colors. "Match Fabric Color" follows the cloth.
  function threadHex(key, v, fabricHex) {
    const o = opt(key, v[key] || v._raw[key]);
    if (o && o.hex) return o.hex;
    return lum(fabricHex) < 60 ? mix(fabricHex, "#000000", 0.3) : mix(fabricHex, "#000000", 0.38);
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
    if (/^Single Breasted One/.test(n)) return { db: false, buttons: [{ x: 402, y: 586, fast: true }] };
    if (/^Single Breasted Three/.test(n)) return { db: false, buttons: [{ x: 413, y: 470, fast: false, rolled: true }, { x: 404, y: 560, fast: true }, { x: 389, y: 649, fast: false }] };
    if (/^Single Breasted/.test(n)) return { db: false, buttons: [{ x: 409, y: 525, fast: true }, { x: 387, y: 649, fast: false }] };
    // Double breasted: rows of [y, half the gap, fastens].
    const DB = {
      "Double Breasted 6X2": { rows: [[430, 104, false], [525, 70, true], [620, 70, false]] },
      "Double Breasted 4X2": { rows: [[525, 70, true], [620, 70, false]] },
      "Double Breasted 6X3": { rows: [[440, 70, true], [535, 70, false], [628, 70, false]] },
      "Double Breasted 4X1": { rows: [[505, 96, false], [612, 70, true]] },
      "Double Breasted One Button": { rows: [[586, 70, true]], leftOnly: true },
      "Double Breasted 2X1": { rows: [[586, 70, true]] },
      "Double Breasted 6X1": { rows: [[432, 104, false], [522, 70, false], [612, 70, true]] },
    };
    const d = DB[n] || DB["Double Breasted 6X2"];
    const buttons = [];
    d.rows.forEach((r) => {
      buttons.push({ x: 399 - r[1], y: r[0], fast: false, db: true });
      if (!d.leftOnly) buttons.push({ x: 399 + r[1], y: r[0], fast: r[2], db: true });
    });
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
    else if (/Curved Patch/.test(m)) main = "curvedpatch";
    else if (/^Patch/.test(m)) main = "patch";
    else if (/Slant Pocket Flap/.test(m)) main = "flap";
    else if (/W\/ Flap/.test(m)) main = "flap";
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
    return { count: none ? 0 : count, overlap: /Overlap/.test(n), slant: /Slant/.test(n) || /Slant/.test(style), working: /^Working/.test(style) };
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
        tg.drawImage(curShade, x0, y0, bw, bh, 0, 0, t.width, t.height);
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
      gr.addColorStop(0, "rgba(255,255,255,0.025)");
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
    const h = two ? 9 : 5.5;
    clothPiece(g, layer, boxPath(cx, cy - h / 2, w, h, deg, 0), { shadow: 0.35, blur: 2.5, drop: 1 });
    const a = rotPath([[-w / 2 + 1, two ? 0 : -h / 2 + 0.6], [w / 2 - 1, two ? 0 : -h / 2 + 0.6]], cx, cy, deg);
    g.save();
    g.strokeStyle = edge(1.35);
    g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(a[0][0], a[0][1]); g.lineTo(a[1][0], a[1][1]); g.stroke();
    g.restore();
  }
  function flap(g, layer, cx, top, w, h, deg) {
    // The jetting above the flap, then the flap hanging from it.
    besom(g, layer, cx, top, w + 2, deg, false);
    const r = 6;
    clothPiece(g, layer, boxPath(cx, top + 2, w, h, deg, r), { grad: [top, top + h], stitch: boxPath(cx, top + 5, w - 7, h - 7, deg, r - 2) });
  }
  function patch(g, layer, cx, top, w, h, deg, kind, outward) {
    const r = kind === "curvedpatch" ? 26 : 8;
    const back = kind === "highpatch" ? 9 * outward : 0;
    const d = boxPath(cx, top, w, h, deg, r, back);
    clothPiece(g, layer, d, { shadow: 0.35, blur: 4, drop: 1.5, stitch: boxPath(cx, top + 4, w - 8, h - 8, deg, r - 3, back) });
    // The opening at the top.
    const a = rotPath([[-w / 2 + 2, back < 0 ? back + 2 : 2], [w / 2 - 2, back > 0 ? -back + 2 : 2]], cx, top, deg);
    g.save(); g.strokeStyle = edge(0.9); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(a[0][0], a[0][1]); g.lineTo(a[1][0], a[1][1]); g.stroke(); g.restore();
  }
  function lowerPocket(g, layer, kind, cx, top, w, deg, outward) {
    if (kind === "flap") flap(g, layer, cx, top, w, 58, deg);
    else if (kind === "db" || kind === "sb") besom(g, layer, cx, top + 6, w, deg, kind === "db");
    else if (kind === "welt") clothPiece(g, layer, boxPath(cx, top - 4, w, 22, deg, 0), { shadow: 0.4, blur: 3, drop: 1.5, grad: [top - 4, top + 18], stitch: boxPath(cx, top - 1, w - 6, 16, deg, 0) });
    else if (/patch/.test(kind)) patch(g, layer, cx, top - 18, w + 2, 124, deg, kind, outward);
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
      else if (opts.nail === "Hand Shape Sewing Button") { g.moveTo(-h, h); g.lineTo(0, -h); g.lineTo(h, h); g.moveTo(0, -h); g.lineTo(0, h); }
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
    g.font = "italic 600 " + size + "px 'Playfair Display', Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = (o && o.hex) || "#c9b48a";
    g.fillText(t.slice(0, 12), 0, 0);
    g.restore();
  }

  // ---- Lapel shapes over the photo's notch lapels ---------------------------
  // The photo has notch lapels. Peak, shawl and diamond lapels are drawn over
  // the gorge (where collar meets lapel) with the same cloth.
  // Points for the wearer's left lapel (viewer's right); the other side is
  // mirrored across x = 401.5.
  const MIRROR_X = 803;
  const mirrorPts = (pts) => pts.map((p) => [MIRROR_X - p[0], p[1]]);
  const ptsPath = (pts) => "M" + pts.map(PT).join(" L") + " Z";
  function lapelOverlay(g, layer, style) {
    if (style !== "Peak Lapel" && style !== "Shawl" && style !== "Diamond Lapel") return;
    // First cover the photo's notch with plain lapel cloth from just below it.
    const cover = [[522, 100], [560, 94], [566, 134], [544, 146], [518, 128]];
    [false, true].forEach((m) => {
      const f = m ? mirrorPts : (p) => p;
      clothPiece(g, layer, ptsPath(f(cover)), { shadow: 0, noStroke: true, offset: [m ? -12 : 12, -38] });
      if (style === "Peak Lapel") {
        // The point rises from the lapel edge, over the collar, toward the shoulder.
        const peak = [[547, 134], [570, 98], [554, 104], [526, 112], [522, 124]];
        clothPiece(g, layer, ptsPath(f(peak)), { shadow: 0.5, blur: 4, drop: 2, noStroke: true, offset: [m ? -12 : 12, -38] });
        line(g, f([[540, 150], [547, 134], [570, 98], [554, 104], [526, 112]]), edge(0.9), 1.1);
        line(g, f([[541.5, 150], [548.5, 134.5], [569, 100.5]]), "rgba(255,255,255,0.08)", 0.8);
      } else if (style === "Diamond Lapel") {
        const dia = [[548, 132], [572, 122], [556, 102], [526, 112], [522, 124]];
        clothPiece(g, layer, ptsPath(f(dia)), { shadow: 0.5, blur: 4, drop: 2, noStroke: true, offset: [m ? -12 : 12, -38] });
        line(g, f([[541, 150], [548, 132], [572, 122], [556, 102], [530, 86]]), edge(0.9), 1.1);
      } else {
        // Shawl: one smooth edge from the lapel up around the neck.
        g.save();
        g.lineWidth = 1.2; g.strokeStyle = edge(0.75);
        const d = "M482,338 L541,196 C549,168 551,134 546,110 C538,84 510,60 476,46";
        g.stroke(new Path2D(m ? d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (q, x, y) => (MIRROR_X - parseFloat(x)).toFixed(1) + "," + y) : d));
        g.restore();
      }
    });
  }
  function lapelHoleSpots(v) {
    // Wearer's left lapel = viewer's right. Each hole runs across the lapel.
    const h = lapelHolesFor(v);
    const shawl = v.collar === "Shawl" || v.collar === "Diamond Lapel";
    const base = shawl ? [[506, 176], [526, 183]] : [[515, 156], [536, 164]];
    const out = [];
    for (let i = 0; i < h.left; i++) out.push([[base[0][0] - 4.2 * i, base[0][1] + 10.5 * i], [base[1][0] - 4.2 * i, base[1][1] + 10.5 * i]]);
    for (let i = 0; i < h.right; i++) out.push(mirrorPts([[base[0][0] - 4.2 * i, base[0][1] + 10.5 * i], [base[1][0] - 4.2 * i, base[1][1] + 10.5 * i]]));
    return out;
  }

  // ---- FRONT VIEW --------------------------------------------------------------
  function drawFront(g, v, anchors) {
    const photo = img(PHOTO), shade = img(SHADE.front);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!photo || !shade || !fp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    const layer = cachedLayer("front|" + fp.key, () => shadedLayer(shade, [{ path: null, paint: fp }]));
    const fabricHex = fp.hex;
    g.drawImage(photo, 0, 0, VBW, VBH);
    floorShadow(g);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();

    // The lapel's outer edge where the mockup's labels were painted out.
    line(g, [[541, 196], [482, 338]], "rgba(0,0,0,0.32)", 1.3);
    line(g, [[539.5, 196], [480.5, 338]], "rgba(255,255,255,0.07)", 0.9);
    lapelOverlay(g, layer, v.collar);

    // Chest pocket and pocket square.
    const ck = chestKind(v.pockettype);
    if (ck === "patch") patch(g, layer, 552, 268, 96, 96, -2, "patch", 1);
    else if (ck === "boat") clothPiece(g, layer, "M502,292 Q550,280 598,284 L598,308 Q550,304 502,316 Z", { shadow: 0.4, blur: 3, drop: 1.5, grad: [282, 316], stitch: "M506,295 Q550,284 594,288 L594,305 Q550,301 506,312 Z" });
    else if (ck === "welt") clothPiece(g, layer, boxPath(549, 287, 100, 26, -2.5, 0), { shadow: 0.4, blur: 3, drop: 1.5, grad: [287, 313], stitch: boxPath(549, 290, 94, 20, -2.5, 0) });
    else if (ck === "sb" || ck === "db") besom(g, layer, 549, 296, 98, -2.5, ck === "db");
    if (ck !== "none") {
      g.save();
      g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 3 * RES; g.shadowOffsetY = 1 * RES;
      const sqTop = ck === "patch" ? 262 : 277;
      g.beginPath(); g.moveTo(560, sqTop + 9); g.lineTo(562, sqTop + 1); g.lineTo(604, sqTop - 2); g.lineTo(605, sqTop + 7); g.closePath();
      const sg = g.createLinearGradient(0, sqTop - 2, 0, sqTop + 9);
      sg.addColorStop(0, "#ffffff"); sg.addColorStop(1, "#d9d6d0");
      g.fillStyle = sg; g.fill();
      g.restore();
    }

    // Lower pockets (and the ticket pocket on the wearer's right).
    const lp = parseLowerPocket(v.lowerpocket);
    const sl = lp.slant ? 11 : 0;
    if (lp.main !== "none") {
      const inset = lp.slant ? 6 : 0;
      lowerPocket(g, layer, lp.main, 231 + inset, 604, 102, 3 + sl, -1);
      lowerPocket(g, layer, lp.main, 569 - inset, 606, 98, -3 - sl, 1);
      if (lp.ticket) {
        const ty = /patch/.test(lp.main) ? 548 : 560;
        if (lp.ticket === "flap") flap(g, layer, 236, ty - 6, 78, 40, 3 + sl);
        else besom(g, layer, 236, ty, 76, 3 + sl, lp.ticket === "db");
      }
    }
    anchors.pocket = /patch/.test(lp.main) ? [229, 640] : [229, 636];

    // Lapel buttonholes.
    const lapelHoleHex = threadHex("buttonholeThreadColor", v, fabricHex);
    const spots = lapelHoleSpots(v);
    spots.forEach((s) => hole(g, s[1], s[0], lapelHoleHex, 2.4));
    anchors.lapelHole = spots.length ? [spots[0][0][0] + 4, spots[0][0][1] - 22] : [520, 134];
    if (v.monogram === "Monogram Placement On Left Button") monogramText(g, 520, 214, v, 10, -1.17);

    // Front buttons and their buttonholes.
    const lay = frontLayout(v.frontbutton);
    const look = buttonLook(v, fabricHex);
    const threadV = threadHex("threadColor", v, fabricHex);
    const holeHex = threadHex("frontButtonholeThreadColor", v, fabricHex);
    lay.buttons.forEach((b) => {
      if (!b.fast && !b.rolled && !(b.db && b.x < 399)) hole(g, [b.x + 41, b.y], [b.x + 57, b.y], holeHex, 2.4);
      if (b.fast) hole(g, [b.x - 2, b.y], [b.x + 13, b.y], holeHex, 2.4);
      button(g, b.x, b.y, 11.5, look, { thread: threadV, nail: v.buttonNail });
    });
    const top = lay.buttons.find((b) => b.fast) || lay.buttons[0];
    anchors.topButton = [top.x, top.y];

    // Sleeve buttons: seen edge on at the back of each cuff.
    drawCuffs(g, v, look, holeHex, false);
    return true;
  }
  function drawCuffs(g, v, look, holeHex, back) {
    const c = cuffLayout(v);
    const step = c.overlap ? 14.5 : 19;
    for (let i = 0; i < c.count; i++) {
      const y = 796 - i * step;
      const dx = c.slant ? i * 1.3 : 0;
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
  function drawBack(g, v, anchors) {
    const shade = img(SHADE.back);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    if (!shade || !fp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    const layer = cachedLayer("back|" + fp.key, () => shadedLayer(shade, [{ path: null, paint: fp }]));
    floorShadow(g);
    // The shirt collar above the jacket collar.
    g.save();
    g.beginPath(); g.moveTo(334, 48); g.quadraticCurveTo(400, 26, 466, 48); g.lineTo(463, 38); g.quadraticCurveTo(400, 16, 337, 38); g.closePath();
    g.fillStyle = "#f4f1ec"; g.fill(); g.strokeStyle = "rgba(0,0,0,0.12)"; g.stroke();
    g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
    // Seams: center back and side panels.
    line(g, [[400, 62], [402, 300], [398, 620], [400, HEM]], "rgba(0,0,0,0.42)", 1.3);
    line(g, [[401.6, 62], [403.6, 300], [399.6, 620], [401.6, HEM]], "rgba(255,255,255,0.06)", 1);
    line(g, [[176, 300], [190, 520], [192, 760], [196, 924]], "rgba(0,0,0,0.3)", 1.1);
    line(g, [[624, 300], [610, 520], [608, 760], [604, 924]], "rgba(0,0,0,0.3)", 1.1);
    // Sleeve heads.
    line(g, [[150, 128], [160, 190], [170, 300]], "rgba(0,0,0,0.28)", 1.1);
    line(g, [[650, 128], [640, 190], [630, 300]], "rgba(0,0,0,0.28)", 1.1);
    if (v.sleevecrown === "Naples Sleeve") {
      [[148, 140], [152, 156], [156, 172], [652, 140], [648, 156], [644, 172]].forEach((p) => line(g, [[p[0] - 5, p[1]], [p[0] + 5, p[1] + 6]], "rgba(0,0,0,0.3)", 1));
    }
    // Vents.
    const vent = v.backvent;
    const ventAt = (x, bend) => {
      const top = 742;
      g.save();
      const gr = g.createLinearGradient(x - 10, 0, x + 10, 0);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - 10, top + 40, 20, HEM - top - 40);
      g.restore();
      line(g, [[x + bend, top], [x, HEM - 1]], "rgba(0,0,0,0.6)", 1.6);
      line(g, [[x + bend + 2.5, top], [x + 2.5, HEM - 1]], "rgba(255,255,255,0.07)", 1);
      line(g, [[x + bend - 9, top + 6], [x + bend + 9, top - 4]], "rgba(0,0,0,0.45)", 1.2);
    };
    if (vent === "Center Vent") ventAt(400, 0);
    else if (vent === "Side Vent") { ventAt(194, 3); ventAt(606, -3); }
    // Collar.
    clothPiece(g, layer, "M316,58 Q400,26 484,58 L490,86 Q400,62 310,86 Z", { shadow: 0.45, blur: 4, drop: 2, stitch: "M320,62 Q400,32 480,62" });
    if (v.monogram === "Monogram On Middle Under Collar") monogramText(g, 400, 66, v, 9, 0);
    const look = buttonLook(v, fp.hex);
    drawCuffs(g, v, look, threadHex("frontButtonholeThreadColor", v, fp.hex), true);
    anchors.vent = [400, 820];
    return true;
  }

  // ---- INSIDE VIEW (the jacket opened up) --------------------------------------
  // The inside of the back between the two opened fronts: lining in the
  // middle, the fronts' facings (cloth) along each side.
  const IN_LINING = "M196,120 C240,96 290,72 330,66 Q400,74 470,66 C510,72 560,96 604,120 C614,200 616,300 610,420 C606,560 606,740 604,880 L196,880 C194,740 194,560 190,420 C184,300 186,200 196,120 Z";
  function facingPath(style, side) {
    // Viewer's left facing; mirrored for the right.
    const round = "M196,120 C240,96 290,72 330,66 C318,110 284,170 268,236 C312,244 330,282 326,320 C322,356 300,380 266,386 C264,560 262,740 262,880 L196,880 C194,740 194,560 190,420 C184,300 186,200 196,120 Z";
    const straight = "M196,120 C240,96 290,72 330,66 C318,110 284,170 268,236 C266,400 262,640 262,880 L196,880 C194,740 194,560 190,420 C184,300 186,200 196,120 Z";
    const d = style === "Round Shape Facing" ? round : straight;
    return side < 0 ? d : d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => (VBW - parseFloat(x)).toFixed(1) + "," + y);
  }
  function drawInside(g, v, anchors) {
    const shade = img(SHADE.back);
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fp = fabricPaint(fab);
    const lp = liningPaint(v, fp);
    if (!shade || !fp.ready || !lp.ready) return false;
    curShade = shade;
    edgeA = edgeFor(fp.hex);
    const facing = v.facing;
    const lined = facing !== "No Lining Construction";
    const half = facing === "Half Lining W/ Fabric Facing";
    // Half lining: lining across the shoulders only.
    const HALF = "M196,120 C240,96 290,72 330,66 Q400,74 470,66 C510,72 560,96 604,120 C614,200 616,300 612,400 C540,446 470,460 400,462 C330,460 260,446 188,400 C184,300 186,200 196,120 Z";
    const regions = [{ path: null, paint: fp }];
    if (lined) regions.push({ path: half ? HALF : IN_LINING, paint: lp, highlight: 0.8 });
    regions.push({ path: facingPath(facing, -1), paint: fp }, { path: facingPath(facing, 1), paint: fp });
    const layer = cachedLayer("inside|" + fp.key + "|" + lp.key + "|" + facing, () => shadedLayer(shade, regions));
    floorShadow(g);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
    const pipe = lined ? mix(lp.hex, "#ffffff", 0.18) : mix(fp.hex, "#ffffff", 0.25);
    // Satin sheen on the lining.
    if (lined) {
      g.save();
      g.clip(new Path2D(half ? HALF : IN_LINING));
      const gr = g.createLinearGradient(196, 0, 604, 0);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.35, "rgba(255,255,255,0.09)");
      gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(255,255,255,0.06)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(180, 60, 440, 840);
      g.restore();
      if (!half) {
        line(g, [[400, 74], [400, 880]], "rgba(0,0,0,0.25)", 1.3);
        line(g, [[403, 74], [403, 880]], "rgba(255,255,255,0.1)", 1);
      }
    }
    // Facing edges (piped).
    [-1, 1].forEach((s) => { g.save(); g.strokeStyle = pipe; g.lineWidth = 1.6; g.stroke(new Path2D(facingPath(facing, s))); g.restore(); });
    if (half || !lined) {
      line(g, [[400, half ? 462 : 74], [400, 880]], pipe, 1.6);
      if (half) { g.save(); g.strokeStyle = pipe; g.lineWidth = 1.6; g.stroke(new Path2D(HALF)); g.restore(); }
    }
    // Hem of the lining.
    line(g, [[196, 880], [604, 880]], "rgba(0,0,0,0.35)", 1.2);
    // Inside pockets: one on each side at the chest, on the facing seam.
    const ip = String(v.insidepocket || "");
    besom(g, layer, 270, 318, 78, 0, true);
    besom(g, layer, 530, 318, 78, 0, true);
    if (/Water Drop/.test(ip)) {
      g.save(); g.beginPath(); g.moveTo(552, 352); g.quadraticCurveTo(560, 340, 568, 352); g.quadraticCurveTo(568, 366, 560, 368); g.quadraticCurveTo(552, 366, 552, 352); g.closePath();
      g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 1.2; g.stroke(); g.restore();
    } else besom(g, layer, 552, 356, 34, 0, false);
    if (/Cigarette/.test(ip)) besom(g, layer, 278, 452, 48, 0, true);
    // Felt under collar at the back of the neck.
    g.save();
    g.beginPath(); g.moveTo(320, 60); g.quadraticCurveTo(400, 34, 480, 60); g.lineTo(482, 78); g.quadraticCurveTo(400, 56, 318, 78); g.closePath();
    g.fillStyle = feltHex(v, fp.hex); g.fill(); g.strokeStyle = "rgba(0,0,0,0.4)"; g.lineWidth = 1; g.stroke();
    g.restore();
    // Brand label.
    g.save();
    g.shadowColor = "rgba(0,0,0,0.25)"; g.shadowBlur = 2 * RES;
    g.fillStyle = "#efe8dc"; g.fillRect(366, 104, 68, 26);
    g.shadowColor = "transparent";
    g.strokeStyle = "rgba(176,141,87,0.6)"; g.strokeRect(369, 107, 62, 20);
    g.font = "600 8.5px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#6b5a3f";
    g.fillText("SCOTT SUITS", 400, 117.5);
    g.restore();
    const mg = v.monogram;
    if (mg === "On Left Inside Pocket") monogramText(g, 530, 344, v, 12, 0);
    else if (mg === "On Right Inside Pocket") monogramText(g, 270, 344, v, 12, 0);
    else if (mg === "On Right Inside Pocket, Monogram On Satin") {
      g.save(); g.fillStyle = "#f1ece2"; g.fillRect(238, 334, 64, 20); g.restore();
      monogramText(g, 270, 344, v, 12, 0);
    } else if (mg === "Monogram On Middle Under Collar") monogramText(g, 400, 66, v, 9, 0);
    anchors.monogram = mg === "On Right Inside Pocket" || mg === "On Right Inside Pocket, Monogram On Satin" ? [270, 372] : [530, 372];
    return true;
  }

  // ---- Studio UI ------------------------------------------------------------------
  const ICONS = {
    lapel: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8 L32 22 L42 8"/><path d="M22 8 C16 10 12 12 9 14 L9 58"/><path d="M42 8 C48 10 52 12 55 14 L55 58"/><path d="M22 8 L17 16 L22 20 L19 24 L32 52 L45 24 L42 20 L47 16 L42 8"/></svg>',
    buttons: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="15.5"/><circle cx="27" cy="27" r="2.2"/><circle cx="37" cy="27" r="2.2"/><circle cx="27" cy="37" r="2.2"/><circle cx="37" cy="37" r="2.2"/></svg>',
    pockets: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 22 H55"/><path d="M9 19 H55 V22"/><path d="M9 19 V22"/><path d="M11 22 V38 Q11 42 15 42 H49 Q53 42 53 38 V22"/></svg>',
    cuff: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 6 V52 Q20 56 24 56 H44"/><path d="M44 6 V56"/><path d="M38 20 V54"/><circle cx="41" cy="26" r="2.8"/><circle cx="41" cy="33" r="2.8"/><circle cx="41" cy="40" r="2.8"/><circle cx="41" cy="47" r="2.8"/></svg>',
    lapelhole: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="27" width="34" height="10" rx="2"/><path d="M13 32 H41"/><path d="M14 27 V37 M18 27 V37 M22 27 V37 M26 27 V37 M30 27 V37 M34 27 V37 M38 27 V37"/><circle cx="50" cy="32" r="6"/><circle cx="50" cy="32" r="2.5"/></svg>',
    more: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="18" cy="32" r="3"/><circle cx="32" cy="32" r="3"/><circle cx="46" cy="32" r="3"/></svg>',
  };
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
    '<div class="studio-parts">' +
      '<div class="studio-parts-eyebrow">Your jacket</div>' +
      '<h3 class="studio-parts-title">Choose a part to change</h3>' +
      '<span class="studio-parts-rule" aria-hidden="true"></span>' +
      '<div class="studio-cards"></div>' +
      '<div class="studio-more"></div>' +
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
  const cardsEl = shell.querySelector(".studio-cards");
  const moreEl = shell.querySelector(".studio-more");
  const continueBtn = shell.querySelector(".studio-continue");
  const priceEl = shell.querySelector(".studio-price-val");
  photoCanvas.width = CW;
  photoCanvas.height = CH;
  const pg = photoCanvas.getContext("2d");

  let view = "front";
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
    const next = mk(CW, CH);
    const g = next.getContext("2d");
    g.scale(RES, RES);
    try {
      ok = view === "back" ? drawBack(g, v, a) : view === "inside" ? drawInside(g, v, a) : drawFront(g, v, a);
    } catch (e) {
      ok = false;
      if (window.console) console.error(e);
    }
    if (ok) {
      // Swap in one go so a redraw never flickers.
      pg.clearRect(0, 0, CW, CH);
      pg.drawImage(next, 0, 0);
      anchors = a;
      canvasBox.classList.remove("loading");
    }
    renderMarkers();
    renderCards();
    syncChips();
    syncFoot();
  }

  // -- zoom & pan --
  // The picture is fitted into the frame, then scaled by zoom.s around the
  // point (zoom.cx, zoom.cy), which sits in the middle of the frame.
  let fit = { k: 1, w: 0, h: 0 };
  function measure() {
    const r = canvasBox.getBoundingClientRect();
    // On wider screens keep room at the sides for the zoom buttons.
    const side = r.width > 600 ? 70 : 0;
    fit = { w: r.width, h: r.height, k: Math.min((r.width - 2 * side) / VBW, r.height / VBH) || 1 };
  }
  function clampZoom(z) {
    const s = Math.max(1, Math.min(4, z.s));
    const k = fit.k * s;
    const halfW = fit.w / (2 * k), halfH = fit.h / (2 * k);
    const cx = VBW <= halfW * 2 ? VBW / 2 : Math.max(halfW, Math.min(VBW - halfW, z.cx));
    const cy = VBH <= halfH * 2 ? VBH / 2 : Math.max(halfH, Math.min(VBH - halfH, z.cy));
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
    art.style.height = VBH * fit.k + "px";
    const tx = fit.w / 2 - zoom.cx * k, ty = fit.h / 2 - zoom.cy * k;
    art.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + zoom.s.toFixed(4) + ")";
    positionMarkers();
    canvasBox.classList.toggle("zoomed", zoom.s > 1.01);
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
  function resetZoom() { animateZoom({ s: 1, cx: VBW / 2, cy: VBH / 2 }); }

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
    if (!keepZoom) { zoom = { s: 1, cx: VBW / 2, cy: VBH / 2 }; applyZoom(); }
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
      zoomTo(zoom.cx, zoom.cy, Math.max(1, Math.min(4, zoom.s * (z === "in" ? 1.5 : 1 / 1.5))));
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
  canvasBox.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom = clampZoom({ s: zoom.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), cx: zoom.cx, cy: zoom.cy });
    applyZoom();
  }, { passive: false });

  // -- the cards under the jacket --
  function swatchHtml(src, hex) {
    return '<span class="studio-card-swatch" style="background-color:' + esc(hex || "#333") + (src ? ";background-image:url('" + esc(src) + "')" : "") + '"></span>';
  }
  function cardVisual(area, v) {
    if (area.id === "fabric") {
      const f = opt("fabric", v._raw.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
      return swatchHtml(f && f.img, f && f.hex);
    }
    if (area.id === "lining") {
      const o = opt("lining", v._raw.lining);
      if (o && o.img && !o.matchesFabric && !o.uploadPhoto) return swatchHtml(o.img, o.hex);
      const f = opt("fabric", v._raw.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
      return '<span class="studio-card-swatch drape" style="background-color:' + esc(o && o.uploadPhoto ? "#8a8378" : f ? mix(f.hex, "#ffffff", 0.1) : "#5C2430") + '"></span>';
    }
    return '<span class="studio-card-icon">' + (ICONS[area.id] || ICONS.more) + "</span>";
  }
  function renderCards() {
    const v = current();
    const cards = CARD_AREAS.map(areaById).filter((a) => a && shownKeys(a).length);
    cardsEl.innerHTML = cards.map((a) => {
      const k = shownKeys(a)[0];
      const val = D.displayValue(k);
      return '<button type="button" class="studio-card' + (openArea === a.id ? " active" : "") + '" data-area="' + a.id + '">' +
        cardVisual(a, v) + '<span class="studio-card-name">' + esc(a.label) + '</span><span class="studio-card-val' + (val ? "" : " missing") + '">' + esc(val || "Choose") + "</span></button>";
    }).join("");
    const more = MORE_AREAS.map(areaById).filter((a) => a && shownKeys(a).length);
    moreEl.innerHTML = more.length
      ? '<span class="studio-more-label">More details</span>' + more.map((a) => '<button type="button" class="studio-more-link' + (openArea === a.id ? " active" : "") + '" data-area="' + a.id + '">' + esc(a.label) + "</button>").join("")
      : "";
    shell.querySelectorAll(".studio-card, .studio-more-link").forEach((b) => { b.onclick = () => openAreaPanel(b.dataset.area); });
  }

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
    const dbNote = openKey === "frontbutton" && /^Double/.test(String(raw || "")) ? "The photo keeps a single breasted front; your buttons are placed to show the layout." : "";
    const msg = nv || dbNote || (!raw ? "Not chosen yet. The jacket shows a classic look until you pick." : "");
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
    renderCards();
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
    applyZoom();
    if (zoom.s > 1.01) resetZoom();
    renderMarkers();
    renderCards();
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

  // ---- Modes ------------------------------------------------------------------------
  function getMode() {
    try { return sessionStorage.getItem(MODE_KEY) === "interactive" ? "interactive" : "browse"; } catch (e) { return "browse"; }
  }
  let mode = getMode();
  function setMode(m) {
    mode = m;
    try { sessionStorage.setItem(MODE_KEY, m); } catch (e) { /* not fatal */ }
    renderModeBars();
    place();
  }
  const ICON_LIST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>';
  const ICON_CLICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9l5 12 1.8-5.2L21 14z"/><path d="M7.2 2.2L8 5.1M2.2 7.2L5.1 8M12.5 3.8l-2.1 2.1M3.8 12.5l2.1-2.1"/></svg>';
  function modeBarHtml(active) {
    return '<div class="studio-modes" role="tablist" aria-label="How to customize">' +
      '<button type="button" role="tab" data-mode="browse" class="' + (active === "browse" ? "active" : "") + '" aria-selected="' + (active === "browse") + '">' + ICON_LIST + "<span>Browse Options</span></button>" +
      '<button type="button" role="tab" data-mode="interactive" class="' + (active === "interactive" ? "active" : "") + '" aria-selected="' + (active === "interactive") + '">' + ICON_CLICK + "<span>Interactive Jacket</span></button>" +
      "</div>";
  }
  function renderModeBars() {
    if (homeModeBar) {
      homeModeBar.innerHTML = modeBarHtml("interactive");
      homeModeBar.querySelector('[data-mode="browse"]').onclick = () => {
        closePanel();
        setMode("browse");
        if (typeof startDesigning === "function") startDesigning();
      };
    }
    if (designerModeBar) {
      designerModeBar.innerHTML = modeBarHtml(mode);
      designerModeBar.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          if (b.dataset.mode === mode) return;
          closePanel();
          setMode(b.dataset.mode);
          const sec = document.getElementById("designer");
          if (sec && typeof scrollToStepTop === "function") scrollToStepTop(sec);
        };
      });
    }
  }

  // Shows the jacket where it belongs right now: the homepage (before
  // designing), or the Jacket page in Interactive Jacket mode.
  function place() {
    const jacketSec = document.getElementById("designer");
    const designing = document.body.classList.contains("designing");
    const onJacketPage = designing && jacketSec && jacketSec.classList.contains("active");
    let next = null;
    if (!designing) next = "home";
    else if (onJacketPage && mode === "interactive") next = "designer";
    if (jacketSec) jacketSec.classList.toggle("studio-on", onJacketPage && mode === "interactive");
    if (next === context) return;
    closePanel();
    context = next;
    D.setReviewRowHandler(context === "designer" ? (k) => {
      const area = AREAS.find((a) => a.keys.indexOf(k) !== -1);
      if (area) openAreaPanel(area.id, k);
    } : null);
    if (context === "home" && shell.parentNode !== homeHost) homeHost.appendChild(shell);
    if (context === "designer" && shell.parentNode !== designerHost) designerHost.appendChild(shell);
    if (context) { applyZoom(); draw(); }
  }

  D.onChange(() => { if (context) scheduleDraw(); });
  renderModeBars();
  if (window.MutationObserver) {
    const mo = new MutationObserver(() => place());
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const jacketSec = document.getElementById("designer");
    if (jacketSec) mo.observe(jacketSec, { attributes: true, attributeFilter: ["class"] });
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (context) applyZoom(); }).observe(canvasBox);
  else window.addEventListener("resize", applyZoom);
  place();
  // For testing in the browser console.
  window.jacketStudio = { open: openAreaPanel, close: closePanel, setView: setView, setMode: setMode, draw: draw, zoomTo: zoomTo };
})();
