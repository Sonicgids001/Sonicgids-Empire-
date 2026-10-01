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

  function safeNext(defaultPage) {
    const next = new URLSearchParams(location.search).get("next");
    if (!next) return defaultPage;
    try {
      const target = new URL(next, location.href);
      if (target.origin !== location.origin || !/^\/(?!\/)/.test(target.pathname)) return defaultPage;
      return target.pathname.slice(1) + target.search + target.hash;
    } catch (_) { return defaultPage; }
  }

  /* --------------------------------------------------------------------------
     Nav state — swap "Client Login" for "Dashboard / Sign out"
     -------------------------------------------------------------------------- */
  function renderNavState(user) {
    /* The console link shows for the owner address even before the email is
       verified — the gate explains the one remaining step instead of hiding
       the door and leaving the owner wondering where the admin area went. */
    const admin = !!(user && window.SG && window.SG.isAdminEmail &&
      window.SG.isAdminEmail(user.email));
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
          setTimeout(() => (location.href = safeNext("dashboard.html")), 900);
        } else if (mode === "login") {
          const user = await window.SG.signIn(email, password);
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          const dest = safeNext(isOwner ? "admin.html" : "dashboard.html");
          setAlert(
            alertEl,
            isOwner && !new URLSearchParams(location.search).has("next")
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
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          location.href = safeNext(isOwner ? "admin.html" : "dashboard.html");
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

  /* --------------------------------------------------------------------------
     Dashboard tabs — the boost panel is the default view.
     Supports ?tab=orders / ?tab=overview deep links.
     -------------------------------------------------------------------------- */
  function initDashboardTabs() {
    const bar = document.querySelector("[data-dash-tab]");
    if (!bar) return;
    const tabs = Array.from(document.querySelectorAll("[data-dash-tab]"));
    const views = Array.from(document.querySelectorAll("[data-dash-view]"));

    function showTab(key) {
      const wanted = views.some((v) => v.dataset.dashView === key) ? key : "boost";
      tabs.forEach((t) => {
        const on = t.dataset.dashTab === wanted;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      views.forEach((v) => v.classList.toggle("hide", v.dataset.dashView !== wanted));
    }

    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        showTab(t.dataset.dashTab);
        if (history.replaceState) {
          const url = new URL(location.href);
          url.searchParams.set("tab", t.dataset.dashTab);
          history.replaceState({}, "", url);
        }
      })
    );

    showTab(new URLSearchParams(location.search).get("tab") || "boost");

    /* Refresh the order list straight after a boost is placed from the panel. */
    document.addEventListener("sg:order-placed", () => {
      document.dispatchEvent(new CustomEvent("sg:refresh-orders"));
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

  /* --------------------------------------------------------------------------
     Wallet panel — top-ups are requests and require manual payment verification.
     -------------------------------------------------------------------------- */
  function initWallet() {
    const root = $("[data-wallet-balance]");
    const form = $("[data-wallet-topup]");
    if (!root && !form) return;

    const setWalletAlert = (message, type) => {
      const el = $("[data-wallet-note]");
      if (!el) return;
      el.className = "alert show alert-" + (type || "info");
      el.textContent = message;
    };

    async function refresh() {
      if (!window.SG.currentUser) return;
      try {
        const [balance, activity, topups] = await Promise.all([
          window.SG.walletBalance(), window.SG.myWalletActivity(), window.SG.myWalletTopups()
        ]);
        if (root) root.textContent = window.SG.money(balance);
        const list = $("[data-wallet-activity]");
        if (!list) return;
        const entries = activity.map((entry) => ({
          title: entry.note || (entry.type === "credit" ? "Wallet credit" : "Order payment"),
          value: (entry.type === "credit" ? 1 : -1) * Number(entry.amount || 0),
          createdAt: entry.createdAt,
          status: ""
        }));
        topups.forEach((topup) => entries.push({
          title: "Top-up request" + (topup.reference ? " · " + topup.reference : ""),
          value: 0, createdAt: topup.createdAt, status: topup.status
        }));
        entries.sort((a, b) => walletMillis(b.createdAt) - walletMillis(a.createdAt));
        list.innerHTML = entries.length ? entries.slice(0, 8).map((entry) => {
          const date = walletDate(entry.createdAt);
          const amount = entry.value ? `<strong class="${entry.value > 0 ? "positive" : "negative"}">${entry.value > 0 ? "+" : "−"}${window.SG.money(Math.abs(entry.value))}</strong>` : `<span class="wallet-status">${escapeHtml(entry.status)}</span>`;
          return `<div class="wallet-entry"><span>${escapeHtml(entry.title)}<br><span class="muted">${date}</span></span>${amount}</div>`;
        }).join("") : '<p class="small muted">Your wallet activity will appear here.</p>';
      } catch (err) {
        if (root) root.textContent = "Unavailable";
        setWalletAlert((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Wallet data could not be loaded.", "error");
      }
    }

    if (form) form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $('button[type="submit"]', form);
      const amount = Number($('[name="amount"]', form).value);
      const reference = $('[name="reference"]', form).value.trim();
      if (!Number.isFinite(amount) || amount < 100) return setWalletAlert("Enter at least ₦100.", "error");
      button.disabled = true;
      button.textContent = "Submitting…";
      try {
        await window.SG.requestWalletTopup(amount, reference);
        form.reset();
        setWalletAlert("Top-up request received. We’ll verify the transfer before adding funds to your wallet.", "success");
        await refresh();
      } catch (err) {
        setWalletAlert((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || err.message || "Could not submit the request.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Submit top-up request";
      }
    });

    window.SGOnReady(() => window.SG.onUser((user) => { if (user) refresh(); }));
    document.addEventListener("sg:order-placed", () => setTimeout(refresh, 500));
    window.addEventListener("focus", refresh);
  }

  function walletMillis(value) {
    if (!value) return 0;
    if (typeof value.toDate === "function") return value.toDate().getTime();
    return new Date(value).getTime() || 0;
  }
  function walletDate(value) {
    const time = walletMillis(value);
    return time ? new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Just now";
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
    initDashboardTabs();
    initWallet();

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
