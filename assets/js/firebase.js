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
      "This domain isn't authorised in Firebase Authentication settings."
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
  const { collection, query, where, orderBy, limit, getDocs } = SG._mods.fs;
  const q = query(
    collection(SG.db, "leads"),
    where("uid", "==", SG.currentUser.uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

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
