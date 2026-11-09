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

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
