// Scott Suits -- confirm the email on accounts made with email + password
// (Daniel, 2026-11-17). Continue with Google is exempt: Google already
// checked the address.
//
// The site's Create Account form posts here instead of calling
// supabase.auth.signUp, so the confirmation email goes out through Resend
// (hello@scottssuits.com, same as Forgot password) and not through Supabase's
// built-in mailer, which only sends a few emails an hour.
//
//   { action: "signup", email, password, full_name, redirectTo, brand }
//       Makes the account (unconfirmed) and emails a "Confirm your email"
//       link. -> { ok: true } or { error, code: "exists" | "weak_password" | ... }
//   { action: "resend", email, redirectTo, brand }
//       Emails a fresh link if that email has an account still waiting for
//       confirmation. Always -> { ok: true } so it can't be used to look up
//       which emails have accounts.
//
// The link signs the customer in on the site. The welcome email goes out
// once the email is confirmed (trigger in supabase/sql/
// 5b_welcome_after_confirm.sql). Accounts made by admin "Measure a Client"
// are created already confirmed and never get this email.
//
// Secrets: RESEND_API_KEY (required), WELCOME_FROM, WELCOME_REPLY_TO,
// SITE_URL, RESET_ALLOWED_HOSTS -- the same ones send-password-reset uses.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Light abuse guard (per warm instance): one email per address a minute,
// and at most 6 requests per caller IP in 10 minutes.
const lastByEmail = new Map<string, number>();
const hitsByIp = new Map<string, number[]>();
function throttled(email: string, ip: string): boolean {
  const now = Date.now();
  const last = lastByEmail.get(email) || 0;
  if (now - last < 60_000) return true;
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < 600_000);
  if (hits.length >= 6) return true;
  hits.push(now);
  hitsByIp.set(ip, hits);
  lastByEmail.set(email, now);
  if (lastByEmail.size > 5000) lastByEmail.clear();
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return false;
}

// The link returns to the page they signed up on. S.W. Atelier on the
// scottssuits.com address keeps ?brand=sw, so the link opened in a mail app's
// own browser still shows S.W. Atelier.
function safeRedirect(raw: unknown, brand: unknown): string {
  let out = SITE_URL + "/";
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase())) out = u.origin + u.pathname;
  } catch {
    // fall through
  }
  const host = new URL(out).hostname;
  if (brand === "sw" && (host === "scottssuits.com" || host === "www.scottssuits.com")) out += "?brand=sw";
  return out;
}

type Brand = { name: string; accent: string; icon: string };
function brandFor(id: unknown): Brand {
  if (id === "sw") return { name: "S.W. Atelier", accent: "#74444D", icon: SITE_URL + "/assets/sw/icon-v3-192.png" };
  return { name: "Scott Suits", accent: "#74444D", icon: SITE_URL + "/assets/icon-192.png" };
}

export function confirmEmail(link: string, firstName: string, brand: Brand) {
  const hello = firstName ? "Welcome, " + firstName : "Welcome";
  const subject = "Confirm your email for " + brand.name;
  const text = [
    hello + ".",
    "",
    "Please confirm your email to finish creating your " + brand.name + " account.",
    "",
    "Confirm your email: " + link,
    "",
    "This link works once. If it has expired, tap Resend email on the site. If you didn't create an account, you can ignore this email.",
    "",
    brand.name + " -- Custom Tailoring",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2EDE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${brand.icon}" width="72" height="72" alt="${escapeHtml(brand.name)}" style="display:block;border:0;border-radius:12px;">
<p style="margin:16px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${brand.accent};">${escapeHtml(brand.name)}</p>
</td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;text-align:center;">${escapeHtml(hello)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;text-align:center;">Please confirm your email to finish creating your ${escapeHtml(brand.name)} account.</p>
</td></tr>
<tr><td align="center" style="padding:0 32px 24px;">
<a href="${escapeHtml(link)}" style="display:inline-block;background:${brand.accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">Confirm my email</a>
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">This link works once. If it has expired, tap Resend email on the site. If you didn't create an account, you can ignore this email.<br>${escapeHtml(brand.name)} &middot; Custom Tailoring</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

async function sendEmail(to: string, link: string, firstName: string, brand: Brand) {
  const { subject, text, html } = confirmEmail(link, firstName, brand);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env("RESEND_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text, html }),
  });
  if (!res.ok) {
    console.error("Resend refused the confirmation email:", res.status, await res.text());
    return false;
  }
  return true;
}

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("RESEND_API_KEY")) return json({ error: "RESEND_API_KEY is not set" }, 500);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // checked below
  }
  if (body.ping) return json({ ok: true, ready: true });
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "Please enter a valid email address.", code: "email" }, 400);
  const redirectTo = safeRedirect(body.redirectTo, body.brand);
  const brand = brandFor(body.brand);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  if (body.action === "signup") {
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim().slice(0, 120);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters.", code: "weak_password" }, 400);
    if (throttled(email, ip)) {
      return json({ error: "We just sent an email to this address. Please wait a minute and try again.", code: "throttled" }, 429);
    }
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { full_name: fullName }, redirectTo },
    });
    if (error || !data?.user || !data?.properties?.action_link) {
      const msg = String(error?.message || "");
      const code = String((error as { code?: string } | null)?.code || "");
      if (code === "email_exists" || /already|registered|exists/i.test(msg)) {
        return json({ error: "An account with this email already exists. Log in instead, or use Continue with Google.", code: "exists" }, 409);
      }
      if (code === "weak_password" || /password/i.test(msg)) {
        return json({ error: msg || "Please choose a stronger password.", code: "weak_password" }, 400);
      }
      console.error("No signup link made:", code, msg);
      return json({ error: "We couldn't create the account right now. Please try again in a few minutes.", code: "failed" }, 500);
    }
    // Signed up before but never confirmed: the account already existed, so
    // make the password and name the ones just typed.
    if (Date.now() - Date.parse(data.user.created_at) > 15_000) {
      await supabase.auth.admin.updateUserById(data.user.id, { password, user_metadata: { full_name: fullName } });
    }
    const sent = await sendEmail(email, data.properties.action_link, firstOf(fullName), brand);
    if (!sent) return json({ error: "We couldn't send the confirmation email. Please tap Resend in a minute.", code: "send_failed" }, 502);
    return json({ ok: true });
  }

  if (body.action === "resend") {
    if (throttled(email, ip)) return json({ ok: true });
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof?.id) return json({ ok: true });
    const { data: found } = await supabase.auth.admin.getUserById(prof.id);
    const user = found?.user;
    if (!user || user.email_confirmed_at) return json({ ok: true });
    const meta = user.user_metadata || {};
    // The account exists, so a magic link only signs in (it never makes a
    // new account), and opening it confirms the email.
    const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    const link = data?.properties?.action_link;
    if (error || !link) {
      console.error("No resend link made:", error?.message);
      return json({ ok: true });
    }
    await sendEmail(email, link, firstOf(String(meta.full_name || "")), brand);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
