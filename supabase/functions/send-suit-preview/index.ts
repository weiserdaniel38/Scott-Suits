// Scott Suits -- emails customers the picture of their suit (Daniel,
// 2026-11-17: "When a suit is generated automatically email the client
// their preview").
//
// Called with x-webhook-secret: <WEBHOOK_SECRET>:
//
//   { preview_id, brand }
//       From generate-suit-image when a "Generate My Suit" picture finishes.
//       Emails the signed-in customer who drew it: the picture, a short
//       summary of the design and a link to their cart (the site puts the
//       suit there by itself). One email per design: a redraw of a design
//       that was already drawn sends nothing. Admin accounts get nothing.
//       { force: true } skips both checks (one-off sends).
//
//   { orders_for_user: "<auth user id>" }
//       One email to a customer covering every suit they have ordered (paid
//       or sent to be made), each with its own picture. A suit with no
//       picture says so; nothing is ever drawn here.
//
// Never draws a picture: it only sends ones that already exist.
//
// Secrets: RESEND_API_KEY, WEBHOOK_SECRET (required); WELCOME_FROM,
// WELCOME_REPLY_TO, SITE_URL (optional, shared with the other emails).

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

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Brand = { id: string; name: string; accent: string; icon: string };
export function brandFor(id: unknown): Brand {
  if (id === "sw") return { id: "sw", name: "S.W. Atelier", accent: "#74444D", icon: SITE_URL + "/assets/sw/icon-v3-192.png" };
  return { id: "scott", name: "Scott Suits", accent: "#74444D", icon: SITE_URL + "/assets/icon-192.png" };
}

// The site link; ?open=cart / ?open=orders opens that part of the site.
export function siteLink(brand: Brand, open: "cart" | "orders") {
  return SITE_URL + "/?open=" + open + (brand.id === "sw" ? "&brand=sw" : "");
}

// ---------------------------------------------------------------------------
// The design summary, read from the plain-English visual_spec the picture was
// drawn from. Only the site's own option names, never any order codes.
// ---------------------------------------------------------------------------
type Spec = { type: string; jacket: Record<string, string>; pants: Record<string, string> };
export function parseSpec(raw: string): Spec {
  const out: Spec = { type: "", jacket: {}, pants: {} };
  let part: "jacket" | "pants" | null = null;
  for (const line of String(raw || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (/^JACKET$/.test(t)) { part = "jacket"; continue; }
    if (/^PANTS$/.test(t)) { part = "pants"; continue; }
    if (/^[A-Z][A-Z &]+$/.test(t)) { part = null; continue; } // REFERENCE SWATCHES etc.
    const m = t.match(/^([^:]{2,60}):\s*(.+)$/);
    if (!m) continue;
    if (/^Suit type$/i.test(m[1])) { out.type = clean(m[2]); continue; }
    if (part) out[part][m[1].trim()] = m[2].trim();
  }
  return out;
}
// "Rich Midnight Blue (Pinstripe pattern, ...)" -> "Rich Midnight Blue";
// drops "-- looks like: ..." notes too.
function clean(v: string) {
  return String(v || "").split(" -- ")[0].replace(/\s*\(.*$/, "").trim();
}
const SKIP = /^(none|no |not |choose|standard$|regular)/i;

export function summaryRows(raw: string): { type: string; rows: [string, string][] } {
  const s = parseSpec(raw);
  const rows: [string, string][] = [];
  const add = (label: string, v: string | undefined, keepPlain = false) => {
    const c = clean(v || "");
    if (!c || (!keepPlain && SKIP.test(c))) return;
    rows.push([label, c]);
  };
  const j = s.jacket, p = s.pants;
  const hasJacket = Object.keys(j).length > 0;
  const hasPants = Object.keys(p).length > 0;
  add("Fabric", j["Fabric"] || p["Fabric"], true);
  if (hasPants && hasJacket && p["Fabric"] && clean(p["Fabric"]) !== clean(j["Fabric"] || "")) add("Pants fabric", p["Fabric"], true);
  if (hasJacket) {
    add("Style", j["Front Button"], true);
    const lapel = clean(j["Lapel Style"] || "");
    const width = clean(j["Lapel Width"] || "");
    if (lapel) rows.push(["Lapel", lapel + (width && !/^standard$/i.test(width) ? ", " + width.toLowerCase() : "")]);
    add("Pockets", j["Lower Pockets"]);
    add("Vents", j["Back Vents"]);
    add("Lining", j["Lining"]);
    add("Buttons", j["Button Color"]);
  }
  if (hasPants) {
    add("Pleats", p["Front Pleat"], true);
    add("Trouser hem", p["Bottom Style"], true);
  }
  return { type: s.type || (hasJacket && hasPants ? "Full suit" : hasJacket ? "Jacket" : "Pants"), rows };
}

// The part before the reference photos, so a redraw of the same design
// (same choices) counts as the same design.
export const designKey = (raw: string) =>
  String(raw || "").split(/\nREFERENCE SWATCHES/)[0].replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------
export type SuitBlock = { title: string; imageUrl: string | null; raw: string; status?: string };

function suitHtml(s: SuitBlock, link: string) {
  const { rows } = summaryRows(s.raw);
  const pic = s.imageUrl
    ? `<a href="${esc(link)}"><img src="${esc(s.imageUrl)}" width="456" alt="${esc(s.title)}" style="display:block;width:100%;max-width:456px;height:auto;border:0;border-radius:8px;background:#F2EDE3;"></a>`
    : `<p style="margin:0;padding:28px 16px;background:#F2EDE3;border-radius:8px;font-size:14px;line-height:1.6;text-align:center;color:rgba(34,30,25,0.62);">We don't have a picture of this suit yet.</p>`;
  const table = rows
    .map(([k, v]) => `<tr><td width="130" style="width:130px;padding:8px 12px 5px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(34,30,25,0.55);white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:5px 0;font-size:14px;line-height:1.45;">${esc(v)}</td></tr>`)
    .join("");
  return `<tr><td style="padding:8px 32px 0;">
<p style="margin:0 0 10px;font-size:12px;letter-spacing:3px;text-transform:uppercase;text-align:center;">${esc(s.title)}${s.status ? `<br><span style="letter-spacing:1px;text-transform:none;color:rgba(34,30,25,0.62);">${esc(s.status)}</span>` : ""}</p>
${pic}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 8px;width:100%;">${table}</table>
</td></tr>`;
}

function suitText(s: SuitBlock) {
  const { rows } = summaryRows(s.raw);
  return [
    s.title + (s.status ? " (" + s.status + ")" : ""),
    s.imageUrl ? "Picture: " + s.imageUrl : "We don't have a picture of this suit yet.",
    ...rows.map(([k, v]) => k + ": " + v),
  ].join("\n");
}

export function suitEmail(o: {
  brand: Brand;
  firstName: string;
  heading: string;
  intro: string;
  suits: SuitBlock[];
  button: string;
  link: string;
  after: string;
  subject: string;
}) {
  const hello = o.firstName ? "Hi " + o.firstName + "," : "Hi,";
  const text = [
    hello,
    "",
    o.intro,
    "",
    ...o.suits.map(suitText).join("\n\n").split("\n"),
    "",
    o.after,
    o.button + ": " + o.link,
    "",
    "Questions? Just reply to this email.",
    "",
    o.brand.name + " -- Custom Tailoring",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2EDE3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#221E19;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${o.brand.icon}" width="64" height="64" alt="${esc(o.brand.name)}" style="display:block;border:0;border-radius:12px;">
<p style="margin:14px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${o.brand.accent};">${esc(o.brand.name)}</p>
</td></tr>
<tr><td style="padding:8px 32px 8px;">
<h1 style="margin:0 0 14px;font-size:22px;font-weight:500;letter-spacing:3px;text-transform:uppercase;text-align:center;">${esc(o.heading)}</h1>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;">${esc(hello)}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${esc(o.intro)}</p>
</td></tr>
${o.suits.map((s) => suitHtml(s, o.link)).join("\n")}
<tr><td style="padding:8px 32px 0;">
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;text-align:center;">${esc(o.after)}</p>
</td></tr>
<tr><td align="center" style="padding:0 32px 28px;">
<a href="${esc(o.link)}" style="display:inline-block;background:${o.brand.accent};color:#ffffff;text-decoration:none;font-weight:500;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;border-radius:999px;">${esc(o.button)}</a>
</td></tr>
<tr><td style="padding:0 32px 32px;border-top:1px solid rgba(34,30,25,0.12);">
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(34,30,25,0.62);text-align:center;">Questions? Just reply to this email.<br>${esc(o.brand.name)} &middot; Custom Tailoring</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject: o.subject, text, html };
}

export function previewEmail(brand: Brand, firstName: string, raw: string, imageUrl: string) {
  const { type } = summaryRows(raw);
  return suitEmail({
    brand,
    firstName,
    heading: "Your suit design",
    intro: "Here is the picture of the suit you designed.",
    suits: [{ title: type, imageUrl, raw }],
    after: "It's saved in your cart. Add your measurements whenever you're ready to order.",
    button: "View my cart",
    link: siteLink(brand, "cart"),
    subject: "Your suit design from " + brand.name,
  });
}

const STATUS: Record<string, string> = {
  sent_to_factory: "In production",
  cutting: "Being cut",
  sewing: "Being sewn",
  finishing: "Final finishing",
  factory_shipped: "On its way to us",
  final_inspection: "Final inspection",
  shipped: "Shipped",
  delivered: "Delivered",
};
const TYPE: Record<string, string> = { full_suit: "Full suit", jacket_only: "Jacket", pants_only: "Pants" };

// ---------------------------------------------------------------------------
async function account(userId: string) {
  const { data } = await supabase.auth.admin.getUserById(userId);
  const user = data?.user;
  if (!user?.email) return null;
  const meta = user.user_metadata || {};
  const full = String(meta.full_name || meta.name || "").trim();
  return { email: user.email, firstName: full.split(/\s+/)[0] || "" };
}
async function isAdmin(userId: string) {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}
async function send(to: string, mail: { subject: string; text: string; html: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env("RESEND_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend refused the suit email:", res.status, detail);
    return { sent: false, status: res.status, detail: detail.slice(0, 300) };
  }
  return { sent: true, to };
}

async function forPreview(id: string, brandId: unknown, force: boolean) {
  const { data: prev } = await supabase
    .from("suit_previews")
    .select("id, user_id, status, image_url, visual_spec, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!prev || prev.status !== "done" || !prev.image_url) return json({ sent: false, reason: "no picture" });
  if (!prev.user_id) return json({ sent: false, reason: "signed out" });
  if (!force) {
    if (await isAdmin(prev.user_id)) return json({ sent: false, reason: "admin" });
    // Same design drawn before (a redraw): that one was already emailed.
    const { data: earlier } = await supabase
      .from("suit_previews")
      .select("id, visual_spec")
      .eq("user_id", prev.user_id)
      .eq("status", "done")
      .neq("id", prev.id)
      .lt("created_at", prev.created_at)
      .gt("created_at", new Date(Date.parse(prev.created_at) - 30 * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(60);
    const key = designKey(prev.visual_spec);
    if ((earlier || []).some((e) => designKey(e.visual_spec) === key)) return json({ sent: false, reason: "redraw" });
  }
  const who = await account(prev.user_id);
  if (!who) return json({ sent: false, reason: "no email" });
  const r = await send(who.email, previewEmail(brandFor(brandId), who.firstName, prev.visual_spec, prev.image_url));
  return json(r, r.sent ? 200 : 502);
}

async function forOrders(userId: string) {
  const { data: rows, error } = await supabase
    .from("orders")
    .select("order_id, suit_number, suit_type, visual_spec, image_status, image_url, shipping_status, brand, payment_status, factory_order_no, customer_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("suit_number", { ascending: true });
  if (error) return json({ error: error.message }, 500);
  const suits = (rows || []).filter((r) => r.payment_status === "paid" || r.factory_order_no);
  if (!suits.length) return json({ sent: false, reason: "no orders" });
  const who = await account(userId);
  if (!who) return json({ sent: false, reason: "no email" });
  const brand = brandFor(suits[0].brand);
  const many = suits.length > 1;
  const blocks: SuitBlock[] = suits.map((r, i) => ({
    title: (many ? "Suit " + (i + 1) + " · " : "") + (TYPE[r.suit_type] || "Suit"),
    imageUrl: r.image_status === "done" && r.image_url ? r.image_url : null,
    raw: r.visual_spec || "",
    status: STATUS[r.shipping_status || ""] || "",
  }));
  const mail = suitEmail({
    brand,
    firstName: who.firstName || String(suits[0].customer_name || "").trim().split(/\s+/)[0] || "",
    heading: many ? "Your suits" : "Your suit",
    intro: many ? "Here are the pictures of the suits you ordered from us." : "Here is the picture of the suit you ordered from us.",
    suits: blocks,
    after: "You can follow your order any time in My Account.",
    button: "View my order",
    link: siteLink(brand, "orders"),
    subject: (many ? "Your suits from " : "Your suit from ") + brand.name,
  });
  const r = await send(who.email, mail);
  return json({ ...r, suits: blocks.length, pictures: blocks.filter((b) => b.imageUrl).length }, r.sent ? 200 : 502);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorized" }, 401);
  if (!env("RESEND_API_KEY")) return json({ error: "RESEND_API_KEY is not set" }, 500);
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // checked below
  }
  const UUID = /^[0-9a-f-]{36}$/i;
  if (typeof body.preview_id === "string" && UUID.test(body.preview_id)) {
    return forPreview(body.preview_id, body.brand, body.force === true);
  }
  if (typeof body.orders_for_user === "string" && UUID.test(body.orders_for_user)) {
    return forOrders(body.orders_for_user);
  }
  return json({ error: "preview_id or orders_for_user required" }, 400);
});
