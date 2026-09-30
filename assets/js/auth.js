/* ==========================================================================
   SONICGIOS EMPIRE — Auth + client dashboard behaviour
   Handles sign-up, sign-in, password reset, sign-out, nav state and the
   authenticated client dashboard. Requires assets/js/firebase.js first.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function setAlert(el, message, type) {
    if (!el) {
      if (window.sgToast) window.sgToast(message, type === "success" ? "ok" : "error");
      return;
    }
    el.className = "alert show alert-" + (type || "error");
    el.textContent = message;
  }

  function clearAlert(el) {
    if (el) el.className = "alert";
  }

  function buttonBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label || "Please wait…";
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* --------------------------------------------------------------------------
     Nav state — swap "Client Login" for "Dashboard / Sign out"
     -------------------------------------------------------------------------- */
  function renderNavState(user) {
    const admin = !!(user && window.SG && window.SG.isAdminUser && window.SG.isAdminUser(user));
    $$("[data-auth-when]").forEach((el) => {
      const want = el.dataset.authWhen;
      let show;
      if (want === "in") show = !!user;
      else if (want === "out") show = !user;
      else if (want === "admin") show = admin;
      else show = true;
      el.classList.toggle("hide", !show);
    });
    $$("[data-user-name]").forEach((el) => {
      const name =
        (user && (user.displayName || (user.email || "").split("@")[0])) || "Client";
      el.textContent = name;
    });
    $$("[data-user-email]").forEach((el) => {
      el.textContent = user ? user.email : "";
    });
    $$("[data-user-initial]").forEach((el) => {
      const src = user ? user.displayName || user.email || "C" : "C";
      el.textContent = src.trim().charAt(0).toUpperCase();
    });
  }

  /* --------------------------------------------------------------------------
     Sign-out buttons
     -------------------------------------------------------------------------- */
  function initSignOut() {
    $$("[data-sign-out]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await window.SG.signOut();
          window.sgToast && window.sgToast("Signed out. See you soon.");
          setTimeout(() => {
            const to = btn.dataset.redirect || "index.html";
            location.href = to;
          }, 700);
        } catch (err) {
          window.sgToast && window.sgToast("Could not sign out. Try again.", "error");
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Auth forms on login.html / signup.html / forgot-password.html
     -------------------------------------------------------------------------- */
  function initAuthForms() {
    const form = $("[data-auth-form]");
    if (!form) return;

    const mode = form.dataset.authForm; // login | signup | reset
    const alertEl = $("[data-auth-alert]", form) || $("[data-auth-alert]");
    const submit = $('button[type="submit"]', form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert(alertEl);

      const email = ($('input[name="email"]', form).value || "").trim();
      const passwordEl = $('input[name="password"]', form);
      const password = passwordEl ? passwordEl.value : "";
      const nameEl = $('input[name="name"]', form);
      const name = nameEl ? nameEl.value.trim() : "";

      if (!validEmail(email)) {
        setAlert(alertEl, "Please enter a valid email address.", "error");
        return;
      }
      if (mode !== "reset" && password.length < 6) {
        setAlert(alertEl, "Your password must be at least 6 characters.", "error");
        return;
      }
      if (mode === "signup" && !name) {
        setAlert(alertEl, "Please tell us your name.", "error");
        return;
      }
      if (mode === "signup") {
        const confirmEl = $('input[name="confirm"]', form);
        if (confirmEl && confirmEl.value !== password) {
          setAlert(alertEl, "Those passwords don't match.", "error");
          return;
        }
        const terms = $('input[name="terms"]', form);
        if (terms && !terms.checked) {
          setAlert(alertEl, "Please accept the Terms of Service to continue.", "error");
          return;
        }
      }

      buttonBusy(submit, true, mode === "reset" ? "Sending…" : "Working…");

      try {
        if (mode === "signup") {
          await window.SG.signUp(email, password, name);
          setAlert(alertEl, "Account created. Taking you to your dashboard…", "success");
          setTimeout(() => (location.href = "dashboard.html"), 900);
        } else if (mode === "login") {
          const user = await window.SG.signIn(email, password);
          const explicit = new URLSearchParams(location.search).get("next");
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          const dest = explicit || (isOwner ? "admin.html" : "dashboard.html");
          setAlert(
            alertEl,
            isOwner && !explicit
              ? "Welcome back, admin. Opening the admin console…"
              : "Welcome back. Loading your dashboard…",
            "success"
          );
          setTimeout(() => (location.href = dest), 700);
        } else {
          await window.SG.resetPassword(email);
          setAlert(
            alertEl,
            "Reset link sent. Check your inbox (and spam folder).",
            "success"
          );
          form.reset();
        }
      } catch (err) {
        const msg =
          window.SG && window.SG.friendlyError
            ? window.SG.friendlyError(err)
            : (err && err.message) || "Something went wrong.";
        setAlert(alertEl, msg, "error");
      } finally {
        buttonBusy(submit, false);
      }
    });
  }

  /* --------------------------------------------------------------------------
     Dashboard
     -------------------------------------------------------------------------- */
  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  /* Standard sign-in buttons (Google) available on the login page */
  function initProviderButtons() {
    $$("[data-google-signin]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const alertEl = $("[data-auth-alert]");
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Opening Google…";
        try {
          const user = await window.SG.signInWithGoogle();
          const explicit = new URLSearchParams(location.search).get("next");
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          location.href = explicit || (isOwner ? "admin.html" : "dashboard.html");
        } catch (err) {
          setAlert(
            alertEl,
            (window.SG.friendlyError && window.SG.friendlyError(err)) ||
              "Google sign-in failed. Use your email and password instead.",
            "error"
          );
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    });
  }

  function initDashboard() {
    const root = $("[data-dashboard]");
    if (!root) return;

    const gate = $("[data-dashboard-gate]");
    const content = $("[data-dashboard-content]");
    const greeting = $("[data-greeting]");
    const activity = $("[data-dashboard-activity]");
    const note = $("[data-dashboard-note]");

    const showNote = (msg) => {
      if (!note) return;
      note.className = "alert show alert-info";
      note.textContent = msg;
    };
    const hideNote = () => {
      if (note) note.className = "alert alert-info hide";
    };

    window.SGOnReady(() => {
      window.SG.onUser(async (user) => {
        if (!user) {
          if (gate) gate.classList.remove("hide");
          if (content) content.classList.add("hide");
          return;
        }

        if (gate) gate.classList.add("hide");
        if (content) content.classList.remove("hide");
        if (greeting) {
          greeting.textContent =
            timeGreeting() + ", " +
            (user.displayName || (user.email || "").split("@")[0]) + ".";
        }
        renderNavState(user);

        try {
          hideNote();
          const leads = await window.SG.myLeads();
          const countEl = $("[data-lead-count]");
          if (countEl) countEl.textContent = String(leads.length);

          if (activity) {
            if (!leads.length) {
              activity.innerHTML =
                '<div class="task-row"><span class="task-dot wait"></span>' +
                '<span>No briefs submitted yet — <a href="contact.html">send your first brief</a>.</span></div>';
            } else {
              activity.innerHTML = leads
                .slice(0, 6)
                .map((l) => {
                  const when = l.createdAt && l.createdAt.toDate
                    ? l.createdAt.toDate().toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short"
                      })
                    : "—";
                  const status = (l.service || "Brief").toString();
                  return (
                    '<div class="task-row"><span class="task-dot"></span>' +
                    '<span>' + escapeHtml(status) + (l.budget ? " · " + escapeHtml(l.budget) : "") + "</span>" +
                    '<span class="task-when">' + when + "</span></div>"
                  );
                })
                .join("");
            }
          }
        } catch (err) {
          showNote(
            (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
            "Live data is unavailable right now. Your account team will share numbers by email instead."
          );
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* --------------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------------- */
  function boot() {
    initSignOut();
    initAuthForms();
    initProviderButtons();
    initDashboard();

    window.SGOnReady(() => {
      window.SG.onUser(renderNavState);
    });
    document.addEventListener("sg:error", () => {
      const alertEl = $("[data-auth-alert]");
      if (alertEl && document.querySelector("[data-auth-form]")) {
        setAlert(
          alertEl,
          "Firebase could not be reached. Check your connection and reload the page.",
          "error"
        );
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
