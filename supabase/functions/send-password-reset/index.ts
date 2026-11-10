// Scott Suits -- "Forgot password?" in the sign-in box.
//
// The site posts { email, redirectTo } here. If an account exists for that
// email, this makes a one-time Supabase password-reset link and emails it
// through Resend (same sender as the welcome email). Supabase's own built-in
// mailer is not used: it only allows a few emails an hour for the whole
// project and only delivers to the project's team members.
//
// The answer is always { ok: true } so the form can't be used to find out
// which emails have accounts. The link brings the customer back to the site,
// where supabase-js signs them in for recovery and main.js shows the
// "Set a new password" form.
//
// Secrets (already set for send-welcome-email):
//   RESEND_API_KEY   required
//   WELCOME_FROM     optional, default "Scott Suits <hello@scottssuits.com>"
//   WELCOME_REPLY_TO optional, default scottsuits4@gmail.com
//   SITE_URL         optional, default https://scottssuits.com
//   RESET_ALLOWED_HOSTS optional, extra comma-separated hosts the link may
//                    return to (scottssuits.com and www are always allowed)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SITE_URL = env("SITE_URL", "https://scottssuits.com").replace(/\/+$/, "");
const FROM = env("WELCOME_FROM", "Scott Suits <hello@scottssuits.com>");
const REPLY_TO = env("WELCOME_REPLY_TO", "scottsuits4@gmail.com");
const ALLOWED_HOSTS = new Set(
  ["scottssuits.com", "www.scottssuits.com", ...env("RESET_ALLOWED_HOSTS").split(",")]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Light abuse guard (per warm instance): one email per address a minute,
// and at most 5 requests per caller IP in 10 minutes.
const lastByEmail = new Map<string, number>();
const hitsByIp = new Map<string, number[]>();
function throttled(email: string, ip: string): boolean {
  const now = Date.now();
  const last = lastByEmail.get(email) || 0;
  if (now - last < 60_000) return true;
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < 600_000);
  if (hits.length >= 5) return true;
  hits.push(now);
  hitsByIp.set(ip, hits);
  lastByEmail.set(email, now);
  if (lastByEmail.size > 5000) lastByEmail.clear();
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return false;
}

function safeRedirect(raw: unknown): string {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
      return u.origin + u.pathname;
    }
  } catch {
    // fall through
  }
  return SITE_URL + "/";
}

export function resetEmail(link: string, siteUrl = SITE_URL) {
  const subject = "Reset your Scott Suits password";
  const text = [
    "We received a request to reset the password for your Scott Suits account.",
    "",
    "Set a new password: " + link,
    "",
    "This link works once and expires in one hour. If you didn't ask for this, you can ignore this email.",
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
<p style="margin:16px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#74444D;">Scott Suits</p>
</td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;text-align:center;">Reset your password</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">We received a request to reset the password for your Scott Suits account. Tap the button below to choose a new one.</p>
</td></tr>
<tr><td align="center" style="padding:0 32px 24px;">
<a href="${escapeHtml(link)}" style="display:inline-block;background:#74444D;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">Set a new password</a>
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">This link works once and expires in one hour. If you didn't ask for this, you can ignore this email.<br>Scott Suits &middot; Custom Tailoring</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
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
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "valid email required" }, 400);
  }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (throttled(email, ip)) return json({ ok: true });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: safeRedirect(body.redirectTo) },
  });
  // No account for this email (or any other refusal): same answer as success.
  const link = data?.properties?.action_link;
  if (error || !link) {
    if (error) console.log("No reset link made:", error.message);
    return json({ ok: true });
  }

  const { subject, text, html } = resetEmail(link);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], reply_to: REPLY_TO, subject, text, html }),
  });
  if (!res.ok) {
    console.error("Resend refused the reset email:", res.status, await res.text());
    return json({ error: "send failed" }, 502);
  }
  return json({ ok: true });
});
