// Scott Suits -- draws a picture sheet of a customer's finished suit.
//
// The sheet has five panels, described to the model in words only:
// full suit front, full suit back, trousers front, a sleeve-cuff close-up and
// a trouser-waistband close-up (jacket-only orders get jacket views instead).
//
// How it's called:
//   * From the designer, right after the customer finishes designing a suit
//     and before the measurements / order form ("Generate My Suit"):
//       { preview: true, visual_spec }     start drawing -> { preview_id }
//       { preview_check: "<preview_id>" }  ask whether it's done yet
//     Optionally rate limited per visitor and per day (see PREVIEW_* below); previews
//     live in the suit_previews table.
//   * After the order is saved:
//       { attach: "<preview_id>", order_id, suit_number }
//                                          copy a finished preview onto the
//                                          order row (no second drawing)
//       { order_id, suit_number }          draw for an order row (once per suit)
//       { order_id, suit_number, check }   ask whether it's done yet
//     order_id is the random UUID only the customer's browser knows.
//   * { ping: true }                       is this feature switched on?
//   * Optionally by the database when an order is marked completed
//     (supabase/sql/2_suit_image_trigger.sql), or by hand to redraw:
//       x-webhook-secret: <secret>   { id: "<order row id>", force: true }
//
// What it does: reads the row's `visual_spec` (plain-English suit
// description, no personal data -- built by buildVisualSpecText() in
// main.js), has Claude turn it into a detailed prompt (optional), then has
// OpenAI's image model draw it using the fabric / lining / button swatch
// photos as references, saves the JPEG in the public `suit-images` bucket
// and writes image_url / image_prompt / image_status onto the order row.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   OPENAI_API_KEY     required -- draws the image (platform.openai.com)
//   ANTHROPIC_API_KEY  optional -- writes a tailored prompt
//   WEBHOOK_SECRET     optional -- needed only for the database trigger /
//                      manual redraws
//   IMAGE_MODEL        optional, default gpt-image-2
//   IMAGE_QUALITY      optional, low | medium | high | auto (default high: small
//                      details like slanted cuff buttonholes need it)
//   IMAGE_SIZE         optional, default 1536x1024 (landscape sheet)
//   USE_LAYOUT_REFERENCE optional, set to "true" to also show the model the
//                      gray outline sheet (off by default: the panels are
//                      described in words only)
//   SITE_URL           optional, default https://scottssuits.com
//   PREVIEW_PER_VISITOR_PER_DAY optional; unset means no per-visitor limit
//   PREVIEW_PER_DAY    optional; unset means no daily limit (all visitors)
//   ANTHROPIC_MODEL    optional, default claude-opus-5-5
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const BUCKET = "suit-images";
const LAYOUT_REFERENCE = "./assets/suit-layout-outline.jpg";
const STALE_PENDING_MS = 5 * 60 * 1000;

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SUPABASE_URL = env("SUPABASE_URL");
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");

const supabase = createClient(SUPABASE_URL, env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization, x-webhook-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// ---------------------------------------------------------------------------
// Reference images
// ---------------------------------------------------------------------------
type Ref = { label: string; src: string };

function parseSpec(visualSpec: string): { text: string; swatches: Ref[] } {
  const swatches: Ref[] = [];
  const text = visualSpec
    .split("\n")
    .filter((line) => {
      const m = line.match(/^Swatch ([^:]{1,60}): (\S+)$/);
      if (!m) return line.trim() !== "REFERENCE SWATCHES";
      swatches.push({ label: m[1], src: m[2] });
      return false;
    })
    .join("\n")
    .trim();
  return { text, swatches };
}

// Only ever fetch our own site's assets or a customer's uploaded lining
// photo -- visual_spec is written by the browser, so never trust a URL in it.
function safeUrl(src: string): string | null {
  if (/^\.\/assets\/[A-Za-z0-9._\-\/]+\.(jpe?g|png|webp)$/i.test(src) && !src.includes("..")) {
    return SITE_URL + src.slice(1);
  }
  const lining = SUPABASE_URL + "/storage/v1/object/public/lining-photos/";
  if (src.startsWith(lining) && /^[A-Za-z0-9._\-\/]+$/.test(src.slice(lining.length)) && !src.includes("..")) {
    return src;
  }
  return null;
}

async function loadRef(ref: Ref): Promise<{ label: string; blob: Blob } | null> {
  const url = safeUrl(ref.src);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    return { label: ref.label, blob: new Blob([buf], { type }) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Option descriptions
// ---------------------------------------------------------------------------
// What every style option LOOKS like, for the picture generator.
//
// Keyed by the step label and the option's customer-facing name, exactly as
// buildVisualSpecText() (main.js) writes them ("Lapel Style: Peak Lapel").
// drawSheet() appends the matching text to each line so the image model is
// told what the option looks like instead of guessing from its name. Written
// from the catalog line drawings in assets/. "Wearer's left" is on the RIGHT
// of the picture in front views and on the LEFT in back views.
//
// When a catalog option is added or renamed, add or rename it here too.

const HIDDEN_OPTION_LABELS = [
  // Inside the garment, never visible in any panel.
  "Construction",
  "Felt Under Collar",
  "Felt Color",
  // The opening/closing hardware under a closed waistband.
  "Hook And Eye Style",
];

const NO_MONOGRAM = "no monogram or embroidery anywhere on the garment";
const MONO = "a small, subtle embroidered monogram in the monogram thread color (no readable letters)";

const OPTION_LOOKS: Record<string, Record<string, string>> = {
  // ------------------------------------------------------------- JACKET
  Lining: {
    "Upload Your Own Photo (+$80)": "the customer's OWN lining fabric, shown in the swatch photo labelled \"lining (customer's own photo)\": copy its exact colors, pattern and scale; it is NOT matched to the suit fabric",
  },
  "Lapel Style": {
    "Notch Lapel": "classic notch lapel: the collar meets the lapel at a small V-shaped notch opening outward, and the lapel tip points sideways/slightly down",
    "Peak Lapel": "peak lapel: the lapel's upper edge sweeps UP into a sharp point aimed at the shoulder, nearly touching the collar, with only a narrow gap between them",
    "Shawl": "shawl collar: one continuous smoothly rounded lapel-and-collar edge from the back of the neck down to the button, with NO notch, NO peak and NO break between collar and lapel",
    "Diamond Lapel": "diamond lapel, a cross between a shawl collar and a peak lapel: like a SHAWL, collar and lapel are one continuous piece starting right at the back of the neck, with NO notch, gap or step between them; like a PEAK lapel, it has one SHARP pointed corner. From the neck the edge runs in a straight line down and OUTWARD to that sharp point in the UPPER third of the lapel (about level with the chest pocket), then a much longer straight edge runs back INWARD to where the lapels meet at the top button, so each lapel is a tall kite shape. Both lapels are identical mirror images; the lapel is no wider than the chosen lapel width",
  },
  "Lapel Width": {
    Standard: "standard lapel width, about 9 cm at its widest",
    Thin: "slim lapels, about 8 cm at the widest, visibly narrower than standard",
    Wide: "wide lapels, about 10 cm at the widest, reaching well toward the shoulder",
    "Extra Wide": "extra-wide statement lapels, about 11 cm at the widest, reaching close to the sleeve seam",
  },
  "Lapel Buttonhole": {
    Standard: "one buttonhole on the wearer's LEFT lapel; none on the right",
    Right: "one buttonhole on the wearer's RIGHT lapel; none on the left",
    "Right & Left": "one buttonhole on EACH lapel, mirrored at the same height",
    "Left Two": "TWO buttonholes stacked on the wearer's LEFT lapel; none on the right",
    "Right Two": "TWO buttonholes stacked on the wearer's RIGHT lapel; none on the left",
    "Left Three": "THREE buttonholes stacked on the wearer's LEFT lapel; none on the right",
    "Left Three, Right Two": "THREE stacked buttonholes on the wearer's LEFT lapel and TWO on the RIGHT lapel, both stacks starting at the same height",
    "4 Buttonholes On Left": "FOUR buttonholes stacked on the wearer's LEFT lapel; none on the right",
    "Lapel Buttonhole": "one buttonhole on the wearer's LEFT lapel; none on the right",
    "No Lapel Buttonhole": "NO buttonhole on either lapel; both lapels are plain",
  },
  "Front Button": {
    "Single Breasted One Button": "single-breasted, ONE button at the waist; the lapels roll long, down to that button",
    "Single Breasted Two Buttons": "single-breasted, TWO buttons in a vertical line; only the top one fastens at the waist",
    "Single Breasted Three Buttons": "single-breasted, THREE buttons in a vertical line; the lapels roll to the top button",
    "Double Breasted 6X2": "double-breasted, SIX buttons in THREE rows of two: the TOP row sits high on the chest and is spaced WIDER apart (the two buttons sit further out, near the lapel edges); the MIDDLE and BOTTOM rows are spaced closer together and line up directly above each other. The lapels roll down to the middle row, and the jacket fastens at the MIDDLE row; the bottom row is decorative",
    "Double Breasted 4X2": "double-breasted, FOUR buttons in TWO rows of two forming a square: both rows the same width apart, one row at the waist and one about a hand's width below it. The lapels roll down to the TOP row, and the jacket fastens at the top row",
    "Double Breasted 6X3": "double-breasted, SIX buttons in THREE rows of two forming two straight, parallel vertical columns with equal spacing between rows, all rows the same width apart (no wider top row). The lapels roll down to the TOP row, which sits fairly high on the chest, and the jacket fastens there",
    "Double Breasted 4X1": "double-breasted, FOUR buttons in TWO rows: the TOP pair sits high on the chest, spaced VERY wide apart (almost out toward the armholes, outside the lapels); the BOTTOM pair sits at the waist, spaced normally. The lapels roll low, down to the bottom row, and the jacket fastens with ONE button on the bottom row",
    "Double Breasted One Button": "double-breasted wrap with ONE single button at the waist, on the front edge of the overlap; no other buttons on the front. The lapels roll low, down to that button",
    "Double Breasted 2X1": "double-breasted, TWO buttons side by side in ONE row at the waist, nothing above or below them. The lapels roll low, down to that row, and the jacket fastens with ONE of them",
    "Double Breasted 6X1": "double-breasted, SIX buttons in THREE rows of two forming a V that narrows downward: the TOP pair is spaced widest, the MIDDLE pair narrower, the BOTTOM pair narrowest. The lapels roll low, down to the bottom row, and the jacket fastens with ONE button on the bottom row",
  },
  "Top Sleeve Crown Type": {
    "Regular Armhole": "smooth, clean sleeve head where the sleeve meets the shoulder",
    "Naples Sleeve": "Neapolitan 'spalla camicia' sleeve head: small soft gathers/shirring puckers at the top of the sleeve where it meets the shoulder",
    "Close Seam Sleeve": "smooth sleeve head with a fine line of topstitching along the armhole seam at the top of the sleeve",
  },
  "Chest Pocket": {
    "Normal Pocket": "a straight welt breast pocket on the wearer's left chest, angled slightly upward toward the arm",
    "Boat Shape Pocket": "a 'barchetta' boat-shaped breast welt pocket on the wearer's left chest: its lower edge curves gently like the hull of a boat",
    "Single Besom Pocket": "ONE single-besom breast pocket on the wearer's left chest, angled slightly upward toward the arm: a single slit opening about 11 cm long edged by one thin piped lip of the suit fabric about 5 mm tall, flush with the chest, no welt strip and no flap",
    "Double Besom Pocket": "ONE double-besom breast pocket on the wearer's left chest, angled slightly upward toward the arm: a single slit opening about 11 cm long edged by two thin piped lips of the suit fabric (one just above the opening and one just below it, each about 4 mm tall, touching each other), so the whole pocket is one slim band under 1 cm tall; flush with the chest, no welt strip and no flap",
    "Patch Pocket No Flap": "a patch breast pocket sewn on top of the wearer's left chest with rounded bottom corners and no flap",
    "No Pocket": "NO breast pocket at all; the left chest is plain",
  },
  "Lower Pockets": {
    "Single Besom Pocket": "two straight, horizontal single-besom hip pockets (one thin piped lip each), no flaps",
    "Double Besom Pocket": "two straight, horizontal double-besom hip pockets (two thin piped lips each), no flaps",
    "Single Besom + Single Besom Ticket": "two horizontal single-besom hip pockets, plus a smaller single-besom ticket pocket just above the wearer's right hip pocket; no flaps",
    "Double Besom + Double Besom Ticket": "two horizontal double-besom hip pockets, plus a smaller double-besom ticket pocket just above the wearer's right hip pocket; no flaps",
    "Flat Welt Pocket": "two hip pockets that look exactly like the normal chest welt pocket, only lower (at hip level) and a little wider: each is a flat, upright rectangular welt strip of the suit fabric about 1.5 cm tall sewn over a straight horizontal opening, with neatly stitched ends. NO flaps and NO besom (thin piped) openings",
    "Single Besom Slant Pocket": "two SLANTED single-besom hip pockets angled downward toward the front, no flaps",
    "Double Besom Slant Pocket": "two SLANTED double-besom hip pockets angled downward toward the front, no flaps",
    "Flap Pockets": "two straight horizontal hip pockets with rectangular flaps",
    "Flap Pockets + Single Besom Ticket": "two straight horizontal flap hip pockets, plus a smaller single-besom ticket pocket (no flap) just above the wearer's right hip pocket",
    "Flap Pockets + Double Besom Ticket": "two straight horizontal flap hip pockets, plus a smaller double-besom ticket pocket (no flap) just above the wearer's right hip pocket",
    "Flap Pockets + Flap Ticket Pocket": "two straight horizontal flap hip pockets, plus a smaller flapped ticket pocket just above the wearer's right hip pocket",
    "Slant Flap Pocket": "two SLANTED hip pockets with flaps, angled downward toward the front ('hacking' pockets)",
    "Slant Flap + Single Besom Ticket": "two slanted flap hip pockets, plus a smaller slanted single-besom ticket pocket just above the wearer's right hip pocket",
    "Slant Flap + Double Besom Ticket": "two slanted flap hip pockets, plus a smaller slanted double-besom ticket pocket just above the wearer's right hip pocket",
    "Slant Flap + Flap Ticket Pocket": "two slanted flap hip pockets, plus a smaller slanted flapped ticket pocket just above the wearer's right hip pocket",
    "Patch Pocket": "two square patch pockets sewn on top of the jacket at the hips, open at the top, no flaps",
    "Patch Pocket + Single Besom Ticket": "two patch hip pockets, plus a single-besom ticket pocket just above the wearer's right patch pocket",
    "Patch Pocket + Double Besom Ticket": "two patch hip pockets, plus a double-besom ticket pocket just above the wearer's right patch pocket",
    "Curved Patch Pocket": "two patch hip pockets with generously ROUNDED bottom corners, open at the top, no flaps",
    "High-Back Patch Pocket": "two patch hip pockets whose top edge slopes, higher at the back (side) than at the front",
    "High-Back Patch + Single Besom Ticket": "two high-back patch hip pockets, plus a single-besom ticket pocket just above the wearer's right patch pocket",
    "High-Back Patch + Double Besom Ticket": "two high-back patch hip pockets, plus a double-besom ticket pocket just above the wearer's right patch pocket",
    "No Front Pocket": "NO hip pockets at all; the lower front of the jacket is plain",
  },
  "Button Nail Method": {
    "X Shape Sewing": "four-hole buttons sewn on with the thread crossing in an X",
    "Parallel Sewing": "four-hole buttons sewn on with two parallel thread bars (=)",
    "Arrow Shape Sewing": "four-hole buttons sewn on with the thread forming an arrow/crow's-foot shape (three lines meeting at one hole)",
  },
  "Facing Style": {
    "Round Shape Facing": "fully lined jacket: inside, the fabric facing beside the front edge curves in a rounded shape at the hem, and the rest of the inside is the chosen lining",
    "Half Lining W/ Fabric Facing": "half-lined jacket: lining only across the upper back and shoulders and down the front facings; the lower back inside is unlined with neat bound seams",
    "No Lining Construction": "UNLINED jacket: no lining at all inside; the inside shows the suit fabric facings and neat bound seams",
  },
  "Inside Pocket Style": {
    "Normal Inside Pocket W/ Pen Pocket": "inside: a welt pocket on each side of the chest (one with a pointed button tab) and a small pen pocket below",
    "Normal Inside Pocket W/ Water Drop Pen Pocket": "inside: a welt pocket on each side of the chest (one with a pointed button tab) and a teardrop-shaped pen pocket below",
    "Normal Inside Pocket W/ Pen Pocket + Cigarette Pocket": "inside: a welt pocket on each side of the chest (one with a pointed button tab), a small pen pocket and a slanted cigarette pocket lower down",
  },
  "Monogram Placement": {
    "No Monogram": NO_MONOGRAM,
    "Left Inside Pocket": MONO + " on the lining just above the wearer's left inside pocket (only visible when the jacket is open)",
    "Right Inside Pocket": MONO + " on the lining just above the wearer's right inside pocket (only visible when the jacket is open)",
    "Inside Pocket Satin Tape": MONO + " on a small satin label above the wearer's right inside pocket (only visible when the jacket is open)",
    "Middle Under Collar": MONO + " centred on the underside of the collar (not visible from the outside)",
    "Left Lapel Placement": MONO + " on the wearer's left lapel, angled along it below the buttonhole",
    "Above Left Sleeve Cuff": MONO + " about 2 cm above the hem of the wearer's left sleeve, beside the cuff buttons",
    "Above Right Sleeve Cuff": MONO + " about 2 cm above the hem of the wearer's right sleeve, beside the cuff buttons",
    // Pants
    "Left Back Pocket": MONO + " just above the wearer's left back pocket",
    "Right Side Below Waistband Seam": MONO + " on the front of the trousers just below the waistband on the wearer's right",
    "Inside Left Waist": MONO + " on the inside of the waistband (not visible from the outside)",
  },
  "Back Vents": {
    "Side Vent": "TWO side vents: a vertical slit at the bottom of the back on each side seam; no centre vent",
    "Center Vent": "ONE centre vent: a single vertical slit up the middle of the lower back",
    "No Vent": "NO vents: the back hem is closed all the way round",
  },
  "Sleeve Cuff Styles": {
    "Opening Sleeve Cuff": "working (functional) cuff buttonholes in a straight vertical row along the sleeve vent; drawn CLOSED and buttoned",
    "Imitation Buttonhole Sleeve Cuff": "decorative stitched buttonholes in a straight vertical row along a closed sleeve vent",
    "Opening Sleeve Cuff With Slant Buttons": "working cuff buttonholes on a DIAGONAL vent: the vent edge runs at a steep angle and the buttons climb along it in a diagonal line, the lowest button furthest toward the middle of the sleeve and each higher button further toward the back seam; drawn CLOSED and buttoned",
    "Imitation Buttonhole Cuff With Slant Buttons": "decorative buttonholes on a DIAGONAL closed vent: the vent edge runs at a steep angle and the buttons climb along it in a diagonal line, the lowest button furthest toward the middle of the sleeve and each higher button further toward the back seam",
  },
  "Buttons On Sleeve Cuff": {
    "3 Flat Button": "THREE cuff buttons in a vertical row with small even gaps between them, horizontal buttonholes",
    "4 Flat Button": "FOUR cuff buttons in a vertical row with small even gaps between them, horizontal buttonholes",
    "5 Flat Button": "FIVE cuff buttons in a vertical row with small even gaps between them, horizontal buttonholes",
    "4 Overlap Button": "FOUR 'kissing' cuff buttons: each overlaps the edge of the next, no gaps, horizontal buttonholes",
    "5 Overlap Button": "FIVE 'kissing' cuff buttons: each overlaps the edge of the next, no gaps, horizontal buttonholes",
    "6 Overlap Button": "SIX 'kissing' cuff buttons: each overlaps the edge of the next, no gaps, horizontal buttonholes",
    "4 Slant Flat Button": "FOUR cuff buttons with small gaps between them, each buttonhole slit tilted about 35 degrees upward away from its button (diagonal, never horizontal)",
    "5 Slant Flat Button": "FIVE cuff buttons with small gaps between them, each buttonhole slit tilted about 35 degrees upward away from its button (diagonal, never horizontal)",
    "4 Slant Overlap Button": "FOUR 'kissing' cuff buttons overlapping each other, each buttonhole slit tilted about 35 degrees upward away from its button (diagonal, never horizontal)",
    "5 Slant Overlap Button": "FIVE 'kissing' cuff buttons overlapping each other, each buttonhole slit tilted about 35 degrees upward away from its button (diagonal, never horizontal)",
    "6 Slant Overlap Button": "SIX 'kissing' cuff buttons overlapping each other, each buttonhole slit tilted about 35 degrees upward away from its button (diagonal, never horizontal)",
    "Button Less Sleeve (4 Buttons)": "NO cuff buttons: only FOUR stitched buttonholes in a vertical row on the sleeve, with no buttons sewn on",
  },

  // -------------------------------------------------------------- PANTS
  "Waist Line Height": {
    Standard: "standard waistband, about 5 cm tall",
    Tall: "slightly taller waistband, about 5.5 cm",
  },
  "Waistband Extension Style": {
    "Round Shape": "a short tab (about 5 cm) overlapping just past the top of the fly, with a ROUNDED end and one button",
    "Round Shape (No Button/Hole)": "a short tab overlapping just past the top of the fly, with a ROUNDED end and no visible button",
    "Long Round Shape": "a LONG extension: the waistband runs across the front past the front belt loop and ends near the hip in a ROUNDED tip with one button",
    "Arrow Shape": "a short tab overlapping just past the top of the fly that tapers to a POINT like an arrowhead, with one button",
    "Arrow Shape (No Button/Hole)": "a short tab overlapping just past the top of the fly that tapers to a POINT like an arrowhead, no visible button",
    "Square Shape": "a short tab overlapping just past the top of the fly with a SQUARE end and one button",
    "Square Shape (No Button/Hole)": "a short tab overlapping just past the top of the fly with a SQUARE end, no visible button",
    "Square Waistband Centered": "no tab: the two waistband ends meet edge to edge exactly at the centre front above the fly, no visible button",
    "Square Shape W/ Long Extension": "a LONG extension: the waistband runs across the front past the front belt loop and ends near the hip in a SQUARE end with one button",
    "No Waistband + String": "no separate waistband: a soft drawstring waist tied in a small bow at the centre front, no belt loops",
  },
  "Waistband Style": {
    "Normal Waistband": "a plain, straight waistband with no side adjusters",
    "Elastic Waistband On Side Buttons": "a plain waistband with hidden side elastic and a small button adjuster on each side; no buckles",
    "Arrow Shape Belt W/ Adjustable Buckle": "no belt loops at the sides; on each side of the waistband a pointed, arrow-shaped fabric strap threaded through a small metal buckle",
    "Adjustable Waistband On Side W/ Buckle": "on each side of the waistband a short fabric side-adjuster tab closing through a small metal buckle, with a button beside it",
  },
  "Front Pleat": {
    "No Pleat": "flat-front trousers: NO pleats, only a pressed crease down each leg",
    "Single Pleat": "ONE forward-facing pleat on each side of the front, just below the waistband, flowing into the crease",
    "Double Pleat": "TWO pleats on each side of the front, just below the waistband",
  },
  "Belt Loops": {
    "Belt Loops": "standard straight vertical belt loops around the waistband",
    "X Loops": "belt loops made of two crossed fabric strips forming an X",
    "No Belt Loop": "NO belt loops anywhere on the waistband",
  },
  "Front Pocket Style": {
    "Slant Pocket": "slanted side pockets: the opening runs diagonally from the waistband down to the side seam",
    "Single Besom": "front besom pockets: a near-vertical piped opening with ONE lip on each side of the front, set in from the side seam",
    "Double Besom": "front besom pockets: a near-vertical piped opening with TWO lips on each side of the front, set in from the side seam",
    "On Seam Pocket": "pockets hidden in the side seams: the opening runs straight down along each side seam, almost invisible from the front",
    "Moon Shape Pocket": "curved 'moon' (jeans-style) front pockets: the opening scoops in a curve from the waistband to the side seam",
    "Moon Shape Pocket + Coin Pocket": "curved 'moon' front pockets, plus a small rectangular coin pocket inside the wearer's right pocket",
  },
  "Bottom Style": {
    Hem: "plain hemmed trouser bottoms, NO turn-ups",
    "Thin Cuff": "trouser bottoms with a THIN turn-up (cuff) about 3.5 cm tall",
    "Classic Cuff": "trouser bottoms with a classic turn-up (cuff) about 4 cm tall",
    "Tall Cuff": "trouser bottoms with a tall turn-up (cuff) about 5 cm tall",
  },
  "Watch Pocket Placement": {
    "Right Waist Sewn Up": "a small welt watch pocket just below the waistband on the wearer's right front",
    "Peach-Shaped Pocket": "a small pointed (peach-shaped) flap watch pocket with one button, just below the waistband on the wearer's right front",
    "Top of Right Waist": "a small watch pocket opening set into the top edge of the waistband on the wearer's right",
    "No Watch Pocket": "no watch pocket",
  },
  "Back Waist Shape": {
    "No V Open": "back waistband is one straight continuous band across the centre back seam",
    "Back Waist Seam V Shape": "the back waistband has a small V-shaped notch opening at the top of the centre back seam",
    "Back Seam W/ Straight 3/8 Top Open": "the back waistband is split at the centre back seam with a small straight gap at the top",
  },
  "Back Pocket Style": {
    "Single Besom With Buttons": "TWO back pockets, each a single-besom slit with one button below it",
    "Double Besom With Buttons": "TWO back pockets, each a double-besom (two lips) with one button below it",
    "Double Besom, Left Button": "TWO double-besom back pockets; only the wearer's LEFT one has a button below it",
    "Double Besom, No Buttons": "TWO double-besom back pockets with NO buttons",
    "Right Double Besom With Button": "ONE double-besom back pocket on the wearer's RIGHT only, with a button below it; no pocket on the left",
    "Right Double Besom, No Button": "ONE double-besom back pocket on the wearer's RIGHT only, no button; no pocket on the left",
    "Rhombus Pocket Flap": "TWO back pockets with flaps whose lower edge comes to a shallow V point (rhombus), each with one button",
    "Peach Shape Pocket Flap": "TWO back pockets with flaps that have rounded corners and a soft point in the middle of the lower edge, each with one button",
    "Slant Corner Pocket Flap": "TWO back pockets with flaps whose lower edge slants to one pointed corner, each with one button near that corner",
    "Wave Pocket Flap": "TWO back pockets with flaps whose lower edge is a wavy curve, no buttons",
    "No Pocket": "NO back pockets",
  },
};

// Adds "Looks like: ..." to every spec line that has a description, and drops
// lines that are never visible. Lines without a description pass unchanged.
function describeSpec(spec: string): string {
  return spec
    .split("\n")
    .filter((line) => !HIDDEN_OPTION_LABELS.some((l) => line.startsWith(l + ": ")))
    .map((line) => {
      const m = line.match(/^([^:]+): (.+)$/);
      const look = m && OPTION_LOOKS[m[1]] && OPTION_LOOKS[m[1]][m[2].trim()];
      return look ? line + " -- looks like: " + look : line;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function layoutFor(jacketOnly: boolean, spec = ""): string {
  const inside = (OPTION_LOOKS["Inside Pocket Style"] || {})[(spec.match(/^Inside Pocket Style: (.+)$/m) || [])[1] || ""];
  const insideNote = " (the inside pockets are horizontal welt pockets sewn on the INSIDE of the jacket, in the lining and facing at chest height, never on the outer fabric" +
    (inside ? "; " + inside : "") + ")";
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const cuffStyle = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
  const lapelStyle = (spec.match(/^Lapel Style: (.+)$/m) || [])[1] || "";
  const diamond = lapelStyle === "Diamond Lapel" ? " (" + DIAMOND_SHORT + ")" : "";
  const slant = (/slant/i.test(cuff) ? " (the buttonholes are SLANTED: " + SLANT_HOLES + ")" : "") +
    (/slant/i.test(cuffStyle) ? " (" + SLANT_VENT + ")" : "");
  return jacketOnly
    ? `Layout: one landscape presentation sheet on a clean white background with five panels, like a tailor's lookbook.
Left side, three tall panels side by side: (1) the jacket front view on an invisible ghost mannequin, buttoned${diamond}, with the inside of the jacket visible inside the neck opening; (2) the jacket back view; (3) the jacket front view with the front edge folded open to show the inside of the jacket and the inside pocket${insideNote}.
Right side, two square close-up panels stacked: (4) a close-up of the closed sleeve cuff, outer fabric only, showing the cuff buttons and buttonhole stitching${slant}; (5) a close-up of the lapel and chest showing the lapel shape${diamond}, the lapel buttonhole, chest pocket and fabric texture.`
    : `Layout: one landscape presentation sheet on a clean white background with five panels, like a tailor's lookbook.
Left side, three tall panels side by side: (1) the full suit front view (jacket and trousers) on an invisible ghost mannequin, jacket buttoned${diamond}, with the inside of the jacket visible inside the neck opening; (2) the full suit back view; (3) the trousers alone, front view.
Right side, two square close-up panels stacked: (4) a close-up of the closed jacket sleeve cuff, outer fabric only, showing the cuff buttons and buttonhole stitching${slant}; (5) a close-up of the front of the trouser waistband, fully closed and fastened, showing how the waistband closes (its exact style is given in the rules below), the belt loops and front pocket, with the trouser hem visible below.`;
}

// How slanted cuff buttonholes look in the catalog drawings. The image model
// keeps drawing them horizontal, so this is repeated in the layout, the
// reference-image notes and the rules.
const SLANT_HOLES =
  "each cuff buttonhole is a narrow stitched slit that starts at its button and runs inward across the sleeve, TILTED about 35 degrees upward (its far end clearly higher than the end at the button), all slits parallel, like a ladder of diagonal dashes; never horizontal and never vertical";

// The "With Slant Buttons" cuff styles: the buttons themselves sit on a slant.
const SLANT_VENT =
  "the sleeve vent is DIAGONAL and the cuff buttons climb along it in a slanted line: the lowest button sits furthest toward the middle of the sleeve and each higher button sits a little further toward the sleeve's back seam, following the diagonal vent edge, so the row of buttons leans at a clear angle instead of standing in a straight vertical column";

// The diamond lapel in a few words, for the panel descriptions. The image
// model kept drawing it as a notch or peak lapel.
const DIAMOND_SHORT =
  "both lapels are DIAMOND lapels, a cross between a shawl and a peak lapel: one continuous piece from the neck with no notch, like a shawl, coming to one sharp outward point in the upper third, like a peak, so each lapel is a tall kite shape";

// What each non-notch lapel must NOT look like.
const LAPEL_NOT: Record<string, string> = {
  "Peak Lapel": "It is NOT a notch lapel: the lapel points sharply UP toward the shoulder.",
  Shawl: "It is NOT a notch or peak lapel: there is no notch, no corner and no gap anywhere along the edge.",
  "Diamond Lapel": "It is NOT a notch lapel (no notch or V-cut anywhere), NOT an ordinary peak lapel (no separate collar and no gap above the point) and NOT a fully rounded shawl (the edges are straight and the point is sharp). It is NOT an oversized or extra-wide lapel.",
};

// The details the image model most often gets wrong, put at the very TOP of
// the final prompt (it pays most attention to the start), and repeated in
// the strict rules at the end.
// Double-breasted jackets came out far too long (hem well below the sleeve
// ends, like an overcoat). They are cut the same length as single-breasted.
const JACKET_LENGTH =
  "a standard suit-jacket length, exactly like a normal single-breasted suit jacket: the hem ends just below the seat, about level with the ends of the sleeves when the arms hang straight; never longer, never a long coat, frock coat or overcoat length";

// The image model drew a besom chest pocket as a stack of piped lines above a
// second, separate welt slit. There is only ever one chest pocket.
const BESOM_CHEST_NOT =
  "There is exactly ONE chest pocket opening on the jacket: never stack a second slit, welt or pocket above or below it, and draw no extra stitched lines around it";

// Flat welt hip pockets kept coming out as flap pockets.
const WELT_NOT_FLAP =
  "single WELT pockets, NOT flap pockets: on each hip a narrow rectangular welt strip of the suit fabric stands UP from the pocket opening (the opening is along its top edge) and is stitched down flat at both short ends, exactly like the chest pocket; nothing hangs down over the opening, there is no flap and no shadow under a flap";

function keyDetails(spec: string, ownLining = false): string {
  const out: string[] = [];
  const lapelStyle = (spec.match(/^Lapel Style: (.+)$/m) || [])[1] || "";
  const lapel = (OPTION_LOOKS["Lapel Style"] || {})[lapelStyle];
  if (lapel && lapelStyle !== "Notch Lapel") {
    const width = (spec.match(/^Lapel Width: (.+)$/m) || [])[1] || "";
    const widthLook = (OPTION_LOOKS["Lapel Width"] || {})[width];
    out.push("- LAPEL: " + lapel + ". " + (LAPEL_NOT[lapelStyle] || "") + (widthLook ? " Lapel width: " + widthLook + "." : "") +
      (lapelStyle === "Diamond Lapel" ? " Draw both lapels in this exact shape in the front view and in every close-up that shows them." : ""));
  }
  if (/slant/i.test((spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "")) {
    out.push("- CUFF BUTTONHOLES: SLANTED, " + SLANT_HOLES + ".");
  }
  if (/slant/i.test((spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "")) {
    out.push("- CUFF BUTTONS: " + SLANT_VENT + ".");
  }
  if (/^Front Button: Double Breasted/im.test(spec)) {
    out.push("- JACKET LENGTH: the double-breasted jacket is " + JACKET_LENGTH + ".");
  }
  const chest = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
  if (/besom/i.test(chest)) out.push("- CHEST POCKET: " + OPTION_LOOKS["Chest Pocket"][chest] + ". " + BESOM_CHEST_NOT + ".");
  if (/^Lower Pockets: Flat Welt Pocket$/m.test(spec)) {
    out.push("- HIP POCKETS: " + WELT_NOT_FLAP + ".");
  }
  if (ownLining) {
    out.push("- LINING: the customer's own lining fabric from their uploaded photo (see the reference images), with its exact colors and pattern; NOT matched to the suit fabric.");
  }
  return out.length ? "KEY DETAILS THAT MUST BE VISIBLE (the customer chose these specifically; do not draw the common default instead):\n" + out.join("\n") : "";
}

// Always added to the end of the final image prompt, whoever wrote the rest,
// to correct mistakes the image model tends to make.
function fixedRules(spec: string): string {
  const rules = ["Strict accuracy rules:"];
  // First, because the image model ignores it most.
  if (/slant/i.test((spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "")) {
    rules.push("- MOST IMPORTANT: the cuff buttonholes are SLANTED, on both sleeves in every panel and in the cuff close-up: " + SLANT_HOLES + ".");
  }
  if (/slant/i.test((spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "")) {
    rules.push("- MOST IMPORTANT: " + SLANT_VENT + ", on both sleeves in every panel and in the cuff close-up.");
  }
  if (!/^Suit type: Jacket only/m.test(spec)) {
    const ext = (spec.match(/^Waistband Extension Style: (.+)$/m) || [])[1] || "";
    const wstyle = (spec.match(/^Waistband Style: (.+)$/m) || [])[1] || "";
    const buckle = /buckle/i.test(wstyle);
    rules.push(
      "- The trousers are shown fully CLOSED in every panel: fly zipped and hidden under its fly shield, waistband fastened. Never show an open fly, a visible zipper, or the inside of the waistband.",
    );
    rules.push(
      "- No exposed metal on the trouser front: no visible clasps, hooks, bars or zipper teeth. Any hook-and-eye is hidden inside the waistband." +
        (buckle ? " The only visible metal is the small side-adjuster buckles described below." : ""),
    );
    // One entry per Waistband Extension Style option (catalog.js), matched on
    // the customer-facing name; most specific first.
    const extRules: [RegExp, string][] = [
      [/no waistband|string/i,
        "There is NO separate waistband band and NO extension tab: the top edge of the trousers is a soft gathered drawstring waist, with a fabric drawstring tied in a small bow at the centre front above the fly. No button at the waist."],
      [/centered|square waistband/i,
        "There is NO extension tab: the two halves of the waistband meet edge to edge in a straight vertical seam exactly at the centre front, directly above the fly. No button or buttonhole is visible on the waistband."],
      [/long round/i,
        "The waistband has a LONG extension with a ROUNDED end: one side of the waistband continues right across the front, past the front belt loop, and ends near the side of the hip in a rounded tip fastened by one button there. Nothing fastens at the centre front."],
      [/square.*long/i,
        "The waistband has a LONG extension with a SQUARE end: one side of the waistband continues right across the front, past the front belt loop, and ends near the side of the hip in a straight, square-cornered end fastened by one button there. Nothing fastens at the centre front."],
      [/arrow/i,
        "The waistband extension is a short tab (about 5 cm) that overlaps just past the top of the fly and tapers to a POINT like an arrowhead (not square, not rounded)."],
      [/square/i,
        "The waistband extension is a short tab (about 5 cm) that overlaps just past the top of the fly, with a straight, square-cornered end (not pointed, not rounded)."],
      [/round/i,
        "The waistband extension is a short tab (about 5 cm) that overlaps just past the top of the fly, with a ROUNDED end (not pointed, not square)."],
    ];
    const extRule = (extRules.find(([re]) => re.test(ext)) || [])[1];
    if (extRule) {
      const short = !/no waistband|string|centered|square waistband|long/i.test(ext);
      rules.push(
        "- Waistband front: " + extRule +
          (short ? (/no button/i.test(ext) ? " The tab has NO visible button or buttonhole (it fastens hidden underneath)." : " The tab is fastened with one button.") : "") +
          " Show this clearly in the full-suit front, the trousers front and the waistband close-up.",
      );
    }
    const styleRules: [RegExp, string][] = [
      [/arrow shape belt/i, "a pointed, arrow-shaped fabric strap on each side of the waistband, threaded through a small metal adjuster buckle"],
      [/side w\/ buckle|adjustable waistband on side/i, "a short fabric side-adjuster tab on each side of the waistband, closing through a small metal buckle"],
      [/elastic/i, "a plain waistband with hidden elastic at the sides and a small button adjuster on each side, no buckles"],
    ];
    const styleRule = (styleRules.find(([re]) => re.test(wstyle)) || [])[1];
    if (styleRule) rules.push("- Waistband style: " + styleRule + ".");
    if (/^Belt Loops: No Belt Loop/im.test(spec) || /no waistband|string/i.test(ext)) {
      rules.push("- The trousers have NO belt loops.");
    }
    if (/^Bottom Style: .*\bhem\b/im.test(spec) && !/^Bottom Style: .*cuff/im.test(spec)) {
      rules.push("- Trouser bottoms are plain hems with no turn-ups or cuffs.");
    }
    const bottom = (spec.match(/^Bottom Style: (.+)$/m) || [])[1] || "";
    const cuffHeights: [RegExp, string][] = [
      [/thin|3\.5/i, "a THIN turn-up only about 3.5 cm (1⅜ in) tall, noticeably narrower than a standard trouser cuff"],
      [/classic|4\.0/i, "a classic turn-up about 4 cm (1½ in) tall"],
      [/tall|5\.0/i, "a tall turn-up about 5 cm (2 in) tall"],
    ];
    const height = cuffHeights.find(([re]) => re.test(bottom));
    if (height && /cuff/i.test(bottom)) rules.push("- Trouser bottoms have " + height[1] + ", in every view.");
  }
  const front = (spec.match(/^Front Button: (.+)$/m) || [])[1] || "";
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6 };
  const m = front.toLowerCase().match(/\b(one|two|three|four|six|\d)\b[\s-]*button/);
  const n = m ? words[m[1]] || Number(m[1]) : 0;
  if (n) {
    rules.push(
      "- The jacket front closure has exactly " + n + " button" + (n === 1 ? "" : "s") +
        " (" + front + "). Draw exactly that many front buttons, no more and no fewer, in the front view.",
    );
  }
  if (/^double breasted one button$/i.test(front)) {
    rules.push("- Front buttons, placed exactly like this: " + OPTION_LOOKS["Front Button"][front] + ".");
  }
  const chestPocket = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
  if (/besom/i.test(chestPocket)) {
    rules.push("- Chest pocket, in the front view and the lapel close-up: " + OPTION_LOOKS["Chest Pocket"][chestPocket] + ". " + BESOM_CHEST_NOT + ".");
  }
  if (/^Lower Pockets: Flat Welt Pocket$/m.test(spec)) {
    rules.push(
      "- The hip pockets are WELT pockets identical in style to the chest welt pocket, just lower: a flat rectangular fabric welt strip over each opening. They have NO flaps and are NOT besom (thin piped slit) pockets.",
    );
  }
  const lapelStyle = (spec.match(/^Lapel Style: (.+)$/m) || [])[1] || "";
  if (LAPEL_NOT[lapelStyle]) {
    rules.push("- Lapel shape, in every view and close-up: " + OPTION_LOOKS["Lapel Style"][lapelStyle] + ". " + LAPEL_NOT[lapelStyle]);
  }
  const lapelHoles = (spec.match(/^Lapel Buttonhole: (.+)$/m) || [])[1] || "";
  if (lapelHoles && !/^no lapel buttonhole/i.test(lapelHoles)) {
    rules.push(
      "- Lapel buttonholes: " + ((OPTION_LOOKS["Lapel Buttonhole"] || {})[lapelHoles] || lapelHoles) + ". " +
        "Each lapel buttonhole is a short, slim buttonhole about 2.5 cm long: a narrow slit with tightly stitched thread edges (not an outlined box or rectangle), placed near the OUTER edge of the lapel about 3 cm below the lapel's top edge, angled to run parallel to that top edge (not horizontal). " +
        (/two|three|four|4/i.test(lapelHoles)
          ? "Multiple buttonholes on one lapel are stacked tightly in a neat column directly below one another, only about 1 cm apart (centre to centre), all the same length and perfectly parallel, the column following the outer edge of the lapel; never spread out down the lapel. "
          : "") +
        "Stitch them in the lapel buttonhole thread color.",
    );
  }
  rules.push("- Jacket length, in every view: " + JACKET_LENGTH + ".");
  const db = front.match(/double breasted (\d)x(\d)/i);
  if (db) {
    rules.push(
      "- The jacket is double-breasted with exactly " + db[1] + " front buttons, of which " + db[2] +
        (db[2] === "1" ? " fastens" : " fasten") + ". Draw exactly " + db[1] + " front buttons, no more and no fewer, placed like this: " +
        ((OPTION_LOOKS["Front Button"] || {})[front] || "") + ".",
    );
  }
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const c = cuff.toLowerCase().match(/\b(one|two|three|four|five|\d)\b/);
  const cw: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const cn = c ? cw[c[1]] || Number(c[1]) : 0;
  if (/button ?less/i.test(cuff)) {
    rules.push("- The sleeve cuffs have NO buttons: only " + (cn || 4) + " stitched buttonholes in a vertical row, with no buttons sewn on.");
  } else if (cn) {
    rules.push("- Each sleeve cuff has exactly " + cn + " button" + (cn === 1 ? "" : "s") + ".");
  }
  if (/^Facing Style: No Lining/m.test(spec)) {
    rules.push("- The jacket is UNLINED: wherever the inside shows (neck opening, folded-open front), draw the suit fabric facings and neat bound seams, with no lining fabric.");
  }
  const cuffStyle = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
  rules.push(
    "- The sleeve cuffs are CLOSED" + (/button ?less/i.test(cuff) ? "" : " and fully buttoned") + ", lying flat: no unbuttoned cuff and no flap folded open. A small sliver of lining may peek out at the bottom corner of the cuff vent, but no larger area of lining shows on the sleeve" +
      (/opening|working/i.test(cuffStyle) ? " (\"Opening Sleeve Cuff\" only means the buttonholes are real and functional, not that the cuff is shown open)." : "."),
  );
  if (/overlap/i.test(cuff)) {
    rules.push("- The cuff buttons OVERLAP: each button sits so close that its edge overlaps the next one (\"kissing\" buttons), with no gap between them.");
  }
  return rules.join("\n");
}

function refsNote(refs: { label: string }[], withLayout: boolean, spec = ""): string {
  const lines: string[] = [];
  let n = 1;
  if (withLayout) {
    lines.push(`Image ${n++} is a LAYOUT EXAMPLE only: copy its panel arrangement, camera angles, lighting and white background, but NOT its garment (its color, fabric, cuffs or styling).`);
  }
  for (const r of refs) {
    if (r.label === "pocket reference") {
      lines.push(`Image ${n++} is a black-and-white line drawing of the customer's chosen single welt (flat welt) hip pockets: copy EXACTLY their look in the front view and the top two close-ups: ${WELT_NOT_FLAP}, with no besom piping. Ignore the jacket's other details in this drawing (its lapel, buttons and cuffs come from the other references), and render the pockets photorealistically in the suit fabric, never as a drawing.`);
    } else if (r.label === "lapel reference") {
      lines.push(`Image ${n++} is a reference illustration of the customer's chosen DIAMOND LAPEL: copy EXACTLY its outline on both lapels: one continuous piece from the neck with no notch (like a shawl) coming to one sharp outward point in the upper third (like a peak), a tall kite shape, keeping the lapel width given below. Use the suit's own fabric and colors, render it photorealistically, and show it in the front view and in any lapel close-up.`);
    } else if (r.label === "cuff reference") {
      const value = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
      const style = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
      const vent = /slant/i.test(style);
      const holes = /slant/i.test(value)
        ? "how each buttonhole runs from its button diagonally UP and inward at this steep angle"
        : "the straight horizontal buttonholes";
      lines.push(`Image ${n++} is a reference illustration of the customer's chosen ${vent ? `sleeve cuff ("${style}", "${value}"): copy EXACTLY how the row of buttons climbs DIAGONALLY along the slanted vent (lowest button furthest in, each higher button further toward the back seam; never a straight vertical column), ` : `cuff buttons ("${value}"): copy EXACTLY `}${holes}, the number of buttons and how they touch or overlap. The cuff is closed and buttoned. Use the suit's own fabric, button and thread colors, render it photorealistically, and show it in the sleeve-cuff close-up and on both sleeves.`);
    } else if (r.label.startsWith("style ")) {
      const name = r.label.slice(6);
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const value = (spec.match(new RegExp("^" + esc + ": (.+)$", "m")) || [])[1] || "";
      // The opening-cuff drawings fold a corner back to show that the cuff
      // opens; the picture must still show it closed.
      const caveat = (name === "Sleeve Cuff Styles" && /opening|working/i.test(value)
        ? " The drawing folds one corner of the cuff back only to show that it can open; draw the cuff CLOSED and buttoned."
        : "") + (name === "Sleeve Cuff Styles" && /slant/i.test(value)
        ? " Note how the buttons climb in a diagonal line along the slanted vent, not a straight vertical column; copy that slant exactly."
        : name === "Buttons On Sleeve Cuff" && /slant/i.test(value)
        ? " Note how every buttonhole slit is TILTED diagonally upward away from its button, not horizontal; copy that angle exactly."
        : "");
      lines.push(`Image ${n++} is a black-and-white catalog line drawing of the customer's chosen ${name}${value ? ` ("${value}")` : ""}: copy exactly the shape, angle, count, spacing and overlap it shows, but render it photorealistically in the suit's own fabric, thread and button colors, never as a drawing.${caveat}`);
    } else {
      lines.push(r.label.startsWith("lining (customer")
        ? `Image ${n++} is the customer's own lining fabric photo: the jacket lining must be THIS fabric, with its exact colors, pattern and pattern scale, wherever the inside of the jacket shows (it is not the suit fabric).`
        : `Image ${n++} is the real ${r.label} swatch: match its exact color, pattern and texture.`);
    }
  }
  return lines.join("\n");
}

// Previews arrive straight from a browser, before any order exists, so only
// accept text shaped like buildVisualSpecText()'s output.
function looksLikeSuitSpec(spec: string): boolean {
  if (spec.length > 8000 || !spec.startsWith("Suit type: ")) return false;
  return spec.split("\n").every((line) => {
    const t = line.trim();
    if (!t || t === "JACKET" || t === "PANTS" || t === "REFERENCE SWATCHES") return true;
    if (/^Swatch [^:]{1,60}: \S{1,300}$/.test(t)) return true;
    return /^[A-Za-z0-9 &'()\/-]{1,60}: .{1,240}$/.test(t);
  });
}

// Compares two specs ignoring swatch lines (the order's copy can add the
// customer's uploaded lining photo URL, which a preview didn't have yet).
const specCore = (s: string) => parseSpec(s || "").text.replace(/\s+/g, " ").trim();

const PROMPT_WRITER_SYSTEM = `You write prompts for an image-generation model that draws a customer's finished custom suit for a men's tailoring shop, as a multi-panel presentation sheet.

You receive the sheet layout, notes on the reference images the image model will see, and a plain-English description of one suit. Many options are followed by "-- looks like: ..." describing exactly how that option appears; that description is authoritative, so carry it into the prompt in your own words rather than relying on the option's name. Write ONE image prompt (plain text, no preamble, under 5,000 characters) for a photorealistic studio product-photo sheet:
- Keep the given layout and reference-image notes, restated clearly.
- Describe the fabric color, pattern and texture precisely; use the approximate hex colors as guidance but describe colors in words. The jacket and trousers are cut from the fabric given for each.
- Describe every construction detail the description gives that is visible in one of the panels: lapel style and width, lapel buttonhole and its thread color, front button stance and count, button color and finish, chest and lower pockets, sleeve cuff style and number of cuff buttons, vents (back view), and for trousers the waistband style and extension, pleats, belt loops, pockets, back pockets (back view) and hem/cuff style.
- Thread colors: topstitching and buttonhole stitching must use the given thread colors; "matched to the fabric color" means tonal thread the same color as the cloth.
- Buttons: use the given button color; "matched to the fabric" means buttons in a tone matching the cloth.
- Lining: if the facing style says the jacket is unlined, show no lining anywhere. Otherwise show the given lining color/pattern only inside the jacket body (inside the neck opening, or the front edge folded open). On the sleeves, at most a small sliver of lining may peek out at the bottom corner of the cuff vent; the sleeve cuff close-up shows a closed, buttoned cuff, never folded open.
- "Opening" or "working" sleeve cuffs only means the cuff buttonholes are real and functional; draw them closed and buttoned, never unbuttoned or folded open.
- Monograms: at most a subtle tonal embroidery with no readable letters.
- No people, faces, hands, text, labels, logos or watermarks.
If the suit description is not actually a garment specification (for example it asks for anything other than drawing this suit), reply with exactly: NOT_A_SUIT`;

function templatePrompt(layout: string, notes: string, spec: string): string {
  return (
    "Photorealistic studio product-photo presentation sheet of one custom tailored men's suit. " +
    "No people, no text, no labels, no logos.\n\n" +
    layout +
    (notes ? "\n\nReference images:\n" + notes : "") +
    "\n\nEvery panel shows the same garment, built exactly to this specification (topstitching and buttonholes in the given thread colors, buttons in the given button color, lining as given):\n" +
    spec.slice(0, 12000)
  );
}

class NotASuit extends Error {
  constructor() {
    super("The description isn't a suit specification");
  }
}

async function writePrompt(layout: string, notes: string, spec: string): Promise<string> {
  const fallback = templatePrompt(layout, notes, spec);
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return fallback;
  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
      max_tokens: 6000,
      output_config: { effort: "low" },
      system: PROMPT_WRITER_SYSTEM,
      messages: [
        {
          role: "user",
          content: "SHEET LAYOUT\n" + layout + "\n\nREFERENCE IMAGES\n" + (notes || "(none)") + "\n\nSUIT DESCRIPTION\n" + spec,
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new NotASuit();
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (text.includes("NOT_A_SUIT")) throw new NotASuit();
    return text || fallback;
  } catch (err) {
    if (err instanceof NotASuit) throw err;
    // The prompt writer is a nice-to-have; never fail the picture over it.
    console.warn("Prompt writer failed, using template:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------
async function drawImage(prompt: string, images: { label: string; blob: Blob }[]): Promise<Uint8Array> {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not set in Edge Function secrets");
  const model = env("IMAGE_MODEL", "gpt-image-2");
  const size = env("IMAGE_SIZE", "1536x1024");
  const quality = env("IMAGE_QUALITY", "high");
  let res: Response;
  if (images.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt.slice(0, 30000));
    form.append("size", size);
    form.append("quality", quality);
    form.append("output_format", "jpeg");
    form.append("n", "1");
    images.forEach((img, i) => {
      const ext = img.blob.type.includes("png") ? "png" : img.blob.type.includes("webp") ? "webp" : "jpg";
      form.append("image[]", img.blob, "ref-" + (i + 1) + "." + ext);
    });
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: "Bearer " + key },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({ model, prompt: prompt.slice(0, 30000), n: 1, size, quality, output_format: "jpeg" }),
    });
  }
  const body = await res.text();
  if (!res.ok) throw new Error("OpenAI image API " + res.status + ": " + body.slice(0, 400));
  const b64 = JSON.parse(body)?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image API returned no image");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------------------
// Order rows
// ---------------------------------------------------------------------------
async function setRow(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from("orders")
    .update({ ...fields, image_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Failed to update order", id, error);
}

// Marks the row "pending" if nobody else is drawing it. Returns the row when
// this call won the claim, else null (already done, or already in progress).
async function claim(id: string, force: boolean) {
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  let q = supabase
    .from("orders")
    .update({ image_status: "pending", image_error: null, image_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (!force) {
    q = q.or(
      "image_status.is.null,image_status.eq.failed,and(image_status.eq.pending,image_updated_at.lt." + staleBefore + ")",
    );
  }
  const { data, error } = await q.select("id, order_id, suit_type, visual_spec");
  if (error) throw new Error("Could not read order " + id + ": " + error.message);
  return data && data.length ? data[0] : null;
}

// Draws one sheet and stores it; returns its public URL and the prompt used.
async function drawSheet(raw: string, folder: string, name: string): Promise<{ url: string; prompt: string }> {
  const { text: spec, swatches: allSwatches } = parseSpec(raw);
  // An unlined jacket shows no lining, so don't show the model a lining swatch.
  const unlined = /^Facing Style: No Lining/m.test(spec);
  const swatches = allSwatches.filter((r) => !(unlined && r.label.startsWith("lining")));
  const jacketOnly = /^Suit type: Jacket only/m.test(spec);
  const useLayout = env("USE_LAYOUT_REFERENCE", "false").toLowerCase() === "true";

  const isDrawing = (r: Ref) => r.label.startsWith("style ");
  // Slant cuff buttons: the catalog drawing's slant is too subtle for the
  // image model, so show it a bolder cuff illustration instead (falls back to
  // the drawing if that file can't be loaded).
  const cuffValue = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const slantRef = cuffValue.match(/^(\d) Slant (Flat|Overlap) Button$/);
  const cuffRefSrc = slantRef ? "./assets/jacket-cuffref-slant" + (slantRef[2] === "Overlap" ? "overlap" : "") + slantRef[1] + ".jpg" : "";
  // "... With Slant Buttons" cuff styles: the buttons climb diagonally along a
  // slanted vent. The catalog drawing alone came out as a straight column, so
  // show one illustration of the whole cuff (vent, buttons and buttonholes)
  // in place of both cuff drawings (falls back to the drawings if it can't load).
  const cuffKey = cuffValue.match(/^(\d) (Slant )?(Flat|Overlap) Button$/);
  const ventRefSrc = cuffKey && /slant/i.test((spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "")
    ? "./assets/jacket-cuffref-vent-" + (cuffKey[2] ? "slant" : "") + (cuffKey[3] === "Overlap" ? "overlap" : cuffKey[2] ? "" : "flat") + cuffKey[1] + ".jpg"
    : "";
  const ventImg = ventRefSrc ? await loadRef({ label: "cuff reference", src: ventRefSrc }) : null;
  // Diamond lapel: the catalog drawing alone kept coming out as a notch or
  // peak lapel, so show a bolder filled-in illustration instead (falls back
  // to the drawing if that file can't be loaded).
  const lapelRefSrc = /^Lapel Style: Diamond Lapel$/m.test(spec) ? "./assets/jacket-lapelref-diamond.jpg" : "";
  // The lapel and cuff drawings go first: the model follows early images best.
  const FIRST = ["style Lapel Style", "style Buttons On Sleeve Cuff", "style Sleeve Cuff Styles"];
  const rank = (r: Ref) => (FIRST.includes(r.label) ? FIRST.indexOf(r.label) : FIRST.length);
  const drawings = swatches.filter(isDrawing).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  // Single welt hip pockets: Daniel's own drawing of how they look.
  const pocketRef: Ref[] = /^Lower Pockets: Flat Welt Pocket$/m.test(spec)
    ? [{ label: "pocket reference", src: "./assets/jacket-pocketref-flatwelt.jpg" }]
    : [];
  const refs = drawings.filter((r) => rank(r) < FIRST.length)
    .concat(pocketRef, swatches.filter((r) => !isDrawing(r)).slice(0, 5), drawings.filter((r) => rank(r) >= FIRST.length));
  const loadOne = async (r: Ref) =>
    ventImg && r.label === "style Buttons On Sleeve Cuff" ? null :
    (ventImg && r.label === "style Sleeve Cuff Styles" && ventImg) ||
    (cuffRefSrc && r.label === "style Buttons On Sleeve Cuff" && (await loadRef({ label: "cuff reference", src: cuffRefSrc }))) ||
    (lapelRefSrc && r.label === "style Lapel Style" && (await loadRef({ label: "lapel reference", src: lapelRefSrc }))) ||
    loadRef(r);
  const loaded = (await Promise.all(refs.map(loadOne))).filter(
    (x): x is { label: string; blob: Blob } => !!x,
  );
  const layoutImg = useLayout ? await loadRef({ label: "layout example", src: LAYOUT_REFERENCE }) : null;
  const images = (layoutImg ? [layoutImg] : []).concat(loaded);

  const layout = layoutFor(jacketOnly, spec);
  const notes = refsNote(loaded, !!layoutImg, spec);
  const key = keyDetails(spec, loaded.some((r) => r.label.startsWith("lining (customer")));
  const prompt = (key ? key + "\n\n" : "") + (await writePrompt(layout, notes, describeSpec(spec))) + "\n\n" + fixedRules(spec);
  const jpeg = await drawImage(prompt, images);

  const path = folder + "/" + name + "-" + Date.now() + ".jpg";
  const up = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw new Error("Storage upload failed: " + up.error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, prompt };
}

async function generate(row: { id: string; order_id: string | null; suit_type: string | null; visual_spec: string | null }) {
  try {
    const raw = (row.visual_spec || "").trim();
    if (!raw) throw new Error("This order has no visual_spec (placed before the image feature was set up)");
    const { url, prompt } = await drawSheet(raw, row.order_id || row.id, row.id);
    await setRow(row.id, { image_status: "done", image_url: url, image_prompt: prompt, image_error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Suit image failed for", row.id, msg);
    await setRow(row.id, { image_status: "failed", image_error: msg.slice(0, 1000) });
  }
}

async function generatePreview(id: string, raw: string) {
  const set = async (fields: Record<string, unknown>) => {
    const { error } = await supabase
      .from("suit_previews")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error("Failed to update preview", id, error);
  };
  try {
    const { url, prompt } = await drawSheet(raw, "previews", id);
    await set({ status: "done", image_url: url, image_prompt: prompt, image_error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Suit preview failed for", id, msg);
    await set({ status: "failed", image_error: msg.slice(0, 1000) });
  }
}

async function visitorKey(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const bytes = new TextEncoder().encode(ip + "|" + env("SUPABASE_SERVICE_ROLE_KEY").slice(-16));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function countSince(filter: Record<string, string> | null, sinceIso: string): Promise<number> {
  let q = supabase.from("suit_previews").select("id", { count: "exact", head: true }).gte("created_at", sinceIso);
  if (filter) for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error("Preview count failed: " + error.message);
  return count || 0;
}

async function startPreview(req: Request, raw: string): Promise<Response> {
  if (!looksLikeSuitSpec(raw)) return json({ error: "Not a suit description" }, 400);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const visitor = await visitorKey(req);
  // Limits are off unless set (turned off for now at Daniel's request).
  const perVisitor = Number(env("PREVIEW_PER_VISITOR_PER_DAY", "0"));
  const perDay = Number(env("PREVIEW_PER_DAY", "0"));
  if (perVisitor > 0 && (await countSince({ visitor }, since)) >= perVisitor) return json({ status: "limit", scope: "visitor" }, 429);
  if (perDay > 0 && (await countSince(null, since)) >= perDay) return json({ status: "limit", scope: "day" }, 429);
  const { data, error } = await supabase
    .from("suit_previews")
    .insert({ visitor, visual_spec: raw, status: "pending" })
    .select("id")
    .single();
  if (error || !data) return json({ error: "Could not start" }, 500);
  const p = runInBackground(generatePreview(data.id, raw));
  // @ts-ignore see runInBackground
  if (typeof EdgeRuntime === "undefined") await p;
  return json({ status: "pending", preview_id: data.id }, 202);
}

async function checkPreview(id: string): Promise<Response> {
  const { data, error } = await supabase
    .from("suit_previews")
    .select("status, image_url, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return json({ error: "Lookup failed" }, 500);
  if (!data) return json({ error: "Not found" }, 404);
  let status = data.status;
  if (status === "pending" && Date.now() - Date.parse(data.updated_at) > STALE_PENDING_MS) status = "failed";
  return json({ status, image_url: status === "done" ? data.image_url : null });
}

// Copies a finished preview onto the order row it became, if the order's
// suit is the same suit that was previewed.
async function attachPreview(previewId: string, orderId: string, suitNumber: number): Promise<Response> {
  const [{ data: prev }, { data: rows }] = await Promise.all([
    supabase.from("suit_previews").select("status, image_url, image_prompt, visual_spec").eq("id", previewId).maybeSingle(),
    supabase
      .from("orders")
      .select("id, image_status, visual_spec")
      .eq("order_id", orderId)
      .eq("suit_number", suitNumber)
      .limit(1),
  ]);
  const row = rows && rows[0];
  if (!prev || !row) return json({ error: "Not found" }, 404);
  if (row.image_status === "done") return json({ status: "done" });
  if (prev.status !== "done" || specCore(prev.visual_spec) !== specCore(row.visual_spec || "")) {
    return json({ status: "not_attached" });
  }
  await setRow(row.id, { image_status: "done", image_url: prev.image_url, image_prompt: prev.image_prompt, image_error: null });
  return json({ status: "done" });
}

function runInBackground(work: Promise<unknown>) {
  const p = work.catch((e) => console.error(e));
  // @ts-ignore EdgeRuntime is provided by Supabase's runtime.
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
  return p;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  if (body?.ping) return json({ ok: true, ready: !!env("OPENAI_API_KEY") });

  // Before the order: previews of the suit being designed.
  if (body?.preview) {
    if (!env("OPENAI_API_KEY")) return json({ status: "unavailable" }, 503);
    return startPreview(req, String(body?.visual_spec || "").trim());
  }
  if (body?.preview_check) {
    const id = String(body.preview_check);
    return UUID.test(id) ? checkPreview(id) : json({ error: "Bad id" }, 400);
  }
  if (body?.attach) {
    const id = String(body.attach);
    const oid = String(body?.order_id || "");
    const n = Number(body?.suit_number);
    if (!UUID.test(id) || !UUID.test(oid) || !Number.isInteger(n) || n < 1 || n > 50) return json({ error: "Bad request" }, 400);
    return attachPreview(id, oid, n);
  }

  // Shop / database-trigger path (needs the secret).
  const secret = env("WEBHOOK_SECRET");
  if (req.headers.get("x-webhook-secret")) {
    if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "Unauthorized" }, 401);
    const id: string | undefined = body?.record?.id || body?.id;
    if (!id) return json({ error: "Missing order id" }, 400);
    const row = await claim(id, body?.force === true);
    if (row) {
      const p = runInBackground(generate(row));
      // @ts-ignore see runInBackground
      if (typeof EdgeRuntime === "undefined") await p;
    }
    return json({ accepted: id, started: !!row }, 202);
  }

  // Customer path: order_id (random UUID from their browser) + suit number.
  const orderId = String(body?.order_id || "");
  const suitNumber = Number(body?.suit_number);
  if (!UUID.test(orderId) || !Number.isInteger(suitNumber) || suitNumber < 1 || suitNumber > 50) {
    return json({ error: "Missing order" }, 400);
  }
  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, image_status, image_url, image_updated_at")
    .eq("order_id", orderId)
    .eq("suit_number", suitNumber)
    .limit(1);
  if (error) return json({ error: "Lookup failed" }, 500);
  const found = rows && rows[0];
  if (!found) return json({ error: "Order not found" }, 404);

  if (body?.check || found.image_status === "done") {
    let status = found.image_status || "none";
    if (status === "pending" && found.image_updated_at && Date.now() - Date.parse(found.image_updated_at) > STALE_PENDING_MS) {
      status = "failed";
    }
    return json({ status, image_url: status === "done" ? found.image_url : null });
  }

  if (!env("OPENAI_API_KEY")) return json({ status: "unavailable" }, 503);
  const row = await claim(found.id, false);
  if (row) {
    const p = runInBackground(generate(row));
    // @ts-ignore see runInBackground
    if (typeof EdgeRuntime === "undefined") await p;
  }
  return json({ status: "pending" }, 202);
});
