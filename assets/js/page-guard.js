/* Front-end route gate for the static Firebase Hosting site.
   Firestore rules remain the security boundary for private data.

   Two modes:
     • default      — signed-out visitors are sent to login.html?next=…
     • inline gate  — a page that carries data-auth-gate="inline" renders its
                      own sign-in card, so it must stay reachable while signed
                      out (admin.html does this: the owner needs the "Continue
                      with Google" button that lives inside the gate).        */
(function () {
  "use strict";
  if (!document.body || !document.body.hasAttribute("data-auth-required")) return;

  const inlineGate = document.body.dataset.authGate === "inline";

  function reveal() {
    document.documentElement.classList.remove("sg-auth-pending");
    document.body.removeAttribute("aria-busy");
  }

  function showPrivatePage(user) {
    if (user || inlineGate) {
      reveal();
      if (inlineGate) document.dispatchEvent(new CustomEvent("sg:gate-ready"));
      return;
    }
    const next = location.pathname + location.search + location.hash;
    location.replace("login.html?next=" + encodeURIComponent(next));
  }

  if (!window.SG || !window.SGReady) {
    if (inlineGate) return reveal();
    location.replace("login.html?error=auth-unavailable");
    return;
  }
  window.SGReady.then((sg) => {
    if (!sg.auth) {
      if (inlineGate) return reveal();
      location.replace("login.html?error=auth-unavailable");
      return;
    }
    sg.onUser(showPrivatePage);
  }).catch(() => {
    if (inlineGate) return reveal();
    location.replace("login.html?error=auth-unavailable");
  });
})();
