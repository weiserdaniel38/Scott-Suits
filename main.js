try { if (window.self !== window.top) document.documentElement.classList.add("is-framed"); } catch (e) { document.documentElement.classList.add("is-framed"); }
// Step background graphics (cloth / lapel / felt / button / pocket sketches) are
// switched OFF for now and saved for later -- see saved_step_backgrounds.css.txt
// and the hero-*-sketch.jpg / hero-fabric-drape.jpg files in assets/. Set to
// true (and paste the saved CSS back into style.css) to bring them back.
const STEP_BACKGROUNDS_ENABLED = false;
const suitTypeSection = document.getElementById("suitTypeSection");
const jacketSection = document.getElementById("designer");
const pantsSection = document.getElementById("pantsSection");
const previewSection = document.getElementById("previewSection");
const measurementsSection = document.getElementById("measurementsSection");
const personalInfoSection = document.getElementById("personalInfoSection");
const confirmationSection = document.getElementById("confirmationSection");
const measureGrid = document.getElementById("measureGrid");
const ALL_STEPS = [suitTypeSection, jacketSection, pantsSection, previewSection, measurementsSection, personalInfoSection, confirmationSection];
const MOBILE_BREAKPOINT = 900;

// The flat price for one whole suit (jacket + pants together), and for a
// jacket ordered on its own -- see the suitTypeSection fork right after
// "Start Designing" (chooseSuitType() below). Kept as constants here so the
// designer summary, cart total, and PayPal amount can never drift out of
// sync with what the customer was actually shown while designing. Declared
// up here (rather than down by the rest of the cart code) because
// renderMeasurementFields() -- which runs immediately, right after it's
// defined, further down this file -- already needs activeMeasurements()
// below, which in turn needs currentSuitType to already exist.
const SUIT_PRICE_USD = 350;
const JACKET_ONLY_PRICE_USD = 250;

// Which suit type is currently loaded into the jacket/pants/measurements
// designer -- "full" (jacket + pants) or "jacketOnly". Set by chooseSuitType()
// when a customer picks one of the two cards on suitTypeSection, and read
// everywhere pricing, the progress bar, required measurements, or the
// Continue/Back button wording needs to know which flow is active. Defaults
// to "full" so anything that runs before a type is ever chosen (or an old
// saved draft from before this feature existed) behaves exactly as before.
let currentSuitType = "full";

function suitPriceForType(type) {
  return type === "jacketOnly" ? JACKET_ONLY_PRICE_USD : SUIT_PRICE_USD;
}

// Extra charge for the customer's own lining photo (catalog option
// LINING_UPLOAD_OPTION, +$80) -- 0 unless that exact lining is selected.
function liningUploadSurcharge(jacketSel) {
  return jacketSel && jacketSel.lining === LINING_UPLOAD_OPTION.name ? LINING_UPLOAD_OPTION.surchargeUsd : 0;
}
// Price of one suit in the cart: the flat suit-type price plus any option
// surcharge (currently only the custom lining photo).
function itemPriceUsd(item) {
  return suitPriceForType(item.type) + liningUploadSurcharge(item.jacket);
}

// The measurement fields relevant to the suit type currently being designed
// -- a "Jacket Only" order only asks for (and only requires) the 8 jacket
// measurements, not the 8 pants ones nobody needs for an order with no
// pants in it. See the "part" field on each MEASUREMENTS entry in catalog.js.
function activeMeasurements() {
  return currentSuitType === "jacketOnly" ? MEASUREMENTS.filter((m) => m.part === "jacket") : MEASUREMENTS;
}
// Set true only once an order has actually been saved -- used solely to mark
// the "Order" step in the progress bar as done; see updateProcessBar().
let orderSubmitted = false;

// Soft, custom-eased smooth scrolling -- the browser's native
// `behavior:"smooth"` varies a lot across browsers and OSes, and on several
// mobile browsers it reads as a quick, hard snap rather than a gentle glide.
// Animating the scroll position ourselves with an ease-in-out curve gives
// the same soft motion everywhere, for both the vertical page scroll and the
// horizontal category-tab strip.
const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function scrollDuration(distance) {
  // Short hops stay quick, long ones take a little longer, both capped so
  // nothing ever feels sluggish.
  return Math.min(900, Math.max(380, Math.abs(distance) * 0.6));
}

function animateScrollValue(getPos, setPos, targetPos, onComplete) {
  const startPos = getPos();
  const delta = targetPos - startPos;
  if (Math.abs(delta) < 1) {
    if (onComplete) onComplete();
    return;
  }
  if (prefersReducedMotion) {
    setPos(targetPos);
    if (onComplete) onComplete();
    return;
  }
  const duration = scrollDuration(delta);
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    setPos(startPos + delta * easeInOutCubic(t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete();
    }
  }
  requestAnimationFrame(step);
}

function smoothScrollWindowTo(targetY, onComplete) {
  animateScrollValue(() => window.scrollY, (y) => window.scrollTo(0, y), Math.max(targetY, 0), onComplete);
}

// A fast flick through a long list (e.g. picking a shade near the bottom of
// a 50+ option color family right after scrolling to it) can still be
// decelerating under the phone's own native inertial/momentum scrolling at
// the moment the tap registers. Starting our own scrollTo-driven animation
// while that's still happening doesn't fail loudly -- it races it: the
// browser keeps overwriting window.scrollY with the momentum's own values
// every frame, silently overriding whatever position our animation just
// set, right up until momentum finally decays. Our animation still runs to
// completion on its own internal clock regardless (it isn't watching the
// real scroll position, just counting elapsed time against the distance it
// was told to cover) and still fires onComplete/swaps the tab content on
// schedule -- so the net effect is exactly "nothing visibly moved, but the
// category changed anyway". Waiting here until scrollY has actually held
// still for a few consecutive frames (bailing out after a short cap so a
// genuinely idle page -- nothing to wait for -- doesn't stall) means the
// scroll animation that follows starts from a real, settled position
// instead of racing a target the phone is still moving on its own.
function afterScrollSettles(cb) {
  let lastY = window.scrollY;
  let stableFrames = 0;
  const REQUIRED_STABLE_FRAMES = 3;
  const MAX_WAIT_MS = 500;
  const startTime = performance.now();
  function check() {
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 0.5) {
      stableFrames++;
    } else {
      stableFrames = 0;
      lastY = y;
    }
    if (stableFrames >= REQUIRED_STABLE_FRAMES || performance.now() - startTime > MAX_WAIT_MS) {
      cb();
      return;
    }
    requestAnimationFrame(check);
  }
  requestAnimationFrame(check);
}

// afterScrollSettles (above) waits out native momentum, but "wait up to
// 500ms" is a guess, not a guarantee -- a fast enough flick through a
// genuinely long list (Navy's 59 shades, Charcoal's 78) can keep drifting
// well past that cap on a real phone (our own testing only ever simulated
// a mild, short-lived momentum, which is why this slipped through). When
// that happens, afterScrollSettles gives up and proceeds anyway against a
// scroll position that's still actively changing on its own, and our
// subsequent scrollTo-driven animation races that ongoing native momentum
// frame by frame -- the browser keeps silently overwriting window.scrollY
// with the momentum's own values, so the animation still completes and
// swaps content right on schedule, but the screen can visibly end up
// wherever the momentum happened to drift to. Once the post-swap content
// is shorter (e.g. a 2-shade "Purple" grid instead of the 59-shade list
// that was just scrolled through), that stray position can clamp all the
// way down to the very bottom of the now-shorter page -- which, on
// mobile, is where the "Your Suit" summary lives (see .summary's
// position:static override in the mobile media query in style.css).
//
// Rather than hoping the wait was long enough, this stops native momentum
// outright: toggling overflow:hidden on the scrolling root is a
// well-established way to hard-cancel a browser's in-progress inertial
// scroll (the technique behind most "scroll lock" libraries) -- it drops
// whatever velocity the browser was carrying, and that velocity does not
// resume once overflow is restored. Call this instead of/in addition to
// afterScrollSettles immediately before reading scroll position or
// starting our own animation, so there is nothing left to race.
function killScrollMomentum() {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const prevHtmlOverflow = htmlEl.style.overflow;
  const prevBodyOverflow = bodyEl.style.overflow;
  htmlEl.style.overflow = "hidden";
  bodyEl.style.overflow = "hidden";
  // Force layout so the browser actually applies the overflow change (and
  // drops the momentum) before it's undone -- without reading a layout
  // property here, the two style writes could get coalesced into a single
  // no-op paint and never actually take effect.
  void htmlEl.offsetHeight;
  htmlEl.style.overflow = prevHtmlOverflow;
  bodyEl.style.overflow = prevBodyOverflow;
}

// The nav AND the process (step progress) bar are both sticky (see
// style.css) and together permanently occupy this many px at the top of the
// viewport. Any scroll target computed as "land at the top of the viewport"
// needs this subtracted first, or the target lands right underneath them
// instead of actually clearing them. The +12 is just a little breathing
// room so a heading's own edge doesn't sit flush against the process bar's
// bottom border.
function getNavClearance() {
  const navEl = document.querySelector("nav");
  const processEl = document.querySelector(".process");
  const navHeight = navEl ? navEl.getBoundingClientRect().height + (parseFloat(getComputedStyle(navEl).top) || 0) : 0;
  const processHeight = processEl ? processEl.getBoundingClientRect().height : 0;
  return navHeight + processHeight + 12;
}

// Keeps --nav-height in sync with the real nav bar's rendered height, since
// it varies by breakpoint and content (e.g. Start Over vs Start Designing)
// and a fixed CSS value would drift out of sync. This is what lets the
// process bar's `top: var(--nav-height)` (see style.css) sit flush against
// the bottom of the nav instead of overlapping it or leaving a gap.
//
// Also sets --tabs-sticky-top (nav height + process height, no extra
// breathing room -- unlike getNavClearance() above, this one wants the
// category tab strip flush against the process bar's bottom edge, not
// offset from it) so the mobile category tabs (.tabs on the Jacket/Pants
// steps -- see style.css) can stick right underneath both bars instead of
// scrolling away with the options list. Both bars vary by breakpoint and
// content, so this is computed rather than hardcoded, same reasoning as
// --nav-height itself.
function syncStickyOffsets() {
  const navEl = document.querySelector("nav");
  if (!navEl) return;
  // The nav may stick a little below the top of the screen (see .is-framed in
  // style.css), so everything that sticks under it offsets by that too.
  const navStickyTop = parseFloat(getComputedStyle(navEl).top) || 0;
  const navHeight = navEl.getBoundingClientRect().height + navStickyTop;
  document.documentElement.style.setProperty("--nav-height", navHeight + "px");
  const processEl = document.querySelector(".process");
  const processHeight = processEl ? processEl.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty("--tabs-sticky-top", (navHeight + processHeight) + "px");
}
syncStickyOffsets();
window.addEventListener("resize", syncStickyOffsets);
window.addEventListener("load", syncStickyOffsets);
if (window.ResizeObserver) { const _nav = document.querySelector("nav"); if (_nav) new ResizeObserver(syncStickyOffsets).observe(_nav); }

// The step-by-step Back/Next bar and Review sheet sit at the bottom of the
// screen; the temporary QA nav bar is fixed there too, so tell the CSS how
// tall it currently is (0 when hidden or removed) and keep clear of it.
function syncQaOffset() {
  const qa = document.getElementById("qaNavBar");
  const h = qa && !qa.hidden && getComputedStyle(qa).display !== "none" ? qa.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty("--qa-nav-height", h + "px");
}
syncQaOffset();
window.addEventListener("resize", syncQaOffset);
window.addEventListener("load", syncQaOffset);
(function () {
  const qa = document.getElementById("qaNavBar");
  if (qa && window.MutationObserver) new MutationObserver(syncQaOffset).observe(qa, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
})();

function smoothScrollContainerToX(container, targetX) {
  animateScrollValue(() => container.scrollLeft, (x) => { container.scrollLeft = x; }, Math.max(targetX, 0));
}

// On phones the hero + progress bar can be a full screen tall, so jumping to
// the very top of the page after every Continue/Back click buried whatever
// step you'd just moved to. Desktop has room to spare, so it keeps the
// original "back to top" behavior unchanged.
// Each step has a header/description block before the part where the
// customer actually starts picking things -- when jumping to a step, skip
// straight past that header so they land right where they can start
// selecting, instead of at the top of the page or the top of the section.
const STEP_FOCUS_SELECTOR = {
  designer: "#designerGrid",
  pantsSection: "#pantsGrid",
  // A plain selector lands on the size estimator when neither shortcut
  // banner above it is showing. But when one IS showing (see
  // samePreviousMeasurementsBanner / savedMeasurementsBanner in index.html),
  // it sits between the skipped-past heading and the estimator -- landing on
  // the estimator would leave that banner's height straddling the sticky
  // nav/process bar, half-covered rather than either skipped past cleanly or
  // shown in full. A function here (instead of a plain selector string) picks
  // whichever is actually topmost right now, so it lands fully in view.
  previewSection: ".designer-head",
  measurementsSection: () =>
    document.querySelector("#samePreviousMeasurementsBanner:not([hidden])") ||
    document.querySelector("#savedMeasurementsBanner:not([hidden])") ||
    document.getElementById("sizeEstimateBox"),
  personalInfoSection: ".customer-name-field",
  // suitTypeSection now centers its content inside a taller box (see
  // style.css), so landing on the section's own top edge stops short,
  // right at the start of that centering whitespace, instead of at the
  // actual heading/cards -- targeting the heading here skips past it, the
  // same trick the other steps above use to land on their real content.
  suitTypeSection: ".designer-head",
};

function scrollToStepTop(el, onComplete) {
  // Every caller (goToStep, startDesigning, executeStartOver, goToStepById)
  // already marks `el` "active" in the DOM before calling this, but doesn't
  // sync the process bar's own visibility (show/hide -- see updateProcessBar)
  // until afterward, via saveDraft(). That left a window where this
  // function's own measurements below, and ensureScrollRoom's page-height
  // check, ran against the OLD process-bar state -- e.g. still visible (and
  // occupying ~74px of real layout space) a moment before it's hidden for
  // suitTypeSection, which both threw off getNavClearance() and undercut the
  // scroll-room buffer just after it was set, clamping the scroll short.
  // Doing it here first means every measurement below reflects the page's
  // actual final layout for the step being navigated to.
  updateProcessBar();
  // Measurements is the exception: on a phone, skipping straight to the
  // size estimator (past the heading/intro) matters because that header
  // eats real screen space. On desktop there's room for the heading, the
  // intro line, the estimator AND the full measurement grid to all land in
  // view together, so there's nothing to skip past -- land at the actual
  // top of the section instead.
  const useFocusSelector = el.id !== "measurementsSection" || window.innerWidth <= MOBILE_BREAKPOINT;
  const selector = useFocusSelector ? STEP_FOCUS_SELECTOR[el.id] : null;
  let target = el;
  if (selector) {
    target = (typeof selector === "function" ? selector() : el.querySelector(selector)) || el;
  }
  const targetY = window.scrollY + target.getBoundingClientRect().top - getNavClearance();
  ensureScrollRoom(targetY);
  smoothScrollWindowTo(targetY, onComplete);
}

// A short step -- namely suitTypeSection, which now centers its content in
// a viewport-sized box (see style.css) -- can leave too little real page
// height below it for the browser to actually reach a scroll target near
// its own bottom: window.scrollTo silently clamps to whatever the page's
// true max scroll is, so the animation above stops short and the target
// content never quite reaches the nav, no matter what target Y was asked
// for. #scrollSlack (an empty div right after the footer, see index.html)
// is grown just enough, right before scrolling, to guarantee the target is
// actually reachable -- and left there afterward rather than shrunk back,
// since removing it once scrolled that far would yank the scroll position
// back up the instant the page's height changed under it.
function ensureScrollRoom(targetY) {
  const slack = document.getElementById("scrollSlack");
  if (!slack) return;
  slack.style.height = "0px";
  const shortfall = targetY + window.innerHeight - document.documentElement.scrollHeight;
  slack.style.height = (shortfall > 0 ? shortfall : 0) + "px";
}

// Swapping which step is "active" hides the outgoing section immediately
// (display:none) and shows the incoming one -- if the customer is scrolled
// down into a tall section (say, deep in the jacket options) when that
// happens, the page's scrollable height shrinks the instant the old content
// disappears, and the browser is forced to snap the scroll position up right
// then, with no animation possible. That instant, un-animated snap is what
// read as a harsh jump even though the scroll that followed it was smoothly
// eased. Scrolling up to the top of the section being left FIRST, while it's
// still fully visible, means there's nothing left above the fold to yank the
// scroll position around when it's hidden a moment later.
function goToStep(hideEl, showEl) {
  const swap = () => {
    hideEl.classList.remove("active");
    showEl.classList.add("active");
    if (showEl === measurementsSection && typeof renderMeasureChrome === "function") renderMeasureChrome();
    if (showEl === previewSection) setTimeout(updateDesignPreviewPanel, 0);
    if (showEl === personalInfoSection && typeof renderPersonalChrome === "function") renderPersonalChrome();
    scrollToStepTop(showEl);
    saveDraft();
  };
  const hideTop = window.scrollY + hideEl.getBoundingClientRect().top - getNavClearance();
  if (window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}

// "How It Works" overlay -- reachable from the nav link and the hero button.
// A small accessible modal: focus moves to the close button on open and back
// to whatever was clicked to open it once closed, Escape closes it, and
// clicking the dark backdrop (outside the panel) closes it too.
(function () {
  const overlay = document.getElementById("howItWorksOverlay");
  if (!overlay) return;
  const closeBtn = document.getElementById("howItWorksClose");
  const navBtn = document.getElementById("howItWorksNavBtn");
  const heroBtn = document.getElementById("howItWorksHeroBtn");
  const startBtn = document.getElementById("howItWorksStartBtn");
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  function open(triggerEl) {
    lastFocused = triggerEl || document.activeElement;
    overlay.classList.add("open");
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    overlay.classList.remove("open");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  if (navBtn) navBtn.addEventListener("click", (e) => open(e.currentTarget));
  if (heroBtn) heroBtn.addEventListener("click", (e) => open(e.currentTarget));
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      close();
      startDesigning();
    });
  }
})();

// ============================================================
// CUSTOMER ACCOUNTS -- optional. Guest checkout keeps working exactly as it
// always has; signing in (a one-time link emailed to you, no password) adds
// two conveniences on top: measurements saved to a profile so they don't
// need retyping on a future visit, and a "Past Orders" list. Needs
// add_customer_profiles_migration.sql run once in Supabase before any of
// this actually works -- everything below fails silently (console-only,
// never a broken page) until then, same as the rest of the site's optional
// integrations when their setup step hasn't been done yet.
// ============================================================

// Mirrors the check inside getSupabase() (see supabaseClient.js) without
// throwing -- this whole feature needs to quietly no-op on page load if
// Supabase isn't configured yet, not take down every other script below it.
function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL !== "undefined" &&
    typeof SUPABASE_ANON_KEY !== "undefined" &&
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("PASTE_YOUR") &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR")
  );
}

// The signed-in customer (a Supabase auth "user" object) and their saved
// profile row ({ id, email, measurements }), or null/null when signed out.
// Kept as plain module state, same pattern as currentSuitType/cartItems.
let currentUser = null;
let currentProfile = null;

const accountIconBtn = document.getElementById("accountIconBtn");
const accountBadge = document.getElementById("accountBadge");
const accountOverlay = document.getElementById("accountOverlay");
const accountLoggedOutView = document.getElementById("accountLoggedOutView");
const accountLoggedInView = document.getElementById("accountLoggedInView");
const googleAuthBtn = document.getElementById("googleAuthBtn");
const showSignupTabBtn = document.getElementById("showSignupTabBtn");
const showLoginTabBtn = document.getElementById("showLoginTabBtn");
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const signupNameInput = document.getElementById("signupNameInput");
const signupEmailInput = document.getElementById("signupEmailInput");
const signupPasswordInput = document.getElementById("signupPasswordInput");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const accountStatusMsg = document.getElementById("accountStatusMsg");
const accountNameDisplay = document.getElementById("accountNameDisplay");
const accountLogoutBtn = document.getElementById("accountLogoutBtn");
const profileMeasureGrid = document.getElementById("profileMeasureGrid");
const saveProfileMeasurementsBtn = document.getElementById("saveProfileMeasurementsBtn");
const profileMeasurementsStatusMsg = document.getElementById("profileMeasurementsStatusMsg");
const pastOrdersList = document.getElementById("pastOrdersList");
const savedMeasurementsBanner = document.getElementById("savedMeasurementsBanner");
const savedMeasurementsEmail = document.getElementById("savedMeasurementsEmail");
const saveMeasurementsToggleWrap = document.getElementById("saveMeasurementsToggleWrap");
const saveMeasurementsToProfileCheckbox = document.getElementById("saveMeasurementsToProfileCheckbox");

// Builds the same 16-field measurement grid the real designer uses (see
// renderMeasurementFields above it in this file), just always the full set
// -- a saved profile isn't tied to one suit's jacket-only-vs-full-suit
// choice the way a single order's measurements are. Re-run every time the
// account overlay opens with fresh data, same idea as renderMeasurementFields.
function renderProfileMeasureGrid(values) {
  if (!profileMeasureGrid) return;
  profileMeasureGrid.innerHTML = "";
  MEASUREMENTS.forEach((m) => {
    const field = document.createElement("div");
    field.className = "measure-field";
    field.innerHTML =
      '<label for="pm_' + m.id + '">' + m.label + "</label>" +
      '<div class="measure-input-wrap"><input type="number" step="0.1" min="0" id="pm_' +
      m.id +
      '" placeholder="0.0"><span class="unit">cm</span></div>';
    profileMeasureGrid.appendChild(field);
  });
  if (values) {
    MEASUREMENTS.forEach((m) => {
      const el = document.getElementById("pm_" + m.id);
      if (el && values[m.id] !== undefined && values[m.id] !== null) el.value = values[m.id];
    });
  }
}

function collectProfileMeasurements() {
  const values = {};
  MEASUREMENTS.forEach((m) => {
    const el = document.getElementById("pm_" + m.id);
    const val = el ? parseFloat(el.value) : NaN;
    if (!isNaN(val) && val > 0) values[m.id] = val;
  });
  return values;
}

// Prefers the name collected at signup (available immediately off the
// session's own user object, in user_metadata -- no profile row fetch
// needed) over the profiles table's copy of it, over falling back to email
// for an account created before this field existed.
function customerDisplayName() {
  if (!currentUser) return "";
  return (
    (currentUser.user_metadata && currentUser.user_metadata.full_name) ||
    (currentProfile && currentProfile.full_name) ||
    currentUser.email
  );
}

// Reflects currentUser/currentProfile into every place the UI depends on
// them: the nav badge, which of the two account-overlay views shows, the
// "use my saved measurements" banner on the real Measurements step, and the
// "save to profile" checkbox there. Called any time either changes.
function updateAccountUI() {
  const loggedIn = !!currentUser;
  if (accountLoggedOutView) accountLoggedOutView.hidden = loggedIn;
  if (accountLoggedInView) accountLoggedInView.hidden = !loggedIn;
  if (accountBadge) accountBadge.hidden = !loggedIn;
  if (accountNameDisplay) accountNameDisplay.textContent = customerDisplayName();
  if (saveMeasurementsToggleWrap) saveMeasurementsToggleWrap.hidden = !loggedIn;

  const hasSaved = !!(currentProfile && currentProfile.measurements && Object.keys(currentProfile.measurements).length);
  if (savedMeasurementsBanner) savedMeasurementsBanner.hidden = !(loggedIn && hasSaved);
  if (savedMeasurementsEmail) savedMeasurementsEmail.textContent = customerDisplayName();
}

async function loadProfile() {
  if (!currentUser) {
    currentProfile = null;
    renderProfileMeasureGrid(null);
    return;
  }
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from("profiles")
      .select("id, email, full_name, measurements")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to load saved profile:", error);
      return;
    }
    currentProfile = data || null;
    renderProfileMeasureGrid(currentProfile ? currentProfile.measurements : null);
    updateAccountUI();
  } catch (err) {
    console.error(err);
  }
}

// Merges (never replaces outright) new measurement values into whatever's
// already saved -- so, say, saving a Jacket Only order's 8 measurements
// never wipes out pants measurements saved from an earlier full-suit order.
async function saveProfileMeasurements(values) {
  if (!currentUser) return false;
  const merged = Object.assign({}, (currentProfile && currentProfile.measurements) || {}, values);
  try {
    const client = getSupabase();
    const { error } = await client.from("profiles").upsert({
      id: currentUser.id,
      email: currentUser.email,
      measurements: merged,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to save profile measurements:", error);
      return false;
    }
    currentProfile = Object.assign({}, currentProfile, { id: currentUser.id, email: currentUser.email, measurements: merged });
    updateAccountUI();
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Past orders are grouped back into one row per order_id (an order can have
// several suits, several rows) -- same grouping idea as the multi-suit cart,
// just read back out of Supabase instead of built live from cartItems.
async function loadOrderHistory() {
  if (!pastOrdersList) return;
  if (!currentUser) {
    pastOrdersList.innerHTML = "";
    return;
  }
  pastOrdersList.innerHTML = '<p class="account-section-note">Loading...</p>';
  try {
    const client = getSupabase();
    const runQuery = (cols) =>
      client
        .from("orders")
        .select(cols)
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
    // Try with the finished-suit-image columns first; if the migration that
    // adds them hasn't been run yet, quietly fall back to the original columns.
    let { data, error } = await runQuery("order_id, created_at, suit_type, item_price_usd, status, image_url");
    if (error) ({ data, error } = await runQuery("order_id, created_at, suit_type, item_price_usd"));
    if (error) {
      console.error("Failed to load order history:", error);
      pastOrdersList.innerHTML = '<p class="account-section-note">Couldn’t load past orders right now.</p>';
      return;
    }
    if (!data || !data.length) {
      pastOrdersList.innerHTML = '<p class="account-section-note">No past orders yet.</p>';
      return;
    }
    const byOrder = {};
    const order = [];
    data.forEach((row) => {
      const key = row.order_id || row.created_at;
      if (!byOrder[key]) {
        byOrder[key] = { created_at: row.created_at, suits: [], total: 0, images: [], completed: true };
        order.push(key);
      }
      byOrder[key].suits.push(row.suit_type === "jacket_only" ? "Jacket Only" : "Full Suit");
      byOrder[key].total += Number(row.item_price_usd) || 0;
      if (row.status !== "completed") byOrder[key].completed = false;
      if (row.image_url) byOrder[key].images.push(row.image_url);
    });
    pastOrdersList.innerHTML = order
      .map((key) => {
        const o = byOrder[key];
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : "";
        // Finished-suit pictures (generated once the shop marks the order
        // completed). The URLs come from our own storage bucket, but are still
        // only ever placed in an attribute via setAttribute-safe escaping.
        const imgs = o.images
          .map(
            (u) =>
              '<a class="past-order-img-link" href="' + escapeAttr(u) + '" target="_blank" rel="noopener">' +
              '<img class="past-order-img" loading="lazy" alt="Your finished suit" src="' + escapeAttr(u) + '"></a>'
          )
          .join("");
        return (
          '<div class="past-order-row"><div><b>' +
          o.suits.join(" + ") +
          '</b><span class="past-order-date">' +
          date +
          (o.completed ? " \u00b7 Completed" : "") +
          '</span></div><span class="past-order-total">$' +
          o.total.toFixed(0) +
          "</span>" +
          (imgs ? '<div class="past-order-imgs">' + imgs + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
  } catch (err) {
    console.error(err);
    pastOrdersList.innerHTML = '<p class="account-section-note">Couldn’t load past orders right now.</p>';
  }
}

function refreshAccountData() {
  updateAccountUI();
  loadProfile();
  loadOrderHistory();
}

// Accessible modal, same open()/close() shape as the How It Works overlay
// above -- focus to the close button on open, Escape/backdrop-click close,
// focus returns to whatever was clicked to open it.
(function () {
  if (!accountOverlay) return;
  const closeBtn = document.getElementById("accountOverlayClose");
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  function open(triggerEl) {
    lastFocused = triggerEl || document.activeElement;
    accountOverlay.classList.add("open");
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }
  function close() {
    accountOverlay.classList.remove("open");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    // Leave the signed-in view exactly as it was, but reset the signed-out
    // forms (fields + status message) each time the overlay closes, so
    // reopening it never shows a stale error or a half-filled password field
    // left over from a previous attempt.
    if (accountStatusMsg) hideAccountStatus(accountStatusMsg);
    if (signupForm) signupForm.reset();
    if (loginForm) loginForm.reset();
  }

  if (accountIconBtn) accountIconBtn.addEventListener("click", (e) => open(e.currentTarget));
  if (closeBtn) closeBtn.addEventListener("click", close);
  accountOverlay.addEventListener("click", (e) => {
    if (e.target === accountOverlay) close();
  });
})();

function showAccountStatus(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}
function hideAccountStatus(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

// Toggles between the Create Account and Log In forms -- plain show/hide,
// same tab idea as the category tabs in the jacket/pants designer, just far
// simpler (two panes, not a scrollable strip). Switching clears whatever
// status message the other form left behind so it can't read as still
// applying to the one now showing.
if (showSignupTabBtn && showLoginTabBtn && signupForm && loginForm) {
  function showSignupTab() {
    signupForm.hidden = false;
    loginForm.hidden = true;
    showSignupTabBtn.classList.add("active");
    showLoginTabBtn.classList.remove("active");
    showSignupTabBtn.setAttribute("aria-selected", "true");
    showLoginTabBtn.setAttribute("aria-selected", "false");
    hideAccountStatus(accountStatusMsg);
  }
  function showLoginTab() {
    signupForm.hidden = true;
    loginForm.hidden = false;
    showSignupTabBtn.classList.remove("active");
    showLoginTabBtn.classList.add("active");
    showSignupTabBtn.setAttribute("aria-selected", "false");
    showLoginTabBtn.setAttribute("aria-selected", "true");
    hideAccountStatus(accountStatusMsg);
  }
  showSignupTabBtn.addEventListener("click", showSignupTab);
  showLoginTabBtn.addEventListener("click", showLoginTab);
}

if (googleAuthBtn) {
  googleAuthBtn.addEventListener("click", async () => {
    if (!isSupabaseConfigured()) {
      showAccountStatus(accountStatusMsg, "Accounts aren't set up yet -- check back soon.");
      return;
    }
    googleAuthBtn.disabled = true;
    try {
      // No signupForm.reset()/onAuthStateChange handling needed here the
      // way the email/password forms below have it -- a successful call
      // navigates the whole page away to Google immediately, and back to
      // this same page (baseUrl) once they approve, at which point
      // supabase-js reads the returned session out of the URL on its own
      // and onAuthStateChange fires exactly like any other sign-in.
      const baseUrl = window.location.href.split("?")[0].split("#")[0];
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: baseUrl },
      });
      if (error) {
        showAccountStatus(accountStatusMsg, error.message);
        googleAuthBtn.disabled = false;
      }
      // On success the redirect happens immediately; leave the button
      // disabled rather than re-enabling it under a page that's about to
      // navigate away.
    } catch (err) {
      showAccountStatus(accountStatusMsg, err.message);
      googleAuthBtn.disabled = false;
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (signupNameInput.value || "").trim();
    const email = (signupEmailInput.value || "").trim();
    const password = signupPasswordInput.value || "";
    if (!name) {
      showAccountStatus(accountStatusMsg, "Please enter your full name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAccountStatus(accountStatusMsg, "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      showAccountStatus(accountStatusMsg, "Password must be at least 6 characters.");
      return;
    }
    if (!isSupabaseConfigured()) {
      showAccountStatus(accountStatusMsg, "Accounts aren't set up yet -- check back soon.");
      return;
    }
    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = "Creating Account...";
    try {
      const client = getSupabase();
      const baseUrl = window.location.href.split("?")[0].split("#")[0];
      // full_name goes into the auth user's own metadata immediately (so it's
      // available for display the instant a session exists, with no extra
      // fetch -- see customerDisplayName() above) -- a database trigger (see
      // add_customer_profiles_migration.sql) copies it into the profiles
      // table row it creates for every new signup, confirmed or not.
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: baseUrl },
      });
      if (error) {
        showAccountStatus(accountStatusMsg, error.message);
      } else if (data && data.session) {
        // Email confirmation is off for this project -- signed in right
        // away. onAuthStateChange fires on its own and swaps the overlay to
        // the logged-in view; nothing else to do here.
        signupForm.reset();
      } else {
        showAccountStatus(accountStatusMsg, "Account created -- check your email to confirm it, then log in.");
        signupForm.reset();
      }
    } catch (err) {
      showAccountStatus(accountStatusMsg, err.message);
    } finally {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = "Create Account";
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (loginEmailInput.value || "").trim();
    const password = loginPasswordInput.value || "";
    if (!email || !password) {
      showAccountStatus(accountStatusMsg, "Please enter your email and password.");
      return;
    }
    if (!isSupabaseConfigured()) {
      showAccountStatus(accountStatusMsg, "Accounts aren't set up yet -- check back soon.");
      return;
    }
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "Logging In...";
    try {
      const client = getSupabase();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        showAccountStatus(accountStatusMsg, error.message);
      } else {
        loginForm.reset();
      }
    } catch (err) {
      showAccountStatus(accountStatusMsg, err.message);
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = "Log In";
    }
  });
}

if (accountLogoutBtn) {
  accountLogoutBtn.addEventListener("click", async () => {
    try {
      await getSupabase().auth.signOut();
    } catch (err) {
      console.error(err);
    }
  });
}

if (saveProfileMeasurementsBtn) {
  saveProfileMeasurementsBtn.addEventListener("click", async () => {
    saveProfileMeasurementsBtn.disabled = true;
    saveProfileMeasurementsBtn.textContent = "Saving...";
    const ok = await saveProfileMeasurements(collectProfileMeasurements());
    showAccountStatus(
      profileMeasurementsStatusMsg,
      ok ? "Saved." : "Something went wrong saving your measurements -- please try again."
    );
    saveProfileMeasurementsBtn.disabled = false;
    saveProfileMeasurementsBtn.textContent = "Save Measurements";
  });
}

// "Use my saved measurements" on the real designer's Measurements step --
// same fill-every-field idea as applyEstimateBtn above (see
// renderMeasurementFields), just sourced from the signed-in customer's
// saved profile instead of a standard-size estimate.
const useSavedMeasurementsBtn = document.getElementById("useSavedMeasurementsBtn");
if (useSavedMeasurementsBtn) {
  useSavedMeasurementsBtn.addEventListener("click", () => {
    if (!currentProfile || !currentProfile.measurements) return;
    MEASUREMENTS.forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      const val = currentProfile.measurements[m.id];
      if (el && val !== undefined && val !== null) el.value = val;
    });
    saveDraft();
    if (measureGrid) {
      smoothScrollWindowTo(window.scrollY + measureGrid.getBoundingClientRect().top - 20 - getNavClearance());
    }
  });
}

// Auth state is tracked entirely through Supabase's own listener, which
// fires once immediately with whatever session already exists (e.g. still
// signed in from an earlier visit, restored from localStorage) and again on
// every change -- including the moment this tab picks up a session from a
// clicked magic-link URL, so there's no separate "handle the redirect"
// codepath to write (contrast with handlePayPalReturn() above, which needs
// one because PayPal has no equivalent of its own JS client running here).
if (isSupabaseConfigured()) {
  try {
    getSupabase().auth.onAuthStateChange((event, session) => {
      currentUser = session ? session.user : null;
      refreshAccountData();
    });
  } catch (err) {
    console.error(err);
  }
}
// ==================== END CUSTOMER ACCOUNTS ====================

const lightboxFrame = document.getElementById("lightboxFrame");
const lightboxImg = document.getElementById("lightboxImg");
const ZOOM_SCALE = 2.4;
const zoomState = { scale: 1, tx: 0, ty: 0, dragging: false, moved: false, startX: 0, startY: 0, startTx: 0, startTy: 0 };

function applyZoomTransform() {
  lightboxImg.style.transform = "scale(" + zoomState.scale + ") translate(" + zoomState.tx + "px, " + zoomState.ty + "px)";
}

function clampPan() {
  if (zoomState.scale <= 1) {
    zoomState.tx = 0;
    zoomState.ty = 0;
    return;
  }
  const rect = lightboxFrame.getBoundingClientRect();
  const s = zoomState.scale;
  const maxTx = (rect.width * (s - 1)) / (2 * s);
  const maxTy = (rect.height * (s - 1)) / (2 * s);
  zoomState.tx = Math.min(maxTx, Math.max(-maxTx, zoomState.tx));
  zoomState.ty = Math.min(maxTy, Math.max(-maxTy, zoomState.ty));
}

// Zoom in centered on the exact point the user clicked/tapped, rather than
// always zooming into the middle of the image.
function zoomInAt(clientX, clientY) {
  const rect = lightboxFrame.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  zoomState.scale = ZOOM_SCALE;
  zoomState.tx = rect.width / 2 - px;
  zoomState.ty = rect.height / 2 - py;
  clampPan();
  lightboxFrame.classList.add("zoomed");
  applyZoomTransform();
}

function resetZoom() {
  zoomState.scale = 1;
  zoomState.tx = 0;
  zoomState.ty = 0;
  lightboxFrame.classList.remove("zoomed");
  lightboxImg.style.transform = "";
}

// Fabric zoom, full quality: FABRIC_ZOOM_MAP (generated by pack_sprites.py)
// maps each fabric's real supplier code to a high-resolution 520x520 tile
// packed into one of a handful of shared sprite sheets under ./assets/. The
// grid thumbnails stay exactly as they are (small, base64-inlined, fast) --
// this only affects the single fabric image shown in the zoom lightbox.
//
// Progressive enhancement, on purpose: openLightbox always shows the fast
// low-res thumbnail immediately (unchanged first paint), then -- only for
// fabric, only if a map entry exists -- asynchronously loads the relevant
// sprite, crops out just this fabric's tile onto an offscreen canvas at full
// native resolution, and swaps the lightbox image over to that once ready.
// If anything about that fails (sprite 404s, canvas is tainted because this
// exact HTML was opened directly as a local file:// page instead of served
// from a real origin -- e.g. the standalone ScottSuits_mobile_preview.html,
// which inlines everything else but never inlines these sprites since they're
// referenced from JS, not a literal "./assets/..." string bundle_local.py's
// regex would catch), it's caught and silently ignored: the low-res thumbnail
// that's already on screen just stays put. Nothing about the existing
// pinch-zoom/pan code below (which operates on the live <img> element) or any
// other category's zoom is touched by any of this.
const fabricSpriteImgCache = {};
let lightboxZoomToken = 0;
let lightboxBlobUrl = null;

function loadSpriteImage(spritePath) {
  if (fabricSpriteImgCache[spritePath]) return fabricSpriteImgCache[spritePath];
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = spritePath;
  });
  fabricSpriteImgCache[spritePath] = p;
  return p;
}

// Which categories get the "large" zoom lightbox (bigger frame, click-card-
// to-preview, "Confirm This ___" button) instead of the plain small-preview
// magnifier every other category still uses. Originally Fabric only; Lining
// and Felt Color joined so all three swatch-photo categories behave the
// same way, per Daniel's request.
function isZoomCategory(key) {
  return key === "fabric" || key === "lining" || key === "feltColor";
}

// Resolves the higher-quality image to swap in once the lightbox is open,
// for the two zoom categories that DON'T need Fabric's sprite+canvas system:
// - Felt Color: every option's own `img` already IS the best quality
//   available (there's no separate, higher-res source to crop from -- see
//   fabric-zoom-full-quality-status.md's notes on the felt supplier photos'
//   native resolution), so there's nothing to swap to; returns null.
// - Lining: LINING_ZOOM_MAP (catalog.js) points a subset of codes -- the
//   ones with a genuine high-resolution supplier photo -- at a dedicated
//   1080x1080 crop. A code with no entry falls back to its existing (lower-
//   resolution) image, same as Felt.
// Both paths are a plain <img src> swap, no canvas involved -- unlike
// upgradeFabricZoom, this can't fail with the file:// canvas-tainting
// SecurityError described above, since nothing here ever touches a canvas.
function zoomUpgradeSrc(catKey, code) {
  if (catKey === "lining" && typeof LINING_ZOOM_MAP !== "undefined" && LINING_ZOOM_MAP[code]) {
    return LINING_ZOOM_MAP[code];
  }
  return null;
}

function upgradeFabricZoom(img, fabricCode, myToken) {
  if (typeof FABRIC_ZOOM_MAP === "undefined") return;
  const entry = FABRIC_ZOOM_MAP[fabricCode];
  if (!entry) return;
  const tile = typeof FABRIC_ZOOM_TILE_SIZE === "number" ? FABRIC_ZOOM_TILE_SIZE : 1560;
  loadSpriteImage(entry.sprite)
    .then((spriteImg) => {
      if (myToken !== lightboxZoomToken) return; // lightbox moved on already
      const canvas = document.createElement("canvas");
      canvas.width = tile;
      canvas.height = tile;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        spriteImg,
        entry.col * tile,
        entry.row * tile,
        tile,
        tile,
        0,
        0,
        tile,
        tile
      );
      canvas.toBlob((blob) => {
        if (myToken !== lightboxZoomToken || !blob) return;
        const url = URL.createObjectURL(blob);
        if (lightboxBlobUrl) URL.revokeObjectURL(lightboxBlobUrl);
        lightboxBlobUrl = url;
        img.onload = () => applyLightboxSizing(img, true);
        img.src = url;
      }, "image/jpeg", 0.95);
    })
    .catch(() => {
      /* progressive enhancement only -- leave the low-res thumbnail as-is */
    });
}

// large: fabric/lining/felt-color swatches are the categories where the
// customer actually needs to judge a pattern/weave/texture up close rather
// than just confirm a color -- so their lightbox frame gets a bigger cap
// (see .lightbox-frame-xl in style.css) than every other category's zoom,
// which stays at the original size.
//
// XL_SCALE: the fraction of the viewport the "large" frame is allowed to
// fill. Originally 0.92 (near-fullscreen) -- Daniel asked for that square
// to come down to 1/3 of its size, so this is 0.92/3. Keep this in sync
// with .lightbox-frame-xl's max-width/max-height in style.css (also 1/3 of
// its old min(92vw,2160px)/92vh values), since that CSS is the frame's own
// outer bound and this is what actually sizes the image inside it.
// Desktop later doubled too (2026-10-06), so it now matches mobile: 2/3 of
// the original near-fullscreen fraction.
const XL_SCALE = (0.92 / 3) * 2;
// XL_SCALE_MOBILE: on mobile Daniel asked for the same square doubled back
// up from that 1/3 size -- so 2x XL_SCALE, i.e. 2/3 of the original near-
// fullscreen fraction. 900px is the same mobile/desktop split every other
// breakpoint in style.css uses (see @media(max-width:900px)); keep the
// threshold and the CSS mirror of these numbers (in style.css's mobile
// media query) in sync with this.
const XL_SCALE_MOBILE = (0.92 / 3) * 2;
const MOBILE_BREAKPOINT_PX = 900;
//
// Scale is capped at 1 (never upscale past the image's own native pixels).
// This used to allow up to 3x here, which was fine back when the lightbox
// only ever had a small stretched thumbnail to work with -- but now that
// upgradeFabricZoom (above) swaps in the real 1560x1560 zoom-tile crop
// (true 3x the original 520x520 -- see fabric-zoom-full-quality-status.md),
// a further blow-up on a real desktop-sized viewport (whose XL_SCALE-of-
// width/height cap can exceed even 1560px) stretches that same real image
// well past its native resolution and it comes out soft/blurry -- exactly
// the "190x190/3x-stretch" look this whole zoom-tile system was built to
// get away from (see the project doc on the fabric-zoom rework). A phone's
// narrower viewport was already keeping scale under 1 on its own, which is
// why this only ever showed up as a desktop-only problem: capping at 1 here
// makes desktop match that same "always real, never blown-up" pixel
// fidelity instead of relying on the viewport happening to be small enough.
function applyLightboxSizing(img, large) {
  if (!large || !img.naturalWidth || !img.naturalHeight) return;
  const scaleFactor = window.innerWidth <= MOBILE_BREAKPOINT_PX ? XL_SCALE_MOBILE : XL_SCALE;
  const maxW = window.innerWidth * scaleFactor;
  const maxH = window.innerHeight * scaleFactor;
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  // Always set an explicit pixel width/height here -- never fall back to
  // clearing these to "" and letting the plain CSS `width:100%;height:100%`
  // rule take over. That CSS rule creates a circular-sizing situation (the
  // frame has no explicit width of its own, so its auto size depends on its
  // 100%-wide image, which itself depends on the frame) that browsers
  // resolve with an internal fallback essentially DISCONNECTED from the
  // image's real naturalWidth/naturalHeight -- empirically this pinned the
  // displayed box at a near-constant ~765px on a 1600px-wide viewport no
  // matter whether the zoom tile was 520, 780, or 1560px native, which is
  // exactly why bumping source resolution alone was never making the box
  // itself look any bigger. Setting explicit pixel dimensions here (instead
  // of only doing it in the now-removed "scale > 1" branch, which almost
  // never fires now that scale is capped at 1) ties the rendered box
  // directly to the real native resolution and the real viewport-based cap.
  img.style.width = Math.round(img.naturalWidth * scale) + "px";
  img.style.height = Math.round(img.naturalHeight * scale) + "px";
}

// onConfirm: optional callback. When present, the lightbox shows a
// "Confirm This ___" button (see .lightbox-confirm-btn in style.css)
// instead of just letting the customer look and close -- clicking it runs
// onConfirm() (the actual select-this-swatch logic) then closes the
// lightbox. Passed only from renderSwatchCard's card click for a zoom
// category (see isZoomCategory); the separate per-card magnifier button
// (every other category) still opens the same lightbox with no onConfirm,
// so it stays a pure preview, as before.
//
// catKey: which catalog category this is ("fabric", "lining", "feltColor",
// or omitted/null for every non-zoom category, which never reaches the
// upgrade branch below anyway since fabricCode is null for them). Picks
// which upgrade path runs once the lightbox is open: Fabric's sprite+canvas
// crop (upgradeFabricZoom) or a plain higher-res <img src> swap for Lining/
// Felt Color (zoomUpgradeSrc) -- see those functions' comments above.
function openLightbox(src, name, catLabel, large, fabricCode, onConfirm, catKey) {
  const img = document.getElementById("lightboxImg");
  document.getElementById("lightboxCaption").textContent = name;
  const lbOpt = catKey === "fabric" && fabricCode ? (typeof JACKET_CATALOG !== "undefined" && JACKET_CATALOG.fabric.options.find((o) => o.name === fabricCode)) : null;
  const lbSub = document.getElementById("lightboxSub");
  lbSub.textContent = catLabel;
  if (lbOpt && lbOpt.pattern) {
    const pill = document.createElement("span");
    pill.className = "lb-pattern";
    pill.textContent = lbOpt.pattern;
    lbSub.prepend(pill);
  }
  resetZoom();
  lightboxZoomToken++;
  const myToken = lightboxZoomToken;
  if (lightboxBlobUrl) {
    URL.revokeObjectURL(lightboxBlobUrl);
    lightboxBlobUrl = null;
  }
  lightboxFrame.classList.toggle("lightbox-frame-xl", !!large);
  // Every non-fabric category leaves these inline styles empty and keeps its
  // original intrinsic-only sizing (native resolution, capped by the plain
  // .lightbox-frame CSS rule) -- untouched by any of this.
  img.style.width = "";
  img.style.height = "";
  const applySizing = () => applyLightboxSizing(img, large);
  if (img.complete && img.src === src) {
    applySizing();
  } else {
    img.onload = applySizing;
  }
  img.src = src;
  const confirmBtn = document.getElementById("lightboxConfirmBtn");
  confirmBtn.hidden = !onConfirm;
  // "Confirm This Fabric" was hardcoded in the HTML back when Fabric was
  // the only category that ever showed this button -- now that Lining and
  // Felt Color use the same lightbox, the label needs to match whichever
  // category is actually open (catLabel is the category's own display
  // label, e.g. "Fabric", "Lining", "Felt Color").
  if (onConfirm) confirmBtn.textContent = "Confirm This " + catLabel;
  confirmBtn.onclick = onConfirm
    ? () => {
        onConfirm();
        closeLightbox();
      }
    : null;
  document.getElementById("lightbox").classList.add("open");
  updateLbNav();
  if (large && fabricCode) {
    if (catKey === "fabric") {
      upgradeFabricZoom(img, fabricCode, myToken);
    } else {
      const upgraded = zoomUpgradeSrc(catKey, fabricCode);
      if (upgraded && upgraded !== src) {
        // If the high-res crop 404s (e.g. a lighter build that doesn't
        // publish the full LINING_ZOOM_MAP asset set), silently keep the
        // lightbox on the original lower-res image instead of leaving a
        // broken <img> -- same "fail safe to what's already showing"
        // behavior as upgradeFabricZoom's sprite-load catch above.
        img.onerror = () => {
          if (myToken !== lightboxZoomToken) return;
          img.onerror = null;
          img.src = src;
          applyLightboxSizing(img, false);
        };
        img.onload = () => applyLightboxSizing(img, true);
        img.src = upgraded;
      }
    }
  }
}
// Subtle browsing inside the zoom view: after a fabric (or lining/felt) is
// opened, the customer can step to the neighbouring ones in the same order
// as the grid -- faint side arrows, a horizontal swipe, or the arrow keys.
let lbSeq = null;
let lbIdx = -1;
function updateLbNav() {
  const p = document.getElementById("lbPrev");
  const n = document.getElementById("lbNext");
  const on = !!lbSeq && lbSeq.length > 1;
  p.hidden = !on;
  n.hidden = !on;
  if (on) {
    p.disabled = lbIdx <= 0;
    n.disabled = lbIdx >= lbSeq.length - 1;
  }
}
function lbNavigate(d) {
  if (!lbSeq || !document.getElementById("lightbox").classList.contains("open")) return;
  const k = lbIdx + d;
  if (k < 0 || k >= lbSeq.length) return;
  lbIdx = k;
  const a = lbSeq[k];
  openLightbox(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  lbSeq = null;
  lbIdx = -1;
  resetZoom();
}
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});

// Dragging to pan around while zoomed in, plus two-finger pinch to zoom,
// all via Pointer Events (each touch reports its own pointer, so tracking
// however many are currently down tells us whether this is a one-finger
// drag or a two-finger pinch). Block the browser's native "drag the image
// out" behavior, which otherwise hijacks the gesture before ours can run.
lightboxImg.addEventListener("dragstart", (e) => e.preventDefault());

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const activeLightboxPointers = new Map(); // pointerId -> {x, y}
let pinchPrevDist = 0;

function pointsArray() {
  return Array.from(activeLightboxPointers.values());
}
function distanceBetween(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
function midpointBetween(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// Re-arm a plain one-finger drag from wherever that finger currently is --
// used both for a fresh single touch and for the finger left over once a
// pinch drops back down to one, so panning continues without a jump.
function beginSingleDrag(point) {
  zoomState.dragging = true;
  zoomState.startX = point.x;
  zoomState.startY = point.y;
  zoomState.startTx = zoomState.tx;
  zoomState.startTy = zoomState.ty;
  lightboxImg.classList.add("no-transition");
}

lightboxFrame.addEventListener("pointerdown", (e) => {
  try {
    lightboxFrame.setPointerCapture(e.pointerId);
  } catch (err) {
    // Some environments (older WebViews, synthetic events) can't capture --
    // the gesture still works via the tracked pointer map below, it just
    // won't keep receiving events if a finger drifts outside the frame.
  }
  activeLightboxPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activeLightboxPointers.size === 2) {
    e.preventDefault();
    zoomState.dragging = false;
    const [p1, p2] = pointsArray();
    pinchPrevDist = distanceBetween(p1, p2);
    zoomState.moved = true; // a pinch is never a "tap to zoom" click afterward
    lightboxImg.classList.add("no-transition");
  } else if (activeLightboxPointers.size === 1) {
    if (zoomState.scale <= 1) return;
    e.preventDefault();
    zoomState.moved = false;
    beginSingleDrag({ x: e.clientX, y: e.clientY });
  }
});

lightboxFrame.addEventListener("pointermove", (e) => {
  if (!activeLightboxPointers.has(e.pointerId)) return;
  activeLightboxPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activeLightboxPointers.size === 2) {
    e.preventDefault();
    const [p1, p2] = pointsArray();
    const dist = distanceBetween(p1, p2);
    if (pinchPrevDist > 0 && dist > 0) {
      const s0 = zoomState.scale;
      const s1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s0 * (dist / pinchPrevDist)));
      const rect = lightboxFrame.getBoundingClientRect();
      const mid = midpointBetween(p1, p2);
      const originX = rect.width / 2;
      const originY = rect.height / 2;
      const mx = mid.x - rect.left;
      const my = mid.y - rect.top;
      // Keep the point under the fingers visually fixed as the scale changes
      // (see zoomInAt for the same "screen = origin + s*(local - origin + T)"
      // relationship this is solved from).
      zoomState.tx += (mx - originX) * (1 / s1 - 1 / s0);
      zoomState.ty += (my - originY) * (1 / s1 - 1 / s0);
      zoomState.scale = s1;
      if (s1 > 1) lightboxFrame.classList.add("zoomed");
      clampPan();
      applyZoomTransform();
    }
    pinchPrevDist = dist;
    return;
  }

  if (activeLightboxPointers.size === 1 && zoomState.dragging) {
    const dx = e.clientX - zoomState.startX;
    const dy = e.clientY - zoomState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) zoomState.moved = true;
    zoomState.tx = zoomState.startTx + dx / zoomState.scale;
    zoomState.ty = zoomState.startTy + dy / zoomState.scale;
    clampPan();
    applyZoomTransform();
  }
});

function endLightboxPointer(e) {
  activeLightboxPointers.delete(e.pointerId);
  zoomState.dragging = false;
  lightboxImg.classList.remove("no-transition");

  if (zoomState.scale <= 1.02) {
    // Pinched back out past the original size -- settle fully so nothing
    // is left slightly zoomed or off-center.
    resetZoom();
  } else if (activeLightboxPointers.size === 1 && zoomState.scale > 1) {
    // One finger of a pinch lifted -- keep panning with whichever is left,
    // starting from its current position so the image doesn't jump.
    beginSingleDrag(pointsArray()[0]);
  } else {
    pinchPrevDist = 0;
  }
}
lightboxFrame.addEventListener("pointerup", endLightboxPointer);
lightboxFrame.addEventListener("pointercancel", endLightboxPointer);
lightboxFrame.addEventListener("pointerleave", endLightboxPointer);

// A plain click (no drag) toggles zoom: zoom in on that spot, or back out.
lightboxFrame.addEventListener("click", (e) => {
  if (zoomState.moved) {
    zoomState.moved = false;
    return;
  }
  if (zoomState.scale > 1) {
    resetZoom();
  } else {
    zoomInAt(e.clientX, e.clientY);
  }
});

window.addEventListener("resize", () => {
  if (zoomState.scale > 1) {
    clampPan();
    applyZoomTransform();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") lbNavigate(-1);
  else if (e.key === "ArrowRight") lbNavigate(1);
});
document.getElementById("lbPrev").addEventListener("click", () => lbNavigate(-1));
document.getElementById("lbNext").addEventListener("click", () => lbNavigate(1));
// Horizontal swipe (only while not zoomed in) steps to the next/previous one.
let lbSwipe = null;
lightboxFrame.addEventListener("pointerdown", (e) => {
  lbSwipe = activeLightboxPointers.size === 1 && zoomState.scale <= 1 ? { x: e.clientX, y: e.clientY } : null;
});
lightboxFrame.addEventListener("pointerup", (e) => {
  const s = lbSwipe;
  lbSwipe = null;
  if (!s || zoomState.scale > 1.02) return;
  const dx = e.clientX - s.x;
  const dy = e.clientY - s.y;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    zoomState.moved = true; // swallow the click that follows the swipe
    lbNavigate(dx < 0 ? 1 : -1);
  }
});

// TEMP QA NAV BAR -- when true, every Fabric-category name shown anywhere in
// either designer (swatch cards, "Same as Jacket" label, tab subtitle, order
// summary panel) displays the fabric's true supplier code (opt.name, e.g.
// "5835-0543") instead of the customer-facing displayName. Read by
// friendlyName/renderSwatchCard/renderSameAsCard below via closures, so it's
// declared here, before createDesigner, rather than inside it -- both
// jacketDesigner and pantsDesigner need to see the same flag. Wired up (with
// the checkbox and localStorage persistence) in the "TEMP QA NAV BAR" block
// near the bottom of this file, alongside the rest of the QA nav bar. Remove
// this flag along with the rest of that block when QA testing is done.
let qaShowRawFabricNames = false;

// Builds a tabs/options/summary designer bound to a catalog + a set of DOM ids.
// Used for both the jacket step and the pants step so the logic isn't duplicated.
function createDesigner(catalog, ids, sameAsResolvers, groups) {
  // sameAsResolvers (optional): { categoryKey: () => "currently selected value elsewhere" }.
  // For any category listed here, an extra "Same as ___" card is added so the
  // customer can link that choice to a value picked in another designer (used
  // for "pants fabric = same as jacket fabric"). The link stays live: if the
  // source value changes later, this category's displayed/saved value follows
  // it automatically, since we only ever store a marker, not a copy.
  sameAsResolvers = sameAsResolvers || {};
  // groups (optional): [{label, keys}] -- clusters this catalog's categories
  // under labeled headings in the tab list (see JACKET_CATALOG_GROUPS /
  // PANTS_CATALOG_GROUPS in catalog.js) instead of one long flat list. When
  // omitted, every category is still offered, just without section headings.
  // Customer-supplied photos (data URLs, already downsized), keyed by category
  // -- currently just the lining. Kept in memory; main.js also mirrors them
  // into localStorage separately from the draft (see saveDraft).
  const customPhotos = {};
  // Free-text answers (e.g. the monogram) for categories with a `textInput`.
  const customTexts = {};
  function textMissing(k) {
    const ti = catalog[k] && catalog[k].textInput;
    return !!ti && !!order[k] && order[k] !== ti.skipWhen && !String(customTexts[k] || "").trim();
  }
  function textShown(k) {
    const ti = catalog[k] && catalog[k].textInput;
    const t = String(customTexts[k] || "").trim();
    return ti && order[k] && order[k] !== ti.skipWhen && t ? t : "";
  }
  function uploadOptionFor(key) {
    return ((catalog[key] && catalog[key].options) || []).find((o) => o.uploadPhoto) || null;
  }
  function selectedIsUpload(key) {
    const u = uploadOptionFor(key);
    return !!u && order[key] === u.name;
  }
  // Opens a file chooser, downsizes the chosen image (max 1400px, JPEG) and
  // hands it back via done(). Any problem just shows a short message.
  function pickLiningPhoto(key, done) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { alert("Please choose an image file (JPG or PNG)."); return; }
      if (file.size > 25 * 1024 * 1024) { alert("That photo is too large \u2014 please choose one under 25 MB."); return; }
      const reader = new FileReader();
      reader.onerror = () => alert("Sorry, that photo couldn't be read. Please try another.");
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => alert("Sorry, that photo couldn't be opened. Please try a JPG or PNG.");
        img.onload = () => {
          const max = 1400;
          const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const g = c.getContext("2d");
          g.fillStyle = "#fff";
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          customPhotos[key] = c.toDataURL("image/jpeg", 0.82);
          done();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
  function sameAsSentinel(key) { return "__same_as__" + key; }
  function isSameAs(key) { return !!sameAsResolvers[key] && order[key] === sameAsSentinel(key); }
  // The real, storable value for a category -- resolves the "same as" marker
  // to whatever the linked source is currently set to. Used anywhere this
  // selection leaves the designer (order summary text, the database row).
  function resolvedValue(key) {
    if (isSameAs(key)) return sameAsResolvers[key]() || order[key];
    return order[key];
  }
  // Maps a stored option value (the original code, e.g. "C1750") back to its
  // customer-facing display name (e.g. "Deep Cornflower Blue") for a given
  // category, when that category defines one. Categories without a
  // displayName (everything except the color-family thread categories) just
  // fall back to their existing name, which was already customer-facing.
  function friendlyName(key, name) {
    // QA-only escape hatch: see qaShowRawFabricNames above -- Fabric only,
    // every other category keeps showing its normal displayName.
    if (key === "fabric" && qaShowRawFabricNames) return name;
    const opts = (catalog[key] && catalog[key].options) || [];
    const opt = opts.find((o) => o.name === name);
    // A "match the fabric" choice stays just that -- the factory does the
    // matching, so we never resolve it to a specific thread/button/lining.
    if (opt && opt.pattern) return (opt.displayName || opt.name) + " (" + opt.pattern + ")";
    return (opt && opt.displayName) || name;
  }

  // Resolves this same garment's currently selected Fabric option (handling
  // "Same as Jacket" on pants fabric via resolvedValue). Returns null when
  // there's no fabric category or nothing picked yet.
  function resolveFabricOption() {
    const fabricCat = catalog.fabric;
    if (!fabricCat) return null;
    const val = resolvedValue("fabric");
    if (!val) return null;
    return fabricCat.options.find((o) => o.name === val) || null;
  }

  function hexToRgb(hex) {
    const h = (hex || "").replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }
  function rgbToHex(rgb) {
    return (
      "#" +
      rgb
        .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  // Blends hex toward towardHex by amt (0 = hex unchanged, 1 = towardHex).
  function mixHex(hex, towardHex, amt) {
    const a = hexToRgb(hex);
    const b = hexToRgb(towardHex);
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * amt));
  }
  // Builds a soft, deliberately imprecise gradient swatch from a fabric's
  // hex -- used on the "Match Fabric Color" / "Best Match to Fabric" cards IN
  // THE PICKER GRID ONLY, so a browsing customer sees roughly the tone that
  // will be used without being shown the exact thread/button the real
  // nearest-color match (resolveBestMatchOption, still used for the order
  // summary/production text below) would pick. Returns null if there's no
  // hex to build from.
  function fabricGradientCss(hex) {
    if (!hex) return null;
    const light = mixHex(hex, "#ffffff", 0.45);
    const dark = mixHex(hex, "#000000", 0.35);
    return "linear-gradient(135deg, " + light + " 0%, " + hex + " 55%, " + dark + " 100%)";
  }

  // For a "Match Fabric Color" / "Best Match to Fabric" card (see
  // matchesFabric in catalog.js), finds the actual color option in this
  // category (a real thread color or button color, by its own hex) closest
  // to the currently selected fabric's color -- so the customer sees exactly
  // which color will be auto-selected, not just the fabric being matched.
  // Returns null until a fabric is picked, or if nothing in the category has
  // a hex to compare against.
  function resolveBestMatchOption(cat) {
    const fabricOpt = resolveFabricOption();
    if (!fabricOpt || !fabricOpt.hex) return null;
    const candidates = ((cat && cat.options) || []).filter((o) => o.hex && !o.matchesFabric);
    if (!candidates.length) return null;
    const target = hexToRgb(fabricOpt.hex);
    let best = null;
    let bestDist = Infinity;
    candidates.forEach((o) => {
      const rgb = hexToRgb(o.hex);
      const dist =
        (rgb[0] - target[0]) * (rgb[0] - target[0]) +
        (rgb[1] - target[1]) * (rgb[1] - target[1]) +
        (rgb[2] - target[2]) * (rgb[2] - target[2]);
      if (dist < bestDist) {
        bestDist = dist;
        best = o;
      }
    });
    return best;
  }

  // Like resolvedValue, but for on-screen display only -- adds a "(same as
  // jacket)" note so it's clear this value is linked, not independently
  // chosen, and shows the friendly color name rather than the raw code (the
  // raw code is still what's actually stored and submitted -- see
  // resolvedValue/buildRow/getSelections above, which are untouched).
  function displayValue(key) {
    if (isSameAs(key)) {
      const resolved = sameAsResolvers[key]();
      return resolved ? friendlyName(key, resolved) + " (same as jacket)" : "Same as Jacket";
    }
    if (!order[key]) return order[key];
    const shownText = textShown(key);
    return friendlyName(key, order[key]) + (shownText ? " \u2014 \u201c" + shownText + "\u201d" : "");
  }

  // A category can carry `requiresOtherThan: { key, value }` (see e.g.
  // monogramThreadColor in catalog.js) so it's only offered/required when
  // another category on this SAME garment is set to something other than
  // that value -- used to hide "Monogram Thread Color" entirely unless a
  // real monogram placement has been chosen.
  //
  // A category can also carry `requiresEquals: { key, value }` (see
  // feltColor in catalog.js) for the opposite shape of dependency -- only
  // offered/required when another category on this same garment is set to
  // one SPECIFIC value, not merely "anything but a default". Used to hide
  // "Felt Color" unless Felt Under Collar is specifically set to
  // "Customer-Appointed Felt" (its other two options, "Match Felt
  // Undercollar" and "Fabric Under the Collar", have no separate color to
  // pick).
  // Options a category offers right now. A category can carry
  // `allowedBySelection: { otherKey: { "Value": ["option name", ...] } }`:
  // while otherKey is set to "Value", only the listed options are offered
  // (e.g. Shawl collar -> only the shawl lapel buttonhole or no buttonhole).
  function allowedOptions(key) {
    const cat = catalog[key];
    const rules = cat.allowedBySelection;
    // An option can carry `imgBySelection: { otherKey: { "Value": img } }` to
    // show a different drawing while otherKey is set to "Value".
    const withImg = (o) => {
      let out = o;
      if (o.imgBySelection) {
        for (const dep of Object.keys(o.imgBySelection)) {
          const alt = o.imgBySelection[dep][order[dep]];
          if (alt) { out = Object.assign({}, out, { img: alt }); break; }
        }
      }
      if (o.displayNameBySelection) {
        for (const dep of Object.keys(o.displayNameBySelection)) {
          const alt = o.displayNameBySelection[dep][order[dep]];
          if (alt) { out = Object.assign({}, out, { displayName: alt }); break; }
        }
      }
      return out;
    };
    if (!rules) return cat.options.map(withImg);
    return cat.options
      .filter((o) =>
        Object.keys(rules).every((dep) => {
          const list = rules[dep][order[dep]];
          return !list || list.indexOf(o.name) !== -1;
        })
      )
      .map(withImg);
  }
  // Drops a previously chosen value that the current choices no longer allow
  // (e.g. a lapel buttonhole picked earlier, then the collar changed to Shawl),
  // so the customer is asked again instead of keeping an invalid combination.
  function reconcileSelections() {
    keys.forEach((k) => {
      const cat = catalog[k];
      if (cat.allowedBySelection && order[k] && !allowedOptions(k).some((o) => o.name === order[k])) order[k] = null;
      if (cat.retiredOptions && cat.retiredOptions.indexOf(order[k]) !== -1) order[k] = null;
      // "Upload Your Own Photo" with no photo behind it (e.g. a restored draft
      // whose photo is gone) can't be ordered -- ask again.
      if (order[k] && selectedIsUpload(k) && !customPhotos[k]) order[k] = null;
    });
  }

  function isApplicable(key) {
    const cat = catalog[key];
    const req = cat.requiresOtherThan;
    if (req) {
      const v = order[req.key];
      if (!(!!v && v !== req.value)) return false;
    }
    const reqEq = cat.requiresEquals;
    if (reqEq && order[reqEq.key] !== reqEq.value) return false;
    return true;
  }

  // Which family (e.g. "Blue") a given selected option name belongs to, for
  // a colorFamilies category -- used to jump straight to the right shade
  // grid when re-opening a tab that already has a selection, instead of
  // always starting back at the family picker.
  function familyForOptionName(cat, name) {
    if (!cat.colorFamilies || !name) return null;
    for (const fam of cat.colorFamilies) {
      if (fam.options.some((o) => o.name === name)) return fam.name;
    }
    return null;
  }
  // Per-category "which family is currently expanded" browsing state for
  // colorFamilies categories. null means "show the family picker"; this is
  // purely transient UI state, never saved with the order.
  const familyBrowse = {};
  // For chooseOtherColor categories: false = show the Match / Choose Other
  // Color pair, true = show the color families. Transient UI state only.
  const otherColorBrowse = {};

  // With groups given, the flat "keys" order (used for advancing tab-to-tab,
  // completeness checks, everything) follows the grouped order rather than
  // however the catalog object happens to enumerate -- that's what actually
  // clusters related categories together in the flow, not just visually.
  const keys = groups ? groups.reduce((acc, g) => acc.concat(g.keys), []) : Object.keys(catalog);
  const order = {};
  keys.forEach((k) => { order[k] = null; });
  let activeTab = keys[0];

  const tabsEl = document.getElementById(ids.tabs);
  const optionsEl = document.getElementById(ids.options);
  const summaryRowsEl = document.getElementById(ids.summaryRows);
  // The tab strip's own hint line (see index.html -- a plain <p
  // class="tabs-hint"> right after the tabs div) isn't tracked by any id;
  // it's always tabsEl's very next sibling, so this is the one stable way
  // to reach it for either designer instance without adding new ids.
  const tabsHintEl = tabsEl.nextElementSibling;

  // Collapses (zero-height, mobile only -- see .tabs-collapsed in
  // style.css) the category tab strip and its swipe hint once a customer
  // has drilled all the way into a specific color family's actual shade
  // grid, where switching categories isn't the point and every family can
  // hold dozens of shades. renderOptions() resets this to expanded before
  // dispatching to whichever category renderer is active, so only the two
  // leaf-level shade-grid branches (in renderColorFamilyOptions and
  // renderPatternTypeOptions) need to call this with true.
  function setTabsCollapsedOnMobile(collapsed) {
    tabsEl.classList.toggle("tabs-collapsed", collapsed);
    if (tabsHintEl) tabsHintEl.classList.toggle("tabs-collapsed", collapsed);
  }
  // On mobile, .tabs is itself position:sticky (pinned right under the nav/
  // process bars once you scroll past it -- see style.css) so that the
  // category strip stays reachable no matter how deep into a long option
  // grid you've scrolled. That's exactly what makes tabsEl.getBoundingClientRect()
  // useless as a "how far down are we scrolled?" probe: once pinned, its top
  // sits at the same small sticky offset whether you're 50px or 5000px into
  // the grid below it. Using it to compute a "scroll back up" target (below)
  // was computing a near-zero move (target basically equal to the current
  // scroll position already), which skipped the real scroll-up and left the
  // page still scrolled deep when the options grid was swapped out for a
  // shorter one -- forcing the browser to clamp the scroll position into
  // whatever now-shorter content that same scrollY fell inside of (often the
  // "Your Suit" summary at the bottom of the grid), well past the next
  // category tab it should have landed on. designerGridEl is .tabs's own
  // parent (#designerGrid / #pantsGrid) -- a plain, non-sticky container
  // whose rect actually reflects true scroll depth -- so it's used instead
  // wherever the code needs to know or restore "the top of this step".
  const designerGridEl = tabsEl.parentElement;

  // ---- Step-by-step ("one question per screen") chrome ----------------
  // The category tab strip and the long summary list are hidden by CSS (they
  // stay in the DOM -- every existing helper still reads them). What the
  // customer sees instead: a thin progress bar (one segment per question),
  // "Step 3 of 14 / group name", the question's own heading + cards, and a
  // Back / Next bar. "Review" opens a sheet with the full summary, total and
  // the real Continue button.
  const wizHead = document.createElement("div");
  wizHead.className = "wiz-head";
  designerGridEl.insertBefore(wizHead, optionsEl);
  const wizBar = document.createElement("div");
  wizBar.className = "wiz-bar";
  designerGridEl.appendChild(wizBar);
  const wizSummaryEl = designerGridEl.querySelector(".summary");
  const wizPriceEl = wizSummaryEl ? wizSummaryEl.querySelector(".summary-total b") : null;
  let wizSheetEl = null;

  // The fabric-cloth graphic lives only inside the step's box: same left/width
  // as the swatch column, from the bottom of the sticky step bar down to the
  // top of the Back / price / Next bar (nothing behind or below that bar).
  let fabricBgRaf = 0;
  function syncFabricBg() {
    const sec = designerGridEl.closest(".designer");
    if (!sec || !sec.classList.contains("fabric-step")) return;
    const box = designerGridEl.getBoundingClientRect();
    const proc = document.querySelector(".process");
    let top = proc ? Math.max(proc.getBoundingClientRect().bottom, 0) : 0;
    // Start the graphic at the selections (first section heading / card grid),
    // not behind the step header, title and tagline.
    const selStart = optionsEl.querySelector(".opt-section-divider, .fabric-pattern-heading, .opt-grid");
    if (selStart) top = Math.max(top, selStart.getBoundingClientRect().top);
    const bottom = Math.min(wizBar.getBoundingClientRect().top, window.innerHeight);
    sec.style.setProperty("--fbg-left", box.left + "px");
    sec.style.setProperty("--fbg-width", box.width + "px");
    sec.style.setProperty("--fbg-top", top + "px");
    sec.style.setProperty("--fbg-height", Math.max(bottom - top, 0) + "px");
  }
  function syncFabricBgSoon() {
    if (fabricBgRaf) return;
    fabricBgRaf = requestAnimationFrame(() => { fabricBgRaf = 0; syncFabricBg(); });
  }
  window.addEventListener("scroll", syncFabricBgSoon, { passive: true });
  window.addEventListener("resize", syncFabricBgSoon);
  setInterval(syncFabricBg, 300); // catches the step first appearing / layout shifts

  function wizList() { return keys.filter(isApplicable); }
  function wizGroupLabel(key) {
    if (!groups) return "";
    const g = groups.find((x) => x.keys.indexOf(key) !== -1);
    return g ? g.label : "";
  }
  function wizEsc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function wizGoBack() {
    const list = wizList();
    const i = list.indexOf(activeTab);
    if (i > 0) { switchTab(list[i - 1]); return; }
    const backBtn = document.getElementById("backToJacketBtn");
    if (ids.continueBtn === "continuePantsBtn" && backBtn) backBtn.click();
  }
  function wizGoNext() {
    const list = wizList();
    const i = list.indexOf(activeTab);
    if (i < list.length - 1) switchTab(list[i + 1]);
    else openReview();
  }

  function renderWizard() {
    const list = wizList();
    const idx = Math.max(list.indexOf(activeTab), 0);
    const atFirst = idx === 0;
    const atLast = idx === list.length - 1;
    const isPantsDesigner = ids.continueBtn === "continuePantsBtn";
    const group = wizGroupLabel(activeTab);
    // The Fabric step gets a draped-cloth background (see "FABRIC STEP
    // BACKGROUND" in style.css); every other step keeps the plain cream.
    const wizSection = designerGridEl.closest(".designer");
    // Which background graphic this step gets, if any: draped cloth for
    // Fabric; the lapel sketch for every jacket lapel step.
    const LAPEL_BG_KEYS = ["collar", "lapelwidth", "lapelbuttonhole"];
    // Every pocket step, jacket (chest, lower, inside) and pants (front, watch, back).
    const POCKET_BG_KEYS = ["pockettype", "lowerpocket", "insidepocket", "frontPocket", "watchPocket", "backPocket"];
    const bgKey = !STEP_BACKGROUNDS_ENABLED ? ""
      : activeTab === "fabric" ? "fabric"
      : (!isPantsDesigner && LAPEL_BG_KEYS.indexOf(activeTab) !== -1) ? "lapel"
      : POCKET_BG_KEYS.indexOf(activeTab) !== -1 ? "pocket"
      : (!isPantsDesigner && activeTab === "feltundercollar") ? "felt"
      : (!isPantsDesigner && activeTab === "frontbutton") ? "button" : "";
    if (wizSection) {
      wizSection.classList.toggle("fabric-step", !!bgKey);
      if (bgKey) wizSection.setAttribute("data-bg", bgKey); else wizSection.removeAttribute("data-bg");
    }
    syncFabricBg();
    wizHead.innerHTML =
      '<div class="wiz-progress">' +
      list.map((k, i) =>
        '<button type="button" class="wiz-seg' + (i === idx ? " current" : "") + (order[k] ? " done" : "") +
        '" data-k="' + k + '" aria-label="' + wizEsc(catalog[k].label) + '"></button>'
      ).join("") +
      "</div>" +
      '<div class="wiz-meta"><span class="wiz-step">Step ' + (idx + 1) + " of " + list.length + "</span>" +
      (group ? '<span class="wiz-group">' + wizEsc(group) + "</span>" : "") +
      '<button type="button" class="wiz-review-link">Review</button></div>';
    wizHead.querySelectorAll(".wiz-seg").forEach((b) => {
      b.onclick = () => { const k = b.getAttribute("data-k"); if (k !== activeTab) switchTab(k); };
    });
    wizHead.querySelector(".wiz-review-link").onclick = openReview;

    const showBack = !atFirst || isPantsDesigner;
    wizBar.innerHTML =
      '<button type="button" class="wiz-back"' + (showBack ? "" : " disabled") + '>&larr; Back</button>' +
      '<div class="wiz-price">' + (wizPriceEl ? wizPriceEl.textContent : "") + "</div>" +
      '<button type="button" class="wiz-next btn-primary"' + (order[activeTab] && !textMissing(activeTab) ? "" : " disabled") + ">" +
      (atLast ? "Review" : "Next &rarr;") + "</button>";
    wizBar.querySelector(".wiz-back").onclick = wizGoBack;
    wizBar.querySelector(".wiz-next").onclick = wizGoNext;
  }
  if (wizPriceEl && window.MutationObserver) {
    new MutationObserver(() => {
      const el = wizBar.querySelector(".wiz-price");
      if (el) el.textContent = wizPriceEl.textContent;
    }).observe(wizPriceEl, { childList: true, characterData: true, subtree: true });
  }

  function closeReview() {
    if (wizSheetEl) { wizSheetEl.remove(); wizSheetEl = null; }
    document.body.classList.remove("wiz-lock");
    document.removeEventListener("keydown", wizEscHandler);
  }
  function wizEscHandler(e) { if (e.key === "Escape") closeReview(); }
  function openReview() {
    closeReview();
    const list = wizList();
    const title = wizSummaryEl && wizSummaryEl.querySelector("h3") ? wizSummaryEl.querySelector("h3").textContent : "Your Suit";
    const noteEl = wizSummaryEl ? wizSummaryEl.querySelector(".summary-note") : null;
    const realBtn = document.getElementById(ids.continueBtn);
    const missingFirst = list.find((k) => !order[k] || textMissing(k));
    const sheet = document.createElement("div");
    sheet.className = "wiz-sheet";
    sheet.innerHTML =
      '<div class="wiz-sheet-card" role="dialog" aria-modal="true" aria-label="' + wizEsc(title) + '">' +
      '<div class="wiz-sheet-head"><h3>' + wizEsc(title) + '</h3><button type="button" class="wiz-close" aria-label="Close">&times;</button></div>' +
      '<div class="wiz-rows">' +
      list.map((k) => {
        const v = displayValue(k);
        const needText = !!v && textMissing(k);
        return '<button type="button" class="wiz-row" data-k="' + k + '"><span>' + wizEsc(catalog[k].label) +
          '</span><span class="' + (v && !needText ? "" : "missing") + '">' + wizEsc(needText ? "Add your monogram" : v || "Choose") + "</span></button>";
      }).join("") +
      "</div>" +
      '<div class="wiz-total"><span>Estimated total</span><b>' + (wizPriceEl ? wizEsc(wizPriceEl.textContent) : "") + "</b></div>" +
      (noteEl ? '<p class="summary-note">' + wizEsc(noteEl.textContent) + "</p>" : "") +
      '<button type="button" class="btn-primary wiz-continue">' +
      (missingFirst ? "Finish the remaining choices" : wizEsc(realBtn ? realBtn.textContent : "Continue")) + "</button>" +
      "</div>";
    document.body.appendChild(sheet);
    wizSheetEl = sheet;
    document.body.classList.add("wiz-lock");
    document.addEventListener("keydown", wizEscHandler);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) closeReview(); });
    sheet.querySelector(".wiz-close").onclick = closeReview;
    sheet.querySelectorAll(".wiz-row").forEach((b) => {
      b.onclick = () => { const k = b.getAttribute("data-k"); closeReview(); if (k !== activeTab) switchTab(k); };
    });
    sheet.querySelector(".wiz-continue").onclick = () => {
      if (missingFirst) { closeReview(); switchTab(missingFirst); return; }
      closeReview();
      if (realBtn) realBtn.click();
    };
  }

  // Picking an option can leave the customer scrolled well down into the
  // option grid (Fabric alone has 400+ swatches) -- scroll back up to the
  // tab row after a selection so they can immediately see their choice
  // reflected and switch to the next category without manually scrolling
  // up. This used to be mobile-only on the assumption that desktop always
  // has the summary panel and full grid in view already -- but the desktop
  // layout is a sidebar (.tabs sits beside the grid, not above it, and isn't
  // sticky -- see style.css), so scrolling deep into a long grid on desktop
  // leaves the tab row itself scrolled out of view too. So this now runs at
  // every width, exactly like scrollToStepTop already does for step-to-step
  // navigation.
  function scrollTabsIntoViewOnMobile() {
    // Wait for the DOM re-render above to actually be laid out, then kill
    // any residual native momentum scrolling outright (see
    // killScrollMomentum above) before reading positions or animating --
    // a stale/in-motion read here can make this scroll silently lose to
    // the phone's own ongoing scroll.
    requestAnimationFrame(() => {
      killScrollMomentum();
      const rect = designerGridEl.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - getNavClearance();
      smoothScrollWindowTo(targetY);

      // The tab row itself scrolls sideways (swipe to see more categories),
      // so also make sure whichever tab is active is actually visible in
      // that strip instead of stranded off to one edge.
      const activeTabEl = tabsEl.querySelector(".tab.active");
      if (activeTabEl) {
        const tabRect = activeTabEl.getBoundingClientRect();
        const containerRect = tabsEl.getBoundingClientRect();
        const tabCenter = tabRect.left - containerRect.left + tabsEl.scrollLeft + tabRect.width / 2;
        smoothScrollContainerToX(tabsEl, tabCenter - tabsEl.clientWidth / 2);
      }
    });
  }

  // Called once the customer has picked the LAST category for this step
  // (see advanceToNextTab below) -- scrolls the Continue button into the
  // vertical center of the screen so it's immediately visible without the
  // customer having to scroll for it themselves, matching what this used to
  // do before an earlier fix removed it (that fix was itself addressing a
  // real problem: centering the button exactly under the same tap/thumb
  // position just used to make the last selection meant an identical quick
  // tap could immediately land on Continue too, silently completing the
  // step). Restored on the customer's explicit request; the accidental-
  // double-tap risk that motivated removing it is still real on mobile, so
  // that's a known, accepted trade-off there, not an oversight.
  //
  // This used to bail out on desktop entirely, on the assumption that the
  // sticky summary panel always kept the Continue button in view there.
  // That assumption breaks the instant the LAST category is a short one
  // (e.g. Monogram Placement, ~10 cards) reached while scrolled deep into
  // an earlier, much taller one (e.g. Fabric or Thread Color): the options
  // grid -- and the whole sticky container -- collapses to that short
  // category's height, which un-stickies the summary panel and strands the
  // customer well above the now-relocated Continue button with nothing to
  // tell them it's there. Mouse clicks don't have the same "same spot,
  // instant re-tap" double-tap risk a thumb does, so this now runs on
  // desktop too.
  function scrollContinueButtonIntoView() {
    // Step-by-step mode: the summary + Continue button live in the Review
    // sheet now, so finishing the last question opens it.
    openReview();
    return;
    // eslint-disable-next-line no-unreachable
    const btnEl = document.getElementById(ids.continueBtn);
    if (!btnEl) return;
    requestAnimationFrame(() => {
      killScrollMomentum();
      // #continueBtn lives inside .summary, which is position:static on
      // mobile but position:sticky on desktop (see style.css). A sticky
      // ancestor's getBoundingClientRect() is only a reliable scroll target
      // while it's already pinned -- read it once, before the button has
      // settled into its stuck position (e.g. right after a short final
      // category collapsed a much taller sticky container down to size),
      // and the very act of animating toward that reading changes whether
      // the button is pinned or not partway through, leaving the button
      // far from wherever the animation actually lands (verified: it can
      // land 500-600px short). designerGridEl -- the tabs/options/summary
      // row itself -- is never sticky, so its rect is stable regardless of
      // scroll position, same reasoning as scrollToTopThenSwap above. On
      // desktop this scrolls its bottom edge to the bottom of the viewport,
      // which reveals whichever column is tallest right now -- in practice
      // the summary column once every category is filled in, with Continue
      // as its very last element -- without needing the sticky-dependent
      // button rect at all.
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        const gridRect = designerGridEl.getBoundingClientRect();
        const targetY = window.scrollY + gridRect.bottom - window.innerHeight + 32;
        smoothScrollWindowTo(targetY);
        return;
      }
      // Mobile: .summary is plain static flow there, so the button's own
      // rect is a perfectly stable target -- center it in the viewport as
      // before.
      const rect = btnEl.getBoundingClientRect();
      const targetY =
        window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2);
      smoothScrollWindowTo(targetY);
    });
  }

  // Shared by switchTab (below) and every other action that swaps the
  // options grid for different -- often shorter -- content: picking a
  // color-family card (e.g. "Purple") to drill into its shades, picking a
  // Fabric pattern-type card (Solid/Pinstripe/...), picking a color family
  // within a pattern type, and every "All Colors"/"All Patterns" back
  // button. All of these replace optionsEl's content the same way switchTab
  // does, so all of them need to get the customer back near the top FIRST,
  // for the same reason: swapping in shorter content while still scrolled
  // deep (say, having just scrolled through a long family list to reach
  // "Purple") forces an un-animated snap into whatever now-shorter content
  // ends up at that same scroll position -- which can land well past the
  // fresh grid this click was supposed to reveal (e.g. landing on the "Your
  // Suit" summary instead of the 2 shades inside "Purple"). `doSwap` is
  // whatever state change + renderOptions() call this action needs to make.
  function scrollToTopThenSwap(doSwap) {
    // Used to bail out immediately on desktop (doSwap() with no scroll),
    // on the assumption that the full grid was always already in view
    // there. That assumption doesn't hold: .tabs is a sidebar on desktop,
    // not sticky (see style.css), and long grids (Fabric, Thread Color,
    // ...) scroll the whole page well past it. So this now runs at every
    // width, exactly like scrollToStepTop already does for step-to-step
    // navigation -- see scrollTabsIntoViewOnMobile's own comment above.
    //
    // Kill any residual native momentum scrolling (e.g. from the flick
    // that just scrolled through a long family list) outright before even
    // reading the current scroll position -- see killScrollMomentum above.
    // Both problems it prevents matter here: reading window.scrollY /
    // designerGridEl's rect while still in motion can compute a topY
    // against a position that's about to keep changing on its own, and
    // starting smoothScrollWindowTo while momentum is still live can lose
    // that race entirely (the animation completes and swaps the content
    // right on schedule while the screen visibly lands wherever the
    // momentum drifted to instead).
    killScrollMomentum();
    // See designerGridEl's own comment above -- tabsEl is sticky on
    // mobile, so its rect can't tell us how deep we're really scrolled.
    // Use its non-sticky parent instead so a long grid (e.g. a 59-shade
    // color family) actually gets scrolled back up before the content
    // swaps out, rather than staying scrolled deep and getting clamped
    // into whatever shorter content ends up at that same scroll position.
    const rect = designerGridEl.getBoundingClientRect();
    const topY = Math.max(window.scrollY + rect.top - getNavClearance(), 0);
    if (window.scrollY > topY + 2) {
      smoothScrollWindowTo(topY, doSwap);
    } else {
      doSwap();
    }
  }

  // Switching which category tab is active re-renders the whole options
  // grid, and different categories render at different heights (more or
  // fewer swatches). Doing that render while scrolled deep into the
  // previous grid can force the same un-animated scroll-position snap that
  // step-to-step navigation had -- the browser has no choice but to yank
  // the scroll position the instant the tall old content disappears.
  // Scrolling up to the top of the tab row FIRST, and only swapping the
  // grid once we're actually there, avoids that: there's nothing left above
  // the fold for the swap to yank around.
  function switchTab(key) {
    scrollToTopThenSwap(() => {
      activeTab = key;
      renderTabs();
      renderOptions();
      scrollTabsIntoViewOnMobile();
      if (window.__navChanged) window.__navChanged();
    });
  }

  // After picking an option, move the customer straight on to the next
  // category instead of leaving them to click or swipe over to it
  // themselves -- a guided, one-choice-at-a-time flow. A short pause first
  // lets them actually see their selection highlight before it moves on.
  // The scroll helpers above are mobile-only internally (there's nothing to
  // scroll on desktop -- every tab and the full grid are already on
  // screen), so this same function works for both.
  function advanceToNextTab() {
    // Skip over any category that isn't currently applicable (e.g. Monogram
    // Thread Color when Monogram Placement is "No Monogram Need") -- it has
    // no tab to land on right now.
    let nextIdx = keys.indexOf(activeTab) + 1;
    while (nextIdx < keys.length && !isApplicable(keys[nextIdx])) nextIdx++;
    const nextKey = keys[nextIdx];
    if (!nextKey) {
      // That was the last category for this step -- auto-scroll the
      // Continue button into the vertical center of the screen so it's
      // immediately visible, restoring the original behavior at the
      // customer's request (see scrollContinueButtonIntoView's own comment
      // for the accidental-double-tap trade-off this reintroduces and why
      // it's accepted).
      window.setTimeout(() => {
        scrollContinueButtonIntoView();
      }, 320);
      return;
    }
    window.setTimeout(() => {
      switchTab(nextKey);
    }, 320);
  }

  function renderTab(key) {
    const cat = catalog[key];
    const div = document.createElement("div");
    div.className = "tab" + (key === activeTab ? " active" : "");
    const tabSubtitle = displayValue(key) ? displayValue(key) : allowedOptions(key).length + " options";
    div.innerHTML = cat.label + '<span class="count">' + tabSubtitle + "</span>";
    div.onclick = () => switchTab(key);
    tabsEl.appendChild(div);
  }

  function renderTabs() {
    reconcileSelections();
    // A category whose requiresOtherThan condition no longer holds (e.g. the
    // customer switched Monogram Placement back to "No Monogram Need") loses
    // its tab entirely -- clear any stale selection so it can't silently
    // ride along into the saved order once it's no longer offered.
    keys.forEach((key) => {
      if (!isApplicable(key) && order[key] !== null) order[key] = null;
    });
    tabsEl.innerHTML = "";
    if (groups) {
      // A plain, non-clickable heading before each group's tabs -- clusters
      // related categories (e.g. "Collar & Lapel") instead of leaving all of
      // them in one undifferentiated list.
      groups.forEach((group) => {
        const visibleKeys = group.keys.filter(isApplicable);
        if (!visibleKeys.length) return;
        const label = document.createElement("div");
        label.className = "tab-group-label";
        label.textContent = group.label;
        tabsEl.appendChild(label);
        visibleKeys.forEach(renderTab);
      });
    } else {
      keys.filter(isApplicable).forEach(renderTab);
    }
    renderWizard();
  }

  // Builds one selectable swatch card (used by both the flat grid below and
  // the color-family shade grid) -- picking it stores opt.name on this
  // category and advances to the next tab, same behavior either way.
  function renderSwatchCard(cat, opt, container) {
    // Customer-facing label: the friendly renamed color when this category
    // has one (colorFamilies thread categories), otherwise just opt.name as
    // before. The original code (opt.name) is still what gets stored in
    // order[activeTab] below and is never shown here -- see resolvedValue/
    // buildRow/getSelections, which use opt.name and are unaffected.
    let shownName =
      activeTab === "fabric" && qaShowRawFabricNames ? opt.name : opt.displayName || opt.name;
    // A "matchesFabric" option (Match Fabric Color / Best Match to Fabric)
    // no longer reveals the actual real color option that the nearest-color
    // match would pick -- instead it shows a vague gradient swatch built
    // from the selected fabric's own color, labeled with the FABRIC's name,
    // so the customer knows roughly what tone to expect without being shown
    // the exact thread/button that'll be auto-selected. (The real resolved
    // match is still used for the order summary/production text -- see
    // friendlyName -- since that's what the shop actually needs to make the
    // suit.) Falls back to the plain icon/name until a fabric is chosen.
    // This never touches opt itself (opt is a shared catalog object reused
    // by both jacket and pants), only local render variables.
    let imgSrc = opt.img;
    let gradientCss = null;
    if (opt.matchesFabric) {
      const fabricOpt = resolveFabricOption();
      if (fabricOpt && fabricOpt.hex) {
        gradientCss = fabricGradientCss(fabricOpt.hex);
        shownName = opt.name + " (" + (fabricOpt.displayName || fabricOpt.name) + ")";
      }
    }
    // Optional short label (e.g. "Popular", "Extra Tall") shown as a small
    // gray banner across the top of the card -- a hint for a customer who
    // doesn't know what to pick, not part of the stored/printed value.
    const badgeHtml = opt.badge ? '<div class="opt-badge">' + opt.badge + "</div>" : "";
    // The magnifier/zoom button is redundant on a zoom category (Fabric,
    // Lining, Felt Color): clicking the card itself now opens the same
    // (large) zoom view first -- see the onclick branch below -- so the
    // extra button would just be a second way to trigger an identical
    // preview. Every other category still selects instantly on click, so
    // the magnifier stays there as the only way to preview an option
    // before choosing it. A gradient (matchesFabric) card has no real photo
    // to enlarge, so it never gets a magnifier either.
    const zoomBtnHtml = isZoomCategory(activeTab) || gradientCss || opt.uploadPhoto
      ? ""
      : '<button class="zoom-btn" title="Enlarge" aria-label="Enlarge image"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>';
    const swatchHtml = gradientCss
      ? '<div class="opt-swatch match-fabric-swatch" style="background:' + gradientCss + ';" role="img" aria-label="' + shownName + '"></div>'
      : '<img class="opt-swatch" src="' + imgSrc + '" alt="' + shownName + '">';
    const card = document.createElement("div");
    card.className = "opt-card" + (order[activeTab] === opt.name ? " selected" : "");
    // "Upload Your Own Photo": the swatch is an upload icon, or the customer's
    // own photo once they've added one.
    let uploadSwatch = "";
    if (opt.uploadPhoto) {
      const photo = customPhotos[activeTab];
      uploadSwatch = photo
        ? '<div class="opt-swatch upload-swatch has-photo" style="background-image:url(' + photo + ');" role="img" aria-label="Your photo"></div>'
        : '<div class="opt-swatch upload-swatch" role="img" aria-label="Upload a photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg></div>';
      shownName = customPhotos[activeTab] ? (selectedIsUpload(activeTab) ? "Your Photo (+$80) \u2014 tap to change" : "Your Photo (+$80)") : shownName;
    }
    card.innerHTML =
      badgeHtml +
      zoomBtnHtml +
      (opt.uploadPhoto ? uploadSwatch : swatchHtml) + '<div class="opt-name">' + shownName + "</div>" +
      // Optional emphasized one-line callout under the name (catalog option
      // field `highlight`), for a detail that must not be missed.
      (opt.highlight ? '<div class="opt-highlight">' + opt.highlight + "</div>" : "") +
      (opt.pattern ? '<div class="opt-pattern">' + opt.pattern + "</div>" : "");
    const zoomBtn = card.querySelector(".zoom-btn");
    if (zoomBtn) {
      zoomBtn.onclick = (e) => {
        e.stopPropagation();
        lbSeq = null;
        openLightbox(imgSrc, shownName, cat.label, false, null);
      };
    }
    const applySelection = () => {
      order[activeTab] = opt.name;
      markDesignStarted();
      renderOptions();
      renderTabs();
      renderSummary();
      saveDraft();
      // A category with a typed answer (the monogram) stays put after a real
      // pick so the customer can type it -- the box has just appeared.
      const tiHere = cat.textInput;
      if (tiHere && opt.name !== tiHere.skipWhen) {
        const box = document.getElementById("catText");
        if (box) {
          box.scrollIntoView({ block: "center", behavior: "smooth" });
          if (!String(box.value || "").trim()) box.focus({ preventScroll: true });
        }
        return;
      }
      advanceToNextTab();
    };
    // Fabric, Lining, and Felt Color are the categories where the pattern/
    // weave/texture itself is the whole point of the choice, so picking a
    // swatch opens the same large zoom view as the magnifier button first --
    // with a "Confirm This ___" button in it (see openLightbox's onConfirm
    // param) -- rather than applying the selection immediately off a small
    // thumbnail. Every other category keeps the original instant-select-
    // on-click behavior unchanged.
    const tabAtRender = activeTab;
    if (opt.uploadPhoto) {
      card.onclick = () => {
        // Photo already added and this card isn't the current pick: just pick it.
        if (customPhotos[tabAtRender] && order[tabAtRender] !== opt.name) { applySelection(); return; }
        pickLiningPhoto(tabAtRender, () => applySelection());
      };
    } else {
      const lbArgs = [imgSrc, shownName, cat.label, true, opt.name, applySelection, activeTab];
      if (isZoomCategory(activeTab) && !opt.matchesFabric) card._lb = lbArgs;
      card.onclick = isZoomCategory(activeTab) && !opt.matchesFabric
        ? () => {
            const root = card.closest(".options") || card.parentElement;
            const seq = Array.from(root.querySelectorAll(".opt-card")).filter((c) => c._lb).map((c) => c._lb);
            lbSeq = seq.length > 1 ? seq : null;
            lbIdx = seq.indexOf(lbArgs);
            openLightbox.apply(null, lbArgs);
          }
        : applySelection;
    }
    container.appendChild(card);
  }

  // Renders the "Same as Jacket" link card (shared by the flat grid and the
  // color-family picker's top level) into the given container.
  function renderSameAsCard(cat, container) {
    const resolver = sameAsResolvers[activeTab];
    if (!resolver) return;
    const sentinel = sameAsSentinel(activeTab);
    const sourceName = resolver();
    const sourceOpt = sourceName ? cat.options.find((o) => o.name === sourceName) : null;
    const shownSourceName =
      activeTab === "fabric" && qaShowRawFabricNames
        ? sourceName
        : sourceOpt
        ? sourceOpt.displayName || sourceOpt.name
        : sourceName;
    const label = sourceName ? "Same as Jacket (" + shownSourceName + ")" : "Same as Jacket";
    const card = document.createElement("div");
    card.className = "opt-card same-as-card" + (order[activeTab] === sentinel ? " selected" : "");
    card.innerHTML =
      (sourceOpt
        ? '<img class="opt-swatch" src="' + sourceOpt.img + '" alt="' + label + '">'
        : '<div class="opt-swatch same-as-placeholder"></div>') +
      '<div class="opt-name">' + label + "</div>";
    card.onclick = () => {
      order[activeTab] = sentinel;
      markDesignStarted();
      renderOptions();
      renderTabs();
      renderSummary();
      saveDraft();
      advanceToNextTab();
    };
    container.appendChild(card);
  }

  // Colors (Thread Color, Buttonhole Thread Color, and so on) render as a
  // two-level picker instead of one flat grid: first choose a color family
  // (e.g. "Blue"), then a specific shade within it -- the family's own
  // shades are already ordered lightest to darkest (see catalog.js), so
  // that second grid reads as a gradient. familyBrowse[activeTab] tracks
  // which level is showing for this tab; it defaults to the family of an
  // existing real selection so reopening the tab lands on the right shades.
  function renderColorFamilyOptions(cat, gridId, descriptionHtml) {
    if (!(activeTab in familyBrowse)) {
      const currentName = !isSameAs(activeTab) ? order[activeTab] : null;
      familyBrowse[activeTab] = familyForOptionName(cat, currentName);
    }
    const browsedFamily = familyBrowse[activeTab];

    // "Match or choose other color" categories (e.g. Lapel Buttonhole
    // Color): the first screen is just two cards -- match the fabric, or
    // "Choose Other Color", which opens the full list of color families.
    if (cat.chooseOtherColor) {
      if (!(activeTab in otherColorBrowse)) {
        const cur = !isSameAs(activeTab) ? order[activeTab] : null;
        const isRealColor = !!cur && !(cat.specialOptions || []).some((o) => o.name === cur);
        otherColorBrowse[activeTab] = isRealColor;
      }
      if (!otherColorBrowse[activeTab] && browsedFamily === null) {
        optionsEl.innerHTML =
          "<h3>" + cat.label + "</h3>" + descriptionHtml +
          '<p class="sub">' + (cat.tagline || "Match your fabric, or choose a different color.") + '</p><div class="opt-grid color-family-grid" id="' +
          gridId + '"></div>';
        const grid = document.getElementById(gridId);
        renderSameAsCard(cat, grid);
        (cat.specialOptions || []).forEach((opt) => renderSwatchCard(cat, opt, grid));
        const otherCard = document.createElement("div");
        const hexes = cat.colorFamilies.map((f) => f.swatchHex);
        const stops = hexes.map((h, i) => h + " " + Math.round((i / hexes.length) * 100) + "% " + Math.round(((i + 1) / hexes.length) * 100) + "%").join(", ");
        const total = cat.colorFamilies.reduce((n, f) => n + f.options.length, 0);
        otherCard.className = "opt-card color-family-card";
        otherCard.innerHTML =
          '<div class="opt-swatch family-swatch" style="background:conic-gradient(' + stops + ');"></div>' +
          '<div class="opt-name">Choose Other Color</div>' +
          '<div class="family-count">' + total + " colors</div>";
        otherCard.onclick = () => {
          scrollToTopThenSwap(() => {
            otherColorBrowse[activeTab] = true;
            renderOptions();
          });
        };
        grid.appendChild(otherCard);
        return;
      }
    }

    if (browsedFamily === null) {
      const backToChoice = cat.chooseOtherColor
        ? '<button type="button" class="back-to-families-btn">&larr; Back</button>'
        : "";
      optionsEl.innerHTML =
        "<h3>" + cat.label + "</h3>" + descriptionHtml + backToChoice +
        '<p class="sub">' + (cat.tagline || "Choose a color family, then a shade within it.") + '</p><div class="opt-grid color-family-grid" id="' +
        gridId + '"></div>';
      const grid = document.getElementById(gridId);

      if (cat.chooseOtherColor) {
        optionsEl.querySelector(".back-to-families-btn").onclick = () => {
          scrollToTopThenSwap(() => {
            otherColorBrowse[activeTab] = false;
            renderOptions();
          });
        };
      }
      if (!cat.chooseOtherColor) renderSameAsCard(cat, grid);
      const sameAsResolver = sameAsResolvers[activeTab];
      (cat.chooseOtherColor ? [] : cat.specialOptions || []).forEach((opt) => {
        // Skip a special option (e.g. "Match Fabric Color") that's identical
        // to the "Same as Jacket" card above -- e.g. don't show both when
        // the jacket's own choice for this category was itself "Match
        // Fabric Color" -- unless it's the customer's own direct pick
        // already on file, so an existing selection never silently
        // disappears. Mirrors the same dedup done for plain color options
        // in the flat-grid renderer below.
        if (sameAsResolver && opt.name === sameAsResolver() && order[activeTab] !== opt.name) return;
        renderSwatchCard(cat, opt, grid);
      });

      cat.colorFamilies.forEach((fam) => {
        const card = document.createElement("div");
        card.className = "opt-card color-family-card";
        card.innerHTML =
          (fam.representativeImg
            ? '<img class="opt-swatch family-swatch" src="' + fam.representativeImg + '" alt="' + fam.name + '">'
            : '<div class="opt-swatch family-swatch" style="background:' + fam.swatchHex + ';"></div>') +
          '<div class="opt-name">' + fam.name + "</div>" +
          '<div class="family-count">' + fam.options.length + " shade" + (fam.options.length === 1 ? "" : "s") + "</div>";
        card.onclick = () => {
          scrollToTopThenSwap(() => {
            familyBrowse[activeTab] = fam.name;
            renderOptions();
          });
        };
        grid.appendChild(card);
      });
      return;
    }

    // Leaf level: an actual shade grid, which can run to 40-70+ cards for
    // a big family (Navy, Charcoal) -- collapse the category tab strip so
    // this content gets the full screen instead of sharing it.
    setTabsCollapsedOnMobile(true);
    const fam = cat.colorFamilies.find((f) => f.name === browsedFamily);
    optionsEl.innerHTML =
      "<h3>" + cat.label + "</h3>" + descriptionHtml +
      '<button type="button" class="back-to-families-btn">&larr; All Colors</button>' +
      '<p class="sub">' + fam.name + " -- choose one.</p>" +
      '<div class="opt-grid" id="' + gridId + '"></div>';
    optionsEl.querySelector(".back-to-families-btn").onclick = () => {
      scrollToTopThenSwap(() => {
        familyBrowse[activeTab] = null;
        renderOptions();
      });
    };
    const grid = document.getElementById(gridId);
    fam.options.forEach((opt) => renderSwatchCard(cat, opt, grid));
  }

  // Fabric-only three-level picker: pattern type (Solid / Pinstripe /
  // Herringbone / Plaid) -> color family -> shade. Written as its
  // own standalone renderer rather than extending renderColorFamilyOptions()
  // so the plain two-level picker every other colorFamilies category
  // (Thread Color, Button Color, ...) depends on is never touched.
  //
  // patternBrowse[activeTab] tracks which pattern type is expanded (null =
  // show the pattern-type cards); patternFamilyBrowse[activeTab] tracks
  // which color family within that pattern type is expanded (null = show
  // the family cards). Both default from an existing selection so reopening
  // a tab that already has a fabric picked lands straight on the right
  // shade grid instead of back at the top.
  function findPatternTypeAndFamily(cat, name) {
    if (!cat.patternTypes || !name) return { type: null, family: null };
    for (const pt of cat.patternTypes) {
      for (const fam of pt.colorFamilies) {
        if (fam.options.some((o) => o.name === name)) return { type: pt.name, family: fam.name };
      }
    }
    return { type: null, family: null };
  }
  const patternBrowse = {};
  const patternFamilyBrowse = {};

  function renderPatternTypeOptions(cat, gridId, descriptionHtml) {
    if (!(activeTab in patternBrowse)) {
      const currentName = !isSameAs(activeTab) ? order[activeTab] : null;
      const found = findPatternTypeAndFamily(cat, currentName);
      patternBrowse[activeTab] = found.type;
      patternFamilyBrowse[activeTab] = found.family;
    }
    const browsedType = patternBrowse[activeTab];

    // Level 1: pattern-type cards (Solid, Pinstripe, Herringbone, ...).
    if (browsedType === null) {
      optionsEl.innerHTML =
        "<h3>" + cat.label + "</h3>" + descriptionHtml +
        '<p class="sub">' + (cat.tagline || "Choose a pattern type, then a color.") + '</p><div class="opt-grid color-family-grid" id="' +
        gridId + '"></div>';
      const grid = document.getElementById(gridId);

      renderSameAsCard(cat, grid);
      (cat.specialOptions || []).forEach((opt) => renderSwatchCard(cat, opt, grid));

      cat.patternTypes.forEach((pt) => {
        const totalShades = pt.colorFamilies.reduce((sum, f) => sum + f.options.length, 0);
        // An actual photo of one representative fabric in this pattern type
        // (see FABRIC_PATTERN_TYPES.representativeImg in catalog.js) -- so a
        // customer can see what "Plaid" or "Herringbone" actually looks like
        // before opening it, rather than a flat, meaningless color chip.
        // Falls back to the old flat swatch if a type is ever added without
        // one.
        const card = document.createElement("div");
        card.className = "opt-card color-family-card";
        const swatchHtml = pt.representativeImg
          ? '<img class="opt-swatch family-swatch" src="' + pt.representativeImg + '" alt="' + pt.name + '">'
          : '<div class="opt-swatch family-swatch" style="background:' + pt.swatchHex + ';"></div>';
        const optionNoun = cat.label.toLowerCase();
        card.innerHTML =
          swatchHtml +
          '<div class="opt-name">' + pt.name + "</div>" +
          '<div class="family-count">' + totalShades + " " + optionNoun + (totalShades === 1 ? "" : "s") + "</div>";
        card.onclick = () => {
          scrollToTopThenSwap(() => {
            patternBrowse[activeTab] = pt.name;
            patternFamilyBrowse[activeTab] = null;
            renderOptions();
          });
        };
        grid.appendChild(card);
      });
      return;
    }

    const pt = cat.patternTypes.find((p) => p.name === browsedType);
    const browsedFamily = patternFamilyBrowse[activeTab];

    // Level 2: color-family cards within the chosen pattern type.
    if (browsedFamily === null) {
      optionsEl.innerHTML =
        "<h3>" + cat.label + "</h3>" + descriptionHtml +
        '<button type="button" class="back-to-families-btn">&larr; All Patterns</button>' +
        '<p class="sub">' + pt.name + " -- choose a color family, then a shade within it.</p>" +
        '<div class="opt-grid color-family-grid" id="' + gridId + '"></div>';
      optionsEl.querySelector(".back-to-families-btn").onclick = () => {
        scrollToTopThenSwap(() => {
          patternBrowse[activeTab] = null;
          renderOptions();
        });
      };
      const grid = document.getElementById(gridId);
      pt.colorFamilies.forEach((fam) => {
        const card = document.createElement("div");
        card.className = "opt-card color-family-card";
        // Same upgrade as the pattern-type cards above: an actual photo of a
        // representative fabric in this color, for every patterned type
        // (Pinstripe, Herringbone, Plaid) -- a flat color chip
        // can't show pinstripe lines, herringbone chevrons, a plaid grid, or
        // a textured weave, so it left the customer guessing what the
        // pattern actually looks like in that color. Solid keeps the flat
        // swatch (see fam.representativeImg in catalog.js, only populated
        // for non-Solid pattern types): a plain color chip is already
        // exactly what a solid fabric looks like, so a photo would add
        // nothing.
        const famSwatchHtml =
          pt.name !== "Solid" && fam.representativeImg
            ? '<img class="opt-swatch family-swatch" src="' + fam.representativeImg + '" alt="' + fam.name + '">'
            : '<div class="opt-swatch family-swatch" style="background:' + fam.swatchHex + ';"></div>';
        card.innerHTML =
          famSwatchHtml +
          '<div class="opt-name">' + fam.name + "</div>" +
          '<div class="family-count">' + fam.options.length + " shade" + (fam.options.length === 1 ? "" : "s") + "</div>";
        card.onclick = () => {
          scrollToTopThenSwap(() => {
            patternFamilyBrowse[activeTab] = fam.name;
            renderOptions();
          });
        };
        grid.appendChild(card);
      });
      return;
    }

    // Level 3: the actual shade grid (same swatch cards as everywhere else),
    // which can run to 40-70+ cards for a big family (Navy, Charcoal) --
    // collapse the category tab strip so this content gets the full screen.
    setTabsCollapsedOnMobile(true);
    const fam = pt.colorFamilies.find((f) => f.name === browsedFamily);
    optionsEl.innerHTML =
      "<h3>" + cat.label + "</h3>" + descriptionHtml +
      '<button type="button" class="back-to-families-btn">&larr; ' + pt.name + ' Colors</button>' +
      '<p class="sub">' + fam.name + " -- choose one.</p>" +
      '<div class="opt-grid" id="' + gridId + '"></div>';
    optionsEl.querySelector(".back-to-families-btn").onclick = () => {
      scrollToTopThenSwap(() => {
        patternFamilyBrowse[activeTab] = null;
        renderOptions();
      });
    };
    const grid = document.getElementById(gridId);
    fam.options.forEach((opt) => renderSwatchCard(cat, opt, grid));
  }

  // Fabric browsing, color first: color cards (Black, Navy, ...) -> that
  // color's fabrics grouped under Solid / Pinstripe / Herringbone / Plaid
  // headings. Reads cat.colorFirst (see FABRIC_COLOR_FIRST in catalog.js).
  // Lining keeps the pattern-first picker above; only Fabric opts in.
  const colorFirstBrowse = {};
  const typeBrowse = {};
  function renderColorFirstOptions(cat, gridId, descriptionHtml) {
    // Every fabric laid out as its own flat color tile, like a paint palette:
    // the tile is the palette color the fabric is filed under (an
    // approximation -- the real photo shows in the zoom), the fabric's name
    // sits on it in spaced capitals. Whole grid ordered darkest to lightest. Tapping a tile opens the zoom with Confirm.
    optionsEl.innerHTML =
      "<h3>" + cat.label + "</h3>" + descriptionHtml +
      '<p class="sub">' + (cat.tagline || "Choose a fabric.") + '</p><div class="opt-grid fabric-palette-grid" id="' + gridId + '"></div>';
    const grid = document.getElementById(gridId);
    renderSameAsCard(cat, grid);
    (cat.specialOptions || []).forEach((opt) => renderSwatchCard(cat, opt, grid));
    const lum = (h) => { const n = parseInt(String(h || "#808080").replace("#", ""), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
    // Darkness: each fabric's OWN measured darkness (OKLab lightness of its
    // sampled photo color, opt.hex) -- see the grouping/sort below.
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const gam = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
    const toLab = (h) => {
      const n = parseInt(String(h || "#808080").replace("#", ""), 16);
      const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2];
    };
    const fromLab = (L, A, B) => {
      const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s2 = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
      const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2, b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2;
      return "#" + [gam(r), gam(g), gam(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    const tiles = [];
    cat.colorFirst.forEach((g) => {
      g.patterns.reduce((all, b) => all.concat(b.options), []).forEach((opt) => {
        const lab = toLab(opt.hex || g.swatchHex);
        tiles.push({ opt, group: g.name, L: lab[0], hue: Math.atan2(lab[2], lab[1]), chroma: Math.hypot(lab[1], lab[2]) });
      });
    });
    // Grouping: fabrics are kept together by color family (blacks/charcoals,
    // then each color -- blues, burgundies, browns... -- then the light
    // greys and ivories), and sorted darkest -> lightest WITHIN each family.
    // Families themselves run dark to light too: dark neutrals first, the
    // colored families ordered by their average darkness, lights last.
    const FAMILY = { "Jet Black": "dark", "Deep Charcoal": "dark", "Navy": "blue", "Aubergine": "purple", "Burgundy": "red", "Chocolate Brown": "brown", "Forest Green": "green", "Teal": "green" };
    tiles.forEach((t) => { t.fam = FAMILY[t.group] || "light"; });
    const famL = {};
    tiles.forEach((t) => { (famL[t.fam] = famL[t.fam] || []).push(t.L); });
    const famRank = (f) => f === "dark" ? -1 : f === "light" ? 9 : famL[f].reduce((a, b) => a + b, 0) / famL[f].length;
    tiles.sort((x, y) => famRank(x.fam) - famRank(y.fam) || x.L - y.L || (x.opt.displayName || x.opt.name).localeCompare(y.opt.displayName || y.opt.name));
    // Display: each tile shows the fabric's REAL color (hue + chroma from its
    // photo), only lifted in lightness so dark fabrics are distinguishable.
    // The lift is one monotonic curve over the real lightness, so the tile
    // order stays exactly the real dark -> light order, and chroma is scaled
    // with the lift so navy still reads navy, burgundy reads burgundy, etc.
    const Ls = tiles.map((t) => t.L), Lmin = Math.min.apply(null, Ls), Lmax = Math.max.apply(null, Ls);
    tiles.forEach((t) => {
      const u = Lmax > Lmin ? (t.L - Lmin) / (Lmax - Lmin) : 0;
      const L = 0.17 + 0.79 * Math.pow(u, 0.75);
      const C = Math.min(0.09, t.chroma * Math.pow(L / Math.max(t.L, 0.05), 0.7));
      const tint = fromLab(L, C * Math.cos(t.hue), C * Math.sin(t.hue));
      renderSwatchCard(cat, t.opt, grid);
      const card = grid.lastElementChild;
      if (!card) return;
      card.classList.add("fabric-tile");
      card.style.background = tint;
      card.style.color = L > 0.62 ? "#1c1814" : "#ffffff";
    });
  }

  // Flat color palette (used by Lapel / Pants Buttonhole Color): every color
  // is its own small tile in its real color with the name in spaced capitals,
  // the whole grid sorted darkest -> lightest -- same look as the Fabric step.
  // Tapping a tile selects it. "Same as Jacket" / "Match Fabric Color" sit on
  // top as slim banners.
  function renderFlatColorTiles(cat, gridId, descriptionHtml) {
    optionsEl.innerHTML =
      "<h3>" + cat.label + "</h3>" + descriptionHtml +
      '<p class="sub">' + (cat.tagline || "Choose a color.") + '</p><div class="opt-grid fabric-palette-grid" id="' + gridId + '"></div>';
    const grid = document.getElementById(gridId);
    renderSameAsCard(cat, grid);
    const sameAsResolver = sameAsResolvers[activeTab];
    (cat.specialOptions || []).forEach((opt) => {
      if (sameAsResolver && opt.name === sameAsResolver() && order[activeTab] !== opt.name) return;
      renderSwatchCard(cat, opt, grid);
      if (grid.lastElementChild) grid.lastElementChild.classList.add("same-as-card");
    });
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const okL = (h) => {
      const n = parseInt(String(h || "#808080").replace("#", ""), 16);
      const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
      return 0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) + 0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) - 0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    };
    const colors = cat.colorFamilies.reduce((all, f) => all.concat(f.options), []);
    colors.sort((a, b) => okL(a.hex) - okL(b.hex) || (a.displayName || a.name).localeCompare(b.displayName || b.name));
    colors.forEach((opt) => {
      renderSwatchCard(cat, opt, grid);
      const card = grid.lastElementChild;
      if (!card) return;
      card.classList.add("fabric-tile");
      card.style.background = opt.hex;
      card.style.color = okL(opt.hex) > 0.62 ? "#1c1814" : "#ffffff";
    });
  }

  function renderOptions() {
    const cat = catalog[activeTab];
    const gridId = ids.tabs + "OptGrid";
    // Default to the tab strip being expanded -- only the leaf-level shade
    // grid (reached via a color family) collapses it, and it does so
    // itself, below, after this runs.
    setTabsCollapsedOnMobile(false);
    // A category can carry an optional one-line "description" (see e.g.
    // facing in catalog.js) explaining a term customers may not know on
    // sight -- shown above the usual selection hint when present.
    const descriptionHtml = cat.description ? '<p class="cat-description">' + cat.description + "</p>" : "";

    if (cat.colorFirst) {
      renderColorFirstOptions(cat, gridId, descriptionHtml);
      return;
    }

    if (cat.flatColorTiles) {
      renderFlatColorTiles(cat, gridId, descriptionHtml);
      return;
    }

    if (cat.patternTypes) {
      renderPatternTypeOptions(cat, gridId, descriptionHtml);
      return;
    }

    if (cat.colorFamilies) {
      renderColorFamilyOptions(cat, gridId, descriptionHtml);
      return;
    }

    const ti = cat.textInput;
    // The box only appears once a real option (not "No Monogram") is picked.
    const showTextBox = !!ti && !!order[activeTab] && order[activeTab] !== ti.skipWhen;
    const textBoxHtml = showTextBox
      ? '<div class="measure-field mono-text-card"><label for="catText">' + ti.label + "</label>" +
        '<div class="measure-input-wrap"><input type="text" id="catText" maxlength="' + (ti.maxLength || 40) + '" placeholder="' + ti.placeholder + '" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>' +
        (ti.hint ? '<div class="mono-text-hint">' + ti.hint + "</div>" : "") + "</div>"
      : "";
    optionsEl.innerHTML =
      "<h3>" + cat.label + "</h3>" + descriptionHtml +
      (cat.tagline === "" ? "" : '<p class="sub">' + (cat.tagline || "Choose one.") + "</p>") + textBoxHtml + '<div class="opt-grid' + (cat.compactCards ? " compact-cards" : "") + '" id="' +
      gridId + '"></div>';
    if (showTextBox) {
      const textEl = document.getElementById("catText");
      const tabAtText = activeTab;
      textEl.value = customTexts[tabAtText] || "";
      textEl.addEventListener("input", () => {
        customTexts[tabAtText] = textEl.value;
        renderSummary();
        saveDraft();
      });
    }
    const grid = document.getElementById(gridId);

    const resolver = sameAsResolvers[activeTab];
    renderSameAsCard(cat, grid);

    let lastSection = null;
    allowedOptions(activeTab).forEach((opt) => {
      // Skip a regular option that's identical to the "Same as Jacket" card
      // above (e.g. don't show "Navy Blue" twice when the jacket is already
      // Navy Blue) -- unless it's the customer's own direct pick already on
      // file, so an existing selection never silently disappears.
      if (resolver && opt.name === resolver() && order[activeTab] !== opt.name) return;
      // Optional small section divider (e.g. Single vs Double Breasted):
      // an option can carry a `section` label; a heading is drawn whenever
      // it changes from the previous option's.
      if (opt.section && opt.section !== lastSection) {
        const h = document.createElement("h4");
        h.className = "opt-section-divider";
        h.textContent = opt.section;
        grid.appendChild(h);
        lastSection = opt.section;
      }
      renderSwatchCard(cat, opt, grid);
    });
  }

  function renderSummary() {
    if (typeof refreshDesignerPrice === "function") refreshDesignerPrice();
    renderWizard();
    summaryRowsEl.innerHTML = "";
    keys.filter(isApplicable).forEach((key) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      row.innerHTML = "<span>" + catalog[key].label + "</span><span>" + (displayValue(key) || "—") + "</span>";
      summaryRowsEl.appendChild(row);
    });
  }

  renderTabs();
  renderOptions();
  renderSummary();

  return {
    isComplete: () => keys.filter(isApplicable).every((k) => order[k] && !textMissing(k)),
    missingLabels: () => keys.filter(isApplicable).filter((k) => !order[k] || textMissing(k)).map((k) => catalog[k].label),
    // Free-text answers by category key (e.g. { monogram: "ABC" }) -- only
    // those that currently apply.
    getTexts: () => {
      const out = {};
      keys.filter(isApplicable).forEach((k) => { const t = textShown(k); if (t) out[k] = t; });
      return out;
    },
    setTexts: (saved) => { Object.keys(saved || {}).forEach((k) => { if (catalog[k] && catalog[k].textInput) customTexts[k] = String(saved[k]); }); },
    buildRow: () => {
      const row = {};
      // An inapplicable category (e.g. Monogram Thread Color with no
      // monogram chosen) is left out of the row entirely rather than
      // written as null -- same effect on an insert, and it can't ever
      // clobber a value stored earlier if the category briefly toggled.
      keys.filter(isApplicable).forEach((key) => { row[catalog[key].column] = resolvedValue(key); });
      return row;
    },
    // Selected option display names, keyed by catalog key (e.g. "collar" -> "Notch Lapel").
    // Used to fill in the printable Client Form. Any "same as jacket" links are
    // resolved to the real fabric name here, not left as an internal marker.
    getSelections: () => {
      reconcileSelections();
      const result = {};
      keys.filter(isApplicable).forEach((key) => { result[key] = resolvedValue(key); });
      return result;
    },
    // Re-runs the three render functions with no selection changes -- used by
    // the QA "Raw Fabric Codes" toggle so flipping it updates whatever's
    // already on screen immediately, instead of only taking effect the next
    // time the customer navigates to a tab.
    refreshDisplay: () => {
      renderTabs();
      renderOptions();
      renderSummary();
    },
    // The customer's own lining photo (data URL) while it is the chosen
    // lining, else null. Used when the suit is added to the cart.
    getLiningPhoto: () => (selectedIsUpload("lining") ? customPhotos.lining || null : null),
    // Restores a photo (from localStorage) BEFORE setSelections.
    setLiningPhoto: (dataUrl) => { if (dataUrl) customPhotos.lining = dataUrl; },
    // Re-applies a saved set of selections (used to restore a draft on reload).
    setSelections: (saved) => {
      keys.forEach((k) => {
        if (saved[k]) order[k] = saved[k];
      });
      reconcileSelections();
      renderTabs();
      renderOptions();
      renderSummary();
    },
    // Jumps back to the first tab (Fabric) -- called every time this
    // designer's page is navigated to, so it never opens on whatever tab
    // happened to be open last.
    resetToFirstTab: () => {
      closeReview();
      activeTab = keys[0];
      renderTabs();
      renderOptions();
    },
    // Used by the browser Back/Forward buttons (see "BROWSER HISTORY" below).
    getActiveTab: () => activeTab,
    setActiveTab: (k) => {
      if (keys.indexOf(k) === -1) return;
      closeReview();
      activeTab = k;
      renderTabs();
      renderOptions();
    },
    // Wipes every selection back to blank and returns to the first tab --
    // used by "Start Over", as opposed to setSelections (which only fills
    // in whatever a saved draft actually had).
    resetSelections: () => {
      closeReview();
      keys.forEach((k) => { order[k] = null; });
      Object.keys(customPhotos).forEach((k) => { delete customPhotos[k]; });
      Object.keys(customTexts).forEach((k) => { delete customTexts[k]; });
      Object.keys(familyBrowse).forEach((k) => { delete familyBrowse[k]; });
      Object.keys(otherColorBrowse).forEach((k) => { delete otherColorBrowse[k]; });
      Object.keys(colorFirstBrowse).forEach((k) => { delete colorFirstBrowse[k]; });
      Object.keys(typeBrowse).forEach((k) => { delete typeBrowse[k]; });
      activeTab = keys[0];
      renderTabs();
      renderOptions();
      renderSummary();
    },
  };
}

const jacketDesigner = createDesigner(
  JACKET_CATALOG,
  {
    tabs: "tabs",
    options: "options",
    summaryRows: "summaryRows",
    continueBtn: "continueBtn",
  },
  null,
  JACKET_CATALOG_GROUPS
);

const pantsDesigner = createDesigner(
  PANTS_CATALOG,
  {
    tabs: "pantsTabs",
    options: "pantsOptions",
    summaryRows: "pantsSummaryRows",
    continueBtn: "continuePantsBtn",
  },
  {
    // Lets the customer pick "Same as Jacket" for pants fabric (and now the
    // button nail sewing method, and the thread colors below) instead of
    // choosing again -- stays linked even if they go back and change the
    // jacket's choice afterward.
    fabric: () => jacketDesigner.getSelections().fabric,
    buttonNail: () => jacketDesigner.getSelections().buttonNail,
    threadColor: () => jacketDesigner.getSelections().threadColor,
    buttonholeThreadColor: () => jacketDesigner.getSelections().buttonholeThreadColor,
    monogramThreadColor: () => jacketDesigner.getSelections().monogramThreadColor,
  },
  PANTS_CATALOG_GROUPS
);

// Exact labels used on the shop's printed Client Form for each measurement
// (a couple of them intentionally don't say "finished", matching the paper form).
const MEASUREMENT_FORM_LABELS = {
  shoulder: "Shoulder-finished-",
  sleeve_length: "Sleeve length-finished-",
  wrist: "Wrist-finished-",
  chest: "Chest-finished-",
  stomach: "Stomach-finished-",
  front_jacket: "Front jacket-finished-",
  back_jacket: "Back jacket-finished-",
  bicep: "Bicep-finished-",
  hips: "Hips-",
  waist: "Waist-finished-",
  leg_length: "Full pants length-finished-",
  crotch: "Crotch-",
  thigh: "Thigh-finished-",
  knee: "Knee-finished-",
  calf: "Calf-finished-",
  cuff: "Cuff-finished-",
};

// Builds the full plain-text Client Form used in production: customer selections
// pulled live from the designer, plus the shop's fixed standard specs for the
// items that aren't customer choices (AMF stitching, armhole shield, shoulder
// type, label placement, pant lining, heel guards, etc). suitType is "full"
// or "jacketOnly" -- for a Jacket Only item, pantsSel is null/empty and the
// whole PANTS section (and pants measurements) is left out entirely rather
// than printed blank.
// On the factory form, a "match the fabric" choice is left to the factory's
// judgement -- say so explicitly instead of naming any specific color.
function factoryMatchText(v) {
  return v === "Match Fabric Color" || v === "Best Match to Fabric" ? v + " (factory to match)" : v;
}
function buildClientFormText(customerName, suitType, jacketSel, pantsSel, measurements, extras) {
  const isJacketOnly = suitType === "jacketOnly";
  const jacketFabric = jacketSel.fabric || "";
  const pantsFabric = !isJacketOnly && pantsSel ? pantsSel.fabric || "" : "";
  let fabricLine = jacketFabric;
  if (pantsFabric && pantsFabric !== jacketFabric) {
    fabricLine = jacketFabric + " (Jacket) / " + pantsFabric + " (Pants)";
  }

  const lines = [];
  lines.push("CLIENT FORM");
  lines.push("");
  lines.push("Customer name: " + customerName);
  lines.push("Order type: " + (isJacketOnly ? "Jacket Only" : "Full Suit (Jacket + Pants)"));
  lines.push("");
  lines.push("Fabric: " + fabricLine);
  if (liningUploadSurcharge(jacketSel)) {
    const photoUrl = extras && extras.liningPhotoUrl;
    lines.push(
      "Lining: CUSTOMER'S OWN PHOTO (+$" + LINING_UPLOAD_OPTION.surchargeUsd + ") -- " +
        (photoUrl ? "photo: " + photoUrl : "photo NOT attached (upload failed) -- contact the customer for it")
    );
  } else if (jacketSel.lining === LINING_MATCH_OPTION.name) {
    lines.push("Lining: Match fabric (factory to match)");
  } else {
    lines.push("Lining: " + (jacketSel.lining || ""));
  }
  lines.push("Button: ");
  lines.push("Piping: ");
  lines.push("Inside pick stitching: ");
  lines.push("Felt: ");
  lines.push("Bottom button hole on sleeve: ");
  lines.push("");
  lines.push("JACKET");
  lines.push("Collar style: " + (jacketSel.collar || ""));
  lines.push("Front button request: " + (jacketSel.frontbutton || ""));
  lines.push("Button color: " + factoryMatchText(jacketSel.buttoncolor || ""));
  lines.push("Lapel width: " + (jacketSel.lapelwidth || ""));
  lines.push("Lapel buttonhole: " + (jacketSel.lapelbuttonhole || ""));
  lines.push("Top sleeve crown type: " + (jacketSel.sleevecrown || ""));
  lines.push("Pocket type: " + (jacketSel.pockettype || ""));
  lines.push("Lower pocket: " + (jacketSel.lowerpocket || ""));
  lines.push("AMF stitching: .5cm");
  lines.push("Thread color: " + factoryMatchText(jacketSel.threadColor || ""));
  lines.push("Buttonhole thread color: " + factoryMatchText(jacketSel.buttonholeThreadColor || ""));
  lines.push("Felt under collar: " + (jacketSel.feltundercollar || ""));
  lines.push("Felt color: " + (jacketSel.feltColor || ""));
  lines.push("Construction: " + (jacketSel.construction || ""));
  lines.push("Facing style: " + (jacketSel.facing || ""));
  lines.push("Inside pocket style: " + (jacketSel.insidepocket || ""));
  lines.push("Armhole shield: no");
  lines.push("Monogram placement: " + (jacketSel.monogram || ""));
  if (extras && extras.jacketMonogramText) lines.push("Monogram text: " + extras.jacketMonogramText);
  lines.push("Monogram thread color: " + factoryMatchText(jacketSel.monogramThreadColor || ""));
  lines.push("Label placement: no");
  lines.push("Shoulder type: normal");
  lines.push("Back vents: " + (jacketSel.backvent || ""));
  lines.push("Sleeve cuff style: " + (jacketSel.sleevecuffstyle || ""));
  lines.push("Buttons on sleeve cuff: " + (jacketSel.cuffbuttons || ""));
  lines.push("");
  if (!isJacketOnly) {
    const pants = pantsSel || {};
    lines.push("PANTS");
    lines.push("Waist line height: " + (pants.waistLineHeight || ""));
    // An option's `formNote` (e.g. Square Waistband: "Centered over zipper")
    // is added to the factory form only -- not shown on the customer's card.
    const wextOpt = PANTS_CATALOG.waistbandExtension.options.find((o) => o.name === pants.waistbandExtension);
    lines.push("Waistband extension style: " + (pants.waistbandExtension || "") + (wextOpt && wextOpt.formNote ? " -- " + wextOpt.formNote.toUpperCase() : ""));
    lines.push("Waistband style: " + (pants.waistbandStyle || ""));
    lines.push("Front pleat: " + (pants.frontPleat || ""));
    lines.push("Belt loops: " + (pants.beltLoops || ""));
    lines.push("Hook and eye style: " + (pants.hookEye || ""));
    lines.push("Front pocket style: " + (pants.frontPocket || ""));
    lines.push("Bottom style: " + (pants.bottomStyle || ""));
    lines.push("Button nail method: " + (pants.buttonNail || ""));
    lines.push("Sewing stitch/ AMF stitch: no");
    lines.push("Thread color: " + factoryMatchText(pants.threadColor || ""));
    lines.push("Buttonhole thread color: " + factoryMatchText(pants.buttonholeThreadColor || ""));
    lines.push("Watch pocket placement: " + (pants.watchPocket || ""));
    lines.push("Pant lining: no");
    lines.push("Heel guards: no");
    lines.push("Label placement: no");
    lines.push("Back waist shape: " + (pants.backWaistShape || ""));
    lines.push("Monogram placement: " + (pants.monogram || ""));
    if (extras && extras.pantsMonogramText) lines.push("Pants monogram text: " + extras.pantsMonogramText);
    lines.push("Monogram thread color: " + factoryMatchText(pants.monogramThreadColor || ""));
    lines.push("Back pocket style: " + (pants.backPocket || ""));
    lines.push("Back dart: ");
    lines.push("");
  }

  const measurementList = isJacketOnly ? MEASUREMENTS.filter((m) => m.part === "jacket") : MEASUREMENTS;
  measurementList.forEach((m) => {
    const label = MEASUREMENT_FORM_LABELS[m.id] || (m.label + "-");
    const val = measurements[m.id];
    lines.push(label + " " + (val === undefined ? "" : val + " cm"));
  });

  return lines.join("\n");
}

// Rebuilds the measurement grid to match whichever fields the current suit
// type actually needs (see activeMeasurements()) -- run once at load, and
// again by applySuitType() whenever the suit type changes (picking a card on
// suitTypeSection, or restoring a saved draft). Whatever was already typed
// into a field that still exists after the rebuild is carried over rather
// than wiped, so switching from Jacket Only back to Full Suit (say, when
// designing a second item for the same order) keeps the jacket measurements
// already entered -- only the newly-relevant pants fields start blank.
function renderMeasurementFields() {
  const previousValues = {};
  MEASUREMENTS.forEach((m) => {
    const el = document.getElementById("m_" + m.id);
    if (el && el.value !== "") previousValues[m.id] = el.value;
  });

  measureGrid.innerHTML = "";
  let lastMeasurePart = null;
  activeMeasurements().forEach((m) => {
    if (currentSuitType !== "jacketOnly" && m.part !== lastMeasurePart) {
      const h = document.createElement("h4");
      h.className = "measure-part-heading";
      h.textContent = m.part === "pants" ? "Pants" : "Jacket";
      measureGrid.appendChild(h);
    }
    lastMeasurePart = m.part;
    const field = document.createElement("div");
    field.className = "measure-field";
    field.innerHTML =
      '<label for="m_' + m.id + '">' + m.label + "</label>" +
      '<div class="measure-input-wrap"><input type="number" step="0.1" min="0" id="m_' +
      m.id +
      '" placeholder="0.0"><span class="unit">cm</span></div>';
    field.querySelector("input").addEventListener("input", saveDraft);
    measureGrid.appendChild(field);
  });

  Object.keys(previousValues).forEach((id) => {
    const el = document.getElementById("m_" + id);
    if (el) el.value = previousValues[id];
  });
  if (typeof renderMeasureChrome === "function") renderMeasureChrome();
}
renderMeasurementFields();

// Page chrome that matches the designer steps: a full progress bar (every
// designer question done, plus this last step) and the running price in the
// bottom bar. Called whenever the measurements step is shown.
// Progress bar + running total on the Personal Info / Shipping page.
function renderPersonalChrome() {
  const bar = document.getElementById("persProgress");
  if (bar) {
    let n = document.querySelectorAll("#designer .wiz-seg").length;
    if (currentSuitType !== "jacketOnly") n += document.querySelectorAll("#pantsSection .wiz-seg").length;
    let html = "";
    for (let i = 0; i < Math.max(n, 1) + 1; i++) html += '<span class="wiz-seg done"></span>';
    bar.innerHTML = html + '<span class="wiz-seg current"></span>';
  }
  const priceEl = document.getElementById("persPrice");
  if (priceEl) priceEl.textContent = "$" + cartTotalUsd();
}
function renderMeasureChrome() {
  const bar = document.getElementById("measProgress");
  if (bar) {
    let n = document.querySelectorAll("#designer .wiz-seg").length;
    if (currentSuitType !== "jacketOnly") n += document.querySelectorAll("#pantsSection .wiz-seg").length;
    let html = "";
    for (let i = 0; i < Math.max(n, 1); i++) html += '<span class="wiz-seg done"></span>';
    bar.innerHTML = html + '<span class="wiz-seg current"></span>';
  }
  const priceEl = document.getElementById("measPrice");
  const src = document.getElementById(currentSuitType === "jacketOnly" ? "totalPrice" : "pantsTotalPrice");
  if (priceEl && src) priceEl.textContent = src.textContent;
}

// "Don't know your measurements?" size-based estimator -- see the big
// comment above estimateMeasurementsCm() in catalog.js: this reads real
// numbers from Lemon Tree's own graded size chart (interpolated/extrapolated
// as needed), still just a starting estimate for the customer to review.
const sizeEstimateToggleBtn = document.getElementById("sizeEstimateToggleBtn");
const sizeEstimatePanel = document.getElementById("sizeEstimatePanel");
const estJacketChestSelect = document.getElementById("estJacketChest");
const estJacketLengthSelect = document.getElementById("estJacketLength");
const estPantsWaistSelect = document.getElementById("estPantsWaist");
const estPantsInseamSelect = document.getElementById("estPantsInseam");
const estPantsLengthSelect = document.getElementById("estPantsLength");
const estJacketFitSelect = document.getElementById("estJacketFit");
const estPantsFitSelect = document.getElementById("estPantsFit");
const applyEstimateBtn = document.getElementById("applyEstimateBtn");
const sizeEstimatePantsFields = document.querySelectorAll(".size-estimate-pants-field");

// A Jacket Only order has no Pants step at all, so the "Don't know your
// measurements?" estimator shouldn't ask for a pants waist/inseam/length/fit
// either -- called from applySuitType() below whenever the suit type
// changes (picking a card on suitTypeSection, or restoring a saved draft).
function updateSizeEstimatePantsFieldsForSuitType() {
  const hide = currentSuitType === "jacketOnly";
  sizeEstimatePantsFields.forEach((field) => {
    field.hidden = hide;
  });
}

function populateSizeSelect(selectEl, values, suffix) {
  selectEl.innerHTML = "";
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = v + (suffix || "");
    selectEl.appendChild(opt);
  });
}
if (estJacketChestSelect) populateSizeSelect(estJacketChestSelect, JACKET_CHEST_SIZE_OPTIONS, "\" chest");
if (estPantsWaistSelect) populateSizeSelect(estPantsWaistSelect, PANTS_WAIST_SIZE_OPTIONS, "\" waist");
if (estPantsInseamSelect) populateSizeSelect(estPantsInseamSelect, PANTS_INSEAM_OPTIONS, "\" inseam");
// Default to common middle-of-the-road sizes so the panel isn't blank.
if (estJacketChestSelect) estJacketChestSelect.value = "40";
if (estPantsWaistSelect) estPantsWaistSelect.value = "34";
if (estPantsInseamSelect) estPantsInseamSelect.value = "32";

if (sizeEstimateToggleBtn && sizeEstimatePanel) {
  sizeEstimateToggleBtn.addEventListener("click", () => {
    sizeEstimatePanel.hidden = !sizeEstimatePanel.hidden;
    sizeEstimateToggleBtn.classList.toggle("open", !sizeEstimatePanel.hidden);
  });
}

if (applyEstimateBtn) {
  applyEstimateBtn.addEventListener("click", () => {
    const estimates = estimateMeasurementsCm(
      parseFloat(estJacketChestSelect.value),
      estJacketLengthSelect.value,
      parseFloat(estPantsWaistSelect.value),
      parseFloat(estPantsInseamSelect.value),
      estPantsLengthSelect ? estPantsLengthSelect.value : "R",
      estJacketFitSelect ? estJacketFitSelect.value : "regular",
      estPantsFitSelect ? estPantsFitSelect.value : "regular"
    );
    MEASUREMENTS.forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el && estimates[m.id] !== undefined) el.value = estimates[m.id].toFixed(1);
    });
    saveDraft();

    // Close the estimate panel and scroll down to the now-filled
    // measurements table so the customer can see everything landed.
    if (sizeEstimatePanel) sizeEstimatePanel.hidden = true;
    if (sizeEstimateToggleBtn) sizeEstimateToggleBtn.classList.remove("open");
    if (measureGrid) {
      smoothScrollWindowTo(window.scrollY + measureGrid.getBoundingClientRect().top - 20 - getNavClearance());
    }
  });
}

document.getElementById("continueBtn").addEventListener("click", () => {
  if (!jacketDesigner.isComplete()) {
    alert("Select an option for: " + jacketDesigner.missingLabels().join(", "));
    return;
  }
  // "Jacket Only" has no Pants step -- skip straight to Measurements.
  if (currentSuitType === "jacketOnly") {
    goToStep(jacketSection, stepAfterDesign());
    return;
  }
  pantsDesigner.resetToFirstTab();
  goToStep(jacketSection, pantsSection);
});

document.getElementById("backToJacketBtn").addEventListener("click", () => {
  // Unlike Continue (which always starts the next designer fresh at its
  // first tab), Back returns to whichever category tab was last open --
  // so reviewing an earlier step doesn't lose your place in it.
  goToStep(pantsSection, jacketSection);
});

document.getElementById("continuePantsBtn").addEventListener("click", () => {
  if (!pantsDesigner.isComplete()) {
    alert("Select an option for: " + pantsDesigner.missingLabels().join(", "));
    return;
  }
  goToStep(pantsSection, stepAfterDesign());
});

// The Preview page (see index.html) sits between designing and
// measurements, but only once the suit-picture service is set up.
let previewStepOn = false;
function stepAfterDesign() {
  return previewStepOn ? previewSection : measurementsSection;
}

document.getElementById("backFromPreviewBtn").addEventListener("click", () => {
  goToStep(previewSection, currentSuitType === "jacketOnly" ? jacketSection : pantsSection);
});
document.getElementById("continueFromPreviewBtn").addEventListener("click", () => {
  goToStep(previewSection, measurementsSection);
});

document.getElementById("backToDesignerBtn").addEventListener("click", () => {
  // Same as backToJacketBtn above -- Back resumes on the last tab you had
  // open, it doesn't reset to Fabric. "Jacket Only" skipped Pants on the way
  // in, so Back skips it too, straight to the jacket designer.
  if (previewStepOn) {
    goToStep(measurementsSection, previewSection);
    return;
  }
  if (currentSuitType === "jacketOnly") {
    goToStep(measurementsSection, jacketSection);
    return;
  }
  goToStep(measurementsSection, pantsSection);
});

// Reads + validates the measurement fields without navigating anywhere;
// shared by the "Continue" button here and the final submit on the next page.
function collectMeasurements() {
  const values = {};
  const missing = [];
  activeMeasurements().forEach((m) => {
    const raw = document.getElementById("m_" + m.id).value;
    const val = parseFloat(raw);
    if (raw === "" || isNaN(val) || val <= 0) {
      missing.push(m.label);
    } else {
      values[m.id] = val;
    }
  });
  return { values, missing };
}

document.getElementById("continueToPersonalInfoBtn").addEventListener("click", () => {
  if (!commitCurrentSuitToCart()) return;
  goToStep(measurementsSection, personalInfoSection);
});

const addAnotherSuitBtn = document.getElementById("addAnotherSuitBtn");
if (addAnotherSuitBtn) {
  addAnotherSuitBtn.addEventListener("click", () => {
    if (!commitCurrentSuitToCart()) return;
    jacketDesigner.resetSelections();
    pantsDesigner.resetSelections();
    // Measurements are cleared, not carried over -- suits added to the same
    // order are just as often for someone else (a gift, a groomsman) as for
    // the same person, so blank fields are the safer default. Anyone who IS
    // ordering another suit for themselves can fill them back in instantly
    // with the "Use the same measurements as Suit N" banner above the grid
    // (see samePreviousMeasurementsBanner / updateSamePreviousMeasurementsBanner)
    // instead of retyping everything.
    MEASUREMENTS.forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el) el.value = "";
    });
    // Routed through suitTypeSection (rather than straight back to the
    // jacket designer) so the next item in the same order can be a
    // different suit type -- e.g. a full suit plus a spare jacket.
    pendingCommitIndex = null;
    goToStep(measurementsSection, suitTypeSection);
  });
}

document.getElementById("backToMeasurementsBtn").addEventListener("click", () => {
  goToStep(personalInfoSection, measurementsSection);
});

// Formats the shipping details as a short block that goes above the Client
// Form in the email/on-screen summary (kept separate from the Client Form
// text itself, which follows the shop's fixed printed-form layout).
function buildShippingBlock(customerName, addr) {
  const lines = [];
  lines.push("SHIP TO");
  lines.push(customerName);
  lines.push(addr.address1);
  if (addr.address2) lines.push(addr.address2);
  let cityStateZip = [addr.city, addr.state].filter(Boolean).join(", ");
  if (addr.zip) cityStateZip += (cityStateZip ? " " : "") + addr.zip;
  if (cityStateZip) lines.push(cityStateZip);
  if (addr.country) lines.push(addr.country);
  return lines.join("\n");
}

// Phone/email, kept separate from buildShippingBlock/buildClientFormText on
// purpose -- see the comment where this is called in the submit handler.
// Only used to build the order notification email, never the Client Form
// text shown on the confirmation page or saved as client_form_text.
function buildContactBlock(phone, email) {
  const lines = [];
  lines.push("CONTACT");
  if (phone) lines.push("Phone: " + phone);
  if (email) lines.push("Email: " + email);
  return lines.join("\n");
}

// Address suggestions on the street address field (Geoapify), so customers
// can pick their address instead of typing it all out -- selecting one also
// fills in city/state/ZIP/country automatically. Plain fetch() + a dropdown
// we draw ourselves, since Geoapify is a simple REST API with no script/SDK
// to load. Only runs if a Geoapify API key has been configured in config.js
// -- otherwise the field just stays a normal text input.
function initAddressAutocomplete() {
  const input = document.getElementById("shippingAddress1");
  const list = document.getElementById("addressSuggestions");
  if (!input || !list) return;
  if (typeof GEOAPIFY_API_KEY === "undefined" || !GEOAPIFY_API_KEY) return;

  let debounceTimer = null;
  let activeController = null;
  let suggestions = [];
  let highlightedIndex = -1;

  function closeList() {
    list.innerHTML = "";
    list.classList.remove("open");
    suggestions = [];
    highlightedIndex = -1;
  }

  function applySuggestion(r) {
    const line1 =
      r.address_line1 || [r.housenumber, r.street].filter(Boolean).join(" ") || input.value;
    input.value = line1;
    const cityEl = document.getElementById("shippingCity");
    const stateEl = document.getElementById("shippingState");
    const zipEl = document.getElementById("shippingZip");
    const countryEl = document.getElementById("shippingCountry");
    if (cityEl && r.city) cityEl.value = r.city;
    if (stateEl && r.state) stateEl.value = r.state;
    if (zipEl && r.postcode) zipEl.value = r.postcode;
    if (countryEl && r.country) countryEl.value = r.country;
    saveDraft();
  }

  function renderList(results) {
    suggestions = results || [];
    highlightedIndex = -1;
    list.innerHTML = "";
    if (!suggestions.length) {
      list.classList.remove("open");
      return;
    }
    suggestions.forEach((r) => {
      const item = document.createElement("div");
      item.className = "address-suggestion";
      item.textContent = r.formatted || r.address_line1 || "";
      // mousedown (not click) so this fires before the input's blur closes the list
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applySuggestion(r);
        closeList();
      });
      list.appendChild(item);
    });
    list.classList.add("open");
  }

  function setHighlighted(index) {
    const items = list.querySelectorAll(".address-suggestion");
    items.forEach((el) => el.classList.remove("highlighted"));
    if (index >= 0 && index < items.length) {
      items[index].classList.add("highlighted");
      items[index].scrollIntoView({ block: "nearest" });
    }
    highlightedIndex = index;
  }

  input.addEventListener("input", () => {
    const text = input.value.trim();
    clearTimeout(debounceTimer);
    if (text.length < 3) {
      closeList();
      return;
    }
    debounceTimer = setTimeout(() => {
      if (activeController) activeController.abort();
      activeController = new AbortController();
      const url =
        "https://api.geoapify.com/v1/geocode/autocomplete?text=" +
        encodeURIComponent(text) +
        "&format=json&limit=5&apiKey=" +
        encodeURIComponent(GEOAPIFY_API_KEY);
      fetch(url, { signal: activeController.signal })
        .then((res) => res.json())
        .then((data) => renderList(data && data.results))
        .catch(() => {
          // Network hiccup, request aborted, or bad key -- the field just
          // keeps working as a normal text input either way.
        });
    }, 300);
  });

  input.addEventListener("keydown", (e) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(Math.min(highlightedIndex + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(Math.max(highlightedIndex - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[highlightedIndex]);
      closeList();
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  input.addEventListener("blur", () => {
    // Small delay so a suggestion's mousedown still registers first.
    setTimeout(closeList, 150);
  });
}
initAddressAutocomplete();

// ---------------------------------------------------------------------------
// Cart -- lets a customer design more than one suit in a single order. Each
// entry is one suit's fully-resolved selections + measurements, captured via
// commitCurrentSuitToCart() whenever they finish a suit (either by clicking
// "Add to Cart & Design Another Suit" on the Measurements page, or by
// clicking "Continue to Personal Info", which commits the suit they just
// finished before moving on to checkout). A single-suit order still works
// exactly as it always did -- it just means the cart ends up holding one
// item by the time checkout happens, invisibly.
// ---------------------------------------------------------------------------
let cartItems = [];

// Tracks the cartItems index that reflects whatever the jacket/pants/
// measurements designer currently has loaded, or null if the current
// designer state hasn't been committed to the cart yet. This is what lets
// someone go back from Personal Info (or back further, to Measurements/
// Pants/Jacket) to tweak a suit and click through again without ending up
// with a duplicate entry -- commitCurrentSuitToCart() below updates this
// same slot in place instead of pushing a new one. It's deliberately reset
// to null after removing any cart item (see removeCartItem) rather than
// trying to track exactly which index shifted where -- simpler, and the
// only downside is a rare edge case (remove a suit, then go back and
// re-confirm an unrelated one) very occasionally adding a duplicate instead
// of updating in place, which is a fine tradeoff for a small shop's cart.
let pendingCommitIndex = null;

// Converts a resolved selections map (as returned by a designer's
// getSelections(), or as stored in a cart item -- both already have any
// "same as jacket" links resolved to a real value, never the internal
// marker) into a plain {column: value} row using the catalog's own
// key-to-column mapping. Pulled out on its own so row-building doesn't need
// a *live* designer instance -- every suit but the last one in the cart no
// longer matches the live jacketDesigner/pantsDesigner state, since
// designing another suit resets them.
function selectionsToRow(catalog, selections) {
  const row = {};
  Object.keys(catalog).forEach((key) => {
    row[catalog[key].column] = selections[key];
  });
  return row;
}

// ---------------------------------------------------------------------------
// Visual spec -- a plain-English description of one suit, saved on its order
// row as `visual_spec`. When the shop marks the order "completed", an AI reads
// THIS (not the raw production codes) to write the image-generation prompt for
// a picture of the finished suit. So it uses customer-facing names (e.g.
// "Smoky Onyx", not "26SU218.DBV3529"), adds pattern/family/hex color where
// the catalog knows them, and deliberately contains NO personal data: no
// name, contact details, address, or body measurements.
// ---------------------------------------------------------------------------
function visualSpecOptionDetail(cat, rawValue) {
  if (!cat || rawValue === undefined || rawValue === null || rawValue === "") return null;
  const opt = (cat.options || []).find((o) => o.name === rawValue);
  const shown = (opt && (opt.displayName || opt.name)) || rawValue;
  if (opt && opt.matchesFabric) return { opt, text: shown, matchesFabric: true };
  // Pattern type / color family, when the category is organized that way.
  let pattern = "";
  let family = "";
  (cat.patternTypes || []).forEach((p) => {
    (p.colorFamilies || []).forEach((f) => {
      if ((f.options || []).some((o) => o.name === rawValue)) { pattern = p.name; family = f.name; }
    });
  });
  if (!family) {
    (cat.colorFamilies || []).forEach((f) => {
      if ((f.options || []).some((o) => o.name === rawValue)) family = f.name;
    });
  }
  const parts = [];
  if (pattern) parts.push(pattern + " pattern");
  if (family) parts.push(family + " color family");
  if (opt && opt.hex) parts.push("approx. color " + opt.hex);
  return { opt, text: shown + (parts.length ? " (" + parts.join(", ") + ")" : ""), matchesFabric: false };
}

// Options whose catalog line drawing is also sent to the picture generator,
// because words alone don't pin down their shape (slanted or overlapping
// cuff buttons, the waistband tab, double-breasted stances...).
const VISUAL_SPEC_STYLE_DRAWINGS = ["collar", "frontbutton", "sleevecuffstyle", "cuffbuttons", "waistbandExtension", "waistbandStyle", "bottomStyle"];

function buildVisualSpecText(item, opts) {
  const isJacketOnly = item.type === "jacketOnly";
  const lines = [];
  // Swatch photos the picture generator is shown alongside the text, so the
  // fabric, lining and buttons in the picture match the real ones. Site
  // paths (./assets/...) or the customer's own uploaded lining photo.
  const swatches = [];
  const addSwatch = (label, src) => {
    if (src && !swatches.some((s) => s.endsWith(" " + src))) swatches.push("Swatch " + label + ": " + src);
  };
  lines.push("Suit type: " + (isJacketOnly ? "Jacket only (no pants)" : "Full suit (jacket + pants)"));
  const sections = [["JACKET", JACKET_CATALOG, item.jacket || {}]];
  if (!isJacketOnly) sections.push(["PANTS", PANTS_CATALOG, item.pants || {}]);
  sections.forEach(([title, catalog, sel]) => {
    lines.push("");
    lines.push(title);
    const fabricDetail = visualSpecOptionDetail(catalog.fabric, sel.fabric);
    const fabricHex = fabricDetail && fabricDetail.opt && fabricDetail.opt.hex ? fabricDetail.opt.hex : "";
    Object.keys(catalog).forEach((key) => {
      const cat = catalog[key];
      const d = visualSpecOptionDetail(cat, sel[key]);
      if (!d) return;
      let text = d.text;
      if (d.matchesFabric) {
        // Stored value is the "match the fabric" marker; describe what that means visually.
        text = "matched to the fabric color" + (fabricHex ? " (approx. color " + fabricHex + ")" : "");
      }
      lines.push(cat.label + ": " + text);
      if (!d.opt || d.matchesFabric || d.opt.uploadPhoto) return;
      const part = title === "PANTS" ? "pants " : "";
      if (key === "fabric") addSwatch(part + "fabric", d.opt.img);
      else if (key === "lining") addSwatch("lining", (typeof LINING_ZOOM_MAP !== "undefined" && LINING_ZOOM_MAP[d.opt.name]) || d.opt.img);
      else if (key === "buttoncolor") addSwatch("button", d.opt.img);
      else if (VISUAL_SPEC_STYLE_DRAWINGS.includes(key)) addSwatch("style " + cat.label, d.opt.img);
    });
  });
  if (opts && opts.liningPhotoUrl) addSwatch("lining (customer's own photo)", opts.liningPhotoUrl);
  if (swatches.length) {
    lines.push("");
    lines.push("REFERENCE SWATCHES");
    swatches.forEach((s) => lines.push(s));
  }
  return lines.join("\n");
}

function cartTotalUsd() {
  if (!cartItems.length) {
    let extra = 0;
    try { extra = liningUploadSurcharge(jacketDesigner.getSelections()); } catch (e) { extra = 0; }
    return suitPriceForType(currentSuitType) + extra;
  }
  return cartItems.reduce((sum, item) => sum + itemPriceUsd(item), 0);
}

// Keeps the Submit/Pay button and the order-total note on the Personal Info
// page in sync with how many suits are actually in the cart. Called
// whenever the cart changes, and once at page load. Falls back to treating
// the order as "1 suit" when the cart is still empty (nothing committed
// yet) so a first-time visitor sees the same $350 they'd always see, with
// nothing looking unfinished before they've reached this page.
function updateOrderSummaryUI() {
  const total = cartTotalUsd();
  submitBtn.textContent = PAYPAL_ENABLED ? "Pay $" + total + " & Submit Order" : "Submit Order";
  if (!orderTotalNote) return;
  const qty = cartItems.length || 1;
  let text = "Total: $" + total + " (" + qty + (qty === 1 ? " suit" : " suits") + ")";
  if (PAYPAL_ENABLED) text += " -- you'll pay securely via PayPal before your order is submitted.";
  orderTotalNote.textContent = text;
  orderTotalNote.hidden = false;
  const persPriceEl = document.getElementById("persPrice");
  if (persPriceEl) persPriceEl.textContent = "$" + total;
}

// Renders the cart icon's badge and its dropdown contents (see index.html)
// -- the icon itself always shows (so the feature is discoverable even with
// nothing in the cart yet); only the badge count and the dropdown's list
// change with cartItems.
function renderCartBar() {
  const cartBadge = document.getElementById("cartBadge");
  const cartBarCount = document.getElementById("cartBarCount");
  const cartBarTotal = document.getElementById("cartBarTotal");
  const cartBarList = document.getElementById("cartBarList");
  const cartCheckoutBtn = document.getElementById("cartCheckoutBtn");
  if (!cartBadge || !cartBarCount || !cartBarTotal || !cartBarList) return;

  if (cartItems.length) {
    cartBadge.hidden = false;
    cartBadge.textContent = String(cartItems.length);
  } else {
    cartBadge.hidden = true;
  }

  cartBarCount.textContent = cartItems.length + (cartItems.length === 1 ? " suit" : " suits");
  cartBarTotal.textContent = "$" + cartItems.reduce((sum, item) => sum + itemPriceUsd(item), 0);
  if (cartCheckoutBtn) cartCheckoutBtn.hidden = !cartItems.length;

  cartBarList.innerHTML = "";
  if (!cartItems.length) {
    const empty = document.createElement("p");
    empty.className = "nav-cart-empty";
    empty.textContent = "No suits added yet.";
    cartBarList.appendChild(empty);
    return;
  }
  cartItems.forEach((item, i) => {
    const fabric = (item.jacket && item.jacket.fabric) || "";
    // Previously this only labeled the Jacket Only case, leaving a plain
    // "Suit 1 -- Charcoal Gray" for a full suit with no hint of what's
    // actually in it -- now both cases say so, so the cart list reads the
    // same way (suit type, then fabric) no matter which was ordered.
    const typeTag = item.type === "jacketOnly" ? "Jacket Only" : "Full Suit";
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML =
      '<div class="cart-item-info"><span class="cart-item-type"></span><span class="cart-item-label"></span></div>' +
      '<span class="cart-item-price">$' + itemPriceUsd(item) + "</span>" +
      '<button type="button" class="cart-item-remove" aria-label="Remove this suit">&times;</button>';
    row.querySelector(".cart-item-type").textContent = "Suit " + (i + 1) + " \u00b7 " + typeTag;
    row.querySelector(".cart-item-label").textContent = fabric || typeTag;
    row.querySelector(".cart-item-remove").addEventListener("click", (e) => {
      // Without this, the click event -- after removeCartItem's synchronous
      // renderCartBar() rebuilds this list and detaches this very button --
      // keeps bubbling up to the document-level "click outside the dropdown"
      // listener (see initCartDropdown). By then e.target is a detached
      // node, so dropdown.contains(e.target) reads false even though the
      // click plainly started inside the dropdown, and that listener closes
      // it right out from under removeCartItem's own open/closed decision
      // below. Stopping it here is what lets that decision stick.
      e.stopPropagation();
      removeCartItem(i);
    });
    cartBarList.appendChild(row);
  });
}

function removeCartItem(index) {
  cartItems.splice(index, 1);
  // See the comment on pendingCommitIndex above -- simplest safe thing to do
  // here is forget which slot (if any) matched the live designer state,
  // rather than trying to shift the index along with the removed item.
  pendingCommitIndex = null;
  renderCartBar();
  updateOrderSummaryUI();
  saveDraft();

  // Removing the last suit leaves nothing to review -- close the dropdown
  // automatically instead of leaving an empty "No suits added yet." popover
  // open. With suits still left, leave it open so removing a second (or
  // third) one doesn't mean reopening the cart each time.
  if (!cartItems.length) {
    const dropdown = document.getElementById("cartDropdown");
    const cartToggleBtn = document.getElementById("cartIconBtn");
    if (dropdown) dropdown.hidden = true;
    if (cartToggleBtn) cartToggleBtn.setAttribute("aria-expanded", "false");
  }
}

// Shows/hides the "Use the same measurements as Suit N" banner on the
// Measurements step (see samePreviousMeasurementsBanner in index.html).
// Each new suit's measurement fields start blank (addAnotherSuitBtn below
// clears them rather than carrying anything over) since different suits in
// one order are often for different people -- this banner is the one-click
// shortcut for the common case where they're actually the same person.
// Only meaningful once at least one suit has already been committed to the
// cart; called from applySuitType() so it stays in sync whenever the suit
// type (and therefore the measurement grid) is set up, both for a fresh
// suit and when restoring a saved draft.
const samePreviousMeasurementsBanner = document.getElementById("samePreviousMeasurementsBanner");
const useSamePreviousMeasurementsBtn = document.getElementById("useSamePreviousMeasurementsBtn");
const samePreviousMeasurementsSuitNum = document.getElementById("samePreviousMeasurementsSuitNum");

function updateSamePreviousMeasurementsBanner() {
  if (!samePreviousMeasurementsBanner) return;
  samePreviousMeasurementsBanner.hidden = !cartItems.length;
  if (cartItems.length && samePreviousMeasurementsSuitNum) {
    samePreviousMeasurementsSuitNum.textContent = String(cartItems.length);
  }
}

if (useSamePreviousMeasurementsBtn) {
  useSamePreviousMeasurementsBtn.addEventListener("click", () => {
    const previous = cartItems[cartItems.length - 1];
    if (!previous || !previous.measurements) return;
    activeMeasurements().forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el && previous.measurements[m.id] !== undefined) el.value = previous.measurements[m.id];
    });
    saveDraft();
    if (measureGrid) {
      smoothScrollWindowTo(window.scrollY + measureGrid.getBoundingClientRect().top - 20 - getNavClearance());
    }
  });
}

// Clears every measurement field currently showing back to blank -- the
// undo button for whichever shortcut filled them in (the same-as-previous-
// suit banner above, the saved-profile banner, or the standard-size
// estimator), or just for someone who typed something in and wants a clean
// slate. No confirmation prompt: nothing else is affected (the cart and any
// saved profile measurements are untouched until this suit is actually
// committed), and every fill shortcut is still one click away afterward.
const resetMeasurementsBtn = document.getElementById("resetMeasurementsBtn");
if (resetMeasurementsBtn) {
  resetMeasurementsBtn.addEventListener("click", () => {
    activeMeasurements().forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el) el.value = "";
    });
    saveDraft();
  });
}

// Opens/closes the cart dropdown from the nav icon -- a plain popover, not a
// page. Same accessible-ish pattern as the other overlays on this page:
// click the trigger to toggle, click anywhere outside to close, Escape to
// close. Unlike those, this isn't a modal (the rest of the page stays
// interactive), so it only needs a plain document-level click listener
// rather than focus-trapping.
(function initCartDropdown() {
  const toggleBtn = document.getElementById("cartIconBtn");
  const dropdown = document.getElementById("cartDropdown");
  if (!toggleBtn || !dropdown) return;

  function closeDropdown() {
    dropdown.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  // The dropdown is `position:fixed` with no static top/left in the CSS --
  // on narrow screens .nav-right can wrap (flex-wrap), which leaves the
  // cart icon (and its small .nav-cart wrapper) anywhere along a wrapped
  // row rather than reliably at the right edge. So instead of anchoring the
  // dropdown to its parent with CSS, we read the icon's actual on-screen
  // position each time it opens and place the dropdown from there.
  //
  // On mobile the header also isn't flush -- the icon sits to the left of
  // the Start Designing/Start Over button, not at the screen's own right
  // edge -- so anchoring purely to the icon can leave the dropdown looking
  // off-center rather than reading as "the cart, top right". On mobile we
  // pin it to the actual right edge of the viewport instead; on desktop we
  // keep it right-aligned under the icon. Either way it's clamped within
  // the viewport (with a small margin) so it never runs off-screen.
  function positionDropdown() {
    const margin = 12;
    const isMobile = window.innerWidth <= 900;
    const iconRect = toggleBtn.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const width = dropdownRect.width || 300;

    let left = isMobile ? window.innerWidth - width - margin : iconRect.right - width;
    left = Math.min(left, window.innerWidth - width - margin);
    left = Math.max(left, margin);

    let top = iconRect.bottom + 12;
    const height = dropdownRect.height || 0;
    if (height && top + height > window.innerHeight - margin) {
      top = Math.max(iconRect.top - height - 12, margin);
    }

    dropdown.style.left = left + "px";
    dropdown.style.top = top + "px";
  }

  function openDropdown() {
    dropdown.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    positionDropdown();
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdown.hidden) openDropdown();
    else closeDropdown();
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== toggleBtn) closeDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dropdown.hidden) closeDropdown();
  });
  window.addEventListener("resize", () => {
    if (!dropdown.hidden) positionDropdown();
  });
})();

// "Checkout" in the cart dropdown -- goes straight to Personal Info/shipping
// with whatever's already sitting in the cart, from anywhere on the page.
// Deliberately NOT routed through goToStepById (which blocks jumping ahead
// of the step you're on) -- everything in the cart already passed its own
// validation when it was added (see commitCurrentSuitToCart), so there's
// nothing left to skip past. Any suit still mid-design and not yet added to
// the cart simply isn't part of the order, same as any other cart/checkout
// flow -- its draft stays saved, so nothing is lost, just not submitted yet.
function goToCheckout() {
  const swap = () => {
    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    personalInfoSection.classList.add("active");
    scrollToStepTop(personalInfoSection);
    saveDraft();
  };
  const currentActiveEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const hideTop = currentActiveEl ? window.scrollY + currentActiveEl.getBoundingClientRect().top - getNavClearance() : 0;
  if (currentActiveEl && window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}

const cartCheckoutBtn = document.getElementById("cartCheckoutBtn");
if (cartCheckoutBtn) {
  cartCheckoutBtn.addEventListener("click", () => {
    if (!cartItems.length) return;
    const dropdown = document.getElementById("cartDropdown");
    const cartToggleBtn = document.getElementById("cartIconBtn");
    if (dropdown) dropdown.hidden = true;
    if (cartToggleBtn) cartToggleBtn.setAttribute("aria-expanded", "false");
    markDesignStarted();
    goToCheckout();
  });
}

// Validates the suit currently loaded in the jacket/pants/measurements
// designer and saves it into the cart -- either as a brand new entry, or
// (if this is the same suit already sitting at the end of the cart --
// see pendingCommitIndex) updating that entry in place so going back to
// tweak something and continuing again never creates a duplicate. Used by
// both "Add to Cart & Design Another Suit" and "Continue to Personal Info".
function commitCurrentSuitToCart() {
  const { values: measurementValues, missing: missingMeasurements } = collectMeasurements();
  if (missingMeasurements.length) {
    alert("Please enter a valid measurement for: " + missingMeasurements.join(", "));
    return false;
  }
  const item = {
    type: currentSuitType,
    jacket: jacketDesigner.getSelections(),
    pants: currentSuitType === "jacketOnly" ? null : pantsDesigner.getSelections(),
    measurements: measurementValues,
    // The customer's own lining photo (data URL) when they chose that option.
    liningPhoto: jacketDesigner.getLiningPhoto(),
    // Typed answers such as the monogram: { jacket: { monogram }, pants: { monogram } }.
    texts: { jacket: jacketDesigner.getTexts(), pants: currentSuitType === "jacketOnly" ? {} : pantsDesigner.getTexts() },
    // A "Generate My Suit" picture of exactly this design, if one was drawn.
    previewId: currentDesignPreviewId(),
  };
  if (pendingCommitIndex !== null && pendingCommitIndex === cartItems.length - 1) {
    cartItems[pendingCommitIndex] = item;
  } else {
    cartItems.push(item);
    pendingCommitIndex = cartItems.length - 1;
  }
  renderCartBar();
  updateOrderSummaryUI();
  saveDraft();

  // Fire-and-forget: a signed-in customer with the checkbox left checked
  // (see saveMeasurementsToggleWrap in index.html) gets this order's
  // measurements folded into their saved profile automatically, without
  // making them wait on it here. Unchecked -- e.g. ordering as a gift for
  // someone else -- and nothing about their own saved profile changes.
  if (currentUser && saveMeasurementsToProfileCheckbox && saveMeasurementsToProfileCheckbox.checked) {
    saveProfileMeasurements(measurementValues);
  }

  return true;
}

// PayPal is optional -- see config.js. Leave PAYPAL_BUSINESS_EMAIL blank to
// keep accepting orders exactly as before, with no payment step at all.
const PAYPAL_ENABLED =
  typeof PAYPAL_BUSINESS_EMAIL !== "undefined" &&
  !!PAYPAL_BUSINESS_EMAIL &&
  !PAYPAL_BUSINESS_EMAIL.includes("PASTE_YOUR");

// Builds a classic PayPal "Website Payments Standard" checkout link -- just
// a plain URL, no API key or server needed, using only the shop's PayPal
// email (business or personal, as long as it can receive money). Charges
// for every suit currently in the cart at once ($350 x however many),
// rather than one at a time. PayPal sends the customer back to this same
// page afterward: to "return" with ?paypal_return=1 once they've paid, or
// to "cancel_return" with ?paypal_cancelled=1 if they back out. Both are
// handled in handlePayPalReturn() below.
//
// Caveat worth knowing: this simple, no-server version can't cryptographically
// verify a payment actually happened (that needs PayPal's IPN/webhooks, which
// need a server to receive them) -- it just trusts the redirect PayPal sends
// back. Fine for a small shop for now, but not fraud-proof.
function buildPayPalCheckoutUrl() {
  const baseUrl = window.location.href.split("?")[0].split("#")[0];
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: PAYPAL_BUSINESS_EMAIL,
    item_name: "Scott's Suits custom suit order (" + cartItems.length + (cartItems.length === 1 ? " suit)" : " suits)"),
    amount: cartTotalUsd().toFixed(2),
    currency_code: "USD",
    no_shipping: "1",
    return: baseUrl + "?paypal_return=1",
    cancel_return: baseUrl + "?paypal_cancelled=1",
  });
  return "https://www.paypal.com/cgi-bin/webscr?" + params.toString();
}

const submitBtn = document.getElementById("submitOrderBtn");
const orderTotalNote = document.getElementById("orderTotalNote");
updateOrderSummaryUI();
renderCartBar();
const customerNameInput = document.getElementById("customerName");
const customerPhoneInput = document.getElementById("customerPhone");
const customerEmailInput = document.getElementById("customerEmail");
const shippingAddress1Input = document.getElementById("shippingAddress1");
const shippingAddress2Input = document.getElementById("shippingAddress2");
const shippingCityInput = document.getElementById("shippingCity");
const shippingStateInput = document.getElementById("shippingState");
const shippingZipInput = document.getElementById("shippingZip");
const shippingCountryInput = document.getElementById("shippingCountry");
[
  customerNameInput,
  customerEmailInput,
  shippingAddress1Input,
  shippingAddress2Input,
  shippingCityInput,
  shippingStateInput,
  shippingZipInput,
  shippingCountryInput,
].forEach((el) => el.addEventListener("input", saveDraft));

// Formats a US phone number as the customer types -- "(555) 123-4567" --
// instead of leaving it as a plain run of digits. Not run through
// customerPhoneInput.addEventListener("input", saveDraft) above because it
// needs to reformat the field's value BEFORE saveDraft reads it, so the
// draft always stores the nicely formatted version, not whatever was there
// a keystroke ago.
function formatUSPhoneNumber(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length < 4) return "(" + digits;
  if (digits.length < 7) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}
customerPhoneInput.addEventListener("input", () => {
  customerPhoneInput.value = formatUSPhoneNumber(customerPhoneInput.value);
  saveDraft();
});

// Reads and validates everything on the Personal Info page, the same checks
// the old single submit handler always did. Returns null (after alerting
// exactly what's wrong) if anything required is missing or invalid, or a
// plain object with everything finalizeOrder() needs otherwise. Pulled out
// on its own so it can run twice: once right before sending someone to
// PayPal (so we never send them off to pay only to fail validation), and
// again automatically when they're sent back here after paying.
//
// Doesn't touch measurements -- those are validated per-suit and captured
// into the cart already (see commitCurrentSuitToCart), not collected fresh
// here. This only checks that there's actually at least one suit to submit.
function collectAndValidateOrderInput() {
  if (!cartItems.length) {
    alert("Your cart is empty -- please go back and finish designing at least one suit before submitting.");
    return null;
  }

  const customerName = customerNameInput.value.trim();
  const customerPhone = customerPhoneInput.value.trim();
  const customerEmail = customerEmailInput.value.trim();
  const address1 = shippingAddress1Input.value.trim();
  const address2 = shippingAddress2Input.value.trim();
  const city = shippingCityInput.value.trim();
  const state = shippingStateInput.value.trim();
  const zip = shippingZipInput.value.trim();
  const country = shippingCountryInput.value.trim();

  const missingContact = [];
  if (!customerName) missingContact.push("Full name");
  if (!customerPhone) missingContact.push("Phone number");
  if (!customerEmail) missingContact.push("Email");
  if (!address1) missingContact.push("Street address");
  if (!city) missingContact.push("City");
  if (!state) missingContact.push("State/Province");
  if (!zip) missingContact.push("ZIP/Postal code");
  if (missingContact.length) {
    alert("Please fill in: " + missingContact.join(", "));
    return null;
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    alert("Please enter a valid email address.");
    return null;
  }

  return {
    customerName,
    customerPhone,
    customerEmail,
    address1,
    address2,
    city,
    state,
    zip,
    country,
  };
}

// Builds the "CLIENT FORM" text for every suit in the cart and stitches them
// together into one block. A single-suit order (the common case) skips the
// "SUIT 1 OF 1" header -- nothing changes structurally for the customer who
// only ever orders one suit. With more than one suit, each gets its own
// clearly labeled section.
// The monogram text typed for one garment of a cart item ("jacket"/"pants").
function monoText(item, part) {
  return (item && item.texts && item.texts[part] && item.texts[part].monogram) || "";
}
function buildAllSuitsClientFormText(customerName) {
  if (cartItems.length === 1) {
    const item = cartItems[0];
    return buildClientFormText(customerName, item.type, item.jacket, item.pants, item.measurements, { liningPhotoUrl: (window.__liningPhotoUrls || [])[0], jacketMonogramText: monoText(item, "jacket"), pantsMonogramText: monoText(item, "pants") });
  }
  return cartItems
    .map((item, i) => {
      const text = buildClientFormText(customerName, item.type, item.jacket, item.pants, item.measurements, { liningPhotoUrl: (window.__liningPhotoUrls || [])[i], jacketMonogramText: monoText(item, "jacket"), pantsMonogramText: monoText(item, "pants") });
      return "SUIT " + (i + 1) + " OF " + cartItems.length + "\n" + text;
    })
    .join("\n\n" + "=".repeat(40) + "\n\n");
}

// Uploads each suit's custom lining photo (if any) to Supabase Storage and
// returns the public URLs by cart index (undefined when none/failed).
async function uploadLiningPhotos(orderId) {
  const urls = [];
  window.__liningPhotoUrls = urls;
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    if (!liningUploadSurcharge(item.jacket) || !item.liningPhoto) continue;
    try {
      const blob = await (await fetch(item.liningPhoto)).blob();
      const path = orderId + "/suit-" + (i + 1) + ".jpg";
      const client = getSupabase();
      const { error } = await client.storage.from("lining-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      urls[i] = client.storage.from("lining-photos").getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.warn("Lining photo upload failed (order still saved):", err);
    }
  }
  return urls;
}

// Actually saves the order (Supabase) and emails the shop (Formspree), then
// shows the confirmation screen. Assumes its input already passed
// collectAndValidateOrderInput() -- called either directly (PayPal not
// configured, or nothing to pay) or after a customer is sent back here
// having paid. Inserts one Supabase row per suit in the cart, all sharing
// the same order_id and contact/shipping details, so a multi-suit order
// still produces one row per physical garment set for whoever's cutting
// fabric, while order_id ties them back together as one order.
// ---------------------------------------------------------------------------
// "Generate My Suit" -- asks the generate-suit-image Supabase function
// (supabase/functions/) to draw a picture sheet of the suit: front, back,
// trousers and close-ups, in the fabric, lining, buttons and thread chosen.
//  * Right after designing (top of the Measurements step, before the order
//    form): draws the suit being designed. Kept on the cart item as
//    previewId so the finished order gets the same picture, not a redraw.
//  * On the confirmation page: shows each ordered suit's picture, or offers
//    to draw it if they skipped it earlier.
// Everything stays hidden until the function answers that it's set up, so
// nothing shows on the live site before the Supabase side is configured.
// ---------------------------------------------------------------------------
let visualSpecSaved = false;
let designPreview = null; // { spec, id, status: "pending" | "done" | "failed", url }
let suitImagesReadyPromise = null;
// Pause switch: true = "Generate My Suit" shows the loading screen but never
// asks the server to draw (no pictures, no image costs). Set back to false
// to turn picture drawing on again.
const SUIT_IMAGES_PAUSED = false;
const SUIT_IMAGE_FN_URL = typeof SUPABASE_URL !== "undefined" && SUPABASE_URL ? SUPABASE_URL + "/functions/v1/generate-suit-image" : "";

function callSuitImageFn(payload) {
  return fetch(SUIT_IMAGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, status: res.status, data })));
}

function suitImagesReady() {
  if (!SUIT_IMAGE_FN_URL) return Promise.resolve(false);
  if (!suitImagesReadyPromise) {
    suitImagesReadyPromise = callSuitImageFn({ ping: true })
      .then((r) => !!(r.ok && r.data && r.data.ready))
      .catch(() => false);
  }
  return suitImagesReadyPromise;
}

// Checks back every 5 seconds until the picture is done or failed.
async function pollSuitImage(checkPayload, isStillWanted) {
  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    if (isStillWanted && !isStillWanted()) return { status: "abandoned" };
    const check = await callSuitImageFn(checkPayload);
    const st = check.data && check.data.status;
    if (st === "done" && check.data.image_url) return { status: "done", url: check.data.image_url };
    if (st === "failed") return { status: "failed" };
  }
  return { status: "timeout" };
}

const SUIT_IMAGE_MESSAGES = {
  failed: "Sorry, something went wrong drawing your suit.",
  timeout: "This is taking longer than usual.",
  limit: "You've reached today's limit for suit pictures. Please try again tomorrow.",
  start: "Sorry, we couldn't start the picture right now.",
  network: "Sorry, we couldn't reach the picture service.",
};

// Cycled in bold under the loading video while a picture is drawn.
const SUIT_LOADING_STEPS = [
  "Cutting your fabric...",
  "Stitching the lining...",
  "Shaping the lapels...",
  "Sewing on your buttons...",
  "Pressing the trousers...",
  "Adding the finishing touches...",
];

function buildSuitImageCard(labelText) {
  const card = document.createElement("div");
  card.className = "suit-preview-card";
  if (labelText) {
    const label = document.createElement("p");
    label.className = "suit-preview-label";
    label.textContent = labelText;
    card.appendChild(label);
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-primary suit-preview-btn";
  btn.textContent = "Generate My Suit";
  const status = document.createElement("p");
  status.className = "suit-preview-status";
  status.setAttribute("aria-live", "polite");
  const media = document.createElement("div");
  media.className = "suit-preview-media";
  card.append(btn, status, media);
  const ui = {
    card,
    btn,
    working() {
      btn.hidden = true;
      btn.disabled = true;
      status.textContent = "";
      media.innerHTML = "";
      // Daniel's button-stitching clip, looped until the picture arrives.
      const video = document.createElement("video");
      video.className = "suit-preview-loading";
      [["./assets/suit-loading-thread.mp4", "video/mp4"], ["./assets/suit-loading-thread.webm", "video/webm"]].forEach(([src, type]) => {
        const source = document.createElement("source");
        source.src = src;
        source.type = type;
        video.appendChild(source);
      });
      video.poster = "./assets/suit-loading-thread.jpg";
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      const caption = document.createElement("p");
      caption.className = "suit-preview-loading-text";
      caption.innerHTML = "<strong></strong><span>This usually takes about a minute.</span>";
      const line = caption.querySelector("strong");
      let step = 0;
      line.textContent = SUIT_LOADING_STEPS[0];
      const timer = setInterval(() => {
        if (!caption.isConnected) return clearInterval(timer);
        step = (step + 1) % SUIT_LOADING_STEPS.length;
        line.textContent = SUIT_LOADING_STEPS[step];
      }, 3500);
      media.append(video, caption);
      video.play().catch(() => {});
    },
    showImage(url) {
      status.textContent = "";
      btn.hidden = true;
      media.innerHTML = "";
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      const img = document.createElement("img");
      img.className = "suit-preview-img";
      img.alt = "Your finished suit";
      img.src = url;
      link.appendChild(img);
      media.appendChild(link);
    },
    fail(msg, canRetry) {
      media.innerHTML = "";
      status.textContent = msg;
      btn.hidden = !canRetry;
      btn.disabled = false;
      btn.textContent = "Try Again";
    },
  };
  return ui;
}

function currentDesignSpec() {
  try {
    return buildVisualSpecText({
      type: currentSuitType,
      jacket: jacketDesigner.getSelections(),
      pants: currentSuitType === "jacketOnly" ? {} : pantsDesigner.getSelections(),
    });
  } catch (e) {
    return "";
  }
}

// Top of the Measurements step: "See your suit before you order".
async function updateDesignPreviewPanel() {
  const box = document.getElementById("designPreview");
  if (!box) return;
  if (!(await suitImagesReady())) {
    box.hidden = true;
    return;
  }
  const spec = currentDesignSpec();
  if (!/^Fabric: /m.test(spec)) {
    box.hidden = true;
    return;
  }
  box.innerHTML = "";
  const head = document.createElement("div");
  head.className = "suit-preview-head";
  head.innerHTML = '<div class="hiw-eyebrow">Free preview</div><h3>See your suit before you order</h3><p>We draw your suit with the fabric, buttons, lining and thread you chose. It takes about a minute, and you can keep going to your measurements while it draws.</p>';
  box.appendChild(head);
  const ui = buildSuitImageCard("");
  box.appendChild(ui.card);
  box.hidden = false;

  const watch = (preview) => {
    ui.working();
    pollSuitImage({ preview_check: preview.id }, () => designPreview === preview).then((r) => {
      if (designPreview !== preview) return;
      preview.status = r.status === "done" ? "done" : "failed";
      if (r.status === "done") preview.url = r.url;
      updateProcessBar();
      if (box.contains(ui.card)) {
        if (r.status === "done") ui.showImage(r.url);
        else ui.fail(SUIT_IMAGE_MESSAGES[r.status] || SUIT_IMAGE_MESSAGES.failed, true);
      }
    });
  };

  if (designPreview && designPreview.spec === spec) {
    if (designPreview.status === "done") ui.showImage(designPreview.url);
    else if (designPreview.status === "pending") watch(designPreview);
  }

  ui.btn.addEventListener("click", async () => {
    ui.working();
    // On a phone, bring the whole card (video and caption) into view.
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      smoothScrollWindowTo(window.scrollY + box.getBoundingClientRect().top - getNavClearance());
    }
    if (SUIT_IMAGES_PAUSED) return;
    try {
      const start = await callSuitImageFn({ preview: true, visual_spec: spec });
      if (start.data && start.data.status === "limit") return ui.fail(SUIT_IMAGE_MESSAGES.limit, false);
      if (!start.data || !start.data.preview_id) return ui.fail(SUIT_IMAGE_MESSAGES.start, true);
      designPreview = { spec, id: start.data.preview_id, status: "pending", url: null };
      watch(designPreview);
    } catch (e) {
      console.error(e);
      ui.fail(SUIT_IMAGE_MESSAGES.network, true);
    }
  });
}

// The finished preview for the suit being committed to the cart, if the
// customer drew one and hasn't changed the design since.
function currentDesignPreviewId() {
  return designPreview && designPreview.status === "done" && designPreview.spec === currentDesignSpec() ? designPreview.id : null;
}

// Confirmation page.
async function renderSuitPreview(suits) {
  const box = document.getElementById("suitPreview");
  if (!box || !suits.length) return;
  box.hidden = true;
  box.innerHTML = "";
  if (!(await suitImagesReady())) return;
  const head = document.createElement("div");
  head.className = "suit-preview-head";
  head.innerHTML = "<h3>Your finished suit</h3><p>A picture of your suit with the fabric, buttons, lining and thread you chose.</p>";
  box.appendChild(head);
  box.hidden = false;
  for (const suit of suits) {
    const ids = { order_id: suit.orderId, suit_number: suit.suitNumber };
    const ui = buildSuitImageCard(suit.label);
    box.appendChild(ui.card);
    ui.btn.addEventListener("click", async () => {
      ui.working();
      if (SUIT_IMAGES_PAUSED) return;
      try {
        const start = await callSuitImageFn(ids);
        if (start.data && start.data.status === "done" && start.data.image_url) return ui.showImage(start.data.image_url);
        if (!start.ok && start.status !== 202) return ui.fail(SUIT_IMAGE_MESSAGES.start, true);
        const r = await pollSuitImage(Object.assign({ check: true }, ids));
        if (r.status === "done") ui.showImage(r.url);
        else ui.fail(SUIT_IMAGE_MESSAGES[r.status] || SUIT_IMAGE_MESSAGES.failed, true);
      } catch (e) {
        console.error(e);
        ui.fail(SUIT_IMAGE_MESSAGES.network, true);
      }
    });
    // A picture drawn before ordering is copied onto the order, no redraw.
    try {
      if (suit.previewId) await callSuitImageFn(Object.assign({ attach: suit.previewId }, ids));
      const check = await callSuitImageFn(Object.assign({ check: true }, ids));
      if (check.data && check.data.status === "done" && check.data.image_url) ui.showImage(check.data.image_url);
    } catch (e) {
      console.error(e);
    }
  }
}

// The column name from a Supabase "unknown column" error, or null.
// PostgREST says "Could not find the 'x' column of 'orders' in the schema
// cache"; Postgres says "column orders.x does not exist" / "column \"x\" of
// relation \"orders\" does not exist".
function missingOrderColumn(error) {
  const msg = (error && error.message) || "";
  const m =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column (?:orders\.)?"?([a-z0-9_]+)"? (?:of relation "?orders"? )?does not exist/i);
  return m ? m[1] : null;
}

async function finalizeOrder(input) {
  const { customerName, customerPhone, customerEmail, address1, address2, city, state, zip, country } = input;

  const orderId =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "order_" + Date.now();

  // Upload any customer lining photos first (Supabase Storage bucket
  // "lining-photos", see add_lining_photo_bucket.sql). A failed upload never
  // blocks the order -- the order text says the photo is missing instead.
  const liningPhotoUrls = await uploadLiningPhotos(orderId);

  const rows = cartItems.map((item, i) => {
    const row = Object.assign({}, selectionsToRow(JACKET_CATALOG, item.jacket), selectionsToRow(PANTS_CATALOG, item.pants || {}));
    row.customer_name = customerName;
    row.customer_phone = customerPhone;
    row.customer_email = customerEmail;
    row.shipping_address_line1 = address1;
    row.shipping_address_line2 = address2;
    row.shipping_city = city;
    row.shipping_state = state;
    row.shipping_zip = zip;
    row.shipping_country = country;
    row.order_id = orderId;
    // null for a guest checkout -- see add_customer_profiles_migration.sql.
    // Lets a signed-in customer's past orders be looked back up later
    // without changing anything about how a guest order is saved.
    row.user_id = currentUser ? currentUser.id : null;
    row.suit_number = i + 1;
    row.suit_type = item.type === "jacketOnly" ? "jacket_only" : "full_suit";
    row.item_price_usd = itemPriceUsd(item);
    Object.assign(row, item.measurements);

    // Phone/email are deliberately kept OUT of the Client Form text -- that
    // text is meant to be the garment spec + shipping address only (it's
    // what gets shown on the confirmation page and copied to send to
    // production), not a place for contact details. They're added back in
    // only for the notification email below, in their own separate block,
    // so the shop still has a fast way to reach the customer without it
    // cluttering the spec sheet.
    const suitText = buildClientFormText(customerName, item.type, item.jacket, item.pants, item.measurements, { liningPhotoUrl: liningPhotoUrls[i], jacketMonogramText: monoText(item, "jacket"), pantsMonogramText: monoText(item, "pants") });
    row.client_form_text = cartItems.length === 1 ? suitText : "SUIT " + (i + 1) + " OF " + cartItems.length + "\n" + suitText;
    // Plain-English, personal-data-free description of the suit -- read by
    // the AI that writes the "finished suit" image prompt once the shop marks
    // this order completed (see add_order_status_and_suit_image_migration.sql).
    row.visual_spec = buildVisualSpecText(item, { liningPhotoUrl: liningPhotoUrls[i] });
    return row;
  });

  const clientFormText = buildAllSuitsClientFormText(customerName);
  const shippingBlock = buildShippingBlock(customerName, { address1, address2, city, state, zip, country });
  const fullMessage = shippingBlock + "\n\n" + clientFormText;
  const contactBlock = buildContactBlock(customerPhone, customerEmail);
  const emailMessage = contactBlock + "\n\n" + fullMessage;

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const client = getSupabase();
    visualSpecSaved = true;
    let toSave = rows;
    let { error } = await client.from("orders").insert(toSave);
    // A new designer option whose column hasn't been added to the database
    // yet (see supabase/sql/) makes the whole insert fail. Never lose a real
    // order over that: drop the unknown column and retry. Every choice is
    // still in client_form_text, so nothing the shop needs is lost.
    for (let tries = 0; error && tries < 20; tries++) {
      const col = missingOrderColumn(error);
      if (!col || !(col in toSave[0])) break;
      console.warn("orders." + col + " column missing; saving order without it. Run the SQL in supabase/sql/.");
      if (col === "visual_spec") visualSpecSaved = false;
      toSave = toSave.map((r) => {
        const copy = Object.assign({}, r);
        delete copy[col];
        return copy;
      });
      ({ error } = await client.from("orders").insert(toSave));
    }
    if (error) {
      console.error("Failed to save order:", error);
      alert("Something went wrong saving your order:\n\n" + error.message);
      return false;
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
    return false;
  } finally {
    submitBtn.disabled = false;
    updateOrderSummaryUI();
  }

  // Best-effort: email the completed Client Form(s) + shipping details. This
  // never blocks the order -- the order is already saved in Supabase
  // (including the full text, in client_form_text) even if the email fails
  // or isn't configured yet.
  if (typeof CLIENT_FORM_EMAIL_ENDPOINT !== "undefined" && CLIENT_FORM_EMAIL_ENDPOINT) {
    try {
      await fetch(CLIENT_FORM_EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject:
            "New Scott's Suits order \u2014 " +
            customerName +
            (cartItems.length > 1 ? " (" + cartItems.length + " suits)" : ""),
          // "email" is a Formspree special field -- it sets the customer's
          // address as the notification email's Reply-To, so replying to
          // the order email goes straight to them.
          email: customerEmail,
          message: emailMessage,
        }),
      });
    } catch (emailErr) {
      console.error("Failed to email the Client Form (order was still saved):", emailErr);
    }
  }

  document.getElementById("confirmationText").textContent = PAYPAL_ENABLED
    ? "Thanks! We've received your payment and recorded your suit selections, measurements, and shipping details. We'll be in touch to confirm the final details before production begins."
    : "Thanks! We've recorded your suit selections, measurements, and shipping details. We'll be in touch to confirm the final details before production begins.";
  // Deliberately NOT shown to the customer -- fullMessage (the full garment
  // spec + shipping address, in the same plain-text "Client Form" format
  // sent to production) stays internal. It's already saved on every order
  // row in Supabase (client_form_text) and included in the notification
  // email above, so nothing about production is lost by not displaying it
  // here -- it's simply not something a customer needs to see.
  // So this order shows up right away in "Past Orders" if a signed-in
  // customer checks their account immediately after ordering.
  if (currentUser) loadOrderHistory();
  if (visualSpecSaved) {
    renderSuitPreview(
      rows.map((r, i) => ({ orderId: r.order_id, suitNumber: r.suit_number, previewId: (cartItems[i] && cartItems[i].previewId) || null, label: (rows.length > 1 ? "Suit " + (i + 1) + " \u2014 " : "") + (r.suit_type === "jacket_only" ? "Jacket Only" : "Full Suit") }))
    );
  }
  orderSubmitted = true;
  updateProcessBar();
  goToStep(personalInfoSection, confirmationSection);
  cartItems = [];
  pendingCommitIndex = null;
  renderCartBar();
  clearDraft();
  return true;
}

// Once someone is sent back here from PayPal (paid or cancelled), this picks
// up right where buildPayPalCheckoutUrl() left off -- see the comment there.
// Runs once at page load, alongside restoreDraft().
function handlePayPalReturn() {
  const params = new URLSearchParams(window.location.search);
  const returned = params.get("paypal_return") === "1";
  const cancelled = params.get("paypal_cancelled") === "1";
  if (!returned && !cancelled) return;

  // Strip the query param right away so refreshing or navigating back never
  // re-triggers this.
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);

  if (cancelled) {
    alert("Payment was cancelled -- your order wasn't submitted. Everything you entered is still here, so you can try again whenever you're ready.");
    return;
  }

  // returned === true: the draft (restored just before this runs) should
  // have every field filled in from right before the PayPal redirect, so
  // this re-validates and finalizes automatically -- no extra click needed.
  const input = collectAndValidateOrderInput();
  if (!input) {
    alert("It looks like you've paid, but we couldn't find your order details in this browser to finish submitting it. Please contact us with your PayPal receipt so we can complete your order manually.");
    return;
  }
  finalizeOrder(input);
}

submitBtn.addEventListener("click", async () => {
  const input = collectAndValidateOrderInput();
  if (!input) return;

  if (!PAYPAL_ENABLED) {
    await finalizeOrder(input);
    return;
  }

  // Payment required before the order saves -- persist everything now so it
  // survives the round trip to PayPal and back (see buildPayPalCheckoutUrl).
  saveDraft();
  window.location.href = buildPayPalCheckoutUrl();
});


// ---------------------------------------------------------------------------
// Remembers where someone was in the order flow (including every selection,
// measurement, and personal/shipping field) in this browser, so refreshing
// the page -- or coming back later -- picks up right where they left off
// instead of starting over. Cleared automatically once an order is submitted.
// ---------------------------------------------------------------------------
const DRAFT_STORAGE_KEY = "scottSuitsDraftOrder";

function saveDraft() {
  try {
    const measurements = {};
    activeMeasurements().forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el && el.value !== "") measurements[m.id] = el.value;
    });
    const activeStepEl = document.querySelector(".step.active");
    const draft = {
      step: activeStepEl ? activeStepEl.id : "designer",
      suitType: currentSuitType,
      jacket: jacketDesigner.getSelections(),
      pants: pantsDesigner.getSelections(),
      jacketTexts: jacketDesigner.getTexts(),
      pantsTexts: pantsDesigner.getTexts(),
      measurements: measurements,
      customerName: customerNameInput.value,
      customerPhone: customerPhoneInput.value,
      customerEmail: customerEmailInput.value,
      shippingAddress1: shippingAddress1Input.value,
      shippingAddress2: shippingAddress2Input.value,
      shippingCity: shippingCityInput.value,
      shippingState: shippingStateInput.value,
      shippingZip: shippingZipInput.value,
      shippingCountry: shippingCountryInput.value,
      // Photos are big, so they are kept out of the draft itself (below).
      cart: cartItems.map((it) => { const c = Object.assign({}, it); delete c.liningPhoto; return c; }),
      pendingCommitIndex: pendingCommitIndex,
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    // localStorage can be unavailable (private browsing, disabled storage, etc) -- not fatal.
  }
  // The customer's own lining photo(s) live under a separate key, so a photo
  // too big for the browser's storage quota can never cost the rest of the
  // draft. Failure just means the photo has to be re-added after a reload.
  try {
    const photos = { jacket: jacketDesigner.getLiningPhoto(), cart: cartItems.map((it) => it.liningPhoto || null) };
    if (photos.jacket || photos.cart.some(Boolean)) localStorage.setItem(DRAFT_STORAGE_KEY + "_photos", JSON.stringify(photos));
    else localStorage.removeItem(DRAFT_STORAGE_KEY + "_photos");
  } catch (e) {
    // not fatal
  }
  updateProcessBar();
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY + "_photos");
  } catch (e) {
    // ignore
  }
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

function restoreDraft() {
  let draft = null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) draft = JSON.parse(raw);
  } catch (e) {
    draft = null;
  }
  if (!draft) return false;

  if (Array.isArray(draft.cart)) cartItems = draft.cart;
  let draftPhotos = null;
  try {
    const rawPhotos = localStorage.getItem(DRAFT_STORAGE_KEY + "_photos");
    if (rawPhotos) draftPhotos = JSON.parse(rawPhotos);
  } catch (e) {
    draftPhotos = null;
  }
  if (draftPhotos && Array.isArray(draftPhotos.cart)) {
    cartItems.forEach((it, i) => { if (draftPhotos.cart[i]) it.liningPhoto = draftPhotos.cart[i]; });
  }
  if (draftPhotos && draftPhotos.jacket) jacketDesigner.setLiningPhoto(draftPhotos.jacket);
  if (draft.pendingCommitIndex !== undefined) pendingCommitIndex = draft.pendingCommitIndex;
  renderCartBar();
  updateOrderSummaryUI();

  // Applies the saved suit type BEFORE touching measurements below -- it's
  // what decides which measurement fields even exist in the DOM (see
  // applySuitType() -> renderMeasurementFields()). An older draft saved
  // before this feature existed has no suitType at all, so it falls back to
  // "full", matching exactly how every draft behaved before.
  applySuitType(draft.suitType || "full");

  if (draft.jacketTexts) jacketDesigner.setTexts(draft.jacketTexts);
  if (draft.pantsTexts) pantsDesigner.setTexts(draft.pantsTexts);
  if (draft.jacket) jacketDesigner.setSelections(draft.jacket);
  if (draft.pants) pantsDesigner.setSelections(draft.pants);

  if (draft.measurements) {
    activeMeasurements().forEach((m) => {
      const el = document.getElementById("m_" + m.id);
      if (el && draft.measurements[m.id] !== undefined) el.value = draft.measurements[m.id];
    });
  }

  if (draft.customerName) customerNameInput.value = draft.customerName;
  if (draft.customerPhone) customerPhoneInput.value = formatUSPhoneNumber(draft.customerPhone);
  if (draft.customerEmail) customerEmailInput.value = draft.customerEmail;
  if (draft.shippingAddress1) shippingAddress1Input.value = draft.shippingAddress1;
  if (draft.shippingAddress2) shippingAddress2Input.value = draft.shippingAddress2;
  if (draft.shippingCity) shippingCityInput.value = draft.shippingCity;
  if (draft.shippingState) shippingStateInput.value = draft.shippingState;
  if (draft.shippingZip) shippingZipInput.value = draft.shippingZip;
  if (draft.shippingCountry) shippingCountryInput.value = draft.shippingCountry;

  // Never resume straight onto the confirmation screen -- that only happens
  // right after a real submission, which already clears the draft anyway.
  const stepId = draft.step && draft.step !== "confirmationSection" ? draft.step : "designer";
  const stepEl = document.getElementById(stepId);
  if (stepEl) {
    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    stepEl.classList.add("active");
  }
  return true;
}

// Tracks whether the customer has actually begun designing -- clicked
// "Start Designing", picked any option directly, or (on a repeat visit)
// already has a saved draft with real progress. Before that, "Start
// Designing" is the way into the flow and there's nothing yet to reset, so
// "Start Over" would be meaningless. From the first real action onward,
// "Start Over" is the only nav action that still makes sense, so the two
// buttons are mutually exclusive rather than both showing at once. Start
// Over itself flips this back to false (see startOver()) -- clearing every
// selection puts the customer back at square one, so "Start Designing"
// should reappear as the way back in, same as a brand-new visit.
let hasStartedDesigning = false;

function updateNavActionButtons() {
  const startDesigningBtn = document.getElementById("startDesigningBtn");
  const startOverBtn = document.getElementById("startOverBtn");
  const heroStartDesigningBtn = document.getElementById("heroStartDesigningBtn");
  if (startDesigningBtn) startDesigningBtn.hidden = hasStartedDesigning;
  if (startOverBtn) startOverBtn.hidden = !hasStartedDesigning;
  // The hero's own "Start Designing" button is the same mutually-exclusive
  // swap as the nav's -- scrolled up to the hero from any real step (jacket,
  // pants, measurements...) this button used to just sit there always, which
  // read as an invitation to click it again mid-design. It has no "undo"
  // counterpart of its own (Start Over already lives in the nav, reachable
  // from anywhere), so it simply disappears once design has actually started
  // rather than swapping to something else.
  if (heroStartDesigningBtn) heroStartDesigningBtn.hidden = hasStartedDesigning;
}

function markDesignStarted() {
  if (hasStartedDesigning) return;
  hasStartedDesigning = true;
  document.body.classList.add("designing");
  updateNavActionButtons();
}

// Undoes markDesignStarted() -- used by startOver() to put the nav back to
// its brand-new-visit state (Start Designing showing, Start Over hidden)
// since clearing every selection means there's nothing left to "start over"
// from anymore.
function resetDesignStarted() {
  hasStartedDesigning = false;
  document.body.classList.remove("designing");
  updateNavActionButtons();
}

if (restoreDraft()) markDesignStarted();
handlePayPalReturn();
updateNavActionButtons();
updateProcessBar();

// The hero "Start Designing" button always means "take me to the suit-type
// choice", even if a saved draft currently has a later step showing
// (otherwise scrollIntoView has nothing to do, since that section is hidden).
function startDesigning() {
  markDesignStarted();
  const swap = () => {
    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    suitTypeSection.classList.add("active");
    // scrollToStepTop (not a raw scroll to suitTypeSection's own top) so this
    // lands on the heading/cards themselves via STEP_FOCUS_SELECTOR, the same
    // as every other step transition -- see the comment on that entry above.
    scrollToStepTop(suitTypeSection);
    saveDraft();
  };
  // Same "scroll up before hiding" order as goToStep -- see its comment.
  const currentActiveEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const hideTop = currentActiveEl ? window.scrollY + currentActiveEl.getBoundingClientRect().top - getNavClearance() : 0;
  if (currentActiveEl && window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}
window.startDesigning = startDesigning;

// Tapping the logo goes back to the homepage (hero + "Start Designing"),
// from any step. Non-destructive: nothing is cleared, so Start Designing
// picks the suit type again and carries on with the same selections and
// cart; the saved draft is left as it was.
function goHome() {
  resetDesignStarted();
  ALL_STEPS.forEach((el) => el.classList.remove("active"));
  suitTypeSection.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const logoHomeLink = document.getElementById("logoHomeLink");
if (logoHomeLink) {
  logoHomeLink.addEventListener("click", goHome);
  logoHomeLink.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome(); }
  });
}

// Lets someone abandon everything and begin again from a blank jacket --
// reachable from anywhere via the nav bar, not tied to whatever step is
// currently showing. Destructive and unrecoverable (it also wipes the saved
// draft, so a page refresh can't bring any of it back), so it's gated behind
// a confirmation warning first.
// Start Over asks for confirmation with our own on-page dialog rather than
// the browser's native window.confirm(...). Some environments this page can
// be viewed in -- notably an app's own embedded preview webview -- silently
// suppress native JS dialogs (confirm() just returns false with no prompt
// ever shown), which made this button look completely broken: nothing
// happened, and "Start Over" itself never even changed back to
// "Start Designing" because the code bailed out at the (invisible) "did they
// cancel?" check. A dialog built from ordinary HTML/CSS always renders,
// everywhere this page runs.
function startOver() {
  openStartOverConfirm();
}

function executeStartOver() {
  jacketDesigner.resetSelections();
  pantsDesigner.resetSelections();
  // Back to the default suit type -- also rebuilds the measurement grid to
  // its full (jacket + pants) field set before the clearing loop below, and
  // resets the progress bar / prices / button wording along with it.
  applySuitType("full");

  // The cart itself is deliberately left alone -- Start Over clears the suit
  // currently being designed (and the shipping/personal-info fields below),
  // not suits already added to the order. pendingCommitIndex still gets
  // forgotten, same as removing a cart item does, since the designer it
  // pointed at is about to be wiped -- there's no live suit left for it to
  // update in place.
  pendingCommitIndex = null;
  renderCartBar();
  updateOrderSummaryUI();

  MEASUREMENTS.forEach((m) => {
    const el = document.getElementById("m_" + m.id);
    if (el) el.value = "";
  });

  customerNameInput.value = "";
  customerPhoneInput.value = "";
  customerEmailInput.value = "";
  shippingAddress1Input.value = "";
  shippingAddress2Input.value = "";
  shippingCityInput.value = "";
  shippingStateInput.value = "";
  shippingZipInput.value = "";
  shippingCountryInput.value = "United States";
  orderSubmitted = false;

  // Whether to treat this as a true brand-new-visit reset (nothing at all
  // left afterward -- see resetDesignStarted() and the draft handling below)
  // or as clearing just the in-progress suit while an order still exists in
  // the cart. Read once, before anything below has a chance to change it.
  const cartIsEmpty = !cartItems.length;

  if (cartIsEmpty) {
    clearDraft();
  } else {
    // Suits already in the cart survive Start Over (see the cartItems
    // comment above) -- persist that, or a page reload right after would
    // find no draft at all and lose them, same as if they'd been cleared.
    saveDraft();
  }

  const swap = () => {
    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    suitTypeSection.classList.add("active");
    // resetDesignStarted() (and the hero "Start Designing" button it
    // reveals) has to happen BEFORE scrollToStepTop, not after -- that
    // button was hidden while the customer was mid-design, and un-hiding it
    // adds real height above suitTypeSection. Doing that after scrollToStepTop
    // had already computed/started its target left the scroll aimed at the
    // OLD (shorter) layout, landing ~30px short of the heading once the
    // button's height pushed everything below it back down. Same root cause
    // as the updateProcessBar() reordering above scrollToStepTop's own
    // measurements -- see that function's comment.
    // Only reset all the way back to a brand-new-visit state when there's
    // truly nothing left -- an empty cart. With suits still saved, the
    // customer still has an order in progress, so "Start Over" stays put in
    // the nav (their way back here if they want to clear the whole thing)
    // instead of confusingly swapping back to "Start Designing".
    if (cartIsEmpty) resetDesignStarted();
    // Land on suitTypeSection itself (same as every other step transition,
    // see goToStep/scrollToStepTop) rather than the very top of the page --
    // scrolling to the raw page top left the customer staring at the hero
    // again, with the now-taller centered suitTypeSection box (see
    // style.css) sitting mostly out of view below it until they scrolled
    // further themselves.
    scrollToStepTop(suitTypeSection);
    updateProcessBar();
    // No draft left behind when the cart is empty too, on purpose: this is a
    // full reset, and suitTypeSection is already "active" by default in the
    // markup, so leaving no draft means a reload lands on the exact same
    // fresh state -- including "Start Designing" back in the nav (already
    // handled by resetDesignStarted() above) instead of a stale near-empty
    // draft flipping it back to "Start Over". With suits still in the cart
    // there's real state worth keeping, so save it instead.
    if (cartIsEmpty) clearDraft();
    else saveDraft();
  };
  // Same "scroll up before hiding" order as goToStep -- see its comment.
  const currentActiveEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const hideTop = currentActiveEl ? window.scrollY + currentActiveEl.getBoundingClientRect().top - getNavClearance() : 0;
  if (currentActiveEl && window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}
window.startOver = startOver;

// The Start Over confirmation modal itself -- same accessible-modal pattern
// as the "How It Works" overlay above (focus moves in on open and back to
// whatever opened it on close, Escape closes it, clicking the dark backdrop
// closes it too).
(function () {
  const overlay = document.getElementById("startOverConfirmOverlay");
  if (!overlay) return;
  const cancelBtn = document.getElementById("startOverCancelBtn");
  const confirmBtn = document.getElementById("startOverConfirmBtn");
  const confirmText = document.getElementById("startOverConfirmText");
  const BASE_CONFIRM_TEXT = confirmText ? confirmText.textContent : "";
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  function open() {
    lastFocused = document.activeElement;
    // Start Over only ever clears the suit currently being designed and the
    // shipping/personal-info fields (see executeStartOver()) -- any suit
    // already added to the cart is untouched. Reassure whoever has one or
    // more sitting there already, right where they're about to confirm,
    // rather than leaving them to worry it means the whole order.
    if (confirmText) {
      confirmText.textContent = cartItems.length
        ? BASE_CONFIRM_TEXT + " The " + cartItems.length + (cartItems.length === 1 ? " suit" : " suits") + " already in your cart will stay saved."
        : BASE_CONFIRM_TEXT;
    }
    overlay.classList.add("open");
    cancelBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    overlay.classList.remove("open");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  window.openStartOverConfirm = open;

  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  confirmBtn.addEventListener("click", () => {
    close();
    executeStartOver();
  });
})();

// The order the order flow actually happens in (used below to gate the
// progress bar, and to know which designer -- if any -- lives on a page).
const STEP_ORDER = ["designer", "pantsSection", "previewSection", "measurementsSection", "personalInfoSection"];
const STEP_LABELS = {
  designer: "Design your jacket",
  pantsSection: "Customize your pants",
  previewSection: "Preview your suit",
  measurementsSection: "Enter your measurements",
  personalInfoSection: "Personal Info and Shipping",
};

function isStepComplete(stepId) {
  if (stepId === "designer") return jacketDesigner.isComplete();
  if (stepId === "pantsSection") return pantsDesigner.isComplete();
  if (stepId === "measurementsSection") return collectMeasurements().missing.length === 0;
  return true;
}

// Same required-field check used at final submit, without the alert -- just
// "is everything filled in yet" for the progress bar.
function isShippingInfoComplete() {
  return Boolean(
    customerNameInput.value.trim() &&
    shippingAddress1Input.value.trim() &&
    shippingCityInput.value.trim() &&
    shippingStateInput.value.trim() &&
    shippingZipInput.value.trim()
  );
}

// Dims each progress-bar step once it's actually done, so the eye is drawn to
// whichever step still needs attention. The bar has 5 visual steps (Jacket,
// Pants, Measure, Ship, Order) but only 4 underlying sections -- Ship and
// Order both live on personalInfoSection -- so completion is tracked per
// data-milestone rather than per data-step.
function updateProcessBar() {
  // The progress bar doesn't mean anything yet while suitTypeSection is
  // showing -- no suit type has been picked, so there's no "Jacket" step to
  // even be on. Hide the whole bar for that one screen; it reappears the
  // moment a type is chosen and jacketSection becomes active.
  const processBarEl = document.querySelector(".process");
  if (processBarEl) processBarEl.hidden = Boolean(suitTypeSection && suitTypeSection.classList.contains("active"));

  const activeStepEl = document.querySelector(".step.active");
  const activeStepId = activeStepEl ? activeStepEl.id : "";
  document.querySelectorAll(".process-step[data-milestone]").forEach((el) => {
    el.classList.toggle("current", !!activeStepId && el.getAttribute("data-step") === activeStepId);
    const milestone = el.getAttribute("data-milestone");
    let done = false;
    if (milestone === "jacket") done = jacketDesigner.isComplete();
    else if (milestone === "pants") done = pantsDesigner.isComplete();
    else if (milestone === "measure") done = collectMeasurements().missing.length === 0;
    else if (milestone === "ship") done = isShippingInfoComplete();
    else if (milestone === "order") done = orderSubmitted;
    else if (milestone === "preview") done = !!(designPreview && designPreview.status === "done");
    el.classList.toggle("completed", done);
  });
}

// A "Jacket Only" order has no Pants step at all -- per how this was
// scoped, "02 Pants" doesn't just gray out, it's removed from the bar
// entirely and everything after it renumbers to fill the gap (Jacket 01,
// Measure 02, Ship 03, Order 04). Re-run whenever the suit type changes
// (see applySuitType()) so the bar always matches whichever suit is
// currently loaded into the designer.
function updateProcessBarForSuitType() {
  const pantsStepEl = document.querySelector('.process-step[data-milestone="pants"]');
  if (!pantsStepEl) return;
  const pantsDividerEl =
    pantsStepEl.nextElementSibling && pantsStepEl.nextElementSibling.classList.contains("process-divider")
      ? pantsStepEl.nextElementSibling
      : null;

  // Toggled via inline style rather than the `hidden` attribute --
  // .process-step sets its own `display:flex`, an author rule with the same
  // specificity as the browser's built-in `[hidden]{display:none}` rule, so
  // `hidden` alone isn't guaranteed to actually hide it. An inline style
  // always wins regardless of specificity.
  const hidePants = currentSuitType === "jacketOnly";
  pantsStepEl.style.display = hidePants ? "none" : "";
  if (pantsDividerEl) pantsDividerEl.style.display = hidePants ? "none" : "";

  const visibleSteps = Array.from(document.querySelectorAll(".process-step")).filter((el) => el.style.display !== "none");
  visibleSteps.forEach((el, i) => {
    const numEl = el.querySelector(".step-num");
    if (numEl) numEl.textContent = String(i + 1).padStart(2, "0");
  });
}

// Keeps the price shown while actually designing in sync with the suit type
// chosen on suitTypeSection -- the jacket designer's own summary total and
// its intro blurb both mention a price as plain text (there's no per-option
// pricing), so both need to be swapped by hand rather than computed from
// selections.
// Live price of the suit being designed: the flat price plus the $80 custom
// lining photo when that is chosen. Called from every designer summary
// refresh and whenever the suit type changes.
function refreshDesignerPrice() {
  let extra = 0;
  try { extra = typeof jacketDesigner !== "undefined" ? liningUploadSurcharge(jacketDesigner.getSelections()) : 0; } catch (e) { extra = 0; }
  const price = suitPriceForType(currentSuitType) + extra;
  ["totalPrice", "pantsTotalPrice"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "$" + price;
  });
}
function updatePriceTextForSuitType() {
  const price = suitPriceForType(currentSuitType);
  refreshDesignerPrice();
  const introPriceEl = document.getElementById("jacketPriceText");
  if (introPriceEl) introPriceEl.textContent = "$" + price;
}

// The jacket page's Continue button, and the measurements page's Back
// button, both read differently depending on whether there's a Pants step
// to go to or not.
function updateContinueBackLabelsForSuitType() {
  const continueBtnEl = document.getElementById("continueBtn");
  if (continueBtnEl) continueBtnEl.textContent = currentSuitType === "jacketOnly" ? (previewStepOn ? "Continue to Preview" : "Continue to Measurements") : "Continue to Pants";
  const continuePantsBtnEl = document.getElementById("continuePantsBtn");
  if (continuePantsBtnEl) continuePantsBtnEl.textContent = previewStepOn ? "Continue to Preview" : "Continue to Measurements";
  const backToDesignerBtnEl = document.getElementById("backToDesignerBtn");
  if (backToDesignerBtnEl) backToDesignerBtnEl.innerHTML = "&larr; Back";
}

// The single entry point for switching which suit type is loaded into the
// designer -- called when a customer picks a card on suitTypeSection, and
// again when restoring a saved draft. Re-renders the measurement fields (so
// a "Jacket Only" order only shows/requires jacket measurements), and keeps
// the progress bar, prices shown while designing, and the Continue/Back
// button wording all in sync with the choice.
function applySuitType(type) {
  currentSuitType = type === "jacketOnly" ? "jacketOnly" : "full";
  renderMeasurementFields();
  updateSamePreviousMeasurementsBanner();
  updateProcessBarForSuitType();
  updatePriceTextForSuitType();
  updateContinueBackLabelsForSuitType();
  updateSizeEstimatePantsFieldsForSuitType();
}

// Wires up the two suit-type cards -- picking one commits the choice and
// moves straight into the jacket designer, same "scroll up before hiding"
// swap every other step transition uses (see goToStep()).
function chooseSuitType(type) {
  applySuitType(type);
  jacketDesigner.resetToFirstTab();
  goToStep(suitTypeSection, jacketSection);
}
const chooseFullSuitBtn = document.getElementById("chooseFullSuitBtn");
const chooseJacketOnlyBtn = document.getElementById("chooseJacketOnlyBtn");
if (chooseFullSuitBtn) chooseFullSuitBtn.addEventListener("click", () => chooseSuitType("full"));
if (chooseJacketOnlyBtn) chooseJacketOnlyBtn.addEventListener("click", () => chooseSuitType("jacketOnly"));

// Lets someone click any step in the progress bar at the top to jump straight
// there and edit it -- not just move forward with Continue/Back buttons.
// Jumping backward to an already-visited page is always allowed. Jumping
// ahead of the page you're currently on is never allowed here, even if the
// earlier steps happen to already be "complete" -- Continue/Back are the
// only customer-facing way to move forward. (The QA nav bar bypasses this
// entirely, on purpose, for internal testing.)
function goToStepById(stepId) {
  const stepEl = document.getElementById(stepId);
  if (!stepEl) return;

  const targetIndex = STEP_ORDER.indexOf(stepId);
  const currentActiveStepEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const currentIndex = currentActiveStepEl ? STEP_ORDER.indexOf(currentActiveStepEl.id) : -1;
  if (targetIndex > -1 && currentIndex > -1 && targetIndex > currentIndex) {
    alert('Please use "Continue" to move forward one step at a time.');
    return;
  }

  const swap = () => {
    // No resetToFirstTab here -- since forward jumps are blocked above,
    // this only ever runs going backward (or to the step you're already
    // on), and Back should resume on the last tab you had open, same as
    // the Back buttons.
    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    stepEl.classList.add("active");
    scrollToStepTop(stepEl);
    saveDraft();
  };
  // Same "scroll up before hiding" order as goToStep -- see its comment.
  const currentActiveEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const hideTop = currentActiveEl ? window.scrollY + currentActiveEl.getBoundingClientRect().top - getNavClearance() : 0;
  if (currentActiveEl && window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}
document.querySelectorAll(".process-step[data-step]").forEach((el) => {
  el.addEventListener("click", () => goToStepById(el.getAttribute("data-step")));
});

// Turns on the Preview page (and its step in the bar) once the suit-picture
// service is set up.
(function initPreviewStep() {
  const el = document.querySelector('.process-step[data-milestone="preview"]');
  if (!el) return;
  suitImagesReady().then((ready) => {
    if (!ready) return;
    previewStepOn = true;
    updateContinueBackLabelsForSuitType();
    el.style.display = "";
    if (el.nextElementSibling && el.nextElementSibling.classList.contains("process-divider")) el.nextElementSibling.style.display = "";
    updateProcessBarForSuitType();
    updateProcessBar();
  });
})();

// ============================================================
// BROWSER HISTORY -- the browser's Back (and Forward) button steps through the
// customer's own path: previous question in the designer, previous page
// (measurements, order form...), and the homepage -- instead of leaving the
// site. Every change of page or designer question adds one history entry;
// Back re-shows the earlier state without clearing anything they picked.
// ============================================================
(function () {
  let lastKey = null;
  let applying = false;

  function currentKey() {
    const active = ALL_STEPS.find((el) => el.classList.contains("active"));
    const stepId = active ? active.id : "suitTypeSection";
    let tab = "";
    if (stepId === "designer") tab = jacketDesigner.getActiveTab();
    else if (stepId === "pantsSection") tab = pantsDesigner.getActiveTab();
    return (document.body.classList.contains("designing") ? "d" : "h") + "|" + stepId + "|" + tab;
  }

  function sync() {
    if (applying) return;
    const k = currentKey();
    if (k === lastKey) return;
    lastKey = k;
    try { window.history.pushState({ scottsuitsNav: k }, "", window.location.href); } catch (e) { /* history unavailable here */ }
  }
  let timer = null;
  function schedule() {
    if (applying) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 80);
  }
  window.__navChanged = schedule;

  function apply(k) {
    const parts = String(k).split("|");
    const mode = parts[0], stepId = parts[1], tab = parts[2];
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;
    applying = true;
    try {
      closeLightbox();
      document.querySelectorAll(".how-it-works-overlay.open").forEach((o) => o.classList.remove("open"));
      if (mode === "h") resetDesignStarted(); else markDesignStarted();
      ALL_STEPS.forEach((el) => el.classList.remove("active"));
      stepEl.classList.add("active");
      if (stepId === "designer" && tab) jacketDesigner.setActiveTab(tab);
      if (stepId === "pantsSection" && tab) pantsDesigner.setActiveTab(tab);
      if (stepEl === measurementsSection && typeof renderMeasureChrome === "function") renderMeasureChrome();
      if (stepEl === personalInfoSection && typeof renderPersonalChrome === "function") renderPersonalChrome();
      if (typeof updateProcessBar === "function") updateProcessBar();
      if (stepId === "suitTypeSection" && mode === "h") window.scrollTo(0, 0); else scrollToStepTop(stepEl);
      lastKey = k;
    } finally {
      setTimeout(() => { applying = false; }, 200);
    }
  }

  window.addEventListener("popstate", (e) => {
    const k = e.state && e.state.scottsuitsNav;
    if (k) apply(k);
  });

  // Watch for page changes made by any of the existing buttons.
  if (window.MutationObserver) {
    const mo = new MutationObserver(schedule);
    ALL_STEPS.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ["class"] }));
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // Reload: the browser keeps this tab's history entry, so put the customer
  // back on the exact page and question they were on (never the
  // confirmation screen -- the draft is gone by then anyway).
  let reloadKey = null;
  try { reloadKey = window.history.state && window.history.state.scottsuitsNav; } catch (e) { /* ignore */ }
  if (reloadKey && String(reloadKey).split("|")[1] !== "confirmationSection") apply(reloadKey);

  // The page the customer landed on counts as the first entry.
  lastKey = currentKey();
  try { window.history.replaceState({ scottsuitsNav: lastKey }, "", window.location.href); } catch (e) { /* ignore */ }
})();

// ============================================================
// TEMP QA NAV BAR -- internal testing only, not for customers.
// Same swap/scroll as goToStepById above, but with the "finish the
// earlier steps first" gate removed, so every page can be reached
// directly to spot-check it. Remove this whole block (and the
// matching HTML block in index.html and CSS block in style.css,
// both marked "TEMP QA NAV BAR") when QA testing is done.
// ============================================================
function qaJumpToStep(stepId) {
  const stepEl = document.getElementById(stepId);
  if (!stepEl) return;

  const swap = () => {
    if (stepId === "designer") jacketDesigner.resetToFirstTab();
    if (stepId === "pantsSection") pantsDesigner.resetToFirstTab();

    ALL_STEPS.forEach((el) => el.classList.remove("active"));
    stepEl.classList.add("active");
    scrollToStepTop(stepEl);
    saveDraft();
    if (stepEl === previewSection) setTimeout(updateDesignPreviewPanel, 0);
  };
  // Same "scroll up before hiding" order as goToStep -- see its comment.
  const currentActiveEl = ALL_STEPS.find((el) => el.classList.contains("active"));
  const hideTop = currentActiveEl ? window.scrollY + currentActiveEl.getBoundingClientRect().top - getNavClearance() : 0;
  if (currentActiveEl && window.scrollY > hideTop + 2) {
    smoothScrollWindowTo(hideTop, swap);
  } else {
    swap();
  }
}
document.querySelectorAll(".qa-nav-btn[data-qa-step]").forEach((el) => {
  el.addEventListener("click", () => qaJumpToStep(el.getAttribute("data-qa-step")));
});

// Lets testing place a real order without actually paying -- same
// validation and same finalizeOrder() save (Supabase row + notification
// email) as a normal submit, just without the PayPal redirect in between.
// Order Form fields (name, phone, shipping, etc.) still need to be filled
// in first, exactly as collectAndValidateOrderInput() already requires.
//
// The button's label/title reflect whether there's actually a payment step
// to skip (PAYPAL_ENABLED, set above from PAYPAL_BUSINESS_EMAIL in
// config.js). index.html's own markup ships with the "no payment
// configured" wording as its default, since that's today's real state --
// this only overwrites it to the "Skip Payment" wording once PayPal is
// truly turned on, so QA is never told this button bypasses something that
// isn't there.
const qaSkipPaymentBtn = document.getElementById("qaSkipPaymentBtn");
if (qaSkipPaymentBtn) {
  if (PAYPAL_ENABLED) {
    qaSkipPaymentBtn.textContent = "Skip Payment & Submit";
    qaSkipPaymentBtn.title = "Validate + save the order like normal, but skip PayPal";
  } else {
    qaSkipPaymentBtn.textContent = "Submit (No Payment Configured)";
    qaSkipPaymentBtn.title = "No payment is configured (PAYPAL_BUSINESS_EMAIL is blank in config.js) -- this does exactly what the real Submit Order button already does.";
  }
  qaSkipPaymentBtn.addEventListener("click", async () => {
    const input = collectAndValidateOrderInput();
    if (!input) return;
    await finalizeOrder(input);
  });
}

// Hide/show toggle -- lets QA tuck the bar away while eyeballing a page (it
// covers the bottom of the screen), then bring it back with the small pill
// left in its place. Remembered in localStorage purely as a convenience so
// it stays out of the way across reloads during a testing session; never
// depended on for anything real.
(function () {
  const bar = document.getElementById("qaNavBar");
  const hideBtn = document.getElementById("qaNavHideBtn");
  const showBtn = document.getElementById("qaNavShowBtn");
  if (!bar || !hideBtn || !showBtn) return;

  // Customers never see it: the bar and its pill stay hidden (markup ships
  // with the bar hidden) unless this browser has opted in by opening the
  // site once with ?qa=1. ?qa=0 opts back out.
  let qaEnabled = false;
  try {
    const qaParam = new URLSearchParams(location.search).get("qa");
    if (qaParam === "1") localStorage.setItem("qaNavEnabled", "1");
    if (qaParam === "0") localStorage.removeItem("qaNavEnabled");
    qaEnabled = localStorage.getItem("qaNavEnabled") === "1";
  } catch (e) {
    // Ignore -- stays off.
  }
  if (!qaEnabled) {
    bar.hidden = true;
    showBtn.hidden = true;
    return;
  }

  function setHidden(hidden) {
    bar.hidden = hidden;
    showBtn.hidden = !hidden;
    try {
      localStorage.setItem("qaNavHidden", hidden ? "1" : "0");
    } catch (e) {
      // Ignore -- purely a convenience, fine if it can't persist.
    }
  }

  hideBtn.addEventListener("click", () => setHidden(true));
  showBtn.addEventListener("click", () => setHidden(false));

  // Hidden by default (declutter) -- a stored "0" means it was deliberately
  // shown, so keep it shown.
  let startHidden = true;
  try {
    startHidden = localStorage.getItem("qaNavHidden") !== "0";
  } catch (e) {
    // Ignore -- default to hidden.
  }
  setHidden(startHidden);
})();

// "Raw Fabric Codes" toggle -- flips qaShowRawFabricNames (declared up near
// createDesigner) and immediately re-renders both designers so any fabric
// name already on screen (swatch cards, "Same as Jacket" label, tab
// subtitle, summary panel) updates right away. Remembered in localStorage
// like the hide/show toggle above, for the same reason -- convenience across
// reloads during a testing session, nothing depends on it.
(function () {
  const toggle = document.getElementById("qaRawFabricNamesToggle");
  if (!toggle) return;

  function setRaw(raw) {
    qaShowRawFabricNames = raw;
    toggle.checked = raw;
    jacketDesigner.refreshDisplay();
    pantsDesigner.refreshDisplay();
    try {
      localStorage.setItem("qaShowRawFabricNames", raw ? "1" : "0");
    } catch (e) {
      // Ignore -- purely a convenience, fine if it can't persist.
    }
  }

  toggle.addEventListener("change", () => setRaw(toggle.checked));

  let startRaw = false;
  try {
    startRaw = localStorage.getItem("qaShowRawFabricNames") === "1";
  } catch (e) {
    // Ignore -- default to showing customer-facing names.
  }
  if (startRaw) setRaw(true);
})();
// ==================== END TEMP QA NAV BAR ====================

// A reload that lands back on the Preview page (see restoreDraft) fills it
// in too.
if (previewSection.classList.contains("active")) setTimeout(updateDesignPreviewPanel, 0);
