// Scott Suits -- measurements added after ordering (Daniel, 2026-11-09).
//
// A suit can go in the cart from the Preview page before measuring. If the
// customer pays before adding them, the order row is saved with
// measure_type = 'pending' (no sizes) and kute-factory refuses it. This
// function lets the customer add them later from My Account > Past Orders.
// Customers can't update order rows themselves (RLS), so it checks the
// caller and writes with the service role.
//
//   { action: "save", order_id, suit_number, measurements, measurements_text }
//       Signed-in customer (Authorization: Bearer <their token>) who owns the
//       order, or the shop admin. Only while the suit is still 'pending' and
//       not at the factory. Writes the sizes, measure_type and fits, and puts
//       measurements_text in the order text in place of the "NOT GIVEN YET"
//       line. -> { ok: true }
//   { action: "pending" }
//       Shop admin only. -> { ok: true, suits: [{ order_id, suit_number }] }
//       for the admin page's "Waiting for measurements" tags.
//
// Measure a Client (Daniel, 2026-11-17: "an option for me when I measure
// clients"). Shop admin only; My Account > Measure a Client.
//   { action: "find_clients", q, offset }
//       -> { ok, clients: [{ id, email, name, measurements }], total, more }
//       20 at a time from offset, newest first, matching email or name.
//       Empty q = every account. Test accounts never show (isTestAccount;
//       Daniel, 2026-11-17).
//   { action: "save_client", user_id, measurements }
//       Merges the numbers into that client's saved measurements (same
//       merge as the site's own save), so their cart and next suits use
//       them. -> { ok, measurements }
//   { action: "create_client", email, full_name }
//       Client with no account yet: makes one with no password. They get the
//       usual welcome email (auth trigger) and sign in later with Google or
//       "Forgot password".
//       -> { ok, client }
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
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

// Same ids as MEASUREMENTS in catalog.js (each one is an orders column).
export const MEASUREMENT_COLUMNS = [
  "height", "weight", "shoulder", "sleeve_length", "wrist", "chest", "stomach", "front_jacket", "back_jacket",
  "bicep", "hips", "waist", "leg_length", "crotch", "thigh", "knee", "calf", "cuff",
  "body_neck", "body_chest", "body_stomach", "body_seat", "body_bicep", "body_shoulder", "body_sleeve",
  "body_nape_waist", "body_back_length", "body_front_waist", "body_waist", "body_thigh", "body_u_rise",
  "body_front_waist_h", "body_back_waist_h", "body_outseam",
];
const FITS = ["Slim", "Regular", "Loose"];
// The line the website writes in the order text while measurements are missing.
export const PENDING_LINE = "NOT GIVEN YET -- the customer will add them from My Account. Do not send to the factory until they do.";

// The columns to write, or an error. Needs at least the core sizes a suit
// can't be made without (the website checks every field and range itself).
export function measurementUpdate(m: Record<string, unknown>): { update?: Record<string, unknown>; error?: string } {
  if (!m || typeof m !== "object") return { error: "no measurements" };
  const type = m.measure_type === "body" ? "body" : m.measure_type === "finished" ? "finished" : null;
  if (!type) return { error: "measure_type must be finished or body" };
  const update: Record<string, unknown> = { measure_type: type };
  let sizes = 0;
  for (const col of MEASUREMENT_COLUMNS) {
    if (m[col] === undefined || m[col] === null || m[col] === "") continue;
    const v = Number(m[col]);
    if (!isFinite(v) || v <= 0 || v >= 1000) return { error: "bad value for " + col };
    update[col] = v;
    if (col !== "height" && col !== "weight") sizes++;
  }
  if (!sizes) return { error: "no measurements" };
  for (const k of ["jacket_fit", "pants_fit"]) {
    if (m[k] === undefined || m[k] === null || m[k] === "") continue;
    if (!FITS.includes(String(m[k]))) return { error: "bad " + k };
    update[k] = String(m[k]);
  }
  return { update };
}

// The order text with the "NOT GIVEN YET" line swapped for the measurements.
export function filledText(text: string, measurementsText: string): string {
  const t = String(text || "");
  const add = String(measurementsText || "").slice(0, 6000).trim();
  if (!add) return t;
  if (t.includes(PENDING_LINE)) return t.replace(PENDING_LINE, add);
  return t + "\n\nMEASUREMENTS (added after ordering)\n" + add;
}

async function caller(req: Request) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const { data } = await supabase.auth.getUser(m[1]);
  if (!data?.user) return null;
  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return { id: data.user.id, admin: !!adminRow };
}

// ---- Measure a Client (admin) ----
type Client = { id: string; email: string; name: string; measurements: Record<string, unknown> | null };

async function allUsers() {
  const out: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    out.push(...(data?.users || []));
    if (!data?.users || data.users.length < 1000) break;
  }
  return out;
}

// Test accounts (Daniel, 2026-11-17: "do not show any test orders
// accounts"). Kept out of Measure a Client. Same rule as
// adminIsTestAccount in main.js (admin order lists); change both together.
export const TEST_EMAILS = [
  "never@gmail.com", "test@test.com", "dhdbbd@gmail.com", "ghfghh@gmail.com", "jhebnckew@gmail.com",
];
export function isTestAccount(email: string): boolean {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (TEST_EMAILS.includes(e)) return true;
  // Email-delivery test inboxes and placeholder domains.
  if (/@(resend\.dev|example\.(com|org|net)|test\.com)$/.test(e)) return true;
  return false;
}

export function clientName(meta: Record<string, unknown> | undefined, profileName: unknown): string {
  const m = meta || {};
  return String(profileName || m.full_name || m.name || [m.given_name, m.family_name].filter(Boolean).join(" ") || "").trim();
}

// Only the measurement ids, measure_type and fits, with sane numbers.
export function cleanClientMeasurements(m: Record<string, unknown>): { values?: Record<string, unknown>; error?: string } {
  if (!m || typeof m !== "object") return { error: "no measurements" };
  const values: Record<string, unknown> = {};
  for (const col of MEASUREMENT_COLUMNS) {
    if (m[col] === undefined || m[col] === null || m[col] === "") continue;
    const v = Number(m[col]);
    if (!isFinite(v) || v <= 0 || v >= 1000) return { error: "bad value for " + col };
    values[col] = v;
  }
  if (!Object.keys(values).length) return { error: "no measurements" };
  if (m.measure_type === "body" || m.measure_type === "finished") values.measure_type = m.measure_type;
  for (const k of ["jacket_fit", "pants_fit"]) {
    if (m[k] && FITS.includes(String(m[k]))) values[k] = String(m[k]);
  }
  return { values };
}

async function clientAction(input: Record<string, unknown>) {
  if (input.action === "find_clients") {
    const q = String(input.q || "").trim().toLowerCase().slice(0, 100);
    const users = await allUsers();
    const { data: profiles, error } = await supabase.from("profiles").select("id, email, full_name, measurements").limit(5000);
    if (error) throw new Error(error.message);
    const byId = new Map((profiles || []).map((p) => [p.id, p]));
    const list = users
      .map((u) => {
        const p = byId.get(u.id) || {};
        return {
          id: u.id,
          email: String(u.email || (p as { email?: string }).email || ""),
          name: clientName(u.user_metadata, (p as { full_name?: string }).full_name),
          measurements: ((p as { measurements?: Record<string, unknown> }).measurements) || null,
          created: u.created_at || "",
        };
      })
      .filter((c) => !isTestAccount(c.email))
      .filter((c) => !q || c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
    const offset = Math.max(0, Math.floor(Number(input.offset) || 0));
    const PAGE = 20;
    const clients = list.slice(offset, offset + PAGE).map(({ created: _c, ...c }) => c as Client);
    return { ok: true, clients, total: list.length, more: offset + PAGE < list.length };
  }

  if (input.action === "save_client") {
    const id = String(input.user_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "user_id missing" };
    const { values, error: bad } = cleanClientMeasurements((input.measurements || {}) as Record<string, unknown>);
    if (!values) return { error: bad };
    const { data: user, error: uErr } = await supabase.auth.admin.getUserById(id);
    if (uErr || !user?.user) return { error: "That client couldn't be found." };
    const { data: p } = await supabase.from("profiles").select("measurements").eq("id", id).maybeSingle();
    const merged = Object.assign({}, (p?.measurements as Record<string, unknown>) || {}, values);
    const { error } = await supabase.from("profiles").upsert({
      id,
      email: user.user.email,
      measurements: merged,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, measurements: merged };
  }

  if (input.action === "create_client") {
    const email = String(input.email || "").trim().toLowerCase();
    const name = String(input.full_name || "").trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: name ? { full_name: name } : {},
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return { error: "That email already has an account. Search for it above." };
      throw new Error(error.message);
    }
    const id = data.user!.id;
    await supabase.from("profiles").upsert({ id, email, full_name: name || null, updated_at: new Date().toISOString() });
    return { ok: true, client: { id, email, name, measurements: null } };
  }
  return { error: "unknown action" };
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
  const who = await caller(req);
  if (!who) return json({ error: "Please sign in again." }, 401);

  try {
    if (input.action === "pending") {
      if (!who.admin) return json({ error: "only the shop admin can use this" }, 403);
      const { data, error } = await supabase.from("orders").select("order_id, suit_number").eq("measure_type", "pending").limit(2000);
      if (error) throw new Error(error.message);
      return json({ ok: true, suits: data || [] });
    }

    if (input.action === "save") {
      const orderId = String(input.order_id || "");
      const suitNumber = Number(input.suit_number) || 1;
      if (!orderId) return json({ error: "order_id missing" }, 400);
      const { data: row, error } = await supabase.from("orders")
        .select("id, user_id, measure_type, factory_order_no, client_form_text")
        .eq("order_id", orderId).eq("suit_number", suitNumber).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row || (!who.admin && row.user_id !== who.id)) return json({ error: "That order couldn't be found." }, 404);
      if (row.measure_type !== "pending") return json({ error: "This suit already has its measurements. Contact us to change them." }, 409);
      if (row.factory_order_no) return json({ error: "This suit is already with the factory. Contact us to change it." }, 409);
      const { update, error: bad } = measurementUpdate((input.measurements || {}) as Record<string, unknown>);
      if (!update) return json({ error: bad }, 400);
      update.client_form_text = filledText(String(row.client_form_text || ""), String(input.measurements_text || ""));
      const { error: upErr } = await supabase.from("orders").update(update).eq("id", row.id).eq("measure_type", "pending");
      if (upErr) throw new Error(upErr.message);
      return json({ ok: true });
    }

    if (input.action === "find_clients" || input.action === "save_client" || input.action === "create_client") {
      if (!who.admin) return json({ error: "only the shop admin can use this" }, 403);
      return json(await clientAction(input));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
