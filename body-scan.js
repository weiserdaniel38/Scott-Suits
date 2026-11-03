// ---------------------------------------------------------------------
// Phone Body Scan (Daniel, 2026-11-03)
//
// "Scan My Body" on the Measurements step: the phone camera takes a front
// photo (arms out a little, feet apart) and a side photo of the customer,
// and works out their BODY measurements (the factory's body list, the
// optional positions too), using their height for the scale.
//
// How it works, all on the customer's own phone (no photo is uploaded):
//   1. Google's MediaPipe Pose Landmarker (loaded from the jsDelivr / Google
//      model CDN only when the scan opens) finds 33 body points and an
//      outline of the person in each photo. A light model checks the pose
//      live and takes the photos by itself; a heavy model measures them.
//   2. Height in pixels (top of the head to the floor) against the height
//      the customer typed gives centimeters per pixel.
//   3. Lengths (arm, outseam, nape to waist, ...) come from the body points.
//      Girths (chest, stomach, seat, thigh, neck, calf) come from the width
//      of the outline in the front photo and the depth in the side photo,
//      treated as an ellipse and corrected per body part (BODY_SHAPE_K).
//      Several frames of each pose are measured and the median is kept.
//   4. The customer checks the numbers; our tailor reviews every scanned
//      order before it goes to the factory (the scan is written into the
//      order text, extra optional factory positions included).
//
// Honest accuracy: published phone-scan studies land around 1-3 cm on
// girths and 1-2 cm on lengths in good conditions (fitted clothes, plain
// background, whole body in frame). The correction factors here are first
// guesses from standard body proportions and should be tuned against real
// tape measurements (see BODY_SHAPE_K and the LENGTH_* constants).
//
// The geometry (BodyScanGeometry) is plain math with no DOM, so it can be
// tested in Node (scripts/test-body-scan.js).
// ---------------------------------------------------------------------
(function (root) {
  // Cross-section shape corrections: real girth / ellipse perimeter from
  // the front width and side depth. Human sections are rounder-cornered
  // rectangles more than ellipses, chest most of all.
  const BODY_SHAPE_K = { chest: 1.08, stomach: 1.04, waist: 1.04, seat: 1.05, thigh: 1.05, neck: 1.06, calf: 1.03 };
  // Shoulder point sits above and outside the shoulder joint the pose
  // model finds, so the arm length gets this much added (cm).
  const ARM_SHOULDER_POINT_CM = 4;
  // Nape (the bone at the back of the neck) above the shoulder joints, as a
  // share of height (standard proportions: about 0.055 of height).
  const NAPE_ABOVE_SHOULDER = 0.055;
  // Torso levels as a share of the shoulder-joint to hip-joint distance.
  const LEVEL = {
    armpit: [0.22, 0.27],
    chest: [0.27, 0.35],
    naturalWaist: [0.45, 0.75],
    stomach: 0.72,
    trouserWaist: 0.8,
    seat: [0.92, 1.2],
    highStomach: [0.5, 1.0],
  };

  function ellipsePerimeter(width, depth) {
    const a = width / 2, b = depth / 2;
    if (!(a > 0) || !(b > 0)) return NaN;
    const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }
  function median(arr) {
    const v = arr.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  // Spread of a set of frame values (median absolute deviation, scaled).
  function spread(arr) {
    const v = arr.filter((x) => isFinite(x));
    if (v.length < 2) return 0;
    const m = median(v);
    return 1.4826 * median(v.map((x) => Math.abs(x - m)));
  }
  const avg = (a, b) => (a + b) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  // A person mask: { data: Float32Array (0..1), width, height }.
  function maskTools(mask) {
    const w = mask.width, h = mask.height, d = mask.data;
    const inside = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return d[y * w + x] > 0.5;
    };
    // The run of person pixels on row y that contains (or is nearest to) x0.
    function segment(y, x0, searchFrac) {
      y = Math.round(y);
      if (y < 0 || y >= h) return null;
      let x = Math.round(x0);
      if (!inside(x, y)) {
        const r = Math.round(w * (searchFrac || 0.03));
        let found = null;
        for (let k = 1; k <= r && found === null; k++) {
          if (inside(x - k, y)) found = x - k;
          else if (inside(x + k, y)) found = x + k;
        }
        if (found === null) return null;
        x = found;
      }
      let l = x, r2 = x;
      while (l > 0 && inside(l - 1, y)) l--;
      while (r2 < w - 1 && inside(r2 + 1, y)) r2++;
      return { l, r: r2, w: r2 - l + 1 };
    }
    // Width of that run, as the median of 5 rows around y (less noise).
    function widthAt(y, x0, searchFrac) {
      const ws = [];
      for (let k = -2; k <= 2; k++) {
        const s = segment(y + k, x0, searchFrac);
        if (s) ws.push(s.w);
      }
      return ws.length >= 3 ? median(ws) : NaN;
    }
    // Width across a body part along the line through p perpendicular to
    // direction dir (for the upper arm, which slants in the A-pose).
    function crossWidth(p, dir, maxLen) {
      const len = Math.hypot(dir.x, dir.y) || 1;
      const nx = -dir.y / len, ny = dir.x / len;
      if (!inside(p.x, p.y)) return NaN;
      let a = 0, b = 0;
      while (a < maxLen && inside(p.x + nx * (a + 1), p.y + ny * (a + 1))) a++;
      while (b < maxLen && inside(p.x - nx * (b + 1), p.y - ny * (b + 1))) b++;
      if (a >= maxLen || b >= maxLen) return NaN;
      return a + b + 1;
    }
    // Top of the head: first row (from the top) with person pixels near x.
    function topNear(x, halfBand, untilY) {
      const x0 = Math.max(0, Math.round(x - halfBand)), x1 = Math.min(w - 1, Math.round(x + halfBand));
      for (let y = 0; y < Math.min(h, untilY); y++) {
        let n = 0;
        for (let xx = x0; xx <= x1; xx++) if (d[y * w + xx] > 0.5) n++;
        if (n >= 2) return y;
      }
      return NaN;
    }
    // Floor contact: last row (from the bottom) with person pixels in the
    // band of columns around the feet.
    function bottomNear(xa, xb, fromY) {
      const x0 = Math.max(0, Math.round(Math.min(xa, xb))), x1 = Math.min(w - 1, Math.round(Math.max(xa, xb)));
      for (let y = h - 1; y > fromY; y--) {
        let n = 0;
        for (let xx = x0; xx <= x1; xx++) if (d[y * w + xx] > 0.5) n++;
        if (n >= 3) return y;
      }
      return NaN;
    }
    return { w, h, inside, segment, widthAt, crossWidth, topNear, bottomNear };
  }

  // Landmarks (normalized 0..1) to mask pixels.
  function px(lms, mask) {
    return lms.map((p) => ({ x: p.x * mask.width, y: p.y * mask.height, v: p.visibility == null ? 1 : p.visibility }));
  }

  // The front photo: heights, widths and lengths in pixels.
  function measureFrontFrame(landmarks, mask) {
    const m = maskTools(mask);
    const P = px(landmarks, mask);
    const sh = { x: avg(P[11].x, P[12].x), y: avg(P[11].y, P[12].y) };
    const hip = { x: avg(P[23].x, P[24].x), y: avg(P[23].y, P[24].y) };
    const T = hip.y - sh.y;
    if (!(T > 10)) return { error: "pose" };
    const earY = avg(P[7].y, P[8].y);
    const headX = avg(P[7].x, P[8].x);
    const shoulderDist = Math.hypot(P[11].x - P[12].x, P[11].y - P[12].y);
    const top = m.topNear(headX, shoulderDist * 0.35, earY);
    const footL = Math.min(P[29].x, P[31].x, P[27].x) - shoulderDist * 0.25;
    const footR = Math.max(P[30].x, P[32].x, P[28].x) + shoulderDist * 0.25;
    const floor = m.bottomNear(Math.min(footL, footR), Math.max(footL, footR, P[29].x, P[30].x), hip.y);
    const Hpx = floor - top;
    if (!(Hpx > 50)) return { error: "height" };
    const midX = (y) => lerp(sh.x, hip.x, (y - sh.y) / T);
    const torsoAt = (t) => m.widthAt(sh.y + t * T, midX(sh.y + t * T), 0.02);
    const band = (range, pick) => {
      let best = null;
      for (let t = range[0]; t <= range[1] + 1e-9; t += 0.02) {
        const v = torsoAt(t);
        if (!isFinite(v)) continue;
        if (!best || (pick === "min" ? v < best.v : v > best.v)) best = { t, v };
      }
      return best;
    };
    const bandMedian = (range) => {
      const vs = [];
      for (let t = range[0]; t <= range[1] + 1e-9; t += 0.02) vs.push(torsoAt(t));
      return median(vs);
    };
    const out = { top, floor, Hpx, shY: sh.y, hipY: hip.y, T, flags: [] };
    out.chestW = bandMedian(LEVEL.chest);
    out.armpitW = bandMedian(LEVEL.armpit);
    // Arms touching the sides make the chest look too wide.
    if (out.chestW > shoulderDist * 1.45) out.flags.push("arms");
    const nw = band(LEVEL.naturalWaist, "min");
    out.naturalWaistT = nw ? nw.t : 0.6;
    out.naturalWaistW = nw ? nw.v : NaN;
    out.stomachW = torsoAt(LEVEL.stomach);
    out.trouserWaistW = torsoAt(LEVEL.trouserWaist);
    // Crotch: going down from the hip joints, the first row where the
    // middle is background (the gap between the legs).
    let crotchY = NaN;
    for (let y = Math.round(hip.y); y < Math.round(hip.y + T * 0.8); y++) {
      const x = midX(y);
      if (!m.inside(x, y) && !m.inside(x, y + 1) && !m.inside(x, y + 2)) { crotchY = y; break; }
    }
    if (!isFinite(crotchY)) out.flags.push("legs");
    out.crotchY = crotchY;
    // Seat: widest hip row above the crotch.
    const seatEnd = isFinite(crotchY) ? Math.min(LEVEL.seat[1], (crotchY - 4 - sh.y) / T) : LEVEL.seat[1];
    const seat = band([LEVEL.seat[0], seatEnd], "max");
    out.seatT = seat ? seat.t : 1.0;
    out.seatW = seat ? seat.v : NaN;
    out.highStomach = [];
    for (let t = LEVEL.highStomach[0]; t <= LEVEL.highStomach[1] + 1e-9; t += 0.05) out.highStomach.push({ t, w: torsoAt(t) });
    // Thigh: just below the crotch, each leg on its own.
    const legX = (hipP, kneeP, y) => lerp(hipP.x, kneeP.x, (y - hipP.y) / (kneeP.y - hipP.y || 1));
    if (isFinite(crotchY)) {
      const ty = crotchY + Hpx * 0.012;
      const wl = m.widthAt(ty, legX(P[23], P[25], ty), 0.02);
      const wr = m.widthAt(ty, legX(P[24], P[26], ty), 0.02);
      out.thighY = ty;
      out.thighW = median([wl, wr]);
    }
    // Calf: widest part between knee and ankle.
    const calfW = [];
    [[25, 27], [26, 28]].forEach(([k, a]) => {
      let best = NaN;
      for (let t = 0.12; t <= 0.6; t += 0.04) {
        const y = lerp(P[k].y, P[a].y, t);
        const v = m.widthAt(y, lerp(P[k].x, P[a].x, t), 0.02);
        if (isFinite(v) && !(v <= best)) { best = v; out.calfY = y; }
      }
      calfW.push(best);
    });
    out.calfW = median(calfW);
    // Neck: narrowest row between the ears and the shoulders.
    let neck = null;
    for (let t = 0.45; t <= 0.8; t += 0.05) {
      const y = lerp(earY, sh.y, t);
      const v = m.widthAt(y, headX, 0.02);
      if (isFinite(v) && (!neck || v < neck.v)) neck = { y, v };
    }
    out.neckW = neck ? neck.v : NaN;
    out.neckY = neck ? neck.y : NaN;
    // Shoulders: outline width just above the shoulder joints (the caps).
    out.shoulderW = m.widthAt(sh.y - 0.035 * T, sh.x, 0.02);
    // Upper arm: widest cross-section 25-50% of the way to the elbow.
    const bic = [];
    [[11, 13], [12, 14]].forEach(([s, e]) => {
      const dir = { x: P[e].x - P[s].x, y: P[e].y - P[s].y };
      let best = NaN;
      for (let u = 0.25; u <= 0.5; u += 0.05) {
        const p = { x: P[s].x + dir.x * u, y: P[s].y + dir.y * u };
        const v = m.crossWidth(p, dir, shoulderDist * 0.5);
        if (isFinite(v) && !(v <= best)) best = v;
      }
      bic.push(best);
    });
    out.bicepW = median(bic);
    const armLen = (s, e, wr) => Math.hypot(P[e].x - P[s].x, P[e].y - P[s].y) + Math.hypot(P[wr].x - P[e].x, P[wr].y - P[e].y);
    out.armPx = median([armLen(11, 13, 15), armLen(12, 14, 16)]);
    return out;
  }

  // The side photo: the depth of the body at the same height levels.
  function measureSideFrame(landmarks, mask, fracs) {
    const m = maskTools(mask);
    const P = px(landmarks, mask);
    const sh = { x: avg(P[11].x, P[12].x), y: avg(P[11].y, P[12].y) };
    const hip = { x: avg(P[23].x, P[24].x), y: avg(P[23].y, P[24].y) };
    const T = hip.y - sh.y;
    if (!(T > 10)) return { error: "pose" };
    const earY = avg(P[7].y, P[8].y);
    const headX = avg(P[7].x, P[8].x, P[0].x);
    const top = m.topNear(headX, T * 0.35, earY);
    const fx = [P[27].x, P[28].x, P[29].x, P[30].x, P[31].x, P[32].x];
    const floor = m.bottomNear(Math.min.apply(null, fx) - T * 0.15, Math.max.apply(null, fx) + T * 0.15, hip.y);
    const Hpx = floor - top;
    if (!(Hpx > 50)) return { error: "height" };
    const yOf = (f) => top + f * Hpx;
    // Centre of the body at a height: between the shoulder and hip points,
    // carried on down the leg below the hips.
    const knee = { x: avg(P[25].x, P[26].x), y: avg(P[25].y, P[26].y) };
    const ankle = { x: avg(P[27].x, P[28].x), y: avg(P[27].y, P[28].y) };
    const cx = (y) => {
      if (y <= hip.y) return lerp(sh.x, hip.x, (y - sh.y) / T);
      if (y <= knee.y) return lerp(hip.x, knee.x, (y - hip.y) / (knee.y - hip.y || 1));
      return lerp(knee.x, ankle.x, (y - knee.y) / (ankle.y - knee.y || 1));
    };
    const depthAt = (f) => m.widthAt(yOf(f), cx(yOf(f)), 0.03);
    const out = { top, floor, Hpx, depth: {} };
    Object.keys(fracs).forEach((k) => {
      const f = fracs[k];
      if (Array.isArray(f)) {
        // A band: the largest depth in it (seat, high stomach) or the
        // smallest (neck), as asked.
        const vs = f[2] === "min" ? [Infinity] : [-Infinity];
        for (let x = f[0]; x <= f[1] + 1e-9; x += 0.005) {
          const v = depthAt(x);
          if (!isFinite(v)) continue;
          if (f[2] === "min") vs[0] = Math.min(vs[0], v);
          else vs[0] = Math.max(vs[0], v);
        }
        out.depth[k] = isFinite(vs[0]) ? vs[0] : NaN;
      } else out.depth[k] = depthAt(f);
    });
    return out;
  }

  // Front frames -> the height levels (share of height from the top of
  // the head) to measure the side photos at. heightCm: the customer's.
  function combine(frontFrames) {
    const fronts = frontFrames.filter((f) => f && !f.error);
    if (!fronts.length) return { error: "front" };
    const flags = {};
    fronts.forEach((f) => f.flags.forEach((x) => (flags[x] = true)));
    const fr = (yKey) => median(fronts.map((f) => (f[yKey] - f.top) / f.Hpx));
    const frT = (t) => median(fronts.map((f) => (f.shY + t * f.T - f.top) / f.Hpx));
    const levels = {
      chest: frT(avg(LEVEL.chest[0], LEVEL.chest[1])),
      stomach: frT(LEVEL.stomach),
      waist: frT(LEVEL.trouserWaist),
      seat: median(fronts.map((f) => (f.shY + f.seatT * f.T - f.top) / f.Hpx)),
      thigh: fr("thighY"),
      calf: fr("calfY"),
      neck: fr("neckY"),
    };
    const sideFracs = {
      chest: levels.chest,
      stomach: levels.stomach,
      waist: levels.waist,
      seat: [levels.seat - 0.02, levels.seat + 0.02],
      thigh: levels.thigh,
      calf: [levels.calf - 0.02, levels.calf + 0.02],
      neck: [levels.neck - 0.012, levels.neck + 0.012, "min"],
    };
    for (let t = LEVEL.highStomach[0]; t <= LEVEL.highStomach[1] + 1e-9; t += 0.05) {
      sideFracs["hs" + Math.round(t * 100)] = frT(t);
    }
    return { levels, sideFracs, flags, fronts };
  }

  // Final numbers from front frames and measured side frames.
  function finish(front, sidesMeasured, heightCm) {
    const fronts = front.fronts;
    const depth = (k) => median(sidesMeasured.map((s) => (s.depth[k] / s.Hpx) * heightCm));
    const depthAll = (k) => sidesMeasured.map((s) => (s.depth[k] / s.Hpx) * heightCm);
    const cm = (f, key) => (f[key] / f.Hpx) * heightCm;
    const values = {}, pm = {}, extras = {}, extraPm = {};
    const girth = (id, wKey, dKey, kKey, base) => {
      const d = depth(dKey);
      const vs = fronts.map((f) => ellipsePerimeter(cm(f, wKey), d) * BODY_SHAPE_K[kKey]);
      const v = median(vs);
      values[id] = v;
      pm[id] = Math.max(base, spread(vs) * 2 + spread(depthAll(dKey)) * 1.6);
    };
    girth("body_chest", "chestW", "chest", "chest", 3);
    girth("body_stomach", "stomachW", "stomach", "stomach", 3);
    girth("body_waist", "trouserWaistW", "waist", "waist", 3);
    girth("body_seat", "seatW", "seat", "seat", 3);
    girth("body_thigh", "thighW", "thigh", "thigh", 2.5);
    girth("body_neck", "neckW", "neck", "neck", 2);
    // Upper arm: round enough that the front width alone does.
    const bic = fronts.map((f) => Math.PI * cm(f, "bicepW") * 0.97);
    values.body_bicep = median(bic);
    pm.body_bicep = Math.max(2, spread(bic) * 2);
    const shoulders = fronts.map((f) => cm(f, "shoulderW") * 0.97);
    values.body_shoulder = median(shoulders);
    pm.body_shoulder = Math.max(2, spread(shoulders) * 2);
    const arms = fronts.map((f) => cm(f, "armPx") + ARM_SHOULDER_POINT_CM);
    values.body_sleeve = median(arms);
    pm.body_sleeve = Math.max(2, spread(arms) * 2);
    // Lengths from heights in the front photo.
    const napeY = (f) => f.shY - NAPE_ABOVE_SHOULDER * f.Hpx;
    const nwY = (f) => f.shY + f.naturalWaistT * f.T;
    const twY = (f) => f.shY + LEVEL.trouserWaist * f.T;
    const lenCm = (f, a, b) => ((b - a) / f.Hpx) * heightCm;
    const nape = fronts.map((f) => lenCm(f, napeY(f), nwY(f)) * 1.03);
    values.body_nape_waist = median(nape);
    pm.body_nape_waist = 2;
    // Jacket length: the classic rule, half the nape-to-floor height.
    values.body_back_length = median(fronts.map((f) => lenCm(f, napeY(f), f.floor) / 2));
    pm.body_back_length = 2;
    // Front waist length: side of the neck, over the chest, to the natural waist.
    values.body_front_waist = median(fronts.map((f) => lenCm(f, napeY(f) + 0.01 * f.Hpx, nwY(f)) * 1.12));
    pm.body_front_waist = 3;
    // Trousers: where they sit (just below the navel) to the floor.
    values.body_outseam = median(fronts.map((f) => lenCm(f, twY(f), f.floor) - 0.5));
    pm.body_outseam = 2;
    const seatDepth = depth("seat");
    const rise = fronts.map((f) => (isFinite(f.crotchY) ? lenCm(f, twY(f), f.crotchY) : NaN));
    values.body_u_rise = median(rise.map((r) => 2.1 * r + 0.8 * seatDepth));
    pm.body_u_rise = 4;
    const drop = median(fronts.map((f) => lenCm(f, nwY(f), twY(f))));
    // Most trousers sit 2-8 cm below the natural waist; the back a little higher.
    values.body_front_waist_h = Math.min(8, Math.max(2, drop));
    values.body_back_waist_h = Math.max(1, values.body_front_waist_h - 2);
    pm.body_front_waist_h = 2;
    pm.body_back_waist_h = 2;
    // Optional factory positions (not on the site's form).
    extras.front_shoulder = values.body_shoulder - 2;
    extraPm.front_shoulder = 3;
    extras.back_width = median(fronts.map((f) => cm(f, "armpitW") * 1.05));
    extraPm.back_width = 3;
    extras.front_chest_width = median(fronts.map((f) => cm(f, "armpitW") * 0.95));
    extraPm.front_chest_width = 3;
    let hs = -Infinity;
    for (let t = LEVEL.highStomach[0]; t <= LEVEL.highStomach[1] + 1e-9; t += 0.05) {
      const k = "hs" + Math.round(t * 100);
      const d = depth(k);
      const w = median(fronts.map((f) => {
        const row = f.highStomach.find((r) => Math.abs(r.t - t) < 1e-6);
        return row ? (row.w / f.Hpx) * heightCm : NaN;
      }));
      const g = ellipsePerimeter(w, d) * BODY_SHAPE_K.stomach;
      if (isFinite(g)) hs = Math.max(hs, g);
    }
    extras.stomach_high = isFinite(hs) ? hs : NaN;
    extraPm.stomach_high = 3;
    const calf = fronts.map((f) => ellipsePerimeter(cm(f, "calfW"), depth("calf")) * BODY_SHAPE_K.calf);
    extras.calf = median(calf);
    extraPm.calf = 2;
    const r1 = (v) => (isFinite(v) ? Math.round(v * 2) / 2 : NaN);
    Object.keys(values).forEach((k) => { values[k] = r1(values[k]); pm[k] = Math.round(pm[k] * 2) / 2; });
    Object.keys(extras).forEach((k) => { extras[k] = r1(extras[k]); });
    return { values, pm, extras, extraPm, flags: Object.keys(front.flags) };
  }

  const api = { ellipsePerimeter, median, maskTools, measureFrontFrame, measureSideFrame, combine, finish, BODY_SHAPE_K };
  root.BodyScanGeometry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

// ---------------------------------------------------------------------
// The scan screens (browser only).
// ---------------------------------------------------------------------
(function () {
  if (typeof document === "undefined") return;
  const entryBtn = document.getElementById("bodyScanBtn");
  if (!entryBtn || typeof MEASUREMENTS === "undefined") return;
  const G = window.BodyScanGeometry;

  const MP_VERSION = "0.10.14";
  const MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VERSION;
  const MODEL_LIVE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
  const MODEL_MEASURE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";
  const FRAMES_PER_POSE = 5;

  // Measurement names for the results list, in order.
  const SITE_ROWS = [
    ["body_neck", "jacket"], ["body_chest", "jacket"], ["body_stomach", "jacket"], ["body_seat", "jacket"],
    ["body_bicep", "jacket"], ["body_shoulder", "jacket"], ["body_sleeve", "jacket"], ["body_nape_waist", "jacket"],
    ["body_back_length", "jacket"], ["body_front_waist", "jacket"],
    ["body_waist", "pants"], ["body_thigh", "pants"], ["body_u_rise", "pants"], ["body_front_waist_h", "pants"],
    ["body_back_waist_h", "pants"], ["body_outseam", "pants"],
  ];
  // Optional factory body positions the site's form doesn't ask for.
  const EXTRA_ROWS = [
    ["stomach_high", "Fullest Point of Stomach"],
    ["front_shoulder", "Front Shoulder"],
    ["back_width", "Back Width"],
    ["front_chest_width", "Front Chest Width"],
    ["calf", "Calf"],
  ];
  // Style choices, not body sizes: flagged so the customer knows.
  const STYLE_IDS = { body_back_length: "Classic length, half your nape-to-floor height", body_front_waist_h: "Trousers sitting just below the navel", body_back_waist_h: "Trousers sitting just below the navel", body_outseam: "To the top of the shoe heel" };

  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const mDef = (id) => MEASUREMENTS.find((m) => m.id === id);
  const inches = (cm) => Math.round((cm / 2.54) * 4) / 4;

  let state = null;
  let sheet = null;
  let vision = null;
  let liveModel = null;
  let measureModelPromise = null;

  // ---- the sheet (same page lock as the other sheets) ----
  function onKey(e) { if (e.key === "Escape") closeSheet(); }
  function openSheet(html, full) {
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "wiz-sheet ps-sheet bs-sheet";
      document.body.appendChild(sheet);
      document.body.classList.add("wiz-lock");
      document.documentElement.classList.add("wiz-lock");
      document.addEventListener("keydown", onKey);
      sheet.addEventListener("touchmove", (e) => {
        if (!e.target.closest || !e.target.closest(".ps-body")) e.preventDefault();
      }, { passive: false });
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
    sheet.classList.toggle("bs-full", !!full);
    sheet.innerHTML = '<div class="wiz-sheet-card ps-card bs-card" role="dialog" aria-modal="true" aria-label="Body scan">' + html + "</div>";
    sheet.querySelectorAll(".wiz-close").forEach((b) => (b.onclick = closeSheet));
  }
  function closeSheet() {
    stopCamera();
    if (!sheet) return;
    if (sheet._unlift) sheet._unlift();
    sheet.remove();
    sheet = null;
    document.body.classList.remove("wiz-lock");
    document.documentElement.classList.remove("wiz-lock");
    document.removeEventListener("keydown", onKey);
  }
  const head = (title) => '<div class="wiz-sheet-head"><h3>' + esc(title) + '</h3><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>';

  // ---- voice cues (the phone is often across the room) ----
  let lastSpoken = "", lastSpokenAt = 0;
  function say(text, force) {
    if (!state || !state.voice || !window.speechSynthesis) return;
    const now = Date.now();
    if (!force && (text === lastSpoken || now - lastSpokenAt < 2600)) return;
    lastSpoken = text;
    lastSpokenAt = now;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---- height from the form (stored in inches) ----
  function formHeightCm() {
    const el = document.getElementById("m_height");
    const v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) && v > 0 ? Math.round(v * 2.54 * 10) / 10 : NaN;
  }

  // ---- step 1: what you need ----
  function showIntro(msg) {
    const h = formHeightCm();
    const ft = isFinite(h) ? Math.floor(h / 2.54 / 12) : "";
    const inch = isFinite(h) ? Math.round((h / 2.54 - ft * 12) * 2) / 2 : "";
    openSheet(head("Scan My Body") +
      '<div class="ps-body bs-intro">' +
      (msg ? '<p class="bs-alert">' + esc(msg) + "</p>" : "") +
      '<p class="bs-lead">Your phone takes two photos, from the front and from the side, and works out your body measurements. Takes about 2 minutes.</p>' +
      '<div class="bs-poses" aria-hidden="true">' + poseSvg("front") + poseSvg("side") + "</div>" +
      '<ol class="bs-tips">' +
      "<li><b>Wear fitted clothes:</b> a snug T-shirt and shorts or leggings. No jacket, no baggy clothes.</li>" +
      "<li><b>Barefoot or socks,</b> hair flat, nothing in your pockets.</li>" +
      "<li><b>Plain wall, good light,</b> nothing else in the picture.</li>" +
      "<li><b>Phone at waist height,</b> about 8 to 10 feet away, held by a friend or leaned against something.</li>" +
      "</ol>" +
      '<div class="bs-field"><label>Your height <span>(the scan uses it as its ruler, so be exact)</span></label>' +
      '<div class="bs-height"><div class="measure-input-wrap"><input type="number" id="bsFt" min="4" max="7" step="1" placeholder="5" value="' + ft + '" inputmode="numeric"><span class="unit">ft</span></div>' +
      '<div class="measure-input-wrap"><input type="number" id="bsIn" min="0" max="11.5" step="0.5" placeholder="10" value="' + inch + '" inputmode="decimal"><span class="unit">in</span></div></div></div>' +
      '<div class="bs-field"><label>Who\'s taking the photos?</label>' +
      '<div class="ps-type bs-who"><button type="button" data-who="self" class="selected">Just me</button><button type="button" data-who="friend">A friend</button></div></div>' +
      '<p class="bs-small">Your photos stay on your phone; only the measurements are saved. Our tailor reviews every scan before your suit is cut.</p>' +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-start">Start the Scan</button>' +
      '<button type="button" class="btn-ghost bs-upload">Upload two photos instead</button></div>');
    let who = "self";
    sheet.querySelectorAll(".bs-who button").forEach((b) => (b.onclick = () => {
      who = b.dataset.who;
      sheet.querySelectorAll(".bs-who button").forEach((x) => x.classList.toggle("selected", x === b));
    }));
    const readHeight = () => {
      const f = parseFloat(sheet.querySelector("#bsFt").value);
      const i = parseFloat(sheet.querySelector("#bsIn").value) || 0;
      const cm = (f * 12 + i) * 2.54;
      return isFinite(cm) && cm >= 122 && cm <= 244 ? cm : NaN;
    };
    sheet.querySelector(".bs-start").onclick = () => {
      const hcm = readHeight();
      if (!isFinite(hcm)) { showIntro("Please enter your height first."); return; }
      state = { heightCm: hcm, who, voice: true, frames: { front: [], side: [] } };
      // iPhone only lets a page speak after a tap: say something now.
      say(who === "self" ? "Lean your phone at waist height, then step back until you're fully in the picture." : "Point the camera at the person. Keep the phone at their waist height.", true);
      startCamera();
    };
    sheet.querySelector(".bs-upload").onclick = () => {
      const hcm = readHeight();
      if (!isFinite(hcm)) { showIntro("Please enter your height first."); return; }
      state = { heightCm: hcm, who, voice: false, frames: { front: [], side: [] } };
      showUpload();
    };
  }

  // Little figure drawings for the two poses.
  function poseSvg(kind) {
    const front =
      '<circle cx="40" cy="14" r="8"/><path d="M40 22v38M40 30l-20 20M40 30l20 20M40 60l-12 34M40 60l12 34"/>';
    const side =
      '<circle cx="40" cy="14" r="8"/><path d="M40 22v38M40 30l2 30M40 60l-2 34M40 60l3 34"/>';
    return '<figure><svg viewBox="0 0 80 100" class="bs-pose-svg">' + (kind === "front" ? front : side) + "</svg><figcaption>" +
      (kind === "front" ? "1. Face the phone, arms out, feet apart" : "2. Turn to your side, arms down") + "</figcaption></figure>";
  }

  // ---- the pose models (loaded only when the scan starts) ----
  async function loadVision() {
    if (vision) return vision;
    const mod = await import(MP_BASE + "/vision_bundle.mjs");
    const fileset = await mod.FilesetResolver.forVisionTasks(MP_BASE + "/wasm");
    vision = { mod, fileset };
    return vision;
  }
  async function makeModel(path, mode, masks) {
    const v = await loadVision();
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: path, delegate },
      runningMode: mode,
      numPoses: 1,
      outputSegmentationMasks: !!masks,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      return await v.mod.PoseLandmarker.createFromOptions(v.fileset, opts("GPU"));
    } catch (e) {
      return await v.mod.PoseLandmarker.createFromOptions(v.fileset, opts("CPU"));
    }
  }
  function measureModel() {
    if (!measureModelPromise) measureModelPromise = makeModel(MODEL_MEASURE, "IMAGE", true).catch((e) => { measureModelPromise = null; throw e; });
    return measureModelPromise;
  }

  // ---- step 2: the camera ----
  let stream = null, rafId = 0;
  function stopCamera() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }
  async function startCamera() {
    openSheet(
      '<div class="bs-cam">' +
      '<video class="bs-video" playsinline muted autoplay></video>' +
      '<canvas class="bs-overlay"></canvas>' +
      '<div class="bs-cam-top"><span class="bs-step">Getting the camera ready&hellip;</span><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>' +
      '<div class="bs-cam-msg" role="status" aria-live="polite">Loading&hellip;</div>' +
      '<div class="bs-count" hidden></div>' +
      '<div class="bs-cam-bottom"><button type="button" class="bs-voice" aria-pressed="true">Voice on</button><button type="button" class="bs-flip">Switch camera</button></div>' +
      "</div>", true);
    const video = sheet.querySelector(".bs-video");
    sheet.querySelector(".bs-voice").onclick = (e) => {
      state.voice = !state.voice;
      e.target.textContent = state.voice ? "Voice on" : "Voice off";
      e.target.setAttribute("aria-pressed", state.voice ? "true" : "false");
      if (!state.voice) try { window.speechSynthesis.cancel(); } catch (x) {}
    };
    sheet.querySelector(".bs-flip").onclick = () => {
      state.who = state.who === "self" ? "friend" : "self";
      stopCamera();
      startCamera();
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: state.who === "self" ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1920 } },
      });
    } catch (e) {
      showIntro("We couldn't open the camera. Allow camera access for this site in your phone's settings, or upload two photos instead.");
      return;
    }
    if (!sheet) { stopCamera(); return; }
    video.srcObject = stream;
    video.classList.toggle("bs-mirror", state.who === "self");
    sheet.querySelector(".bs-overlay").classList.toggle("bs-mirror", state.who === "self");
    try { await video.play(); } catch (e) {}
    try {
      if (!liveModel) liveModel = await makeModel(MODEL_LIVE, "VIDEO", false);
    } catch (e) {
      showIntro("The scanner didn't load. Check your connection and try again, or upload two photos instead.");
      return;
    }
    measureModel().catch(() => {}); // start loading the measuring model now
    state.pose = state.frames.front.length ? "side" : "front";
    state.okSince = 0;
    state.history = [];
    runLive(video);
  }

  // Is the person standing the way the scan needs? Returns a message to
  // show (and say), or "" when everything is right.
  function poseProblem(lm, pose) {
    if (!lm) return "Step into the picture so we can see all of you.";
    const vis = (i) => (lm[i].visibility == null ? 1 : lm[i].visibility);
    const need = [0, 11, 12, 23, 24, 25, 26, 27, 28];
    const seen = need.filter((i) => vis(i) > 0.5).length;
    const nose = lm[0];
    const sh = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 };
    const hip = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 };
    const T = hip.y - sh.y;
    const feetY = Math.max(lm[27].y, lm[28].y, lm[29].y, lm[30].y, lm[31].y, lm[32].y);
    const headTop = nose.y - (sh.y - nose.y) * 0.9;
    if (headTop < 0.02) return "Step back, or tilt the phone, so your head is in the picture.";
    if (feetY > 0.975 || seen < need.length) return "Step back until your feet are in the picture.";
    const bodyH = feetY - headTop;
    if (bodyH < 0.55) return "Come a little closer to the phone.";
    if (bodyH > 0.94) return "Step back a little.";
    const cx = (sh.x + hip.x) / 2;
    if (cx < 0.3 || cx > 0.7) return "Move to the middle of the picture.";
    const shoulderW = Math.abs(lm[11].x - lm[12].x);
    const armAngle = (s, w) => (Math.atan2(Math.abs(lm[w].x - lm[s].x), lm[w].y - lm[s].y) * 180) / Math.PI;
    if (pose === "front") {
      if (shoulderW < T * 0.55) return "Face the phone straight on.";
      const a1 = armAngle(11, 15), a2 = armAngle(12, 16);
      if (a1 < 28 || a2 < 28) return "Lift your arms out from your sides, like a star.";
      if (a1 > 65 || a2 > 65) return "Lower your arms a little.";
      const feet = Math.abs(lm[27].x - lm[28].x);
      if (feet < Math.abs(lm[23].x - lm[24].x) * 1.1) return "Stand with your feet a little apart.";
    } else {
      if (shoulderW > T * 0.32) return "Turn to your side, so your shoulder faces the phone.";
      const a1 = armAngle(11, 15), a2 = armAngle(12, 16);
      if (Math.max(a1, a2) > 24) return "Let your arms hang straight down by your sides.";
    }
    return "";
  }
  function stillness(history) {
    if (history.length < 12) return Infinity;
    const pts = [0, 11, 12, 23, 24, 27, 28];
    let maxMove = 0;
    const a = history[0], b = history[history.length - 1];
    pts.forEach((i) => { maxMove = Math.max(maxMove, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)); });
    return maxMove;
  }

  function runLive(video) {
    const canvas = sheet && sheet.querySelector(".bs-overlay");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const msgEl = sheet.querySelector(".bs-cam-msg");
    const stepEl = sheet.querySelector(".bs-step");
    const countEl = sheet.querySelector(".bs-count");
    let lastTs = -1;
    let counting = false;
    const stepLabel = () => (state.pose === "front" ? "Photo 1 of 2: front" : "Photo 2 of 2: side");
    stepEl.textContent = stepLabel();
    say(state.pose === "front" ? "Face the phone. Arms out like a star, feet apart." : "Now turn to your side, arms straight down.", true);
    const tick = () => {
      if (!sheet || !stream) return;
      rafId = requestAnimationFrame(tick);
      if (video.readyState < 2 || !video.videoWidth) return;
      if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      const ts = performance.now();
      if (ts <= lastTs) return;
      lastTs = ts;
      let lm = null;
      try {
        const res = liveModel.detectForVideo(video, ts);
        lm = res && res.landmarks && res.landmarks[0] ? res.landmarks[0] : null;
      } catch (e) { return; }
      drawGuide(ctx, canvas, lm);
      if (counting) return;
      const problem = poseProblem(lm, state.pose);
      if (lm) { state.history.push(lm.map((p) => ({ x: p.x, y: p.y }))); if (state.history.length > 15) state.history.shift(); }
      if (problem) {
        state.okSince = 0;
        msgEl.textContent = problem;
        msgEl.classList.remove("bs-ok");
        say(problem);
        return;
      }
      msgEl.textContent = "Perfect. Hold still.";
      msgEl.classList.add("bs-ok");
      if (!state.okSince) { state.okSince = ts; say("Perfect. Hold still.", true); }
      if (ts - state.okSince > 900 && stillness(state.history) < 0.012) {
        counting = true;
        countdown(countEl, () => {
          captureFrames(video).then((frames) => {
            state.frames[state.pose] = frames;
            if (state.pose === "front") {
              state.pose = "side";
              state.okSince = 0;
              state.history = [];
              counting = false;
              stepEl.textContent = stepLabel();
              say("Got it. Now turn to your side, arms straight down.", true);
              msgEl.textContent = "Got it. Now turn to your side, arms straight down.";
              msgEl.classList.remove("bs-ok");
            } else {
              say("All done. Working out your measurements.", true);
              stopCamera();
              analyze();
            }
          });
        });
      }
    };
    rafId = requestAnimationFrame(tick);
  }
  function countdown(el, done) {
    let n = 3;
    el.hidden = false;
    const step = () => {
      if (!sheet) return;
      if (n === 0) { el.hidden = true; done(); return; }
      el.textContent = n;
      say(String(n), true);
      n--;
      setTimeout(step, 900);
    };
    step();
  }
  // A few frames, a moment apart, for the median.
  async function captureFrames(video) {
    const out = [];
    for (let i = 0; i < FRAMES_PER_POSE; i++) {
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      out.push(c);
      await new Promise((r) => setTimeout(r, 180));
    }
    return out;
  }
  // Skeleton over the video, gold when the pose is right.
  function drawGuide(ctx, canvas, lm) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const W = canvas.width, H = canvas.height;
    const lines = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
    const ok = state && state.okSince;
    ctx.lineWidth = Math.max(3, W / 220);
    ctx.strokeStyle = ok ? "rgba(201,164,103,0.95)" : "rgba(255,255,255,0.8)";
    ctx.beginPath();
    lines.forEach(([a, b]) => { ctx.moveTo(lm[a].x * W, lm[a].y * H); ctx.lineTo(lm[b].x * W, lm[b].y * H); });
    ctx.stroke();
  }

  // ---- upload instead ----
  function showUpload(msg) {
    openSheet(head("Upload Two Photos") +
      '<div class="ps-body bs-intro">' +
      (msg ? '<p class="bs-alert">' + esc(msg) + "</p>" : "") +
      '<p class="bs-lead">Full-length photos, taken from waist height, head to feet in the picture, on a plain background.</p>' +
      '<div class="bs-uploads">' +
      '<label class="bs-up"><input type="file" accept="image/*" data-pose="front" hidden>' + poseSvg("front") + '<span class="bs-up-state">Choose photo</span></label>' +
      '<label class="bs-up"><input type="file" accept="image/*" data-pose="side" hidden>' + poseSvg("side") + '<span class="bs-up-state">Choose photo</span></label>' +
      "</div></div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-go" disabled>Measure Me</button></div>');
    const picked = {};
    sheet.querySelectorAll(".bs-up input").forEach((input) => {
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          picked[input.dataset.pose] = c;
          input.parentNode.classList.add("bs-up-done");
          input.parentNode.querySelector(".bs-up-state").textContent = "Photo added";
          sheet.querySelector(".bs-go").disabled = !(picked.front && picked.side);
        };
        img.src = URL.createObjectURL(f);
      };
    });
    sheet.querySelector(".bs-go").onclick = () => {
      state.frames.front = [picked.front];
      state.frames.side = [picked.side];
      state.uploaded = true;
      analyze();
    };
  }

  // ---- step 3: measuring ----
  function showWorking(text) {
    openSheet(head("Scan My Body") +
      '<div class="ps-body ps-loading"><span class="ps-spinner" aria-hidden="true"></span><b>' + esc(text) + "</b>" +
      "<p>Measuring your photos on your phone. This takes about half a minute.</p></div>");
  }
  function detectStill(model, canvas) {
    return new Promise((resolve) => {
      try {
        model.detect(canvas, (res) => {
          const lm = res && res.landmarks && res.landmarks[0];
          const mk = res && res.segmentationMasks && res.segmentationMasks[0];
          if (!lm || !mk) { resolve(null); return; }
          // The mask is only valid inside this callback: copy it out.
          const data = new Float32Array(mk.getAsFloat32Array());
          resolve({ lm: lm.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })), mask: { data, width: mk.width, height: mk.height } });
        });
      } catch (e) { resolve(null); }
    });
  }
  async function analyze() {
    showWorking("Working out your measurements…");
    let model;
    try { model = await measureModel(); } catch (e) {
      showIntro("The scanner didn't load. Check your connection and try again.");
      return;
    }
    const frontDet = [];
    for (const c of state.frames.front) { const d = await detectStill(model, c); if (d) frontDet.push(d); }
    const sideDet = [];
    for (const c of state.frames.side) { const d = await detectStill(model, c); if (d) sideDet.push(d); }
    const fronts = frontDet.map((d) => G.measureFrontFrame(d.lm, d.mask));
    const base = G.combine(fronts);
    if (base.error) {
      const msg = "We couldn't see you clearly in the front photo.";
      return state.uploaded ? showUpload(msg + " Try a brighter photo with your whole body in it.") : showIntro(msg + " Let's try again.");
    }
    const sides = sideDet.map((d) => G.measureSideFrame(d.lm, d.mask, base.sideFracs)).filter((s) => !s.error);
    if (!sides.length) return state.uploaded ? showUpload("We couldn't see you clearly in the side photo.") : showIntro("We couldn't see you clearly in the side photo. Let's try again.");
    const result = G.finish(base, sides, state.heightCm);
    // Drop the photos now: nothing leaves the phone.
    state.frames = { front: [], side: [] };
    showResults(result);
  }

  // ---- step 4: check the numbers ----
  function showResults(result) {
    state = state || { heightCm: formHeightCm() || 178, who: "self" };
    state.result = result;
    const warn = [];
    if (result.flags.indexOf("arms") !== -1) warn.push("Your arms looked close to your sides, so the chest may read big.");
    if (result.flags.indexOf("legs") !== -1) warn.push("We couldn't see a gap between your legs, so the thigh and rise are rough.");
    const row = (id, label, val, pm, note) => {
      const def = mDef(id);
      const bad = !isFinite(val) || (def && (val < def.min || val > def.max));
      return '<div class="bs-row' + (bad ? " bs-row-bad" : "") + '"><div class="bs-row-text"><span class="bs-row-label">' + esc(label) + "</span>" +
        (note ? '<span class="bs-row-note">' + esc(note) + "</span>" : "") + "</div>" +
        '<div class="measure-input-wrap bs-row-input"><input type="number" step="0.5" inputmode="decimal" data-id="' + esc(id) + '" value="' + (isFinite(val) ? val : "") + '"><span class="unit">cm</span></div>' +
        '<span class="bs-row-pm">' + (isFinite(val) ? "&plusmn;" + pm + " cm &middot; " + inches(val) + " in" : "Measure by hand") + "</span></div>";
    };
    const jacketRows = SITE_ROWS.filter((r) => r[1] === "jacket").map((r) => row(r[0], mDef(r[0]).label, result.values[r[0]], result.pm[r[0]], STYLE_IDS[r[0]])).join("");
    const pantsRows = SITE_ROWS.filter((r) => r[1] === "pants").map((r) => row(r[0], mDef(r[0]).label, result.values[r[0]], result.pm[r[0]], STYLE_IDS[r[0]])).join("");
    const extraRows = EXTRA_ROWS.map((r) => row("x_" + r[0], r[1], result.extras[r[0]], result.extraPm[r[0]], "")).join("");
    openSheet(head("Your Measurements") +
      '<div class="ps-body bs-results">' +
      '<p class="bs-lead">Here\'s what the scan measured. Check anything that looks off; you can change any number.</p>' +
      warn.map((w) => '<p class="bs-alert">' + esc(w) + "</p>").join("") +
      '<div class="ps-group">Jacket</div>' + jacketRows +
      '<div class="ps-group">Pants</div>' + pantsRows +
      '<details class="bs-extra"><summary>Extra measurements for our tailor</summary>' + extraRows + "</details>" +
      '<p class="bs-small">A phone scan is usually within about an inch. The &plusmn; next to each number is the scan\'s own margin. Our tailor reviews every scan, and may message you to double-check a number before your suit is cut.</p>' +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-use">Use These Measurements</button>' +
      '<button type="button" class="btn-ghost bs-again">Scan again</button></div>');
    sheet.querySelector(".bs-again").onclick = () => showIntro();
    sheet.querySelector(".bs-use").onclick = () => useResults();
  }

  function useResults() {
    const res = state.result;
    const edited = {};
    sheet.querySelectorAll(".bs-row input").forEach((i) => {
      const v = parseFloat(i.value);
      if (isFinite(v) && v > 0) edited[i.dataset.id] = Math.round(v * 10) / 10;
    });
    // Body measurements mode, then fill the fields.
    if (typeof setMeasureMode === "function") setMeasureMode("body");
    const hEl = document.getElementById("m_height");
    if (hEl && isFinite(state.heightCm)) {
      hEl.value = String(Math.round((state.heightCm / 2.54) * 10) / 10);
      if (typeof renderMeasurementFields === "function") renderMeasurementFields();
    }
    SITE_ROWS.forEach(([id]) => {
      const el = document.getElementById("m_" + id);
      if (el && edited[id] !== undefined) el.value = edited[id];
    });
    const extras = {};
    EXTRA_ROWS.forEach(([id]) => { if (edited["x_" + id] !== undefined) extras[id] = edited["x_" + id]; });
    window.__bodyScan = {
      at: new Date().toISOString(),
      heightCm: Math.round(state.heightCm * 10) / 10,
      source: state.uploaded ? "uploaded photos" : "live camera",
      scanned: res.values,
      pm: res.pm,
      extras,
      extraPm: res.extraPm,
      flags: res.flags,
    };
    if (typeof saveDraft === "function") saveDraft();
    closeSheet();
    const note = document.getElementById("bodyScanDone");
    if (note) note.hidden = false;
    const grid = document.getElementById("measureGrid");
    if (grid && typeof smoothScrollWindowTo === "function" && typeof getNavClearance === "function") {
      smoothScrollWindowTo(window.scrollY + grid.getBoundingClientRect().top - 20 - getNavClearance());
    }
  }

  entryBtn.addEventListener("click", () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      state = null;
      showIntro();
      return;
    }
    showIntro();
  });

  // For previews and testing: show the results screen with given numbers.
  window.__bodyScanPreview = (result) => showResults(result);
})();
