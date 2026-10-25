// Site brands. The same code runs two storefronts on two domains:
//   scott -- Scott's Suits (scottssuits.com): prices, Stripe checkout.
//   sw    -- S.W. Atelier, for coworkers (Daniel, 2026-10-25): its own
//            name, logo and burgundy look, NO prices anywhere and NO payment.
//            Orders go in as requests (orders.brand = 'sw') and still reach
//            admin, the order email and the factory flow.
// Everything else (designer, catalog, Supabase, admin) is shared, so every
// fix reaches both sites.
//
// Which brand a page shows, first match wins:
//   1. <html data-brand="..."> baked in by scripts/build_brand_site.py
//      (the S.W. Atelier copy of the site is built that way).
//   2. The domain (SITE_BRANDS[x].domains).
//   3. ?brand=sw / ?brand=scott in the address, remembered in this browser,
//      so the S.W. Atelier look can be tried on any domain.
//
// Loaded in <head> before style.css on every page, so the right look is
// there on first paint. Never put factory codes in anything here.
var SITE_BRANDS = {
  scott: {
    id: "scott",
    name: "Scott's Suits",
    hidePrices: false,
    payments: true,
    domains: ["scottssuits.com", "www.scottssuits.com"],
    siteUrl: "https://scottssuits.com",
  },
  sw: {
    id: "sw",
    name: "S.W. Atelier",
    tagline: "Custom Suits & Formalwear",
    hidePrices: true,
    payments: false,
    // Add the domain here once there is one (both bare and www).
    domains: [],
    siteUrl: "",
    email: "hello@scottssuits.com",
    logo: "./assets/sw/logo.png",
    logoWidth: 640,
    logoHeight: 552,
    icon: "./assets/sw/icon-192.png",
    heroImage: "./assets/sw/hero.jpg",
  },
};

var SITE_BRAND = (function () {
  var root = document.documentElement;
  var id = root.getAttribute("data-brand");
  if (!SITE_BRANDS[id]) {
    var host = (location.hostname || "").toLowerCase();
    Object.keys(SITE_BRANDS).forEach(function (k) {
      if (!SITE_BRANDS[id] && SITE_BRANDS[k].domains.indexOf(host) !== -1) id = k;
    });
  }
  if (!SITE_BRANDS[id]) {
    var asked = null;
    try { asked = new URLSearchParams(location.search).get("brand"); } catch (e) { /* old browser */ }
    try {
      if (SITE_BRANDS[asked]) localStorage.setItem("siteBrand", asked);
      id = localStorage.getItem("siteBrand");
    } catch (e) {
      id = asked;
    }
  }
  if (!SITE_BRANDS[id]) id = "scott";
  var brand = SITE_BRANDS[id];
  root.setAttribute("data-brand", id);
  if (brand.hidePrices) root.setAttribute("data-prices", "off");
  if (id !== "scott") {
    // Hidden until the page text is swapped (applySiteBrand), so the other
    // brand's name never flashes up. The timeout is a safety net.
    var hide = document.createElement("style");
    hide.id = "brandPending";
    hide.textContent = "body{visibility:hidden !important}";
    document.head.appendChild(hide);
    setTimeout(function () { if (hide.parentNode) hide.parentNode.removeChild(hide); }, 2500);
    if (brand.icon) {
      document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(function (l) {
        l.href = brand.icon;
        l.removeAttribute("sizes");
      });
    }
  }
  return brand;
})();

// True on a brand that shows no prices (S.W. Atelier).
var PRICES_HIDDEN = !!SITE_BRAND.hidePrices;

// Page text for a brand other than Scott's Suits. Static text only; main.js
// words its own dynamic text (order page, cart, admin) from SITE_BRAND.
var SITE_BRAND_TEXT = {
  sw: {
    "#welcomeIntro": null,
    ".hero-eyebrow": null,
    ".hero-sketch-left": null,
    ".suit-type-note": "Every style option is included, from the lapels to the lining.",
    "#designer .designer-head p": "Mix and match freely across fabric, collar, pockets, buttons, and more to build a jacket that's entirely your own. Click the magnifier on any option to zoom in.",
    "#fulfillShipSub": "We'll ship it to you",
    'input[name="fulfillment"][value="pickup"] ~ .fulfill-sub': "We'll contact you when it's ready.",
    ".how-it-works-list .hiw-step:nth-child(1) p": "A full suit, a jacket only, or pants only. Prefer a classic look with fewer choices? Start from a ready-made preset suit or jacket.",
    ".how-it-works-list .hiw-step:nth-child(2) p": "Pick your fabric, then choose the lapel, pockets, buttons, lining and more. Add a monogram, or upload your own photo for the lining. For the pants, match your jacket fabric or go with a contrast.",
    ".how-it-works-list .hiw-step:nth-child(3) h3": "See your suit before you order",
    ".how-it-works-list .hiw-step:nth-child(5) h3": "Choose delivery and send your order",
    ".how-it-works-list .hiw-step:nth-child(5) p": "Ship to your door, or pick up in store. Add Alteration Protection to get three free alterations. No payment is needed: send your order and you'll get a confirmation right away.",
    "footer": "S.W. Atelier — Custom Suits &amp; Formalwear. Made-to-measure suits and jackets, designed online and delivered to your door. <a href=\"./contact.html\" style=\"color:inherit;\">Contact</a> · <a href=\"./privacy.html\" style=\"color:inherit;\">Privacy Policy</a>",
    "body > .wrap > footer": "<a href=\"./\">Back to S.W. Atelier</a> · <a href=\"./contact.html\">Contact us</a>",
  },
};

// "$350", "(+$200)", "from $350" and the like, for brands with no prices.
var BRAND_PRICE_PATTERNS = [
  [/\s*\(\+\$\d[\d,.]*\)/g, ""],
  [/\s*\+\$\d[\d,.]*/g, ""],
  [/,?\s*(?:from|for|at)\s+(?:just\s+)?\$\d[\d,.]*/gi, ""],
  [/\s*\$\d[\d,.]*/g, ""],
];
function stripBrandPrices(s) {
  if (!PRICES_HIDDEN || !s || s.indexOf("$") === -1) return s;
  BRAND_PRICE_PATTERNS.forEach(function (p) { s = s.replace(p[0], p[1]); });
  return s;
}

// The brand's name in place of Scott's in a piece of text.
function brandName(s) {
  if (SITE_BRAND.id === "scott" || !s) return s;
  return s
    .replace(/Scott['’]s Suits/g, SITE_BRAND.name)
    .replace(/Scott Suits/gi, SITE_BRAND.name)
    .replace(/hello@scottssuits\.com/g, SITE_BRAND.email || "hello@scottssuits.com")
    .replace(/scottssuits\.com/g, (SITE_BRAND.siteUrl || "").replace(/^https?:\/\//, "") || "our website");
}

function applySiteBrand() {
  var brand = SITE_BRAND;
  if (brand.id === "scott") return;
  var text = SITE_BRAND_TEXT[brand.id] || {};
  Object.keys(text).forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (text[sel] === null) {
        el.hidden = true;
        el.style.display = "none";
      } else {
        el.innerHTML = text[sel];
      }
    });
  });
  document.querySelectorAll("img.logo-mark, body > .wrap > header img").forEach(function (img) {
    img.src = brand.logo;
    img.alt = brand.name + " logo";
    img.width = brand.logoWidth;
    img.height = brand.logoHeight;
  });
  var hero = document.querySelector('.hero-photo-fg[src*="hero-collage"]');
  if (hero && brand.heroImage) {
    hero.src = brand.heroImage;
    hero.alt = "Folded suit fabrics, gold tailor's scissors and a tape measure on a marble table";
  }
  document.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) { a.hidden = true; a.style.display = "none"; });
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) { a.href = brandName(a.getAttribute("href")); });
  document.title = stripBrandPrices(brandName(document.title));
  rebrandTree(document.body);
  // Text main.js writes later (option names, cart, order page) goes through
  // the same name/price swap.
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === "characterData") rebrandNode(r.target);
        else r.addedNodes.forEach(function (n) { rebrandTree(n); });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  var pending = document.getElementById("brandPending");
  if (pending) pending.parentNode.removeChild(pending);
}

function rebrandNode(n) {
  var el = n.nodeType === 3 ? n.parentElement : n;
  if (el && el.closest && el.closest(".brand-keep")) return;
  if (n.nodeType === 3) {
    var v = stripBrandPrices(brandName(n.nodeValue));
    if (v !== n.nodeValue) n.nodeValue = v;
  } else if (n.nodeType === 1) {
    ["alt", "title", "aria-label", "placeholder"].forEach(function (a) {
      var old = n.getAttribute(a);
      if (old) {
        var v = stripBrandPrices(brandName(old));
        if (v !== old) n.setAttribute(a, v);
      }
    });
  }
}
function rebrandTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return rebrandNode(root);
  if (root.nodeType !== 1 || root.tagName === "SCRIPT" || root.tagName === "STYLE") return;
  // The admin's own views keep their prices and labels.
  if (root.closest && root.closest(".brand-keep")) return;
  rebrandNode(root);
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (n.nodeType === 1 && (n.tagName === "SCRIPT" || n.tagName === "STYLE" || n.classList.contains("brand-keep"))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(rebrandNode);
}

if (SITE_BRAND.id !== "scott") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applySiteBrand);
  else applySiteBrand();
}
