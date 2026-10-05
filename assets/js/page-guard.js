/* Front-end route gate for the static Firebase Hosting site.
   Firestore rules remain the security boundary for private data.

   Two modes:
     • default      — signed-out visitors go to login.html; signed-in users
                      need a verified email before client pages can load.
     • inline gate  — admin.html stays reachable while signed out so its own
                      sign-in panel can be used. The configured admin
                      emails are also allowed through without verification.  */
(function () {
  "use strict";
  if (!document.body || !document.body.hasAttribute("data-auth-required")) return;

  const inlineGate = document.body.dataset.authGate === "inline";
  /* ?preview=1 renders a shell for signed-out layout previews only. It must
     never bypass verification for an authenticated, unverified account. */
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  let accessRevision = 0;

  function reveal() {
    document.documentElement.classList.remove("sg-auth-pending");
    document.body.removeAttribute("aria-busy");
  }

  function login() {
    const next = location.pathname + location.search + location.hash;
    location.replace("login.html?next=" + encodeURIComponent(next));
  }

  function verificationPage() {
    const next = location.pathname + location.search + location.hash;
    location.replace("verify-email.html?next=" + encodeURIComponent(next));
  }

  function adminPage() {
    location.replace("admin.html");
  }

  async function showPrivatePage(user, sg) {
    const revision = ++accessRevision;

    /* Admin's own gate decides whether a visitor can enter the console. */
    if (inlineGate) {
      reveal();
      document.dispatchEvent(new CustomEvent("sg:gate-ready"));
      return;
    }

    if (!user) {
      if (preview) return reveal();
      return login();
    }

    if (sg.isVerifiedUser && sg.isVerifiedUser(user)) return reveal();

    /* An unverified allowlisted admin belongs in the admin console, not the
       client dashboard/order pages. Admin identity is also checked in rules. */
    if (sg.isAdminUser && sg.isAdminUser(user)) return adminPage();

    /* Firebase may still have a cached profile after the user clicked the
       verification link. Reload before refusing access. */
    if (typeof sg.refreshUser === "function") {
      const fresh = await sg.refreshUser();
      if (revision !== accessRevision) return;
      if (fresh && sg.isVerifiedUser && sg.isVerifiedUser(fresh)) return reveal();
      if (fresh && sg.isAdminUser && sg.isAdminUser(fresh)) return adminPage();
    }
    if (revision !== accessRevision) return;
    return verificationPage();
  }

  if (!window.SG || !window.SGReady) {
    if (inlineGate || preview) return reveal();
    location.replace("login.html?error=auth-unavailable");
    return;
  }

  window.SGReady.then((sg) => {
    if (!sg.auth) {
      if (inlineGate || preview) return reveal();
      location.replace("login.html?error=auth-unavailable");
      return;
    }
    sg.onUser((user) => { showPrivatePage(user, sg); });
  }).catch(() => {
    if (inlineGate || preview) return reveal();
    location.replace("login.html?error=auth-unavailable");
  });
})();
