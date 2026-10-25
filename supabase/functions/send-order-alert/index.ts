// Scott Suits -- emails the shop admin each time an order is paid: when
// Stripe confirms the payment. Admin "Place order without payment" orders
// don't send one. One email per order, however many suits.
// S.W. Atelier orders (orders.brand = 'sw', the coworker site with no
// prices or payment) send one the moment they're placed, marked as a
// request, with no prices (supabase/sql/23_site_brand.sql).
//
// How it's called: by the database (supabase/sql/19_order_email_alert.sql),
// the moment an order turns paid:
//   x-webhook-secret: <secret>   { order_id: "..." }
// The function reads the order itself, and sends only to the accounts in
// public.admins, so the request can't point the email at anyone else.
//
// Email is sent through Resend (same account as send-welcome-email).
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY    required (already set for the welcome email)
//   WEBHOOK_SECRET    required (the same one the welcome email uses)
//   ORDER_ALERT_TO    optional -- comma-separated addresses to use instead
//                     of the admin accounts' emails
//   ORDER_ALERT_FROM  optional, default "Scott Suits <hello@scottssuits.com>"
//   SITE_URL          optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const FROM = env("ORDER_ALERT_FROM", "Scott Suits <hello@scottssuits.com>");

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n: unknown) => "$" + Number(n || 0).toFixed(2);

// Storefronts other than Scott's Suits (see brand.js on the site).
const BRANDS: Record<string, { name: string; noPayment: boolean }> = {
  sw: { name: "S.W. Atelier", noPayment: true },
};

const SUIT_TYPES: Record<string, string> = {
  full_suit: "Full suit",
  jacket_only: "Jacket only",
  pants_only: "Pants only",
};

export type AlertRow = {
  order_id: string;
  suit_number: number | null;
  suit_type: string | null;
  fabric: string | null;
  item_price_usd: number | null;
  alteration_protection?: boolean | null;
  alteration_protection_usd?: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  fulfillment: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  payment_status: string | null;
  admin_no_payment: boolean | null;
  amount_paid_usd: number | null;
  shipping_usd: number | null;
  tax_usd: number | null;
  client_form_text: string | null;
  created_at: string | null;
  brand?: string | null;
};

export function orderAlertEmail(rows: AlertRow[], siteUrl = SITE_URL) {
  const r = rows[0];
  const name = (r.customer_name || "").trim() || "No name";
  const adminOrder = rows.some((x) => x.admin_no_payment);
  const brand = BRANDS[r.brand || ""] || null;
  const request = !!brand && brand.noPayment && !adminOrder;
  const paid = rows.some((x) => x.payment_status === "paid");
  const protectedRows = rows.filter((x) => x.alteration_protection);
  const protectionTotal = protectedRows.reduce((t, x) => t + Number(x.alteration_protection_usd || 0), 0);
  const itemsTotal = rows.reduce((t, x) => t + Number(x.item_price_usd || 0), 0) + protectionTotal;
  const protection = protectedRows.length && request
    ? "Yes (3 free alterations" + (protectedRows.length > 1 ? " each on " + protectedRows.length + " items" : "") + ")"
    : protectedRows.length
    ? "Yes, " + money(protectionTotal) + " (3 free alterations" + (protectedRows.length > 1 ? " each on " + protectedRows.length + " items" : "") + ")"
    : rows.some((x) => x.alteration_protection === false)
    ? "No, declined (alterations at their cost)"
    : "";
  const total = paid && r.amount_paid_usd != null ? Number(r.amount_paid_usd) : itemsTotal;
  const count = rows.length === 1 ? "1 item" : rows.length + " items";
  const payment = adminOrder
    ? "Admin order, placed without payment"
    : request
    ? brand!.name + " request, no payment"
    : paid
    ? "Paid " + money(r.amount_paid_usd) +
      (Number(r.shipping_usd) ? " (incl. shipping " + money(r.shipping_usd) + ")" : "") +
      (Number(r.tax_usd) ? " (incl. tax " + money(r.tax_usd) + ")" : "")
    : "Not paid yet";
  const pickup = r.fulfillment === "pickup";
  const address = pickup
    ? "In-store pickup"
    : [
        r.shipping_address_line1,
        r.shipping_address_line2,
        [r.shipping_city, r.shipping_state, r.shipping_zip].filter(Boolean).join(", "),
        r.shipping_country,
      ]
        .filter((x) => x && String(x).trim())
        .join("\n");
  const adminUrl = siteUrl + "/?admin=orders";
  const label = (brand ? brand.name + " " : "") + (adminOrder ? "admin order" : request ? "request" : "order");
  const subject = "New " + label + ": " + name + " · " + count + (request ? "" : " · " + money(total));

  const details: [string, string][] = [
    ["Order", r.order_id],
    ["Placed", r.created_at ? new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }) + " (ET)" : ""],
    ["Site", brand ? brand.name : ""],
    ["Payment", payment],
    ["Customer", name],
    ["Email", r.customer_email || ""],
    ["Phone", r.customer_phone || ""],
    [pickup ? "Delivery" : "Ship to", address || "(no address)"],
    ["Alterations", protection],
  ];
  const items = rows.map(
    (x, i) =>
      (x.suit_number || i + 1) + ". " + (SUIT_TYPES[x.suit_type || ""] || "Suit") +
      (x.fabric ? " · " + x.fabric : "") +
      (request
        ? (x.alteration_protection ? " + Alteration Protection" : "")
        : " · " + money(x.item_price_usd) + (x.alteration_protection ? " + Alteration Protection " + money(x.alteration_protection_usd) : "")),
  );

  const text = [
    subject,
    "",
    ...details.filter(([, v]) => v).map(([k, v]) => k + ": " + v.replace(/\n/g, ", ")),
    "",
    "Items:",
    ...items,
    "",
    "Open it in admin: " + adminUrl,
    "",
    ...rows.map((x) => (x.client_form_text || "").trim()).filter(Boolean).flatMap((t) => [t, ""]),
  ].join("\n");

  const cell = "padding:6px 0;font-size:14px;line-height:1.5;vertical-align:top;";
  const detailRows = details
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="${cell}color:rgba(34,30,25,0.62);width:96px;">${escapeHtml(k)}</td><td style="${cell}">${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const itemRows = items.map((t) => `<li style="margin:0 0 4px;">${escapeHtml(t)}</li>`).join("");
  const specs = rows
    .map((x) => (x.client_form_text || "").trim())
    .filter(Boolean)
    .map(
      (t) =>
        `<pre style="margin:0 0 12px;padding:12px;background:#F7F4EE;border-radius:8px;font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:Menlo,Consolas,monospace;">${escapeHtml(t)}</pre>`,
    )
    .join("");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2EDE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td style="padding:28px 32px 8px;">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B08D57;">${escapeHtml("New " + label)}</p>
<h1 style="margin:0 0 4px;font-size:22px;font-weight:600;">${escapeHtml(name)}</h1>
<p style="margin:0 0 16px;font-size:15px;">${escapeHtml(count)}${request ? "" : ` &middot; <b>${escapeHtml(money(total))}</b>`}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
<h2 style="margin:20px 0 8px;font-size:16px;font-weight:600;">Items</h2>
<ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.5;">${itemRows}</ul>
</td></tr>
<tr><td align="center" style="padding:0 32px 24px;">
<a href="${adminUrl}" style="display:inline-block;background:#B08D57;color:#221E19;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">Open in admin</a>
</td></tr>
${specs ? `<tr><td style="padding:0 32px 24px;"><h2 style="margin:0 0 8px;font-size:16px;font-weight:600;">Full order details</h2>${specs}</td></tr>` : ""}
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

async function recipients(): Promise<string[]> {
  const override = env("ORDER_ALERT_TO");
  if (override) return override.split(",").map((s) => s.trim()).filter(Boolean);
  const { data } = await supabase.from("admins").select("email");
  return (data || []).map((a: { email: string | null }) => (a.email || "").trim()).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY is not set" }, 500);

  let orderId = "";
  try {
    orderId = String((await req.json()).order_id || "");
  } catch {
    // fall through to the check below
  }
  if (!orderId) return json({ error: "order_id required" }, 400);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, suit_number, suit_type, fabric, item_price_usd, alteration_protection, alteration_protection_usd, customer_name, customer_email, customer_phone, fulfillment, " +
        "shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip, shipping_country, " +
        "payment_status, admin_no_payment, amount_paid_usd, shipping_usd, tax_usd, client_form_text, created_at, brand",
    )
    .eq("order_id", orderId)
    .order("suit_number", { ascending: true });
  if (error) return json({ error: error.message }, 500);
  const rows = (data || []) as unknown as AlertRow[];
  if (!rows.length) return json({ error: "order not found" }, 404);

  const to = await recipients();
  if (!to.length) return json({ error: "no admin email to send to" }, 500);
  const { subject, text, html } = orderAlertEmail(rows);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to,
      reply_to: rows[0].customer_email || undefined,
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend refused the order alert:", res.status, detail);
    return json({ error: "send failed", status: res.status, detail }, 502);
  }
  return json({ sent: true, to: to.length });
});
