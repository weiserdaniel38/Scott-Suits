// Scott Suits -- draws a picture of a customer's finished suit.
//
// Called by a database trigger (see supabase/sql/2_suit_image_trigger.sql)
// when an order row is marked status = 'completed'. It:
//   1. reads that row's `visual_spec` (plain-English suit description with
//      no personal data -- built by buildVisualSpecText() in main.js),
//   2. asks Claude to turn it into a detailed image prompt (optional; a
//      built-in template is used if ANTHROPIC_API_KEY isn't set),
//   3. asks OpenAI's image model to draw the suit,
//   4. saves the JPEG in the public `suit-images` bucket and writes
//      image_url / image_prompt / image_status back onto the order row.
//
// Neither AI ever sees the customer's name, contact details, address or
// measurements -- only visual_spec.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   WEBHOOK_SECRET     required -- must match the value in the trigger SQL
//   OPENAI_API_KEY     required -- draws the image (platform.openai.com)
//   ANTHROPIC_API_KEY  optional -- writes a tailored prompt
//   IMAGE_MODEL        optional, default gpt-image-2
//   IMAGE_QUALITY      optional, low | medium | high | auto (default medium)
//   IMAGE_SIZE         optional, default 1024x1536 (portrait)
//   ANTHROPIC_MODEL    optional, default claude-opus-5-5
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Manual re-draw (or retry a failed one):
//   curl -X POST <function URL> -H "x-webhook-secret: <secret>" \
//        -H "content-type: application/json" -d '{"id":"<order row id>","force":true}'

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const BUCKET = "suit-images";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const PROMPT_WRITER_SYSTEM = `You write prompts for an image-generation model that draws a customer's finished custom suit for a men's tailoring shop.

You receive a plain-English description of one suit. Write ONE image prompt (plain text, no preamble, under 1,200 characters) for a photorealistic studio product photo:
- Ghost-mannequin (invisible mannequin) presentation, full front view, the whole garment in frame, soft even studio lighting, plain light warm-gray seamless background.
- Describe the fabric color, pattern and texture precisely; use the approximate hex colors as guidance but describe colors in words.
- Describe every visible construction detail that the spec gives: lapel style and width, button stance and count, button color, pocket styles, ticket pocket, sleeve buttons, lapel buttonhole, vents only if visible from the front, and for full suits the trousers (waistband, pleats, cuffs/hem) shown below or beside the jacket.
- Where the spec says a detail "matches the fabric", describe it as tonal / matching the suit cloth.
- Inside details (lining, inside pockets, under-collar felt) are not visible in a front view; you may mention the lining color only as a small glimpse at the open front.
- Monograms: at most a subtle tonal embroidery with no readable letters.
- No people, faces, hands, text, labels, logos or watermarks.`;

function templatePrompt(spec: string): string {
  return (
    "Photorealistic studio product photo of a custom tailored men's suit on an invisible ghost mannequin, " +
    "full front view, entire garment in frame, soft even studio lighting, plain light warm-gray seamless background, " +
    "no people, no text, no logos. Construction and fabric details:\n" +
    spec.slice(0, 2500)
  );
}

async function writePrompt(spec: string): Promise<string> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return templatePrompt(spec);
  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: PROMPT_WRITER_SYSTEM,
      messages: [{ role: "user", content: spec }],
    });
    if (response.stop_reason === "refusal") return templatePrompt(spec);
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return text || templatePrompt(spec);
  } catch (err) {
    // The prompt writer is a nice-to-have; never fail the picture over it.
    console.warn("Prompt writer failed, using template:", err);
    return templatePrompt(spec);
  }
}

async function drawImage(prompt: string): Promise<Uint8Array> {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not set in Edge Function secrets");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model: env("IMAGE_MODEL", "gpt-image-2"),
      prompt: prompt.slice(0, 30000),
      n: 1,
      size: env("IMAGE_SIZE", "1024x1536"),
      quality: env("IMAGE_QUALITY", "medium"),
      output_format: "jpeg",
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error("OpenAI image API " + res.status + ": " + body.slice(0, 400));
  const b64 = JSON.parse(body)?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image API returned no image");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function setRow(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from("orders")
    .update({ ...fields, image_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Failed to update order", id, error);
}

async function generate(id: string, force: boolean) {
  // Claim the row so two calls never draw the same suit twice.
  let claim = supabase.from("orders").update({ image_status: "pending", image_error: null }).eq("id", id);
  if (!force) claim = claim.or("image_status.is.null,image_status.eq.failed");
  const { data: rows, error } = await claim.select("id, order_id, visual_spec");
  if (error) throw new Error("Could not read order " + id + ": " + error.message);
  if (!rows || !rows.length) return; // already done / in progress, or no such row
  const row = rows[0];

  try {
    const spec = (row.visual_spec || "").trim();
    if (!spec) throw new Error("This order has no visual_spec (placed before the image feature was set up)");
    const prompt = await writePrompt(spec);
    const jpeg = await drawImage(prompt);
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  // Trigger payload: { record: {...} }. Manual call: { id, force }.
  const id: string | undefined = body?.record?.id || body?.id;
  if (!id) return new Response("Missing order id", { status: 400 });
  const force = body?.force === true;

  // Drawing takes 20-60 seconds; answer the database right away and keep
  // working in the background.
  const work = generate(id, force).catch((e) => console.error(e));
  // @ts-ignore EdgeRuntime is provided by Supabase's runtime.
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;
  return new Response(JSON.stringify({ accepted: id }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
});
