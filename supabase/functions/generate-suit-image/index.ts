// Scott Suits -- draws a picture sheet of a customer's finished suit.
//
// The sheet's panels are described to the model in words only: full suit
// front, full suit back, trousers back close-up, a sleeve-cuff close-up and a
// trouser-waistband close-up. Jacket-only orders get a top row of three whole
// jacket views (front, back, open) over a row of three close-ups (cuff, chest,
// hip pockets), so the jackets keep their natural width instead of being
// squeezed into narrow columns.
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
//     Starting a drawing (preview, or an order row) needs a signed-in
//     customer's token (Authorization: Bearer); guests get 401
//     { status: "signin" }. Checking and attaching don't.
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
//   PREVIEW_PER_ACCOUNT_PER_DAY optional, default 3; pictures one signed-in
//                      account can draw in 24 hours (0 = no limit)
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
// When a catalog option is added, add it here too. When a step or option is
// renamed on the site, catalog.js keeps its old name as specLabel / specName
// and buildVisualSpecText() still writes that, so nothing here has to change.

const HIDDEN_OPTION_LABELS = [
  // Inside the garment, never visible in any panel.
  "Construction",
  "Felt Under Collar",
  "Felt Color",
  // The opening/closing hardware under a closed waistband.
  "Hook And Eye Style",
];

const NO_MONOGRAM = "no monogram or embroidery anywhere on the garment";
const MONO = "a small embroidered monogram (about 4 cm wide) spelling the Monogram Text exactly, in the Monogram Font style and the monogram thread color,";

const OPTION_LOOKS: Record<string, Record<string, string>> = {
  // ------------------------------------------------------------- JACKET
  Lining: {
    "Upload Your Own Photo (+$80)": "the customer's OWN lining fabric, shown in the swatch photo labelled \"lining (customer's own photo)\": copy its exact colors, pattern and scale; it is NOT matched to the suit fabric",
  },
  "Lapel Style": {
    "Notch Lapel": "classic notch lapel: the collar meets the lapel at a small V-shaped notch opening outward, and the lapel tip points sideways/slightly down",
    "Peak Lapel": "peak lapel: the lapel's upper edge sweeps UP into a sharp point aimed at the shoulder, nearly touching the collar, with only a narrow gap between them",
    "Semi-Notch Lapel": "semi-notch lapel: like a classic notch lapel, but the notch between collar and lapel is a SMALL, shallow V and the lapel tip points straight out sideways (level, not down), sitting close under the collar",
    "Semi-Peak Lapel": "semi-peak lapel: a softer, shorter peak; the lapel's upper edge rises slightly UPWARD to a modest point that stays well below the collar, with a clear open gap between point and collar (less dramatic than a full peak lapel)",
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
    "Left Buttonhole": "one buttonhole on the wearer's LEFT lapel; none on the right",
    "Double Left Buttonhole": "TWO buttonholes stacked on the wearer's LEFT lapel; none on the right",
    "Right & Left Buttonhole": "one buttonhole on EACH lapel, mirrored at the same height",
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
    "Besom Pocket": "ONE double-besom breast pocket on the wearer's left chest, angled slightly upward toward the arm: a single slit opening about 11 cm long edged by two thin piped lips of the suit fabric (one just above the opening and one just below it, each about 4 mm tall, touching each other), so the whole pocket is one slim band under 1 cm tall; flush with the chest, no welt strip and no flap",
    "Patch Pocket No Flap": "a patch breast pocket sewn on top of the wearer's left chest with rounded bottom corners and no flap",
    "No Pocket": "NO breast pocket at all; the left chest is plain",
  },
  "Lower Pockets": {
    "Besom Pocket": "two straight, horizontal double-besom hip pockets (two thin piped lips each), no flaps",
    "Besom + Besom Ticket": "two straight, horizontal double-besom hip pockets (two thin piped lips each, no flaps), plus ONE smaller double-besom ticket pocket (two thin lips, no flap) about 4 cm above the wearer's right hip pocket only",
    "Flat Welt Pocket": "two hip pockets that look like a classic suit breast welt pocket (the ordinary chest pocket on most suits), only lower (at hip level) and a little wider: each is a flat, upright rectangular welt strip of the suit fabric about 2 cm tall sewn over a straight horizontal opening, with neatly stitched ends, clearly visible as a raised band. NO flaps and NO besom (thin piped slit) openings",
    "Besom Slant Pocket": "two double-besom hip pockets (two thin piped lips each, no flaps) cut on a DIAGONAL of about 20 degrees, each rising toward the front buttons ('/' on the left of the picture, '\\' on the right)",
    "Flap Pockets": "two straight horizontal hip pockets with rectangular flaps",
    "Flap Pockets + Besom Ticket": "two straight horizontal hip pockets with rectangular flaps, plus ONE smaller double-besom ticket pocket (two thin lips, no flap) about 4 cm above the wearer's right hip pocket only",
    "Flap Pockets + Flap Ticket Pocket": "two straight horizontal hip pockets with rectangular flaps, plus ONE smaller flap ticket pocket (a two-thirds-size copy of a hip pocket, with its own flap) about 4 cm above the wearer's right hip pocket only",
    "Slant Flap Pocket": "two hip pockets with rectangular flaps ('hacking' pockets) cut on a DIAGONAL of about 20 degrees, each rising toward the front buttons ('/' on the left of the picture, '\\' on the right)",
    "Slant Flap + Besom Ticket": "two hip pockets with rectangular flaps cut on a DIAGONAL of about 20 degrees, each rising toward the front buttons ('/' on the left of the picture, '\\' on the right), plus ONE smaller double-besom ticket pocket (two thin lips, no flap) about 4 cm above the wearer's right hip pocket only, at the same slant as it",
    "Slant Flap + Flap Ticket Pocket": "two hip pockets with rectangular flaps cut on a DIAGONAL of about 20 degrees, each rising toward the front buttons ('/' on the left of the picture, '\\' on the right), plus ONE smaller flap ticket pocket (a two-thirds-size copy of a hip pocket, with its own flap) about 4 cm above the wearer's right hip pocket only, at the same slant as it",
    "Diamond Flap": "two straight horizontal hip pockets, each covered by a flap whose bottom edge comes to a shallow point in the middle (a wide, flat V), no buttons",
    "Diamond Flap With Buttons": "two straight horizontal hip pockets, each covered by a flap whose bottom edge comes to a shallow point in the middle (a wide, flat V), with one small button sewn in the middle of each flap",
    "Patch Pocket": "two square patch pockets sewn on top of the jacket at the hips, open at the top, no flaps",
    "Patch Pocket + Besom Ticket": "two patch hip pockets sewn on top of the jacket, open at the top, no flaps, plus ONE double-besom ticket pocket (two thin lips, no flap; not a patch) about 4 cm above the wearer's right patch pocket only",
    "High-Back Patch Pocket": "two patch hip pockets whose top edge slopes, higher at the back (side) than at the front",
    "High-Back Patch + Besom Ticket": "two high-back patch hip pockets (top edge higher at the side seam than at the front), plus ONE double-besom ticket pocket (two thin lips, no flap; not a patch) about 4 cm above the wearer's right patch pocket only",
    "No Front Pocket": "NO hip pockets at all; the lower front of the jacket is plain",
  },
  "Button Nail Method": {
    "X Shape Sewing": "four-hole buttons sewn on with the thread crossing in an X",
    "Parallel Sewing": "four-hole buttons sewn on with two parallel thread bars (=)",
    "Square Sewing": "four-hole buttons sewn on with the thread forming a small square joining the four holes",
  },
  "Facing Style": {
    "Round Shape Facing": "fully lined jacket: inside, the fabric facing beside the front edge curves in a rounded shape at the hem, and the rest of the inside is the chosen lining",
    "Half Lining W/ Fabric Facing": "half-lined jacket: lining only across the upper back and shoulders and down the front facings; the lower back inside is unlined with neat bound seams",
    "No Lining Construction": "UNLINED jacket: no lining at all inside; the inside shows the suit fabric facings and neat bound seams",
  },
  "Inside Pocket Style": {
    "Regular Inner Pocket": "inside: a welt pocket on each side of the chest (the one on the wearer's left closed by a small pointed tab and button that are sewn INSIDE, on the lining; the outside of the jacket has no tab or button at the chest), a short pen pocket welt just below the wearer's right chest pocket, and ONE more welt pocket at waist height on the wearer's right side only",
    "Fashion Inner Pocket": "inside: a welt pocket on each side of the chest (the one on the wearer's left closed by a small pointed tab and button that are sewn INSIDE, on the lining; the outside of the jacket has no tab or button at the chest), a short pen pocket welt just below the wearer's right chest pocket, and a welt pocket at waist height on BOTH sides",
    "Combination Inner Pocket": "inside: a welt pocket on each side of the chest (the one on the wearer's left closed by a small pointed tab and button that are sewn INSIDE, on the lining; the outside of the jacket has no tab or button at the chest) with a short welt just below it; on the wearer's right, a narrow upright pen slot high on the facing near the lapel, a small teardrop-shaped pen pocket just below the chest pocket, and ONE more welt pocket at waist height",
    "No Inner Pockets": "inside: NO pockets at all; the lining and facings are plain, with no welts, tabs or buttons",
  },
  "Monogram Placement": {
    "No Monogram": NO_MONOGRAM,
    "Left Inside Pocket": MONO + " on the lining just above the wearer's left inside pocket (only visible when the jacket is open)",
    "Right Inside Pocket": MONO + " on the lining just above the wearer's right inside pocket (only visible when the jacket is open)",
    "Inside Pocket Satin Tape": MONO + " on a small name label above the wearer's left inside pocket (only visible when the jacket is open)",
    "Middle Under Collar": MONO + " centred on the underside of the collar (not visible from the outside)",
    "Left Lapel Placement": MONO + " on the wearer's left lapel, angled along it below the buttonhole",
    "Above Left Sleeve Cuff": MONO + " about 2 cm above the hem of the wearer's left sleeve, beside the cuff buttons",
    "Above Right Sleeve Cuff": MONO + " about 2 cm above the hem of the wearer's right sleeve, beside the cuff buttons",
    // Pants
    "Left Back Pocket": MONO + " just above the wearer's left back pocket",
    "Right Side Below Waistband Seam": MONO + " on the front of the trousers just below the waistband on the wearer's right",
    "Inside Left Waist": MONO + " on the inside of the waistband (not visible from the outside)",
  },
  // The factory's embroidery fonts (catalog.js MONOGRAM_FONT_OPTIONS, shown names).
  "Monogram Font": {
    "Calligraphy": "a formal copperplate calligraphy script: flowing, joined, slanted letters with fine hairlines and looped capitals",
    "Script": "a smooth, joined cursive script with rounded, gently slanted letters",
    "Book Script": "a classic formal script: elegant joined letters, lightly slanted, with modest loops",
    "Gradl": "an ornate engraver's script: tall, finely flourished, joined letters with sweeping capitals",
    "Bradley": "a casual handwritten script, like neat pen handwriting: joined, slightly uneven letters",
    "Times Roman": "a classic serif typeface like Times Roman: upright letters with small serifs",
    "Cochin": "an elegant old-style serif with delicate, slightly flared serifs",
    "Kennerley Old Style": "a bold old-style serif: upright, heavy letters with wedge serifs",
    "Old English": "an Old English blackletter (gothic) typeface with angular, broken strokes",
    "Block": "plain bold block letters: an upright, condensed sans-serif with no serifs",
    "Bank Gothic": "wide, squared-off sans-serif capitals (small capitals for lowercase), like Bank Gothic",
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

  // Jacket and pants both use the "Pick Stitching" step label.
  "Pick Stitching": {
    None: "NO pick stitching: the edges and seams are plain, with no visible row of small stitches",
    "Lapels & Edges": "pick stitching: a fine row of small, evenly spaced hand-look stitches in thread matching the fabric, about 0.6 cm in from the edge, running all around the lapel and collar edges and down the jacket's front edges; subtle, visible up close",
    "Lapels, Edges & Seams": "pick stitching: a fine row of small, evenly spaced hand-look stitches in thread matching the fabric, about 0.6 cm in from the edge, running all around the lapel and collar edges and down the jacket's front edges, AND alongside the main seams (shoulder, sleeve and back seams) and around the pockets; subtle, visible up close",
    "Front Pockets": "pick stitching on the trousers: a fine row of small, evenly spaced hand-look stitches in thread matching the fabric, about 0.6 cm in from the edge of each front pocket opening; subtle, visible up close",
  },

  // Where the "Front & Sleeve Buttonhole Color" thread goes (asked only when
  // it isn't matched to the fabric).
  "Which Buttonholes Get the Color": {
    "Front & Sleeves": "the front buttonholes AND every sleeve cuff buttonhole are stitched in the front & sleeve buttonhole thread color",
    "Sleeves Only": "ONLY the sleeve cuff buttonholes are stitched in the front & sleeve buttonhole thread color; the front buttonholes are stitched in thread matching the fabric",
    "Bottom Sleeve Buttonhole": "ONLY ONE buttonhole on each sleeve, the bottom one nearest the cuff edge, is stitched in the front & sleeve buttonhole thread color as a single contrast accent; every other cuff buttonhole and the front buttonholes are stitched in thread matching the fabric",
  },

  // -------------------------------------------------------------- PANTS
  "Waist Line Height": {
    Standard: "standard waistband, about 4 cm tall",
    Tall: "taller waistband, about 5 cm",
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
  },
  "Waistband Style": {
    "Normal Waistband": "a plain, straight waistband with no side adjusters",
    "Elastic Waistband On Side Buttons": "on each side of the waistband a small square fabric tab buttoned onto the waistband, with a second button beside it to let it out; no buckles",
    "Arrow Shape Belt W/ Adjustable Buckle": "no belt loops at the sides; on each side of the waistband a pointed, arrow-shaped fabric strap threaded through a small metal buckle",
    "Adjustable Waistband On Side W/ Buckle": "on each side of the waistband a short fabric side-adjuster tab closing through a small metal buckle, with a button beside it",
  },
  "Front Pleat": {
    "No Pleat": "flat-front trousers: NO pleats, only a pressed crease down each leg",
    "Single Pleat": "ONE reverse pleat on each side of the front (folding toward the side pocket), just below the waistband, flowing into the crease",
    "Double Pleat": "TWO reverse pleats on each side of the front (folding toward the side pocket), just below the waistband",
  },
  "Belt Loops": {
    "Belt Loops": "standard straight vertical belt loops around the waistband",
    "X Loops": "belt loops made of two crossed fabric strips forming an X",
    "No Belt Loop": "NO belt loops anywhere on the waistband",
  },
  "Front Pocket Style": {
    "Slant Pocket": "slanted side pockets: the opening runs diagonally from the waistband down to the side seam",
    "Besom": "front besom pockets: a near-vertical piped opening with TWO lips on each side of the front, set in from the side seam",
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
    "Welt Pocket Below Waistband": "a small welt watch pocket just below the waistband on the wearer's right front",
    "Flap Pocket With Button": "a small pointed flap watch pocket with one button, just below the waistband on the wearer's right front",
    "Pocket In Top Of Waistband": "a small watch pocket opening set into the top edge of the waistband on the wearer's right",
    "No Watch Pocket": "no watch pocket",
  },
  "Back Waist Shape": {
    "No V Open": "back waistband is one straight continuous band across the centre back seam",
    "Back Waist Seam V Shape": "the back waistband has a small V-shaped notch opening at the top of the centre back seam",
    "Back Seam W/ Straight 3/8 Top Open": "the back waistband is split at the centre back seam with a small straight gap at the top",
  },
  "Back Pocket Style": {
    "Besom With Buttons": "TWO back pockets, each a double-besom (two lips) with one button below it",
    "Besom, Left Button": "TWO double-besom back pockets; only the wearer's LEFT one has a button below it",
    "Besom, No Buttons": "TWO double-besom back pockets with NO buttons",
    "Right Besom With Button": "ONE double-besom back pocket on the wearer's RIGHT only, with a button below it; no pocket on the left",
    "Right Besom, No Button": "ONE double-besom back pocket on the wearer's RIGHT only, no button; no pocket on the left",
    "Rhombus Pocket Flap": "TWO back pockets with flaps whose lower edge comes to a shallow V point (rhombus), each with one button",
    "Peach Shape Pocket Flap": "TWO back pockets with flaps that have rounded corners and a soft point in the middle of the lower edge, each with one button",
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
      if (m && m[1] === "Button Color") {
        const b = buttonChoice(spec);
        if (b && b.matched) return line + " -- looks like: " + MATCHED_BUTTONS;
        // The hex is an average of the whole photo; the photo and the material are what count.
        if (b) return "Button Color: " + b.name + (b.material ? " (" + b.material + " button)" : "") + (buttonWords(b) ? " -- looks like: " + buttonWords(b) : "") + "; copy the button photo exactly";
      }
      const look = m && (m[1] === "Lining" && /^matched to the fabric color/i.test(m[2]) ? PLAIN_MATCH_LINING : OPTION_LOOKS[m[1]] && OPTION_LOOKS[m[1]][m[2].trim()]);
      return look ? line + " -- looks like: " + look : line;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
// What the folded-open front in the jacket-only sheet shows inside. The model
// scattered welts down the lining and put the button tab on the outside.
const INSIDE_VIEW: Record<string, string> = {
  "Regular Inner Pocket": "exactly ONE horizontal inside welt pocket at chest height, level with the outside chest pocket, running from the fabric facing into the lining; a short pen pocket welt (about 5 cm wide) a little below it; and ONE more horizontal welt pocket at waist height",
  "Fashion Inner Pocket": "exactly ONE horizontal inside welt pocket at chest height, level with the outside chest pocket, running from the fabric facing into the lining; a short pen pocket welt (about 5 cm wide) a little below it; and ONE more horizontal welt pocket at waist height",
  "Combination Inner Pocket": "exactly ONE horizontal inside welt pocket at chest height, level with the outside chest pocket, running from the fabric facing into the lining; a narrow upright pen slot high on the facing near the lapel; a small teardrop-shaped pen pocket just below the chest welt; and ONE more horizontal welt pocket at waist height",
  "No Inner Pockets": "NO inside pockets at all: the facing and lining are completely plain",
};

function layoutFor(jacketOnly: boolean, spec = ""): string {
  const insideStyle = (spec.match(/^Inside Pocket Style: (.+)$/m) || [])[1] || "";
  const inside = (OPTION_LOOKS["Inside Pocket Style"] || {})[insideStyle];
  const insideNote = insideStyle === "No Inner Pockets"
    ? " (the jacket has NO inside pockets; the lining is plain)"
    : " (the inside pockets are horizontal welt pockets sewn on the INSIDE of the jacket, in the lining and facing, never on the outer fabric" +
      (inside ? "; " + inside : "") + ")";
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const cuffStyle = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
  const lapelStyle = (spec.match(/^Lapel Style: (.+)$/m) || [])[1] || "";
  const diamond = lapelStyle === "Diamond Lapel" ? " (" + DIAMOND_SHORT + ")" : "";
  const chestPocket = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
  const chestNote = CHEST_NOT[chestPocket] ? " (chest pocket: " + CHEST_NOT[chestPocket] + ")" : "";
  const backPocket = (OPTION_LOOKS["Back Pocket Style"] || {})[(spec.match(/^Back Pocket Style: (.+)$/m) || [])[1] || ""];
  const backWaist = (OPTION_LOOKS["Back Waist Shape"] || {})[(spec.match(/^Back Waist Shape: (.+)$/m) || [])[1] || ""];
  const backNote = [backWaist, backPocket].filter(Boolean).map((t) => "; " + t).join("");
  const cuffCount = cuffCountText(spec) ? " (" + cuffCountText(spec) + ")" : "";
  const slant = (/slant/i.test(cuff) ? " (the buttonholes are SLANTED: " + SLANT_HOLES + ")" : "") +
    (/slant/i.test(cuffStyle) ? " (" + SLANT_VENT + ")" : "");
  const vents = (OPTION_LOOKS["Back Vents"] || {})[(spec.match(/^Back Vents: (.+)$/m) || [])[1] || ""];
  const ventNote = vents ? " showing the vents (" + vents + ")" : "";
  const lower = (spec.match(/^Lower Pockets: (.+)$/m) || [])[1] || "";
  const lowerLooks = (OPTION_LOOKS["Lower Pockets"] || {})[lower];
  const hipNote = (lowerLooks ? " (" + lowerLooks + ")" : "") + (/Slant/.test(lower) ? " (" + SLANT_HIP + ")" : "");
  const insideView = INSIDE_VIEW[insideStyle] || INSIDE_VIEW["Regular Inner Pocket"];
  const openNote = ". The front that stays closed shows exactly the same outside pockets as that side of the front view (its hip pocket" +
    (/Slant/.test(lower) ? ", on the same diagonal as in the front view" : "") + ", plus the ticket pocket or chest pocket if that side has one" +
    ") and nothing else: no tab, button or extra pocket on the outside. The folded-open front shows its inside: " + insideView + ". No other pockets, tabs or buttons anywhere on the lining";
  return jacketOnly
    ? `Layout: one landscape presentation sheet on a clean white background with six panels in two rows, like a tailor's lookbook.
Top row, about two thirds of the sheet's height, three equal panels side by side, each about one third of the sheet wide and each showing the WHOLE jacket from shoulders to hem at its natural, real-life proportions (a normal jacket is about three quarters as wide as it is tall, sleeves included): never squeezed narrow, stretched tall or cropped. (1) the jacket front view on an invisible ghost mannequin, buttoned${diamond}${chestNote}, with the inside of the jacket visible inside the neck opening; (2) the jacket back view${ventNote}; (3) the jacket front view with one front edge folded open to show the inside of the jacket and the inside pocket${openNote}.
Bottom row, three equal close-up panels side by side: (4) a close-up of the closed sleeve cuff, outer fabric only, showing the cuff buttons and buttonhole stitching${cuffCount}${slant}; (5) a close-up of the lapel and chest showing the lapel shape${diamond}, the lapel buttonhole, chest pocket${chestNote} and fabric texture; (6) a close-up of the lower front of the buttoned jacket showing both hip pockets${hipNote}.`
    : `Layout: one landscape presentation sheet on a clean white background with five panels, like a tailor's lookbook.
Left side, three tall panels side by side, each garment at its natural, real-life proportions (never squeezed narrow or stretched tall): (1) the full suit front view (jacket and trousers) on an invisible ghost mannequin, jacket buttoned${diamond}${chestNote}, with the inside of the jacket visible inside the neck opening; (2) the full suit back view${ventNote}. In both full suit views the trousers are ${TROUSER_LENGTH}; (3) a close-up of the BACK of the trousers, cropped from just above the waistband down to just below the seat, showing the back waistband and the centre back seam where it meets the waistband, the belt loops and the back pockets${backNote}.
Right side, two square close-up panels stacked: (4) a close-up of the closed jacket sleeve cuff, outer fabric only, showing the cuff buttons and buttonhole stitching${cuffCount}${slant}; (5) a close-up of the front of the trouser waistband, fully closed and fastened, showing how the waistband closes (its exact style is given in the rules below), the belt loops and front pocket, with the trouser hem visible below.`;
}

// How many buttons each sleeve cuff has (0 if unknown). The image model kept
// adding one (five chosen, six drawn), so the count is stated everywhere.
function cuffButtonCount(spec: string): number {
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const m = cuff.match(/\d/);
  return m ? Number(m[0]) : 0;
}
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
function cuffCountText(spec: string): string {
  const n = cuffButtonCount(spec);
  if (!n) return "";
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const what = /button ?less/i.test(cuff) ? "stitched buttonholes (no buttons)" : "buttons";
  const count = Array.from({ length: n }, (_, i) => i + 1).join(", ");
  return "EXACTLY " + n + " (" + NUMBER_WORDS[n].toUpperCase() + ") cuff " + what + " on EACH sleeve, counted from the bottom: " + count + ". Never " + (n + 1) + ", never " + (n - 1) + "; count them before finishing";
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

// What each lapel must NOT look like. Notch is here too: with nothing said,
// the model drew double-breasted jackets with peak lapels.
const LAPEL_NOT: Record<string, string> = {
  "Notch Lapel": "It is NOT a peak lapel: the lapel tip does NOT point up toward the shoulder and has NO sharp upward point; a clear open V-shaped gap separates the collar from the lapel. This holds even on a double-breasted jacket, which here has NOTCH lapels, not the peak lapels double-breasted suits often have.",
  "Peak Lapel": "It is NOT a notch lapel: the lapel points sharply UP toward the shoulder.",
  "Semi-Notch Lapel": "It is NOT a peak lapel: the lapel tip does NOT point up; a small V-shaped notch separates the collar from the lapel.",
  "Semi-Peak Lapel": "It is NOT a full peak lapel: the point rises only slightly and does NOT reach up toward the collar or shoulder. It is NOT a notch lapel: the tip angles a little upward, not down.",
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

// Trousers came out far too long in the full suit views (endless legs under a
// short jacket). Real suit trousers below the jacket hem are a little SHORTER
// than the jacket itself, collar to hem.
const TROUSER_LENGTH =
  "a normal, real-life suit-trouser length: the legs below the jacket hem are slightly SHORTER than the jacket itself measured from collar to hem (about 4/5 of it), and the hems end at the ankle where the top of a shoe would be, with at most a slight break. Never stretch the legs to fill a tall panel: keep the whole suit at real human proportions and leave white space above and below it instead";

// The image model drew a besom chest pocket as a stack of piped lines above a
// second, separate welt slit. There is only ever one chest pocket.
const BESOM_CHEST_NOT =
  "There is exactly ONE chest pocket opening on the jacket: never stack a second slit, welt or pocket above or below it, and draw no extra stitched lines around it";

// The chest pocket kept coming out as the wrong type (a single besom drawn
// as a raised welt, etc.), so every option says what it must NOT look like,
// and a close-up crop of its catalog drawing is sent as a reference.
const CHEST_NOT: Record<string, string> = {
  "Normal Pocket": "It is a WELT pocket: a flat rectangular strip of the suit fabric about 2.5 cm tall with straight parallel top and bottom edges, stitched down at both short ends. It is NOT a thin besom slit, NOT a curved boat-shaped welt, NOT a patch pocket and has NO flap",
  "Boat Shape Pocket": "It is a WELT pocket about 2.5 cm tall whose bottom edge CURVES gently down in the middle like a boat hull (the top edge is straight). It is NOT a straight rectangular welt, NOT a thin besom slit, NOT a patch pocket and has NO flap",
  "Besom Pocket": "It is NOT a welt pocket: there is NO raised rectangular strip or box of fabric. The whole pocket reads as one thin slit edged by TWO slim piped lips (one above and one below the opening, touching), under 1 cm tall in total. It is NOT a patch pocket and has NO flap",
  "Patch Pocket No Flap": "It is a PATCH pocket: a separate piece of the suit fabric sewn ON TOP of the chest, about 11 cm wide and 12 cm tall, open along its straight top edge, with ROUNDED bottom corners and visible edge stitching. It is NOT a welt or besom pocket and has NO flap",
  "No Pocket": "There is NO chest pocket of any kind: no welt, no slit, no patch, no pocket square; the left chest is plain fabric",
};
const CHEST_REF: Record<string, string> = {
  "Normal Pocket": "./assets/jacket-chestref-normal.jpg",
  "Boat Shape Pocket": "./assets/jacket-chestref-boatshape.jpg",
  "Besom Pocket": "./assets/jacket-chestref-doublebesom.jpg",
  "Patch Pocket No Flap": "./assets/jacket-chestref-patchnoflap.jpg",
};

// Flat welt hip pockets kept coming out as flap pockets.
const WELT_NOT_FLAP =
  "single WELT pockets, NOT flap pockets and NOT besom slits: on each hip a clearly visible rectangular welt strip of the suit fabric, about 2 cm tall and 15 cm wide, stands UP from the pocket opening (the opening is along its top edge) and is stitched down flat at both short ends, exactly like a classic suit breast welt pocket only lower; nothing hangs down over the opening, there is no flap and no shadow under a flap, and it is never a thin slit edged by piped lips";
// The Flat Welt hip pockets were described as "like the chest pocket", so on a
// jacket with a besom chest pocket the model drew besom hip pockets too.
function weltHipNote(spec: string): string {
  const chest = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
  return /Normal Pocket|Boat Shape/.test(chest) ? "" :
    " This jacket's chest pocket is a different style (" + (chest || "none") + "); do NOT copy it for the hip pockets: the hip pockets have the raised welt strip, the chest pocket does not";
}

// Slanted hip pockets came out level (straight flaps) even with the old
// "end nearest the front buttons higher" wording and a 17 degree reference,
// so the slant is now described as it looks in the picture ('/' and '\\').
// The reference is always the website's own graphic (Daniel's rule), cropped
// to the hip pockets and enlarged: assets/jacket-hipref-*, made by
// scripts/hipref_crop.py from assets/jacket-lowerpocket-new-*.
const SLANT_HIP =
  "the hip pockets are cut on a clear DIAGONAL, never level: in the front view the pocket on the LEFT of the picture rises from left to right (like '/') and the pocket on the RIGHT of the picture falls from left to right (like '\\'), so each pocket's end nearest the front buttons is clearly HIGHER than its end at the side seam and the two pockets lean in toward the buttons like the two sides of a wide upside-down V. Each opening (and its flap, if it has one) is tilted about 20 degrees, a slant obvious at a glance, like hacking pockets";
// The ticket pocket: which side, how big and what kind, from the option name.
function ticketText(lower: string): string {
  if (!/Ticket/.test(lower)) return "";
  const kind = /Flap Ticket/.test(lower)
    ? "a smaller flap pocket with its own flap, a two-thirds-size copy of the hip pocket"
    : /Besom Ticket/.test(lower)
    ? "a double-besom slit (TWO thin piped lips, touching) with no flap"
    : "a single-besom slit (ONE thin piped lip) with no flap";
  return "there is exactly ONE ticket pocket, on the wearer's RIGHT side only (the LEFT side of the picture), about 4 cm directly above that hip pocket, about two thirds as wide as it, with its outer end lined up over the hip pocket's outer end" +
    (/Slant/.test(lower) ? " and tilted at the same slant, parallel to it" : "") +
    ". The ticket pocket is " + kind + (/Patch/.test(lower) ? " (it is NOT a patch pocket)" : "") +
    ". The wearer's left side has only its hip pocket, no ticket pocket";
}
const HIP_REF: Record<string, string> = {
  "Besom Slant Pocket": "./assets/jacket-hipref-dbslant.jpg",
  "Slant Flap Pocket": "./assets/jacket-hipref-slantflap.jpg",
  "Slant Flap + Besom Ticket": "./assets/jacket-hipref-slantflapdbt.jpg",
  "Slant Flap + Flap Ticket Pocket": "./assets/jacket-hipref-slantflapft.jpg",
  "Besom + Besom Ticket": "./assets/jacket-hipref-dbdbt.jpg",
  "Flap Pockets + Besom Ticket": "./assets/jacket-hipref-dbwflapdbt.jpg",
  "Flap Pockets + Flap Ticket Pocket": "./assets/jacket-hipref-flapft.jpg",
  "Patch Pocket + Besom Ticket": "./assets/jacket-hipref-patchdbt.jpg",
  "High-Back Patch + Besom Ticket": "./assets/jacket-hipref-patchhighbackdbt.jpg",
};

// "Match Suit Fabric" lining: the spec says "Lining: matched to the fabric
// color (approx. color #...)" and no lining swatch is sent, so the model
// invented paisley or jacquard linings. Daniel wants a plain solid lining.
function liningMatchesFabric(spec: string): boolean {
  return !/^Facing Style: No Lining/m.test(spec) && /^Lining: (matched to the fabric color|Match Fabric)/im.test(spec);
}
const PLAIN_MATCH_LINING = "a PLAIN, SOLID-COLOR lining in one single color matching the suit fabric's color (the same shade or a slightly lighter or darker tone of it), smooth and slightly lustrous like satin/bemberg; absolutely NO pattern, print, paisley, jacquard, stripes, dots, texture motif or design of any kind on it";

// Buttons. The spec line is "Button Color: <name> (<material> button,
// approx. color #...)" and the button photo is sent as the "button" swatch.
// With only a one-line "match the swatch" note the model drew generic flat
// plastic buttons (a mother-of-pearl shell button came out matte gray), and
// the averaged hex (photo highlights and shadows mixed) pulled the color off.
// So the material is described in words, the photo is called out as the
// exact button, and every button on the suit must be that same button.
//
// Every button in the shop, described in words from its photo
// (assets/button-photo-<code>.jpg), keyed by the customer-facing name used in
// the "Button Color:" spec line. The averaged hex in that line is often off
// (Rust-Flecked Navy averages to brown and was drawn as plain brown buttons),
// so the base color, any flecks or streaks, the finish, the rim and anything
// unusual (embossing, odd holes) are spelled out here, next to the photo.
// When a button is added or renamed in catalog.js, add or rename it here too.
const BUTTON_LOOKS: Record<string, string> = {
  // Black
  "Matte Coal": "solid charcoal-black with a flat MATTE face, no streaks and no raised rim", // KG221
  "Feathered Onyx": "glossy black with ONE feathery off-white and amber-brown streak fanning out from the center toward the lower edge; the rest is plain black; raised rim", // KSZ424
  "Horn Ebony": "glossy black horn with dark reddish-brown tortoiseshell mottling around the rim and a dished black center; raised rim", // KNJ033
  "Satin Jet": "satin jet black with a wide raised rim and a single thin white hairline crack-like streak across the lower face", // KNJ013
  "Dark Horn Onyx": "black with a smoky, translucent gray-brown mottled center inside a raised glossy black rim", // KSZ260
  "Misted Jet": "glossy black with a cloudy gray-green misty haze across one side of the face; no raised rim", // KSZ263
  "Polished Jet": "solid jet black, satin finish, with a wide flat raised rim around a recessed center; no streaks", // KNJ075
  "Smoky Raven": "solid jet black, flat satin face, no rim and no streaks", // KNJ076
  "Glossy Ebony": "solid black with a smooth, plain satin face, no raised rim, no streaks and NO visible holes on the face (a shank button)", // KNJ077
  "Classic Jet": "solid jet black, satin finish, with a slim raised rim; no streaks", // KNJ078
  "Refined Ebony": "very dark brown-black horn with faint reddish-brown tortoiseshell mottling near one edge, satin finish, slim rim; TWO holes", // KNJ068
  "Marbled Jet": "near-solid jet black, satin finish, with a flat raised rim", // KNJ072
  "Polished Raven": "black horn with a band of fine silvery-gray speckled streaks across the lower left of the face, satin finish", // KNJ080
  "Marbled Raven": "glossy black with a raised rim and a faint pale streak; reads as solid black", // KNJ084
  "Rich Coal": "high-gloss jet black with a thick raised rim and a deep dished center", // KG224
  "Classic Onyx": "high-gloss jet black with a thick, rounded raised rim and a deep dished center", // KG238
  "Refined Coal": "solid black with a flat MATTE face and no raised rim", // KG244
  "Antique Ebony": "solid black with a flat MATTE face and no raised rim", // KG226
  "Rich Jet": "glossy black with faint gray horn-like streaks near the edge; no raised rim", // KSZ428
  "Marbled Onyx": "black center inside a smoky, translucent gray raised rim", // KSZ431
  "Rich Raven": "glossy black with ONE feathery white-gray streak across the center; raised rim", // KSZ423
  "Glossy Jet": "brownish-black with smoky taupe-gray marbling in the center; raised rim", // KSZ433
  "Glossy Onyx": "high-gloss solid black with a wide raised rim; no streaks", // KNJ030
  "Glossy Coal": "glossy black with a deep CRIMSON-RED swirl inside the face; raised black rim", // KNJ023
  "Rich Onyx": "glossy black with a deep NAVY-BLUE swirl near the center; raised black rim", // KNJ024
  "Antique Onyx": "glossy black with an embossed snakeskin / net texture of fine raised lines across the face", // KNJ036
  "Smoky Coal": "matte black with a wide flat raised rim around a dished center", // KNJ011
  "Classic Coal": "high-gloss black with a faint blue-black sheen; raised rim", // KG197
  "Antique Coal": "glossy very dark olive-brown-black with fine wavy wood-grain ring lines across the face; raised rim", // KG199
  "Refined Jet": "glossy black with a small amber-orange streak near the lower left edge and FOUR DIAMOND-SHAPED (square, turned 45 degrees) holes; raised rim", // KSZ199
  // Navy
  "Streaked Midnight Navy": "deep midnight navy, almost black, with feathery lighter blue streaks around the holes; glossy, raised rim", // KSZ425
  "Textured Navy": "deep navy shell button: a finely knurled crosshatch-textured navy center inside a glossy, iridescent blue-green pearly rim", // KB021
  "Rust-Flecked Navy": "a deep NAVY BLUE button (very dark, almost black navy; its main color is navy, NOT brown) with a smooth satin face, no raised rim, and ONE soft, cloudy RUST-ORANGE / COPPER fleck patch on one side of the face beside the holes; the rest of the face is plain dark navy", // KG206
  "Deep Navy": "solid deep navy blue, satin finish, with a wide flat face and a small recessed center; no streaks", // KG191
  "Marbled Dusk Navy": "solid medium-deep navy blue with a satin finish and a slim raised rim; no streaks", // KSZ439
  "Classic Midnight Navy": "glossy navy blue with lighter blue-gray cloudy marbled swirls across the face; no raised rim", // KSZ262
  // Gray
  "Marbled Charcoal Gray": "charcoal-gray horn with lighter gray streaks across the face; raised rim", // KNJ070
  "Glossy Dove Gray": "dark gray-green iridescent mother-of-pearl face inside a thin black rim edge", // KB285
  "Refined Steel Gray": "silver-gray iridescent mother-of-pearl with a wide raised rim", // KB289
  "Rich Dove Gray": "dark smoky gray-brown with soft marbling; raised rim", // KG239
  "Marbled Dove Gray": "soft blue-gray with a misty lighter gray cloud through the center; satin, no raised rim", // KSZ455
  "Polished Charcoal Gray": "dark charcoal gray, glossy, with a raised rim and large dark holes", // KSZ448
  "Refined Smoke Gray": "dark smoky gray-black with a satin finish and a slim raised rim", // KNJ052
  "Antique Dove Gray": "dark gray mother-of-pearl with wavy silvery-white rippled bands across the face", // KB111
  "Smoky Dove Gray": "smoky gray mother-of-pearl with wavy silvery rippled bands and a soft sheen", // KB1112
  "Antique Slate Gray": "slate-gray mother-of-pearl with a lustrous, wavy pearly sheen in soft gray and lavender tones", // KB151
  "Rich Slate Gray": "dark slate mother-of-pearl, smoky gray-green with an iridescent sheen and a darker raised rim", // KB026
  "Smoky Slate Gray": "silvery gray mother-of-pearl center inside a wide pale lavender-gray raised rim; the center holes are DIAMOND-shaped", // KB027
  "Classic Smoke Gray": "dark smoky iridescent mother-of-pearl center inside a lighter silver-gray raised rim", // KB011
  "Classic Charcoal Gray": "pale silver-gray iridescent mother-of-pearl with a wide raised rim", // KB029
  "Glossy Smoke Gray": "pale silver-gray mother-of-pearl center inside a thin dark blue-gray rim edge", // KB030
  "Anchor Slate Gray": "slate blue-gray with an EMBOSSED ANCHOR motif across the face (the holes sit in the anchor's middle) and wavy grain lines; satin", // KG109
  "Refined Charcoal Gray": "glossy black-and-white smoky marbled horn look: dark charcoal with a lighter gray swirl, inside a raised rim", // KSZ257
  "Rich Smoke Gray": "medium gray with a rough, stone-like brushed texture and fine white speckles; no raised rim", // KSZ298
  "Smoky Charcoal Gray": "dark charcoal gray covered in fine white speckles like granite; no raised rim", // KSZ299
  "Smoky Pearl Gray": "smoky iridescent mother-of-pearl center inside a wide brown-gray rim", // KB272
  "Black-Rim Pearl Gray": "iridescent gray-green mother-of-pearl center inside a wide BLACK rim", // KB273
  "Silver Pearl Gray": "silvery iridescent mother-of-pearl center inside a wide darker smoky-gray rim", // KB274
  "Soft Dove Gray": "soft mid gray with faint wavy lighter grain swirls; satin, no raised rim", // KG241
  "Pale Silver Gray": "very pale silver-white gray, smooth satin, almost white; no streaks", // KSZ435
  "Smoky Shell Gray": "smoky gray-brown mother-of-pearl with a soft sheen and a raised rim", // KB001
  "Scalloped Gray": "dark green-gray iridescent mother-of-pearl center ringed by a carved SCALLOPED border of small notches around the rim", // KB023
  "Silver Shell Gray": "pale silvery-white iridescent mother-of-pearl with a raised rim", // KB279
  "Abalone Gray": "silver-gray abalone shell with wavy rippled pearly bands and hints of pink and violet iridescence", // KB115
  // Blue, Purple, Green
  "Marbled Powder Blue": "pale powder-blue / silver-blue mother-of-pearl with a soft pearly sheen and a raised rim", // KB280
  "Classic Sky Blue": "pale sky-blue and silver abalone-like mother-of-pearl with wavy rippled bands", // KB114
  "Pearl Mauve Purple": "iridescent mauve-pink-purple mother-of-pearl center inside a thin dark rim", // KB286
  "Deep Plum Purple": "glossy deep plum / aubergine purple with a pearly sheen and a raised rim", // KB016
  "Olive Green": "glossy dark OLIVE GREEN (khaki-olive, not brown) with fine wavy wood-grain ring lines across the face", // KG198
  "Deep Teal Green": "solid deep teal / petrol green with a smooth matte-satin face and no raised rim", // KG243
  // Brown
  "Smoky Mocha Brown": "dark smoky mocha-brown mother-of-pearl with a soft sheen and a raised rim", // KB277
  "Dark Espresso Brown": "solid dark espresso brown with a satin finish and a wide raised rim", // KB288
  "Streaked Horn Brown": "dark brown horn look with bold cream and black streaks fanning across the face", // KSZ429
  "Deep Cocoa Brown": "deep cocoa brown with a subtle darker streak and a thin coppery raised rim", // KSZ430
  "Smoky Bark Brown": "dark smoky bark-brown with lighter tan clouding, inside a thin olive-bronze rim", // KSZ432
  "Mottled Chocolate Brown": "dark chocolate brown mottled with lighter tortoiseshell-brown clouding; no raised rim", // KSZ426
  "Muted Taupe Brown": "muted dark taupe-brown, satin, with a wide raised rim", // KSZ436
  "Matte Mocha Brown": "solid matte mocha / plum-brown with a wide flat raised rim", // KSZ440
  "Dark Horn Brown": "very dark brown-black horn with a band of bright golden-brown streaks through the middle", // KNJ069
  "Streaked Mahogany Brown": "dark mahogany-brown horn with a glossy golden-brown streak running across the middle; TWO holes", // KNJ079
  "Glossy Mahogany Brown": "glossy dark mahogany brown with a raised rim and dished center", // KG240
  "Swirled Chocolate Brown": "glossy dark chocolate brown and black with a bright amber-brown wood-grain swirl near the center", // KSZ421
  "Glossy Chestnut": "warm light chestnut / caramel brown with soft grain and a raised rim", // KB287
  "Polished Walnut": "glossy polished walnut brown mother-of-pearl with a lustrous sheen and a raised rim", // KB278
  "Refined Walnut": "warm rust-orange to light terracotta brown with paler edges; satin, raised rim", // KG214
  "Rich Chestnut": "glossy rich reddish chestnut brown with fine wood-grain swirls", // KG245
  "Classic Chestnut": "dark reddish chestnut brown, deeper in the dished center, with a raised rim", // KG237
  "Marbled Walnut": "dark walnut brown with fine wood-grain ring lines; satin", // KG222
  "Marbled Umber": "warm burnt-orange umber with a raised rim and soft lighter rings", // KSZ434
  "Smoky Umber": "dark umber brown with lighter golden-brown clouding through the center", // KSZ427
  "Refined Cocoa": "dark cocoa brown with lighter tan and black marbled clouding; raised rim", // KSZ442
  "Antique Espresso": "glossy reddish-brown mother-of-pearl with a lustrous sheen and a lighter pinkish raised rim", // KB008
  "Burnt Sienna Brown": "glossy burnt-sienna reddish brown with a raised rim", // KG225
  "Glossy Russet Brown": "dark russet brown with darker clouding around the edge; glossy", // KB152
  // Tortoiseshell
  "Black Tortoise": "glossy black with dark reddish-brown tortoiseshell patches around the rim", // KNJ031
  "Mottled Tortoise": "black with bold cream-and-tan tortoiseshell patches on the lower part of the face", // KNJ074
  "Blonde Tortoise": "blonde tortoiseshell: pale cream / translucent with bold black and dark brown patches", // KNJ039
  "Classic Tortoise": "classic tortoiseshell: honey-amber and cream with dark brown mottling across the face", // KSZ255
  "Light Tortoise": "light tortoiseshell: cream and pale tan with dark brown mottled patches on one side", // KSZ259
  "Smoky Horn Tortoise": "pale translucent gray-cream horn with bold dark brown-black streaks on one side; TWO small square holes, one above the other", // KSZ198
  "Clear Tortoise": "clear translucent tortoiseshell: see-through pale gray with dark brown-gray speckled spots", // KSZ276
  "Rich Tortoise": "rich tortoiseshell: amber-brown with black and dark brown mottling, darker around the edge", // KSZ258
  "Golden Horn": "golden-honey horn, light caramel with soft cream streaks; satin", // KSZ197
  "Glossy Amber": "glossy translucent amber-orange with darker brown streaks", // KNJ053
  "Classic Honey": "glossy deep honey-orange to rust horn with wavy darker streaks", // KNJ012
  "Marbled Toffee": "glossy toffee-orange horn marbled with lighter amber and cream", // KNJ014
  // Red, Tan
  "Classic Scarlet Red": "deep scarlet / crimson red with a satin sheen and a darker maroon dished center around the holes", // KG192
  "Classic Wheat Tan": "pale wheat / light peach-tan with fine wavy grain lines; satin, no raised rim", // KG220
  "Marbled Beige Tan": "flat greige / taupe-beige with a wide lighter raised rim; matte", // KSZ438
  "Marbled Fawn Tan": "glossy cream and fawn with a bold tan-brown marbled swirl on one side", // KSZ422
  "Smoky Fawn Tan": "pale greige-fawn outer face with a contrasting DARK BROWN center disc around the holes", // KG190
  "Anchor Copper Tan": "warm copper-tan with an EMBOSSED ANCHOR motif across the face (the holes sit in the anchor's middle) and fine grain lines", // KG108
  "Smoky Camel Tan": "pale cream / off-white with a soft camel-brown smoky streak on one side; satin", // KSZ297
  "Rich Sand Tan": "translucent amber-sand with flecks and speckles of brown and gold suspended in it", // KSZ277
  "Wavy Camel Tan": "camel brown with bold wavy cream wood-grain lines across the face", // KG242
  // Cream, Pink, White
  "Ivory Horn Cream": "plain bright ivory / off-white, smooth satin, no streaks", // KNG010
  "Pearl Cream": "creamy white mother-of-pearl with a soft pearly sheen and a raised rim", // KB002
  "Soft Bone Cream": "soft bone / ivory cream with faint peach clouding; satin", // KSZ196
  "Polished Ivory Cream": "polished ivory-white with a soft warm-beige shading toward one edge; satin", // KSZ261
  "Smoky Bone Cream": "pale bone cream with a faint warm haze; satin, smooth", // KSZ256
  "Natural Horn Cream": "natural pale yellow-beige horn, matte, smooth and even", // KNJ071
  "Mother of Pearl Cream": "creamy white mother-of-pearl with an iridescent pearly sheen", // KB150
  "Marbled Rose Pink": "blush-pink and peach mother-of-pearl with a pearly sheen and a raised rim", // KB028
  "Pure Pearl White": "bright white mother-of-pearl with a soft sheen and a raised rim", // KB275
  "Speckled Chalk White": "chalky off-white / light gray with fine darker speckles inside a raised rim", // KSZ443
  "Clear Pearl White": "white mother-of-pearl with a rainbow iridescent sheen and a raised rim", // KB010
  "Marbled Frost White": "frosted white and pale gray with soft cloudy gray marbling; satin", // KSZ454
  "Textured Pearl White": "white mother-of-pearl with a finely knurled crosshatch-textured center and a smooth pearly rim", // KB020
  "Marbled Pearl White": "milky white mother-of-pearl with a soft pearly sheen and a raised rim", // KB276
  "Classic Snow White": "snow-white iridescent mother-of-pearl with a carved scalloped / notched border around the rim", // KB022
  "Rippled Pearl White": "white mother-of-pearl with wavy rippled iridescent bands and DARK, almost black thread holes that stand out", // KB113
  // Multi-Color
  "Abalone Multi-Color": "abalone shell: dark smoky gray with bright golden-bronze and orange iridescent rippled bands", // KB116
  "Teal & Tan Multi-Color": "two-tone: deep teal-navy blue with concentric rings, fading to a warm tan-brown along the top edge", // KG223
  "Cream & Red Multi-Color": "cream / ivory face inside a contrasting thin RED-burgundy rim", // KG195
  "Cream & Navy Multi-Color": "cream / ivory face inside a contrasting NAVY-blue and brown rim", // KG196
};

const BUTTON_MATERIAL_LOOKS: Record<string, string> = {
  "Horn": "a real HORN button: natural horn, slightly translucent, with organic streaks and mottling in lighter and darker tones of its color, a polished satin sheen, and the rim and holes shown in the photo",
  "Shell": "a real mother-of-pearl SHELL button: an iridescent, pearly, glossy surface with soft rainbow sheen and wavy layered streaks that catch the light, and the rim and holes shown in the photo; never flat, matte or plastic-looking",
  "Corozo": "a COROZO (tagua nut) button: dense and smooth with a satin finish; any grain rings, streaks or flecks only exactly as the photo shows them, with the rim and holes shown in the photo",
  "Classic": "a classic polyester suit button: smooth, softly glossy, with the exact color and any marbling or streaks shown in the photo, and the rim and holes shown in the photo",
};
function buttonChoice(spec: string): { name: string; material: string; look: string; matched: boolean } | null {
  const v = (spec.match(/^Button Color: (.+)$/m) || [])[1] || "";
  if (!v) return null;
  if (/^(matched to the fabric color|Best Match)/i.test(v)) return { name: v, material: "", look: "", matched: true };
  const material = (v.match(/\((\w+) button\b/) || [])[1] || "";
  const name = v.replace(/\s*\(.*$/, "").trim();
  return { name, material: BUTTON_MATERIAL_LOOKS[material] ? material : "", look: BUTTON_LOOKS[name] || "", matched: false };
}
// The button in words: its own look first (color, flecks, rim), then the material.
function buttonWords(b: { material: string; look: string }): string {
  return [b.look, b.material ? BUTTON_MATERIAL_LOOKS[b.material] : ""].filter(Boolean).join("; ");
}
const MATCHED_BUTTONS = "plain four-hole suit buttons in a matte-to-satin tone matching the suit fabric's color (the same shade or slightly darker), all identical; no contrast color, no marbling, no metal";
// Where buttons show: the jacket front and cuffs, and on suits also the
// trouser waistband tab and back pockets (the trousers have no button choice of their own).
function buttonText(spec: string, photo: boolean): string {
  const b = buttonChoice(spec);
  if (!b) return "";
  const where = "EVERY button on the jacket front and sleeve cuffs" + (/^Suit type: Full suit/m.test(spec) ? " and on the trousers (waistband tab, back pockets)" : "");
  if (b.matched) return where + ": " + MATCHED_BUTTONS;
  return where + " is the customer's chosen button \"" + b.name + "\"" +
    (buttonWords(b) ? ": " + buttonWords(b) : "") +
    (photo ? ". Copy it EXACTLY from the button photo among the reference images: the same color, material, sheen, pattern/streaks, rim and holes" : "") +
    ". All buttons are identical copies of it (only the size differs: front buttons larger, cuff buttons smaller); never generic plain plastic buttons, never metal, gold, brass or crested buttons, and never a different color on the front than on the cuffs. Keep its own number and shape of holes even where a sewing note says four-hole buttons";
}

function keyDetails(spec: string, ownLining = false, buttonPhoto = false): string {
  const out: string[] = [];
  // First: the image model kept drawing level hip pockets when this came later.
  const lower = (spec.match(/^Lower Pockets: (.+)$/m) || [])[1] || "";
  if (/Slant/.test(lower)) out.push("- HIP POCKETS (" + lower + "): " + SLANT_HIP + ".");
  if (ticketText(lower)) out.push("- TICKET POCKET: " + ticketText(lower) + ".");
  const lapelStyle = (spec.match(/^Lapel Style: (.+)$/m) || [])[1] || "";
  const lapel = (OPTION_LOOKS["Lapel Style"] || {})[lapelStyle];
  if (lapel) {
    const width = (spec.match(/^Lapel Width: (.+)$/m) || [])[1] || "";
    const widthLook = (OPTION_LOOKS["Lapel Width"] || {})[width];
    out.push("- LAPEL: " + lapel + ". " + (LAPEL_NOT[lapelStyle] || "") + (widthLook ? " Lapel width: " + widthLook + "." : "") +
      (lapelStyle === "Diamond Lapel" ? " Draw both lapels in this exact shape in the front view and in every close-up that shows them." : ""));
  }
  if (cuffCountText(spec)) out.push("- CUFF BUTTON COUNT: " + cuffCountText(spec) + ".");
  if (/slant/i.test((spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "")) {
    out.push("- CUFF BUTTONHOLES: SLANTED, " + SLANT_HOLES + ".");
  }
  if (/slant/i.test((spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "")) {
    out.push("- CUFF BUTTONS: " + SLANT_VENT + ".");
  }
  if (!/^Suit type: Jacket only/m.test(spec)) {
    out.push("- TROUSER LENGTH: " + TROUSER_LENGTH + ".");
  }
  if (/^Front Button: Double Breasted/im.test(spec)) {
    out.push("- JACKET LENGTH: the double-breasted jacket is " + JACKET_LENGTH + ".");
  }
  const chest = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
  if (CHEST_NOT[chest]) {
    out.push("- CHEST POCKET (" + chest + "): " + OPTION_LOOKS["Chest Pocket"][chest] + ". " + CHEST_NOT[chest] + "." + (chest === "No Pocket" ? "" : " " + BESOM_CHEST_NOT + "."));
  }
  if (/^Lower Pockets: Flat Welt Pocket$/m.test(spec)) {
    out.push("- HIP POCKETS: " + WELT_NOT_FLAP + "." + weltHipNote(spec) + (weltHipNote(spec) ? "." : ""));
  }
  out.push(...monogramRules(spec));
  if (buttonText(spec, buttonPhoto)) out.push("- BUTTONS: " + buttonText(spec, buttonPhoto) + ".");
  if (ownLining) {
    out.push("- LINING: the customer's own lining fabric from their uploaded photo (see the reference images), with its exact colors and pattern; NOT matched to the suit fabric.");
  } else if (liningMatchesFabric(spec)) {
    out.push("- LINING: " + PLAIN_MATCH_LINING + ".");
  }
  return out.length ? "KEY DETAILS THAT MUST BE VISIBLE (the customer chose these specifically; do not draw the common default instead):\n" + out.join("\n") : "";
}

// One line of a section (JACKET or PANTS) of the spec.
function sectionValue(spec: string, section: string, label: string): string {
  let cur = "";
  for (const line of spec.split("\n")) {
    const t = line.trim();
    if (t === "JACKET" || t === "PANTS" || t === "REFERENCE SWATCHES") cur = t;
    else if (cur === section && t.startsWith(label + ": ")) return t.slice(label.length + 2).trim();
  }
  return "";
}

// Where each monogram placement shows on the sheet (see layoutFor); the
// others (under the collar, inside the waistband) are hidden in every panel.
const MONO_PANELS: Record<string, { jacketOnly?: string; suit?: string }> = {
  "Left Inside Pocket": { jacketOnly: "panel 3 (fold open the wearer's LEFT front): on the lining just above the left inside pocket" },
  "Right Inside Pocket": { jacketOnly: "panel 3 (fold open the wearer's RIGHT front): on the lining just above the right inside pocket" },
  "Inside Pocket Satin Tape": { jacketOnly: "panel 3 (fold open the wearer's LEFT front): on a small satin name label sewn just above the left inside pocket" },
  "Left Back Pocket": { suit: "panel 3 (the trouser back close-up): just above the wearer's left back pocket" },
};

// The customer's monogram: the letters they typed, in their font and thread.
function monogramRules(spec: string): string[] {
  const jacketOnly = /^Suit type: Jacket only/m.test(spec);
  const out: string[] = [];
  for (const section of ["JACKET", "PANTS"]) {
    const text = sectionValue(spec, section, "Monogram Text");
    const place = sectionValue(spec, section, "Monogram Placement");
    if (!text || !place || /^No Monogram/i.test(place)) continue;
    const spot = MONO_PANELS[place] && MONO_PANELS[place][jacketOnly ? "jacketOnly" : "suit"];
    if (!spot) continue; // hidden in every panel
    const font = sectionValue(spec, section, "Monogram Font");
    const fontLook = (OPTION_LOOKS["Monogram Font"] || {})[font];
    const thread = sectionValue(spec, section, "Monogram Thread Color");
    const lines = text.split("/").map((x) => x.trim()).filter(Boolean);
    out.push(
      "- MONOGRAM (" + section.toLowerCase() + "): embroider exactly the letters \"" + lines.join(" ") + "\"" +
        (lines.length > 1 ? " on " + lines.length + " lines (\"" + lines.join("\" / \"") + "\")" : "") +
        ", spelled letter for letter with the same capitals and lowercase, in " + (fontLook || "the " + (font || "chosen") + " font") +
        ", stitched in " + (thread ? thread + " thread" : "the monogram thread color") + ", small (about 4 cm wide), in " + spot +
        ". It is the only lettering on the sheet and appears nowhere else.",
    );
  }
  return out;
}

// Always added to the end of the final image prompt, whoever wrote the rest,
// to correct mistakes the image model tends to make.
function fixedRules(spec: string, buttonPhoto = false): string {
  const rules = ["Strict accuracy rules:"];
  if (buttonText(spec, buttonPhoto)) rules.push("- Buttons: " + buttonText(spec, buttonPhoto) + ".");
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
      "- Trouser length, in both full suit views: " + TROUSER_LENGTH + ".",
    );
    rules.push(
      "- The trousers are shown fully CLOSED in every panel: fly zipped and hidden under its fly shield, waistband fastened. Never show an open fly, a visible zipper, or the inside of the waistband.",
    );
    const backPocket = (spec.match(/^Back Pocket Style: (.+)$/m) || [])[1] || "";
    const backLook = (OPTION_LOOKS["Back Pocket Style"] || {})[backPocket];
    if (backLook) {
      rules.push("- Trouser back pockets, clearly visible in the trousers back close-up: " + backLook + ".");
    }
    const backWaistLook = (OPTION_LOOKS["Back Waist Shape"] || {})[(spec.match(/^Back Waist Shape: (.+)$/m) || [])[1] || ""];
    if (backWaistLook) {
      rules.push("- Back of the waistband, clearly visible in the trousers back close-up: " + backWaistLook + ".");
    }
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
          " Show this clearly in the full-suit front and the waistband close-up.",
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
  if (CHEST_NOT[chestPocket]) {
    rules.push("- MOST IMPORTANT: chest pocket, the same in every view and close-up: " + OPTION_LOOKS["Chest Pocket"][chestPocket] + ". " + CHEST_NOT[chestPocket] + "." + (chestPocket === "No Pocket" ? "" : " " + BESOM_CHEST_NOT + "."));
  }
  if (/^Lower Pockets: Flat Welt Pocket$/m.test(spec)) {
    rules.push(
      "- MOST IMPORTANT: the hip pockets are WELT pockets like a classic suit breast welt pocket, just lower: a clearly visible flat rectangular fabric welt strip, about 2 cm tall, over each opening, in the front view and every close-up. They have NO flaps and are NOT besom (thin piped slit) pockets." + weltHipNote(spec) + (weltHipNote(spec) ? "." : ""),
    );
  }
  const lower = (spec.match(/^Lower Pockets: (.+)$/m) || [])[1] || "";
  if (/Slant/.test(lower)) {
    rules.push("- MOST IMPORTANT: " + SLANT_HIP + ". Draw them on this diagonal in the front view, the open-jacket view and the hip pocket close-up; level, horizontal hip pockets are wrong.");
  }
  if (ticketText(lower)) {
    rules.push("- Ticket pocket, in every view that shows that side: " + ticketText(lower) + ".");
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
        (/two|three|four|4|double/i.test(lapelHoles)
          ? "Multiple buttonholes on one lapel are stacked tightly in a neat column directly below one another, only about 1 cm apart (centre to centre), all the same length and perfectly parallel, the column following the outer edge of the lapel; never spread out down the lapel. "
          : "") +
        "Stitch them in the lapel buttonhole thread color.",
    );
  }
  const holePlace = (spec.match(/^Which Buttonholes Get the Color: (.+)$/m) || [])[1] || "";
  if (holePlace && holePlace !== "Front & Sleeves" && OPTION_LOOKS["Which Buttonholes Get the Color"][holePlace]) {
    rules.push("- MOST IMPORTANT, contrast buttonhole thread on both sleeves and in the cuff close-up: " + OPTION_LOOKS["Which Buttonholes Get the Color"][holePlace] + ".");
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
    rules.push("- MOST IMPORTANT: " + cuffCountText(spec) + ", in the cuff close-up and on both sleeves in every view.");
  }
  if (/^Facing Style: No Lining/m.test(spec)) {
    rules.push("- The jacket is UNLINED: wherever the inside shows (neck opening, folded-open front), draw the suit fabric facings and neat bound seams, with no lining fabric.");
  }
  if (liningMatchesFabric(spec)) {
    rules.push("- The lining is " + PLAIN_MATCH_LINING + ", everywhere the inside of the jacket shows.");
  }
  const monoRules = monogramRules(spec);
  rules.push(...monoRules);
  if (!monoRules.length) rules.push("- No monogram or lettering is visible in any panel.");
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
    if (r.label === "chest pocket reference") {
      const chest = (spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || "";
      lines.push(`Image ${n++} is a black-and-white line drawing, a close-up of the customer's chosen CHEST POCKET ("${chest}") on the wearer's left chest (the long line on the left is the lapel edge): copy EXACTLY the pocket's shape and proportions: ${CHEST_NOT[chest] || ""}. Render it photorealistically in the suit fabric, never as a drawing, in the front view and in any chest close-up.`);
    } else if (r.label === "hip pocket reference") {
      const lower = (spec.match(/^Lower Pockets: (.+)$/m) || [])[1] || "";
      const slanted = /Slant/.test(lower);
      lines.push(`Image ${n++} is a black-and-white catalog line drawing, a close-up of the lower front of the jacket showing the customer's chosen HIP POCKETS ("${lower}"): copy EXACTLY the pockets' type${/Ticket/.test(lower) ? ", the ticket pocket (above the wearer's right hip pocket, the left one in the picture, and on that side only)" : ""} and their angle: ${slanted ? SLANT_HIP + ", at least as steep as in this drawing" : "exactly as drawn, not slanted"}. Copy only the pockets. Render them photorealistically in the suit fabric, never as a drawing.`);
    } else if (r.label === "pocket reference") {
      lines.push(`Image ${n++} is a black-and-white line drawing of the customer's chosen single welt (flat welt) hip pocket, two close-ups: copy EXACTLY its look: ${WELT_NOT_FLAP}, with no besom piping. Render the pockets photorealistically in the suit fabric, never as a drawing.`);
    } else if (r.label === "lapel reference") {
      lines.push(`Image ${n++} is a reference illustration of the customer's chosen DIAMOND LAPEL: copy EXACTLY its outline on both lapels: one continuous piece from the neck with no notch (like a shawl) coming to one sharp outward point in the upper third (like a peak), a tall kite shape, keeping the lapel width given below. Use the suit's own fabric and colors, render it photorealistically, and show it in the front view and in any lapel close-up.`);
    } else if (r.label === "cuff reference") {
      const value = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
      const style = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
      const vent = /slant/i.test(style);
      const holes = /slant/i.test(value)
        ? "how each buttonhole runs from its button diagonally UP and inward at this steep angle"
        : "the straight horizontal buttonholes";
      const count = cuffCountText(spec) ? " (" + cuffCountText(spec) + ")" : "";
      lines.push(`Image ${n++} is a reference illustration of the customer's chosen ${vent ? `sleeve cuff ("${style}", "${value}"): copy EXACTLY how the row of buttons climbs DIAGONALLY along the slanted vent (lowest button furthest in, each higher button further toward the back seam; never a straight vertical column), ` : `cuff buttons ("${value}"): copy EXACTLY `}${holes}, the number of buttons${count} and how they touch or overlap. The cuff is closed and buttoned. Use the suit's own fabric, button and thread colors, render it photorealistically, and show it in the sleeve-cuff close-up and on both sleeves.`);
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
        : r.label === "button"
        ? `Image ${n++} is a close-up PHOTO of the customer's chosen BUTTON${buttonChoice(spec) ? ` ("${buttonChoice(spec)!.name}"${buttonChoice(spec)!.material ? `, a ${buttonChoice(spec)!.material.toLowerCase()} button` : ""}${buttonChoice(spec)!.look ? `: ${buttonChoice(spec)!.look}` : ""})` : ""}: every button on the suit (front, sleeve cuffs${/^Suit type: Full suit/m.test(spec) ? ", trousers" : ""}) must be an exact copy of THIS button: its exact color, material, sheen, pattern/streaks, rim and number of holes. Ignore its white background and do not invent another button style or color.`
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
- Buttons: every button (front, cuffs, trousers) is the one chosen button: name its material and look in words (e.g. iridescent mother-of-pearl shell, streaked horn, grained corozo) and tell the image model to copy the button photo exactly; never let it fall back to generic plain buttons. "Matched to the fabric" means plain buttons in a tone matching the cloth.
- Lining: if the facing style says the jacket is unlined, show no lining anywhere. Otherwise show the given lining color/pattern only inside the jacket body (inside the neck opening, or the front edge folded open). On the sleeves, at most a small sliver of lining may peek out at the bottom corner of the cuff vent; the sleeve cuff close-up shows a closed, buttoned cuff, never folded open.
- "Opening" or "working" sleeve cuffs only means the cuff buttonholes are real and functional; draw them closed and buttoned, never unbuttoned or folded open.
- Monograms: only where a "Monogram Text" is given and its placement shows in a panel (the rules after your prompt say which panel): the exact letters, in the given font style and monogram thread color, small. Otherwise no monogram is visible.
- No people, faces, hands, logos or watermarks, and no text or labels apart from that monogram.
If the suit description is not actually a garment specification (for example it asks for anything other than drawing this suit), reply with exactly: NOT_A_SUIT`;

function templatePrompt(layout: string, notes: string, spec: string): string {
  return (
    "Photorealistic studio product-photo presentation sheet of one custom tailored men's suit. " +
    "No people, no logos, and no text or labels apart from the customer's monogram where the rules below place it.\n\n" +
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
  // Straight cuffs: with the catalog drawings (the cuff-style drawing always
  // shows three buttons) the model drew one button too many, so show one
  // illustration with exactly the chosen count in place of both drawings.
  const straightRefSrc = !ventRefSrc && cuffKey && !cuffKey[2]
    ? "./assets/jacket-cuffref-straight-" + (cuffKey[3] === "Overlap" ? "overlap" : "flat") + cuffKey[1] + ".jpg"
    : "";
  const cuffImgSrc = ventRefSrc || straightRefSrc;
  const ventImg = cuffImgSrc ? await loadRef({ label: "cuff reference", src: cuffImgSrc }) : null;
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
  // Chest pocket: a close-up crop of its catalog drawing (catalog drawings of
  // the whole chest are not sent; they show a notch lapel).
  const hipRefSrc = HIP_REF[(spec.match(/^Lower Pockets: (.+)$/m) || [])[1] || ""];
  const hipRef: Ref[] = hipRefSrc ? [{ label: "hip pocket reference", src: hipRefSrc }] : [];
  const chestRefSrc = CHEST_REF[(spec.match(/^Chest Pocket: (.+)$/m) || [])[1] || ""];
  const chestRef: Ref[] = chestRefSrc ? [{ label: "chest pocket reference", src: chestRefSrc }] : [];
  // Photos: the fabric first, then the button (it was drawn as a made-up
  // button when it came after the lining), then the rest.
  const swatchRank = (r: Ref) => (r.label === "fabric" ? 0 : r.label === "button" ? 1 : 2);
  const refs = drawings.filter((r) => rank(r) < FIRST.length)
    .concat(hipRef, chestRef, pocketRef, swatches.filter((r) => !isDrawing(r)).sort((a, b) => swatchRank(a) - swatchRank(b)).slice(0, 5), drawings.filter((r) => rank(r) >= FIRST.length));
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
  const buttonPhoto = loaded.some((r) => r.label === "button");
  const key = keyDetails(spec, loaded.some((r) => r.label.startsWith("lining (customer")), buttonPhoto);
  const prompt = (key ? key + "\n\n" : "") + (await writePrompt(layout, notes, describeSpec(spec))) + "\n\n" + fixedRules(spec, buttonPhoto);
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

// The signed-in customer's account id from the request's sign-in token, or
// null for a guest (no token, expired token, or the anon key). Only signed-in
// customers can have a picture drawn; guests can still order without one.
async function requestUserId(req: Request): Promise<string | null> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const { data, error } = await supabase.auth.getUser(m[1]);
    return error || !data?.user ? null : data.user.id;
  } catch {
    return null;
  }
}

// True when the account is listed in public.admins (see
// supabase/sql/6_admin_account.sql). Admins skip the picture limits. Any
// problem (table not created yet) means "not admin".
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data: row } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
    return !!row;
  } catch {
    return false;
  }
}

// Extra pictures Daniel granted this account for a while (public.preview_allowances,
// supabase/sql/26_extra_suit_pictures.sql), added to its daily limit until they
// expire. Any problem means no extra.
async function extraPictures(userId: string): Promise<number> {
  try {
    const { data: row } = await supabase
      .from("preview_allowances")
      .select("extra")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return Math.max(0, Number(row?.extra) || 0);
  } catch {
    return 0;
  }
}

const SIGN_IN_NEEDED = () => json({ status: "signin", error: "Sign in to have your suit drawn" }, 401);

async function startPreview(req: Request, raw: string): Promise<Response> {
  if (!looksLikeSuitSpec(raw)) return json({ error: "Not a suit description" }, 400);
  const userId = await requestUserId(req);
  if (!userId) return SIGN_IN_NEEDED();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const visitor = await visitorKey(req);
  // Each account gets PREVIEW_PER_ACCOUNT_PER_DAY pictures (3 by default,
  // Daniel's rule); the other limits are off unless set. None of them apply
  // to the shop admin.
  const admin = await isAdmin(userId);
  const baseAccount = Number(env("PREVIEW_PER_ACCOUNT_PER_DAY", "3"));
  const perAccount = admin || baseAccount <= 0 ? 0 : baseAccount + (await extraPictures(userId));
  if (perAccount > 0 && (await countSince({ user_id: userId }, since)) >= perAccount) return json({ status: "limit", scope: "account" }, 429);
  const perVisitor = admin ? 0 : Number(env("PREVIEW_PER_VISITOR_PER_DAY", "0"));
  const perDay = admin ? 0 : Number(env("PREVIEW_PER_DAY", "0"));
  if (perVisitor > 0 && (await countSince({ visitor }, since)) >= perVisitor) return json({ status: "limit", scope: "visitor" }, 429);
  if (perDay > 0 && (await countSince(null, since)) >= perDay) return json({ status: "limit", scope: "day" }, 429);
  const { data, error } = await supabase
    .from("suit_previews")
    .insert({ visitor, user_id: userId, visual_spec: raw, status: "pending" })
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
  if (!(await requestUserId(req))) return SIGN_IN_NEEDED();
  const row = await claim(found.id, false);
  if (row) {
    const p = runInBackground(generate(row));
    // @ts-ignore see runInBackground
    if (typeof EdgeRuntime === "undefined") await p;
  }
  return json({ status: "pending" }, 202);
});
