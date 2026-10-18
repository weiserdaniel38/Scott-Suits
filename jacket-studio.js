// ============================================================
// INTERACTIVE JACKET ("Interactive Jacket" mode)
// A drawn jacket the customer can click to customize, shown on the homepage
// and, as an alternative to the step-by-step questions, on the Jacket page.
//
// It keeps NO selections of its own. Everything it shows is read from the
// jacket designer (jacketDesigner in main.js), and every pick is made with the
// designer's own option cards: clicking a part of the jacket moves the
// designer's options element into this panel (embedOptions) for the
// questions that part covers. So both modes always share one set of answers,
// the same catalog (catalog.js), the same prices and the same order data, and
// a fabric or style added to the catalog shows up here by itself.
//
// The drawing is a layered SVG built from the current answers. Unanswered
// questions are drawn with a classic look (PREVIEW_DEFAULTS) without being
// saved. Fabrics are painted with assets/jacket-tex-*.webp (seamless tiles
// made from the fabric zoom photos by scripts/make_jacket_textures.py), or
// the fabric's own thumbnail when no tile exists yet.
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
  const VBW = 600;
  const VBH = 720;
  const MODE_KEY = "scottSuitsDesignMode";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // view: where the part is drawn. keys: designer questions, in order. Any
  // jacket question not listed here is collected under "More details"
  // automatically, so nothing in the catalog is ever unreachable.
  const AREAS = [
    { id: "fabric", label: "Fabric", view: "front", keys: ["fabric"], at: { front: [226, 384], back: [300, 330] } },
    { id: "lapel", label: "Lapel", view: "front", keys: ["collar", "lapelwidth"], at: { front: "lapelL" } },
    { id: "lapelhole", label: "Lapel Buttonhole", view: "front", keys: ["lapelbuttonhole", "buttonholeThreadColor"], at: { front: "lapelHole" } },
    { id: "chest", label: "Chest Pocket", view: "front", keys: ["pockettype"], at: { front: [384, 200] } },
    { id: "buttons", label: "Front Buttons", view: "front", keys: ["frontbutton", "buttoncolor", "threadColor", "buttonNail", "frontButtonholeThreadColor"], at: { front: "topButton" } },
    { id: "lower", label: "Lower Pockets", view: "front", keys: ["lowerpocket"], at: { front: [376, 474] } },
    { id: "cuff", label: "Sleeve Cuffs", view: "front", keys: ["sleevecuffstyle", "cuffbuttons"], at: { front: "cuff", back: "cuffBack" }, zoom: { front: [492, 500, 2.4], back: [436, 500, 2.4] } },
    { id: "shoulder", label: "Shoulders & Structure", view: "front", keys: ["sleevecrown", "construction"], at: { front: [446, 112], back: [154, 112] } },
    { id: "inside", label: "Lining & Inside", view: "inside", keys: ["lining", "facing", "insidepocket"], at: { front: "opening" } },
    { id: "vents", label: "Back Vents", view: "back", keys: ["backvent"], at: { back: [300, 566] } },
    { id: "collar", label: "Under Collar", view: "back", keys: ["feltundercollar", "feltColor"], at: { back: [300, 58], inside: [300, 56] } },
    { id: "lining", label: "Lining", view: "inside", keys: ["lining"], at: { inside: [300, 400] } },
    { id: "facing", label: "Facing Style", view: "inside", keys: ["facing"], at: { inside: [136, 430] } },
    { id: "ipocket", label: "Inside Pockets", view: "inside", keys: ["insidepocket"], at: { inside: [410, 256] } },
    { id: "monogram", label: "Monogram", view: "inside", keys: ["monogram", "monogramThreadColor"], at: { inside: [190, 300] } },
  ];
  // The questions above, plus anything new in the catalog.
  const mapped = {};
  AREAS.forEach((a) => a.keys.forEach((k) => { mapped[k] = true; }));
  const extraKeys = D.keys.filter((k) => !mapped[k]);
  if (extraKeys.length) AREAS.push({ id: "more", label: "More Details", view: "front", keys: extraKeys, at: {} });
  // Parts listed in the panel's menu (the narrower interior parts are
  // reached from the jacket itself or from "Lining & Inside").
  const MENU_AREAS = ["fabric", "lapel", "lapelhole", "buttons", "chest", "lower", "cuff", "vents", "inside", "monogram", "collar", "shoulder", "more"];
  // Questions that don't change the outside of the jacket: the panel says so
  // instead of the drawing inventing a look for them.
  const NON_VISUAL = {
    construction: "Construction is the hidden structure inside the chest. It changes how the jacket drapes and wears in, not how it looks in this drawing.",
    feltundercollar: "The felt sits under the collar, against your shirt. Turn to the back or inside view to see it.",
    buttonNail: "Shown on the front buttons up close. Use + to zoom in.",
    sleevecrown: "Shows where the sleeve meets the shoulder. Naples sleeves get small gathers at the top of the sleeve.",
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
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  const f1 = (n) => Math.round(n * 10) / 10;
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

  // ---- Fabric / lining paint ---------------------------------------------
  const texState = {}; // url -> "ok" | "bad" | "loading"
  function texUrlFor(fabricOpt) {
    return fabricOpt && fabricOpt.img ? fabricOpt.img.replace("jacket-fabric-", "jacket-tex-").replace(/\.jpg$/, ".webp") : null;
  }
  function ensureTexture(url) {
    if (!url || texState[url]) return;
    texState[url] = "loading";
    const im = new Image();
    im.onload = () => { texState[url] = "ok"; scheduleDraw(); };
    im.onerror = () => { texState[url] = "bad"; scheduleDraw(); };
    im.src = url;
  }
  // One swatch of cloth is ~8 cm wide; the drawing is ~5.2 units per cm.
  const CLOTH = 44;
  function fabricPatternDefs(id, fabricOpt, rotate, darken) {
    const hex = (fabricOpt && fabricOpt.hex) || "#1F2B4D";
    const tex = texUrlFor(fabricOpt);
    ensureTexture(tex);
    const tf = rotate ? ' patternTransform="rotate(' + f1(rotate) + ')"' : "";
    let body;
    if (tex && texState[tex] === "ok") {
      body = '<image href="' + tex + '" width="' + CLOTH * 2 + '" height="' + CLOTH * 2 + '" preserveAspectRatio="none"/>';
      return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + CLOTH * 2 + '" height="' + CLOTH * 2 + '"' + tf + '>' +
        '<rect width="' + CLOTH * 2 + '" height="' + CLOTH * 2 + '" fill="' + hex + '"/>' + body +
        (darken ? '<rect width="' + CLOTH * 2 + '" height="' + CLOTH * 2 + '" fill="#000" opacity="' + darken + '"/>' : "") + "</pattern>";
    }
    // Thumbnail fallback: show only the cloth inside the pinked edges.
    const t = CLOTH;
    body = fabricOpt && fabricOpt.img
      ? '<image href="' + fabricOpt.img + '" x="' + f1(-t * 0.14) + '" y="' + f1(-t * 0.14) + '" width="' + f1(t * 1.28) + '" height="' + f1(t * 1.28) + '" preserveAspectRatio="none"/>'
      : "";
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + t + '" height="' + t + '"' + tf + '>' +
      '<rect width="' + t + '" height="' + t + '" fill="' + hex + '"/>' + body +
      (darken ? '<rect width="' + t + '" height="' + t + '" fill="#000" opacity="' + darken + '"/>' : "") + "</pattern>";
  }
  function imagePatternDefs(id, img, hex, size) {
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + size + '" height="' + size + '">' +
      '<rect width="' + size + '" height="' + size + '" fill="' + (hex || "#555") + '"/>' +
      (img ? '<image href="' + esc(img) + '" width="' + size + '" height="' + size + '" preserveAspectRatio="xMidYMid slice"/>' : "") + "</pattern>";
  }

  // Thread / button colors. "Match Fabric Color" follows the cloth.
  function threadHex(key, v, fabricHex) {
    const o = opt(key, v[key]);
    if (o && o.hex) return o.hex;
    return lum(fabricHex) < 60 ? mix(fabricHex, "#000000", 0.25) : mix(fabricHex, "#000000", 0.35);
  }
  function feltHex(v, fabricHex) {
    if (v.feltundercollar === "Customer-Appointed Felt") {
      const o = opt("feltColor", v._raw.feltColor);
      if (o && o.hex) return o.hex;
    }
    return mix(fabricHex, "#000000", 0.18);
  }

  // ---- Geometry -------------------------------------------------------------
  // Front closure: break point (where the lapels end), button positions, and
  // how far the top front panel crosses over (bigger on double breasted).
  function frontLayout(name) {
    const n = String(name || "");
    const sb = (rows, rollY) => ({ db: false, ov: 4, rollY: rollY, buttons: rows.map((y) => ({ x: 300, y: y, hole: true })) });
    if (/^Single Breasted One/.test(n)) return sb([382], 374);
    if (/^Single Breasted Three/.test(n)) return sb([312, 374, 436], 304);
    if (/^Single Breasted/.test(n)) return sb([360, 438], 352);
    // Double breasted: [y, half-gap, fastens] rows; rollY = where lapels end.
    const DB = {
      "Double Breasted 6X2": { rows: [[300, 54, false], [364, 34, true], [428, 34, false]], roll: 364 },
      "Double Breasted 4X2": { rows: [[364, 34, true], [428, 34, false]], roll: 364 },
      "Double Breasted 6X3": { rows: [[306, 34, true], [368, 34, false], [430, 34, false]], roll: 306 },
      "Double Breasted 4X1": { rows: [[350, 50, false], [422, 34, true]], roll: 422 },
      "Double Breasted One Button": { rows: [[410, 34, true]], roll: 410, leftOnly: true },
      "Double Breasted 2X1": { rows: [[410, 34, true]], roll: 410 },
      "Double Breasted 6X1": { rows: [[302, 54, false], [362, 34, false], [422, 34, true]], roll: 422 },
    };
    const d = DB[n] || DB["Double Breasted 6X2"];
    const buttons = [];
    d.rows.forEach((r) => {
      buttons.push({ x: 300 - r[1], y: r[0], hole: r[2] });
      if (!d.leftOnly) buttons.push({ x: 300 + r[1], y: r[0], hole: false });
    });
    return { db: true, ov: 72, rollY: d.roll, buttons: buttons };
  }
  const LAPEL_W = { "8 cm": 40, "9 cm": 46, "10 cm": 53, "11 cm": 60 };

  // A lapel in its own coordinates: s along the roll line (0 = break point,
  // 1 = neck), w outward from it.
  function lapelFrame(T, Nk, side) {
    const dx = Nk[0] - T[0], dy = Nk[1] - T[1];
    const L = Math.hypot(dx, dy);
    const u = [dx / L, dy / L];
    let n = [u[1], -u[0]];
    if (Math.sign(n[0]) !== side) n = [-n[0], -n[1]];
    const pt = (s, w) => [T[0] + u[0] * s * L + n[0] * w, T[1] + u[1] * s * L + n[1] * w];
    return { pt: pt, u: u, n: n, L: L, angle: Math.atan2(dy, dx) * 180 / Math.PI };
  }
  const P = (p) => f1(p[0]) + "," + f1(p[1]);
  const PANTS = '<path d="M212,540 L298,540 L296,720 L222,720 Z M302,540 L388,540 L378,720 L304,720 Z" fill="url(#jsFabDark)"/>' +
    '<path d="M212,552 L388,552" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>' +
    '<path d="M258,580 L260,720 M342,580 L340,720" stroke="#fff" stroke-opacity="0.08" stroke-width="1"/>';
  function lapelPaths(style, fr, W, O, Nk) {
    const p = fr.pt;
    const out = { lapel: "", collar: "", hole: p(0.72, W * 0.5), tip: p(0.75, W) };
    if (style === "Shawl") {
      out.lapel = "M" + P(p(0, 0)) + " C" + P(p(0.25, W * 0.55)) + " " + P(p(0.55, W * 1.02)) + " " + P(p(0.8, W * 0.96)) +
        " C" + P(p(0.95, W * 0.9)) + " " + P([O[0], O[1] + 14]) + " " + P(O) + " L" + P(Nk) + " Z";
      out.hole = p(0.66, W * 0.52);
      return out;
    }
    if (style === "Diamond Lapel") {
      out.lapel = "M" + P(p(0, 0)) + " L" + P(p(0.66, W * 1.06)) + " L" + P(p(0.9, W * 0.74)) +
        " Q" + P(p(1.0, W * 0.62)) + " " + P(O) + " L" + P(Nk) + " Z";
      out.hole = p(0.64, W * 0.55);
      return out;
    }
    if (style === "Peak Lapel") {
      out.lapel = "M" + P(p(0, 0)) + " C" + P(p(0.22, W * 0.5)) + " " + P(p(0.5, W * 0.98)) + " " + P(p(0.7, W * 1.04)) +
        " L" + P(p(0.93, W * 1.24)) + " L" + P(p(0.835, 0)) + " Z";
      out.collar = "M" + P(p(0.85, 0)) + " L" + P(p(0.885, W * 0.62)) + " C" + P(p(0.95, W * 0.66)) + " " + P([O[0], O[1] + 10]) + " " + P(O) + " L" + P(Nk) + " Z";
      out.tip = p(0.93, W * 1.24);
      return out;
    }
    // Notch (and anything new: a classic notch is the safest drawing).
    out.lapel = "M" + P(p(0, 0)) + " C" + P(p(0.22, W * 0.5)) + " " + P(p(0.5, W * 0.97)) + " " + P(p(0.72, W)) +
      " L" + P(p(0.79, W * 1.02)) + " L" + P(p(0.87, 0)) + " Z";
    out.collar = "M" + P(p(0.875, 0)) + " L" + P(p(0.835, W * 0.42)) + " L" + P(p(0.85, W * 0.8)) +
      " C" + P(p(0.94, W * 0.78)) + " " + P([O[0], O[1] + 10]) + " " + P(O) + " L" + P(Nk) + " Z";
    out.tip = p(0.79, W * 1.02);
    return out;
  }

  // ---- Drawing pieces --------------------------------------------------------
  function buttonSvg(x, y, r, look, threadHexV, nail) {
    const id = "b" + Math.round(x) + "_" + Math.round(y);
    const face = look.img
      ? '<clipPath id="' + id + '"><circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + r + '"/></clipPath>' +
        '<image href="' + esc(look.img) + '" x="' + f1(x - r * 1.12) + '" y="' + f1(y - r * 1.12) + '" width="' + f1(r * 2.24) + '" height="' + f1(r * 2.24) + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid slice"/>'
      : '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + r + '" fill="' + look.hex + '"/>' +
        '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r * 0.78) + '" fill="none" stroke="' + mix(look.hex, "#000000", 0.35) + '" stroke-width="0.8"/>';
    const h = r * 0.3;
    let thread = "";
    const th = 'stroke="' + threadHexV + '" stroke-width="' + f1(r * 0.16) + '" stroke-linecap="round"';
    if (nail === "II Shape Sewing Button") {
      thread = '<path d="M' + P([x - h, y - h]) + " L" + P([x - h, y + h]) + " M" + P([x + h, y - h]) + " L" + P([x + h, y + h]) + '" ' + th + "/>";
    } else if (nail === "Hand Shape Sewing Button") {
      thread = '<path d="M' + P([x - h, y + h]) + " L" + P([x, y - h]) + " L" + P([x + h, y + h]) + " M" + P([x, y - h]) + " L" + P([x, y + h]) + '" ' + th + "/>";
    } else {
      thread = '<path d="M' + P([x - h, y - h]) + " L" + P([x + h, y + h]) + " M" + P([x + h, y - h]) + " L" + P([x - h, y + h]) + '" ' + th + "/>";
    }
    return '<g class="js-button"><circle cx="' + f1(x + 0.8) + '" cy="' + f1(y + 1.4) + '" r="' + r + '" fill="#000" opacity="0.35" filter="url(#jsSoft2)"/>' +
      face + '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + r + '" fill="url(#jsBtnShade)"/>' + thread + "</g>";
  }
  function buttonLook(v, fabricHex) {
    const o = opt("buttoncolor", v._raw.buttoncolor);
    if (o && o.img && !o.matchesFabric) return { img: o.img, hex: o.hex || "#3a302a" };
    return { img: null, hex: lum(fabricHex) > 150 ? mix(fabricHex, "#3b2f26", 0.55) : mix(fabricHex, "#2a221d", 0.55) };
  }
  // A buttonhole: thread-colored keyhole, drawn as a short bar.
  function holeSvg(a, b, hex, w) {
    return '<path d="M' + P(a) + " L" + P(b) + '" stroke="' + hex + '" stroke-width="' + (w || 2.6) + '" stroke-linecap="round"/>' +
      '<path d="M' + P(a) + " L" + P(b) + '" stroke="#000" stroke-opacity="0.45" stroke-width="0.7" stroke-linecap="round"/>' +
      '<circle cx="' + f1(a[0]) + '" cy="' + f1(a[1]) + '" r="' + f1((w || 2.6) * 0.62) + '" fill="' + hex + '"/>';
  }
  // Welt / besom / flap / patch pocket centered at (cx, cy), w wide, angle deg.
  function pocketSvg(kind, cx, cy, w, angle, fill, extra) {
    extra = extra || {};
    const tr = ' transform="translate(' + f1(cx) + "," + f1(cy) + ") rotate(" + f1(angle || 0) + ')"';
    const hw = w / 2;
    const line = "rgba(0,0,0,0.55)";
    const hi = "rgba(255,255,255,0.14)";
    let s = "";
    if (kind === "sb") {
      s = '<rect x="' + -hw + '" y="-1.6" width="' + w + '" height="3.4" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<path d="M' + -hw + ",-1.6 L" + hw + ',-1.6" stroke="#000" stroke-opacity="0.7" stroke-width="1.2"/>';
    } else if (kind === "db") {
      s = '<rect x="' + -hw + '" y="-3.2" width="' + w + '" height="6.4" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<path d="M' + -hw + ",0 L" + hw + ',0" stroke="#000" stroke-opacity="0.75" stroke-width="1.1"/>' +
        '<path d="M' + -hw + ",-2.6 L" + hw + ',-2.6" stroke="' + hi + '" stroke-width="0.7"/>';
    } else if (kind === "welt") {
      const h = extra.h || 8;
      s = '<rect x="' + -hw + '" y="' + -h / 2 + '" width="' + w + '" height="' + h + '" rx="0.6" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<rect x="' + (-hw + 1.6) + '" y="' + (-h / 2 + 1.6) + '" width="' + (w - 3.2) + '" height="' + (h - 3.2) + '" fill="none" stroke="' + hi + '" stroke-width="0.6" stroke-dasharray="1.6 1.2"/>' +
        '<path d="M' + (-hw + 1) + "," + (h / 2 + 0.8) + " L" + (hw - 1) + "," + (h / 2 + 0.8) + '" stroke="#000" stroke-opacity="0.35" stroke-width="1.4" filter="url(#jsSoft1)"/>';
    } else if (kind === "boat") {
      const h = 9;
      const d = "M" + -hw + "," + (-h / 2 + 2) + " Q0," + (-h / 2 - 1.5) + " " + hw + "," + (-h / 2 + 2) + " L" + (hw - 2) + "," + h / 2 + " Q0," + (h / 2 + 2) + " " + (-hw + 2) + "," + h / 2 + " Z";
      s = '<path d="' + d + '" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<path d="' + d + '" fill="none" stroke="' + hi + '" stroke-width="0.6" stroke-dasharray="1.6 1.2" transform="scale(0.9)"/>';
    } else if (kind === "flap") {
      const h = extra.h || 22;
      const r = 5;
      const d = "M" + -hw + ",0 L" + hw + ",0 L" + hw + "," + (h - r) + " Q" + hw + "," + h + " " + (hw - r) + "," + h + " L" + (-hw + r) + "," + h + " Q" + -hw + "," + h + " " + -hw + "," + (h - r) + " Z";
      s = '<path d="' + d + '" fill="#000" opacity="0.45" filter="url(#jsSoft2)" transform="translate(0.8,2.4)"/>' +
        '<path d="M' + -hw + ",-2.6 L" + hw + ',-2.6 L' + hw + ",0 L" + -hw + ',0 Z" fill="' + fill + '" stroke="' + line + '" stroke-width="0.8"/>' +
        '<path d="' + d + '" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<path d="' + d + '" fill="url(#jsFlapShade)"/>' +
        '<path d="M' + (-hw + 2.4) + ",2 L" + (-hw + 2.4) + "," + (h - r) + " Q" + (-hw + 2.4) + "," + (h - 2.4) + " " + (-hw + r + 1) + "," + (h - 2.4) + " L" + (hw - r - 1) + "," + (h - 2.4) + " Q" + (hw - 2.4) + "," + (h - 2.4) + " " + (hw - 2.4) + "," + (h - r) + " L" + (hw - 2.4) + ',2" fill="none" stroke="' + hi + '" stroke-width="0.6" stroke-dasharray="1.6 1.2"/>';
    } else if (kind === "patch" || kind === "curvedpatch" || kind === "highpatch") {
      const h = extra.h || 64;
      const r = kind === "curvedpatch" ? 22 : 7;
      const back = kind === "highpatch" ? -8 * (extra.outward || 1) : 0;
      // outward: +1 when the jacket's side is to the right of the pocket.
      const tl = extra.outward === -1 ? back : 0, trr = extra.outward === 1 ? back : 0;
      const d = "M" + -hw + "," + tl + " L" + hw + "," + trr + " L" + hw + "," + (h - r) + " Q" + hw + "," + h + " " + (hw - r) + "," + h +
        " L" + (-hw + r) + "," + h + " Q" + -hw + "," + h + " " + -hw + "," + (h - r) + " Z";
      s = '<path d="' + d + '" fill="#000" opacity="0.35" filter="url(#jsSoft2)" transform="translate(0.6,2)"/>' +
        '<path d="' + d + '" fill="' + fill + '" stroke="' + line + '" stroke-width="0.9"/>' +
        '<path d="' + d + '" fill="url(#jsFlapShade)" opacity="0.6"/>' +
        '<path d="' + d + '" fill="none" stroke="' + hi + '" stroke-width="0.7" stroke-dasharray="1.8 1.4" transform="translate(0,2) scale(0.93)"/>' +
        '<path d="M' + (-hw + 1) + "," + (tl + 1.8) + " L" + (hw - 1) + "," + (trr + 1.8) + '" stroke="#000" stroke-opacity="0.3" stroke-width="1"/>';
    }
    return "<g" + tr + ">" + s + "</g>";
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
    const overlap = /Overlap/.test(n);
    const slant = /Slant/.test(n) || /Slant/.test(style);
    const working = /^Working/.test(style);
    return { count: none ? 0 : count, overlap: overlap, slant: slant, working: working };
  }

  function sharedDefs(v, fab, fabricHex, liningPaint) {
    return "<defs>" +
      fabricPatternDefs("jsFab", fab, 0) +
      fabricPatternDefs("jsFabSleeveL", fab, -3) +
      fabricPatternDefs("jsFabSleeveR", fab, 3) +
      fabricPatternDefs("jsFabLapelL", fab, 14) +
      fabricPatternDefs("jsFabLapelR", fab, -16) +
      fabricPatternDefs("jsFabDark", fab, 0, 0.35) +
      liningPaint +
      '<filter id="jsSoft1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>' +
      '<filter id="jsSoft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>' +
      '<filter id="jsSoft4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<filter id="jsSoft8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<linearGradient id="jsBodyShade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.42"/><stop offset="0.2" stop-color="#000" stop-opacity="0.1"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.03"/><stop offset="0.82" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></linearGradient>' +
      '<linearGradient id="jsBodyV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>' +
      '<linearGradient id="jsSleeveShade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.5"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.08"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.03"/><stop offset="0.8" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>' +
      '<linearGradient id="jsFlapShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>' +
      '<radialGradient id="jsBtnShade" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>' +
      '<linearGradient id="jsShirt" x1="0" x2="1"><stop offset="0" stop-color="#e9e4da"/><stop offset="0.5" stop-color="#f7f4ee"/><stop offset="1" stop-color="#e4ded3"/></linearGradient>' +
      '<linearGradient id="jsTie" x1="0" x2="1"><stop offset="0" stop-color="#4a1c26"/><stop offset="0.45" stop-color="#6a2a36"/><stop offset="1" stop-color="#3f1720"/></linearGradient>' +
      "</defs>";
  }
  function liningDefs(v, fabricHex) {
    const raw = v._raw.lining;
    const o = opt("lining", raw);
    if (o && o.uploadPhoto) {
      const photo = D.getLiningPhoto ? D.getLiningPhoto() : null;
      return imagePatternDefs("jsLining", photo, "#8a8378", 120);
    }
    if (o && o.img && !o.matchesFabric) return imagePatternDefs("jsLining", o.img, o.hex, 74);
    // "Match Fabric" (or not chosen yet): a satin a shade off the cloth.
    const hex = lum(fabricHex) < 70 ? mix(fabricHex, "#ffffff", 0.12) : mix(fabricHex, "#000000", 0.12);
    return '<pattern id="jsLining" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="' + hex + '"/><path d="M0,8 L8,0" stroke="#fff" stroke-opacity="0.06" stroke-width="1"/></pattern>';
  }

  // Geometry shared by every view.
  const NK_L = [275, 74], NK_R = [325, 74];
  const O_L = [250, 62], O_R = [350, 62];
  const BODY_L = "M258,64 C220,72 172,82 134,92 C152,150 166,205 178,232 C186,320 186,470 176,600";
  const BODY_R = "M342,64 C380,72 428,82 466,92 C448,150 434,205 422,232 C414,320 414,470 424,600";
  const SLEEVE_HEAD = "M142,88 C162,120 176,180 182,246 M458,88 C438,120 424,180 418,246";
  const NAPLES = '<g stroke="#000" stroke-opacity="0.35" stroke-width="0.9" fill="none"><path d="M148,96 l-4,12 M156,102 l-3,13 M164,112 l-2,12 M452,96 l4,12 M444,102 l3,13 M436,112 l2,12"/></g>';
  const SLEEVE_L = "M142,88 C112,100 100,140 98,192 C95,330 91,462 88,562 Q128,574 172,568 C174,450 178,332 182,246 C176,180 162,120 142,88 Z";
  function mirrorPath(d) {
    // Mirrors absolute "x,y" pairs across the center line (x -> 600 - x).
    return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => f1(VBW - parseFloat(x)) + "," + y);
  }
  function sleeveShading(d, patternId) {
    return '<path d="' + d + '" fill="url(#' + patternId + ')"/>' +
      '<path d="' + d + '" fill="url(#jsSleeveShade)"/>' +
      '<path d="' + d + '" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>';
  }
  function cuffSvg(side, v, look, threadV, holeHex, back) {
    // side -1: viewer's left sleeve. Buttons sit on the outer back edge.
    const c = cuffLayout(v);
    const baseX = side < 0 ? (back ? 164 : 100) : (back ? 436 : 500);
    const inward = side < 0 ? 1 : -1;
    let s = "";
    // Vent line (and, on a working cuff, an opening at the hem).
    const topY = 562 - (c.count || 4) * 11 - 12;
    s += '<path d="M' + f1(baseX - inward * 7) + ",566 L" + f1(baseX - inward * 7 + (c.slant ? inward * 2 : 0)) + "," + f1(topY) + '" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>';
    if (c.working) s += '<path d="M' + f1(baseX - inward * 7) + ",566 L" + f1(baseX - inward * 7) + ',554" stroke="#000" stroke-opacity="0.75" stroke-width="1.6"/>';
    const r = 4.6;
    const step = c.overlap ? 7.4 : 10.6;
    for (let i = 0; i < c.count; i++) {
      const y = 555 - i * step;
      const x = baseX + (c.slant ? inward * i * 1.6 : 0);
      s += holeSvg([x - inward * 1, y], [x - inward * 8.5, y], holeHex, 1.6);
      s += buttonSvg(x, y, r, look, threadV, v.buttonNail);
    }
    if (v.monogram && /Sleeve Cuff/.test(v.monogram) && ((side > 0) === /Left/.test(v.monogram)) && !back) {
      const mx = side < 0 ? 136 : 464;
      s += monogramText(mx, 522, v, 6, -2);
    }
    return s;
  }
  function monogramText(x, y, v, size, rot) {
    const t = (D.getTextsRaw().monogram || "").trim() || "ABC";
    const o = opt("monogramThreadColor", v._raw.monogramThreadColor);
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" font-family="\'Playfair Display\', Georgia, serif" font-style="italic" font-size="' + size + '" text-anchor="middle" fill="' + ((o && o.hex) || "#c9b48a") + '" transform="rotate(' + (rot || 0) + " " + f1(x) + " " + f1(y) + ')">' + esc(t.slice(0, 12)) + "</text>";
  }

  // ---- FRONT VIEW ---------------------------------------------------------------
  function drawFront(v, anchors) {
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fabricHex = fab.hex || "#1F2B4D";
    const lay = frontLayout(v.frontbutton);
    const W = LAPEL_W[v.lapelwidth] || 44;
    const T = [300 - lay.ov, lay.rollY];
    const look = buttonLook(v, fabricHex);
    const threadV = threadHex("threadColor", v, fabricHex);
    const holeHex = threadHex("frontButtonholeThreadColor", v, fabricHex);
    const lapelHoleHex = threadHex("buttonholeThreadColor", v, fabricHex);
    const lowY = lay.buttons.reduce((m, b) => Math.max(m, b.y), 0);
    let s = sharedDefs(v, fab, fabricHex, liningDefs(v, fabricHex));

    // Floor shadow and pants.
    s += '<ellipse cx="300" cy="704" rx="190" ry="12" fill="#000" opacity="0.12" filter="url(#jsSoft8)"/>';
    // Shirt and trousers seen below the buttoning point.
    s += '<path d="M250,' + (T[1] + 20) + ' L350,' + (T[1] + 20) + ' L350,548 L250,548 Z" fill="url(#jsShirt)"/>' +
      '<path d="M300,' + (T[1] + 20) + ' L300,548" stroke="#000" stroke-opacity="0.1"/>';
    s += PANTS;
    // Inside back of the neck, then the shirt and tie in the V.
    s += '<path d="M' + P(O_L) + " Q300,40 " + P(O_R) + " L" + P(NK_R) + " Q300,62 " + P(NK_L) + ' Z" fill="url(#jsLining)"/>';
    const vPath = "M" + P(NK_L) + " L" + P(T) + " L" + P(NK_R) + " Q300,62 " + P(NK_L) + " Z";
    s += '<clipPath id="jsV"><path d="' + vPath + '"/></clipPath>';
    s += '<g clip-path="url(#jsV)"><rect x="240" y="40" width="120" height="460" fill="url(#jsShirt)"/>' +
      '<path d="M300,' + (lay.rollY + 20) + ' L300,110" stroke="#000" stroke-opacity="0.08"/>' +
      '<path d="M290,96 L310,96 L306,114 L294,114 Z" fill="url(#jsTie)"/>' +
      '<path d="M294,114 L306,114 L318,' + (lay.rollY + 30) + " L300," + (lay.rollY + 46) + " L282," + (lay.rollY + 30) + ' Z" fill="url(#jsTie)"/>' +
      '<path d="M294,114 L306,114 L318,' + (lay.rollY + 30) + " L300," + (lay.rollY + 46) + " L282," + (lay.rollY + 30) + ' Z" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="0.8"/>' +
      '<path d="M278,74 L292,96 L284,124 L270,86 Z M322,74 L308,96 L316,124 L330,86 Z" fill="#f3efe7" stroke="#cfc8bb" stroke-width="0.8"/>' +
      "</g>";

    // Front panels. The viewer's right panel (wearer's left) is on top.
    const edgeTop = 300 - lay.ov; // visible front edge of the top panel
    const edgeUnder = 300 + lay.ov;
    let panelL, panelR;
    if (lay.db) {
      panelL = BODY_L + " Q240,616 " + edgeUnder + ",616 L" + edgeUnder + "," + T[1] + " L" + P(T) + " L" + P(NK_L) + " Z";
      panelR = BODY_R + " Q360,616 " + edgeTop + ",616 L" + edgeTop + "," + T[1] + " L" + P(NK_R) + " Z";
    } else {
      panelL = BODY_L + " Q206,612 238,614 C274,608 " + edgeUnder + "," + (lowY + 64) + " " + edgeUnder + "," + (lowY + 14) + " L" + edgeUnder + "," + T[1] + " L" + P(T) + " L" + P(NK_L) + " Z";
      panelR = BODY_R + " Q394,612 362,614 C326,608 " + edgeTop + "," + (lowY + 64) + " " + edgeTop + "," + (lowY + 14) + " L" + P(T) + " L" + P(NK_R) + " Z";
    }
    const panelShade = (d) => '<path d="' + d + '" fill="url(#jsFab)"/><path d="' + d + '" fill="url(#jsBodyV)"/>';
    s += '<g data-area="fabric">' + panelShade(panelL);
    // Drop shadow of the top panel onto the under one.
    s += '<path d="' + panelR + '" fill="#000" opacity="0.4" filter="url(#jsSoft4)" transform="translate(-3,2)"/>';
    s += panelShade(panelR) + "</g>";
    // Whole-body light (one gradient across both panels).
    s += '<clipPath id="jsBodyClip"><path d="' + panelL + '"/><path d="' + panelR + '"/></clipPath>';
    s += '<rect x="130" y="50" width="340" height="580" fill="url(#jsBodyShade)" clip-path="url(#jsBodyClip)" pointer-events="none"/>';
    // Seams: front darts and side panels.
    s += '<g fill="none" stroke="#000" stroke-opacity="0.32" stroke-width="1" pointer-events="none">' +
      '<path d="M218,232 C216,320 218,400 222,462 M382,232 C384,320 382,400 378,462"/>' +
      '<path d="M186,246 C194,370 192,500 184,606 M414,246 C406,370 408,500 416,606"/></g>';
    s += '<g fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1" pointer-events="none"><path d="M219.5,232 C217.5,320 219.5,400 223.5,462 M383.5,232 C385.5,320 383.5,400 379.5,462"/></g>';
    // Front edges (stitched).
    s += '<path d="' + panelR + '" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="1.1" pointer-events="none"/>';

    // Pockets.
    const lp = parseLowerPocket(v.lowerpocket);
    s += '<g data-area="lower">';
    [[-1, 224], [1, 376]].forEach(([side, cx]) => {
      // Slanted pockets dip toward the side seam.
      const a = lp.slant ? (side < 0 ? 9 : -9) : 0;
      if (lp.main === "flap") s += pocketSvg("flap", cx, 464, 76, a, "url(#jsFab)");
      else if (lp.main === "welt") s += pocketSvg("welt", cx, 474, 74, a, "url(#jsFab)");
      else if (lp.main === "sb" || lp.main === "db") s += pocketSvg(lp.main, cx, 474, 74, a, "url(#jsFab)");
      else if (/patch/.test(lp.main)) s += pocketSvg(lp.main, cx, 446, 80, 0, "url(#jsFab)", { h: 70, outward: side });
    });
    if (lp.ticket && lp.main !== "none") {
      const tx = 230, ty = lp.main === "flap" || /patch/.test(lp.main) ? 420 : 436;
      if (lp.ticket === "flap") s += pocketSvg("flap", tx, ty, 54, lp.slant ? 9 : 0, "url(#jsFab)", { h: 17 });
      else s += pocketSvg(lp.ticket, tx, ty + 6, 52, lp.slant ? 9 : 0, "url(#jsFab)");
    }
    s += "</g>";
    const ck = chestKind(v.pockettype);
    s += '<g data-area="chest">';
    if (ck === "patch") s += pocketSvg("patch", 386, 184, 52, 0, "url(#jsFab)", { h: 48 });
    else if (ck !== "none") s += pocketSvg(ck, 384, 200, 54, -7, "url(#jsFab)", { h: 9 });
    s += "</g>";

    // Lapels and collar.
    const style = v.collar;
    const frL = lapelFrame(T, NK_L, -1);
    const frR = lapelFrame(T, NK_R, 1);
    const L = lapelPaths(style, frL, W, O_L, NK_L);
    const R = lapelPaths(style, frR, W, O_R, NK_R);
    const lapelShade = (fr, id, W2) => {
      const a = fr.pt(0.55, 0), b = fr.pt(0.55, W2);
      return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '">' +
        '<stop offset="0" stop-color="#000" stop-opacity="0.4"/><stop offset="0.25" stop-color="#000" stop-opacity="0.08"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>';
    };
    s += "<defs>" + lapelShade(frL, "jsLapelShadeL", W) + lapelShade(frR, "jsLapelShadeR", W) + "</defs>";
    const lapelSvg = (P2, pat, shade) => {
      let o = "";
      if (P2.collar) o += '<path d="' + P2.collar + '" fill="#000" opacity="0.35" filter="url(#jsSoft2)" transform="translate(0,2)"/><path d="' + P2.collar + '" fill="url(#jsFab)"/><path d="' + P2.collar + '" fill="url(#jsBodyV)"/><path d="' + P2.collar + '" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="0.9"/>';
      o += '<path d="' + P2.lapel + '" fill="#000" opacity="0.45" filter="url(#jsSoft4)" transform="translate(0,3)"/>';
      o += '<path d="' + P2.lapel + '" fill="url(#' + pat + ')"/><path d="' + P2.lapel + '" fill="url(#' + shade + ')"/>';
      o += '<path d="' + P2.lapel + '" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1"/>';
      o += '<path d="' + P2.lapel + '" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.6" stroke-dasharray="1.4 1.6" transform="translate(0,0.8)"/>';
      return o;
    };
    s += '<g data-area="lapel">' + lapelSvg(L, "jsFabLapelL", "jsLapelShadeL") + lapelSvg(R, "jsFabLapelR", "jsLapelShadeR") + "</g>";
    // Collar band over the back of the neck.
    s += '<path d="M' + P(O_L) + " Q300,40 " + P(O_R) + " L" + f1(O_R[0] - 3) + "," + f1(O_R[1] + 5) + " Q300,48 " + f1(O_L[0] + 3) + "," + f1(O_L[1] + 5) + ' Z" fill="url(#jsFab)" stroke="#000" stroke-opacity="0.45" stroke-width="0.8"/>';

    // Lapel buttonholes.
    s += '<g data-area="lapelhole">' + lapelHolesSvg(v, frL, frR, L, R, W, lapelHoleHex) + "</g>";
    if (v.monogram === "Monogram Placement On Left Button") {
      const p = frR.pt(0.42, W * 0.45);
      s += monogramText(p[0], p[1], v, 7, frR.angle + 90);
    }

    // Front buttons and their buttonholes.
    s += '<g data-area="buttons">';
    lay.buttons.forEach((b) => {
      if (b.hole) s += holeSvg([b.x - 3, b.y], [b.x - 15, b.y], holeHex, 2.2);
      s += buttonSvg(b.x, b.y, 8.4, look, threadV, v.buttonNail);
    });
    s += "</g>";

    // Sleeves on top of the body sides, with cuff buttons.
    const sleeveR = mirrorPath(SLEEVE_L);
    s += '<g data-area="cuff">' + sleeveShading(SLEEVE_L, "jsFabSleeveL") + sleeveShading(sleeveR, "jsFabSleeveR");
    // Sleeve head line + Naples gathers.
    s += '<path d="' + SLEEVE_HEAD + '" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>';
    if (v.sleevecrown === "Naples Sleeve") s += NAPLES;
    else if (v.sleevecrown === "Close Seam Sleeve") s += '<path d="' + SLEEVE_HEAD + '" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.8" stroke-dasharray="1.4 1.4" transform="translate(1.5,2)"/>';
    s += cuffSvg(-1, v, look, threadV, holeHex, false) + cuffSvg(1, v, look, threadV, holeHex, false);
    s += "</g>";

    // Where the markers go.
    anchors.lapelL = frL.pt(0.5, W * 0.62);
    anchors.lapelHole = lapelHoleAnchor(v, frL, frR, L, R, W);
    anchors.topButton = [lay.buttons[0].x + (lay.db ? 0 : 0), lay.buttons[0].y];
    anchors.opening = [300, Math.max(T[1] - 70, 150)];
    anchors.cuff = [500, 516];
    return s;
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
  function lapelHolesSvg(v, frL, frR, L, R, W, hex) {
    // Wearer's left lapel = the viewer's right one.
    const h = lapelHolesFor(v);
    let s = "";
    const one = (fr, base, i) => {
      // Parallel-ish to the gorge: mostly across the lapel, tilted up.
      const c = [base[0] - fr.u[0] * i * 8, base[1] - fr.u[1] * i * 8];
      const dir = [fr.n[0] * 0.92 + fr.u[0] * 0.38, fr.n[1] * 0.92 + fr.u[1] * 0.38];
      const a = [c[0] - dir[0] * 7, c[1] - dir[1] * 7], b = [c[0] + dir[0] * 7, c[1] + dir[1] * 7];
      return holeSvg(b, a, hex, 2.2);
    };
    for (let i = 0; i < h.left; i++) s += one(frR, R.hole, i);
    for (let i = 0; i < h.right; i++) s += one(frL, L.hole, i);
    return s;
  }
  function lapelHoleAnchor(v, frL, frR, L, R, W) {
    const h = lapelHolesFor(v);
    if (!h.left && h.right) return L.hole;
    return R.hole;
  }

  // ---- BACK VIEW ----------------------------------------------------------------
  function drawBack(v, anchors) {
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fabricHex = fab.hex || "#1F2B4D";
    const look = buttonLook(v, fabricHex);
    const threadV = threadHex("threadColor", v, fabricHex);
    const holeHex = threadHex("frontButtonholeThreadColor", v, fabricHex);
    let s = sharedDefs(v, fab, fabricHex, liningDefs(v, fabricHex));
    s += '<ellipse cx="300" cy="704" rx="190" ry="12" fill="#000" opacity="0.12" filter="url(#jsSoft8)"/>';
    s += PANTS;
    const back = "M250,60 Q300,66 350,60 C384,72 430,82 466,92 C448,150 434,205 422,232 C414,320 414,470 424,600 Q300,622 176,600 C186,470 186,320 178,232 C166,205 152,150 134,92 C170,82 216,72 250,60 Z";
    s += '<g data-area="fabric"><path d="' + back + '" fill="url(#jsFab)"/><path d="' + back + '" fill="url(#jsBodyV)"/>' +
      '<path d="' + back + '" fill="url(#jsBodyShade)"/>' +
      '<path d="' + back + '" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/></g>';
    // Center back seam and side panels.
    s += '<g fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1" pointer-events="none"><path d="M300,64 C302,250 296,420 300,616"/>' +
      '<path d="M194,246 C202,370 200,500 192,606 M406,246 C398,370 400,500 408,606"/></g>';
    // Vents.
    s += '<g data-area="vents">';
    const vent = v.backvent;
    const ventAt = (x, bend, hem) => '<path d="M' + x + "," + hem + " L" + (x + bend) + ',506" stroke="#000" stroke-opacity="0.6" stroke-width="1.4"/>' +
      '<path d="M' + (x + 3) + "," + hem + " L" + (x + 3 + bend) + ',506" stroke="#fff" stroke-opacity="0.08" stroke-width="1"/>' +
      '<path d="M' + (x - 6) + ",508 L" + (x + 8) + ',500" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>' +
      '<path d="M' + x + "," + hem + " L" + (x + bend * 0.3) + "," + (hem - 40) + '" stroke="#000" stroke-opacity="0.35" stroke-width="5" filter="url(#jsSoft2)"/>';
    if (vent === "Center Vent") s += ventAt(300, 0, 615);
    else if (vent === "Side Vent") s += ventAt(193, 2, 604) + ventAt(407, -2, 604);
    s += '<rect x="170" y="496" width="260" height="124" fill="transparent"/></g>';
    // Collar.
    s += '<g data-area="collar"><path d="M246,54 Q300,32 354,54 L358,68 Q300,54 242,68 Z" fill="url(#jsFab)" stroke="#000" stroke-opacity="0.5" stroke-width="0.9"/>' +
      '<path d="M242,68 Q300,54 358,68" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="2" filter="url(#jsSoft1)"/></g>';
    // Sleeves seen from behind (mirror image) with the cuff buttons.
    const sl = mirrorPath(SLEEVE_L);
    s += '<g data-area="cuff">' + sleeveShading(SLEEVE_L, "jsFabSleeveL") + sleeveShading(sl, "jsFabSleeveR");
    s += '<path d="' + SLEEVE_HEAD + '" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>';
    if (v.sleevecrown === "Naples Sleeve") s += NAPLES;
    s += cuffSvg(-1, v, look, threadV, holeHex, true) + cuffSvg(1, v, look, threadV, holeHex, true);
    s += "</g>";
    anchors.cuffBack = [436, 516];
    return s;
  }

  // ---- INSIDE VIEW (jacket held open) -------------------------------------------
  function drawInside(v, anchors) {
    const fab = opt("fabric", v.fabric) || opt("fabric", PREVIEW_DEFAULTS.fabric);
    const fabricHex = fab.hex || "#1F2B4D";
    const facing = v.facing;
    const lined = facing !== "No Lining Construction";
    const half = facing === "Half Lining W/ Fabric Facing";
    const liningFill = "url(#jsLining)";
    const liningHex = (opt("lining", v._raw.lining) || {}).hex || fabricHex;
    const pipe = lined ? mix(liningHex, "#ffffff", 0.15) : mix(fabricHex, "#ffffff", 0.25);
    let s = sharedDefs(v, fab, fabricHex, liningDefs(v, fabricHex));
    s += '<ellipse cx="300" cy="704" rx="230" ry="12" fill="#000" opacity="0.12" filter="url(#jsSoft8)"/>';
    // Sleeves (outside) peeking at the sides.
    const sl = mirrorPath(SLEEVE_L);
    s += sleeveShading(SLEEVE_L, "jsFabSleeveL") + sleeveShading(sl, "jsFabSleeveR");
    // Inside of the back, between the opened fronts.
    const backIn = "M250,64 Q300,74 350,64 L422,232 C414,320 414,470 424,600 Q300,618 176,600 C186,470 186,320 178,232 Z";
    s += '<g data-area="lining"><path d="' + backIn + '" fill="' + (half || !lined ? "url(#jsFabDark)" : liningFill) + '"/>';
    if (half) s += '<path d="M250,64 Q300,74 350,64 L418,232 C398,296 336,320 300,322 C264,320 202,296 182,232 Z" fill="' + liningFill + '" stroke="' + pipe + '" stroke-width="1.6"/>';
    s += '<path d="' + backIn + '" fill="url(#jsBodyShade)"/>';
    // Center pleat of the lining.
    if (lined && !half) s += '<path d="M300,74 L300,610" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/><path d="M303,74 L303,610" stroke="#fff" stroke-opacity="0.12" stroke-width="1"/>';
    if (!lined || half) s += '<path d="M300,' + (half ? 322 : 74) + ' C302,450 298,540 300,612" stroke="' + pipe + '" stroke-width="1.6" fill="none"/>';
    s += "</g>";
    // The opened front panels: the outside edge is the front edge now.
    const panelL = "M258,64 C224,68 190,76 146,92 C124,160 114,260 112,380 C111,470 112,540 114,604 Q186,620 262,614 C266,470 268,320 272,200 C274,140 276,98 258,64 Z";
    const panelR = mirrorPath(panelL);
    // Facing: fabric strip along the front edge, widening into the lapel.
    const facingL = facing === "Round Shape Facing" || !lined
      ? "M258,64 C224,68 190,76 146,92 C124,160 114,260 112,380 C111,470 112,540 114,604 Q134,610 160,612 C158,540 158,440 160,340 C186,336 206,306 206,274 C206,240 186,214 160,212 C164,160 188,116 244,88 Z"
      : "M258,64 C224,68 190,76 146,92 C124,160 114,260 112,380 C111,470 112,540 114,604 Q134,610 160,612 C158,540 158,440 160,340 C160,240 170,150 244,88 Z";
    const facingR = mirrorPath(facingL);
    const panelInner = (d) => '<path d="' + d + '" fill="' + (lined && !half ? liningFill : "url(#jsFabDark)") + '"/>';
    s += '<g data-area="lining">' + panelInner(panelL) + panelInner(panelR);
    if (half) {
      const top = "M258,64 C224,68 190,76 146,92 C126,150 118,230 118,290 C170,312 230,310 270,292 C272,200 274,120 258,64 Z";
      s += '<path d="' + top + '" fill="' + liningFill + '" stroke="' + pipe + '" stroke-width="1.6"/><path d="' + mirrorPath(top) + '" fill="' + liningFill + '" stroke="' + pipe + '" stroke-width="1.6"/>';
    }
    s += "</g>";
    s += '<g data-area="facing"><path d="' + facingL + '" fill="url(#jsFab)"/><path d="' + facingR + '" fill="url(#jsFab)"/>' +
      '<path d="' + facingL + '" fill="none" stroke="' + pipe + '" stroke-width="1.5"/><path d="' + facingR + '" fill="none" stroke="' + pipe + '" stroke-width="1.5"/></g>';
    // Light and seams over the opened panels.
    s += '<path d="' + panelL + '" fill="url(#jsBodyShade)" pointer-events="none"/><path d="' + panelR + '" fill="url(#jsBodyShade)" pointer-events="none"/>';
    s += '<path d="' + panelL + '" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/><path d="' + panelR + '" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>';
    // Inside pockets.
    s += '<g data-area="ipocket">';
    const ip = String(v.insidepocket || "");
    const welt = (cx, cy, w) => pocketSvg("db", cx, cy, w, 0, "url(#jsLining)");
    s += welt(190, 256, 54) + welt(410, 256, 54);
    if (/Water Drop/.test(ip)) s += '<path d="M420,284 q6,-10 12,0 q0,10 -6,12 q-6,-2 -6,-12 Z" fill="url(#jsLining)" stroke="#000" stroke-opacity="0.5" stroke-width="0.8"/>';
    else s += pocketSvg("sb", 426, 288, 22, 0, "url(#jsLining)");
    if (/Cigarette/.test(ip)) s += welt(200, 410, 34);
    s += "</g>";
    // Felt under collar, seen from inside at the back of the neck.
    s += '<g data-area="collar"><path d="M250,56 Q300,40 350,56 L350,70 Q300,58 250,70 Z" fill="' + feltHex(v, fabricHex) + '" stroke="#000" stroke-opacity="0.45" stroke-width="0.8"/></g>';
    // Brand label on the back lining.
    s += '<rect x="282" y="96" width="36" height="16" rx="1.5" fill="#efe8dc" stroke="#000" stroke-opacity="0.2"/><text x="300" y="107" font-size="6" text-anchor="middle" fill="#6b5a3f" font-family="Montserrat, sans-serif" letter-spacing="0.6">SCOTT</text>';
    // Monogram where it was asked for.
    const mg = v.monogram;
    s += '<g data-area="monogram">';
    if (mg === "On Left Inside Pocket") s += monogramText(410, 280, v, 9);
    else if (mg === "On Right Inside Pocket") s += monogramText(190, 280, v, 9);
    else if (mg === "On Right Inside Pocket, Monogram On Satin") s += '<rect x="168" y="270" width="44" height="14" rx="1" fill="#f1ece2"/>' + monogramText(190, 280, v, 9);
    else if (mg === "Monogram On Middle Under Collar") s += monogramText(300, 66, v, 7);
    s += '<rect x="162" y="270" width="56" height="30" fill="transparent"/></g>';
    return s;
  }

  // ---- Studio UI ------------------------------------------------------------------
  const shell = document.createElement("div");
  shell.className = "studio-shell";
  shell.id = "jacketStudio";
  shell.innerHTML =
    '<div class="studio-stage">' +
      '<div class="studio-views" role="tablist" aria-label="Jacket view">' +
        '<button type="button" data-view="front" class="active">Front</button>' +
        '<button type="button" data-view="back">Back</button>' +
        '<button type="button" data-view="inside">Inside</button>' +
      "</div>" +
      '<div class="studio-canvas"><svg class="studio-svg" viewBox="0 0 600 720" role="img" aria-label="Your jacket"></svg><div class="studio-markers"></div></div>' +
      '<div class="studio-zoom">' +
        '<button type="button" data-zoom="out" aria-label="Zoom out">&minus;</button>' +
        '<button type="button" data-zoom="reset" aria-label="Reset view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></svg></button>' +
        '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>' +
      "</div>" +
      '<p class="studio-hint">Tap a <span class="studio-hint-dot" aria-hidden="true">+</span> on the jacket to change that part.</p>' +
    "</div>" +
    '<aside class="studio-panel" aria-live="polite">' +
      '<div class="studio-menu"></div>' +
      '<div class="studio-sheet" hidden>' +
        '<div class="studio-sheet-head"><div><div class="hiw-eyebrow studio-sheet-eyebrow">Customize</div><h3 class="studio-sheet-title"></h3></div>' +
          '<button type="button" class="studio-sheet-close" aria-label="Close">&times;</button></div>' +
        '<div class="studio-chips" role="tablist"></div>' +
        '<p class="studio-note" hidden></p>' +
        '<div class="studio-options designer-grid"></div>' +
        '<div class="studio-sheet-foot"><button type="button" class="btn-ghost studio-done">Done</button></div>' +
      "</div>" +
    "</aside>" +
    '<div class="studio-foot"><div class="studio-price"><span>Estimated total</span><b class="studio-price-val"></b></div>' +
      '<button type="button" class="btn-primary studio-continue"></button></div>';

  const svg = shell.querySelector(".studio-svg");
  const markersEl = shell.querySelector(".studio-markers");
  const canvas = shell.querySelector(".studio-canvas");
  const menuEl = shell.querySelector(".studio-menu");
  const sheetEl = shell.querySelector(".studio-sheet");
  const chipsEl = shell.querySelector(".studio-chips");
  const noteEl = shell.querySelector(".studio-note");
  const optsHost = shell.querySelector(".studio-options");
  const titleEl = shell.querySelector(".studio-sheet-title");
  const continueBtn = shell.querySelector(".studio-continue");
  const priceEl = shell.querySelector(".studio-price-val");

  let view = "front";
  let vb = { x: 0, y: 0, w: VBW, h: VBH };
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
    anchors = {};
    let body;
    try {
      body = view === "back" ? drawBack(v, anchors) : view === "inside" ? drawInside(v, anchors) : drawFront(v, anchors);
    } catch (e) {
      body = "";
    }
    svg.innerHTML = body;
    applyViewBox();
    renderMarkers();
    renderMenu();
    syncChips();
    syncFoot();
  }
  // The box actually shown: vb stretched to the canvas's own shape (the
  // canvas is shorter on phones while a part is open), so markers line up.
  let shown = { x: 0, y: 0, w: VBW, h: VBH };
  function applyViewBox() {
    const r = canvas.getBoundingClientRect();
    shown = Object.assign({}, vb);
    if (r.width > 0 && r.height > 0) {
      const ca = r.width / r.height, va = vb.w / vb.h;
      if (ca > va + 0.001) { shown.w = vb.h * ca; shown.x = vb.x - (shown.w - vb.w) / 2; }
      else if (ca < va - 0.001) { shown.h = vb.w / ca; shown.y = vb.y - (shown.h - vb.h) / 2; }
    }
    svg.setAttribute("viewBox", f1(shown.x) + " " + f1(shown.y) + " " + f1(shown.w) + " " + f1(shown.h));
    positionMarkers();
    canvas.classList.toggle("zoomed", vb.w < VBW - 1);
  }
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
      b.className = "studio-marker" + (openArea === area.id ? " active" : "");
      b.setAttribute("aria-label", area.label);
      b.dataset.x = pt[0];
      b.dataset.y = pt[1];
      b.innerHTML = '<span class="studio-marker-dot" aria-hidden="true"></span><span class="studio-marker-label">' + esc(area.label) + "</span>";
      b.onclick = (e) => { e.stopPropagation(); openAreaPanel(area.id); };
      markersEl.appendChild(b);
    });
    positionMarkers();
  }
  function positionMarkers() {
    markersEl.querySelectorAll(".studio-marker").forEach((b) => {
      const x = (parseFloat(b.dataset.x) - shown.x) / shown.w;
      const y = (parseFloat(b.dataset.y) - shown.y) / shown.h;
      const inside = x > 0.02 && x < 0.98 && y > 0.02 && y < 0.98;
      b.hidden = !inside;
      b.style.left = (x * 100).toFixed(2) + "%";
      b.style.top = (y * 100).toFixed(2) + "%";
      b.classList.toggle("label-left", x > 0.6);
    });
  }
  // Clicking the cloth itself opens that part too.
  svg.addEventListener("click", (e) => {
    if (dragMoved) return;
    const g = e.target.closest && e.target.closest("[data-area]");
    if (!g) return;
    const id = g.getAttribute("data-area");
    const area = areaById(id);
    if (area && shownKeys(area).length) openAreaPanel(id);
  });

  // -- views & zoom --
  function animateViewBox(target) {
    const from = Object.assign({}, vb);
    if (reduceMotion) { vb = target; applyViewBox(); return; }
    const t0 = performance.now();
    const dur = 420;
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyViewBox();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function clampVb(b) {
    const w = Math.min(VBW, Math.max(VBW / 4, b.w));
    const h = w * VBH / VBW;
    return { x: Math.min(VBW - w, Math.max(0, b.x)), y: Math.min(VBH - h, Math.max(0, b.y)), w: w, h: h };
  }
  function zoomTo(cx, cy, scale) {
    const w = VBW / scale, h = VBH / scale;
    animateViewBox(clampVb({ x: cx - w / 2, y: cy - h / 2, w: w, h: h }));
  }
  function resetZoom() { animateViewBox({ x: 0, y: 0, w: VBW, h: VBH }); }
  function setView(next, keepZoom) {
    if (next === view) return;
    view = next;
    shell.querySelectorAll(".studio-views button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
      b.setAttribute("aria-selected", b.dataset.view === view ? "true" : "false");
    });
    if (!keepZoom) { vb = { x: 0, y: 0, w: VBW, h: VBH }; }
    draw();
  }
  shell.querySelectorAll(".studio-views button").forEach((b) => { b.onclick = () => setView(b.dataset.view); });
  shell.querySelectorAll(".studio-zoom button").forEach((b) => {
    b.onclick = () => {
      const z = b.dataset.zoom;
      if (z === "reset") return resetZoom();
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      const scale = VBW / vb.w * (z === "in" ? 1.5 : 1 / 1.5);
      zoomTo(cx, cy, Math.max(1, Math.min(4, scale)));
    };
  });
  // Drag to look around while zoomed in.
  let drag = null;
  let dragMoved = false;
  canvas.addEventListener("pointerdown", (e) => {
    dragMoved = false;
    if (vb.w >= VBW - 1 || e.target.closest(".studio-marker")) return;
    drag = { x: e.clientX, y: e.clientY, vb: Object.assign({}, vb), id: e.pointerId };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - drag.x) / rect.width * drag.vb.w;
    const dy = (e.clientY - drag.y) / rect.height * drag.vb.h;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) dragMoved = true;
    vb = clampVb({ x: drag.vb.x - dx, y: drag.vb.y - dy, w: drag.vb.w, h: drag.vb.h });
    applyViewBox();
  });
  window.addEventListener("pointerup", () => { drag = null; setTimeout(() => { dragMoved = false; }, 0); });

  // -- the panel --
  function renderMenu() {
    const items = MENU_AREAS.map(areaById).filter((a) => a && shownKeys(a).length);
    menuEl.innerHTML =
      '<div class="hiw-eyebrow">Your jacket</div><h3 class="studio-menu-title">Choose a part to change</h3>' +
      '<div class="studio-menu-list">' +
      items.map((a) => {
        const k = shownKeys(a)[0];
        const val = D.displayValue(k);
        return '<button type="button" class="studio-menu-row" data-area="' + a.id + '"><span>' + esc(a.label) + '</span><span class="' + (val ? "" : "missing") + '">' + esc(val || "Choose") + "</span></button>";
      }).join("") +
      "</div>";
    menuEl.querySelectorAll(".studio-menu-row").forEach((b) => { b.onclick = () => openAreaPanel(b.dataset.area); });
  }
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
    menuEl.hidden = true;
    sheetEl.hidden = false;
    shell.classList.add("sheet-open");
    // Turn the jacket to where the part is, and lean in on small details.
    if (area.view !== view && !(area.at && area.at[view])) setView(area.view);
    else if (id === "inside") setView("inside");
    const z = area.zoom && area.zoom[view];
    const phone = window.innerWidth <= 900;
    if (z) zoomTo(z[0], z[1], z[2]);
    else if (phone) {
      // Small screen: lean in on the part so it stays visible above the sheet.
      const pt = anchorFor(area);
      if (pt && id !== "fabric" && id !== "inside" && id !== "lining") zoomTo(pt[0], pt[1], 1.8);
      else resetZoom();
    }
    showKey(key && keys.indexOf(key) !== -1 ? key : keys[0]);
    renderMarkers();
    applyViewBox();
    if (window.innerWidth <= 900) {
      // Keep the jacket in sight above the sheet.
      const top = canvas.getBoundingClientRect().top + window.scrollY - (typeof getNavClearance === "function" ? getNavClearance() : 80);
      if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }
  function closePanel() {
    if (D.isEmbedded()) D.unembedOptions();
    if (!openArea) return;
    openArea = null;
    openKey = null;
    sheetEl.hidden = true;
    menuEl.hidden = false;
    shell.classList.remove("sheet-open");
    renderMarkers();
    applyViewBox();
    if (vb.w < VBW - 1) resetZoom();
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
    if (context) draw();
  }

  D.onChange(() => { if (context) scheduleDraw(); });
  renderModeBars();
  if (window.MutationObserver) {
    const mo = new MutationObserver(() => place());
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const jacketSec = document.getElementById("designer");
    if (jacketSec) mo.observe(jacketSec, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("resize", applyViewBox);
  place();
  // For testing in the browser console.
  window.jacketStudio = { open: openAreaPanel, close: closePanel, setView: setView, setMode: setMode, draw: draw };
})();
