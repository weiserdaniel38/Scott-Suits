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
    icon: "./assets/sw/icon-v3-192.png",
    heroImage: "./assets/sw/hero.jpg",
    // Color themes (brand.css). The first is the one shown (Daniel chose
    // midnight and champagne, 2026-10-25); any other can be tried with
    // ?theme=navy etc. (remembered in this browser, ?theme=default goes back).
    // Each has its own recolored logo and hero photo in assets/sw/
    // (logo-navy.png, hero-navy.jpg ...); burgundy uses logo.png / hero.jpg.
    // A theme listed in logos uses that file instead (Daniel's new logo,
    // 2026-10-25, gold monogram with an ivory name, made for midnight).
    logos: { midnight: "./assets/sw/logo-v3.png" },
    // The suit picture loading clip, recolored for midnight (no extension).
    loadingVideo: "./assets/sw/suit-loading-thread",
    themes: ["midnight", "burgundy", "navy", "forest", "blush"],
    // Font pairings (brand.css), picked the same way with ?font=bodoni etc.
    // The first is shown: Art Deco, Poiret One + Josefin Sans (Daniel, 2026-10-25).
    fonts: ["deco", "script", "bodoni", "cinzel", "vibes"],
  },
};

// One of a brand's looks (theme, font): ?param=x in the address, remembered
// in this browser (?param=default forgets it), else the first in the list.
function brandChoice(list, param, key) {
  var v = null;
  try {
    var asked = new URLSearchParams(location.search).get(param);
    if (asked === "default") localStorage.removeItem(key);
    else if (list.indexOf(asked) !== -1) localStorage.setItem(key, asked);
    v = localStorage.getItem(key);
  } catch (e) { /* storage blocked: the first one */ }
  return list.indexOf(v) !== -1 ? v : list[0];
}

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
  if (brand.themes) {
    brand.theme = brandChoice(brand.themes, "theme", "siteTheme");
    root.setAttribute("data-sw-theme", brand.theme);
    if (brand.theme !== "burgundy") {
      brand.logo = (brand.logos && brand.logos[brand.theme]) || brand.logo.replace(/\.png$/, "-" + brand.theme + ".png");
      brand.heroImage = brand.heroImage.replace(/\.jpg$/, "-" + brand.theme + ".jpg");
    }
  }
  if (brand.fonts) root.setAttribute("data-sw-font", brandChoice(brand.fonts, "font", "siteFont"));
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
    ".suit-type-note": "Every detail is yours to define, from the lapels to the lining.",
    "#designer .designer-head p": "Each choice shapes a jacket made for you alone: the cloth, the lapel, the pockets, the buttons and every finishing detail. Select the magnifier on any option to view it up close.",
    "#fulfillShipSub": "We'll ship it to you",
    'input[name="fulfillment"][value="pickup"] ~ .fulfill-sub': "We'll be in touch personally when it's ready.",
    ".how-it-works-list .hiw-step:nth-child(1) p": "A full suit, a jacket or a pair of pants. For a timeless look, begin from one of our classic suits or jackets.",
    ".how-it-works-list .hiw-step:nth-child(2) p": "Select your cloth, then define the lapel, pockets, buttons, lining and finishing details. Add a monogram, or a lining printed with your own photograph. For the pants, match your jacket or choose a considered contrast.",
    ".how-it-works-list .hiw-step:nth-child(3) h3": "See your suit before it is made",
    ".how-it-works-list .hiw-step:nth-child(5) h3": "Place your order",
    ".how-it-works-list .hiw-step:nth-child(5) p": "Choose delivery to your door or collection in store, and add Alteration Protection for three complimentary alterations. No payment is needed: send your order and you'll receive a confirmation right away.",
    "footer": "S.W. Atelier: Custom Suits &amp; Formalwear. Handcrafted suits and jackets, tailored to your exact measurements. <a href=\"./contact.html\" style=\"color:inherit;\">Contact</a> · <a href=\"./privacy.html\" style=\"color:inherit;\">Privacy Policy</a>",
    "body > .wrap > footer": "<a href=\"./\">Back to S.W. Atelier</a> · <a href=\"./contact.html\">Contact us</a>",
  },
};

// Whole-sentence wording for a brand, swapped wherever that exact text
// appears (static pages and text main.js writes later, like the step
// taglines and progress lines). S.W. Atelier speaks as a boutique atelier:
// handcrafted, tailored to the customer, polished but personal
// (Daniel, 2026-10-25). Keys are the Scott's Suits text, spaces collapsed.
var SITE_BRAND_COPY = {
  sw: {
    "Custom-made,": "Handcrafted,",
    "without leaving home.": "tailored to you alone.",
    "Design it online. See a free preview. Send your measurements. We make it for you.": "A private atelier for suits and formalwear, cut to your measurements and finished by hand.",
    "See how it works": "Our Process",
    "How It Works": "Our Process",
    "Close how it works": "Close our process",
    "Fully Customizable": "Handcrafted",
    "No Showroom Needed": "Cut to Your Measurements",
    "Delivered To Your Door": "Made for You Alone",
    "Fully Custom.": "Bespoke in Every Detail.",
    // Suit picture preview
    "Free preview": "Complimentary preview",
    "See your suit before you order": "See your suit before it is made",
    "We draw your suit with the fabric, buttons, lining and thread you chose. It takes a few minutes, and you can keep going to your measurements while it draws.": "We render your suit with the cloth, buttons, lining and thread you have chosen. It takes a few minutes, and you may continue to your measurements in the meantime.",
    "Generate My Suit": "Preview My Suit",
    "Sign in or create a free account to see your suit drawn. You can still order without an account.": "Sign in or create an account to see your suit rendered. You may still order without an account.",
    "This picture is AI-generated and drawn as accurately as possible. Small details may differ, but your suit is made exactly to the selections you chose.": "This image is AI-generated and drawn as faithfully as possible. Small details may differ; your suit is crafted exactly to the selections you made.",
    "while your suit is being drawn.": "while your suit is being rendered.",
    "Sorry, something went wrong drawing your suit.": "We're sorry, we couldn't complete your preview.",
    "Made Easy.": "Made for You.",
    "Custom tailoring from home": "The S.W. Atelier experience",
    "Six steps, all online. No showroom, no fittings.": "Six steps, every detail shaped around you.",
    "Choose what you're building": "Choose your piece",
    "Design every detail": "Define every detail",
    "Sign in for a free picture of your finished suit.": "Sign in for a complimentary portrait of your finished suit.",
    "Add your measurements": "Share your measurements",
    "Measure a suit that fits you, measure your body, or estimate from your usual size. Saved to your account for next time.": "Measure a suit that fits you or your body, and our tailors shape the pattern around you.",
    "Follow your suit and reorder anytime": "Follow your suit as it is made",
    "Track your suit in My Account. Reorder any time in one tap.": "Follow your suit in My Account, from cutting to delivery.",
    "What are we building?": "What shall we create for you?",
    "Pick one. You can add more pieces later.": "Select your piece. You may add more at any time.",
    "Customize your pants": "Design your pants",
    "Match your jacket or pick a contrast fabric. Tap the magnifier to zoom in.": "Match your jacket or choose a considered contrast. Select the magnifier to view up close.",
    "Let’s get started!": "Let’s begin.",
    "Great start!": "A fine beginning.",
    "Nice choice. Keep it going.": "An excellent choice.",
    "You’ve got a good eye.": "A discerning eye.",
    "Looking sharp so far.": "Your suit is taking shape.",
    "Making great progress.": "Every detail, considered.",
    "This suit is coming together.": "Truly your own.",
    "Almost halfway there!": "Nearly halfway.",
    "Over halfway there!": "Past the halfway point.",
    "Way to go! Keep those choices coming.": "Refined, and entirely yours.",
    "Looking great. The finish line’s in sight.": "The finishing touches are near.",
    "Just a few more details.": "Just a few final details.",
    "Way to go! Almost done.": "Almost complete.",
    "So close! A couple more and you’re there.": "One or two details remain.",
    "Jacket done! Now let’s design the pants.": "Your jacket is complete. Now, the pants.",
    "🎉 Your suit is fully designed! It’s going to look incredible.": "Your suit is fully designed and ready for our tailors.",
    "🎉 Your jacket is fully designed! It’s going to look incredible.": "Your jacket is fully designed and ready for our tailors.",
    "🎉 Your pants are fully designed! It’s going to look incredible.": "Your pants are fully designed and ready for our tailors.",
    "Way to go! Just your measurements left.": "Your design is complete. Now, your measurements.",
    "Last step. Your suit is nearly on its way!": "One final step before our tailors begin.",
    "Grab a tape measure and a friend. Use centimeters; height and weight can be in feet and pounds.": "Please enter your measurements in centimeters; height and weight may be in feet and pounds.",
    "Measure yourself; our tailors do the rest": "Measure yourself, and our tailors shape the pattern around you",
    "Rather have a pro measure you?": "Prefer to be measured by a tailor?",
    "Enter the store sizes you usually wear and we'll fill in a starting estimate. Adjust anything that looks off.": "Share the sizes you usually wear for a starting estimate. Please review each one.",
    "Start typing and pick your address from the list.": "Begin typing your address and select it from the list.",
    "We'll ship it to you": "Delivered to you, carefully packed",
    "Add Alteration Protection and get three free alterations after your suit arrives.": "Add Alteration Protection for three complimentary alterations after your suit arrives.",
    "Three free alterations": "Three complimentary alterations",
    "Your measurements and past orders, in one place.": "Your measurements and past orders, kept on file for you.",
    "Fill in once, reuse for every suit.": "Kept on file, ready for every suit we make for you.",
    "Questions about fabric, fit or an order? Just ask.": "Questions about cloth, fit or an order? We'd be delighted to help.",
    "Tiny stitches that brag about being handmade.": "A fine row of hand stitches along the edges, the signature of true tailoring.",
    "Your lapels walk into the room before you do.": "The lapel sets the character of your jacket.",
    "Skinny, classic or full 1970s game show host.": "From slim and modern to full and classic.",
    "A tiny slit with big boutonniere dreams.": "A finishing detail for a boutonniere or lapel pin.",
    "How many buttons are on the payroll.": "The fastening that defines your silhouette.",
    "Shoulders: smooth operator or a little extra.": "How the sleeve meets the shoulder: clean and structured, or soft and natural.",
    "A cozy apartment for your pocket square.": "A place for your pocket square.",
    "Where your hands go when the small talk dies.": "Pockets that complete the line of the jacket.",
    "A secret stitch. Tell no one.": "The pattern in which each button is sewn.",
    "The guts of the jacket. Abs optional.": "The inner structure that gives your jacket its shape.",
    "The inside trim that winks when your jacket swings open.": "How much of the interior is finished in lining.",
    "Secret pockets for pens, phones and emergency snacks.": "Discreet interior pockets, placed for you.",
    "Your initials, for when the jacket gets lost at a wedding.": "Your initials, stitched inside as a personal signature.",
    "The slit that lets you sit without splitting.": "Vents that let the jacket move with you.",
    "Working buttonholes: the tailor's secret handshake.": "Working buttonholes, a hallmark of fine tailoring.",
    "Wrist bling for people who talk with their hands.": "The arrangement of buttons at the cuff.",
    "The star of the show. Everything else is backup dancers.": "The cloth is the foundation of your suit.",
    "Business on the outside, party on the inside.": "The interior, chosen as carefully as the cloth.",
    "Blend in quietly or let your seams show off.": "Thread matched to your cloth, or chosen to stand apart.",
    "Match the suit or let your buttonholes flirt a little.": "Buttonholes in a matching or a contrasting thread.",
    "Matching thread or a tiny bit of mischief up front.": "Buttonholes finished in a matching or a contrasting thread.",
    "A sneaky pop of color for dramatic collar flips.": "The felt beneath your collar, in a matching or signature color.",
    "Whisper your initials or shout them.": "Thread for your initials, subtle or distinct.",
    "Pick a font. Your initials have feelings too.": "The lettering for your initials.",
    "Jewelry for your jacket. Bling optional.": "Buttons selected to complement your cloth.",
    "Tiny stitches so your pants can keep up with your jacket.": "Fine hand stitching to echo your jacket.",
    "Where your pants sit: regular or high and mighty.": "Where your pants sit: classic or high rise.",
    "The little tab that holds everything together. Literally.": "The tab that secures the waistband.",
    "How your waist gets hugged.": "How the waistband is finished and fitted.",
    "Sleek flat front or extra room for Thanksgiving.": "A clean flat front, or pleats for ease of movement.",
    "Loops, fancy X's or belts are for quitters.": "Belt loops in a classic or decorative style, or none at all.",
    "Where your hands go when you're thinking hard.": "The cut of your front pockets.",
    "Clean hem or a cuff with a little attitude.": "A clean hem or a classic cuff.",
    "A tiny pocket for a watch, a coin or a very small secret.": "A small pocket at the waistband, a traditional detail.",
    "Your initials, in case your pants ever wander off.": "Your initials, stitched inside as a personal signature.",
    "Buttons, flaps or nothing. Your rear, your rules.": "Back pockets finished with a button, a flap or left clean.",
    "The cloth your legs will brag about.": "The cloth for your pants, matched to your jacket or in contrast."
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

// The brand's own wording for a whole sentence (SITE_BRAND_COPY), keeping
// the spaces around it.
function brandCopy(s) {
  var map = SITE_BRAND_COPY[SITE_BRAND.id];
  if (!map || !s) return s;
  var key = s.replace(/\s+/g, " ").trim();
  if (!key || !map.hasOwnProperty(key)) return s;
  var m = s.match(/^\s*/)[0], e = s.match(/\s*$/)[0];
  return m + map[key] + e;
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
    var v = stripBrandPrices(brandName(brandCopy(n.nodeValue)));
    if (v !== n.nodeValue) n.nodeValue = v;
  } else if (n.nodeType === 1) {
    ["alt", "title", "aria-label", "placeholder"].forEach(function (a) {
      var old = n.getAttribute(a);
      if (old) {
        var v = stripBrandPrices(brandName(brandCopy(old)));
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

// Home Screen app (2026-11-01): register sw.js, which only shows
// offline.html when a page can't load. See sw.js.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}

// Pull down to refresh, only in the Home Screen app (Daniel, 2026-11-01):
// full-screen mode has no Safari reload button. Starts only when the page
// is scrolled to the very top and the finger is not inside a pop-up, a
// sticky bar or anything that scrolls or drags on its own (option lists,
// fabric zoom, 3D views), so it never fights those. Refreshing keeps the
// customer's design (the draft is saved in sessionStorage by main.js).
(function () {
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (!standalone) return;
  var THRESHOLD = 70;
  var startY = null, pull = 0, ring = null, busy = false;

  function blocked(el) {
    if (document.documentElement.classList.contains("wiz-lock")) return true;
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var tag = el.tagName;
      if (tag === "CANVAS" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "VIDEO") return true;
      var cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.position === "sticky") return true;
      if (el.scrollTop > 0) return true;
    }
    return false;
  }
  function ensureRing() {
    if (ring) return ring;
    ring = document.createElement("div");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText = "position:fixed;left:50%;top:0;z-index:2147483000;width:38px;height:38px;margin-left:-19px;" +
      "border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;align-items:center;" +
      "justify-content:center;pointer-events:none;opacity:0;transform:translateY(-48px);";
    ring.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B08D57" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
    document.body.appendChild(ring);
    return ring;
  }
  function show(d) {
    var r = ensureRing();
    var p = Math.min(d / THRESHOLD, 1);
    r.style.transition = "none";
    r.style.opacity = String(p);
    r.style.transform = "translateY(" + (Math.min(d, THRESHOLD * 1.4) - 40) + "px) rotate(" + Math.round(d * 3) + "deg)";
  }
  function hide() {
    if (!ring) return;
    ring.style.transition = "transform .2s ease, opacity .2s ease";
    ring.style.opacity = "0";
    ring.style.transform = "translateY(-48px)";
  }

  document.addEventListener("touchstart", function (e) {
    startY = null; pull = 0;
    if (busy || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) return;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (startY === null) return;
    var d = (e.touches[0].clientY - startY) * 0.55;
    if (d <= 0 || window.scrollY > 0) { pull = 0; hide(); return; }
    pull = d;
    show(d);
  }, { passive: true });
  function end() {
    if (startY === null) return;
    startY = null;
    if (pull >= THRESHOLD) {
      busy = true;
      ring.style.transition = "transform .2s ease";
      ring.style.transform = "translateY(" + (THRESHOLD - 30) + "px)";
      ring.firstChild.style.animation = "ss-ptr-spin .7s linear infinite";
      setTimeout(function () { location.reload(); }, 150);
    } else {
      hide();
    }
    pull = 0;
  }
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
  var st = document.createElement("style");
  st.textContent = "@keyframes ss-ptr-spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(st);
})();
