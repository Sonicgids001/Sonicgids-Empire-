/* Front-end route gate for the static Firebase Hosting site.
   Firestore rules remain the security boundary for private data. */
(function () {
  "use strict";
  if (!document.body || !document.body.hasAttribute("data-auth-required")) return;

  function showPrivatePage(user) {
    if (user) {
      document.documentElement.classList.remove("sg-auth-pending");
      document.body.removeAttribute("aria-busy");
      return;
    }
    const next = location.pathname + location.search + location.hash;
    location.replace("login.html?next=" + encodeURIComponent(next));
  }

  if (!window.SG || !window.SGReady) {
    location.replace("login.html?error=auth-unavailable");
    return;
  }
  window.SGReady.then((sg) => {
    if (!sg.auth) {
      location.replace("login.html?error=auth-unavailable");
      return;
    }
    sg.onUser(showPrivatePage);
  }).catch(() => location.replace("login.html?error=auth-unavailable"));
})();
