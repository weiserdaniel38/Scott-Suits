// admin-notices: keeps the "suit finished" and "fabric back in stock"
// notifications in My Account > Notifications the same on every device
// (Daniel 2026-11-03: "show time and date sent notification, if cleared on
// any device shouldnt show up on other devices").
//
// State lives in admin-notices.json in the private admin-private storage
// bucket (made here if missing), because new tables can't be added right
// now: { notices: { "<kind>:<key>": { sent_at, cleared_at } } }
//   kind "suit_done"   key = the suit's factory order number
//   kind "fabric_wait" key = "<factory order no>|<fabric value>"
// "Sent" is the first time a notice was seen: by the admin's page (it
// refreshes hourly while open), or by a "record" run. A pg_cron job could
// call "record" hourly for exact finish times; it isn't scheduled yet.
//
// Actions (POST JSON):
//   { action: "record" }                        anyone (cron); only adds
//       first-seen times for suits whose factory status is finished.
//   { action: "list", keys: ["suit_done:X"...] } admin; adds any missing
//       keys with now and returns { notices: { key: {sent_at, cleared_at} } }.
//   { action: "clear", keys: [...] }             admin; marks them cleared.
// Order notifications keep using admin_notifications (supabase/sql/16, 17).

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string) => (Deno.env.get(k) || "").trim();
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

const BUCKET = "admin-private";
const FILE = "admin-notices.json";
const FINISHED = ["Stocked", "On Delivery", "Signed", "Delivered"];
const KEY_RE = /^(suit_done|fabric_wait):[A-Za-z0-9._|\- ]{1,120}$/;

type Notice = { sent_at: string; cleared_at: string | null };
type State = { notices: Record<string, Notice> };

async function load(): Promise<State> {
  const { data, error } = await supabase.storage.from(BUCKET).download(FILE);
  if (error || !data) {
    // Missing bucket or file: start empty (bucket made on first save). Any
    // other failure stops here, so a hiccup never wipes saved clears.
    const { data: files, error: listErr } = await supabase.storage.from(BUCKET).list("", { search: FILE });
    const bucketMissing = !!listErr && /not.?found/i.test(listErr.message);
    if (bucketMissing || (!listErr && !(files || []).some((f) => f.name === FILE))) return { notices: {} };
    throw new Error("couldn't read notices: " + (error?.message || "empty file"));
  }
  try {
    const s = JSON.parse(await data.text());
    return { notices: s && typeof s.notices === "object" && s.notices ? s.notices : {} };
  } catch {
    throw new Error("admin-notices.json is unreadable");
  }
}

async function save(s: State) {
  const body = new Blob([JSON.stringify(s)], { type: "application/json" });
  let { error } = await supabase.storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: "application/json" });
  if (error) {
    await supabase.storage.createBucket(BUCKET, { public: false });
    ({ error } = await supabase.storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: "application/json" }));
  }
  if (error) throw new Error("couldn't save notices: " + error.message);
}

// Adds first-seen times for keys not stored yet. Returns true if any were new.
function addKeys(s: State, keys: string[], now: string): boolean {
  let changed = false;
  for (const k of keys) {
    if (!s.notices[k]) {
      s.notices[k] = { sent_at: now, cleared_at: null };
      changed = true;
    }
  }
  return changed;
}

async function finishedSuitKeys(): Promise<string[]> {
  const { data, error } = await supabase.from("orders").select("factory_order_no")
    .in("factory_status", FINISHED).not("factory_order_no", "is", null);
  if (error) throw new Error(error.message);
  return [...new Set((data || []).map((r) => "suit_done:" + r.factory_order_no))];
}

async function isAdmin(req: Request): Promise<boolean> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const { data: who } = await supabase.auth.getUser(m[1]);
  if (!who?.user) return false;
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
  return !!data;
}

const cleanKeys = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x ?? "").trim()).filter((k) => KEY_RE.test(k)))].slice(0, 500) : [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let input: Record<string, unknown> = {};
  try {
    input = await req.json();
  } catch {
    return json({ error: "send a JSON body" }, 400);
  }
  try {
    const now = new Date().toISOString();
    if (input.action === "record") {
      const s = await load();
      const changed = addKeys(s, await finishedSuitKeys(), now);
      if (changed) await save(s);
      return json({ ok: true, changed });
    }
    if (!(await isAdmin(req))) return json({ error: "only the shop admin can use this" }, 403);
    const keys = cleanKeys(input.keys);
    if (input.action === "list") {
      const s = await load();
      let changed = addKeys(s, keys.filter((k) => k.startsWith("fabric_wait:")), now);
      // Suits only count once the factory says finished.
      const done = new Set(await finishedSuitKeys());
      changed = addKeys(s, keys.filter((k) => done.has(k)), now) || changed;
      if (changed) await save(s);
      const out: Record<string, Notice> = {};
      for (const k of keys) if (s.notices[k]) out[k] = s.notices[k];
      return json({ notices: out });
    }
    if (input.action === "clear") {
      const s = await load();
      for (const k of keys) {
        s.notices[k] = s.notices[k] || { sent_at: now, cleared_at: null };
        if (!s.notices[k].cleared_at) s.notices[k].cleared_at = now;
      }
      if (keys.length) await save(s);
      return json({ ok: true, cleared: keys.length });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
