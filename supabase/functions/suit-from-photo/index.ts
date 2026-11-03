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
// The customer can also paste a link instead of uploading: a direct image
// link, or a web page (shop listing, article, Instagram post) whose preview
// image (og:image) is used. The function fetches it (public http(s) hosts
// only, no private or local addresses), shrinks it to a JPEG and sends that
// back as `photo` so the site can show it.
// Up to 3 photos can be sent together (e.g. jacket front, trousers, back);
// they are read as one suit.
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
  "On a front photo of a jacket the chest pocket, lower pockets, lapel buttonhole and front buttons ARE visible: look closely at the chest and hips and always answer them. " +
  "Rules: count the front buttons carefully, and on a double breasted jacket count all buttons and how many fasten. " +
  "A double breasted jacket never has a notch lapel. Lapel width: Thin is a slim modern lapel, Standard is classic, Wide and Extra Wide are broad 1970s / statement lapels. " +
  "Lower pockets: say whether they have flaps, whether they are slanted, and whether there is a small ticket pocket above the right one. " +
  "Sleeve buttons: count them and say whether they touch/overlap (kissing) or are spaced. " +
  "For colours give what the cloth would look like in neutral daylight; dark navy and black are easy to confuse, look for blue undertones.";

// ---- photo from a link ----
function blockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".supabase.internal")) return true;
  if (/^\d+$/.test(h)) return true; // integer IPs
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return true; // IPv6 literals: not needed for real photo links
  if (!h.includes(".")) return true; // single-label (internal) names
  return false;
}
function checkUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad_url");
  if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) throw new Error("bad_url");
  if (blockedHost(u.hostname)) throw new Error("bad_url");
  return u;
}
const UA = "Mozilla/5.0 (compatible; ScottSuitsPhotoBot/1.0; +https://scottssuits.com)";
async function fetchChecked(raw: string): Promise<Response> {
  let url = checkUrl(raw).toString();
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept: "image/*,text/html;q=0.9,*/*;q=0.5" }, signal: AbortSignal.timeout(12000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = checkUrl(new URL(res.headers.get("location")!, url).toString()).toString();
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) throw new Error("fetch_" + res.status);
    return Object.assign(res, { finalUrl: url });
  }
  throw new Error("too_many_redirects");
}
async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const reader = res.body!.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > cap) { await reader.cancel(); throw new Error("too_large"); }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function pageImage(html: string, base: string): string | null {
  const metas = [
    /<meta[^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image:secure_url|og:image|twitter:image(?::src)?)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
  ];
  for (const re of metas) {
    const m = re.exec(html);
    if (m) return new URL(m[1].replace(/&amp;/g, "&"), base).toString();
  }
  return null;
}
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Returns a data:image/jpeg URL (or the original bytes if they can't be
// re-encoded but are already a small JPG/PNG/WebP/GIF).
async function photoFromLink(link: string): Promise<string> {
  let res = await fetchChecked(link) as Response & { finalUrl: string };
  let type = (res.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") || type.includes("xhtml")) {
    const html = new TextDecoder().decode(await readCapped(res, 2_000_000));
    const img = pageImage(html, res.finalUrl);
    if (!img) throw new Error("no_image_on_page");
    res = await fetchChecked(img) as Response & { finalUrl: string };
    type = (res.headers.get("content-type") || "").toLowerCase();
  }
  if (!type.startsWith("image/") && !type.includes("octet-stream")) { await res.body?.cancel(); throw new Error("not_image"); }
  const bytes = await readCapped(res, 15_000_000);
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const im = await Image.decode(bytes);
    const scale = Math.min(1, 1568 / Math.max(im.width, im.height));
    if (scale < 1) im.resize(Math.round(im.width * scale), Math.round(im.height * scale));
    return "data:image/jpeg;base64," + toBase64(await im.encodeJPEG(86));
  } catch (e) {
    const m = /^image\/(jpeg|png|webp|gif)/.exec(type);
    if (m && bytes.length <= 3_700_000) return "data:image/" + m[1] + ";base64," + toBase64(bytes);
    console.warn("Could not re-encode linked photo", e);
    throw new Error("unreadable");
  }
}

type Pic = { mediaType: string; data: string; url: string };
async function readWithClaude(key: string, pics: Pic[], schema: unknown, question: string) {
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: env("SUIT_PHOTO_MODEL", "claude-opus-5-5"),
    max_tokens: 8000,
    output_config: { effort: env("SUIT_PHOTO_EFFORT", "medium"), format: { type: "json_schema", schema } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        ...pics.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } })),
        { type: "text", text: question },
      ],
    }],
  } as any);
  if (response.stop_reason === "refusal") return null;
  const text = response.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
  return JSON.parse(text);
}

async function readWithOpenAI(key: string, pics: Pic[], schema: unknown, question: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model: env("SUIT_PHOTO_OPENAI_MODEL", "gpt-5.2"),
      response_format: { type: "json_schema", json_schema: { name: "suit_match", strict: true, schema } },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [{ type: "text", text: question }, ...pics.map((p) => ({ type: "image_url", image_url: { url: p.url, detail: "high" } }))] },
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

  const images: string[] = (Array.isArray(body.images) ? body.images : body.image ? [body.image] : []).slice(0, 3).map((x: unknown) => String(x || "")).filter(Boolean);
  let linked = "";
  if (body.imageUrl && images.length < 3) {
    try {
      linked = await photoFromLink(String(body.imageUrl).trim().slice(0, 2000));
      images.push(linked);
    } catch (e) {
      console.warn("Photo link failed:", String(e));
      const why = String((e as Error)?.message || "");
      return json({
        error: "link",
        message: why === "bad_url" ? "That doesn't look like a web link. Please paste the full address, starting with https://."
          : why === "no_image_on_page" ? "We couldn't find a photo on that page. Try opening the photo itself and copying its address, or save it and upload it."
          : why === "too_large" ? "That photo is too large. Please save it and upload it instead."
          : "We couldn't open that link. Some sites block this; you can save the photo and upload it instead.",
      }, 400);
    }
  }
  if (!images.length) return json({ error: "Please upload a JPG or PNG photo." }, 400);
  const pics: Pic[] = [];
  for (const url of images) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!m) return json({ error: "Please upload a JPG or PNG photo." }, 400);
    if (m[2].length > 6_000_000) return json({ error: "That photo is too large." }, 413);
    pics.push({ mediaType: m[1], data: m[2], url });
  }
  const jacket = cleanSteps(body.jacketSteps);
  const pants = cleanSteps(body.pantsSteps);
  if (!jacket.length) return json({ error: "Bad request" }, 400);

  const stepText = (title: string, steps: Step[]) =>
    title + "\n" + steps.map((s) => "- " + s.key + " (" + s.label + "): " + s.options.map((o) => '"' + o + '"').join(", ")).join("\n");

  const schema = buildSchema(jacket, pants);
  const question = (pics.length > 1 ? "These " + pics.length + " photos show the same suit from different angles or details (e.g. the jacket, the trousers, the back). Combine what they show. " : "") +
    "Match this suit to our options.\n\n" + stepText("JACKET STEPS", jacket) + "\n\n" + stepText("TROUSER STEPS", pants);
  try {
    const out = key
      ? await readWithClaude(key, pics, schema, question)
      : await readWithOpenAI(openaiKey, pics, schema, question);
    if (!out) return json({ photo: linked || undefined, isSuit: false, message: "Sorry, we couldn't read that photo. Please try another picture of a suit." });
    return json({ ok: true, result: out, photo: linked || undefined });
  } catch (err) {
    console.error("suit-from-photo failed:", err);
    return json({ error: "failed" }, 502);
  }
});
