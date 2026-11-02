// suit-from-photo: "Build From a Photo" on the suit type page.
//
// The customer uploads a picture of a suit they like. The site sends the
// (downsized) photo plus the designer's own option lists for the details a
// camera can see (front buttons, lapel, pockets, vents, sleeve buttons,
// pleats, cuffs...). Claude looks at the photo and answers, for every step,
// with one of those option names, or "Not visible". It also estimates the
// cloth's pattern and colour, the buttons and the lining, which main.js
// matches to the nearest fabric / button / lining in the live catalog.
//
// The function never sees or returns factory codes: the site sends only the
// customer-facing option names. Nothing is stored.
//
// Secrets: ANTHROPIC_API_KEY (Claude reads the photo). Until that secret is
// added, the OPENAI_API_KEY the picture generator already uses reads it
// instead (SUIT_PHOTO_OPENAI_MODEL, default gpt-5.2, the cuff checker's
// model), with the same JSON schema.
// Optional: SUIT_PHOTO_MODEL (default claude-opus-5-5).
// Deploy with verify_jwt false (the site calls it like generate-suit-image).
// POST {"ping":true} -> {"ok":true,"ready":true}.

import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const env = (k: string, d = "") => Deno.env.get(k) || d;

// A light per-instance limit so the endpoint can't be used as a free vision
// service: 12 photos an hour from one address.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 12;
}

type Step = { key: string; label: string; options: string[] };

function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((s: any) => ({
    key: String(s && s.key || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 40),
    label: String(s && s.label || "").slice(0, 60),
    options: Array.isArray(s && s.options)
      ? [...new Set(s.options.slice(0, 40).map((o: unknown) => String(o).slice(0, 80)).filter(Boolean))] as string[]
      : [],
  })).filter((s) => s.key && s.options.length);
}

const NOT_VISIBLE = "Not visible";
const HEX = { type: "string", description: "Colour as #rrggbb, as it would look in even daylight (correct for shadows and camera tint)." };

function buildSchema(jacket: Step[], pants: Step[]) {
  const stepProps = (steps: Step[]) => {
    const props: Record<string, unknown> = {};
    steps.forEach((s) => { props[s.key] = { type: "string", enum: [...s.options, NOT_VISIBLE] }; });
    return { type: "object", properties: props, required: steps.map((s) => s.key), additionalProperties: false };
  };
  return {
    type: "object",
    properties: {
      isSuit: { type: "boolean", description: "true if the photo shows a suit, a tailored jacket/blazer or tailored trousers" },
      message: { type: "string", description: "If isSuit is false: one short friendly sentence saying what you see instead. Otherwise an empty string." },
      pantsVisible: { type: "boolean" },
      fabric: {
        type: "object",
        properties: {
          pattern: { type: "string", enum: ["Solid", "Pinstripe", "Herringbone", "Plaid"] },
          hex: HEX,
          description: { type: "string", description: "A few words, e.g. 'mid navy with faint chalk stripe'" },
        },
        required: ["pattern", "hex", "description"],
        additionalProperties: false,
      },
      buttons: {
        type: "object",
        properties: {
          matchesFabric: { type: "boolean", description: "true if the buttons are close to the cloth colour or can't be seen clearly" },
          hex: HEX,
          material: { type: "string", enum: ["Horn", "Shell", "Corozo", "Classic", "Unknown"] },
        },
        required: ["matchesFabric", "hex", "material"],
        additionalProperties: false,
      },
      lining: {
        type: "object",
        properties: {
          visible: { type: "boolean" },
          patterned: { type: "boolean" },
          hex: HEX,
        },
        required: ["visible", "patterned", "hex"],
        additionalProperties: false,
      },
      contrastButtonholes: {
        type: "object",
        properties: { visible: { type: "boolean", description: "true only if the buttonhole thread is clearly a different colour from the cloth" }, hex: HEX },
        required: ["visible", "hex"],
        additionalProperties: false,
      },
      jacket: stepProps(jacket),
      pants: stepProps(pants),
    },
    required: ["isSuit", "message", "pantsVisible", "fabric", "buttons", "lining", "contrastButtonholes", "jacket", "pants"],
    additionalProperties: false,
  };
}

const SYSTEM =
  "You are a master tailor at a custom suit shop. A customer uploaded a photo of a suit they want copied. " +
  "For every design step you are given the shop's exact option names; choose the one that best matches what the photo shows. " +
  "Choose \"Not visible\" only when the detail truly cannot be judged (e.g. back vents on a front-only photo, trousers cropped out). " +
  "Rules: count the front buttons carefully, and on a double breasted jacket count all buttons and how many fasten. " +
  "A double breasted jacket never has a notch lapel. Lapel width: Thin is a slim modern lapel, Standard is classic, Wide and Extra Wide are broad 1970s / statement lapels. " +
  "Lower pockets: say whether they have flaps, whether they are slanted, and whether there is a small ticket pocket above the right one. " +
  "Sleeve buttons: count them and say whether they touch/overlap (kissing) or are spaced. " +
  "For colours give what the cloth would look like in neutral daylight; dark navy and black are easy to confuse, look for blue undertones.";

async function readWithClaude(key: string, mediaType: string, data: string, schema: unknown, question: string) {
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: env("SUIT_PHOTO_MODEL", "claude-opus-5-5"),
    max_tokens: 8000,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: question },
      ],
    }],
  } as any);
  if (response.stop_reason === "refusal") return null;
  const text = response.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
  return JSON.parse(text);
}

async function readWithOpenAI(key: string, dataUrl: string, schema: unknown, question: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model: env("SUIT_PHOTO_OPENAI_MODEL", "gpt-5.2"),
      response_format: { type: "json_schema", json_schema: { name: "suit_match", strict: true, schema } },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
      ],
    }),
  });
  if (!res.ok) throw new Error("OpenAI " + res.status + " " + (await res.text()).slice(0, 300));
  const msg = (await res.json())?.choices?.[0]?.message;
  if (!msg || msg.refusal) return null;
  return JSON.parse(msg.content || "null");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const key = env("ANTHROPIC_API_KEY");
  const openaiKey = env("OPENAI_API_KEY");
  if (body && body.ping) return json({ ok: true, ready: !!(key || openaiKey), reader: key ? "claude" : openaiKey ? "openai" : "none" });
  if (!key && !openaiKey) return json({ error: "not_ready" }, 503);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "limit" }, 429);

  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ""));
  if (!m) return json({ error: "Please upload a JPG or PNG photo." }, 400);
  if (m[2].length > 6_000_000) return json({ error: "That photo is too large." }, 413);
  const jacket = cleanSteps(body.jacketSteps);
  const pants = cleanSteps(body.pantsSteps);
  if (!jacket.length) return json({ error: "Bad request" }, 400);

  const stepText = (title: string, steps: Step[]) =>
    title + "\n" + steps.map((s) => "- " + s.key + " (" + s.label + "): " + s.options.map((o) => '"' + o + '"').join(", ")).join("\n");

  const schema = buildSchema(jacket, pants);
  const question = "Match this suit to our options.\n\n" + stepText("JACKET STEPS", jacket) + "\n\n" + stepText("TROUSER STEPS", pants);
  try {
    const out = key
      ? await readWithClaude(key, m[1], m[2], schema, question)
      : await readWithOpenAI(openaiKey, body.image, schema, question);
    if (!out) return json({ isSuit: false, message: "Sorry, we couldn't read that photo. Please try another picture of a suit." });
    return json({ ok: true, result: out });
  } catch (err) {
    console.error("suit-from-photo failed:", err);
    return json({ error: "failed" }, 502);
  }
});
