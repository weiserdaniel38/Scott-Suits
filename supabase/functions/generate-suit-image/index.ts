// Scott Suits -- draws a picture sheet of a customer's finished suit.
//
// The sheet follows the layout of assets/suit-sheet-layout-reference.jpg:
// full suit front, full suit back, trousers front, a sleeve-cuff close-up and
// a trouser-waistband close-up (jacket-only orders get jacket views instead).
//
// How it's called:
//   * From the website's order confirmation page ("Generate My Suit"):
//       { order_id, suit_number }          start drawing (once per suit)
//       { order_id, suit_number, check }   ask whether it's done yet
//       { ping: true }                     is this feature switched on?
//     order_id is the random UUID only the customer's browser knows.
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
//   USE_LAYOUT_REFERENCE optional, set to "false" to stop showing the model
//                      the example sheet
//   SITE_URL           optional, default https://scottssuits.com
//   ANTHROPIC_MODEL    optional, default claude-opus-5-5
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const BUCKET = "suit-images";
const LAYOUT_REFERENCE = "./assets/suit-sheet-layout-reference.jpg";
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
Right side, two square close-up panels stacked: (4) a close-up of the jacket sleeve cuff showing the cuff buttons and buttonhole stitching; (5) a close-up of the trouser waistband and fly, partly open, showing the waistband extension, closure, belt loops and front pocket, with the trouser hem visible below.`;
}

function refsNote(refs: { label: string }[], withLayout: boolean): string {
  const lines: string[] = [];
  let n = 1;
  if (withLayout) {
    lines.push(`Image ${n++} is a LAYOUT EXAMPLE only: copy its panel arrangement, camera angles, lighting and white background, but NOT its garment (its color, fabric, cuffs or styling).`);
  }
  for (const r of refs) {
    lines.push(`Image ${n++} is the real ${r.label} swatch: match its exact color, pattern and texture.`);
  }
  return lines.join("\n");
}

const PROMPT_WRITER_SYSTEM = `You write prompts for an image-generation model that draws a customer's finished custom suit for a men's tailoring shop, as a multi-panel presentation sheet.

You receive the sheet layout, notes on the reference images the image model will see, and a plain-English description of one suit. Write ONE image prompt (plain text, no preamble, under 3,000 characters) for a photorealistic studio product-photo sheet:
- Keep the given layout and reference-image notes, restated clearly.
- Describe the fabric color, pattern and texture precisely; use the approximate hex colors as guidance but describe colors in words. The jacket and trousers are cut from the fabric given for each.
- Describe every construction detail the description gives that is visible in one of the panels: lapel style and width, lapel buttonhole and its thread color, front button stance and count, button color and finish, chest and lower pockets, sleeve cuff style and number of cuff buttons, vents (back view), and for trousers the waistband style and extension, closure, pleats, belt loops, pockets, back pockets (back view) and hem/cuff style.
- Thread colors: topstitching and buttonhole stitching must use the given thread colors; "matched to the fabric color" means tonal thread the same color as the cloth.
- Buttons: use the given button color; "matched to the fabric" means buttons in a tone matching the cloth.
- Lining: show the given lining color/pattern wherever the inside of the jacket is visible.
- Monograms: at most a subtle tonal embroidery with no readable letters.
- No people, faces, hands, text, labels, logos or watermarks.`;

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
    if (response.stop_reason === "refusal") return fallback;
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return text || fallback;
  } catch (err) {
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

async function generate(row: { id: string; order_id: string | null; suit_type: string | null; visual_spec: string | null }) {
  try {
    const raw = (row.visual_spec || "").trim();
    if (!raw) throw new Error("This order has no visual_spec (placed before the image feature was set up)");
    const { text: spec, swatches } = parseSpec(raw);
    const jacketOnly = row.suit_type === "jacket_only" || /^Suit type: Jacket only/m.test(spec);
    const useLayout = env("USE_LAYOUT_REFERENCE", "true").toLowerCase() !== "false";

    const loaded = (await Promise.all(swatches.slice(0, 5).map(loadRef))).filter(
      (x): x is { label: string; blob: Blob } => !!x,
    );
    const layoutImg = useLayout ? await loadRef({ label: "layout example", src: LAYOUT_REFERENCE }) : null;
    const images = (layoutImg ? [layoutImg] : []).concat(loaded);

    const layout = layoutFor(jacketOnly);
    const notes = refsNote(loaded, !!layoutImg);
    const prompt = await writePrompt(layout, notes, spec);
    const jpeg = await drawImage(prompt, images);

    const path = (row.order_id || row.id) + "/" + row.id + "-" + Date.now() + ".jpg";
    const up = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error("Storage upload failed: " + up.error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await setRow(row.id, { image_status: "done", image_url: data.publicUrl, image_prompt: prompt, image_error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Suit image failed for", row.id, msg);
    await setRow(row.id, { image_status: "failed", image_error: msg.slice(0, 1000) });
  }
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
