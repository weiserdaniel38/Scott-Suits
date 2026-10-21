// Scott Suits -- talks to the factory's Kute Tailor Open API
// (https://platform.kutetailor.com/api) for the shop admin.
//
// How it's called: POST with
//   Authorization: Bearer <admin's sign-in token>   (the shop admin's page)
// or
//   x-webhook-secret: <WEBHOOK_SECRET>              (server-side jobs/tests)
// or the service role key as the Bearer token (Supabase dashboard tests)
// and a JSON body naming one action:
//   { action: "archive", name: "crafts", params: { ... } }
//       one of the factory's code lists (categories, crafts, specials, fits,
//       bodyMeasurements, finishedMeasurements, sizeTypes, standardSizes,
//       embroideries)
//   { action: "fabric", code: "DZZ0110" }   fabric photo, stock and price
//   { action: "stock", code: "DZZ0110" }    fabric stock only
//   { action: "status", orderNo: "..." }    production status + waybill
//   { action: "sync" }   saves every code list (crafts for each garment
//       category) into public.factory_codes and returns row counts. Can be
//       run from the Supabase dashboard's function "Test" button (service
//       role key).
// Everything here only reads from the factory; nothing is ordered or changed.
//
// Signing (the factory's "Signature Authentication"): each request carries
// X-OPENAPI-CLIENT-ID, -TIMESTAMP (ms), -NONCE and -SIGNATURE, where the
// signature is lowercase hex HMAC-SHA256(secret, clientId + timestamp +
// nonce + METHOD + path), with the path as documented (no /api prefix, no
// query string).
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   KUTE_CLIENT_ID        the factory platform username (from Get credentials)
//   KUTE_SIGNING_SECRET   the signing secret (from Get credentials)
//   WEBHOOK_SECRET        already set for the welcome email
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const BASE = "https://platform.kutetailor.com/api";

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization, x-webhook-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const ARCHIVES = new Set([
  "categories", "crafts", "specials", "fits", "bodyMeasurements",
  "finishedMeasurements", "sizeTypes", "standardSizes", "embroideries",
]);

async function hmacHex(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

// One signed call to the factory. `path` is the documented path, e.g.
// "/craft/openApi/archives/crafts"; query values go in `query`.
export async function kute(method: string, path: string, query: Record<string, string> = {}, body?: unknown) {
  const clientId = env("KUTE_CLIENT_ID");
  const secret = env("KUTE_SIGNING_SECRET");
  if (!clientId || !secret) throw new Error("KUTE_CLIENT_ID / KUTE_SIGNING_SECRET are not set");
  const ts = String(Date.now());
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const signature = await hmacHex(secret, clientId + ts + nonce + method.toUpperCase() + path);
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(BASE + path + (qs ? "?" + qs : ""), {
    method,
    headers: {
      "Accept": "application/json",
      "Accept-Language": "en_US",
      "X-OPENAPI-CLIENT-ID": clientId,
      "X-OPENAPI-TIMESTAMP": ts,
      "X-OPENAPI-NONCE": nonce,
      "X-OPENAPI-SIGNATURE": signature,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep the raw text
  }
  return { httpStatus: res.status, data };
}

// Every code in a code list tree (records nest under `children`).
function walk(nodes: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(nodes)) {
    for (const n of nodes as Record<string, unknown>[]) {
      out.push(n);
      walk(n.children, out);
    }
  }
  return out;
}

async function save(list: string, category: string, data: unknown) {
  const { error } = await supabase.from("factory_codes")
    .upsert({ list, category, data, fetched_at: new Date().toISOString() });
  if (error) throw new Error("saving " + list + ": " + error.message);
}

async function syncCodes() {
  const counts: Record<string, unknown> = {};
  for (const name of ARCHIVES) {
    if (name === "crafts") continue;
    const r = await kute("GET", "/craft/openApi/archives/" + name);
    await save(name, "", r.data);
    const d = (r.data as Record<string, unknown>)?.data;
    counts[name] = r.httpStatus === 200 && Array.isArray(d) ? walk(d).length : { httpStatus: r.httpStatus, data: r.data };
  }
  const cats = walk(((await supabase.from("factory_codes").select("data").eq("list", "categories").single()).data?.data as Record<string, unknown>)?.data);
  for (const c of cats) {
    const code = String(c.code || "");
    if (!code) continue;
    const r = await kute("GET", "/craft/openApi/archives/crafts", { categoryCode: code });
    await save("crafts", code, r.data);
    const d = (r.data as Record<string, unknown>)?.data;
    counts["crafts " + code] = Array.isArray(d) ? walk(d).length : { httpStatus: r.httpStatus };
  }
  return counts;
}

// The project's server-only keys: the legacy service role key and any new
// "sb_secret_..." keys (SUPABASE_SECRET_KEYS is a JSON object of them).
function serverKeys(): string[] {
  const keys = [env("SUPABASE_SERVICE_ROLE_KEY")];
  try {
    keys.push(...Object.values(JSON.parse(env("SUPABASE_SECRET_KEYS", "{}")) as string[]));
  } catch {
    // not set
  }
  return keys.filter(Boolean);
}

async function allowed(req: Request): Promise<boolean> {
  const hook = env("WEBHOOK_SECRET");
  if (hook && req.headers.get("x-webhook-secret") === hook) return true;
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (serverKeys().some((k) => k === m?.[1] || k === req.headers.get("apikey"))) return true;
  if (!m) return false;
  const { data: who } = await supabase.auth.getUser(m[1]);
  if (!who?.user) return false;
  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
  return !!adminRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let input: Record<string, unknown> = {};
  try {
    input = await req.json();
  } catch {
    return json({ error: "send a JSON body" }, 400);
  }
  if (!(await allowed(req))) {
    // Which kind of key was sent (never the key itself), to debug dashboard tests.
    const a = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    console.log("kute-factory 403, key kind:", a.startsWith("eyJ") ? "jwt" : a.slice(0, 10), "apikey kind:", (req.headers.get("apikey") || "").slice(0, 10));
    return json({ error: "only the shop admin can use this" }, 403);
  }
  const str = (v: unknown) => String(v ?? "").trim();
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries((input.params as Record<string, unknown>) || {})) params[k] = str(v);

  try {
    switch (input.action) {
      case "archive": {
        const name = str(input.name);
        if (!ARCHIVES.has(name)) return json({ error: "unknown code list " + name }, 400);
        return json(await kute("GET", "/craft/openApi/archives/" + name, params));
      }
      case "fabric":
        return json(await kute("GET", "/fabric/fabric/queryFabric", { fabricCode: str(input.code) }));
      case "stock":
        return json(await kute("GET", "/order/stock/" + encodeURIComponent(str(input.code))));
      case "sync":
        return json(await syncCodes());
      case "status":
        return json(await kute("GET", "/order/status/" + encodeURIComponent(str(input.orderNo))));
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
