// ---------------------------------------------------------------------
// Build From a Photo (Daniel, 2026-11-02)
//
// On "What are we building?" the customer can upload a picture of a suit.
// The suit-from-photo edge function (Claude looking at the photo) answers
// every visible design step with one of the designer's own option names,
// and estimates the cloth, button and lining colours. This file turns that
// into a complete design: visible details from the photo, the nearest
// in-stock fabric / button / lining by colour, and the Preset Suit's
// standard answers (CLASSIC_SUIT_PRESET in catalog.js) for everything a
// photo can't show. It then opens a short "Your Suit" sheet where any of
// the main choices can be changed with one tap, without stepping through
// the whole designer.
//
// Uses main.js globals (jacketDesigner, pantsDesigner, applySuitType,
// finishDesign, ...), so it loads after main.js. Maps only to options that
// already exist: no new options, so the picture generator and 3D jacket
// need nothing new.
// ---------------------------------------------------------------------
(function () {
  if (typeof jacketDesigner === "undefined" || typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return;
  const FN_URL = SUPABASE_URL + "/functions/v1/suit-from-photo";
  const entryBtn = document.getElementById("buildFromPhotoBtn");
  if (!entryBtn) return;

  // Steps Claude is asked to read off the photo, in the order they are
  // applied (front buttons before the lapel, the lapel before its width).
  const JACKET_PHOTO_STEPS = ["frontbutton", "collar", "lapelwidth", "lapelbuttonhole", "pockettype", "lowerpocket", "backvent", "cuffbuttons", "sleevecrown", "pickStitch"];
  const PANTS_PHOTO_STEPS = ["frontPleat", "frontPocket", "bottomStyle", "beltLoops", "waistbandStyle", "backPocket"];
  // Rows on the quick-edit sheet.
  const JACKET_ROWS = ["fabric", "frontbutton", "collar", "lapelwidth", "pockettype", "lowerpocket", "backvent", "cuffbuttons", "buttoncolor", "lining"];
  const PANTS_ROWS = ["frontPleat", "frontPocket", "bottomStyle"];
  const MATCH_COUNT = 11;

  const label = (o) => o.displayName || o.name;
  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---- colour matching (CIE Lab distance) ----
  function hexToLab(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function dist(hexA, hexB) {
    const a = hexToLab(hexA), b = hexToLab(hexB);
    if (!a || !b) return 999;
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
  }

  const FABRIC_PATTERN_OF = {};
  FABRIC_PATTERN_TYPES.forEach((pt) => pt.colorFamilies.forEach((f) => f.options.forEach((o) => { FABRIC_PATTERN_OF[o.name] = pt.name; })));
  const LINING_PATTERN_OF = {};
  LINING_PATTERN_TYPES.forEach((pt) => pt.colorFamilies.forEach((f) => f.options.forEach((o) => { LINING_PATTERN_OF[o.name] = pt.name; })));
  const BUTTON_MATERIAL_OF = (name) => {
    const prefix = (String(name).match(/^[A-Z]+/) || [""])[0];
    const t = BUTTON_TYPE_ORDER.find((bt) => bt.prefixes.indexOf(prefix) !== -1);
    return t ? t.name : "";
  };

  // Fabrics (in stock, and on the customer's own list if they have one)
  // closest to the photo's cloth; a different pattern counts as far away.
  function rankedFabrics(info) {
    const opts = jacketDesigner.allowedFor("fabric").filter((o) => o.hex && !o.outOfStock);
    if (!info || !info.hex) return opts;
    return opts
      .map((o) => ({ o, d: dist(o.hex, info.hex) + (FABRIC_PATTERN_OF[o.name] === info.pattern ? 0 : 22) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.o);
  }
  function rankedButtons(info) {
    const opts = jacketDesigner.allowedFor("buttoncolor").filter((o) => o.hex);
    if (!info || !info.hex) return opts;
    return opts
      .map((o) => ({ o, d: dist(o.hex, info.hex) + (info.material && info.material !== "Unknown" && BUTTON_MATERIAL_OF(o.name) !== info.material ? 8 : 0) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.o);
  }
  function rankedLinings(info) {
    const opts = jacketDesigner.allowedFor("lining").filter((o) => o.hex && !o.uploadPhoto && !o.matchesFabric);
    if (!info || !info.hex) return opts;
    return opts
      .map((o) => {
        const solid = /Solid/.test(LINING_PATTERN_OF[o.name] || "");
        return { o, d: dist(o.hex, info.hex) + (solid === !info.patterned ? 0 : 15) };
      })
      .sort((a, b) => a.d - b.d)
      .map((x) => x.o);
  }

  // onlyWhen / hiddenWhen checked against a plain selections object.
  function passes(o, sel) {
    if (o.onlyWhen && !Object.keys(o.onlyWhen).every((dep) => o.onlyWhen[dep].indexOf(sel[dep]) !== -1)) return false;
    if (o.hiddenWhen && !Object.keys(o.hiddenWhen).every((dep) => o.hiddenWhen[dep].indexOf(sel[dep]) === -1)) return false;
    return true;
  }
  function optionByLabel(cat, answer, sel) {
    if (!answer || answer === "Not visible") return null;
    const same = cat.options.filter((o) => label(o) === answer && !(cat.retiredOptions || []).includes(o.name));
    return same.find((o) => passes(o, sel)) || same[0] || null;
  }
  function stepsPayload(catalog, keys) {
    return keys.filter((k) => catalog[k]).map((k) => {
      const cat = catalog[k];
      const names = cat.options.filter((o) => !(cat.retiredOptions || []).includes(o.name)).map(label);
      return { key: k, label: cat.label, options: names.filter((n, i) => names.indexOf(n) === i) };
    });
  }

  // ---- photo -> design ----
  let state = null; // { photos: [dataUrl], result, open: "j:collar" | null }
  const MAX_PHOTOS = 3;
  // A pasted page link shows as a preview card of the website (main picture,
  // site name, page title); uploaded photos show as a row of thumbnails.
  const siteCard = () => {
    const pg = state.page;
    let host = "";
    try { host = new URL(pg.url).hostname.replace(/^www\./, ""); } catch (e) {}
    return '<div class="ps-site">' +
      (state.photos && state.photos[0] ? '<img class="ps-site-img" src="' + state.photos[0] + '" alt="">' : "") +
      '<div class="ps-site-text"><span class="ps-site-name">' + esc(pg.site || host) + "</span>" +
      (pg.title ? "<b>" + esc(pg.title) + "</b>" : "") +
      (host && host !== String(pg.site || "").toLowerCase() ? "<small>" + esc(host) + "</small>" : "") + "</div></div>";
  };
  const photoStrip = (cls) => (state && state.page
    ? siteCard()
    : state && state.photos && state.photos.length
    ? '<div class="ps-photos ' + (cls || "") + '">' + state.photos.map((p, i) => '<img class="ps-photo" src="' + p + '" alt="Your photo ' + (i + 1) + '">').join("") + "</div>"
    : "");

  function buildSelections(result) {
    const jsel = Object.assign({}, CLASSIC_SUIT_PRESET.jacket.fixed);
    // Which rows came from the photo (the rest are our standard picks and
    // say so on the sheet).
    const seen = { j: { fabric: true }, p: {} };
    JACKET_PHOTO_STEPS.forEach((k) => {
      const o = optionByLabel(JACKET_CATALOG[k], result.jacket && result.jacket[k], jsel);
      if (o) { jsel[k] = o.name; seen.j[k] = true; }
    });
    const fabric = rankedFabrics(result.fabric)[0];
    if (fabric) jsel.fabric = fabric.name;
    jsel.buttoncolor = BEST_MATCH_FABRIC_BUTTON_OPTION.name;
    if (result.buttons && !result.buttons.matchesFabric) {
      const b = rankedButtons(result.buttons)[0];
      if (b) jsel.buttoncolor = b.name;
    }
    seen.j.buttoncolor = true;
    jsel.lining = LINING_MATCH_OPTION.name;
    if (result.lining && result.lining.visible) {
      const l = rankedLinings(result.lining)[0];
      if (l) { jsel.lining = l.name; seen.j.lining = true; }
    }
    if (result.contrastButtonholes && result.contrastButtonholes.visible) {
      const t = JACKET_CATALOG.frontButtonholeThreadColor.options
        .filter((o) => o.hex)
        .sort((a, b) => dist(a.hex, result.contrastButtonholes.hex) - dist(b.hex, result.contrastButtonholes.hex))[0];
      if (t) {
        jsel.frontButtonholeThreadColor = t.name;
        jsel.buttonholeColorPlacement = "Front & Sleeves";
        if (jsel.lapelbuttonhole && jsel.lapelbuttonhole !== "No Lapel Buttonhole") jsel.buttonholeThreadColor = t.name;
      }
    }
    const psel = Object.assign({}, CLASSIC_SUIT_PRESET.pants.fixed);
    PANTS_PHOTO_STEPS.forEach((k) => {
      const o = optionByLabel(PANTS_CATALOG[k], result.pants && result.pants[k], psel);
      if (o) { psel[k] = o.name; seen.p[k] = true; }
    });
    return { jsel, psel, seen };
  }

  // Any step still unanswered (e.g. a pick the rules cleared) gets its
  // Standard option, or the first one offered.
  function fillMissing(d) {
    const tried = {};
    for (let i = 0; i < 12; i++) {
      const k = d.firstMissingKey();
      if (!k || tried[k]) return;
      tried[k] = true;
      const opts = d.allowedFor(k).filter((o) => !o.outOfStock && !o.uploadPhoto);
      const pick = opts.find((o) => o.badge === "Standard") || opts[0];
      if (!pick) return;
      const one = {};
      one[k] = pick.name;
      d.setSelections(one);
    }
  }

  function applyResult(result, type) {
    // A brand-new suit, never the cart suit that was open for editing.
    pendingCommitIndex = null;
    editingCartIndex = null;
    editingCartPreview = null;
    designPreview = null;
    renderCartBar();
    applySuitType(type);
    jacketDesigner.resetSelections();
    pantsDesigner.resetSelections();
    const { jsel, psel, seen } = buildSelections(result);
    state.seen = seen;
    jacketDesigner.setSelections(jsel);
    pantsDesigner.setSelections(psel);
    fillMissing(jacketDesigner);
    fillMissing(pantsDesigner);
    markDesignStarted();
    saveDraft();
  }

  // ---- the sheet ----
  let sheet = null;
  function onKey(e) { if (e.key === "Escape") closeSheet(); }
  function openSheet(html) {
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "wiz-sheet ps-sheet";
      document.body.appendChild(sheet);
      // Same page lock as the designer's Review sheet: on <html> and <body>,
      // and swipes outside the scrolling list do nothing on phones.
      document.body.classList.add("wiz-lock");
      document.documentElement.classList.add("wiz-lock");
      document.addEventListener("keydown", onKey);
      sheet.addEventListener("touchmove", (e) => {
        if (!e.target.closest || !e.target.closest(".ps-body")) e.preventDefault();
      }, { passive: false });
      sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
      // iPhone: the keyboard (typing a link) and Safari's bottom bar sit on
      // top of the page without resizing it, which hid the link box and the
      // Use Link button. Lift the sheet above whatever covers the bottom.
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const lift = () => {
          if (!sheet) return;
          sheet.style.height = Math.round(vv.height) + "px";
          sheet.style.top = Math.round(vv.offsetTop) + "px";
        };
        vv.addEventListener("resize", lift);
        vv.addEventListener("scroll", lift);
        sheet._unlift = () => { vv.removeEventListener("resize", lift); vv.removeEventListener("scroll", lift); };
        lift();
      }
    }
    sheet.innerHTML = '<div class="wiz-sheet-card ps-card" role="dialog" aria-modal="true" aria-label="Your suit from a photo">' + html + "</div>";
    const close = sheet.querySelector(".wiz-close");
    if (close) close.onclick = closeSheet;
  }
  function closeSheet() {
    if (!sheet) return;
    if (sheet._unlift) sheet._unlift();
    sheet.remove();
    sheet = null;
    document.body.classList.remove("wiz-lock");
    document.documentElement.classList.remove("wiz-lock");
    document.removeEventListener("keydown", onKey);
  }
  const head = (title) => '<div class="wiz-sheet-head"><h3>' + esc(title) + '</h3><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>';

  function showLoading() {
    openSheet(head(state && state.link ? "Build From a Link" : "Build From a Photo") +
      '<div class="ps-body ps-loading">' +
      photoStrip() +
      '<span class="ps-spinner" aria-hidden="true"></span>' +
      "<b>" + (state && state.link && !state.photos.length ? "Studying your link" : "Studying your photo" + (state && state.photos && state.photos.length > 1 ? "s" : "")) + "&hellip;</b>" +
      "<p>We're matching the fabric, lapels, pockets and buttons to our options. This takes less than a minute.</p>" +
      "</div>");
  }
  function showError(msg) {
    const fromLink = !!(state && state.link);
    openSheet(head(state && state.link ? "Build From a Link" : "Build From a Photo") +
      '<div class="ps-body ps-loading">' +
      photoStrip() +
      "<b>" + esc(msg) + "</b>" +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary wiz-continue ps-retry">' + (fromLink ? "Try Another Link" : "Try Another Photo") + '</button>' +
      '<button type="button" class="ps-link ps-cancel">Design it myself instead</button></div>');
    sheet.querySelector(".ps-retry").onclick = () => showStart();
    sheet.querySelector(".ps-cancel").onclick = closeSheet;
  }

  function optionImg(d, k, name) {
    const cat = d.catalog[k];
    const o = d.allowedFor(k).find((x) => x.name === name) || (cat.options || []).find((x) => x.name === name);
    return o && o.img ? o.img : "";
  }
  function choicesFor(d, k) {
    const sel = d.rawSelections()[k];
    let opts;
    let more = "";
    if (k === "fabric") {
      opts = rankedFabrics(state.result.fabric).slice(0, MATCH_COUNT);
      more = "See All Fabrics";
    } else if (k === "buttoncolor") {
      opts = [BEST_MATCH_FABRIC_BUTTON_OPTION].concat(rankedButtons(state.result.buttons && !state.result.buttons.matchesFabric ? state.result.buttons : { hex: (rankedFabrics(state.result.fabric)[0] || {}).hex }).slice(0, MATCH_COUNT - 1));
      more = "See All Buttons";
    } else if (k === "lining") {
      opts = [LINING_MATCH_OPTION].concat(rankedLinings(state.result.lining && state.result.lining.visible ? state.result.lining : { hex: (rankedFabrics(state.result.fabric)[0] || {}).hex }).slice(0, MATCH_COUNT - 1));
      more = "See All Linings";
    } else {
      opts = d.allowedFor(k).filter((o) => !o.outOfStock && !o.uploadPhoto);
    }
    // Keep the current pick in view even when it isn't among the closest.
    if (sel && !opts.some((o) => o.name === sel)) {
      const cur = d.allowedFor(k).find((o) => o.name === sel);
      if (cur) opts = [cur].concat(opts);
    }
    return '<div class="ps-choices' + (["fabric", "buttoncolor", "lining", "cuffbuttons"].includes(k) ? " ps-choices-small" : "") + '">' +
      opts.map((o) => '<button type="button" class="ps-choice' + (o.name === sel ? " selected" : "") + '" data-name="' + esc(o.name) + '">' +
        (o.img ? '<img src="' + esc(o.img) + '" alt="" loading="lazy">' : "") + "<span>" + esc(label(o)) + "</span></button>").join("") +
      (more ? '<button type="button" class="ps-choice ps-more" data-more="1"><span>' + esc(more) + " &rarr;</span></button>" : "") +
      "</div>";
  }
  function rowHtml(dKey, d, k) {
    if (!d.catalog[k] || !d.isShown(k)) return "";
    const id = dKey + ":" + k;
    const raw = d.rawSelections()[k];
    const img = raw ? optionImg(d, k, raw) : "";
    const open = state.open === id;
    return '<div class="ps-item' + (open ? " open" : "") + '">' +
      '<button type="button" class="ps-row" data-id="' + id + '" aria-expanded="' + open + '">' +
      (img ? '<img src="' + esc(img) + '" alt="">' : '<span class="ps-row-noimg"></span>') +
      '<span class="ps-row-text"><span class="ps-row-label">' + esc(d.catalog[k].label) +
      (state.seen && !state.seen[dKey][k] ? ' <em class="ps-guess">not in your photo</em>' : "") + '</span><span class="ps-row-value">' + esc(d.displayValue(k) || "Choose") + "</span></span>" +
      '<span class="ps-row-edit">' + (open ? "Done" : "Change") + "</span></button>" +
      (open ? choicesFor(d, k) : "") +
      "</div>";
  }

  function showSummary() {
    const withPants = !isJacketOnlyType(currentSuitType);
    const priceEl = document.getElementById("totalPrice");
    const fabricNote = state.result.fabric && state.result.fabric.description ? "Closest fabric to the " + state.result.fabric.description + " in your photo." : "";
    const keepOpen = sheet && sheet.querySelector(".ps-body") ? sheet.querySelector(".ps-body").scrollTop : 0;
    openSheet(head("Your Suit") +
      '<div class="ps-body">' +
      '<div class="ps-top' + (state.photos.length > 2 || state.page ? " ps-top-many" : "") + '">' + photoStrip("ps-photos-small") +
      "<p>We matched " + (state.page ? "this page's suit" : "your photo" + (state.photos.length > 1 ? "s" : "")) + " to our closest options. Tap anything to change it.</p></div>" +
      (state.photos.length < MAX_PHOTOS
        ? '<button type="button" class="ps-add-photo">+ Add another photo (pants, back or a close-up)</button>'
        : "") +
      '<div class="ps-type" role="group" aria-label="What are we building?">' +
      '<button type="button" data-type="full" class="' + (withPants ? "selected" : "") + '">Full Suit</button>' +
      '<button type="button" data-type="jacketOnly" class="' + (withPants ? "" : "selected") + '">Jacket Only</button></div>' +
      '<h4 class="ps-group">Jacket</h4>' +
      JACKET_ROWS.map((k) => rowHtml("j", jacketDesigner, k)).join("") +
      (fabricNote ? '<p class="ps-note">' + esc(fabricNote) + "</p>" : "") +
      (withPants ? '<h4 class="ps-group">Pants</h4>' + PANTS_ROWS.map((k) => rowHtml("p", pantsDesigner, k)).join("") : "") +
      '<p class="ps-note">Everything else (lining style, inside pockets, stitching and so on) is set to our standard. You can fine-tune any detail in the full designer.</p>' +
      "</div>" +
      '<div class="wiz-total"><span>Estimated total</span><b>' + esc(priceEl ? priceEl.textContent : "") + "</b></div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary wiz-continue ps-continue">Looks Good, Continue</button>' +
      '<button type="button" class="ps-link ps-full">Open the full designer</button></div>');
    const body = sheet.querySelector(".ps-body");
    body.scrollTop = keepOpen;
    const openItem = sheet.querySelector(".ps-item.open");
    if (openItem) {
      const top = openItem.offsetTop;
      if (top + openItem.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = Math.max(0, Math.min(top - 8, top + openItem.offsetHeight - body.clientHeight + 8));
    }

    const addBtn = sheet.querySelector(".ps-add-photo");
    if (addBtn) addBtn.onclick = () => pickPhoto(true);
    sheet.querySelectorAll(".ps-type button").forEach((b) => {
      b.onclick = () => {
        const t = b.getAttribute("data-type");
        if (t === currentSuitType) return;
        applySuitType(t);
        saveDraft();
        showSummary();
      };
    });
    sheet.querySelectorAll(".ps-row").forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute("data-id");
        state.open = state.open === id ? null : id;
        showSummary();
      };
    });
    sheet.querySelectorAll(".ps-choice").forEach((b) => {
      b.onclick = () => {
        const [dKey, k] = state.open.split(":");
        const d = dKey === "j" ? jacketDesigner : pantsDesigner;
        if (b.getAttribute("data-more")) {
          closeSheet();
          openInDesigner(d, k);
          return;
        }
        const one = {};
        one[k] = b.getAttribute("data-name");
        d.setSelections(one);
        fillMissing(d);
        if (state.seen) state.seen[dKey][k] = true;
        saveDraft();
        state.open = null;
        showSummary();
      };
    });
    sheet.querySelector(".ps-continue").onclick = () => {
      fillMissing(jacketDesigner);
      fillMissing(pantsDesigner);
      const jMissing = jacketDesigner.firstMissingKey();
      const pMissing = isJacketOnlyType(currentSuitType) ? null : pantsDesigner.firstMissingKey();
      closeSheet();
      if (jMissing) { openInDesigner(jacketDesigner, jMissing); return; }
      if (pMissing) { openInDesigner(pantsDesigner, pMissing); return; }
      furthestStepIndex = Math.max(furthestStepIndex, ALL_STEPS.indexOf(stepAfterDesign()));
      finishDesign(suitTypeSection);
    };
    sheet.querySelector(".ps-full").onclick = () => {
      closeSheet();
      openInDesigner(jacketDesigner, null);
    };
  }

  // Opens the jacket (or pants) designer on step k, from the suit type page.
  function openInDesigner(d, k) {
    const section = d === pantsDesigner ? pantsSection : jacketSection;
    if (d === pantsDesigner) furthestStepIndex = Math.max(furthestStepIndex, ALL_STEPS.indexOf(pantsSection));
    d.resetToFirstTab();
    if (k) d.setActiveTab(k);
    const from = ALL_STEPS.find((el) => el.classList.contains("active")) || suitTypeSection;
    if (from === section) return;
    goToStep(from, section);
  }

  // ---- upload ----
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("open"));
        img.onload = () => {
          const max = 1568;
          const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const g = c.getContext("2d");
          g.fillStyle = "#fff";
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.86));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // file: an uploaded photo; link: a pasted web address (the server fetches
  // it and sends the photo back).
  // files: uploaded photos; link: a pasted web address (the server fetches
  // it and sends the photo back); keep: add to the photos already read (the
  // whole suit is read again from all of them).
  async function run(files, link, keep) {
    const photos = keep && state && state.photos ? state.photos.slice() : [];
    const keptPage = keep && state && state.page ? state.page : null;
    for (const file of files || []) {
      if (photos.length >= MAX_PHOTOS) break;
      try {
        photos.push(await readPhoto(file));
      } catch (e) {
        state = { photos, result: null, open: null };
        showError("Sorry, that photo couldn't be opened. Please try a JPG or PNG.");
        return;
      }
    }
    state = { photos, result: null, open: null, link: !!link, page: keptPage };
    showLoading();
    let data = null;
    let status = 0;
    const payload = JSON.stringify({
      images: photos,
      imageUrl: link || undefined,
      jacketSteps: stepsPayload(JACKET_CATALOG, JACKET_PHOTO_STEPS),
      pantsSteps: stepsPayload(PANTS_CATALOG, PANTS_PHOTO_STEPS),
    });
    // A dropped connection or a busy server gets one quiet second try, so a
    // phone switching networks or a brief hiccup doesn't end in an error.
    for (let attempt = 0; attempt < 2; attempt++) {
      data = null;
      status = 0;
      try {
        const res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        status = res.status;
        data = await res.json().catch(() => null);
      } catch (e) {
        data = null;
      }
      if (!sheet) return;
      if (data && (data.ok || data.error === "link" || data.isSuit === false)) break;
      if (status === 429 || (status >= 400 && status < 500)) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    if (!sheet) return; // closed while waiting
    if (data && data.page && typeof data.page === "object") state.page = { site: String(data.page.site || ""), title: String(data.page.title || ""), url: String(data.page.url || "") };
    if (data && Array.isArray(data.photos)) state.photos.push(...data.photos.filter((p) => typeof p === "string" && p.startsWith("data:image/")));
    if (data && data.error === "link") { showError(data.message || "We couldn't open that link. You can save the photo and upload it instead."); return; }
    if (status === 429) { showError("You've uploaded a lot of photos in a short time. Please try again in a little while."); return; }
    const result = data && data.result;
    const notSuit = link ? "We couldn't find a suit at that link. Please try another link." : "We couldn't find a suit in that photo. Please try another picture of a suit.";
    if (data && data.isSuit === false) { showError(link ? notSuit : (data.message || notSuit)); return; }
    if (!result) { showError("Sorry, something went wrong reading your photo. Please try again."); return; }
    if (!result.isSuit) { showError(link ? notSuit : (result.message || notSuit)); return; }
    state.result = result;
    applyResult(result, "full");
    showSummary();
  }

  // One file input that lives in the page. iPhone Safari can drop a picker's
  // "change" event when the input isn't attached to the page, so the photo
  // would silently never upload; a kept, attached input avoids that.
  function fileInput() {
    let input = document.getElementById("psFileInput");
    if (!input) {
      input = document.createElement("input");
      input.id = "psFileInput";
      input.type = "file";
      input.accept = "image/*";
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      input.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
      document.body.appendChild(input);
    }
    return input;
  }

  function pickPhoto(keep) {
    const room = MAX_PHOTOS - (keep && state && state.photos ? state.photos.length : 0);
    if (room <= 0) return;
    const input = fileInput();
    input.value = "";
    input.multiple = room > 1;
    input.onchange = () => {
      const files = Array.from(input.files || []).slice(0, room);
      input.onchange = null;
      if (!files.length) return;
      if (files.some((f) => f.type && !/^image\//.test(f.type))) { alert("Please choose image files (JPG or PNG)."); return; }
      if (files.some((f) => f.size > 25 * 1024 * 1024)) { alert("That photo is too large \u2014 please choose one under 25 MB."); return; }
      run(files, null, keep);
    };
    input.click();
  }

  // First screen: upload a photo, or paste a link to one.
  function showStart() {
    state = null;
    openSheet(head("Build From a Photo") +
      '<div class="ps-body ps-start">' +
      "<p>Upload a photo of a suit you love, or paste a link to one (a shop page, an article, a post). We'll build the closest match from our options.</p>" +
      '<button type="button" class="btn-primary wiz-continue ps-upload">Upload Photos</button>' +
      '<p class="ps-hint">Up to 3 photos of the same suit, for example the jacket, the pants and the back.</p>' +
      '<div class="ps-or"><span>or paste a link</span></div>' +
      '<form class="ps-link-form" novalidate>' +
      '<label for="psLinkInput" class="ps-sr">Link to a photo of a suit</label>' +
      '<input id="psLinkInput" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…">' +
      '<button type="submit" class="ps-link-go">Use Link</button>' +
      "</form>" +
      '<p class="ps-link-error" hidden></p>' +
      "</div>");
    sheet.querySelector(".ps-upload").onclick = () => pickPhoto();
    const form = sheet.querySelector(".ps-link-form");
    const input = sheet.querySelector("#psLinkInput");
    input.addEventListener("focus", () => setTimeout(() => { try { sheet && sheet.querySelector(".ps-link-go").scrollIntoView({ block: "nearest" }); } catch (e) {} }, 350));
    const err = sheet.querySelector(".ps-link-error");
    form.onsubmit = (e) => {
      e.preventDefault();
      let v = String(input.value || "").trim();
      const found = v.match(/https?:\/\/\S+/i);
      if (found) v = found[0];
      else if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) v = "https://" + v;
      if (!/^https?:\/\/\S+\.\S+/i.test(v)) {
        err.textContent = "Please paste the full link to the photo or page.";
        err.hidden = false;
        input.focus();
        return;
      }
      run(null, v);
    };
  }

  entryBtn.hidden = false;
  entryBtn.addEventListener("click", () => {
    // A suit already being designed (not yet in the cart) would be replaced.
    if (designerHasUnsavedWork()) {
      openEditSuitConfirm(null, {
        title: "Start from a photo?",
        text: "This replaces the suit you're designing now with one built from your photo. Suits already in your cart stay as they are.",
        confirm: "Continue",
        cancel: "Keep My Design",
        onConfirm: showStart,
      });
      return;
    }
    showStart();
  });
})();
