// fabric-label: admin Fabric Search "Search by photo" (Daniel, 2026-11-11).
//
// The shop admin photographs a factory swatch label (or a few labels) and
// the site sends the downsized photo here. The site's OpenAI key reads the
// label text and returns the Fabric No. codes it sees (e.g. DBV5315), plus
// any book or swatch numbers (26SU127). main.js then runs the normal Fabric
// Search on those codes. Admin only (checked against the admins table), so
// it can't be used as a free OCR service, and nothing is stored.
//
// Secrets: OPENAI_API_KEY (already set for the picture generator).
// Optional: FABRIC_LABEL_OPENAI_MODEL (default gpt-5.2).
// Deploy with verify_jwt false (the workflow does); POST {"ping":true} ->
// {"ok":true,"ready":bool}.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || "").trim() || d;
const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function isAdmin(req: Request): Promise<boolean> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const { data: who } = await supabase.auth.getUser(m[1]);
  if (!who?.user) return false;
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
  return !!data;
}

const SCHEMA = {
  type: "object",
  properties: {
    fabricNumbers: {
      type: "array",
      items: { type: "string" },
      description: "Every fabric number / article code printed on the label(s), exactly as printed, e.g. DBV5315, DZZ0102, DBV402A. Usually 3 letters then 4 characters.",
    },
    otherNumbers: {
      type: "array",
      items: { type: "string" },
      description: "Book, swatch or item numbers that are not the fabric number, e.g. 26SU127 or SU127.",
    },
    text: { type: "string", description: "All the label text you can read, one line per label line." },
  },
  required: ["fabricNumbers", "otherNumbers", "text"],
  additionalProperties: false,
};

const PROMPT =
  "This is a photo of one or more fabric swatch labels from a suit cloth factory (Kute / Kutesmart sample books). " +
  "Read the labels. The fabric number is usually next to 'Fabric No.', 'Article', 'Code' or 'Item' and looks like DBV5315, DZZ0102, DBV402A, DGG1132 or DPP0193. " +
  "Book numbers look like 26SU127 or SU127. Copy codes exactly; take care with 0/O, 1/I, 5/S and 8/B (codes start with letters and end in digits, sometimes with one final letter). " +
  "If no label is readable, return empty lists.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "send a JSON body" }, 400);
  }
  const key = env("OPENAI_API_KEY");
  if (body && body.ping) return json({ ok: true, ready: !!key });
  if (!key) return json({ error: "not_ready" }, 503);
  if (!(await isAdmin(req))) return json({ error: "only the shop admin can use this" }, 403);
  const image = String(body && body.image || "");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 6_000_000) {
    return json({ error: "send one photo as a JPEG data URL" }, 400);
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({
        model: env("FABRIC_LABEL_OPENAI_MODEL", "gpt-5.2"),
        response_format: { type: "json_schema", json_schema: { name: "fabric_label", strict: true, schema: SCHEMA } },
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image, detail: "high" } }] }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error("OpenAI " + res.status + " " + (await res.text()).slice(0, 300));
    const msg = (await res.json())?.choices?.[0]?.message;
    if (!msg || msg.refusal) return json({ fabricNumbers: [], otherNumbers: [], text: "" });
    const out = JSON.parse(msg.content || "{}");
    const clean = (a: unknown) => Array.isArray(a) ? [...new Set(a.map((x) => String(x).toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((x) => x.length >= 4 && x.length <= 16))].slice(0, 20) : [];
    return json({ fabricNumbers: clean(out.fabricNumbers), otherNumbers: clean(out.otherNumbers), text: String(out.text || "").slice(0, 2000) });
  } catch (e) {
    console.error(e);
    return json({ error: "couldn't read the photo" }, 502);
  }
});
