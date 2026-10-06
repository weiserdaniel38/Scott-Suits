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
//     Rate limited per visitor and per day (see PREVIEW_* below); previews
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
//   IMAGE_QUALITY      optional, low | medium | high | auto (default medium)
//   IMAGE_SIZE         optional, default 1536x1024 (landscape sheet)
//   USE_LAYOUT_REFERENCE optional, set to "true" to also show the model the
//                      gray outline sheet (off by default: the panels are
//                      described in words only)
//   SITE_URL           optional, default https://scottssuits.com
//   PREVIEW_PER_VISITOR_PER_DAY optional, default 6
//   PREVIEW_PER_DAY    optional, default 150 (all visitors together)
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
// Prompt
// ---------------------------------------------------------------------------
function layoutFor(jacketOnly: boolean): string {
  return jacketOnly
    ? `Layout: one landscape presentation sheet on a clean white background with five panels, like a tailor's lookbook.
Left side, three tall panels side by side: (1) the jacket front view on an invisible ghost mannequin, buttoned, with the lining visible inside the neck opening; (2) the jacket back view; (3) the jacket front view with the front edge folded open to show the inside lining and inside pocket.
Right side, two square close-up panels stacked: (4) a close-up of the sleeve cuff showing the cuff buttons and buttonhole stitching; (5) a close-up of the lapel and chest showing the lapel buttonhole, chest pocket and fabric texture.`
    : `Layout: one landscape presentation sheet on a clean white background with five panels, like a tailor's lookbook.
Left side, three tall panels side by side: (1) the full suit front view (jacket and trousers) on an invisible ghost mannequin, jacket buttoned, with the lining visible inside the neck opening; (2) the full suit back view; (3) the trousers alone, front view.
Right side, two square close-up panels stacked: (4) a close-up of the jacket sleeve cuff showing the cuff buttons and buttonhole stitching; (5) a close-up of the trouser waistband and fly, partly open, showing the waistband extension tab (its exact shape is given in the rules below), the belt loops and front pocket, with the trouser hem visible below.`;
}

// Always added to the end of the final image prompt, whoever wrote the rest,
// to correct mistakes the image model tends to make.
function fixedRules(spec: string): string {
  const rules = ["Strict accuracy rules:"];
  if (!/^Suit type: Jacket only/m.test(spec)) {
    const ext = (spec.match(/^Waistband Extension Style: (.+)$/m) || [])[1] || "";
    const hook = (spec.match(/^Hook And Eye Style: (.+)$/m) || [])[1] || "";
    const noButton = /no button|no waistband/i.test(ext);
    rules.push(
      "- No exposed metal anywhere on the trousers: no visible metal clasps, hooks, bars or buckles on the waistband or fly. A hook-and-eye, if any, is hidden inside the waistband and must not be visible." +
        (noButton ? "" : " The waistband closes with a button."),
    );
    const shape = /arrow/i.test(ext) || (!ext && /arrow/i.test(hook))
      ? "a POINTED, arrow-shaped tab that tapers to a point like an arrowhead at its end (not square, not rounded)"
      : /square/i.test(ext)
      ? "a square-cornered, straight-ended tab (not pointed, not rounded)"
      : /round/i.test(ext)
      ? "a tab with a rounded end (not pointed, not square)"
      : "";
    if (shape) {
      rules.push(
        "- The waistband extension (the tab of waistband that overlaps at the top of the fly) is " + shape + "; show this shape clearly in the waistband close-up" +
          (noButton ? ", with no visible button or buttonhole on the tab." : ", fastened with one button."),
      );
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
  const cuff = (spec.match(/^Buttons On Sleeve Cuff: (.+)$/m) || [])[1] || "";
  const c = cuff.toLowerCase().match(/\b(one|two|three|four|five|\d)\b/);
  const cw: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const cn = c ? cw[c[1]] || Number(c[1]) : 0;
  if (cn) rules.push("- Each sleeve cuff has exactly " + cn + " button" + (cn === 1 ? "" : "s") + ".");
  const cuffStyle = (spec.match(/^Sleeve Cuff Styles: (.+)$/m) || [])[1] || "";
  if (/overlap/i.test(cuff)) {
    rules.push("- The cuff buttons OVERLAP: each button sits so close that its edge overlaps the next one (\"kissing\" buttons), with no gap between them.");
  }
  if (/slant/i.test(cuff) || /slant/i.test(cuffStyle)) {
    rules.push("- The cuff buttonholes are SLANTED: each buttonhole is stitched at a clear diagonal angle, not horizontal.");
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
    if (r.label.startsWith("style ")) {
      const name = r.label.slice(6);
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const value = (spec.match(new RegExp("^" + esc + ": (.+)$", "m")) || [])[1] || "";
      lines.push(`Image ${n++} is a black-and-white catalog line drawing of the customer's chosen ${name}${value ? ` ("${value}")` : ""}: copy exactly the shape, angle, count, spacing and overlap it shows, but render it photorealistically in the suit's own fabric, thread and button colors, never as a drawing.`);
    } else {
      lines.push(`Image ${n++} is the real ${r.label} swatch: match its exact color, pattern and texture.`);
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

You receive the sheet layout, notes on the reference images the image model will see, and a plain-English description of one suit. Write ONE image prompt (plain text, no preamble, under 3,000 characters) for a photorealistic studio product-photo sheet:
- Keep the given layout and reference-image notes, restated clearly.
- Describe the fabric color, pattern and texture precisely; use the approximate hex colors as guidance but describe colors in words. The jacket and trousers are cut from the fabric given for each.
- Describe every construction detail the description gives that is visible in one of the panels: lapel style and width, lapel buttonhole and its thread color, front button stance and count, button color and finish, chest and lower pockets, sleeve cuff style and number of cuff buttons, vents (back view), and for trousers the waistband style and extension, closure, pleats, belt loops, pockets, back pockets (back view) and hem/cuff style.
- Thread colors: topstitching and buttonhole stitching must use the given thread colors; "matched to the fabric color" means tonal thread the same color as the cloth.
- Buttons: use the given button color; "matched to the fabric" means buttons in a tone matching the cloth.
- Lining: show the given lining color/pattern wherever the inside of the jacket is visible.
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
    spec.slice(0, 4000)
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
  const quality = env("IMAGE_QUALITY", "medium");
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
  const { text: spec, swatches } = parseSpec(raw);
  const jacketOnly = /^Suit type: Jacket only/m.test(spec);
  const useLayout = env("USE_LAYOUT_REFERENCE", "false").toLowerCase() === "true";

  const isDrawing = (r: Ref) => r.label.startsWith("style ");
  const refs = swatches.filter((r) => !isDrawing(r)).slice(0, 5).concat(swatches.filter(isDrawing).slice(0, 8));
  const loaded = (await Promise.all(refs.map(loadRef))).filter(
    (x): x is { label: string; blob: Blob } => !!x,
  );
  const layoutImg = useLayout ? await loadRef({ label: "layout example", src: LAYOUT_REFERENCE }) : null;
  const images = (layoutImg ? [layoutImg] : []).concat(loaded);

  const layout = layoutFor(jacketOnly);
  const notes = refsNote(loaded, !!layoutImg, spec);
  const prompt = (await writePrompt(layout, notes, spec)) + "\n\n" + fixedRules(spec);
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
  const perVisitor = Number(env("PREVIEW_PER_VISITOR_PER_DAY", "6")) || 6;
  const perDay = Number(env("PREVIEW_PER_DAY", "150")) || 150;
  if ((await countSince({ visitor }, since)) >= perVisitor) return json({ status: "limit", scope: "visitor" }, 429);
  if ((await countSince(null, since)) >= perDay) return json({ status: "limit", scope: "day" }, 429);
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
