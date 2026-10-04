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
    "auth/requires-recent-login": "Please sign out and sign in again to continue.",
    "auth/verification-email-failed":
      "Your account was created, but its verification email could not be sent."
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
};

SG.friendlyError = friendlyAuthError;

SG.signUp = async function (email, password, name) {
  if (!SG.ready) await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const cred = await SG._mods.auth.createUserWithEmailAndPassword(SG.auth, email, password);
  SG.currentUser = cred.user;
  if (name) {
    try {
      await SG._mods.auth.updateProfile(cred.user, { displayName: name });
    } catch (e) { /* non-fatal */ }
  }
  SG.logEvent("sign_up", { method: "password" });
  try {
    await SG.sendVerificationEmail(cred.user);
  } catch (err) {
    /* Account creation has already succeeded. Mark the error so the sign-up
       page can guide the user to the admin gate's resend action instead of
       implying that no account was created. */
    const verificationError = new Error(
      "Your account was created, but its verification email could not be sent."
    );
    verificationError.code = "auth/verification-email-failed";
    verificationError.accountCreated = true;
    verificationError.cause = err;
    throw verificationError;
  }
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
   Only the owner address(es) below can reach the admin panel. Firestore rules
   enforce the same list server-side, so this is a convenience check — never
   the security boundary.

   To add a second admin, append the lowercase address here AND to the
   ADMIN_EMAILS list in firestore.rules, then redeploy the rules.
   ========================================================================== */
SG.ADMIN_EMAILS = ["okogbagideon28@gmail.com", "beniwealth70@gmail.com"];

/* Kept for backwards compatibility — the primary owner address. */
SG.ADMIN_EMAIL = SG.ADMIN_EMAILS[0];

SG.normalizeEmail = function (email) {
  return String(email || "").trim().toLowerCase();
};

SG.isAdminEmail = function (email) {
  const normal = SG.normalizeEmail(email);
  return !!normal && SG.ADMIN_EMAILS.indexOf(normal) !== -1;
};

/* Proof of ownership Firebase accepts without a verification link: a Google
   sign-in means Google already confirmed the mailbox. */
SG.signedInWithGoogle = function (user) {
  const providers = (user && user.providerData) || [];
  return providers.some((p) => p && p.providerId === "google.com");
};

/* One source of truth for "why can't I in?" — the admin gate renders this.
     signed-out        → nobody is logged in
     not-admin         → logged in, but not an owner address
     owner-unverified  → right address, email not verified yet (rules block it)
     owner             → full access
   ========================================================================== */
SG.adminStatus = function (user) {
  if (!user) return "signed-out";
  if (!SG.isAdminEmail(user.email)) return "not-admin";
  return user.emailVerified === true || SG.signedInWithGoogle(user)
    ? "owner"
    : "owner-unverified";
};

SG.isAdminUser = function (user) {
  return SG.adminStatus(user) === "owner";
};

/* Firebase hands back the profile cached at sign-in, so an address verified
   minutes ago still reads emailVerified === false (and the ID token still
   carries email_verified: false, which the security rules check). Pull a
   fresh profile and force a new token so the owner is not locked out of
   their own console after clicking the verification link. */
SG.refreshUser = async function () {
  await readyPromise;
  const user = SG.currentUser || (SG.auth && SG.auth.currentUser);
  if (!user || !SG.auth) return user || null;
  const authMod = SG._mods.auth || {};
  try {
    const reloadFn = authMod.reload || authMod.reloadUser;
    if (typeof reloadFn === "function") await reloadFn(user);
    else if (typeof user.reload === "function") await user.reload();
    if (typeof authMod.getIdToken === "function") await authMod.getIdToken(user, true);
    else if (typeof user.getIdToken === "function") await user.getIdToken(true);
  } catch (err) {
    console.warn("[Sonicgids] Could not refresh the account:", err && err.message);
  }
  SG.currentUser = SG.auth.currentUser || user;
  return SG.currentUser;
};

SG.signInWithGoogle = async function () {
  await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const { GoogleAuthProvider, signInWithPopup } = SG._mods.auth;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(SG.auth, provider);
  /* Update the shared user immediately; the auth-state listener may run just
     after the popup promise resolves, while page-specific gates already need
     the fresh Google identity. */
  SG.currentUser = cred.user;
  SG.logEvent("login", { method: "google" });
  return cred.user;
};

SG.sendVerificationEmail = async function (user) {
  if (!SG.ready) await readyPromise;
  if (!SG.auth) throw new Error("Authentication is unavailable right now.");
  const targetUser = user || SG.currentUser || SG.auth.currentUser;
  if (!targetUser) throw new Error("Sign in first, then request the email.");
  const { sendEmailVerification } = SG._mods.auth;

  /* Send new owners back to the admin gate after Firebase verifies the address;
     other new accounts continue to the client dashboard. This also works for
     the existing resend button on admin.html. */
  let actionCodeSettings = null;
  try {
    const returnPage = SG.isAdminEmail(targetUser.email) ? "admin.html" : "dashboard.html";
    actionCodeSettings = {
      url: new URL(returnPage, location.href).href,
      handleCodeInApp: false
    };
  } catch (e) {
    /* Some restricted browser contexts do not expose a usable page URL. */
  }

  if (!actionCodeSettings) {
    await sendEmailVerification(targetUser);
    return;
  }

  try {
    await sendEmailVerification(targetUser, actionCodeSettings);
  } catch (err) {
    /* A continue URL on a local or newly connected custom domain may not yet
       be allow-listed in Firebase. Still send the verification email using
       Firebase's default action handler in that case. Do not retry other
       errors (for example throttling or network failures). */
    const code = err && err.code;
    if (code !== "auth/unauthorized-continue-uri" && code !== "auth/invalid-continue-uri") {
      throw err;
    }
    await sendEmailVerification(targetUser);
  }
};

/* ==========================================================================
   MONEY — every rate on this site is in Nigerian Naira (₦) per 1,000 units.
   Rates are set by the admin in the console (boostServices.ratePer1000).
   ========================================================================== */
SG.CURRENCY = "NGN";
SG.CURRENCY_SYMBOL = "\u20A6";

/* Naira amount, e.g. 2500 -> "₦2,500" */
SG.money = function (value) {
  const n = Number(value);
  const safe = isNaN(n) ? 0 : n;
  return SG.CURRENCY_SYMBOL + safe.toLocaleString("en-NG", { maximumFractionDigits: 2 });
};

/* Rate for 1,000 units. Falls back to the legacy priceFrom field so services
   created before the naira switch keep showing a number. */
SG.rateOf = function (service) {
  if (!service) return 0;
  if (service.ratePer1000 != null && !isNaN(Number(service.ratePer1000))) {
    return Number(service.ratePer1000);
  }
  return Number(service.priceFrom) || 0;
};

/* Order cost = (quantity / 1000) x rate per 1000, rounded to 2dp. */
SG.orderTotal = function (ratePer1000, quantity) {
  const rate = Number(ratePer1000) || 0;
  const qty = Math.max(0, Number(quantity) || 0);
  return Math.round((qty / 1000) * rate * 100) / 100;
};

SG.serviceMin = function (service) {
  const min = Number(service && service.min);
  return !isNaN(min) && min > 0 ? min : 1;
};

SG.serviceMax = function (service) {
  const max = Number(service && service.max);
  return !isNaN(max) && max > 0 ? max : 100000000;
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
  { name: "Instagram Followers", platform: "Instagram", category: "Instagram", unit: "followers", ratePer1000: 2500, min: 100, max: 100000, turnaround: "0–24 hours start", priority: "high", type: "Real · 30-day refill", description: "Gradual follower delivery on a public profile. Keep the account public and do not order the same service twice on one link while an order is running." },
  { name: "Instagram Likes", platform: "Instagram", category: "Instagram", unit: "likes", ratePer1000: 900, min: 50, max: 50000, turnaround: "0–1 hour start", priority: "high", type: "Fast · no refill", description: "Likes on posts and reels to lift early engagement signals. Send the post link, not the profile link." },
  { name: "Instagram Reels Views", platform: "Instagram", category: "Instagram", unit: "views", ratePer1000: 350, min: 500, max: 1000000, turnaround: "0–30 minutes start", priority: "urgent", type: "Fast start", description: "Reel and video views delivered quickly to push the clip into wider distribution." },
  { name: "Instagram Story Views", platform: "Instagram", category: "Instagram", unit: "views", ratePer1000: 600, min: 100, max: 50000, turnaround: "0–1 hour start", priority: "normal", type: "Per story", description: "Views on the first story in your active tray. Order once per 24 hours." },
  { name: "TikTok Followers", platform: "TikTok", category: "TikTok", unit: "followers", ratePer1000: 3000, min: 100, max: 50000, turnaround: "0–24 hours start", priority: "high", type: "Real · possible drop", description: "Follower growth on a public TikTok account with geo targeting available on request." },
  { name: "TikTok Views", platform: "TikTok", category: "TikTok", unit: "views", ratePer1000: 250, min: 1000, max: 5000000, turnaround: "0–15 minutes start", priority: "urgent", type: "Fastest service", description: "Video views that trigger the For You distribution test on new uploads." },
  { name: "TikTok Likes", platform: "TikTok", category: "TikTok", unit: "likes", ratePer1000: 1200, min: 100, max: 50000, turnaround: "0–1 hour start", priority: "normal", type: "Guaranteed", description: "Likes on a specific TikTok video — send the video share link." },
  { name: "YouTube Views", platform: "YouTube", category: "YouTube", unit: "views", ratePer1000: 4500, min: 1000, max: 1000000, turnaround: "12–48 hours start", priority: "high", type: "Retention · non-drop", description: "Watch-time friendly views delivered over days to support ranking and monetisation thresholds." },
  { name: "YouTube Subscribers", platform: "YouTube", category: "YouTube", unit: "subscribers", ratePer1000: 12000, min: 50, max: 10000, turnaround: "1–3 days start", priority: "normal", type: "30-day refill", description: "Subscriber growth spread across days for a natural-looking curve. Channel must be public." },
  { name: "Facebook Page Likes & Follows", platform: "Facebook", category: "Facebook", unit: "likes", ratePer1000: 3500, min: 100, max: 100000, turnaround: "0–24 hours start", priority: "normal", type: "Country targeted", description: "Page likes and follows with optional country filtering for local businesses." },
  { name: "Facebook Post Reactions", platform: "Facebook", category: "Facebook", unit: "reactions", ratePer1000: 1500, min: 100, max: 50000, turnaround: "0–2 hours start", priority: "normal", type: "Mixed reactions", description: "Reactions on a public post. The post must be visible to everyone." },
  { name: "X (Twitter) Followers", platform: "X", category: "X (Twitter)", unit: "followers", ratePer1000: 6500, min: 100, max: 20000, turnaround: "0–24 hours start", priority: "high", type: "Low drop", description: "Follower growth on a public X profile, capped daily to protect the account." },
  { name: "X (Twitter) Likes & Reposts", platform: "X", category: "X (Twitter)", unit: "engagements", ratePer1000: 2200, min: 50, max: 20000, turnaround: "0–1 hour start", priority: "normal", type: "Fast", description: "Likes and reposts on a single tweet to widen the reach of announcements and threads." },
  { name: "X (Twitter) Views & Impressions", platform: "X", category: "X (Twitter)", unit: "views", ratePer1000: 400, min: 1000, max: 10000000, turnaround: "0–15 minutes start", priority: "urgent", type: "Cheapest views", description: "Tweet views and impressions delivered fast on any public tweet." },
  { name: "Telegram Channel Members", platform: "Telegram", category: "Telegram", unit: "members", ratePer1000: 3200, min: 100, max: 200000, turnaround: "0–12 hours start", priority: "normal", type: "Non-drop available", description: "Channel or group members with geo targeting — useful for media, betting and crypto brands." },
  { name: "Telegram Post Views", platform: "Telegram", category: "Telegram", unit: "views", ratePer1000: 180, min: 100, max: 1000000, turnaround: "0–10 minutes start", priority: "normal", type: "Last posts / future posts", description: "Views on the last post, a list of posts, or automatically on every future post." },
  { name: "WhatsApp Channel Followers", platform: "WhatsApp", category: "WhatsApp", unit: "followers", ratePer1000: 4000, min: 100, max: 50000, turnaround: "1–3 days start", priority: "high", type: "Real accounts", description: "Followers added to your WhatsApp channel, filtered by region where possible." },
  { name: "Spotify Plays", platform: "Music", category: "Music & Streaming", unit: "plays", ratePer1000: 2800, min: 1000, max: 1000000, turnaround: "1–3 days start", priority: "low", type: "Playlist safe", description: "Track, album or playlist plays delivered from algorithmic playlists over several days." },
  { name: "Audiomack Plays & Followers", platform: "Music", category: "Music & Streaming", unit: "plays", ratePer1000: 1500, min: 1000, max: 1000000, turnaround: "0–24 hours start", priority: "low", type: "Fast", description: "Plays and follower growth for artists releasing new music on Audiomack." },
  { name: "Custom Comments", platform: "Multi-platform", category: "Engagement", unit: "comments", ratePer1000: 25000, min: 10, max: 1000, turnaround: "12–48 hours start", priority: "normal", type: "Custom text", description: "Human-written comments you supply, posted on Instagram, TikTok, YouTube or X. Add the comment list in the notes box." },
  { name: "Website Traffic", platform: "Web", category: "Website & SEO", unit: "visits", ratePer1000: 1200, min: 1000, max: 500000, turnaround: "0–24 hours start", priority: "low", type: "Country + referrer options", description: "Direct or referral visits to any URL, with country targeting and a referrer of your choice." },
  { name: "Live Stream Viewers", platform: "Multi-platform", category: "Live", unit: "viewers", ratePer1000: 15000, min: 100, max: 10000, turnaround: "Scheduled", priority: "urgent", type: "Concurrent viewers", description: "Concurrent viewers during a live session on TikTok, Instagram, YouTube, Facebook or Twitch. Book in advance and put the start time in the notes." }
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
  const rate = Number(data.ratePer1000 != null ? data.ratePer1000 : data.priceFrom) || 0;
  const min = Math.max(1, parseInt(data.min, 10) || 0);
  const max = Math.max(min, parseInt(data.max, 10) || 1000000);
  const payload = {
    name: data.name || "Untitled service",
    platform: data.platform || "",
    category: data.category || "",
    unit: data.unit || "",
    /* ratePer1000 is the single source of truth for pricing (naira).
       priceFrom is kept in sync so older cached clients never show $0. */
    ratePer1000: rate,
    priceFrom: rate,
    currency: "NGN",
    min: min,
    max: max,
    type: data.type || "",
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
      ratePer1000: SG.rateOf(s),
      priceFrom: SG.rateOf(s),
      currency: "NGN",
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
/* ==========================================================================
   WALLET — balances are changed only by atomic order debits or admin credits.
   Clients may request a top-up but cannot mark it paid themselves.
   ========================================================================== */
SG.walletBalance = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser) throw new Error("Sign in to view your wallet.");
  const { doc, getDoc, runTransaction, serverTimestamp } = SG._mods.fs;
  const ref = doc(SG.db, "wallets", SG.currentUser.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    await runTransaction(SG.db, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists()) tx.set(ref, { balance: 0, currency: "NGN", updatedAt: serverTimestamp() });
    });
    snap = await getDoc(ref);
  }
  return Number(snap.data().balance) || 0;
};

SG.myWalletActivity = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser) return [];
  const { collection, query, where, getDocs } = SG._mods.fs;
  const snap = await getDocs(query(collection(SG.db, "walletTransactions"), where("uid", "==", SG.currentUser.uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 10);
};

SG.requestWalletTopup = async function (amount, reference) {
  await readyPromise;
  if (!SG.db || !SG.currentUser) throw new Error("Sign in to request a wallet top-up.");
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value < 100 || value > 50000000) throw new Error("Enter an amount between ₦100 and ₦50,000,000.");
  const { addDoc, collection, serverTimestamp } = SG._mods.fs;
  const result = await addDoc(collection(SG.db, "walletTopups"), {
    uid: SG.currentUser.uid, email: SG.currentUser.email || "", amount: value,
    reference: String(reference || "").trim().slice(0, 100), status: "pending", createdAt: serverTimestamp()
  });
  return result.id;
};

SG.myWalletTopups = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser) return [];
  const { collection, query, where, getDocs } = SG._mods.fs;
  const snap = await getDocs(query(collection(SG.db, "walletTopups"), where("uid", "==", SG.currentUser.uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 10);
};

SG.adminListWalletTopups = async function () {
  await readyPromise;
  if (!SG.db || !SG.currentUser || !SG.isAdminUser(SG.currentUser)) throw new Error("Admin access required.");
  const { collection, getDocs, query, where } = SG._mods.fs;
  const snap = await getDocs(query(collection(SG.db, "walletTopups"), where("status", "==", "pending")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

SG.adminReviewWalletTopup = async function (topupId, approve) {
  await readyPromise;
  if (!SG.db || !SG.currentUser || !SG.isAdminUser(SG.currentUser)) throw new Error("Admin access required.");
  const { doc, runTransaction, serverTimestamp } = SG._mods.fs;
  const topupRef = doc(SG.db, "walletTopups", topupId);
  const transactionId = "topup_" + topupId;
  const ledgerRef = doc(SG.db, "walletTransactions", transactionId);
  await runTransaction(SG.db, async (tx) => {
    const topupSnap = await tx.get(topupRef);
    if (!topupSnap.exists() || topupSnap.data().status !== "pending") throw new Error("This top-up request has already been reviewed.");
    const topup = topupSnap.data();
    const walletRef = doc(SG.db, "wallets", topup.uid);
    const walletSnap = await tx.get(walletRef);
    const balance = walletSnap.exists() ? Number(walletSnap.data().balance) || 0 : 0;
    const nextBalance = approve ? balance + Number(topup.amount) : balance;
    tx.update(topupRef, { status: approve ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: SG.currentUser.email || "admin" });
    if (approve) {
      tx.set(walletRef, { balance: nextBalance, currency: "NGN", updatedAt: serverTimestamp(), lastTransactionId: transactionId }, { merge: true });
      tx.set(ledgerRef, { uid: topup.uid, type: "credit", source: "topup", amount: Number(topup.amount), balanceAfter: nextBalance, topupId, createdAt: serverTimestamp(), note: "Wallet top-up approved" });
    }
  });
};

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
  const { collection, doc, runTransaction, serverTimestamp } = SG._mods.fs;
  const priority = order.priority || "normal";
  const amount = Math.round((Number(order.amount) || 0) * 100) / 100;
  if (amount < 0 || amount > 500000000) throw new Error("The order amount is invalid.");
  const orderRef = doc(collection(SG.db, "orders"));
  const walletRef = doc(SG.db, "wallets", SG.currentUser.uid);
  const ledgerRef = doc(SG.db, "walletTransactions", "order_" + orderRef.id);
  const payload = {
    ref: SG.newOrderRef(), uid: SG.currentUser.uid, email: SG.currentUser.email || order.email || "",
    contactName: order.contactName || SG.currentUser.displayName || "", contactPhone: order.contactPhone || "",
    brand: order.brand || "", serviceId: order.serviceId || "", serviceName: order.serviceName || "Boost service",
    platform: order.platform || "", category: order.category || "", unit: order.unit || "",
    packageLabel: order.packageLabel || "Standard package", quantity: order.quantity || "",
    quantityNum: Number(order.quantityNum) || 0, unitLabel: order.unitLabel || order.unit || "",
    ratePer1000: Number(order.ratePer1000) || 0, currency: "NGN", amount, priority,
    priorityRank: SG.priorityRank(priority), targetLink: order.targetLink || "", notes: order.notes || "",
    status: "pending", adminNote: "",
    history: [{ status: "pending", at: new Date().toISOString(), by: "client", note: "Order submitted" }],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  let balanceAfter = 0;
  await runTransaction(SG.db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists()) throw new Error("Your wallet is being set up. Refresh the page and try again.");
    const balance = Number(walletSnap.data().balance) || 0;
    if (balance < amount) throw new Error("Insufficient wallet balance. Add at least " + SG.money(amount - balance) + " to place this order.");
    balanceAfter = Math.round((balance - amount) * 100) / 100;
    tx.set(orderRef, payload);
    tx.update(walletRef, { balance: balanceAfter, currency: "NGN", lastTransactionId: "order_" + orderRef.id, updatedAt: serverTimestamp() });
    tx.set(ledgerRef, { uid: SG.currentUser.uid, type: "debit", source: "order", amount, balanceAfter, orderId: orderRef.id, orderRef: payload.ref, createdAt: serverTimestamp(), note: "Order payment" });
  });
  SG.logEvent("place_order", { service: payload.serviceName, value: payload.amount });
  return { id: orderRef.id, ref: payload.ref, balance: balanceAfter };
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
  if (!SG.currentUser || !SG.isAdminUser(SG.currentUser)) throw new Error("Admin access required.");
  const { collection, doc, runTransaction, serverTimestamp, arrayUnion } = SG._mods.fs;
  const orderRef = doc(SG.db, "orders", id);
  await runTransaction(SG.db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data();
    const patch = { ...changes, updatedAt: serverTimestamp(), updatedBy: SG.currentUser.email };
    if (changes.status && changes.status !== order.status) {
      patch.history = arrayUnion({ status: changes.status, at: new Date().toISOString(), by: SG.currentUser.email, note: note || "" });
      if (changes.status === "approved") patch.approvedAt = serverTimestamp();
      if (changes.status === "ongoing") patch.startedAt = serverTimestamp();
      if (changes.status === "completed") patch.completedAt = serverTimestamp();
      if (changes.status === "rejected") patch.rejectedAt = serverTimestamp();
      const refund = changes.status === "rejected" && order.status !== "rejected";
      const reopen = order.status === "rejected" && changes.status === "approved";
      if ((refund || reopen) && order.uid) {
        const walletRef = doc(SG.db, "wallets", order.uid);
        const walletSnap = await tx.get(walletRef);
        const oldBalance = walletSnap.exists() ? Number(walletSnap.data().balance) || 0 : 0;
        const amount = Number(order.amount) || 0;
        if (reopen && oldBalance < amount) throw new Error("Client wallet has insufficient funds to reopen this order.");
        const nextBalance = Math.round((oldBalance + (refund ? amount : -amount)) * 100) / 100;
        const ledgerRef = doc(collection(SG.db, "walletTransactions"));
        tx.set(walletRef, { balance: nextBalance, currency: "NGN", lastTransactionId: ledgerRef.id, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(ledgerRef, { uid: order.uid, type: refund ? "credit" : "debit", source: refund ? "order_refund" : "order_reopen", amount, balanceAfter: nextBalance, orderId: id, orderRef: order.ref || "", createdAt: serverTimestamp(), note: refund ? "Refund for rejected order" : "Reopened order payment" });
      }
    }
    tx.update(orderRef, patch);
  });
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
  if (code === "permission-denied") {
    const owner = SG.isAdminEmail(SG.currentUser && SG.currentUser.email);
    if (owner) {
      return "Firestore refused this read for " + (SG.currentUser.email || "the owner account") +
        ". The rules accept the owner address only once the email is verified (or you sign in " +
        "with Google) — verify it, then press Re-check access. If it is already verified, the " +
        "deployed rules are out of date: run `firebase deploy --only firestore:rules`.";
    }
    return "You do not have permission to read this data. Admin data is limited to the owner account.";
  }
  if (code === "unavailable")
    return "Could not reach the database. Check that Cloud Firestore is enabled for this project.";
  if (code === "failed-precondition")
    return "Firestore needs an index for this query. Check the browser console for the setup link.";
  return friendlyAuthError(err);
};
