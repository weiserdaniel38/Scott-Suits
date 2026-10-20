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
// Admin orders (admin_no_payment) never come through here.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY      required -- sk_test_... while testing, sk_live_... to go live
//   STRIPE_WEBHOOK_SECRET  optional -- whsec_... from the Stripe webhook endpoint
//   SITE_URL               optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const STRIPE_KEY = env("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET");

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
};

async function loadOrder(orderId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_id, suit_number, suit_type, item_price_usd, customer_email, payment_status, admin_no_payment, stripe_session_id, created_at")
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
    const name = r.suit_type === "jacket_only" ? "Custom Jacket" : "Custom Suit";
    items[String(i)] = {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents,
        product_data: { name: rows.length > 1 ? name + " (" + (i + 1) + " of " + rows.length + ")" : name },
      },
    };
  });
  return items;
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
  const email = (rows[0].customer_email || "").trim();
  const session = await stripe("POST", "checkout/sessions", {
    mode: "payment",
    line_items: lineItems(rows),
    client_reference_id: orderId,
    customer_email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
    metadata: { order_id: orderId },
    payment_intent_data: { metadata: { order_id: orderId }, description: "Scott Suits order " + orderId },
    success_url: base + "/?stripe_return=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: base + "/?stripe_cancelled=1&order=" + encodeURIComponent(orderId),
  });

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
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid", amount_paid_usd: amount, paid_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("stripe_session_id", s.id)
    .eq("payment_status", "awaiting_payment");
  if (error) throw new Error(error.message);
  // Already-paid (webhook got there first) still counts as paid.
  const { data } = await supabase.from("orders").select("payment_status").eq("order_id", orderId).eq("stripe_session_id", s.id).limit(1);
  return { paid: !!(data && data[0] && data[0].payment_status === "paid"), order_id: orderId, amount };
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
