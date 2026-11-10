// Scott Suits -- buys the shipping label for an order through Shippo, from
// the admin's All Orders list (Daniel, 2026-11-10: "automate shipping").
//
// Only an account in public.admins can call it (Authorization: Bearer <the
// admin's sign-in token>). Nothing is ever bought without the admin tapping
// "Buy label" for a rate they were shown.
//
//   { action: "quote", order_id, length?, width?, height?, weight? }
//     -> { mode, address, address_ok, address_notes, parcel, rates, labels }
//     Checks the order's shipping address with Shippo and lists carrier
//     rates, cheapest first, for one package. The package defaults to one
//     box (LABEL_BOX_IN) at LABEL_LB_PER_SUIT pounds per suit; the
//     admin can change the size and weight before quoting again.
//   { action: "buy", order_id, rate_id, again? }
//     -> { ok, label_url, tracking_number, carrier, cost_usd, notified }
//     Buys that rate (4x6 PDF label), saves it in public.shipping_labels
//     (supabase/sql/40_shipping_labels.sql) with what it really cost, puts
//     the tracking number on the order, moves it to "Shipped to you" and
//     emails the customer through send-shipping-update. Refuses a second
//     label for the same order unless again is true.
//   { action: "refund", label_id }
//     -> { ok, status }
//     Asks Shippo to refund (void) an unused label. The order goes back to
//     "Final inspection with us" and its tracking number is cleared.
//
// A Shippo test key (shippo_test_...) gives free sample labels: those are
// saved with test_mode = true and never change the order or email anyone.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   SHIPPO_API_KEY      required -- already set for checkout shipping quotes
//   LABEL_BOX_IN        optional, default "15x12x10" -- the box, inches (Daniel, 2026-11-10)
//   LABEL_LB_PER_SUIT   optional, default "3.25" -- pounds per suit, hanger included (2 suits = 6 lb 8 oz)
//   SHIP_FROM_PHONE     optional -- the shop's phone, some carriers want one
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SHIPPO_KEY = env("SHIPPO_API_KEY");
const BOX_IN = env("LABEL_BOX_IN", "15x12x10").split(/x/i).map((n) => Number(n.trim()) || 0);
const LB_PER_SUIT = Number(env("LABEL_LB_PER_SUIT", "3.25")) || 3.25;

// Where suits are shipped from (same as stripe-checkout).
export const SHIP_FROM = {
  name: "Scott Suits",
  company: "Scott Suits",
  street1: "38 Parson Road",
  city: "Clifton",
  state: "NJ",
  zip: "07012",
  country: "US",
  email: "hello@scottssuits.com",
  phone: env("SHIP_FROM_PHONE"),
};

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

export const shippoMode = (key = SHIPPO_KEY) => (key.startsWith("shippo_test_") ? "test" : key ? "live" : "none");

async function shippo(method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch("https://api.goshippo.com/" + path, {
    method,
    headers: { authorization: "ShippoToken " + SHIPPO_KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Shippo " + res.status + ": " + JSON.stringify(data).slice(0, 300));
  return data as Record<string, any>;
}

// Names the tracking links on the site and in the email know (main.js and
// send-shipping-update trackingUrl).
export function carrierName(provider: string): string {
  const p = String(provider || "").toLowerCase();
  if (p.startsWith("usps")) return "USPS";
  if (p.startsWith("ups")) return "UPS";
  if (p.startsWith("fedex")) return "FedEx";
  if (p.startsWith("dhl")) return "DHL";
  return String(provider || "Other");
}

// One package for the whole order: suits are 3.25 lb each with the hanger,
// a jacket or pants on their own a little less.
export function defaultWeight(suitTypes: string[]): number {
  const lb = suitTypes.reduce((t, s) => t + (s === "pants_only" ? LB_PER_SUIT / 2 : s === "jacket_only" ? LB_PER_SUIT * 0.8 : LB_PER_SUIT), 0);
  return Math.max(1, Math.round(lb * 10) / 10);
}

export function cleanParcel(p: Record<string, unknown>, fallbackLb: number) {
  const num = (v: unknown, d: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : d;
  };
  return {
    length: num(p.length, BOX_IN[0] || 15, 108),
    width: num(p.width, BOX_IN[1] || 12, 108),
    height: num(p.height, BOX_IN[2] || 10, 108),
    weight: num(p.weight, fallbackLb, 150),
  };
}

// Rates a clothing parcel can use, cheapest first. Media/Library Mail is
// for books only.
export function sortRates(rates: Record<string, any>[]) {
  return (rates || [])
    .filter((r) => r.currency === "USD" && Number(r.amount) > 0)
    .filter((r) => !/media_mail|library_mail/i.test((r.servicelevel && r.servicelevel.token) || ""))
    .map((r) => ({
      id: String(r.object_id),
      carrier: carrierName(r.provider),
      service: String((r.servicelevel && r.servicelevel.name) || ""),
      amount: Math.round(Number(r.amount) * 100) / 100,
      days: r.estimated_days || null,
    }))
    .sort((a, b) => a.amount - b.amount);
}

type OrderRow = Record<string, any>;

async function loadOrder(orderId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, suit_number, suit_type, customer_name, customer_email, customer_phone, fulfillment, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip, shipping_country, shipping_status, tracking_number")
    .eq("order_id", orderId)
    .order("suit_number");
  if (error) throw new Error(error.message);
  return data || [];
}

function addressTo(r: OrderRow) {
  return {
    name: String(r.customer_name || "Customer"),
    street1: String(r.shipping_address_line1 || ""),
    street2: String(r.shipping_address_line2 || ""),
    city: String(r.shipping_city || ""),
    state: String(r.shipping_state || ""),
    zip: String(r.shipping_zip || ""),
    country: "US",
    phone: String(r.customer_phone || ""),
    email: String(r.customer_email || ""),
  };
}

function isUS(country: string) {
  const c = String(country || "").trim().toLowerCase();
  return !c || c === "us" || c === "usa" || c === "united states" || c === "united states of america";
}

async function activeLabels(orderId: string) {
  const { data } = await supabase.from("shipping_labels").select("id, status, test_mode, carrier, service, tracking_number, label_url, cost_usd, created_at")
    .eq("order_id", orderId).order("created_at");
  return data || [];
}

async function quote(orderId: string, p: Record<string, unknown>) {
  const rows = await loadOrder(orderId);
  if (!rows.length) return json({ error: "order not found" }, 404);
  const r = rows[0];
  if (r.fulfillment === "pickup") return json({ error: "This order is picked up in store, so it needs no label." }, 400);
  if (!isUS(r.shipping_country)) return json({ error: "Labels from here are for US addresses only (no customs form yet)." }, 400);
  if (!r.shipping_address_line1 || !r.shipping_zip) return json({ error: "This order has no shipping address." }, 400);

  const parcel = cleanParcel(p, defaultWeight(rows.map((x) => String(x.suit_type || ""))));
  const to = await shippo("POST", "addresses/", { ...addressTo(r), validate: true });
  const v = to.validation_results || {};
  const notes = (v.messages || []).map((m: Record<string, string>) => m.text).filter(Boolean);
  const shipment = await shippo("POST", "shipments/", {
    address_from: SHIP_FROM,
    address_to: to.object_id,
    parcels: [{ ...parcel, distance_unit: "in", mass_unit: "lb" }],
    metadata: "order " + orderId,
    async: false,
  });
  const rates = sortRates(shipment.rates || []);
  return json({
    mode: shippoMode(),
    address: [to.name, to.street1, to.street2, [to.city, to.state, to.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    address_ok: v.is_valid !== false,
    address_notes: notes,
    parcel,
    suits: rows.length,
    rates,
    messages: (shipment.messages || []).map((m: Record<string, string>) => [m.source, m.text].filter(Boolean).join(": ")).slice(0, 5),
    labels: await activeLabels(orderId),
  });
}

async function buy(orderId: string, rateId: string, again: boolean, authHeader: string, adminEmail: string) {
  const rows = await loadOrder(orderId);
  if (!rows.length) return json({ error: "order not found" }, 404);
  const mode = shippoMode();
  const live = mode === "live";
  const existing = (await activeLabels(orderId)).filter((l) => l.status !== "refunded" && l.test_mode === !live);
  if (existing.length && !again) {
    return json({ error: "This order already has a label (" + existing.map((l) => l.carrier + " " + l.tracking_number).join(", ") + ").", already: existing }, 409);
  }

  // The price and parcel come from Shippo, never from the request, and the
  // rate must belong to a quote made for this order.
  const rate = await shippo("GET", "rates/" + encodeURIComponent(rateId));
  const shipment = await shippo("GET", "shipments/" + encodeURIComponent(String(rate.shipment || "")));
  if (shipment.metadata !== "order " + orderId) return json({ error: "That rate wasn't quoted for this order. Get rates again." }, 400);

  const tx = await shippo("POST", "transactions/", { rate: rateId, label_file_type: "PDF_4x6", async: false });
  if (tx.status !== "SUCCESS") {
    const why = (tx.messages || []).map((m: Record<string, string>) => m.text).filter(Boolean).join("; ");
    return json({ error: "Shippo couldn't buy the label" + (why ? ": " + why : " (status " + tx.status + ")") }, 502);
  }
  const p = (shipment.parcels && shipment.parcels[0]) || {};
  const label = {
    order_id: orderId,
    status: "bought",
    test_mode: !live,
    carrier: carrierName(rate.provider),
    service: String((rate.servicelevel && rate.servicelevel.name) || ""),
    tracking_number: String(tx.tracking_number || ""),
    tracking_url: String(tx.tracking_url_provider || ""),
    label_url: String(tx.label_url || ""),
    cost_usd: Math.round(Number(rate.amount) * 100) / 100,
    parcel: { length: p.length, width: p.width, height: p.height, weight: p.weight },
    shippo_transaction_id: String(tx.object_id || ""),
    shippo_rate_id: rateId,
    bought_by: adminEmail,
  };
  const { error: saveErr } = await supabase.from("shipping_labels").insert(label);
  if (saveErr) console.error("label bought but not saved:", saveErr.message, JSON.stringify(label));

  let notified: unknown = null;
  if (live && label.tracking_number) {
    await supabase.from("orders").update({
      tracking_carrier: label.carrier,
      tracking_number: label.tracking_number,
      shipping_status: "shipped",
      shipping_updated_at: new Date().toISOString(),
    }).eq("order_id", orderId);
    notified = await notifyCustomer(orderId, authHeader);
  }
  return json({ ...label, ok: true, saved: !saveErr, notified });
}

async function refund(labelId: number) {
  const { data: l, error } = await supabase.from("shipping_labels").select("*").eq("id", labelId).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!l) return json({ error: "label not found" }, 404);
  if (l.status !== "bought") return json({ error: "This label is already " + String(l.status).replace("_", " ") + "." }, 400);
  const r = await shippo("POST", "refunds/", { transaction: l.shippo_transaction_id, async: false });
  const status = r.status === "SUCCESS" ? "refunded" : r.status === "ERROR" ? "bought" : "refund_pending";
  if (r.status === "ERROR") return json({ error: "Shippo refused the refund (a label that was already scanned can't be refunded)." }, 400);
  await supabase.from("shipping_labels").update({ status, refund_id: String(r.object_id || ""), refunded_at: new Date().toISOString() }).eq("id", labelId);
  if (!l.test_mode) {
    // Only undo the order's tracking if it is still this label's.
    await supabase.from("orders").update({ tracking_carrier: null, tracking_number: null, shipping_status: "final_check", shipping_updated_at: new Date().toISOString() })
      .eq("order_id", l.order_id).eq("tracking_number", l.tracking_number);
  }
  return json({ ok: true, status });
}

// The customer's "Shipped to you" email (and text, once Twilio is set),
// sent as the admin, so test mode still sends it to the admin instead.
async function notifyCustomer(orderId: string, authHeader: string) {
  try {
    const res = await fetch(env("SUPABASE_URL") + "/functions/v1/send-shipping-update", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: authHeader },
      body: JSON.stringify({ order_id: orderId }),
    });
    const r = await res.json().catch(() => ({}));
    return res.ok ? r : { error: r.error || "send-shipping-update said " + res.status };
  } catch (e) {
    return { error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return json({ error: "sign in as the shop admin" }, 401);
  const { data: who, error: whoErr } = await supabase.auth.getUser(m[1]);
  if (whoErr || !who?.user) return json({ error: "sign in as the shop admin" }, 401);
  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
  if (!adminRow) return json({ error: "only the shop admin can buy shipping labels" }, 403);

  if (!SHIPPO_KEY) return json({ error: "Shippo isn't set up (SHIPPO_API_KEY)." }, 500);
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    // checked below
  }
  try {
    if (body.action === "quote") {
      if (!body.order_id) return json({ error: "order_id required" }, 400);
      return await quote(String(body.order_id), body);
    }
    if (body.action === "buy") {
      if (!body.order_id || !body.rate_id) return json({ error: "order_id and rate_id required" }, 400);
      return await buy(String(body.order_id), String(body.rate_id), body.again === true, authHeader, String(who.user.email || ""));
    }
    if (body.action === "refund") {
      const id = Number(body.label_id);
      if (!Number.isInteger(id)) return json({ error: "label_id required" }, 400);
      return await refund(id);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
