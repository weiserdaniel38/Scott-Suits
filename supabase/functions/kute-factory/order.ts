// Turns one saved suit (a row of public.orders) into the factory's
// saveOrder body (Kute Tailor Open API, POST /order/saveOrder).
//
// Most choices carry their factory code in catalog.js (`factoryCode`, a
// comma-separated list when one choice needs more than one code); the
// catalog is loaded from the live site, so a code added there is used here
// without another deploy. Choices whose code depends on more than one step
// (sleeve cuff, lining, threads, felt, buttons) and the codes every order
// needs are set below.
//
// Pure: no network or database, so it can be tested on its own.

type Row = Record<string, unknown>;
type Option = { name: string; factoryCode?: string; matchesFabric?: boolean; options?: Option[] };
type Category = { column: string; options?: Option[]; colorFamilies?: { options?: Option[] }[]; patternTypes?: { colorFamilies?: { options?: Option[] }[] }[] };
export type Catalog = Record<string, Category>;
// Embroidery fonts and colors from public.factory_codes (list "embroideries").
export type EmbCodes = { fonts: { code: string; name: string }[]; colors: { code: string; name: string }[] };
// The factory's allowed range (cm) for each measurement position, from
// public.factory_codes (lists "bodyMeasurements" / "finishedMeasurements").
export type SizeRanges = Record<string, { name: string; min: number; max: number }>;

export type BuildInput = {
  row: Row;
  jacket: Catalog;
  pants: Catalog;
  emb: { MXF?: EmbCodes; MXK?: EmbCodes };
  // For the measurement type of this suit (body or finished).
  ranges?: { MXF?: SizeRanges; MXK?: SizeRanges };
  height: number;
  heightUnit: "cm" | "in";
  weight: number;
  weightUnit: "kg" | "lb";
  orderNo?: string; // the factory's number, to update a draft already there
};

export type BuildResult = {
  body: Record<string, unknown>;
  // Things the admin should know before saving; `blocking` ones stop the send.
  warnings: string[];
  blocking: string[];
};

// Codes every jacket gets: no sweat pad, no inner pick stitch, bartack,
// standard shoulder pad, sleeve slit in fabric.
const JACKET_FIXED = ["074G", "0850", "0861", "060K", "AAQD"];
// Every pair of trousers: unlined, no back crotch lining, fish-mouth fly,
// nylon zip, standard inner waistband.
const PANTS_FIXED = ["3500", "3514", "3400", "3420", "3430"];

// Steps handled by hand below rather than by the catalog's own codes.
const JACKET_BY_HAND = new Set(["facing", "monogram", "monogramFont", "sleevecuffstyle", "cuffbuttons", "lining", "feltundercollar", "feltColor", "buttoncolor", "threadColor", "buttonholeThreadColor", "frontButtonholeThreadColor", "monogramThreadColor", "fabric"]);
const PANTS_BY_HAND = new Set(["monogram", "monogramFont", "monogramThreadColor", "threadColor", "fabric"]);

const CUFF_BUTTON_CODES: Record<string, string> = {
  "3 Flat Button": "0624",
  "4 Flat Button": "0621",
  "5 Flat Button": "0627",
  "4 Overlap Button": "0622",
  "5 Overlap Button": "0628",
  "6 Overlap Button": "062Z",
  "4 Slant Button": "0621",
  "5 Slant Button": "0627",
  "4 Slant Overlap Button": "0622",
  "5 Slant Overlap Button": "0628",
  "6 Slant Overlap Button": "062Z",
  "Button Less Sleeve (4 Buttons)": "0626",
};

// Monogram spots on the site -> the factory's embroidery position.
const JACKET_EMB_POSITIONS: Record<string, string> = {
  "On Left Inside Pocket": "937",
  "On Right Inside Pocket": "939",
  "On Right Inside Pocket, Monogram On Satin": "549",
  "Monogram On Middle Under Collar": "550",
};
const PANTS_EMB_POSITIONS: Record<string, string> = {
  "Monogram Inside Left Waist": "1046,3652",
  "Monogram On Left Back Pocket": "2726",
};
const NO_MONOGRAM = "No Monogram Need";

// Body measurements (the customer's own, cm) -> the factory's body
// measurement positions; the factory adds the allowance for the fit.
const JACKET_BODY: [string, string][] = [
  ["body_neck", "1"], ["body_chest", "2"], ["body_stomach", "3"], ["body_seat", "5"], ["body_bicep", "8"],
  ["body_shoulder", "11"], ["body_sleeve", "13"], ["body_sleeve", "14"], ["body_nape_waist", "18"],
  ["body_back_length", "15"], ["body_front_waist", "19"],
];
const PANTS_BODY: [string, string][] = [
  ["body_waist", "4"], ["body_seat", "5"], ["body_thigh", "6"], ["body_u_rise", "7"], ["body_back_waist_h", "21"],
  ["body_front_waist_h", "20"], ["body_outseam", "16"], ["body_outseam", "17"],
];
// The fits offered on the site (BODY_FITS in catalog.js) -> factory fit codes.
const FIT_CODES: Record<string, number> = { Slim: 1, Regular: 2, Loose: 3 };

// Finished measurements (cm) -> the factory's measurement position codes.
const JACKET_SIZES: [string, string][] = [
  ["chest", "XF01"], ["stomach", "XF02"], ["bicep", "XF04"], ["sleeve_length", "XF05"], ["sleeve_length", "XF06"],
  ["back_jacket", "XF07"], ["shoulder", "XF08"], ["front_jacket", "XF11"], ["wrist", "XF12"],
];
const PANTS_SIZES: [string, string][] = [
  ["waist", "XK01"], ["hips", "XK02"], ["thigh", "XK03"], ["crotch", "XK04"], ["leg_length", "XK05"], ["leg_length", "XK06"],
  ["knee", "XK08"], ["cuff", "XK07"],
];

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

function allOptions(cat: Category): Option[] {
  const out: Option[] = [...(cat.options || [])];
  (cat.colorFamilies || []).forEach((f) => out.push(...(f.options || [])));
  (cat.patternTypes || []).forEach((p) => (p.colorFamilies || []).forEach((f) => out.push(...(f.options || []))));
  return out;
}

function findOption(cat: Category | undefined, value: string): Option | undefined {
  return cat ? allOptions(cat).find((o) => o.name === value) : undefined;
}

// Is this a "match the fabric" choice (or nothing chosen)?
function matched(cat: Category | undefined, value: string): boolean {
  if (!value) return true;
  const o = findOption(cat, value);
  return !!(o && o.matchesFabric);
}

// Codes from the catalog for every step not handled by hand.
function catalogCodes(cat: Catalog, row: Row, skip: Set<string>, label: string, warnings: string[]): string[] {
  const codes: string[] = [];
  for (const [key, c] of Object.entries(cat)) {
    if (skip.has(key)) continue;
    const value = s(row[c.column]);
    if (!value) continue;
    const opts = allOptions(c);
    if (!opts.some((o) => o.factoryCode)) continue;
    const o = opts.find((x) => x.name === value);
    if (o && o.factoryCode) codes.push(...o.factoryCode.split(",").map((x) => x.trim()).filter(Boolean));
    else warnings.push(label + ": no factory code for \"" + value + "\" (" + key + "); set it on the factory site.");
  }
  return codes;
}

// "3701" (site monogram thread) -> the factory color whose name starts "3701#".
function embColor(codes: EmbCodes | undefined, site: string): string {
  if (!codes || !site) return "";
  const hit = codes.colors.find((c) => s(c.name).split("#")[0].trim() === site);
  return hit ? s(hit.code) : "";
}

// "RC01" (site font) -> the factory font named "RC01 ...".
function embFont(codes: EmbCodes | undefined, site: string): string {
  if (!codes || !site) return "";
  const hit = codes.fonts.find((f) => s(f.name).split(" ")[0] === site);
  return hit ? s(hit.code) : "";
}

function sizes(row: Row, list: [string, string][], label: string, warnings: string[], ranges?: SizeRanges) {
  const out: { positionEcode: string; size: number }[] = [];
  for (const [col, code] of list) {
    const n = Number(row[col]);
    if (row[col] === null || row[col] === undefined || row[col] === "" || !isFinite(n) || n <= 0) {
      if (!out.some((x) => x.positionEcode === code)) warnings.push(label + ": no " + col.replace(/_/g, " ") + " measurement.");
      continue;
    }
    const size = Math.round(n * 10) / 10;
    // The factory refuses a size outside its range, so say which one now.
    const r = ranges && ranges[code];
    if (r && (size < r.min || size > r.max)) {
      const msg = label + ": " + col.replace(/^body_/, "").replace(/_h$/, "_height").replace(/_/g, " ") + " is " + size + " cm, outside the factory's " +
        r.min + " to " + r.max + " cm for " + r.name.replace(/\s*\((L|R)\)\s*$/i, "") + ". Check it was entered in cm.";
      if (!warnings.includes(msg)) warnings.push(msg);
    }
    out.push({ positionEcode: code, size });
  }
  return out;
}

function monogram(
  row: Row, label: string, placementCol: string, textCol: string, fontCol: string, colorCol: string,
  positions: Record<string, string>, codes: EmbCodes | undefined, warnings: string[], notes: string[],
) {
  const placement = s(row[placementCol]);
  if (!placement || placement === NO_MONOGRAM) return [];
  const text = s(row[textCol]);
  const font = s(row[fontCol]);
  const color = s(row[colorCol]);
  const where = positions[placement];
  const note = label + " monogram \"" + (text || "?") + "\" at " + placement + (font ? ", font " + font : "") + (color ? ", thread " + color : "") + ".";
  if (!text) {
    warnings.push(label + " monogram: the text wasn't saved with this order; add it on the factory site.");
    notes.push(note);
    return [];
  }
  if (!where) {
    warnings.push(label + " monogram: the factory has no spot for \"" + placement + "\"; it's in the remarks, check it on the factory site.");
    notes.push(note);
    return [];
  }
  const emb: Record<string, string> = { content: text, embPositionCode: where };
  const colorCode = embColor(codes, color);
  const fontCode = embFont(codes, font);
  if (colorCode) emb.colorCode = colorCode;
  else if (color) warnings.push(label + " monogram: no factory color for thread " + color + ".");
  if (fontCode) emb.fontCode = fontCode;
  else if (font) warnings.push(label + " monogram: no factory font for " + font + ".");
  return [emb];
}

function splitName(full: string) {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || "Customer", last: parts[0] || "Customer" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function buildFactoryOrder(input: BuildInput): BuildResult {
  const { row, jacket, pants, emb } = input;
  const warnings: string[] = [];
  const blocking: string[] = [];
  const notes: string[] = [];
  const isSuit = s(row.suit_type) !== "jacket_only";
  const bodyMode = s(row.measure_type) === "body";
  const fit = (v: unknown) => FIT_CODES[s(v)] || FIT_CODES.Regular;

  // ---- Jacket ----
  const jc = catalogCodes(jacket, row, JACKET_BY_HAND, "Jacket", warnings);
  jc.push(...JACKET_FIXED);
  // Orders from before the pick stitching step: no pick stitch.
  if (!s(row.jacket_pick_stitch)) jc.push("0570");

  // Lining style and facing.
  const facing = s(row.facing_style);
  if (facing === "No Lining Construction") {
    // No lining with piping, inner facing F with edge; the factory only
    // accepts it unconstructed and with no body or sleeve lining.
    jc.push("AAWY", "0866", "0706");
    if (s(row.jacket_construction) !== "Unconstructed") {
      for (const c of ["00C1", "000A"]) { const i = jc.indexOf(c); if (i !== -1) jc.splice(i, 1); }
      if (jc.indexOf("00D1") === -1) jc.push("00D1");
      warnings.push("Unlined jacket: sent as Unconstructed, the only canvas the factory allows without lining.");
    }
  } else if (facing === "Half Lining W/ Fabric Facing") {
    jc.push("AA2Y", "0701");
  } else {
    jc.push("AAQL", "0702");
  }

  // Body lining, and sleeve lining matching it.
  if (facing !== "No Lining Construction") {
    const lining = s(row.jacket_lining);
    if (matched(jacket.lining, lining)) jc.push("0711");
    else if (lining === "Customer's Own Photo") {
      warnings.push("Lining: the customer sent their own lining photo; pick the lining on the factory site.");
      notes.push("Lining: customer's own (photo on the order).");
    } else jc.push("0714:" + lining);
    jc.push("0721");
  }

  // Sleeve cuff: working or imitation slit, straight or slanted buttonholes,
  // and how many buttons.
  const cuffStyle = s(row.sleeve_cuff_style);
  const cuffButtons = s(row.sleeve_cuff_buttons);
  const slant = /slant/i.test(cuffButtons);
  if (cuffStyle) {
    const working = /^Working/.test(cuffStyle);
    jc.push(working ? "AAAJ" : "AAAI");
    jc.push(working ? (slant ? "AAAQ" : "AAAP") : (slant ? "AAAN" : "AAAM"));
  }
  if (cuffButtons) {
    const code = CUFF_BUTTON_CODES[cuffButtons];
    if (code) jc.push(code);
    else warnings.push("Jacket: no factory code for cuff buttons \"" + cuffButtons + "\".");
  }

  // Button sewing thread.
  const thread = s(row.jacket_thread_color);
  jc.push(matched(jacket.threadColor, thread) ? "064C" : "064D:" + thread);

  // Buttonhole thread: lapel, and front + sleeve.
  const lapelHole = s(row.jacket_buttonhole_thread_color);
  const frontHole = s(row.jacket_front_buttonhole_thread_color);
  const lapelMatched = matched(jacket.buttonholeThreadColor, lapelHole);
  const frontMatched = matched(jacket.frontButtonholeThreadColor, frontHole);
  if (lapelMatched && frontMatched) jc.push("064A");
  else if (!lapelMatched && !frontMatched && lapelHole === frontHole) jc.push("064B:" + lapelHole);
  else {
    if (!lapelMatched) jc.push("05A3:" + lapelHole);
    if (!frontMatched) jc.push("06M2:" + frontHole, "06C2:" + frontHole);
  }

  // Felt under collar.
  const felt = s(row.felt_under_collar);
  if (felt === "Customer-Appointed Felt") {
    const color = s(row.felt_color);
    if (color) jc.push("0672:" + color);
    else warnings.push("Felt: the customer chose their own felt but the color wasn't saved; pick it on the factory site.");
  } else jc.push("0671");

  // Buttons.
  const button = s(row.button_color);
  if (button && !matched(jacket.buttoncolor, button)) jc.push("0638:" + button);
  else notes.push("Buttons: best match to the fabric.");

  const jacketEmbs = monogram(row, "Jacket", "jacket_monogram_placement", "jacket_monogram_text", "jacket_monogram_font",
    "jacket_monogram_thread_color", JACKET_EMB_POSITIONS, emb.MXF, warnings, notes);

  const details: Record<string, unknown>[] = [{
    categoryCode: "MXF",
    crafts: [...new Set(jc)].join(","),
    orderSizes: sizes(row, bodyMode ? JACKET_BODY : JACKET_SIZES, "Jacket", warnings, input.ranges?.MXF),
    orderEmbs: jacketEmbs,
    ...(bodyMode ? { versionStyle: fit(row.jacket_fit) } : {}),
  }];

  // ---- Trousers ----
  if (isSuit) {
    const pc = catalogCodes(pants, row, PANTS_BY_HAND, "Trousers", warnings);
    pc.push(...PANTS_FIXED);
    if (!s(row.pants_pick_stitch)) pc.push("31A6");
    const pleat = s(row.front_pleat);
    if (pleat && pleat !== "No Pleat") pc.push("302F");
    const pThread = s(row.pants_thread_color);
    if (matched(pants.threadColor, pThread)) pc.push("345H", "345F");
    else pc.push("345J:" + pThread, "345G:" + pThread);
    if (button && !matched(jacket.buttoncolor, button)) pc.push("3454:" + button);
    const pantsEmbs = monogram(row, "Trousers", "monogram_placement", "pants_monogram_text", "pants_monogram_font",
      "pants_monogram_thread_color", PANTS_EMB_POSITIONS, emb.MXK, warnings, notes);
    details.push({
      categoryCode: "MXK",
      crafts: [...new Set(pc)].join(","),
      orderSizes: sizes(row, bodyMode ? PANTS_BODY : PANTS_SIZES, "Trousers", warnings, input.ranges?.MXK),
      orderEmbs: pantsEmbs,
      ...(bodyMode ? { versionStyle: fit(row.pants_fit) } : {}),
    });
    const calf = Number(row.calf);
    if (!bodyMode && isFinite(calf) && calf > 0) notes.push("Calf (finished): " + calf + " cm.");
  }

  // Fabric: the site stores "26SU218.DBV3529"; the factory's number is the part after the dot.
  const fabricValue = s(row.fabric);
  const fabric = fabricValue.includes(".") ? fabricValue.split(".").pop() || "" : fabricValue;
  if (!fabric) blocking.push("No fabric on this suit.");
  const pantsFabric = s(row.pants_fabric);
  if (isSuit && pantsFabric && pantsFabric !== fabricValue) {
    warnings.push("The trousers use a different fabric (" + pantsFabric + "); the factory order has one fabric, so fix it there.");
    notes.push("Trousers fabric: " + pantsFabric + ".");
  }

  if (!(input.height > 0)) blocking.push("No height on this order: enter it above.");
  if (!(input.weight > 0)) blocking.push("No weight on this order: enter it above.");

  const name = s(row.customer_name) || "Customer";
  const { first, last } = splitName(name);
  const suitNo = Number(row.suit_number) || 1;
  const ref = "SS-" + s(row.order_id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() + "-" + suitNo;
  const remark = ["Scott's Suits " + ref + ".", ...notes].join(" ");

  const body: Record<string, unknown> = {
    orderNo: input.orderNo || "",
    submit: false,
    customerNo: ref,
    addProduct: false,
    amount: 1,
    isSample: 0,
    category: isSuit ? "T" : "MXF",
    measuresType: bodyMode ? 10001 : 10002,
    fabric,
    customer: {
      nickname: name,
      firstname: first,
      lastname: last,
      gender: "1002",
      remark,
      height: input.height,
      heightUnit: input.heightUnit === "in" ? 1020 : 1019,
      weight: input.weight,
      weightUnit: input.weightUnit === "lb" ? 1018 : 1017,
    },
    orderDetails: details,
  };
  return { body, warnings, blocking };
}

// The factory's production status -> the site's shipping step (only ever
// moves an order forward; see SHIPPING_STATUSES in main.js).
// 10035 "Saving" and 10039 "Stay Payments" change nothing: a draft saved
// from here already shows "Stay Payments" before the admin submits it.
export const FACTORY_STAGE: Record<string, string> = {
  "10030": "cutting", // Pattern Making
  "10031": "sewing", // Production
  "10032": "finishing", // Stocked
  "10033": "factory_shipped", // On Delivery
  "10034": "factory_shipped", // Signed (received)
};
export const SHIPPING_ORDER = [
  "", "sent_to_factory", "cutting", "sewing", "finishing", "factory_shipped",
  "final_check", "shipped", "out_for_delivery", "delivered",
];
