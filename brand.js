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
    "Design every detail of your custom suit online, see a free preview of your finished suit, send your measurements, and we build it for you.": "A private atelier for suits and formalwear. Every piece is cut to your measurements and finished by hand, shaped around your style, your fit and your occasion.",
    "See how it works": "Discover our process",
    "Fully Customizable": "Handcrafted",
    "No Showroom Needed": "Cut to Your Measurements",
    "Delivered To Your Door": "Made for You Alone",
    "Fully Custom.": "Bespoke in Every Detail.",
    "Made Easy.": "Made for You.",
    "Custom tailoring from home": "The S.W. Atelier experience",
    "Six simple steps, all online. No showroom visit and no fittings needed.": "A personal tailoring service in six steps, with every detail shaped around you.",
    "Choose what you're building": "Choose your piece",
    "Design every detail": "Define every detail",
    "Get a free picture of your finished suit with all your choices, so you know exactly what you're ordering. Sign in to create one.": "Receive a complimentary portrait of your finished suit with every choice in place, so you know exactly what we will craft for you. Sign in to create one.",
    "Add your measurements": "Share your measurements",
    "Enter the sizes of a suit that fits you well, or measure your body and pick a fit and our tailors do the rest. You can also estimate from your usual size in seconds. We check every number is in a sensible range, and if you have an account your measurements are saved for next time.": "Provide the measurements of a suit that fits you well, or your body measurements and preferred fit, and our tailors shape the pattern around you. Every figure is reviewed, and with an account your measurements are kept on file for your next suit.",
    "Follow your suit and reorder anytime": "Follow your suit as it is made",
    "In My Account, watch your suit move from cutting and sewing all the way to delivery, with a tracking link once it ships. Love it? Reorder any past order in one tap.": "In My Account, follow your suit from cutting and hand finishing through to delivery, with tracking once it ships. Any past order can be made again whenever you wish.",
    "What are we building?": "What shall we create for you?",
    "Pick one to start. You can add another piece to the same order later.": "Select the piece we will create for you. You may add further pieces to the same order at any time.",
    "Customize your pants": "Design your pants",
    "Pick the fabric and style for your pants — match your jacket or make a statement with a contrasting fabric, the choice is entirely yours. Click the magnifier on any option to zoom in.": "Choose the cloth and cut of your pants, matched to your jacket or in a considered contrast. Select the magnifier on any option to view it up close.",
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
    "Grab a tape measure (a patient friend helps). Measurements are in centimeters; height and weight can be in feet and pounds.": "Your measurements are the foundation of a suit cut for you alone. Please enter them in centimeters; height and weight may be in feet and pounds.",
    "Measure yourself; our tailors do the rest": "Measure yourself, and our tailors shape the pattern around you",
    "Rather have a pro measure you?": "Prefer to be measured by a tailor?",
    "Tell us the off-the-rack sizes you normally wear and we'll fill in a starting estimate for every measurement below in seconds — review (and adjust) anything that doesn't feel right before continuing.": "Share the sizes you usually wear and we will prepare a starting estimate for every measurement below. Please review and refine each one before continuing.",
    "Start typing your street address and pick it from the list — the fastest way to get your suit to the right door.": "Begin typing your address and select it from the list, so your suit reaches you safely.",
    "We'll ship it to you": "Delivered to you, carefully packed",
    "Add Alteration Protection and get three free alterations, so if anything needs adjusting after your suit arrives, we fix it at no cost.": "Add Alteration Protection for three complimentary alterations, so your suit can be refined until it fits exactly as it should.",
    "Three free alterations": "Three complimentary alterations",
    "Save your measurements once and see your past orders any time.": "Your measurements and past orders, kept on file for you.",
    "Fill these in once and reuse them any time you design a new suit.": "Kept on file, ready for every suit we make for you.",
    "Questions about fabrics, fit or an order? We're happy to help.": "Whether your question is about cloth, fit or an order, we would be delighted to help you personally.",
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
