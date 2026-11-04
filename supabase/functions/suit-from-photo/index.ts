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
// link, or a web page (shop listing, article, Instagram post). For a page it
// collects the product gallery (og:image, the schema.org product images,
// large gallery <img> tags) and reads up to 4 of those photos together, so a
// shop's trouser and back shots count too. Fetching is limited to public
// http(s) hosts (no private or local addresses); photos are shrunk to JPEGs
// and sent back as `photos`, with `page` (site name, title, address) so the
// site can show a preview card of the website. A link with no suit
// gives isSuit false and the site asks for another link.
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
  "Trousers (whenever trousers show in any photo, answer every trouser step; use \"Not visible\" only for details truly out of frame): " +
  "Waistband adjusters: look closely at both SIDES of the waistband for small tabs or straps with a button or buckle (typical of tuxedo trousers and Tom Ford / Italian styles); if you see them, pick that adjuster option (a pointed strap running along the side seam through a metal slide buckle = pointed side straps with buckle; a short square tab through a buckle = side buckle tabs; a tab fastened with a button = side button tabs), and such trousers almost always have no belt loops. These straps sit on the side seam just below the waistband and are often easiest to see on a back or close-up photo. " +
  "Back pockets: count them on a back photo and check for a button and for flaps. " +
  "Belt loops: if the waistband is clean with no loops, answer No Belt Loops. " +
  "Closure tab: look at the front centre of the waistband: does the waistband extend past the fly as a tab (rounded, pointed or square, with or without a visible button), or do both sides simply meet at the centre with nothing showing? " +
  "Front pockets: side seam pockets are hidden in the outer leg seam (no visible opening on the front), slanted pockets show a diagonal opening from the waistband. Pleats: look for folds at the waistband; a clean front is flat. " +
  "Hem: a turned-up cuff shows a horizontal band at the bottom; otherwise plain. " +
  "Tuxedo details we don't offer (a satin side stripe, satin waistband) can be ignored. " +
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
// Every product photo a page offers, best first: share-preview images,
// the product's structured data (which lists the whole gallery on most shops,
// e.g. jacket, trousers, back), then large gallery <img> tags.
const LINK_MAX_PHOTOS = 4;
function pageImages(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown) => {
    if (typeof raw !== "string" || !raw.trim() || raw.startsWith("data:")) return;
    let u: URL;
    try { u = new URL(raw.trim().replace(/&amp;/g, "&"), base); } catch { return; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
    if (/\.svg(\?|$)|logo|icon|sprite|favicon|placeholder|blank\.gif|pixel/i.test(u.pathname)) return;
    // Same picture at another size (thumb folders, "1200px-" or "_800x800"
    // names) counts once: key on the file name without size marks.
    const file = (u.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
    const k = file.replace(/^\d{2,4}px-/, "").replace(/[_-](?:\d{2,4}x\d{2,4}|\d{2,4}w|small|thumb|medium|large|zoom|xl|xxl)(?=\.\w+$)/, "") || u.hostname + u.pathname;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(u.toString());
  };
  const metaRes = [
    /<meta[^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|og:image:url|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image:secure_url|og:image|og:image:url|twitter:image(?::src)?)["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/gi,
  ];
  for (const re of metaRes) for (const m of html.matchAll(re)) add(m[1]);
  // JSON-LD (schema.org Product / ImageObject)
  const walk = (node: any, depth: number) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    if (typeof node !== "object") return;
    const img = node.image ?? node.images;
    const pushImg = (v: any) => {
      if (typeof v === "string") add(v);
      else if (Array.isArray(v)) v.forEach(pushImg);
      else if (v && typeof v === "object") add(v.contentUrl || v.url);
    };
    if (img) pushImg(img);
    for (const k of Object.keys(node)) if (k !== "image" && k !== "images" && typeof node[k] === "object") walk(node[k], depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim()), 0); } catch { /* bad JSON-LD: skip */ }
  }
  // Gallery <img> tags: prefer zoom/large sources and the biggest srcset entry.
  let imgs = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (out.length >= 12 || imgs++ > 80) break;
    const tag = m[0];
    const attr = (n: string) => (new RegExp("\\s" + n + "=[\"']([^\"']+)[\"']", "i").exec(tag) || [])[1];
    const srcset = attr("srcset") || attr("data-srcset");
    let best = attr("data-zoom-image") || attr("data-zoom") || attr("data-large") || attr("data-large_image") || attr("data-full") || "";
    if (!best && srcset) {
      const parts = srcset.split(",").map((p) => p.trim().split(/\s+/)).filter((p) => p[0]);
      parts.sort((x, y) => (parseInt(y[1]) || 0) - (parseInt(x[1]) || 0));
      best = parts[0] ? parts[0][0] : "";
    }
    if (!best) best = attr("data-src") || attr("src") || "";
    const w = parseInt(attr("width") || "0");
    if (w && w < 200) continue;
    if (/product|gallery|pdp|zoom|media|image|images|cdn/i.test(tag)) add(best);
  }
  return out;
}
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Returns a data:image/jpeg URL (or the original bytes if they can't be
// re-encoded but are already a small JPG/PNG/WebP/GIF).
async function decodePhoto(res: Response, type: string, minSide: number): Promise<string> {
  if (!type.startsWith("image/") && !type.includes("octet-stream")) { await res.body?.cancel(); throw new Error("not_image"); }
  const bytes = await readCapped(res, 15_000_000);
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const im = await Image.decode(bytes);
    if (Math.min(im.width, im.height) < minSide) throw new Error("too_small");
    const scale = Math.min(1, 1568 / Math.max(im.width, im.height));
    if (scale < 1) im.resize(Math.round(im.width * scale), Math.round(im.height * scale));
    return "data:image/jpeg;base64," + toBase64(await im.encodeJPEG(86));
  } catch (e) {
    if (String((e as Error)?.message) === "too_small") throw e;
    const m = /^image\/(jpeg|png|webp|gif)/.exec(type);
    if (m && bytes.length <= 3_700_000) return "data:image/" + m[1] + ";base64," + toBase64(bytes);
    console.warn("Could not re-encode linked photo", e);
    throw new Error("unreadable");
  }
}
// A link to a photo gives that photo; a link to a page gives up to
// LINK_MAX_PHOTOS of its product photos (jacket, trousers, other angles).
type LinkPage = { site: string; title: string; url: string };
function pageInfo(html: string, url: string): LinkPage {
  const meta = (name: string) => {
    const a = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]*content=[\"']([^\"']*)[\"']", "i").exec(html);
    const b = new RegExp("<meta[^>]+content=[\"']([^\"']*)[\"'][^>]*(?:property|name)=[\"']" + name + "[\"']", "i").exec(html);
    return ((a || b || [])[1] || "").trim();
  };
  const clean = (t: string) => t.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim().slice(0, 120);
  const host = new URL(url).hostname.replace(/^www\./, "");
  const title = clean(meta("og:title") || meta("twitter:title") || ((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || ""));
  return { site: clean(meta("og:site_name")) || host, title, url };
}
async function photosFromLink(link: string, room: number): Promise<{ photos: string[]; page: LinkPage | null }> {
  const res = await fetchChecked(link) as Response & { finalUrl: string };
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (!(type.includes("text/html") || type.includes("xhtml"))) return { photos: [await decodePhoto(res, type, 0)], page: null };
  const html = new TextDecoder().decode(await readCapped(res, 3_000_000));
  const page = pageInfo(html, res.finalUrl);
  const urls = pageImages(html, res.finalUrl).slice(0, 10);
  if (!urls.length) throw new Error("no_image_on_page");
  const got = await Promise.all(urls.map(async (u) => {
    try {
      const r = await fetchChecked(u);
      return await decodePhoto(r, (r.headers.get("content-type") || "").toLowerCase(), 250);
    } catch { return ""; }
  }));
  const photos = got.filter(Boolean).slice(0, Math.max(1, Math.min(room, LINK_MAX_PHOTOS)));
  if (!photos.length) throw new Error("no_image_on_page");
  return { photos, page };
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
  let linked: string[] = [];
  let page: LinkPage | null = null;
  const fromLink = !!body.imageUrl;
  if (fromLink && images.length < 3 + LINK_MAX_PHOTOS) {
    try {
      const got = await photosFromLink(String(body.imageUrl).trim().slice(0, 2000), 3 + LINK_MAX_PHOTOS - images.length);
      linked = got.photos;
      page = got.page;
      images.push(...linked);
    } catch (e) {
      console.warn("Photo link failed:", String(e));
      const why = String((e as Error)?.message || "");
      return json({
        error: "link",
        message: why === "bad_url" ? "That doesn't look like a web link. Please paste the full address, starting with https://."
          : why === "no_image_on_page" ? "We couldn't find a suit photo at that link. Please try another link."
          : why === "too_large" ? "That photo is too large. Please try another link, or save the photo and upload it."
          : "We couldn't open that link. Some sites block this. Please try another link, or save the photo and upload it.",
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
  const question = (linked.length > 1
      ? "These " + pics.length + " photos come from one web page (a shop or article). Most should show the same suit from different angles or details (the jacket, the trousers, the back); ignore any that show something else, like other products, models' faces or banners. Combine what the suit photos show. If none of them shows a suit, jacket or suit trousers, set isSuit to false. "
      : fromLink ? "This photo comes from a web link. If it does not show a suit, jacket or suit trousers, set isSuit to false. "
      : pics.length > 1 ? "These " + pics.length + " photos show the same suit from different angles or details (e.g. the jacket, the trousers, the back). Combine what they show. " : "") +
    "Match this suit to our options.\n\n" + stepText("JACKET STEPS", jacket) + "\n\n" + stepText("TROUSER STEPS", pants);
  try {
    const out = key
      ? await readWithClaude(key, pics, schema, question)
      : await readWithOpenAI(openaiKey, pics, schema, question);
    if (!out) return json({ photos: linked.length ? linked : undefined, page: page || undefined, isSuit: false, message: "Sorry, we couldn't read that photo. Please try another picture of a suit." });
    return json({ ok: true, result: out, photos: linked.length ? linked : undefined, page: page || undefined });
  } catch (err) {
    console.error("suit-from-photo failed:", err);
    return json({ error: "failed" }, 502);
  }
});
