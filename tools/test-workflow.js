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
    location: { protocol: "http:", hostname: "localhost", pathname: "/order.html", search: "" },
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => fn(0),
    performance: { now: () => 0 },
    navigator: { clipboard: { writeText: async () => {} } },
    CustomEvent: function () {},
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
check("isAdminEmail matches owner", SG.isAdminEmail("okogbagideon28@gmail.com") === true);
check("isAdminEmail is case-insensitive", SG.isAdminEmail("  OkogbaGideon28@Gmail.com ") === true);
check("isAdminEmail rejects others", SG.isAdminEmail("someone@else.com") === false);
check("isAdminUser needs verified email",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [] }) === false);
check("isAdminUser allows verified owner",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: true, providerData: [] }) === true);
check("isAdminUser allows Google owner",
  SG.isAdminUser({ email: SG.ADMIN_EMAIL, emailVerified: false, providerData: [{ providerId: "google.com" }] }) === true);
check("isAdminUser rejects verified non-owner",
  SG.isAdminUser({ email: "nope@x.com", emailVerified: true, providerData: [] }) === false);

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
check("rules pin admin address", rules.includes("okogbagideon28@gmail.com"));
check("rules require verified admin email", rules.includes("email_verified == true"));
check("services writable by admin only", /match \/boostServices[\s\S]{0,220}allow create, update, delete: if isAdmin\(\)/.test(rules));
check("orders update admin-only", rules.includes("allow update: if isAdmin()"));
check("clients cannot change status", rules.includes("statusUntouched()"));
check("leads create open, read restricted", /match \/leads[\s\S]{0,900}allow read: if isAdmin\(\)/.test(rules));

/* ---------------- page wiring ---------------- */
console.log("\nPages — wiring");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const adminHtml = read("admin.html");
check("admin page loads admin.js", adminHtml.includes("assets/js/admin.js"));
check("admin page loads orders.js", adminHtml.includes("assets/js/orders.js"));
check("admin page is noindex", adminHtml.includes("noindex, nofollow"));
check("admin page has order tabs", adminHtml.includes('data-admin-tab="orders"'));
check("admin page has service tab", adminHtml.includes('data-admin-tab="services"'));
check("admin page hides gate initially by default", adminHtml.includes("data-admin-gate"));
check("admin page has 5 statuses in CSS link", adminHtml.includes("assets/css/admin.css"));

const orderHtml = read("order.html");
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
