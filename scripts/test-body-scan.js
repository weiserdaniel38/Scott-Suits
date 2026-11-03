// Checks the phone body scan math (body-scan.js) on a drawn test figure
// whose real widths and depths are known. Run: node scripts/test-body-scan.js
const G = require("../body-scan.js");

const W = 600, H = 1100, HEIGHT_CM = 180;
const top = 50, floor = 1050; // 1000 px tall -> 0.18 cm per px
const cmPx = 1000 / HEIGHT_CM;

// Landmarks in pixels for a figure centred at x=300.
function landmarks(side) {
  const cx = 300;
  const p = (x, y, v) => ({ x: x / W, y: y / H, visibility: v == null ? 0.99 : v });
  const L = [];
  for (let i = 0; i < 33; i++) L.push(p(cx, 500));
  const shY = top + 0.18 * 1000, hipY = top + 0.48 * 1000; // T = 300 px
  const sw = side ? 4 : 75; // half distance between shoulder joints
  const hw = side ? 3 : 45;
  L[0] = p(cx + (side ? 20 : 0), top + 60);
  L[7] = p(cx - (side ? 2 : 35), top + 55); L[8] = p(cx + (side ? 2 : 35), top + 55);
  L[11] = p(cx - sw, shY); L[12] = p(cx + sw, shY);
  L[23] = p(cx - hw, hipY); L[24] = p(cx + hw, hipY);
  const legOut = side ? 0 : 70;
  L[25] = p(cx - legOut * 0.8, top + 0.72 * 1000); L[26] = p(cx + legOut * 0.8, top + 0.72 * 1000);
  L[27] = p(cx - legOut, top + 0.95 * 1000); L[28] = p(cx + legOut, top + 0.95 * 1000);
  L[29] = p(cx - legOut, top + 0.97 * 1000); L[30] = p(cx + legOut, top + 0.97 * 1000);
  L[31] = p(cx - legOut - 10, top + 0.99 * 1000); L[32] = p(cx + legOut + 10, top + 0.99 * 1000);
  // Arms: out 45 degrees in front, straight down at the side.
  const armLen = 140;
  const ex = side ? 0 : armLen * Math.SQRT1_2, ey = side ? armLen : armLen * Math.SQRT1_2;
  L[13] = p(cx - sw - ex, shY + ey); L[14] = p(cx + sw + ex, shY + ey);
  L[15] = p(cx - sw - 2 * ex, shY + 2 * ey); L[16] = p(cx + sw + 2 * ex, shY + 2 * ey);
  return L;
}

// Draws the person: torso half-width by height, head, arms, legs.
function draw(side) {
  const data = new Float32Array(W * H);
  const fill = (x0, x1, y) => { for (let x = Math.max(0, Math.round(x0)); x <= Math.min(W - 1, Math.round(x1)); x++) data[y * W + x] = 1; };
  const cx = 300;
  const shY = top + 180, hipY = top + 480, crotchY = top + 540;
  for (let y = top; y <= floor; y++) {
    if (y < top + 110) { // head
      const r = 65, cy = top + 65, dy = Math.min(y - cy, 40); // jaw: head stays wide down to the neck
      if (Math.abs(dy) <= r) { const hw = Math.sqrt(r * r - dy * dy) * (side ? 1.15 : 1); fill(cx - hw, cx + hw, y); }
    } else if (y < shY - 30) { // neck: 13 cm wide, 12 cm deep
      const hw = (side ? 12 : 13) * cmPx / 2; fill(cx - hw, cx + hw, y);
    } else if (y < crotchY) { // torso
      let wcm;
      if (side) wcm = y < shY ? 20 : y < hipY - 40 ? 25 : 27; // depth
      else wcm = y < shY ? 44 : y < shY + 140 ? 34 : y < hipY - 40 ? 31 : 36; // width
      const hw = wcm * cmPx / 2; fill(cx - hw, cx + hw, y);
    } else if (!side) { // two legs, 16 cm wide each, centred under the hips +/- 12 cm
      const t = (y - crotchY) / (floor - crotchY);
      const off = (11 + 14 * t) * cmPx;
      const hw = (16 - 8 * t) * cmPx / 2;
      fill(cx - off - hw, cx - off + hw, y); fill(cx + off - hw, cx + off + hw, y);
    } else { // legs overlap: one leg deep
      const t = (y - crotchY) / (floor - crotchY);
      const hw = (18 - 8 * t) * cmPx / 2; fill(cx - hw, cx + hw, y);
    }
  }
  // Arms, 10 cm thick
  if (!side) {
    const L = landmarks(false);
    [[11, 13, 15], [12, 14, 16]].forEach(([s, e, w]) => {
      const a = { x: L[s].x * W, y: L[s].y * H }, b = { x: L[w].x * W, y: L[w].y * H };
      const r = 5 * cmPx;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2)));
        const d = Math.hypot(x - (a.x + t * (b.x - a.x)), y - (a.y + t * (b.y - a.y)));
        if (d <= r) data[y * W + x] = 1;
      }
    });
  }
  return { data, width: W, height: H };
}

const front = G.measureFrontFrame(landmarks(false), draw(false));
const base = G.combine([front, front]);
const side = G.measureSideFrame(landmarks(true), draw(true), base.sideFracs);
const res = G.finish(base, [side], HEIGHT_CM);

let fails = 0;
const near = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? "ok   " : "FAIL ") + name + ": " + (Math.round(got * 10) / 10) + " (want " + want + " +/- " + tol + ")");
};
const ell = (w, d, k) => G.ellipsePerimeter(w, d) * k;
const K = G.BODY_SHAPE_K;
near("height px", front.Hpx, 1000, 3);
near("chest", res.values.body_chest, ell(34, 25, K.chest), 1.5);
near("trouser waist", res.values.body_waist, ell(31, 25, K.waist), 1.5);
near("seat", res.values.body_seat, ell(36, 27, K.seat), 1.5);
near("neck", res.values.body_neck, ell(13, 12, K.neck), 1.5);
near("thigh", res.values.body_thigh, ell(16, 18, K.thigh), 2.5);
near("bicep", res.values.body_bicep, Math.PI * 10 * 0.97, 2);
near("arm", res.values.body_sleeve, (280 / cmPx) + 4, 1);
near("shoulder", res.values.body_shoulder, 44 * 0.97, 1);
console.log(JSON.stringify(res, null, 1));
if (!(res.values.body_u_rise > 40 && res.values.body_u_rise < 100)) { fails++; console.log("FAIL u-rise " + res.values.body_u_rise); }
if (res.flags.length) { fails++; console.log("FAIL flags " + res.flags); }
process.exit(fails ? 1 : 0);
