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
//   { action: "factory_preview", id, height, heightUnit, weight, weightUnit }
//       the factory order one suit (orders row id) would make, with
//       warnings; nothing is sent
//   { action: "factory_draft", ...same }  saves that suit as a DRAFT order
//       on the factory site (submit is always false; the admin submits it
//       there) and keeps the factory's order number on the row. Sending
//       again updates the same draft.
//   { action: "factory_status", id }  the suit's factory status; moves the
//       order's shipping step forward to match
//   { action: "factory_status_all" }  factory_status for every suit still
//       at the factory; run once a day by pg_cron (see
//       supabase/sql/15_factory_status_daily.sql), which signs in with the
//       x-cron-token header and may run only this action
//   { action: "sync" }   saves every code list (crafts for each garment
//       category) into public.factory_codes and returns row counts. Can be
//       run from the Supabase dashboard's function "Test" button (service
//       role key).
// Nothing here submits an order: factory_draft only saves drafts.
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
import { buildFactoryOrder, FACTORY_STAGE, SHIPPING_ORDER, type Catalog, type EmbCodes, type SizeRanges } from "./order.ts";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const BASE = "https://platform.kutetailor.com/api";

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization, x-webhook-secret, x-cron-token",
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

// Code lists that don't depend on the garment, and those fetched once per
// garment category (categoryCode), e.g. MXF jacket, MXK trousers.
const GLOBAL_LISTS = ["categories", "sizeTypes"];
const PER_CATEGORY = ["crafts", "specials", "fits", "bodyMeasurements", "finishedMeasurements", "standardSizes", "embroideries"];

async function syncCodes() {
  const counts: Record<string, unknown> = {};
  const count = (r: { httpStatus: number; data: unknown }) => {
    const d = (r.data as Record<string, unknown>)?.data;
    return r.httpStatus === 200 && Array.isArray(d) ? walk(d).length : { httpStatus: r.httpStatus };
  };
  let categories: Record<string, unknown>[] = [];
  for (const name of GLOBAL_LISTS) {
    const r = await kute("GET", "/craft/openApi/archives/" + name);
    await save(name, "", r.data);
    counts[name] = count(r);
    if (name === "categories") categories = walk((r.data as Record<string, unknown>)?.data);
  }
  for (const c of categories) {
    const code = String(c.code || "");
    if (!code) continue;
    await Promise.all(PER_CATEGORY.map(async (name) => {
      const r = await kute("GET", "/craft/openApi/archives/" + name, { categoryCode: code });
      await save(name, code, r.data);
      counts[name + " " + code] = count(r);
    }));
  }
  return counts;
}

// The live site's catalog.js (option names and their factory codes).
async function loadCatalog(): Promise<{ jacket: Catalog; pants: Catalog }> {
  const url = env("SITE_URL", "https://scottssuits.com").replace(/\/$/, "") + "/catalog.js?t=" + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error("couldn't load the site catalog (" + res.status + ")");
  const src = await res.text();
  const got = new Function("window", "document", src + "\n;return { jacket: JACKET_CATALOG, pants: PANTS_CATALOG };")({}, {});
  return got as { jacket: Catalog; pants: Catalog };
}

async function loadEmbCodes(): Promise<{ MXF?: EmbCodes; MXK?: EmbCodes }> {
  const { data } = await supabase.from("factory_codes").select("category, data").eq("list", "embroideries").in("category", ["MXF", "MXK"]);
  const out: Record<string, EmbCodes> = {};
  for (const r of data || []) {
    const d = (r.data as Record<string, any>)?.data || {};
    out[r.category] = { fonts: d.fonts || [], colors: d.colors || [] };
  }
  return out;
}

// The factory's allowed range for each measurement position, for body or
// finished measurements.
async function loadSizeRanges(body: boolean): Promise<{ MXF?: SizeRanges; MXK?: SizeRanges }> {
  const { data } = await supabase.from("factory_codes").select("category, data")
    .eq("list", body ? "bodyMeasurements" : "finishedMeasurements").in("category", ["MXF", "MXK"]);
  const out: Record<string, SizeRanges> = {};
  for (const r of data || []) {
    const list = ((r.data as Record<string, any>)?.data || []) as Record<string, any>[];
    const ranges: SizeRanges = {};
    for (const p of list) {
      const code = String(p.positionCode || "");
      const min = Number(p.minValue), max = Number(p.maxValue);
      // Some positions are listed twice (long and short sleeve): keep the widest.
      if (!code || !isFinite(min) || !isFinite(max)) continue;
      const had = ranges[code];
      ranges[code] = had
        ? { name: had.name, min: Math.min(had.min, min), max: Math.max(had.max, max) }
        : { name: String(p.positionName || code).trim(), min, max };
    }
    out[r.category] = ranges;
  }
  return out;
}

async function loadRow(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("unknown suit");
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("unknown suit");
  return data as Record<string, unknown>;
}

async function factoryOrder(input: Record<string, unknown>) {
  const row = await loadRow(String(input.id || ""));
  const [{ jacket, pants }, emb, ranges] = await Promise.all([
    loadCatalog(), loadEmbCodes(), loadSizeRanges(String(row.measure_type || "") === "body"),
  ]);
  // The customer's own height (inches) and weight (pounds) from the order,
  // unless the admin typed others in.
  const typedHeight = Number(input.height) || 0;
  const typedWeight = Number(input.weight) || 0;
  const built = buildFactoryOrder({
    row, jacket, pants, emb, ranges,
    height: typedHeight || Number(row.height) || 0,
    heightUnit: typedHeight ? (input.heightUnit === "cm" ? "cm" : "in") : "in",
    weight: typedWeight || Number(row.weight) || 0,
    weightUnit: typedWeight ? (input.weightUnit === "kg" ? "kg" : "lb") : "lb",
    orderNo: String(row.factory_order_no || ""),
  });
  return { row, ...built };
}

async function saveDraft(input: Record<string, unknown>) {
  const { row, body, warnings, blocking } = await factoryOrder(input);
  if (blocking.length) return { ok: false, blocking, warnings };
  body.submit = false; // never submit from here
  let r = await kute("POST", "/order/saveOrder", {}, body);
  let res = (r.data || {}) as Record<string, any>;
  let d = res.data || {};
  let ok = r.httpStatus === 200 && String(res.code) === "0" && !!d.orderNo;
  if (!ok && body.orderNo) {
    // The earlier draft may have been deleted on the factory site: save a new one.
    body.orderNo = "";
    r = await kute("POST", "/order/saveOrder", {}, body);
    res = (r.data || {}) as Record<string, any>;
    d = res.data || {};
    ok = r.httpStatus === 200 && String(res.code) === "0" && !!d.orderNo;
  }
  const err = ok ? (d.errorMessage || null) : (d.errorMessage || res.msg || res.message || "factory said " + r.httpStatus + " " + JSON.stringify(res).slice(0, 300));
  const update: Record<string, unknown> = { factory_error: err, factory_sent_at: new Date().toISOString() };
  if (ok) {
    update.factory_order_no = d.orderNo;
    update.factory_status = "Draft";
    update.factory_delivery_date = d.deliveryDate || null;
  }
  await supabase.from("orders").update(update).eq("id", row.id);
  return { ok, orderNo: d.orderNo || row.factory_order_no || null, deliveryDate: d.deliveryDate || null, error: err, warnings };
}

async function factoryStatus(id: string) {
  const row = await loadRow(id);
  const orderNo = String(row.factory_order_no || "");
  if (!orderNo) return { ok: false, error: "not sent to the factory yet" };
  const r = await kute("GET", "/order/status/" + encodeURIComponent(orderNo));
  const res = (r.data || {}) as Record<string, any>;
  const d = res.data || {};
  if (r.httpStatus !== 200 || String(res.code) !== "0") {
    return { ok: false, error: res.msg || res.message || "factory said " + r.httpStatus };
  }
  const update: Record<string, unknown> = {
    factory_status: d.statusName || String(d.status || ""),
    factory_delivery_date: d.deliveryDate || row.factory_delivery_date || null,
    factory_waybill: d.waybillNo || null,
  };
  // Move the customer's shipping step forward (never back) to match.
  const stage = FACTORY_STAGE[String(d.status)];
  const current = String(row.shipping_status || "");
  // Like the admin's own shipping updates, the step is set for the whole
  // order. No email or text goes out; the admin's Save button does that.
  const moved = !!stage && SHIPPING_ORDER.indexOf(stage) > SHIPPING_ORDER.indexOf(current);
  await supabase.from("orders").update(update).eq("id", row.id);
  if (moved) {
    await supabase.from("orders").update({ shipping_status: stage, shipping_updated_at: new Date().toISOString() })
      .eq("order_id", row.order_id);
  }
  return { ok: true, status: update.factory_status, deliveryDate: update.factory_delivery_date, waybill: update.factory_waybill, shippingStatus: moved ? stage : current || null };
}

// Every suit sent to the factory and not yet shipped from it: refresh its
// factory status (the daily job).
async function factoryStatusAll() {
  const { data, error } = await supabase.from("orders").select("id, shipping_status")
    .not("factory_order_no", "is", null).limit(200);
  if (error) throw new Error(error.message);
  const atFactory = new Set(["", "received", "sent_to_factory", "cutting", "sewing", "finishing"]);
  const rows = (data || []).filter((r) => atFactory.has(String(r.shipping_status || "")));
  let updated = 0, failed = 0;
  for (const r of rows) {
    const out = await factoryStatus(String(r.id)).catch((e) => ({ ok: false, error: String(e) }));
    if (out.ok) updated++;
    else failed++;
  }
  return { ok: true, checked: rows.length, updated, failed };
}

// The daily job's token: made inside the database by
// 15_factory_status_daily.sql and never shown to anyone.
async function cronAllowed(req: Request): Promise<boolean> {
  const sent = req.headers.get("x-cron-token") || "";
  if (sent.length < 32) return false;
  const { data } = await supabase.from("job_tokens").select("token").eq("name", "kute-factory-status").maybeSingle();
  return !!data?.token && data.token === sent;
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
  if (!who?.user) {
    // Not a user: accept it only if it works as a service role key (the
    // auth admin API refuses every other key).
    const asKey = createClient(env("SUPABASE_URL"), m[1], { auth: { persistSession: false } });
    const { error } = await asKey.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  }
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
  const byCron = input.action === "factory_status_all" && (await cronAllowed(req));
  if (!byCron && !(await allowed(req))) {
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
      case "factory_preview": {
        const { body, warnings, blocking } = await factoryOrder(input);
        return json({ body, warnings, blocking });
      }
      case "factory_draft":
        return json(await saveDraft(input));
      case "factory_status":
        return json(await factoryStatus(str(input.id)));
      case "factory_status_all":
        return json(await factoryStatusAll());
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
