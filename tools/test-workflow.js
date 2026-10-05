/* Headless sanity checks for the order workflow + renderers.
   Stubs just enough DOM for the browser scripts to load in Node. */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = require("path").resolve(__dirname, "..");

function makeSandbox() {
  const listeners = {};
  const el = () => ({
    addEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, closest: () => null,
    style: {}, innerHTML: "", textContent: "", value: "", dataset: {}, scrollIntoView() {}
  });
  const document = {
    readyState: "complete",
    title: "test",
    body: el(),
    documentElement: el(),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: el,
    addEventListener() {},
    dispatchEvent() {}
  };
  const sandbox = {
    window: {},
    document,
    location: { protocol: "http:", hostname: "localhost", pathname: "/order.html", search: "", href: "http://localhost:8080/order.html" },
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => fn(0),
    performance: { now: () => 0 },
    navigator: { clipboard: { writeText: async () => {} } },
    CustomEvent: function () {},
    URL,
    URLSearchParams,
    Promise,
    Math,
    Date,
    JSON,
    Number,
    String,
    Object,
    Array,
    parseInt,
    isNaN
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  return sandbox;
}

function load(rel) {
  const sb = makeSandbox();
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), sb, { filename: rel });
  return sb;
}

let pass = 0;
let fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (detail ? "  → " + detail : "")); }
};

/* ---------------- firebase.js ---------------- */
console.log("\nfirebase.js — workflow + helpers");
const fb = load("assets/js/firebase.js");
const SG = fb.window.SG;

check("admin email constant", SG.ADMIN_EMAIL === "okogbagideon28@gmail.com", SG.ADMIN_EMAIL);
check("admin allowlist starts with the owner", SG.ADMIN_EMAILS[0] === "okogbagideon28@gmail.com");
check("isAdminEmail matches primary owner", SG.isAdminEmail("okogbagideon28@gmail.com") === true);
check("isAdminEmail matches second owner", SG.isAdminEmail("okogbaeladopere@gmail.com") === true);
check("isAdminEmail is case-insensitive", SG.isAdminEmail("  OkogbaGideon28@Gmail.com ") === true);
check("isAdminEmail rejects others", SG.isAdminEmail("someone@else.com") === false);
check("isAdminEmail rejects blanks", SG.isAdminEmail("") === false && SG.isAdminEmail(null) === false);
check("both allowlisted admins are exempt from email verification",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [] }) === true &&
  SG.isAdminUser({ email: "okogbaeladopere@gmail.com", emailVerified: false, providerData: [] }) === true);
check("isAdminUser allows verified owner",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: true, providerData: [] }) === true);
check("isAdminUser allows Google owner",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [{ providerId: "google.com" }] }) === true);
check("isAdminUser rejects verified non-owner",
  SG.isAdminUser({ email: "nope@x.com", emailVerified: true, providerData: [] }) === false);

/* The four gate states the admin console renders. */
console.log("\nfirebase.js — admin gate states");
check("signed out reports signed-out", SG.adminStatus(null) === "signed-out");
check("client account reports not-admin",
  SG.adminStatus({ email: "client@x.com", emailVerified: true, providerData: [] }) === "not-admin");
check("unverified allowlisted owner reports owner for immediate console access",
  SG.adminStatus({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [] }) === "owner");
check("second unverified allowlisted owner reports owner",
  SG.adminStatus({ email: "okogbaeladopere@gmail.com", emailVerified: false, providerData: [] }) === "owner");
check("verified owner reports owner",
  SG.adminStatus({ email: SG.ADMIN_EMAIL, emailVerified: true, providerData: [] }) === "owner");
check("Google owner reports owner without a verification link",
  SG.adminStatus({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [{ providerId: "google.com" }] }) === "owner");
check("signedInWithGoogle only for google providers",
  SG.signedInWithGoogle({ providerData: [{ providerId: "password" }] }) === false &&
  SG.signedInWithGoogle({ providerData: [{ providerId: "google.com" }] }) === true);
check("regular password account needs verified email",
  SG.isVerifiedUser({ email: "client@x.com", emailVerified: false, providerData: [{ providerId: "password" }] }) === false);
check("verified client can access protected pages",
  SG.isVerifiedUser({ email: "client@x.com", emailVerified: true, providerData: [{ providerId: "password" }] }) === true);
check("Google client is treated as verified",
  SG.isVerifiedUser({ email: "client@x.com", emailVerified: false, providerData: [{ providerId: "google.com" }] }) === true);
check("admin verification exemption does not make email verified",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [] }) &&
  !SG.isVerifiedUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [] }));
check("refreshUser exists so a stale emailVerified can be cleared",
  typeof SG.refreshUser === "function");

check("four priority levels", SG.PRIORITIES.length === 4);
check("urgent ranks first", SG.priorityRank("urgent") === 1);
check("low ranks last", SG.priorityRank("low") === 4);
check("unknown priority falls back to normal", SG.priorityRank("banana") === 3);
check("priorityLabel works", SG.priorityLabel("high") === "High");

check("new order starts pending", SG.ORDER_STATUSES[0] === "pending");

/* the four transitions the brief asked for */
check("pending → approved allowed", SG.canMoveTo("pending", "approved") === true);
check("pending → rejected allowed", SG.canMoveTo("pending", "rejected") === true);
check("pending → ongoing blocked", SG.canMoveTo("pending", "ongoing") === false);
check("pending → completed blocked", SG.canMoveTo("pending", "completed") === false);
check("approved → ongoing allowed", SG.canMoveTo("approved", "ongoing") === true);
check("approved → completed blocked", SG.canMoveTo("approved", "completed") === false);
check("ongoing → completed allowed", SG.canMoveTo("ongoing", "completed") === true);
check("completed → ongoing allowed (reopen)", SG.canMoveTo("completed", "ongoing") === true);
check("rejected → approved allowed (reopen)", SG.canMoveTo("rejected", "approved") === true);

const ref = SG.newOrderRef();
check("order reference format", /^SGE-[A-Z0-9]{7}$/.test(ref), ref);
const refs = new Set(Array.from({ length: 200 }, () => SG.newOrderRef()));
check("order references are unique across 200 calls", refs.size > 190, "unique=" + refs.size);

/* ---------------- naira rate model ---------------- */
console.log("\nfirebase.js — naira rates per 1,000");
check("currency is NGN", SG.CURRENCY === "NGN");
check("money formats naira", SG.money(2500) === "\u20A62,500", SG.money(2500));
check("money handles decimals", SG.money(4500.5) === "\u20A64,500.5", SG.money(4500.5));
check("money handles junk", SG.money(undefined) === "\u20A60", SG.money(undefined));
check("rateOf reads ratePer1000", SG.rateOf({ ratePer1000: 900 }) === 900);
check("rateOf falls back to legacy priceFrom", SG.rateOf({ priceFrom: 25 }) === 25);
check("rateOf prefers the naira rate", SG.rateOf({ ratePer1000: 900, priceFrom: 25 }) === 900);
check("orderTotal = qty/1000 x rate", SG.orderTotal(900, 5000) === 4500, String(SG.orderTotal(900, 5000)));
check("orderTotal rounds to 2dp", SG.orderTotal(350, 1234) === 431.9, String(SG.orderTotal(350, 1234)));
check("orderTotal ignores junk", SG.orderTotal(null, null) === 0);
check("serviceMin defaults to 1", SG.serviceMin({}) === 1);
check("serviceMax defaults to 100m", SG.serviceMax({}) === 100000000);

check("default catalogue ships 22 services", SG.DEFAULT_SERVICES.length === 22, String(SG.DEFAULT_SERVICES.length));
check("every service has a valid priority",
  SG.DEFAULT_SERVICES.every((s) => ["urgent", "high", "normal", "low"].includes(s.priority)));
check("every service has a naira rate per 1,000",
  SG.DEFAULT_SERVICES.every((s) => Number(s.ratePer1000) > 0));
check("every service has min < max",
  SG.DEFAULT_SERVICES.every((s) => Number(s.min) > 0 && Number(s.max) > Number(s.min)));
check("no service still uses the old USD priceFrom field",
  SG.DEFAULT_SERVICES.every((s) => !("priceFrom" in s)));
check("catalogue covers the main platforms",
  ["Instagram", "TikTok", "YouTube", "Facebook", "X", "Telegram", "WhatsApp"]
    .every((p) => SG.DEFAULT_SERVICES.some((s) => String(s.platform).indexOf(p) === 0)));

/* ---------------- orders.js ---------------- */
console.log("\norders.js — status rendering");
const oj = load("assets/js/orders.js");
const O = oj.window.SGOrders;

check("SGOrders exported", !!O);
check("pending renders amber badge", O.statusBadge("pending").includes("status-pending"));
check("approved renders blue badge", O.statusBadge("approved").includes("status-approved"));
check("ongoing renders purple badge", O.statusBadge("ongoing").includes("status-ongoing"));
check("completed renders green badge", O.statusBadge("completed").includes("status-completed"));
check("rejected renders red badge", O.statusBadge("rejected").includes("status-rejected"));
check("unknown status falls back to pending", O.statusBadge("weird").includes("status-pending"));

const trackPending = O.statusTrack("pending");
check("pending track shows Submitted as current", /class="st-step current">Submitted/.test(trackPending));
const trackOngoing = O.statusTrack("ongoing");
check("ongoing track marks earlier steps done",
  (trackOngoing.match(/st-step done/g) || []).length === 2);
const trackDone = O.statusTrack("completed");
check("completed track marks 3 steps done",
  (trackDone.match(/st-step done/g) || []).length === 3);
check("rejected track is separate", O.statusTrack("rejected").includes("status-track rejected"));

check("priority pill urgent", O.priorityPill("urgent").includes("priority-urgent"));
check("priority pill default", O.priorityPill(undefined).includes("priority-normal"));

const summary = O.summarise([
  { status: "pending", amount: 50 },
  { status: "approved", amount: 120 },
  { status: "ongoing", amount: 30 },
  { status: "completed", amount: 200 },
  { status: "rejected", amount: 999 }
]);
check("summary counts total", summary.total === 5);
check("summary counts pending", summary.pending === 1);
check("summary counts completed", summary.completed === 1);
check("summary value excludes pending/rejected", summary.value === 350, "value=" + summary.value);

const card = O.orderCard({
  id: "abc", ref: "SGE-TEST1", serviceName: "TikTok Views", platform: "TikTok",
  packageLabel: "Standard package", quantity: "2 × 10,000 views", unit: "10,000 views",
  amount: 30, status: "pending", priority: "urgent", targetLink: "https://tiktok.com/@x",
  contactName: "Ada", email: "ada@x.com", createdAt: new Date("2026-09-30T10:00:00Z")
});
check("order card shows reference", card.includes("SGE-TEST1"));
check("order card shows status", card.includes("status-pending"));
check("order card shows priority", card.includes("priority-urgent"));
check("order card escapes html", !card.includes("<script"));

const cardHtml = O.orderCard({ id: "x", serviceName: "<img src=x onerror=alert(1)>", status: "pending" });
check("escaping prevents injection", !cardHtml.includes("<img src=x"), cardHtml.slice(0, 80));

/* ---------------- rules text sanity ---------------- */
console.log("\nfirestore.rules — admin enforcement");
const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
check("rules pin both admin addresses", rules.includes("okogbagideon28@gmail.com") && rules.includes("okogbaeladopere@gmail.com"));
check("rules no longer include the replaced admin address", !rules.includes("beniwealth70@gmail.com"));
check("client rules require verified email or Google sign-in",
  /function verifiedUser\(\)[\s\S]{0,180}email_verified == true/.test(rules));
check("rules accept a Google sign-in as proof of a client email",
  /sign_in_provider == 'google\.com'/.test(rules));
check("admin rules bypass client email verification for the allowlist",
  /function isAdmin\(\)[\s\S]{0,100}isAdminEmail\(request\.auth\.token\.email\)/.test(rules));
check("rules gate admin access on both configured addresses",
  /function isAdminEmail\(email\)[\s\S]{0,130}'okogbagideon28@gmail\.com'[\s\S]{0,80}'okogbaeladopere@gmail\.com'/.test(rules));
check("services writable by admin only", /match \/boostServices[\s\S]{0,220}allow create, update, delete: if isAdmin\(\)/.test(rules));
check("orders update admin-only", rules.includes("allow update: if isAdmin()"));
check("clients cannot change status", rules.includes("statusUntouched()"));
check("order creation requires matching server catalogue", rules.includes("validCatalogOrder(request.resource.data)"));
check("wallet order debits are atomic", rules.includes("validWalletDebit(orderId, request.resource.data)"));
check("wallet ledger is immutable", rules.includes("allow update, delete: if false;"));
check("top-up requests cannot credit themselves", rules.includes("match /walletTopups/{topupId}"));
check("client order edits cannot change financial fields", rules.includes("hasOnly(['targetLink', 'notes', 'contactPhone', 'brand'])"));
check("leads create open, read restricted", /match \/leads[\s\S]{0,900}allow read: if isAdmin\(\)/.test(rules));

/* ---------------- page wiring ---------------- */
console.log("\nPages — wiring");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const adminHtml = read("admin.html");
check("admin page loads admin.js", adminHtml.includes("assets/js/admin.js"));
check("admin page loads orders.js", adminHtml.includes("assets/js/orders.js"));
check("admin page is noindex", adminHtml.includes("noindex, nofollow"));
check("admin page has order tabs", adminHtml.includes('data-admin-tab="orders"'));
check("admin page can review wallet top-ups", adminHtml.includes("data-admin-wallet-topups"));
check("admin page has service tab", adminHtml.includes('data-admin-tab="services"'));
check("admin page hides gate initially by default", adminHtml.includes("data-admin-gate"));
check("admin page has 5 statuses in CSS link", adminHtml.includes("assets/css/admin.css"));

/* Admin access: the owner must be able to get in. */
check("admin page renders its own gate instead of bouncing to login",
  adminHtml.includes('data-auth-gate="inline"'));
check("page guard understands the inline gate",
  read("assets/js/page-guard.js").includes('authGate === "inline"'));
check("gate names the signed-in account", adminHtml.includes("data-admin-signed-in"));
check("admin gate does not block allowlisted users on email verification", !adminHtml.includes("data-admin-unverified"));
check("admin console has a non-blocking verification reminder", adminHtml.includes("data-admin-verify"));
check("admin gate offers Google sign-in", adminHtml.includes("data-admin-google"));
check("admin gate offers email + password sign-in", /data-auth-form="login"/.test(adminHtml));
check("admin gate lists both allowed addresses", adminHtml.includes("okogbagideon28@gmail.com and okogbaeladopere@gmail.com"));
check("admin.js no longer routes owners to a verification block",
  !read("assets/js/admin.js").includes("owner-unverified"));

/* The owner must be able to reach a Google button while signed out. */
check("login page offers Google sign-in", read("login.html").includes("data-google-signin"));
const signupHtml = read("signup.html");
check("signup page offers Google sign-in", signupHtml.includes("data-google-signin"));
check("signup explains email/password verification", signupHtml.includes("sends a verification link"));
check("Google signup explains that Google confirms the email", signupHtml.includes("Google confirms your email"));
check("auth.js wires the Google buttons", read("assets/js/auth.js").includes("data-google-signin"));
check("email/password signup sends a verification email", read("assets/js/firebase.js").includes("await SG.sendVerificationEmail(cred.user)"));
check("registration success explains the email-verification step",
  read("assets/js/auth.js").includes("We sent a verification link to "));
check("ordinary signups are routed to the verification page before dashboard access",
  read("assets/js/auth.js").includes("verificationUrl(requestedPage)"));
const verifyHtml = read("verify-email.html");
check("verification page is a public non-indexed route", verifyHtml.includes('name="robots" content="noindex, nofollow"') && !verifyHtml.includes("data-auth-required"));
check("verification page can resend email and re-check status",
  verifyHtml.includes("data-verification-resend") && verifyHtml.includes("data-verification-recheck"));
check("verification page loads authentication behavior", verifyHtml.includes("assets/js/auth.js"));
check("page guard blocks unverified users", read("assets/js/page-guard.js").includes("verify-email.html?next="));
check("page guard redirects unverified allowlisted admins to admin", read("assets/js/page-guard.js").includes("return adminPage()"));

const orderHtml = read("order.html");
check("private pages have login route gate", orderHtml.includes("data-auth-required") && orderHtml.includes("assets/js/page-guard.js"));
check("home stays public", !read("index.html").includes("data-auth-required"));
check("order page loads orders.js", orderHtml.includes("assets/js/orders.js"));
check("order page loads the boost panel", orderHtml.includes("assets/js/panel.js"));
check("order page mounts the boost panel", orderHtml.includes("data-boost-panel"));
check("order page explains pending default", orderHtml.includes("pending"));
check("order page no longer ships the old brief form", !orderHtml.includes("data-order-service-grid"));

const dashHtml = read("dashboard.html");
check("dashboard loads orders.js", dashHtml.includes("assets/js/orders.js"));
check("dashboard loads the boost panel", dashHtml.includes("assets/js/panel.js"));
check("dashboard has tabs", dashHtml.includes('data-dash-tab="boost"'));
check("dashboard mounts the boost panel", dashHtml.includes("data-boost-panel"));
check("dashboard has orders panel", dashHtml.includes("data-dashboard-orders"));
check("dashboard has order stats", dashHtml.includes('data-order-stat="pending"'));
check("dashboard includes wallet and top-up form", dashHtml.includes("data-wallet-balance") && dashHtml.includes("data-wallet-topup"));
check("dashboard shows admin link for admin", dashHtml.includes('data-auth-when="admin"'));

const indexHtml = read("index.html");
check("nav shows admin link only for admin", indexHtml.includes('data-auth-when="admin"'));
check("footer links boost services", indexHtml.includes("order.html"));
check("home has a live rate teaser", indexHtml.includes("data-rate-teaser"));
check("home no longer advertises retainers", !indexHtml.includes("$349"));

const pricingHtml = read("pricing.html");
check("rate card page mounts the table", pricingHtml.includes("data-rate-table"));
check("rate card page loads rates.js", pricingHtml.includes("assets/js/rates.js"));
check("rate card says the site is free", /free/i.test(pricingHtml));
check("rate card has no retainer tiers", !pricingHtml.includes("price-card"));

const adminHtml2 = read("admin.html");
check("admin can set the rate per 1,000", adminHtml2.includes('name="ratePer1000"'));
check("admin can set min/max quantity", adminHtml2.includes('name="min"') && adminHtml2.includes('name="max"'));

/* ---------------- panel + rate card scripts ---------------- */
console.log("\npanel.js / rates.js — loading");
const panel = load("assets/js/panel.js");
check("panel exports SGBoostPanel", typeof panel.window.SGBoostPanel === "function");
const rates = load("assets/js/rates.js");
check("rates.js loads without a DOM", !!rates.window);

/* ---------------- admin gate routing (behavioural) ---------------- */
/* Loads the real firebase.js (for SG.adminStatus) and the real admin.js into a
   sandbox with a stub DOM, then checks which gate state each account lands on.
   Only network I/O (onUser / refreshUser / Firestore reads) is faked. */
console.log("\nadmin.js — gate routing");

function makeGateSandbox() {
  const els = new Map();
  const mk = (name) => {
    const node = {
      name,
      _classes: new Set(),
      classList: {
        add: (c) => node._classes.add(c),
        remove: (c) => node._classes.delete(c),
        toggle: (c, on) => (on ? node._classes.add(c) : node._classes.delete(c)),
        contains: (c) => node._classes.has(c)
      },
      events: {},
      addEventListener(type, handler) {
        (node.events[type] || (node.events[type] = [])).push(handler);
      },
      setAttribute() {}, appendChild() {}, focus() {},
      style: {}, innerHTML: "", textContent: "", value: "", dataset: {}, disabled: false,
      querySelector: () => null, querySelectorAll: () => [],
      closest: () => null, scrollIntoView() {}
    };
    return node;
  };
  const el = (name) => {
    if (!els.has(name)) els.set(name, mk(name));
    return els.get(name);
  };
  const document = {
    readyState: "complete",
    title: "Admin Console | Sonicgids Empire",
    body: el("body"),
    documentElement: el("html"),
    querySelector: (sel) => el(sel),
    querySelectorAll: () => [],
    getElementById: (id) => el("#" + id),
    createElement: () => mk("created"),
    addEventListener() {},
    dispatchEvent() {}
  };
  const sandbox = {
    window: {}, document, els, el,
    location: { protocol: "https:", hostname: "sonicgidsempire.web.app", pathname: "/admin.html", search: "", href: "https://sonicgidsempire.web.app/admin.html" },
    console, setTimeout: () => 0, clearTimeout: () => {},
    requestAnimationFrame: (fn) => fn(0),
    performance: { now: () => 0 },
    navigator: { clipboard: { writeText: async () => {} } },
    CustomEvent: function () {}, URLSearchParams, Promise, Math, Date, JSON,
    Number, String, Object, Array, parseInt, isNaN
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  /* firebase.js first: admin.js reads SG.adminStatus / SG.isAdminEmail from it.
     SG.ready is forced true so SGOnReady callbacks fire during load. */
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/firebase.js"), "utf8"), sandbox,
    { filename: "assets/js/firebase.js" });
  sandbox.window.SG.ready = true;
  return sandbox;
}

async function gateCase(user, refreshed) {
  const sb = makeGateSandbox();
  const sg = sb.window.SG;
  sg.currentUser = user;
  sg.onUser = (cb) => cb(user);
  sg.refreshUser = async () => {
    sg.currentUser = refreshed === undefined ? user : refreshed;
    return sg.currentUser;
  };
  sg.adminListOrders = async () => [];
  sg.adminListLeads = async () => [];
  sg.adminListSubscribers = async () => [];
  sg.adminListWalletTopups = async () => [];
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/admin.js"), "utf8"), sb,
    { filename: "assets/js/admin.js" });
  await new Promise((resolve) => realSetTimeout(resolve, 5));
  return sb;
}

const realSetTimeout = setTimeout;

async function pageGuardCase({ user = null, pathname = "/dashboard.html", search = "", authGate = "", refreshed } = {}) {
  const rootClasses = new Set(["sg-auth-pending"]);
  const bodyAttrs = new Set(["data-auth-required"]);
  const body = {
    dataset: { authGate },
    hasAttribute: (name) => bodyAttrs.has(name),
    removeAttribute: (name) => bodyAttrs.delete(name),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  };
  const doc = {
    body,
    documentElement: { classList: { remove: (name) => rootClasses.delete(name) } },
    dispatchEvent() {}
  };
  const location = {
    protocol: "https:", hostname: "sonicgidsempire.web.app", pathname,
    search, hash: "", href: "https://sonicgidsempire.web.app" + pathname + search,
    redirect: null,
    replace(url) { this.redirect = url; }
  };
  const sg = {
    auth: {},
    isVerifiedUser: (account) => !!account && (account.emailVerified === true ||
      (account.providerData || []).some((provider) => provider.providerId === "google.com")),
    isAdminUser: (account) => !!account && ["okogbagideon28@gmail.com", "okogbaeladopere@gmail.com"]
      .includes(String(account.email || "").toLowerCase()),
    onUser(callback) { callback(user); },
    refreshUser: async () => refreshed === undefined ? user : refreshed
  };
  const sandbox = {
    window: {}, document: doc, location, console, URLSearchParams, Promise,
    CustomEvent: function () {}
  };
  sandbox.window = sandbox;
  sandbox.window.SG = sg;
  sandbox.window.SGReady = Promise.resolve(sg);
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/page-guard.js"), "utf8"), sandbox,
    { filename: "assets/js/page-guard.js" });
  await new Promise((resolve) => realSetTimeout(resolve, 5));
  return { location, rootClasses, bodyAttrs };
}
const owner = { email: "okogbagideon28@gmail.com", emailVerified: true, providerData: [{ providerId: "password" }] };
const ownerUnverified = { email: "okogbagideon28@gmail.com", emailVerified: false, providerData: [{ providerId: "password" }] };
const ownerGoogle = { email: "OkogbaGideon28@Gmail.com", emailVerified: false, providerData: [{ providerId: "google.com" }] };
const client = { email: "client@brand.com", emailVerified: true, providerData: [{ providerId: "password" }] };

const hidden = (sb, sel) => sb.el(sel)._classes.has("hide");

(async () => {
  let guarded = await pageGuardCase({ user: { email: "client@brand.com", emailVerified: false, providerData: [{ providerId: "password" }] } });
  check("unverified client is redirected away from the dashboard",
    !!guarded.location.redirect && guarded.location.redirect.startsWith("verify-email.html?next="));
  check("unverified dashboard redirect preserves its destination",
    guarded.location.redirect && guarded.location.redirect.includes("%2Fdashboard.html"));

  guarded = await pageGuardCase({ user: client });
  check("verified client can pass the private-page guard",
    !guarded.location.redirect && !guarded.rootClasses.has("sg-auth-pending"));

  guarded = await pageGuardCase({ user: ownerUnverified });
  check("unverified allowlisted admin is routed to the admin console, not dashboard",
    guarded.location.redirect === "admin.html");

  guarded = await pageGuardCase({ user: null, search: "?preview=1" });
  check("signed-out layout preview is still available",
    !guarded.location.redirect && !guarded.rootClasses.has("sg-auth-pending"));

  guarded = await pageGuardCase({
    user: { email: "client@brand.com", emailVerified: false, providerData: [{ providerId: "password" }] },
    search: "?preview=1"
  });
  check("preview query cannot bypass verification for a signed-in client",
    !!guarded.location.redirect && guarded.location.redirect.startsWith("verify-email.html?next="));

  guarded = await pageGuardCase({ user: ownerUnverified, pathname: "/admin.html", authGate: "inline" });
  check("inline admin gate remains reachable without email verification",
    !guarded.location.redirect && !guarded.rootClasses.has("sg-auth-pending"));

  async function registrationTest(email, sendVerification) {
    const env = load("assets/js/firebase.js");
    const sg = env.window.SG;
    const user = { email, displayName: "", emailVerified: false, providerData: [{ providerId: "password" }] };
    const sends = [];
    env.location.href = "https://sonicgidsempire.web.app/signup.html";
    sg.ready = true;
    sg.auth = { currentUser: null };
    sg._mods.auth = {
      createUserWithEmailAndPassword: async () => ({ user }),
      updateProfile: async (target, profile) => Object.assign(target, profile),
      sendEmailVerification: async (target, settings) => {
        sends.push({ target, settings });
        if (sendVerification) await sendVerification(target, settings);
      }
    };
    let result = null;
    let error = null;
    try {
      result = await sg.signUp(email, "password123", "Test Owner");
    } catch (err) {
      error = err;
    }
    return { sg, user, sends, result, error };
  }

  const registeredOwner = await registrationTest("okogbagideon28@gmail.com");
  check("email/password signup returns the created Firebase user", registeredOwner.result === registeredOwner.user);
  check("signup sends a verification email to the new account",
    registeredOwner.sends.length === 1 && registeredOwner.sends[0].target === registeredOwner.user);
  check("owner verification link returns to the admin panel",
    registeredOwner.sends[0].settings.url === "https://sonicgidsempire.web.app/admin.html");
  check("new profile name is saved before signup completes",
    registeredOwner.user.displayName === "Test Owner");

  const registeredSecondAdmin = await registrationTest("okogbaeladopere@gmail.com");
  check("second admin signup still receives a verification email",
    registeredSecondAdmin.sends.length === 1 && registeredSecondAdmin.sends[0].target === registeredSecondAdmin.user);
  check("second admin verification link returns to the admin panel",
    registeredSecondAdmin.sends[0].settings.url === "https://sonicgidsempire.web.app/admin.html");

  const registeredClient = await registrationTest("client@example.com");
  check("client signup verification returns to the dashboard",
    registeredClient.sends[0].settings.url === "https://sonicgidsempire.web.app/dashboard.html");

  const failedVerification = await registrationTest("okogbagideon28@gmail.com", async () => {
    const err = new Error("Email delivery is temporarily unavailable.");
    err.code = "auth/too-many-requests";
    throw err;
  });
  check("verification-send failure clearly preserves the created account state",
    !!(failedVerification.error && failedVerification.error.accountCreated &&
      failedVerification.error.cause.code === "auth/too-many-requests"));

  const unlistedContinueUrl = await registrationTest("okogbagideon28@gmail.com", async (user, settings) => {
    if (settings) {
      const err = new Error("Continue URL is not authorized.");
      err.code = "auth/unauthorized-continue-uri";
      throw err;
    }
  });
  check("unlisted continue URLs fall back to Firebase's default verification email",
    unlistedContinueUrl.sends.length === 2 && unlistedContinueUrl.sends[1].settings === undefined);

  let sb = await gateCase(null);
  check("signed-out visitor sees the sign-in block",
    !hidden(sb, "[data-admin-signin]") && hidden(sb, "[data-admin-panel]"));
  check("signed-out visitor does not see the 'no access' error",
    hidden(sb, "[data-admin-noaccess]"));

  sb = await gateCase(client);
  check("a client account is told it has no admin access",
    !hidden(sb, "[data-admin-noaccess]") && hidden(sb, "[data-admin-panel]"));
  check("the gate names the account that is signed in",
    sb.el("[data-admin-signed-in]").textContent === "client@brand.com",
    sb.el("[data-admin-signed-in]").textContent);

  sb = await gateCase(ownerUnverified);
  check("unverified primary owner opens the console without a verification gate",
    !hidden(sb, "[data-admin-panel]") && hidden(sb, "[data-admin-gate]"));
  check("unverified primary owner gets a non-blocking verification reminder",
    !hidden(sb, "[data-admin-verify]"));

  const secondOwnerUnverified = {
    email: "okogbaeladopere@gmail.com", emailVerified: false,
    providerData: [{ providerId: "password" }]
  };
  sb = await gateCase(secondOwnerUnverified);
  check("unverified second owner also opens the console",
    !hidden(sb, "[data-admin-panel]") && hidden(sb, "[data-admin-gate]"));

  sb = await gateCase(owner);
  check("a verified owner opens the console", !hidden(sb, "[data-admin-panel]"));
  check("the console header shows the owner address",
    sb.el("[data-admin-email]").textContent === "okogbagideon28@gmail.com");

  sb = await gateCase(ownerGoogle);
  check("a Google owner opens the console with no verification email",
    !hidden(sb, "[data-admin-panel]"));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();

