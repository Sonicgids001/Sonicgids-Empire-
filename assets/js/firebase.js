/* ==========================================================================
   SONICGIOS EMPIRE — Firebase layer
   Loads the Firebase v10 modular SDK on demand, initialises App/Analytics/
   Auth/Firestore and exposes a small, defensive API on window.SG.

   Pages that need it should wait for:   await window.SGReady;
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCp5-jcqe28HdWdBO7xV-njrmFuTVQH9Kc",
  authDomain: "sonicgidsempire.firebaseapp.com",
  projectId: "sonicgidsempire",
  storageBucket: "sonicgidsempire.firebasestorage.app",
  messagingSenderId: "686885522694",
  appId: "1:686885522694:web:2bfa09ef3189d9eedd6287",
  measurementId: "G-9H6GJWWMM3"
};

const SDK_VERSION = "10.12.5";
const GSTATIC = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

/* Everything the rest of the site touches lives on this object. */
const SG = {
  config: firebaseConfig,
  ready: false,
  error: null,
  app: null,
  auth: null,
  db: null,
  analytics: null,
  currentUser: null,
  _mods: {}
};

window.SG = SG;

const listeners = [];
window.SGOnReady = (fn) => {
  if (SG.ready) fn(SG);
  else listeners.push(fn);
};

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", ""];
const canUseAnalytics = () =>
  location.protocol === "https:" || LOCAL_HOSTS.includes(location.hostname);

/* --------------------------------------------------------------------------
   Boot — deferred until the page is idle so the SDK never blocks first paint
   -------------------------------------------------------------------------- */
let resolveReady;
const readyPromise = new Promise((resolve) => { resolveReady = resolve; });
window.SGReady = readyPromise;

let booted = false;
function start() {
  if (booted) return;
  booted = true;
  boot();
}

async function boot() {
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${GSTATIC}/firebase-app.js`),
      import(`${GSTATIC}/firebase-auth.js`),
      import(`${GSTATIC}/firebase-firestore.js`)
    ]);

    SG._mods.app = appMod;
    SG._mods.auth = authMod;
    SG._mods.fs = fsMod;

    SG.app = appMod.initializeApp(firebaseConfig);
    SG.auth = authMod.getAuth(SG.app);
    SG.db = fsMod.getFirestore(SG.app);

    try {
      await authMod.setPersistence(SG.auth, authMod.browserLocalPersistence);
    } catch (e) {
      /* persistence is best-effort */
    }

    /* Analytics is optional and never allowed to break the page. */
    if (canUseAnalytics()) {
      SG._analyticsPromise = import(`${GSTATIC}/firebase-analytics.js`)
        .then((analyticsMod) => {
          SG._mods.analyticsEvent = analyticsMod.logEvent;
          SG.analytics = analyticsMod.getAnalytics(SG.app);
          SG.logEvent("page_view", {
            page_title: document.title,
            page_path: location.pathname
          });
          return SG.analytics;
        })
        .catch(() => null);
    }

    SG.ready = true;
    resolveReady(SG);
    listeners.forEach((fn) => {
      try { fn(SG); } catch (e) { console.warn(e); }
    });
    document.dispatchEvent(new CustomEvent("sg:ready", { detail: SG }));
  } catch (err) {
    SG.error = err;
    resolveReady(SG);
    console.warn("[Sonicgids] Firebase failed to initialise:", err && err.message);
    document.dispatchEvent(new CustomEvent("sg:error", { detail: err }));
  }
  return SG;
}

/* Kick off after first paint: on window load, or 1.5s, whichever comes first. */
if (document.readyState === "complete") {
  setTimeout(start, 250);
} else {
  window.addEventListener("load", () => setTimeout(start, 250));
}
setTimeout(start, 1500);

/* --------------------------------------------------------------------------
   Analytics helper
   -------------------------------------------------------------------------- */
SG.logEvent = function (name, params) {
  const fire = () => {
    if (!SG.analytics || !SG._mods.analyticsEvent) return;
    try {
      SG._mods.analyticsEvent(SG.analytics, name, params || {});
    } catch (e) {
      /* no-op */
    }
  };
  if (SG.analytics) fire();
  else if (SG._analyticsPromise) SG._analyticsPromise.then(fire).catch(() => {});
};

/* --------------------------------------------------------------------------
   Auth helpers
   -------------------------------------------------------------------------- */
const friendlyAuthError = (err) => {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Please enter your password.",
    "auth/user-disabled": "This account has been disabled. Contact support.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again shortly.",
    "auth/network-request-failed": "Network problem — check your connection.",
    "auth/operation-not-allowed":
      "Email/password sign-in isn't enabled yet in the Firebase console.",
    "auth/unauthorized-domain":
      "This domain isn't authorised in Firebase Authentication settings.",
    "auth/popup-closed-by-user": "Sign-in window closed before finishing.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
    "auth/cancelled-popup-request": "Sign-in was cancelled. Try again.",
    "auth/account-exists-with-different-credential":
      "That email is already registered with a different sign-in method.",
    "auth/requires-recent-login": "Please sign out and sign in again to continue."
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
};

SG.friendlyError = friendlyAuthError;

SG.signUp = async function (email, password, name) {
  await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const cred = await SG._mods.auth.createUserWithEmailAndPassword(SG.auth, email, password);
  if (name) {
    try {
      await SG._mods.auth.updateProfile(cred.user, { displayName: name });
    } catch (e) { /* non-fatal */ }
  }
  SG.logEvent("sign_up", { method: "password" });
  return cred.user;
};

SG.signIn = async function (email, password) {
  await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const cred = await SG._mods.auth.signInWithEmailAndPassword(SG.auth, email, password);
  SG.logEvent("login", { method: "password" });
  return cred.user;
};

SG.signOut = async function () {
  await readyPromise;
  if (!SG.auth) return;
  await SG._mods.auth.signOut(SG.auth);
};

SG.resetPassword = async function (email) {
  await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  await SG._mods.auth.sendPasswordResetEmail(SG.auth, email);
};

SG.onUser = function (cb) {
  readyPromise.then(() => {
    if (!SG.auth) return cb(null);
    SG._mods.auth.onAuthStateChanged(SG.auth, (user) => {
      SG.currentUser = user;
      cb(user);
    });
  });
};

/* --------------------------------------------------------------------------
   Firestore helpers
   -------------------------------------------------------------------------- */
SG.saveLead = async function (lead) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { addDoc, collection, serverTimestamp } = SG._mods.fs;
  const payload = {
    ...lead,
    uid: SG.currentUser ? SG.currentUser.uid : null,
    source: lead.source || "website",
    page: location.pathname,
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(SG.db, "leads"), payload);
  SG.logEvent("generate_lead", { source: payload.source });
  return ref.id;
};

SG.saveSubscriber = async function (email) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { addDoc, collection, serverTimestamp } = SG._mods.fs;
  const ref = await addDoc(collection(SG.db, "subscribers"), {
    email,
    page: location.pathname,
    createdAt: serverTimestamp()
  });
  SG.logEvent("newsletter_signup", {});
  return ref.id;
};

SG.myLeads = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser) return [];
  const { collection, query, where, getDocs } = SG._mods.fs;
  /* Queried by uid only (single-field index) and sorted here, so no composite
     index has to be provisioned in the Firebase console. */
  const snap = await getDocs(
    query(collection(SG.db, "leads"), where("uid", "==", SG.currentUser.uid))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 20);
};

/* ==========================================================================
   ADMIN IDENTITY
   Only the account owner address can reach the admin panel. Firestore rules
   enforce the same address server-side, so this is a convenience check —
   never the security boundary.
   ========================================================================== */
SG.ADMIN_EMAIL = "okogbagideon28@gmail.com";

SG.isAdminEmail = function (email) {
  return String(email || "").trim().toLowerCase() === SG.ADMIN_EMAIL;
};

SG.isAdminUser = function (user) {
  if (!user || !SG.isAdminEmail(user.email)) return false;
  const viaGoogle = (user.providerData || []).some((p) => p.providerId === "google.com");
  return user.emailVerified === true || viaGoogle;
};

SG.signInWithGoogle = async function () {
  await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const { GoogleAuthProvider, signInWithPopup } = SG._mods.auth;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(SG.auth, provider);
  SG.logEvent("login", { method: "google" });
  return cred.user;
};

SG.sendVerificationEmail = async function () {
  await readyPromise;
  if (!SG.auth || !SG.currentUser) throw new Error("Sign in first, then request the email.");
  await SG._mods.auth.sendEmailVerification(SG.currentUser);
};

/* ==========================================================================
   BOOST SERVICES CATALOGUE
   Admin-managed list of boosting services with a processing priority that
   drives the order queue (urgent → high → normal → low).
   ========================================================================== */
SG.PRIORITIES = [
  { key: "urgent", label: "Urgent", rank: 1, hint: "Jump the queue — process first" },
  { key: "high", label: "High", rank: 2, hint: "Prioritised over normal work" },
  { key: "normal", label: "Normal", rank: 3, hint: "Standard turnaround" },
  { key: "low", label: "Low", rank: 4, hint: "Fill-in work, process last" }
];

SG.priorityRank = function (key) {
  const p = SG.PRIORITIES.find((x) => x.key === key);
  return p ? p.rank : 3;
};

SG.priorityLabel = function (key) {
  const p = SG.PRIORITIES.find((x) => x.key === key);
  return p ? p.label : "Normal";
};

SG.DEFAULT_SERVICES = [
  { name: "Instagram Followers Boost", platform: "Instagram", category: "Followers", unit: "1,000 followers", priceFrom: 25, turnaround: "24–72 hours", priority: "high", description: "Targeted follower growth for a profile or brand page, delivered gradually to stay within platform limits." },
  { name: "Instagram Likes & Views", platform: "Instagram", category: "Engagement", unit: "1,000 likes + 5,000 views", priceFrom: 12, turnaround: "6–24 hours", priority: "high", description: "Instant engagement on reels and posts to lift the algorithm's early signals." },
  { name: "Instagram Story Views & Polls", platform: "Instagram", category: "Engagement", unit: "5,000 story views", priceFrom: 18, turnaround: "12–48 hours", priority: "normal", description: "Story views plus poll and sticker engagement to strengthen your daily reach." },
  { name: "TikTok Views & Likes", platform: "TikTok", category: "Engagement", unit: "10,000 views", priceFrom: 15, turnaround: "6–24 hours", priority: "urgent", description: "Fast view delivery on new uploads to trigger the For You distribution test." },
  { name: "TikTok Followers Boost", platform: "TikTok", category: "Followers", unit: "1,000 followers", priceFrom: 30, turnaround: "24–72 hours", priority: "high", description: "Gradual follower growth with geo and interest targeting available." },
  { name: "YouTube Views & Watch Time", platform: "YouTube", category: "Views", unit: "5,000 views", priceFrom: 45, turnaround: "48–96 hours", priority: "high", description: "Retention-friendly view delivery to support ranking and monetisation thresholds." },
  { name: "YouTube Subscribers & Likes", platform: "YouTube", category: "Followers", unit: "500 subscribers", priceFrom: 60, turnaround: "3–7 days", priority: "normal", description: "Subscriber and like growth spread across days for a natural-looking curve." },
  { name: "Facebook Page Likes & Follows", platform: "Facebook", category: "Followers", unit: "1,000 page likes", priceFrom: 28, turnaround: "48–96 hours", priority: "normal", description: "Page likes and follows with optional country filtering for local businesses." },
  { name: "X (Twitter) Engagement", platform: "X", category: "Engagement", unit: "2,000 impressions + reposts", priceFrom: 22, turnaround: "12–48 hours", priority: "normal", description: "Impressions, reposts and likes to widen the reach of announcements and threads." },
  { name: "WhatsApp Channel & Group Growth", platform: "WhatsApp", category: "Community", unit: "1,000 members", priceFrom: 40, turnaround: "3–7 days", priority: "high", description: "Real members added to your channel or group, filtered by region where possible." },
  { name: "Telegram Channel Growth", platform: "Telegram", category: "Community", unit: "1,000 members", priceFrom: 35, turnaround: "2–5 days", priority: "normal", description: "Channel members with geo targeting, useful for crypto, betting and media brands." },
  { name: "Spotify / Audiomack Plays", platform: "Music", category: "Streams", unit: "10,000 plays", priceFrom: 50, turnaround: "3–7 days", priority: "low", description: "Playlist-safe streaming support for new releases, spread over several days." },
  { name: "Comment & DM Engagement", platform: "Multi-platform", category: "Community", unit: "100 quality comments", priceFrom: 65, turnaround: "48–96 hours", priority: "normal", description: "Human-written comments on your posts plus DM conversation sparking to lift reach." },
  { name: "Live Stream Boost", platform: "Multi-platform", category: "Views", unit: "2,000 live viewers", priceFrom: 55, turnaround: "Scheduled", priority: "urgent", description: "Concurrent viewers during a live session — booked in advance with your schedule." }
];

SG.listBoostServices = async function (activeOnly) {
  await readyPromise;
  const fallback = () =>
    SG.DEFAULT_SERVICES.map((s, i) => ({ id: "default-" + i, ...s, active: true }));
  if (!SG.db) return fallback();
  try {
    const { collection, getDocs } = SG._mods.fs;
    const snap = await getDocs(collection(SG.db, "boostServices"));
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!items.length) items = fallback();
    if (activeOnly) items = items.filter((s) => s.active !== false);
    return items.sort(
      (a, b) => SG.priorityRank(a.priority) - SG.priorityRank(b.priority) ||
        String(a.name).localeCompare(String(b.name))
    );
  } catch (err) {
    console.warn("[Sonicgids] Could not load boost services:", err && err.message);
    return fallback();
  }
};

SG.adminSaveService = async function (id, data) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { addDoc, doc, setDoc, updateDoc, serverTimestamp } = SG._mods.fs;
  const payload = {
    name: data.name || "Untitled service",
    platform: data.platform || "",
    category: data.category || "",
    unit: data.unit || "",
    priceFrom: Number(data.priceFrom) || 0,
    turnaround: data.turnaround || "",
    priority: data.priority || "normal",
    priorityRank: SG.priorityRank(data.priority || "normal"),
    description: data.description || "",
    active: data.active !== false,
    updatedAt: serverTimestamp()
  };
  if (id && !String(id).startsWith("default-")) {
    await updateDoc(doc(SG.db, "boostServices", id), payload);
    return id;
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(SG.db, "boostServices"), payload);
  return ref.id;
};

SG.adminDeleteService = async function (id) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { doc, deleteDoc } = SG._mods.fs;
  await deleteDoc(doc(SG.db, "boostServices", id));
};

SG.adminSeedServices = async function () {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { collection, getDocs, writeBatch, doc } = SG._mods.fs;
  const existing = await getDocs(collection(SG.db, "boostServices"));
  if (existing.size) return existing.size;
  const batch = writeBatch(SG.db);
  SG.DEFAULT_SERVICES.forEach((s) => {
    const ref = doc(collection(SG.db, "boostServices"));
    batch.set(ref, {
      ...s,
      priorityRank: SG.priorityRank(s.priority),
      active: true,
      createdAt: new Date().toISOString()
    });
  });
  await batch.commit();
  return SG.DEFAULT_SERVICES.length;
};

/* ==========================================================================
   ORDERS — pending → approved / rejected → ongoing → completed
   ========================================================================== */
SG.ORDER_STATUSES = ["pending", "approved", "rejected", "ongoing", "completed"];

/* Allowed transitions. Mirrors the rules in firestore.rules. */
SG.NEXT_STATUSES = {
  pending: ["approved", "rejected"],
  approved: ["ongoing", "rejected"],
  ongoing: ["completed"],
  completed: ["ongoing"],
  rejected: ["approved"]
};

SG.canMoveTo = function (from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  return (SG.NEXT_STATUSES[from] || []).includes(to);
};

SG.newOrderRef = function () {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return "SGE-" + stamp + rand;
};

SG.createOrder = async function (order) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now. Please try again shortly.");
  if (!SG.currentUser) throw new Error("Please sign in before placing an order.");
  const { addDoc, collection, serverTimestamp } = SG._mods.fs;
  const priority = order.priority || "normal";
  const payload = {
    ref: SG.newOrderRef(),
    uid: SG.currentUser.uid,
    email: SG.currentUser.email || order.email || "",
    contactName: order.contactName || SG.currentUser.displayName || "",
    contactPhone: order.contactPhone || "",
    brand: order.brand || "",
    serviceId: order.serviceId || "",
    serviceName: order.serviceName || "Boost service",
    platform: order.platform || "",
    category: order.category || "",
    unit: order.unit || "",
    packageLabel: order.packageLabel || "Standard package",
    quantity: order.quantity || "",
    amount: Number(order.amount) || 0,
    priority: priority,
    priorityRank: SG.priorityRank(priority),
    targetLink: order.targetLink || "",
    notes: order.notes || "",
    status: "pending",
    adminNote: "",
    history: [
      { status: "pending", at: new Date().toISOString(), by: "client", note: "Order submitted" }
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(SG.db, "orders"), payload);
  SG.logEvent("place_order", { service: payload.serviceName, value: payload.amount });
  return { id: ref.id, ref: payload.ref };
};

SG.myOrders = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser) return [];
  const { collection, query, where, getDocs } = SG._mods.fs;
  const snap = await getDocs(
    query(collection(SG.db, "orders"), where("uid", "==", SG.currentUser.uid))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

SG.adminListOrders = async function () {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { collection, getDocs } = SG._mods.fs;
  const snap = await getDocs(collection(SG.db, "orders"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (a.priorityRank || 3) - (b.priorityRank || 3) ||
        toMillis(a.createdAt) - toMillis(b.createdAt)
    );
};

/* Approve / reject / start / complete, with an audit trail and optional note. */
SG.adminUpdateOrder = async function (id, changes, note) {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  if (!SG.currentUser) throw new Error("You must be signed in.");
  const { doc, updateDoc, serverTimestamp, arrayUnion } = SG._mods.fs;
  const patch = { ...changes, updatedAt: serverTimestamp(), updatedBy: SG.currentUser.email };
  if (changes.status) {
    const entry = {
      status: changes.status,
      at: new Date().toISOString(),
      by: SG.currentUser.email,
      note: note || ""
    };
    patch.history = arrayUnion(entry);
    if (changes.status === "approved") patch.approvedAt = serverTimestamp();
    if (changes.status === "ongoing") patch.startedAt = serverTimestamp();
    if (changes.status === "completed") patch.completedAt = serverTimestamp();
    if (changes.status === "rejected") patch.rejectedAt = serverTimestamp();
  }
  await updateDoc(doc(SG.db, "orders", id), patch);
  SG.logEvent("admin_order_update", { status: changes.status || "note" });
  return true;
};

/* ==========================================================================
   ADMIN LISTS — contact leads and newsletter subscribers
   ========================================================================== */
SG.adminListLeads = async function () {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { collection, getDocs } = SG._mods.fs;
  const snap = await getDocs(collection(SG.db, "leads"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

SG.adminListSubscribers = async function () {
  await readyPromise;
  if (!SG.db) throw new Error("The database is unavailable right now.");
  const { collection, getDocs } = SG._mods.fs;
  const snap = await getDocs(collection(SG.db, "subscribers"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

SG.friendlyDbError = function (err) {
  const code = (err && err.code) || "";
  if (code === "permission-denied")
    return "The database blocked this request — check your Firestore security rules.";
  if (code === "unavailable")
    return "Could not reach the database. Check that Cloud Firestore is enabled for this project.";
  if (code === "failed-precondition")
    return "Firestore needs an index for this query. Check the browser console for the setup link.";
  return friendlyAuthError(err);
};
