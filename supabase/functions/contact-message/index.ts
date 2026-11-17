// Scott Suits -- the message form on the Contact page (contact.html).
//
// The page posts { name, email, message, brand, website }. This sends two
// emails through Resend (same sender as the welcome email):
//   1. the message to the shop (public.admins, or CONTACT_TO), with
//      reply-to set to the customer so Daniel can just hit Reply;
//   2. an automatic "we received your message" reply to the customer,
//      with a copy of what they wrote. brand "sw" words it as S.W. Atelier.
// "website" is a hidden honeypot field: bots fill it, people don't, so a
// filled one gets a fake { ok: true } and nothing is sent.
//
// Secrets (already set for the other emails):
//   RESEND_API_KEY   required
//   WELCOME_FROM     optional sender, default "Scott Suits <hello@scottssuits.com>"
//   CONTACT_TO       optional comma-separated addresses instead of public.admins
//   SITE_URL         optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const FROM_ADDR = (env("WELCOME_FROM", "Scott Suits <hello@scottssuits.com>").match(/<([^>]+)>/) || [])[1] ||
  "hello@scottssuits.com";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Light abuse guard (per warm instance): at most 10 messages per caller IP
// in 10 minutes reach the shop, and the automatic reply goes at most once
// per address every 10 minutes and to the first 4 messages from an IP.
const lastByEmail = new Map<string, number>();
const hitsByIp = new Map<string, number[]>();
export function guard(email: string, ip: string, now = Date.now()): { shop: boolean; reply: boolean } {
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < 600_000);
  if (hits.length >= 10) return { shop: false, reply: false };
  hits.push(now);
  hitsByIp.set(ip, hits);
  const reply = hits.length <= 4 && now - (lastByEmail.get(email) || 0) >= 600_000;
  if (reply) lastByEmail.set(email, now);
  if (lastByEmail.size > 5000) lastByEmail.clear();
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return { shop: true, reply };
}

type Brand = { id: string; name: string; icon: string; accent: string; bg: string };
export function brandFor(id: unknown, siteUrl = SITE_URL): Brand {
  if (id === "sw") {
    return { id: "sw", name: "S.W. Atelier", icon: siteUrl + "/assets/sw/icon-v3-192.png", accent: "#B08D57", bg: "#F2EDE3" };
  }
  return { id: "scott", name: "Scott's Suits", icon: siteUrl + "/assets/icon-192.png", accent: "#74444D", bg: "#F2EDE3" };
}

const paragraphs = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

// The automatic reply the customer gets.
export function autoReplyEmail(name: string, message: string, brand: Brand) {
  const first = name.split(/\s+/)[0] || "";
  const hello = first ? "Hi " + first + "," : "Hello,";
  const intro = brand.id === "sw"
    ? "Thank you for writing to S.W. Atelier. We have received your message and will reply personally within one business day."
    : "Thanks for contacting Scott's Suits. We received your message and will get back to you within one business day.";
  const subject = brand.id === "sw" ? "We have received your message" : "We received your message";
  const sign = brand.id === "sw" ? "S.W. Atelier · Custom Suits & Formalwear" : "Scott's Suits · Custom Tailoring";
  const text = [
    hello,
    "",
    intro,
    "",
    "Your message:",
    message,
    "",
    "Need to add something? Just reply to this email.",
    "",
    sign,
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${brand.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${brand.icon}" width="72" height="72" alt="${escapeHtml(brand.name)}" style="display:block;border:0;border-radius:12px;">
<p style="margin:16px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${brand.accent};">${escapeHtml(brand.name)}</p>
</td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;text-align:center;">${escapeHtml(subject)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(hello)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(34,30,25,0.62);">Your message</p>
<div style="background:${brand.bg};border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#221E19;">${paragraphs(message)}</div>
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">Need to add something? Just reply to this email.<br>${escapeHtml(sign)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

// The copy that goes to the shop.
export function shopEmail(name: string, email: string, message: string, brand: Brand) {
  const subject = "New message from " + (name || email) + (brand.id === "sw" ? " (S.W. Atelier)" : "");
  const text = [
    "New message from the " + brand.name + " Contact page.",
    "",
    "Name: " + (name || "(not given)"),
    "Email: " + email,
    "",
    message,
    "",
    "Reply to this email to answer them. They already got an automatic \"we received your message\" email.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#F2EDE3;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px 28px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#74444D;">${escapeHtml(brand.name)} · Contact page</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">New message</h1>
<p style="margin:0 0 4px;font-size:14px;"><b>Name:</b> ${escapeHtml(name || "(not given)")}</p>
<p style="margin:0 0 16px;font-size:14px;"><b>Email:</b> <a href="mailto:${escapeHtml(email)}" style="color:#74444D;">${escapeHtml(email)}</a></p>
<div style="background:#F2EDE3;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;">${paragraphs(message)}</div>
<p style="margin:16px 0 0;font-size:12px;color:rgba(34,30,25,0.62);">Hit Reply to answer them. They already got an automatic "we received your message" email.</p>
</div></body></html>`;
  return { subject, text, html };
}

async function shopRecipients(): Promise<string[]> {
  const override = env("CONTACT_TO");
  if (override) return override.split(",").map((s) => s.trim()).filter(Boolean);
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data } = await supabase.from("admins").select("email");
  const list = (data || []).map((r: { email?: string }) => String(r.email || "").trim()).filter(Boolean);
  return list.length ? list : ["scottsuits4@gmail.com"];
}

async function send(apiKey: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Resend refused:", res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY is not set" }, 500);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // checked below
  }
  if (body.ping) return json({ ok: true, ready: true });
  if (String(body.website || "").trim()) return json({ ok: true });

  const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase();
  const message = String(body.message || "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "valid email required" }, 400);
  }
  if (message.length < 2) return json({ error: "message required" }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const allowed = guard(email, ip);
  if (!allowed.shop) return json({ ok: true });
  const brand = brandFor(body.brand);
  const from = brand.name + " <" + FROM_ADDR + ">";

  // The shop's copy always goes (it is only ever sent to the shop).
  const shop = shopEmail(name, email, message, brand);
  const shopOk = await send(apiKey, {
    from,
    to: await shopRecipients(),
    reply_to: email,
    subject: shop.subject,
    text: shop.text,
    html: shop.html,
  });
  if (!shopOk) return json({ error: "send failed" }, 502);

  // The automatic reply, unless this address or IP has just had one.
  if (allowed.reply) {
    const reply = autoReplyEmail(name, message, brand);
    await send(apiKey, {
      from,
      to: [email],
      reply_to: FROM_ADDR,
      subject: reply.subject,
      text: reply.text,
      html: reply.html,
    });
  }
  return json({ ok: true });
});
