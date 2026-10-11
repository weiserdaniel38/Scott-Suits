// Scott Suits -- emails a "welcome, your account is ready" message to every
// new customer account (email + password and Continue with Google alike).
//
// How it's called: by the database, right after a row is added to
// auth.users (supabase/sql/5_welcome_email_trigger.sql):
//   x-webhook-secret: <secret>   { user_id: "<auth user id>" }
// The function looks the account up itself, so the request carries no
// email address anyone could swap for another.
//
// Email is sent through Resend (resend.com, free up to 3,000 emails a
// month). Until scottssuits.com is verified there, Resend only delivers to
// the address the Resend account was opened with.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY   required -- resend.com > API Keys
//   WEBHOOK_SECRET   required -- same value pasted into the SQL trigger
//                    (can be the one generate-suit-image already uses)
//   WELCOME_FROM     optional, default "Scott Suits <hello@scottssuits.com>"
//   WELCOME_REPLY_TO optional, default scottsuits4@gmail.com
//   SITE_URL         optional, default https://scottssuits.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const FROM = env("WELCOME_FROM", "Scott Suits <hello@scottssuits.com>");
const REPLY_TO = env("WELCOME_REPLY_TO", "scottsuits4@gmail.com");

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function welcomeEmail(firstName: string, email: string, siteUrl = SITE_URL) {
  const hello = firstName ? "Welcome, " + firstName : "Welcome";
  const subject = "Your Scott Suits account is ready";
  const text = [
    hello + ".",
    "",
    "Your Scott Suits account has been created with " + email + ".",
    "",
    "With your account you can save your measurements once and see your past orders any time.",
    "",
    "Start designing your suit: " + siteUrl,
    "",
    "Questions? Just reply to this email.",
    "",
    "Scott Suits -- Custom Tailoring",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2EDE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${siteUrl}/assets/icon-192.png" width="72" height="72" alt="Scott Suits" style="display:block;border:0;border-radius:12px;">
<p style="margin:16px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B08D57;">Scott Suits</p>
</td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;text-align:center;">${escapeHtml(hello)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Your Scott Suits account has been created with <b>${escapeHtml(email)}</b>.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">With your account you can save your measurements once and see your past orders any time.</p>
</td></tr>
<tr><td align="center" style="padding:0 32px 28px;">
<a href="${siteUrl}" style="display:inline-block;background:#B08D57;color:#221E19;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">Design your suit</a>
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">Questions? Just reply to this email.<br>Scott Suits &middot; Custom Tailoring</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY is not set" }, 500);

  let userId = "";
  try {
    userId = String((await req.json()).user_id || "");
  } catch {
    // fall through to the check below
  }
  if (!userId) return json({ error: "user_id required" }, 400);

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return json({ error: "user not found" }, 404);
  const user = data.user;
  const meta = user.user_metadata || {};
  const fullName = String(meta.full_name || meta.name || "").trim();
  const firstName = fullName.split(/\s+/)[0] || "";
  const { subject, text, html } = welcomeEmail(firstName, user.email!);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [user.email], reply_to: REPLY_TO, subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend refused the welcome email:", res.status, detail);
    return json({ error: "send failed", status: res.status, detail }, 502);
  }
  return json({ sent: true });
});
