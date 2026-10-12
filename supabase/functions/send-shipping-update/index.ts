// Scott Suits -- emails and texts a customer when the shop updates their
// order's progress (each factory step, final inspection, shipped, out for
// delivery, delivered), with the tracking link once it ships.
//
// How it's called: by the shop admin's "Save" in My Account > Orders on
// scottssuits.com, right after supabase/sql/8_shipping_updates.sql's
// admin_update_shipping() saved the new status:
//   Authorization: Bearer <admin's sign-in token>   { order_id: "..." }
// Only an account listed in public.admins can trigger a send. The function
// reads the status, tracking and the customer's email/phone from the order
// itself, so the request can't point a message at anyone else.
//
// Test mode (public.shipping_notify_settings.live = false, the default):
// the email goes to the admin's own address and the text to
// SHIPPING_TEST_PHONE, never to the customer. The admin turns test mode
// off in My Account ("Send updates to customers").
//
// Email is sent through Resend (same account as send-welcome-email), texts
// through Twilio. Without the Twilio secrets, texts are skipped and only the
// email goes out.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY        required for email (already set for the welcome email)
//   TWILIO_ACCOUNT_SID    optional -- twilio.com console
//   TWILIO_AUTH_TOKEN     optional -- twilio.com console
//   TWILIO_FROM           optional -- the Twilio phone number (+15551234567)
//                         or a Messaging Service id (MG...)
//   SHIPPING_TEST_PHONE   optional -- where test-mode texts go
//   SHIPPING_FROM         optional, default "Scott Suits <hello@scottssuits.com>"
//   SHIPPING_REPLY_TO     optional, default scottsuits4@gmail.com
//   SITE_URL              optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const FROM = env("SHIPPING_FROM", "Scott Suits <hello@scottssuits.com>");
const REPLY_TO = env("SHIPPING_REPLY_TO", "scottsuits4@gmail.com");

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function trackingUrl(carrier: string, number: string): string {
  const n = encodeURIComponent(number.trim());
  if (!n) return "";
  switch ((carrier || "").toLowerCase()) {
    case "ups":
      return "https://www.ups.com/track?tracknum=" + n;
    case "usps":
      return "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + n;
    case "fedex":
      return "https://www.fedex.com/fedextrack/?trknbr=" + n;
    case "dhl":
      return "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=" + n;
    default:
      return "";
  }
}

// US numbers as the order form saves them -- "(555) 123-4567" -- become
// +15551234567. Numbers typed with a leading + are kept as international.
export function toE164(raw: string): string {
  const s = (raw || "").trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : "";
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "";
}

// Same keys and order as SHIPPING_STATUSES in main.js.
const STATUS_TEXT: Record<string, { subject: string; headline: string; body: string }> = {
  sent_to_factory: {
    subject: "Your Scott Suits order is at the factory",
    headline: "Sent to the factory",
    body: "Your order and measurements are now with our factory. We'll keep you posted as your suit is made.",
  },
  cutting: {
    subject: "Your Scott Suits fabric is being cut",
    headline: "Fabric being cut",
    body: "Your fabric is being cut to your measurements.",
  },
  sewing: {
    subject: "Your Scott Suits order is being sewn",
    headline: "Being sewn",
    body: "Our tailors are sewing your suit now.",
  },
  finishing: {
    subject: "Your Scott Suits order is in finishing",
    headline: "Finishing and quality check",
    body: "Your suit is being finished, pressed and checked at the factory.",
  },
  factory_shipped: {
    subject: "Your Scott Suits order has left the factory",
    headline: "On its way from the factory",
    body: "Your suit is done and on its way from the factory to us for a final inspection.",
  },
  final_check: {
    subject: "Your Scott Suits order is with us",
    headline: "Final inspection",
    body: "Your suit has arrived with us and is getting a final inspection before we ship it to you.",
  },
  shipped: {
    subject: "Your Scott Suits order has shipped",
    headline: "Shipped to you",
    body: "Your order is on its way to you.",
  },
  out_for_delivery: {
    subject: "Your Scott Suits order is out for delivery",
    headline: "Out for delivery",
    body: "Your order is out for delivery and should arrive today.",
  },
  delivered: {
    subject: "Your Scott Suits order was delivered",
    headline: "Delivered",
    body: "Your order has been delivered. We hope you love it. If anything about the fit isn't right, just reply to this email.",
  },
};
const STEPS = Object.keys(STATUS_TEXT);
const WITH_TRACKING = ["shipped", "out_for_delivery", "delivered"];

export type Shipping = { firstName: string; status: string; carrier: string; tracking: string };

export function shippingMessage(s: Shipping, siteUrl = SITE_URL) {
  const t = STATUS_TEXT[s.status];
  if (!t) return null;
  const hello = s.firstName ? "Hi " + s.firstName + "," : "Hi,";
  const link = trackingUrl(s.carrier, s.tracking);
  const carrierName = s.carrier && s.carrier.toLowerCase() !== "other" ? s.carrier + " " : "";
  const trackLine = s.tracking ? "Tracking number: " + carrierName + s.tracking : "";
  const showTracking = WITH_TRACKING.includes(s.status) && !!s.tracking;
  // "Step 4 of 10" -- step 1 is "Order received", before any update.
  const step = "Step " + (STEPS.indexOf(s.status) + 2) + " of " + (STEPS.length + 1);

  const text = [
    hello,
    "",
    t.body + " (" + step + ")",
    ...(showTracking ? ["", trackLine, ...(link ? ["Track it: " + link] : [])] : []),
    "",
    "Questions? Just reply to this email.",
    "",
    "Scott Suits -- Custom Tailoring",
    siteUrl,
  ].join("\n");

  const trackingHtml = showTracking
    ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(trackLine)}</p>` +
      (link
        ? `</td></tr><tr><td align="center" style="padding:0 32px 28px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#B08D57;color:#221E19;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">Track your order</a>`
        : "")
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2EDE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${siteUrl}/assets/icon-192.png" width="72" height="72" alt="Scott Suits" style="display:block;border:0;border-radius:12px;">
<p style="margin:16px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B08D57;">Scott Suits</p>
</td></tr>
<tr><td style="padding:8px 32px 8px;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-align:center;color:rgba(34,30,25,0.62);">${step}</p>
<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;text-align:center;">${escapeHtml(t.headline)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(hello)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(t.body)}</p>
${trackingHtml}
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">Questions? Just reply to this email.<br>Scott Suits &middot; Custom Tailoring</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const sms =
    "Scott Suits: " +
    t.headline +
    " (" + step + ")." +
    (showTracking ? " " + trackLine + (link ? " " + link : "") : "") +
    " Reply STOP to opt out.";

  return { subject: t.subject, text, html, sms };
}

async function sendEmail(to: string, m: { subject: string; text: string; html: string }) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return { ok: false, detail: "RESEND_API_KEY is not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: m.subject, text: m.text, html: m.html }),
  });
  return { ok: res.ok, detail: res.ok ? "sent" : res.status + " " + (await res.text()).slice(0, 300) };
}

async function sendSms(to: string, body: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM");
  if (!sid || !token || !from) return { ok: false, skipped: true, detail: "texting isn't set up yet (Twilio)" };
  const form = new URLSearchParams({ To: to, Body: body });
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from);
  else form.set("From", from);
  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json", {
    method: "POST",
    headers: { authorization: "Basic " + btoa(sid + ":" + token), "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  return { ok: res.ok, skipped: false, detail: res.ok ? "sent" : res.status + " " + (await res.text()).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Only the shop admin.
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return json({ error: "sign in as the shop admin" }, 401);
  const { data: who, error: whoErr } = await supabase.auth.getUser(m[1]);
  if (whoErr || !who?.user) return json({ error: "sign in as the shop admin" }, 401);
  const admin = who.user;
  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", admin.id).maybeSingle();
  if (!adminRow) return json({ error: "only the shop admin can send shipping updates" }, 403);

  let orderId = "";
  try {
    orderId = String((await req.json()).order_id || "");
  } catch {
    // fall through to the check below
  }
  if (!orderId) return json({ error: "order_id required" }, 400);

  const { data: rows, error } = await supabase
    .from("orders")
    .select("customer_name, customer_email, customer_phone, shipping_status, tracking_carrier, tracking_number")
    .eq("order_id", orderId)
    .limit(1);
  if (error) return json({ error: error.message }, 500);
  const o = rows && rows[0];
  if (!o) return json({ error: "order not found" }, 404);

  const msg = shippingMessage({
    firstName: String(o.customer_name || "").trim().split(/\s+/)[0] || "",
    status: String(o.shipping_status || ""),
    carrier: String(o.tracking_carrier || ""),
    tracking: String(o.tracking_number || ""),
  });
  if (!msg) return json({ error: "this order has no shipping status to send" }, 400);

  const { data: settings } = await supabase.from("shipping_notify_settings").select("live").eq("id", 1).maybeSingle();
  const live = settings?.live === true;

  const emailTo = live ? String(o.customer_email || "").trim() : String(admin.email || "");
  const phoneTo = toE164(live ? String(o.customer_phone || "") : env("SHIPPING_TEST_PHONE"));
  const prefix = live ? "" : "[TEST -- would go to " + (o.customer_email || "no email") + " / " + (o.customer_phone || "no phone") + "] ";

  const email = emailTo
    ? await sendEmail(emailTo, { ...msg, subject: prefix + msg.subject })
    : { ok: false, detail: "no email address" };
  const sms = phoneTo
    ? await sendSms(phoneTo, (live ? "" : "[TEST] ") + msg.sms)
    : { ok: false, skipped: true, detail: live ? "no usable phone number on the order" : "no test phone set (SHIPPING_TEST_PHONE)" };

  await supabase.from("shipping_notifications").insert([
    { order_id: orderId, shipping_status: o.shipping_status, channel: "email", recipient: emailTo || null, test_mode: !live, ok: email.ok, detail: email.detail },
    { order_id: orderId, shipping_status: o.shipping_status, channel: "sms", recipient: phoneTo || null, test_mode: !live, ok: sms.ok, detail: sms.detail },
  ]);

  return json({ live, email: { to: emailTo, ...email }, sms: { to: phoneTo, ...sms } });
});
