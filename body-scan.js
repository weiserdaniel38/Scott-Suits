// ---------------------------------------------------------------------
// Phone Body Scan (Daniel, 2026-11-03)
//
// "Scan my body with my phone" on the Measurements step. The customer
// faces the phone in the "goalpost" pose (upper arms out at shoulder
// height, elbows bent, forearms straight up, fists closed), then keeps
// that pose and turns around once,
// slowly (like MTailor). The phone measures every frame as they turn and
// works out their BODY measurements (the factory's body list, the optional
// positions too), using their height for the scale.
//
// HIDDEN FOR NOW (Daniel: "don't add yet"): index.html only loads this
// file, and shows the card, when the page address has ?bodyscan=1.
//
// How it works, all on the customer's own phone (nothing is recorded or
// uploaded; only numbers are kept):
//   1. Google's MediaPipe Pose Landmarker ("full" model, loaded from the
//      jsDelivr / Google model CDN only when the scan opens) finds 33 body
//      points and an outline of the person in each video frame.
//   2. Height in pixels (top of the head to the floor) against the height
//      the customer typed gives centimeters per pixel, frame by frame.
//   3. The facing-the-phone frames give the lengths (arm, outseam, nape to waist,
//      ...) and the leg and arm widths.
//   4. While turning, each frame gives the body's width at the chest,
//      stomach, waist, seat and neck, and the turn angle (from how far
//      apart the shoulders look). Girth = pi x the average width over the
//      turn (Cauchy's formula: true for any convex outline, which is what
//      a tape measure follows), so no shape guess is needed. Thigh and calf
//      still use front width x side depth as an ellipse (legs overlap when
//      turning).
//   5. The customer checks the numbers; our tailor reviews every scanned
//      order before it goes to the factory (the scan is written into the
//      order text, extra optional factory positions included).
//
// Accuracy: the turn-around girths need no shape guess; the lengths and
// leg girths still use first-guess corrections from standard body
// proportions (BODY_SHAPE_K, ARM_SHOULDER_POINT_CM, NAPE_ABOVE_SHOULDER,
// SHOULDER_JOINT_TO_POINTS_CM) that should be tuned against real tape
// measurements of scanned people.
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

  // Tailor's shoulder (point to point over the back) is about this much
  // more than the distance between the shoulder joints the model finds.
  const SHOULDER_JOINT_TO_POINTS_CM = 9;
  // A spin is split into this many 15-degree slices of half a turn.
  const SPIN_BINS = 12;

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
    out.shoulderJointPx = shoulderDist;
    out.sh2d = shoulderDist / Hpx;
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
    // How far apart the shoulders look (share of height): widest facing
    // the camera, near zero side-on. Gives the turn angle in a spin.
    const out = { top, floor, Hpx, depth: {}, sh2d: Math.hypot(P[11].x - P[12].x, P[11].y - P[12].y) / Hpx };
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
  // opts.spin: { thetas, frames } from a turn-around video: the girths
  // then come from every angle (spinGirth) instead of an ellipse, and the
  // shoulder from the joints (the raised arms hide the shoulder caps).
  function finish(front, sidesMeasured, heightCm, opts) {
    opts = opts || {};
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
    if (opts.spin) {
      const sp = opts.spin;
      [["body_chest", "chest", 2.5], ["body_stomach", "stomach", 2.5], ["body_waist", "waist", 2.5], ["body_seat", "seat", 2.5], ["body_neck", "neck", 1.5]].forEach(([id, k, base]) => {
        const g = spinGirth(sp.frames, sp.thetas, k, heightCm);
        if (isFinite(g.value)) { values[id] = g.value; pm[id] = Math.max(base, g.pm); }
      });
    }
    // Upper arm: round enough that the front width alone does.
    const bic = fronts.map((f) => Math.PI * cm(f, "bicepW") * 0.97);
    values.body_bicep = median(bic);
    pm.body_bicep = Math.max(2, spread(bic) * 2);
    const shoulders = opts.spin
      ? fronts.map((f) => cm(f, "shoulderJointPx") + SHOULDER_JOINT_TO_POINTS_CM)
      : fronts.map((f) => cm(f, "shoulderW") * 0.97);
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
      let g = ellipsePerimeter(w, d) * BODY_SHAPE_K.stomach;
      if (opts.spin) { const sg = spinGirth(opts.spin.frames, opts.spin.thetas, k, heightCm).value; if (isFinite(sg)) g = sg; }
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

  // Turn angle (degrees, counting up from 0 facing the camera to 360 back
  // at the front) for each spin frame, from how far apart the shoulders
  // look compared with facing the camera (cos of the angle). The person
  // turns one way, so the angle only goes up: each frame takes the
  // reading of its cosine closest to the last angle without going back.
  function spinAngles(frames, frontSh2d) {
    const out = [];
    let prev = 0;
    frames.forEach((f) => {
      const r = Math.max(0, Math.min(1, f.sh2d / frontSh2d));
      const a = (Math.acos(r) * 180) / Math.PI;
      const cands = [];
      for (let k = 0; k <= 2; k++) cands.push(k * 180 + a, k * 180 + 180 - a);
      // Closest reading to the last angle; noise near facing front or
      // back can read a little behind, and no real turn jumps 45 degrees
      // between frames.
      let best = null;
      cands.forEach((c) => {
        if (c < prev - 30 || c > prev + 45) return;
        if (best === null || Math.abs(c - prev) < Math.abs(best - prev)) best = c;
      });
      const t = best === null ? prev : Math.max(prev, best);
      out.push(t);
      prev = t;
    });
    return out;
  }
  // Girth from widths seen all the way round. For any convex shape the
  // perimeter is pi times its average width over half a turn (Cauchy's
  // formula), and a tape measure goes round the convex outline, so no
  // shape guess is needed. Widths are averaged in 15-degree slices first,
  // so turning faster in one part of the circle doesn't skew it.
  function spinGirth(frames, thetas, key, heightCm) {
    const bins = [];
    for (let i = 0; i < SPIN_BINS; i++) bins.push([]);
    frames.forEach((f, i) => {
      const w = (f.depth[key] / f.Hpx) * heightCm;
      if (!isFinite(w) || w <= 0) return;
      const t = ((thetas[i] % 180) + 180) % 180;
      bins[Math.min(SPIN_BINS - 1, Math.floor(t / (180 / SPIN_BINS)))].push(w);
    });
    const means = bins.map((b) => (b.length ? median(b) : NaN));
    const filled = means.filter((v) => isFinite(v)).length;
    if (filled < SPIN_BINS - 3) return { value: NaN, pm: NaN, filled };
    // Fill an empty slice from its neighbours (round the circle).
    const full = means.map((v, i) => {
      if (isFinite(v)) return v;
      let a = 1, b = 1;
      while (!isFinite(means[(i - a + SPIN_BINS) % SPIN_BINS])) a++;
      while (!isFinite(means[(i + b) % SPIN_BINS])) b++;
      const va = means[(i - a + SPIN_BINS) % SPIN_BINS], vb = means[(i + b) % SPIN_BINS];
      return va + ((vb - va) * a) / (a + b);
    });
    const avgW = full.reduce((x, y) => x + y, 0) / SPIN_BINS;
    // Margin: frame-to-frame scatter within slices, plus empty slices.
    const scatter = median(bins.filter((b) => b.length > 1).map((b) => spread(b)));
    const pm = Math.PI * ((isFinite(scatter) ? scatter : 1) / Math.sqrt(3) + (SPIN_BINS - filled) * 0.4);
    return { value: Math.PI * avgW, pm, filled };
  }

  const api = { ellipsePerimeter, median, maskTools, measureFrontFrame, measureSideFrame, combine, finish, spinAngles, spinGirth, BODY_SHAPE_K, SPIN_BINS };
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
  const box = document.getElementById("bodyScanBox");
  if (box) box.hidden = false;
  // The test link (?bodyscan=1) jumps straight to the Measurements step
  // and the scan card (Daniel: "Have the link take me directly to measurements").
  setTimeout(() => {
    try {
      const meas = document.getElementById("measurementsSection");
      const cur = document.querySelector(".step.active");
      if (!meas || !cur || typeof goToStep !== "function") return;
      if (cur !== meas) goToStep(cur, meas);
      setTimeout(() => { if (box) box.scrollIntoView({ block: "center", behavior: "smooth" }); }, 900);
    } catch (e) {}
  }, 600);
  const G = window.BodyScanGeometry;

  const MP_VERSION = "0.10.14";
  const MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VERSION;
  // "Full" pose model: quick enough to measure every frame while the
  // person turns, with the person's outline (segmentation mask).
  const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

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
  let model = null;

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
    // Every scan screen fills the phone (Daniel: "a completely immersive
    // experience"); the camera screen also drops the padding.
    sheet.classList.add("bs-full");
    sheet.classList.toggle("bs-camera", !!full);
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
  // The voice. Recorded clips of a natural male voice (assets/voice/*.mp3)
  // when VOICE_CLIPS is on; otherwise the phone's own voice, picking a
  // male one (Daniel: "I want it to be male and sound natural").
  const VOICE_CLIPS = true; // OpenAI "echo" voice (Daniel picked it), recorded 2026-11-03 (supabase/functions/scan-voice)
  const VOICE_V = "echo3"; // bump when the clips are re-recorded
  const CLIP_FOR = {
    "Lean the phone on the floor. Step back.": "floor", "Hold the phone at waist height.": "hold",
    "Face the phone. Arms up.": "face", "Perfect. Hold still.": "perfect", "3": "3", "2": "2", "1": "1",
    "Now turn slowly, all the way around.": "turn", "Keep turning, slowly.": "keep", "Halfway.": "half",
    "Almost there.": "almost", "Done.": "done", "Arms up.": "armsup", "Arms up, like the picture.": "armspic",
    "Step into the picture.": "enter", "Step back. Show your head.": "head", "Step back. Show your feet.": "feet",
    "Come closer.": "closer", "Step back a little.": "back", "Move to the middle.": "middle",
    "Face the phone.": "facephone", "Feet a little apart.": "apart",
    "Great, that's a good spot.": "spot", "Great, that's a good spot. Now raise your arms, like the picture.": "spotarms",
    "Got it. Now turn slowly, all the way around.": "gotit", "Perfect.": "perfectonly",
  };
  let clipAudio = null;
  // Fetch every clip once when the scan starts, so each line plays at once.
  function preloadVoice() {
    if (!VOICE_CLIPS || preloadVoice.done) return;
    preloadVoice.done = true;
    Object.values(CLIP_FOR).forEach((c) => { try { fetch("./assets/voice/" + c + ".mp3?v=" + VOICE_V).catch(() => {}); } catch (e) {} });
  }
  // Best male English voice on this phone: enhanced/premium/natural ones
  // first, then known male voice names. Robotic novelty voices are skipped.
  const MALE = /\b(aaron|arthur|daniel|gordon|alex|evan|nathan|tom|reed|oliver|rishi|lee|guy|andrew|christopher|eric|brian|davis|roger|ryan|thomas|male)\b/i;
  const ROBOT = /\b(fred|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|grandpa|rocko|eddy|reed \(|sandy|shelley|flo)\b/i;
  let maleVoice;
  function pickVoice() {
    if (maleVoice !== undefined) return maleVoice;
    const vs = (window.speechSynthesis.getVoices() || []).filter((v) => /^en/i.test(v.lang) && !ROBOT.test(v.name));
    if (!vs.length) return null; // voices not loaded yet; try again next time
    const score = (v) => (MALE.test(v.name) ? 10 : 0) + (/premium|enhanced|natural|neural/i.test(v.name) ? 5 : 0) + (/en-US/i.test(v.lang) ? 1 : 0);
    const best = vs.slice().sort((a, b) => score(b) - score(a))[0];
    maleVoice = best && MALE.test(best.name) ? best : null;
    return maleVoice;
  }
  function say(text, force) {
    if (!state || !state.voice) return;
    const now = Date.now();
    // The same instruction repeats every 4 s until it's fixed (Daniel: "have
    // the voice tell me what it needs me to do").
    if (!force && (now - lastSpokenAt < 2600 || (text === lastSpoken && now - lastSpokenAt < 4000))) return;
    lastSpoken = text;
    lastSpokenAt = now;
    const clip = VOICE_CLIPS && CLIP_FOR[text];
    if (clip) {
      try {
        // One audio element, first played inside the Start tap, so iPhone
        // lets it keep playing later.
        clipAudio = clipAudio || new Audio();
        clipAudio.pause();
        clipAudio.muted = false;
        clipAudio.src = "./assets/voice/" + clip + ".mp3?v=" + VOICE_V;
        clipAudio.play().catch(() => {});
        return;
      } catch (e) {}
    }
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 0.98;
      u.pitch = v ? 1 : 0.85; // no male voice found: lower the default one
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }


  // Small sounds and buzzes at each moment (Android buzzes; iPhone
  // browsers don't allow vibration, so the sound carries it there).
  let audio = null;
  function tone(freq, ms, delay) {
    if (!state || !state.voice) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime + (delay || 0) / 1000;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + ms / 1000 + 0.05);
    } catch (e) {}
  }
  function buzz(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }
  const cue = {
    tick() { tone(880, 120); buzz(30); },
    go() { tone(660, 160); tone(990, 220, 140); buzz([40, 60, 40]); },
    done() { tone(523, 180); tone(659, 180, 150); tone(784, 320, 300); buzz([60, 80, 60, 80, 120]); },
  };

  // ---- height from the form (stored in inches) ----
  function formHeightCm() {
    const el = document.getElementById("m_height");
    const v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) && v > 0 ? Math.round(v * 2.54 * 10) / 10 : NaN;
  }

  // ---- step 1: one simple instruction per page (Daniel: "easy ... very
  // simple instructions ... each page just one instruction") ----
  const intro = { who: "self", ft: "", inch: "" };
  const ICON = {
    shorts: '<svg viewBox="0 0 64 64"><path d="M18 14h28l4 36H36l-4-20-4 20H14z"/><path d="M18 20h28"/></svg>',
    wall: '<svg viewBox="0 0 64 64"><rect x="12" y="18" width="40" height="36" rx="2"/><circle cx="32" cy="9" r="4"/><path d="M32 1v2M24 9h-2M42 9h-2M26 4l1.5 1.5M38 4l-1.5 1.5"/></svg>',
    height: '<svg viewBox="0 0 64 64"><path d="M22 6v52M16 6h12M16 58h12"/><circle cx="42" cy="13" r="5"/><path d="M42 18v18M42 36l-5 20M42 36l5 20M34 24h16"/></svg>',
    floor: '<svg viewBox="0 0 64 64"><path d="M50 6v50"/><path d="M4 56h56"/><rect x="0" y="0" width="14" height="26" rx="2.5" transform="translate(34 30) rotate(-12)"/><path d="M45.5 31.5l3 .5"/></svg>',
    away: '<svg viewBox="0 0 64 64"><circle cx="46" cy="14" r="5"/><path d="M46 19v17M46 36l-5 19M46 36l5 19M38 26h16"/><rect x="4" y="44" width="7" height="12" rx="1.5"/><path d="M15 50h20M19 46l-4 4 4 4M31 46l4 4-4 4"/><path d="M2 56h60"/></svg>',
  };
  const PAGES = [
    { icon: "shorts", title: "Wear shorts. No shirt.", sub: "Or a tight T-shirt." },
    { icon: "wall", title: "Plain wall. Good light.", sub: "Nobody else in the picture." },
    { icon: "height", title: "How tall are you?", height: true },
    { icon: "floor", title: "Put your phone on the floor.", sub: "Lean it against a wall, screen facing you.", who: true },
    { icon: "away", title: "Stand 8 feet away.", sub: "Your whole body in the picture." },
    { img: "./assets/scan-figure-tpose.webp", title: "Arms up, like this." },
    { img: "./assets/scan-figure-turn.webp", title: "Then turn around slowly.", last: true },
  ];
  const HEIGHT_PAGE = 2;
  function showIntro(msg, page) {
    preloadModel();
    if (page == null) page = msg ? PAGES.length - 1 : 0;
    if (intro.ft === "") {
      const h = state && isFinite(state.heightCm) ? state.heightCm : formHeightCm();
      if (isFinite(h)) { intro.ft = Math.floor(h / 2.54 / 12); intro.inch = Math.round((h / 2.54 - intro.ft * 12) * 2) / 2; }
    }
    const pg = PAGES[page];
    const dots = PAGES.map((_, i) => '<i class="' + (i === page ? "on" : i < page ? "done" : "") + '"></i>').join("");
    openSheet(head("Scan My Body") +
      '<div class="ps-body bs-intro bs-page">' +
      (msg ? '<p class="bs-alert">' + esc(msg) + "</p>" : "") +
      '<div class="bs-page-art">' + (pg.img ? '<img class="bs-pose-img bs-page-img" src="' + pg.img + '" alt="">' : '<span class="bs-icon">' + ICON[pg.icon] + "</span>") + "</div>" +
      '<h3 class="bs-page-title">' + esc(pg.title) + "</h3>" +
      (pg.sub ? '<p class="bs-page-sub">' + esc(pg.sub) + "</p>" : "") +
      (pg.height ? '<div class="bs-height bs-page-height"><div class="measure-input-wrap"><input type="number" id="bsFt" min="4" max="7" step="1" placeholder="5" value="' + intro.ft + '" inputmode="numeric"><span class="unit">ft</span></div>' +
        '<div class="measure-input-wrap"><input type="number" id="bsIn" min="0" max="11.5" step="0.5" placeholder="10" value="' + intro.inch + '" inputmode="decimal"><span class="unit">in</span></div></div>' : "") +
      '<div class="bs-dots" aria-hidden="true">' + dots + "</div>" +
      "</div>" +
      '<div class="ps-actions">' +
      (pg.last ? '<button type="button" class="btn-primary bs-start">Start the Scan</button>' +
        '<label class="btn-ghost bs-upload">Use a video I already took<input type="file" accept="video/*" hidden></label>'
        : '<button type="button" class="btn-primary bs-next">Next</button>' +
          (page > 0 ? '<button type="button" class="btn-ghost bs-back">Back</button>' : "")) +
      "</div>");
    const readHeight = () => {
      const f = parseFloat(intro.ft), i = parseFloat(intro.inch) || 0;
      const cm = (f * 12 + i) * 2.54;
      return isFinite(cm) && cm >= 122 && cm <= 244 ? cm : NaN;
    };
    const keepHeight = () => {
      const ftEl = sheet.querySelector("#bsFt"), inEl = sheet.querySelector("#bsIn");
      if (ftEl) { intro.ft = ftEl.value; intro.inch = inEl.value; }
    };
    const friend = sheet.querySelector(".bs-friend");
    if (friend) friend.onclick = () => { intro.who = intro.who === "friend" ? "self" : "friend"; showIntro(null, page); };
    const next = sheet.querySelector(".bs-next");
    if (next) next.onclick = () => {
      keepHeight();
      if (pg.height && (String(intro.ft).trim() === "" || String(intro.inch).trim() === "" || !isFinite(readHeight()))) { showIntro("Fill in feet and inches.", page); return; }
      showIntro(null, page + 1);
    };
    // Height page: Next stays off until both feet and inches are filled in.
    if (pg.height && next) {
      const ftEl = sheet.querySelector("#bsFt"), inEl = sheet.querySelector("#bsIn");
      const check = () => { next.disabled = ftEl.value.trim() === "" || inEl.value.trim() === ""; };
      ftEl.addEventListener("input", check);
      inEl.addEventListener("input", check);
      check();
    }
    const back = sheet.querySelector(".bs-back");
    if (back) back.onclick = () => { keepHeight(); showIntro(null, page - 1); };
    if (!pg.last) return;
    const who = intro.who;
    sheet.querySelector(".bs-start").onclick = () => {
      const hcm = readHeight();
      if (!isFinite(hcm)) { showIntro("Enter your height.", HEIGHT_PAGE); return; }
      state = { heightCm: hcm, who, voice: true };
      tone(1, 10); // wakes the sound up inside the tap (iPhone)
      preloadVoice();
      // iPhone only lets a page speak after a tap: say something now.
      if (who !== "self") { say("Hold the phone at waist height.", true); startCamera(); return; }
      // Unlock the voice inside this tap (iPhone), silently.
      try {
        clipAudio = clipAudio || new Audio();
        clipAudio.muted = true;
        clipAudio.src = "./assets/voice/perfectonly.mp3?v=" + VOICE_V;
        clipAudio.play().then(() => { clipAudio.pause(); clipAudio.muted = false; }).catch(() => { clipAudio.muted = false; });
      } catch (e) {}
      tone(660, 60);
      // Tilt check first (like MTailor). iPhone asks for motion access, and
      // only inside a tap.
      const ask = window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission;
      if (typeof ask === "function") {
        ask.call(DeviceOrientationEvent).then((r) => (r === "granted" ? showLevel() : startCamera())).catch(() => startCamera());
      } else if (window.DeviceOrientationEvent) showLevel();
      else startCamera();
    };
    const fileInput = sheet.querySelector(".bs-upload input");
    fileInput.onclick = (e) => {
      if (!isFinite(readHeight())) { e.preventDefault(); showIntro("Enter your height.", HEIGHT_PAGE); }
    };
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      state = { heightCm: readHeight(), who: "friend", voice: false, uploaded: true };
      startVideoFile(f);
    };
  }

  // ---- tilt check (phone leaning on the floor) ----
  // Two circles: a fixed ring and a dot that moves with the phone's tilt.
  // When they line up the phone leans back at the right angle, the voice
  // says "Perfect." and the camera opens by itself (copied from MTailor).
  // The angle is kept (state.tiltDeg) to correct the perspective later.
  const TILT_TARGET = 78, TILT_OK = 3;
  function showLevel() {
    openSheet('<div class="bs-level">' +
      '<div class="bs-cam-top"><span class="bs-step">Phone angle</span><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>' +
      '<h3 class="bs-page-title">Lean your phone on the floor, screen facing you.</h3>' +
      '<p class="bs-page-sub">When the circles line up, you\'ve got the right angle.</p>' +
      '<p class="bs-level-ok" aria-live="polite"></p>' +
      '<div class="bs-level-track" aria-hidden="true"><span class="bs-level-ring"></span><span class="bs-level-dot"></span></div>' +
      '<button type="button" class="btn-ghost bs-level-skip">Skip</button>' +
      "</div>", true);
    const dot = sheet.querySelector(".bs-level-dot"), okEl = sheet.querySelector(".bs-level-ok");
    let okSince = 0, done = false, got = false, samples = [];
    const finish = (skip) => {
      if (done) return;
      done = true;
      window.removeEventListener("deviceorientation", onTilt);
      if (!skip && samples.length) state.tiltDeg = G.median(samples);
      if (skip) { startCamera(); return; }
      okEl.textContent = "Perfect.";
      sheet.querySelector(".bs-level").classList.add("bs-level-done");
      say("Perfect.", true);
      cue.tick();
      const st = state;
      setTimeout(() => { if (sheet && state === st && !st.preview) startCamera(); }, 1100);
    };
    const onTilt = (e) => {
      if (!sheet || e.beta == null) return;
      got = true;
      const diff = e.beta - TILT_TARGET;
      const px = Math.max(-1, Math.min(1, diff / 25)) * 20; // vh, stays on the track
      dot.style.transform = "translate(-50%, calc(-50% + " + (-px).toFixed(1) + "vh))";
      const ok = Math.abs(diff) < TILT_OK && Math.abs(e.gamma || 0) < 12;
      dot.classList.toggle("on", ok);
      if (!ok) { okSince = 0; samples = []; return; }
      samples.push(e.beta);
      okSince = okSince || performance.now();
      if (performance.now() - okSince > 700) finish(false);
    };
    window.addEventListener("deviceorientation", onTilt);
    sheet.querySelector(".bs-level-skip").onclick = () => finish(true);
    // No tilt sensor (a computer): go straight to the camera.
    setTimeout(() => { if (!got && !done && sheet && !state.preview) finish(true); }, 2000);
  }

  // The two figures on the start screen (Daniel's ChatGPT drawings, gold
  // outlines on transparent).
  function poseSvg(kind) {
    const src = kind === "front" ? "./assets/scan-figure-tpose.webp" : "./assets/scan-figure-turn.webp";
    return '<figure><img class="bs-pose-img" src="' + src + '" alt="" width="200" height="236">' + "<figcaption>" +
      (kind === "front" ? "1. Arms up" : "2. Turn around slowly") + "</figcaption></figure>";
  }

  // ---- the pose model (loaded only when the scan starts) ----
  async function loadVision() {
    if (vision) return vision;
    const mod = await import(MP_BASE + "/vision_bundle.mjs");
    const fileset = await mod.FilesetResolver.forVisionTasks(MP_BASE + "/wasm");
    vision = { mod, fileset };
    return vision;
  }
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function loadModel() {
    if (model) return model;
    const v = await loadVision();
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      outputSegmentationMasks: true,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    let m;
    try {
      // iPhones/iPads: the graphics-chip mode gives a blank body outline
      // there (Daniel's test 2026-11-03: no gold dots, "measure height"),
      // so use the main-chip mode from the start.
      m = await v.mod.PoseLandmarker.createFromOptions(v.fileset, opts(IS_IOS ? "CPU" : "GPU"));
    } catch (e) {
      m = await v.mod.PoseLandmarker.createFromOptions(v.fileset, opts("CPU"));
    }
    // Warm it up once on a blank picture: the very first run on a phone is
    // slow (it sets up the graphics chip), so do it before the camera opens.
    try {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 456;
      m.detectForVideo(c, 1, () => {});
    } catch (e) {}
    model = m;
    return model;
  }
  // Some phones give no body outline from the fast (graphics chip) mode;
  // the slower main-chip mode does.
  async function switchToCpu() {
    try {
      const v = await loadVision();
      const m = await v.mod.PoseLandmarker.createFromOptions(v.fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
        runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: true,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      model = m;
    } catch (e) {}
  }
  // Start loading the scanner as soon as the scan sheet opens, so it's
  // ready by the time the person taps Start (Daniel: "It's not capturing
  // me fast on the first go").
  let modelLoading = null;
  function preloadModel() {
    if (model || modelLoading) return modelLoading;
    modelLoading = loadModel().catch(() => { modelLoading = null; });
    return modelLoading;
  }

  // ---- step 2: the camera (or a video file) ----
  let stream = null, rafId = 0, fileUrl = null;
  // Record the scan (small, low quality) so the person can watch it back on
  // the review screen, like MTailor. Stays on the phone; never uploaded.
  let recorder = null, recChunks = [];
  function startRecording(s) {
    recChunks = [];
    recorder = null;
    if (!window.MediaRecorder) return;
    try {
      const types = ["video/mp4", "video/webm;codecs=vp8", "video/webm"];
      const type = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      recorder = new MediaRecorder(s, Object.assign({ videoBitsPerSecond: 700000 }, type ? { mimeType: type } : {}));
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
      recorder.start(1000);
    } catch (e) { recorder = null; }
  }
  function stopRecording() {
    return new Promise((res) => {
      const r = recorder;
      recorder = null;
      if (!r || r.state === "inactive") { res(null); return; }
      const t = setTimeout(() => res(null), 3000);
      r.onstop = () => {
        clearTimeout(t);
        res(recChunks.length ? URL.createObjectURL(new Blob(recChunks, { type: r.mimeType || "video/mp4" })) : null);
      };
      try { r.stop(); } catch (e) { clearTimeout(t); res(null); }
    });
  }
  function stopCamera() {
    if (recorder) { try { recorder.ondataavailable = null; recorder.stop(); } catch (e) {} recorder = null; }
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null; }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }
  function camScreen() {
    openSheet(
      '<div class="bs-cam">' +
      '<video class="bs-video" playsinline muted autoplay></video>' +
      // Pose figure (under the dots, so the dots show on top) until the person matches it (MTailor).
      // Filled so it reads from 8 feet away (Daniel's ChatGPT silhouette,
      // used as a mask so it can turn from white to gold).
      '<div class="bs-bigpose" aria-hidden="true"><i></i></div>' +
      '<canvas class="bs-overlay"></canvas>' +
      '<div class="bs-scanline" aria-hidden="true" hidden></div>' +
      // Live "you're lined up" graphics: frame corners that turn gold when
      // the whole body is in the picture, three checks that light up one by
      // one, and a capture bar while the front frames are taken.
      '<div class="bs-checks" aria-hidden="true"><span data-k="frame">In frame</span><span data-k="pose">Arms up</span><span data-k="still">Still</span></div>' +
      '<div class="bs-capture" aria-hidden="true" hidden><span>Capturing</span><b><i></i></b></div>' +
      '<div class="bs-cam-top"><span class="bs-step">Getting ready&hellip;</span><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>' +
      '<div class="bs-ring" hidden><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="bs-ring-bg"/><circle cx="22" cy="22" r="19" class="bs-ring-fg" pathLength="100" stroke-dasharray="0 100"/></svg><span>0%</span></div>' +
      '<div class="bs-cam-msg" role="status" aria-live="polite">Loading the scanner&hellip;</div>' +
      '<div class="bs-count" hidden></div>' +
      (state.uploaded ? "" : '<div class="bs-cam-bottom"><button type="button" class="bs-voice" aria-pressed="true">Voice on</button></div>') +
      "</div>", true);
    const voice = sheet.querySelector(".bs-voice");
    if (voice) voice.onclick = () => {
      state.voice = !state.voice;
      voice.textContent = state.voice ? "Voice on" : "Voice off";
      voice.setAttribute("aria-pressed", state.voice ? "true" : "false");
      if (!state.voice) try { window.speechSynthesis.cancel(); } catch (x) {}
    };
    const flip = sheet.querySelector(".bs-flip");
    if (flip) flip.onclick = () => {
      state.who = state.who === "self" ? "friend" : "self";
      stopCamera();
      startCamera();
    };
    return sheet.querySelector(".bs-video");
  }
  async function startCamera() {
    const video = camScreen();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // Portrait (tall) picture to match a phone held upright; it fills the
        // screen (Daniel's iPhone showed a square picture with black bars).
        video: { facingMode: state.who === "self" ? "user" : "environment", width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } },
      });
    } catch (e) {
      showIntro("Camera blocked. Allow camera access in Settings.");
      return;
    }
    if (!sheet) { stopCamera(); return; }
    video.srcObject = stream;
    video.classList.toggle("bs-mirror", state.who === "self");
    sheet.querySelector(".bs-overlay").classList.toggle("bs-mirror", state.who === "self");
    try { await video.play(); } catch (e) {}
    startRecording(stream);
    begin(video);
  }
  async function startVideoFile(file) {
    const video = camScreen();
    fileUrl = URL.createObjectURL(file);
    video.removeAttribute("autoplay");
    video.src = fileUrl;
    video.onended = () => {
      if (state && state.phase !== "done") showIntro("The video ended too soon. Film one full turn, arms up.");
    };
    begin(video);
  }
  async function begin(video) {
    try {
      await (preloadModel() || loadModel());
      if (!model) await loadModel();
    } catch (e) {
      showIntro("The scanner didn't load. Check your connection and try again.");
      return;
    }
    if (!sheet) return;
    if (state.uploaded) { try { await video.play(); } catch (e) {} }
    state.phase = "front";
    state.okSince = 0;
    state.history = [];
    state.fronts = [];
    state.spin = [];
    state.theta = 0;
    runLive(video);
  }

  // Is the person standing the way the scan needs? Returns a message to
  // show (and say), or "" when everything is right.
  function inFrameProblem(lm) {
    if (!lm) return "Step into the picture.";
    const vis = (i) => (lm[i].visibility == null ? 1 : lm[i].visibility);
    const nose = lm[0];
    const sh = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 };
    const feetY = Math.max(lm[27].y, lm[28].y, lm[29].y, lm[30].y, lm[31].y, lm[32].y);
    const headTop = nose.y - (sh.y - nose.y) * 0.9;
    if (headTop < 0.02) return "Step back. Show your head.";
    if (feetY > 0.975 || vis(27) < 0.4 || vis(28) < 0.4) return "Step back. Show your feet.";
    const bodyH = feetY - headTop;
    if (bodyH < 0.5) return "Come closer.";
    if (bodyH > 0.94) return "Step back a little.";
    if (sh.x < 0.25 || sh.x > 0.75) return "Move to the middle.";
    return "";
  }
  // The "goalpost" pose: upper arms out at shoulder height, elbows bent,
  // forearms straight up, fists closed. It keeps the arms off the torso
  // from every side while turning (so the chest, waist and seat outlines
  // are clean), opens the armpits, holds steadier than straight arms, and
  // keeps the hands close in so the person fills more of the picture.
  // facing: also check the elbows are out to the sides (only visible from
  // the front).
  // Landmarks come as fractions of the picture's width and height. The
  // pose checks compare sideways and up-down distances, so they first put
  // both in the same units (Daniel's iPhone gives a picture that isn't
  // 9:16, and "Face the phone." fired while he was facing it).
  let ASPECT = 9 / 16; // camera picture width / height, set each frame
  const sq = (lm) => lm.map((p) => ({ x: p.x * ASPECT, y: p.y, visibility: p.visibility }));
  function armsUp(lm0, facing) {
    const lm = sq(lm0);
    const T = (lm[23].y + lm[24].y - lm[11].y - lm[12].y) / 2;
    const arm = (s, e, w) =>
      Math.abs(lm[e].y - lm[s].y) < T * 0.45 && // elbow roughly level with the shoulder
      lm[e].y - lm[w].y > T * 0.15 && // wrist above the elbow
      Math.abs(lm[w].x - lm[e].x) < T * 0.55; // forearm roughly upright
    // (loosened 2026-11-03: Daniel's real test never got past the pose check)
    if (!arm(11, 13, 15) || !arm(12, 14, 16)) return false;
    if (facing) {
      const cx = (lm[11].x + lm[12].x) / 2, half = Math.abs(lm[11].x - lm[12].x) / 2;
      if (Math.abs(lm[13].x - cx) < half + T * 0.08 || Math.abs(lm[14].x - cx) < half + T * 0.08) return false;
    }
    return true;
  }
  function facingPhone(lm0) {
    const lm = sq(lm0);
    const T = (lm[23].y + lm[24].y - lm[11].y - lm[12].y) / 2;
    return Math.abs(lm[11].x - lm[12].x) >= T * 0.4;
  }
  function frontProblem(lm) {
    const p = inFrameProblem(lm);
    if (p) return p;
    if (!facingPhone(lm)) return "Face the phone.";
    if (!armsUp(lm, true)) return "Arms up, like the picture.";
    if (Math.abs(lm[27].x - lm[28].x) < Math.abs(lm[23].x - lm[24].x) * 0.5) return "Feet a little apart.";
    return "";
  }
  function stillness(history) {
    if (history.length < 8) return Infinity;
    const pts = [0, 11, 12, 23, 24, 27, 28];
    let maxMove = 0;
    const a = history[history.length - 8], b = history[history.length - 1];
    pts.forEach((i) => { maxMove = Math.max(maxMove, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)); });
    return maxMove;
  }

  // True when at least 1% of the outline is body.
  function maskHasBody(d) {
    let n = 0, k = 0;
    for (let i = 0; i < d.length; i += 7) { k++; if (d[i] > 0.5) n++; }
    return n > k * 0.01;
  }
  // One video frame through the model: landmarks always, the outline
  // (mask) copied out only while measuring.
  function detect(video, ts, wantMask) {
    let out = null;
    model.detectForVideo(video, ts, (res) => {
      const lm = res && res.landmarks && res.landmarks[0];
      if (!lm) return;
      out = { lm: lm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility })) };
      const mk = res.segmentationMasks && res.segmentationMasks[0];
      if (wantMask && mk) {
        // Some phones hand back an empty outline: then there's no outline.
        let data = null;
        try { data = new Float32Array(mk.getAsFloat32Array()); } catch (e) {}
        if (!data || !maskHasBody(data)) {
          try {
            const u = mk.getAsUint8Array();
            const f = new Float32Array(u.length);
            for (let i = 0; i < u.length; i++) f[i] = u[i] / 255;
            data = maskHasBody(f) ? f : null;
          } catch (e) { data = null; }
        }
        if (data) out.mask = { data, width: mk.width, height: mk.height };
      }
    });
    return out;
  }

  const FRONT_FRAMES = 6;
  const CAPTURE_GAP_MS = 180; // 6 frames ≈ 1 second holding the pose (2 s felt too long)
  const SPIN_TIMEOUT_MS = 45000;
  function runLive(video) {
    const canvas = sheet && sheet.querySelector(".bs-overlay");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const msgEl = sheet.querySelector(".bs-cam-msg");
    const stepEl = sheet.querySelector(".bs-step");
    const countEl = sheet.querySelector(".bs-count");
    const ring = sheet.querySelector(".bs-ring");
    const ghost = null;
    const bigPose = sheet.querySelector(".bs-bigpose");
    const scanline = sheet.querySelector(".bs-scanline");
    let lastTs = -1;
    let counting = false;
    const setMsg = (text, ok) => { if (state.failUntil && performance.now() < state.failUntil) return; msgEl.textContent = text; msgEl.classList.toggle("bs-ok", !!ok); };
    stepEl.textContent = "Step 1 of 2: arms up";
    setMsg("Face the phone. Arms up.");
    say("Face the phone. Arms up.", true);
    const tick = () => {
      if (!sheet || !state || state.phase === "done") return;
      rafId = requestAnimationFrame(tick);
      if (video.readyState < 2 || !video.videoWidth) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      ASPECT = video.videoWidth / video.videoHeight;
      const ts = state.uploaded ? video.currentTime * 1000 + 2 : performance.now();
      if (ts <= lastTs) return;
      lastTs = ts;
      let d = null;
      try { d = detect(video, ts, true); } catch (e) { return; }
      const lm = d ? d.lm : null;
      drawGuide(ctx, canvas, lm, d && d.mask);
      setGhost(ghost, lm, state.phase);
      if (counting) return;

      if (state.phase === "front") {
        const problem = frontProblem(lm);
        if (lm) { state.history.push(lm); if (state.history.length > 15) state.history.shift(); }
        const inFrame = !!lm && !inFrameProblem(lm);
        if (bigPose) bigPose.classList.toggle("bs-match", !problem);
        // Which parts are right: the dots on those parts turn gold, the
        // others blink white, so the person sees what to fix.
        state.parts = lm ? {
          frame: inFrame,
          arms: inFrame && armsUp(lm, true),
          legs: inFrame && Math.abs(lm[27].x - lm[28].x) >= Math.abs(lm[23].x - lm[24].x) * 0.5,
          body: inFrame && facingPhone(lm),
        } : null;
        setChecks(inFrame, !problem, !problem && stillness(state.history) < 0.045);
        // In the picture but no body outline for a second: switch the
        // scanner to its main-chip mode now, before capturing.
        if (inFrame && !d.mask) {
          state.noMaskSince = state.noMaskSince || ts;
          if (ts - state.noMaskSince > 1000 && !state.triedCpu) { state.triedCpu = true; switchToCpu(); }
        } else state.noMaskSince = 0;
        // First time they're well placed: say so, then the next step.
        // Only once the whole body has been clearly in the picture for a
        // moment (Daniel: it said "great spot" before he was in frame).
        const solid = inFrame && [0, 11, 12, 23, 24, 27, 28].every((i) => (lm[i].visibility == null ? 1 : lm[i].visibility) > 0.7);
        if (!solid) state.inFrameSince = 0;
        else if (!state.inFrameSince) state.inFrameSince = ts;
        if (solid && ts - state.inFrameSince > 700 && !state.spotSaid) {
          state.spotSaid = true;
          if (problem) { setMsg("Good spot. " + problem, true); say(armsUp(lm, true) ? "Great, that's a good spot." : "Great, that's a good spot. Now raise your arms, like the picture.", true); return; }
        }
        // The pose check can flicker for a frame or two (Daniel: stuck in a
        // "Perfect. Hold still." loop), so a problem only counts once it has
        // lasted 0.6 s, and "Perfect" is said at most once every 6 s.
        if (problem) {
          state.problemSince = state.problemSince || ts;
          if (!state.okSince || ts - state.problemSince > 600) { state.okSince = 0; setMsg(problem); say(problem); return; }
        } else state.problemSince = 0;
        setMsg("Hold still.", true);
        if (!state.okSince) {
          state.okSince = ts;
          if (!state.perfectAt || ts - state.perfectAt > 6000) { state.perfectAt = ts; say("Perfect. Hold still.", true); }
        }
        // Capture straight away, no countdown (Daniel: "it needs to capture
        // as fast as MTailor").
        if (ts - state.okSince > 250) { state.phase = "frontCapture"; state.captureStart = ts; }
        return;
      }

      if (state.phase === "frontCapture") {
        // Keep the gold figure up and hold the pose about 2 seconds while
        // the frames are taken (Daniel: "the capture was too fast, keep me
        // in that position with the gold body").
        if (bigPose) bigPose.classList.add("bs-match");
        state.parts = { frame: true, arms: true, legs: true, body: true };
        setMsg("Capturing… hold still.", true);
        setCapture(state.fronts.length / FRONT_FRAMES);
        // Never get stuck here (Daniel waited and it never moved on): note
        // why frames are skipped, move on with what we have after 2.5 s,
        // switch the scanner to its slower mode if the camera gives no body
        // outline, and after 6 s say what went wrong and start over.
        const capFor = ts - (state.captureStart || ts);
        let why = "";
        if (!lm) {
          why = "no person";
          // They left the picture: back to the pose check.
          state.lostSince = state.lostSince || ts;
          if (ts - state.lostSince > 800 && !state.fronts.length) {
            state.phase = "front"; state.okSince = 0; state.lastFrontAt = 0; state.lostSince = 0;
            if (bigPose) bigPose.classList.remove("bs-match");
            return;
          }
        } else state.lostSince = 0;
        if (!lm) { /* handled above */ }
        else if (!d.mask) why = "no outline";
        else if (!(state.lastFrontAt && ts - state.lastFrontAt < CAPTURE_GAP_MS)) {
          let f;
          try { f = G.measureFrontFrame(lm, d.mask); } catch (e) { f = { error: "math " + (e && e.message) }; }
          if (!f.error) { state.fronts.push(f); state.lastFrontAt = ts; state.flashAt = performance.now(); cue.tick(); }
          else why = "measure " + f.error;
        }
        if (why) state.capWhy = why;
        setCapture(state.fronts.length / FRONT_FRAMES);
        if (state.capWhy === "no outline" && capFor > 1500 && !state.triedCpu && !state.fronts.length) {
          state.triedCpu = true;
          switchToCpu();
        }
        if (capFor > 6000 && !state.fronts.length) {
          setMsg("Couldn't capture (" + (state.capWhy || "unknown") + "). Try again.");
          state.failUntil = performance.now() + 5000; // keep the reason on screen
          stepEl.textContent = "Step 1 of 2 · retry (" + (state.capWhy || "unknown") + ")";
          say("Step into the picture.", true);
          state.phase = "front"; state.okSince = 0; state.lastFrontAt = 0;
          return;
        }
        if (state.fronts.length < FRONT_FRAMES && !(state.fronts.length >= 3 && capFor > 1600) && !(state.fronts.length >= 1 && capFor > 2500)) return;
        state.base = G.combine(state.fronts);
        if (state.base.error) { state.fronts = []; state.lastFrontAt = 0; state.phase = "front"; return; }
        state.frontSh2d = G.median(state.fronts.map((x) => x.sh2d));
        state.phase = "spin";
        state.parts = null;
        if (bigPose) bigPose.classList.add("bs-gone");
        setCapture(null);
        setChecks(null);
        scanline.hidden = false;
        cue.go();
        state.spinStart = ts;
        state.lastAngleTs = ts;
        stepEl.textContent = "Step 2 of 2: turn around";
        ring.hidden = false;
        setMsg("Got it. Now turn slowly, all the way around.", true);
        say("Got it. Now turn slowly, all the way around.", true);
        return;
      }

      if (state.phase === "spin") {
        const p = inFrameProblem(lm);
        if (p) { setMsg(p); say(p); }
        else if (!armsUp(lm)) { setMsg("Keep your arms up."); say("Arms up."); }
        if (d && d.mask && !p) {
          const f = G.measureSideFrame(lm, d.mask, state.base.sideFracs);
          if (!f.error) {
            state.spin.push(f);
            const th = G.spinAngles(state.spin, state.frontSh2d);
            const t = th[th.length - 1];
            if (t > state.theta + 1) state.lastAngleTs = ts;
            state.theta = t;
          }
        }
        const pct = Math.min(100, Math.round((state.theta / 360) * 100));
        ring.querySelector(".bs-ring-fg").setAttribute("stroke-dasharray", pct + " 100");
        ring.querySelector("span").textContent = pct + "%";
        if (!p && armsUp(lm)) {
          const said = state.saidPct || 0;
          if (pct >= 25 && said < 25) { state.saidPct = 25; say("Keep turning, slowly.", true); }
          else if (pct >= 50 && said < 50) { state.saidPct = 50; say("Halfway.", true); }
          else if (pct >= 75 && said < 75) { state.saidPct = 75; say("Almost there.", true); }
          setMsg("Keep turning… " + pct + "%", true);
        }
        if (state.theta >= 345) {
          state.result = spinResult();
          if (!state.result) return;
          cue.done();
          finishScan();
          return;
        }
        if (ts - state.spinStart > SPIN_TIMEOUT_MS || (ts - state.lastAngleTs > 12000 && state.spin.length > 20)) {
          state.phase = "done";
          stopCamera();
          showIntro("We didn't see a full turn. Try again, slowly.");
        }
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
      el.classList.remove("bs-pop");
      void el.offsetWidth;
      el.classList.add("bs-pop");
      say(String(n), true);
      cue.tick();
      n--;
      setTimeout(step, 550);
    };
    step();
  }
  // Live scan effect ON the body (Daniel: no outlines, "real-time graphics
  // flashing over my body"; copied from MTailor's recording): a grid of
  // glowing dots fills the person's shape every frame, white on the face,
  // gold on the body. The dots twinkle, a brighter band sweeps up and down,
  // and every captured frame flashes them all. Before the pose is right the
  // dots are soft white; once it is right they turn gold.
  function drawGuide(ctx, canvas, lm, mask) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm || !mask) return;
    const W = canvas.width, H = canvas.height;
    const m = mask.data, mw = mask.width, mh = mask.height;
    const gap = W / 28, r0 = gap * 0.24;
    const t = performance.now() / 1000;
    const ok = state && (state.okSince || state.phase === "spin" || state.phase === "frontCapture");
    const body = ok ? [226, 196, 141] : [215, 222, 235];
    const since = state && state.flashAt ? performance.now() - state.flashAt : 1e9;
    const flash = since < 260 ? 1 - since / 260 : 0;
    const by = (0.5 + 0.5 * Math.sin(t * 1.4)) * H; // sweeping band
    // Face: around the nose, out to the ears.
    const nose = lm[0], earL = lm[7], earR = lm[8];
    const fr = earL && earR ? Math.max(Math.abs(earL.x - earR.x) * W * 0.85, gap * 1.5) : gap * 2;
    const fx = nose.x * W, fy = nose.y * H;
    const parts = state && (state.phase === "front" || state.phase === "frontCapture") ? state.parts : null;
    const shY = ((lm[11].y + lm[12].y) / 2) * H, hipY = ((lm[23].y + lm[24].y) / 2) * H;
    const shL = Math.min(lm[11].x, lm[12].x) * W, shR = Math.max(lm[11].x, lm[12].x) * W;
    const blink = 0.5 + 0.5 * Math.sin(t * 9);
    const WHITE = [255, 255, 255];
    ctx.save();
    for (let gy = 0, y = gap / 2; y < H; y += gap, gy++) {
      const my = Math.min(mh - 1, Math.floor((y / H) * mh)) * mw;
      for (let gx = 0, x = gap / 2; x < W; x += gap, gx++) {
        if (m[my + Math.min(mw - 1, Math.floor((x / W) * mw))] <= 0.5) continue;
        const face = Math.hypot(x - fx, y - fy) < fr;
        const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + gx * 1.7 + gy * 2.3);
        const band = Math.max(0, 1 - Math.abs(y - by) / (H * 0.07));
        let a = Math.min(1, 0.35 + 0.45 * tw + 0.5 * band + flash);
        const r = r0 * (0.75 + 0.35 * tw + 0.5 * band + 0.6 * flash);
        let c = face || flash > 0.5 ? WHITE : body;
        let aa = 1;
        if (parts && !face) {
          // Arm dots: above the shoulders or out past them. Leg dots: below the hips.
          const part = !parts.frame ? "frame" : (y < shY + gap || x < shL - gap || x > shR + gap) ? "arms" : y > hipY ? "legs" : "body";
          if (parts[part]) c = [226, 196, 141];
          else { c = WHITE; aa = 0.35 + 0.65 * blink; }
        }
        a *= aa;
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a * 0.22).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.283); ctx.fill(); // glow
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }
  // The outline figures are gone from the camera (Daniel); kept as no-op.
  function setGhost() {}

  // frame / pose / still: true, false, or null (hide all checks).
  function setChecks(frame, pose, still) {
    if (!sheet) return;
    const box = sheet.querySelector(".bs-checks");
    if (!box) return;
    box.hidden = frame === null;
    const on = { frame: !!frame, pose: !!(frame && pose), still: !!(frame && pose && still) };
    box.querySelectorAll("span").forEach((el) => el.classList.toggle("on", on[el.dataset.k]));
  }
  function setCapture(frac) {
    const c = sheet && sheet.querySelector(".bs-capture");
    if (!c) return;
    c.hidden = frac === null;
    if (frac !== null) c.querySelector("i").style.width = Math.round(frac * 100) + "%";
  }

  // ---- step 3: the numbers ----
  // The numbers from the turn (null if the turn was too quick to use).
  function spinResult() {
    const thetas = G.spinAngles(state.spin, state.frontSh2d);
    const chestCover = G.spinGirth(state.spin, thetas, "chest", state.heightCm);
    if (!isFinite(chestCover.value)) {
      state.phase = "done";
      stopCamera();
      showIntro("Too fast. Try again, slower.");
      return null;
    }
    // Side-on frames give the leg depths (thigh, calf).
    let sides = state.spin.filter((f) => f.sh2d / state.frontSh2d < 0.35);
    if (!sides.length) sides = state.spin;
    const result = G.finish(state.base, sides, state.heightCm, { spin: { frames: state.spin, thetas } });
    state.spin = [];
    state.fronts = [];
    return result;
  }
  function finishScan() {
    state.phase = "done";
    const rec = stopRecording();
    say("Done.", true);
    rec.then((url) => {
      stopCamera();
      if (!state) return;
      if (state.replay) URL.revokeObjectURL(state.replay);
      state.replay = url;
      showGreatJob();
    });
  }
  // "Great job!" then the review (MTailor's order).
  function showGreatJob() {
    openSheet('<div class="ps-body bs-intro bs-page bs-great">' +
      '<div class="bs-page-art"><span class="bs-done-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></div>' +
      '<h3 class="bs-page-title">Great job!</h3>' +
      '<p class="bs-page-sub">Last step: check your scan.</p>' +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-go-review">Check My Scan</button>' +
      '<button type="button" class="btn-ghost bs-redo">Scan again</button></div>');
    sheet.querySelector(".bs-go-review").onclick = () => showReview(state.result);
    sheet.querySelector(".bs-redo").onclick = () => showIntro();
  }

  // ---- step 3b: check each requirement (like MTailor) ----
  // Every answer must be Yes before the numbers show; a No means scan again.
  function showReview(result) {
    const h = state.heightCm, ft = Math.floor(h / 2.54 / 12), inch = Math.round((h / 2.54 - ft * 12) * 2) / 2;
    const qs = [
      "Shirtless or a tight shirt?",
      "Barefoot?",
      "Plain wall, nothing behind you?",
      state.who === "friend" ? "Phone held steady?" : "Phone didn't move?",
      "Arms up the whole turn?",
      "Height is " + ft + " ft " + inch + " in?",
    ];
    openSheet(head("Quick Check") +
      '<div class="ps-body bs-review">' +
      (state.replay ? '<video class="bs-replay' + (state.who === "self" ? " bs-mirror" : "") + '" src="' + state.replay + '" autoplay muted loop playsinline></video>' : "") +
      qs.map((q, i) => '<div class="bs-q" data-i="' + i + '"><span>' + esc(q) + "</span>" +
        '<div class="ps-type bs-yn"><button type="button" data-v="yes">Yes</button><button type="button" data-v="no">No</button></div></div>').join("") +
      '<p class="bs-alert bs-redo-msg" hidden>Fix that, then scan again.</p>' +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-see" disabled>See My Measurements</button>' +
      '<button type="button" class="btn-ghost bs-redo">Scan again</button></div>');
    const answers = qs.map(() => null);
    const update = () => {
      const anyNo = answers.indexOf("no") !== -1;
      sheet.querySelector(".bs-see").disabled = anyNo || answers.indexOf(null) !== -1;
      sheet.querySelector(".bs-redo-msg").hidden = !anyNo;
    };
    sheet.querySelectorAll(".bs-q").forEach((q) => {
      const i = +q.dataset.i;
      q.querySelectorAll("button").forEach((b) => (b.onclick = () => {
        answers[i] = b.dataset.v;
        q.querySelectorAll("button").forEach((x) => x.classList.toggle("selected", x === b));
        q.classList.toggle("bs-q-no", b.dataset.v === "no");
        update();
      }));
    });
    sheet.querySelector(".bs-see").onclick = () => showResults(result);
    sheet.querySelector(".bs-redo").onclick = () => showIntro();
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
      '<div class="bs-done-badge"><span class="bs-done-check" aria-hidden="true"></span>Scan complete</div>' +
      '<p class="bs-lead">Tap a number to change it.</p>' +
      warn.map((w) => '<p class="bs-alert">' + esc(w) + "</p>").join("") +
      '<div class="ps-group">Jacket</div>' + jacketRows +
      '<div class="ps-group">Pants</div>' + pantsRows +
      '<details class="bs-extra"><summary>Extra measurements for our tailor</summary>' + extraRows + "</details>" +
      '<p class="bs-small">Our tailor checks every scan.</p>' +
      "</div>" +
      '<div class="ps-actions"><button type="button" class="btn-primary bs-use">Use These Measurements</button>' +
      '<button type="button" class="btn-ghost bs-again">Scan again</button></div>');
    sheet.querySelectorAll(".bs-row").forEach((r, i) => (r.style.animationDelay = 120 + i * 45 + "ms"));
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
      source: state.uploaded ? "uploaded turn-around video" : "live turn-around scan",
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

  // For previews: the camera screen with a given pose, outline and turn.
  window.__bodyScanPreviewCam = (lm, mask, W, H, phase, pct, msg) => {
    state = { heightCm: 178, who: "friend", voice: false, phase, okSince: phase !== "front" ? 1 : 0 };
    camScreen();
    const c = sheet.querySelector(".bs-overlay");
    c.width = W; c.height = H;
    drawGuide(c.getContext("2d"), c, lm, mask);
    sheet.querySelector(".bs-bigpose").classList.toggle("bs-gone", phase === "spin");
    sheet.querySelector(".bs-bigpose").classList.toggle("bs-match", phase === "capture" || (phase === "front" && !!lm && pct !== 1));
    if (phase === "capture") state.phase = "frontCapture";
    state.parts = phase !== "spin" && lm ? { frame: true, arms: pct !== 1, legs: true, body: true } : null;
    drawGuide(c.getContext("2d"), c, lm, mask);
    if (phase === "spin") setChecks(null); else setChecks(!!lm, !!lm && pct !== 1, !!lm && pct !== 1 && pct !== 2);
    setCapture(phase === "capture" ? 0.6 : null);
    sheet.querySelector(".bs-step").textContent = phase === "spin" ? "Step 2 of 2: turn around" : "Step 1 of 2: arms up";
    sheet.querySelector(".bs-scanline").hidden = phase !== "spin";
    const ring = sheet.querySelector(".bs-ring");
    ring.hidden = phase !== "spin";
    ring.querySelector(".bs-ring-fg").setAttribute("stroke-dasharray", pct + " 100");
    ring.querySelector("span").textContent = pct + "%";
    const m = sheet.querySelector(".bs-cam-msg");
    m.textContent = msg;
    m.classList.toggle("bs-ok", phase !== "front");
  };
  // For previews and testing: show the results screen with given numbers.
  window.__bodyScanPreview = (result) => showResults(result);
  window.__bodyScanPreviewLevel = (beta) => {
    state = { heightCm: 178, who: "self", voice: false, preview: true };
    showLevel();
    window.dispatchEvent(Object.assign(new Event("deviceorientation"), { beta, gamma: 0 }));
  };
  window.__bodyScanPreviewGreat = (result) => {
    state = { heightCm: 178, who: "self", result, voice: false };
    showGreatJob();
  };
  window.__bodyScanPreviewReview = (result) => {
    state = { heightCm: 178, who: "self", result };
    showReview(result);
  };
})();
