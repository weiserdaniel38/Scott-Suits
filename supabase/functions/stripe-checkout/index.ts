// Scott Suits -- Stripe checkout for orders on scottssuits.com.
//
// The website saves the order first (payment_status = 'awaiting_payment',
// see supabase/sql/12_stripe_payments.sql), then calls this function:
//
//   { action: "create", order_id }   -> { url } of Stripe's checkout page.
//       The amount comes from the saved order's suit prices, never from the
//       request.
//   { action: "verify", session_id } -> { paid, order_id, amount }
//       Called when Stripe sends the customer back. Asks Stripe whether the
//       payment really went through and, if so, marks the order paid.
//   { action: "cancel", order_id }   -> { cancelled } or { paid }
//       Called when the customer backs out of Stripe's page. Closes the
//       Stripe session and removes the unpaid order, so trying again doesn't
//       leave a duplicate behind. A paid order is never removed.
//
// Stripe can also call this directly as a webhook (Stripe-Signature header),
// so an order is marked paid even if the customer closes the tab before
// coming back. Set STRIPE_WEBHOOK_SECRET to turn that on; without it,
// webhook calls are refused and "verify" does the job.
//
// Shipping and tax: an order picked up in store (fulfillment = 'pickup')
// pays the suits only. An order shipped to the customer adds the cheapest
// carrier rate Shippo finds for the shipping address (one bag per suit,
// sent from the shop), or the flat SHIPPING_FLAT_USD when Shippo isn't set
// up, the address is outside the US, or Shippo returns no rate. Then, once
// STRIPE_AUTOMATIC_TAX is "true", sales tax worked out by Stripe Tax from
// the shipping address (Stripe Tax must be set up in the Stripe dashboard
// first: origin address + where you're registered to collect). What was
// charged is saved on the order.
//
// Admin orders (admin_no_payment) never come through here.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY      required -- sk_test_... while testing, sk_live_... to go live
//   STRIPE_WEBHOOK_SECRET  optional -- whsec_... from the Stripe webhook endpoint
//   SHIPPING_FLAT_USD      optional, default 19.99 -- per order, used when there's
//                          no Shippo rate
//   STRIPE_AUTOMATIC_TAX   optional -- "true" to add sales tax (Stripe Tax)
//   SHIPPO_API_KEY         optional -- shippo_live_... for live carrier rates
//   SHIPPING_MARKUP_USD    optional, default 0 -- added to the Shippo rate
//   SHIP_BOX_IN / SHIP_BOX_LB  optional, default "24x19x2" / "3" -- one suit in a poly mailer bag
//   SITE_URL               optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const STRIPE_KEY = env("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET");
const SHIPPING_CENTS = Math.max(0, Math.round(Number(env("SHIPPING_FLAT_USD", "19.99")) * 100) || 0);
const AUTOMATIC_TAX = env("STRIPE_AUTOMATIC_TAX").toLowerCase() === "true";
const SHIPPO_KEY = env("SHIPPO_API_KEY");
const MARKUP_CENTS = Math.max(0, Math.round(Number(env("SHIPPING_MARKUP_USD", "0")) * 100) || 0);
const BOX_IN = env("SHIP_BOX_IN", "24x19x2").split(/x/i).map((n) => n.trim());
const BOX_LB = env("SHIP_BOX_LB", "3");
// Where suits are shipped from.
const SHIP_FROM = {
  name: "Scott Suits",
  street1: "38 Parson Road",
  city: "Clifton",
  state: "NJ",
  zip: "07012",
  country: "US",
};
// Stripe Tax product codes: clothing, and shipping.
const TAX_CODE_CLOTHING = "txcd_30011000";
const TAX_CODE_SHIPPING = "txcd_92010001";

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

// Where Stripe sends the customer back: the site the request came from when
// it's ours (so a local copy can be tested), otherwise SITE_URL.
export function returnBase(origin: string | null): string {
  const o = (origin || "").replace(/\/+$/, "");
  if (/^https:\/\/(www\.)?scottssuits\.com$/i.test(o)) return o;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) return o;
  return SITE_URL;
}

// Stripe's API takes form-encoded bodies with bracketed keys.
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + "[" + k + "]" : k;
    if (typeof v === "object") out.push(...formEncode(v as Record<string, unknown>, key));
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
  }
  return out;
}

async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: {
      authorization: "Bearer " + STRIPE_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" && params ? formEncode(params).join("&") : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body && body.error && body.error.message) || "Stripe error " + res.status);
  return body;
}

type OrderRow = {
  order_id: string;
  suit_number: number | null;
  suit_type: string | null;
  item_price_usd: number | string | null;
  customer_email: string | null;
  payment_status: string | null;
  admin_no_payment: boolean | null;
  stripe_session_id: string | null;
  created_at: string;
  fulfillment: string | null;
  customer_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
};

async function loadOrder(orderId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, suit_number, suit_type, item_price_usd, customer_email, payment_status, admin_no_payment, stripe_session_id, created_at, " +
        "fulfillment, customer_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip, shipping_country",
    )
    .eq("order_id", orderId)
    .order("suit_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as OrderRow[];
}

// One Stripe line per suit, priced from the saved order.
export function lineItems(rows: OrderRow[]) {
  const items: Record<string, unknown> = {};
  rows.forEach((r, i) => {
    const cents = Math.round(Number(r.item_price_usd) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 2_000_000) throw new Error("order has an invalid price");
    const name = r.suit_type === "jacket_only" ? "Custom Jacket" : r.suit_type === "pants_only" ? "Custom Pants" : "Custom Suit";
    items[String(i)] = {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents,
        tax_behavior: "exclusive",
        product_data: { name: rows.length > 1 ? name + " (" + (i + 1) + " of " + rows.length + ")" : name, tax_code: TAX_CODE_CLOTHING },
      },
    };
  });
  return items;
}

// The order form's free-text country as a 2-letter code Stripe understands,
// or "" when it can't tell (tax is then skipped for that order).
export function countryCode(raw: string | null): string {
  const c = (raw || "").trim().toLowerCase().replace(/\./g, "");
  if (!c || ["united states", "united states of america", "usa", "us", "america"].includes(c)) return "US";
  if (c === "canada" || c === "ca") return "CA";
  if (c === "united kingdom" || c === "uk" || c === "gb" || c === "great britain") return "GB";
  return /^[a-z]{2}$/.test(c) ? c.toUpperCase() : "";
}

// A Stripe customer carrying the order's shipping address, so Stripe Tax
// can work out the tax without asking for the address again.
async function taxCustomer(r: OrderRow, email: string): Promise<string | null> {
  const country = countryCode(r.shipping_country);
  if (!country || !r.shipping_address_line1) return null;
  const address = {
    line1: r.shipping_address_line1,
    line2: r.shipping_address_line2 || undefined,
    city: r.shipping_city || undefined,
    state: r.shipping_state || undefined,
    postal_code: r.shipping_zip || undefined,
    country,
  };
  const c = await stripe("POST", "customers", {
    name: r.customer_name || undefined,
    email: email || undefined,
    address,
    shipping: { name: r.customer_name || "Customer", address },
    metadata: { order_id: r.order_id },
  });
  return c.id;
}

// The cheapest rate any carrier offers for this order, via Shippo, or null
// (caller falls back to the flat price).
export async function cheapestRate(r: OrderRow, boxes: number): Promise<{ cents: number; name: string } | null> {
  if (!SHIPPO_KEY || countryCode(r.shipping_country) !== "US" || !r.shipping_address_line1 || !r.shipping_zip) return null;
  const parcel = { length: BOX_IN[0], width: BOX_IN[1], height: BOX_IN[2], distance_unit: "in", weight: BOX_LB, mass_unit: "lb" };
  const res = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: { authorization: "ShippoToken " + SHIPPO_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      address_from: SHIP_FROM,
      address_to: {
        name: r.customer_name || "Customer",
        street1: r.shipping_address_line1,
        street2: r.shipping_address_line2 || "",
        city: r.shipping_city || "",
        state: r.shipping_state || "",
        zip: r.shipping_zip,
        country: "US",
      },
      parcels: Array.from({ length: Math.max(1, boxes) }, () => parcel),
      async: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Shippo " + res.status + ": " + JSON.stringify(body).slice(0, 300));
  let best: { cents: number; name: string } | null = null;
  for (const rate of body.rates || []) {
    if (rate.currency !== "USD") continue;
    // Media/Library Mail is for books only; clothing can't go that way.
    if (/media_mail|library_mail/i.test((rate.servicelevel && rate.servicelevel.token) || "")) continue;
    const cents = Math.round(Number(rate.amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) continue;
    if (!best || cents < best.cents) {
      const service = [rate.provider, rate.servicelevel && rate.servicelevel.name].filter(Boolean).join(" ");
      const days = rate.estimated_days ? " (about " + rate.estimated_days + (rate.estimated_days === 1 ? " day)" : " days)") : "";
      best = { cents, name: ("Shipping: " + service + days).slice(0, 100) };
    }
  }
  return best && { cents: best.cents + MARKUP_CENTS, name: best.name };
}

async function createCheckout(orderId: string, origin: string | null) {
  const rows = await loadOrder(orderId);
  if (!rows.length) return json({ error: "order not found" }, 404);
  if (rows.some((r) => r.admin_no_payment)) return json({ error: "admin orders don't need payment" }, 400);
  if (rows.some((r) => r.payment_status === "paid")) return json({ error: "this order is already paid" }, 409);
  if (rows.some((r) => r.payment_status !== "awaiting_payment")) return json({ error: "this order isn't waiting for payment" }, 400);
  if (Date.now() - new Date(rows[0].created_at).getTime() > 24 * 3600 * 1000) {
    return json({ error: "this order is too old to pay for; please place it again" }, 400);
  }

  // Reuse a checkout page that's still open (double click, back button).
  const existing = rows[0].stripe_session_id;
  if (existing) {
    try {
      const s = await stripe("GET", "checkout/sessions/" + existing);
      if (s.status === "open" && s.url) return json({ url: s.url });
    } catch {
      // make a new one below
    }
  }

  const base = returnBase(origin);
  const rawEmail = (rows[0].customer_email || "").trim();
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail) ? rawEmail : "";
  const pickup = rows[0].fulfillment === "pickup";
  const params: Record<string, unknown> = {
    mode: "payment",
    line_items: lineItems(rows),
    client_reference_id: orderId,
    customer_email: email || undefined,
    metadata: { order_id: orderId, fulfillment: pickup ? "pickup" : "ship" },
    payment_intent_data: {
      metadata: { order_id: orderId },
      description: "Scott Suits order " + orderId + (pickup ? " (in-store pickup)" : ""),
    },
    success_url: base + "/?stripe_return=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: base + "/?stripe_cancelled=1&order=" + encodeURIComponent(orderId),
  };
  const rate = pickup
    ? null
    : await cheapestRate(rows[0], rows.length).catch((e) => (console.error("shippo failed, using flat shipping:", e), null));
  const shippingCents = rate ? rate.cents : SHIPPING_CENTS;
  if (!pickup) console.log("shipping for", orderId, rate ? rate.name + " " + rate.cents : "no rate", "charged", shippingCents);
  if (!pickup && shippingCents > 0) {
    params.shipping_options = {
      0: {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: rate ? rate.name : "Shipping",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          tax_behavior: "exclusive",
          tax_code: TAX_CODE_SHIPPING,
        },
      },
    };
  }
  let session: Record<string, any> | null = null;
  const customer = !pickup && AUTOMATIC_TAX ? await taxCustomer(rows[0], email).catch((e) => (console.error(e), null)) : null;
  if (customer) {
    try {
      session = await stripe("POST", "checkout/sessions", {
        ...params,
        customer_email: undefined,
        customer,
        automatic_tax: { enabled: true },
      });
    } catch (e) {
      // Never block a sale over tax setup; the order is charged without tax
      // and the error shows in the function logs.
      console.error("automatic tax failed, charging without tax:", e);
    }
  }
  if (!session) session = await stripe("POST", "checkout/sessions", params);

  const { error } = await supabase
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("order_id", orderId)
    .eq("payment_status", "awaiting_payment");
  if (error) return json({ error: error.message }, 500);
  return json({ url: session.url });
}

// Marks the order paid if Stripe says this session was paid in full.
async function markPaidFromSession(s: Record<string, any>) {
  const orderId = String((s.metadata && s.metadata.order_id) || s.client_reference_id || "");
  if (!orderId || s.payment_status !== "paid") return { paid: false, order_id: orderId };
  const amount = Number(s.amount_total || 0) / 100;
  const shipping = Number((s.total_details && s.total_details.amount_shipping) || 0) / 100;
  const tax = Number((s.total_details && s.total_details.amount_tax) || 0) / 100;
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid", amount_paid_usd: amount, shipping_usd: shipping, tax_usd: tax, paid_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("stripe_session_id", s.id)
    .eq("payment_status", "awaiting_payment");
  if (error) throw new Error(error.message);
  // Already-paid (webhook got there first) still counts as paid.
  const { data } = await supabase.from("orders").select("payment_status").eq("order_id", orderId).eq("stripe_session_id", s.id).limit(1);
  return { paid: !!(data && data[0] && data[0].payment_status === "paid"), order_id: orderId, amount, shipping, tax };
}

async function verifySession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json({ error: "bad session id" }, 400);
  const s = await stripe("GET", "checkout/sessions/" + sessionId);
  return json(await markPaidFromSession(s));
}

async function cancelOrder(orderId: string) {
  const rows = await loadOrder(orderId);
  if (!rows.length) return json({ cancelled: true });
  if (rows.some((r) => r.payment_status !== "awaiting_payment")) return json({ error: "this order can't be cancelled here" }, 400);
  const sid = rows[0].stripe_session_id;
  if (sid) {
    const s = await stripe("GET", "checkout/sessions/" + sid);
    if (s.payment_status === "paid") return json(await markPaidFromSession(s));
    if (s.status === "open") await stripe("POST", "checkout/sessions/" + sid + "/expire");
  }
  const { error } = await supabase.from("orders").delete().eq("order_id", orderId).eq("payment_status", "awaiting_payment");
  if (error) return json({ error: error.message }, 500);
  return json({ cancelled: true });
}

// Stripe-Signature: t=timestamp,v1=hex(hmac_sha256(secret, t + "." + body))
export async function validSignature(header: string, body: string, secret: string, now = Date.now()): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts.t + "." + body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  return given.some((g) => g.length === hex.length && g === hex);
}

async function webhook(req: Request, sigHeader: string) {
  if (!WEBHOOK_SECRET) return json({ error: "webhook not configured" }, 400);
  const body = await req.text();
  if (!(await validSignature(sigHeader, body, WEBHOOK_SECRET))) return json({ error: "bad signature" }, 400);
  const event = JSON.parse(body);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await markPaidFromSession(event.data.object);
  }
  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!STRIPE_KEY) return json({ error: "payments aren't set up yet (STRIPE_SECRET_KEY missing)" }, 503);

  try {
    const sig = req.headers.get("stripe-signature");
    if (sig) return await webhook(req, sig);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // checked below
    }
    const action = String(body.action || "");
    if (action === "create") {
      const orderId = String(body.order_id || "");
      if (!orderId) return json({ error: "order_id required" }, 400);
      return await createCheckout(orderId, req.headers.get("origin"));
    }
    if (action === "verify") return await verifySession(String(body.session_id || ""));
    if (action === "cancel") {
      const orderId = String(body.order_id || "");
      if (!orderId) return json({ error: "order_id required" }, 400);
      return await cancelOrder(orderId);
    }
    return json({ error: "unknown action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
