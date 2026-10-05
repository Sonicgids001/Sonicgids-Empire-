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

  function isVerifiedUser(user) {
    return !!(user && window.SG && window.SG.isVerifiedUser && window.SG.isVerifiedUser(user));
  }

  function isAdminUser(user) {
    return !!(user && window.SG && window.SG.isAdminUser && window.SG.isAdminUser(user));
  }

  function verificationUrl(next, sendError) {
    return "verify-email.html?next=" + encodeURIComponent(next || "dashboard.html") +
      (sendError ? "&sendError=1" : "");
  }

  /* --------------------------------------------------------------------------
     Nav state — swap "Client Login" for "Dashboard / Sign out"
     -------------------------------------------------------------------------- */
  function renderNavState(user) {
    /* Keep the admin door visible for either allowlisted address, even when
       that account has not verified its email. Client app links remain hidden
       until a regular account is verified. */
    const admin = !!(user && window.SG && window.SG.isAdminEmail &&
      window.SG.isAdminEmail(user.email));
    const appAccess = isVerifiedUser(user);
    $$("[data-auth-when]").forEach((el) => {
      const want = el.dataset.authWhen;
      let show;
      if (want === "in") show = !!user && appAccess;
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
          const user = await window.SG.signUp(email, password, name);
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          const requestedPage = safeNext(isOwner ? "admin.html" : "dashboard.html");
          const destination = isOwner || isVerifiedUser(user)
            ? requestedPage
            : verificationUrl(requestedPage);
          const message = isOwner
            ? "Account created. We sent a verification link to " + (user.email || email) +
              ". Admin access is available now; verifying the address is still recommended."
            : "Account created. We sent a verification link to " + (user.email || email) +
              ". Verify your address to access the dashboard. Check your inbox and spam folder.";
          setAlert(alertEl, message, "success");
          setTimeout(() => (location.href = destination), 2200);
        } else if (mode === "login") {
          const user = await window.SG.signIn(email, password);
          const isOwner = window.SG.isAdminEmail && window.SG.isAdminEmail(user.email);
          const requestedPage = safeNext(isOwner ? "admin.html" : "dashboard.html");
          const needsVerification = !isOwner && !isVerifiedUser(user);
          const dest = needsVerification ? verificationUrl(requestedPage) : requestedPage;
          setAlert(
            alertEl,
            needsVerification
              ? "You are signed in, but your email is not verified yet. Opening the verification step…"
              : (isOwner && !new URLSearchParams(location.search).has("next")
                ? "Welcome back, admin. Opening the admin console…"
                : "Welcome back. Loading your dashboard…"),
            needsVerification ? "info" : "success"
          );
          setTimeout(() => (location.href = dest), needsVerification ? 900 : 700);
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
        if (mode === "signup" && err && err.accountCreated) {
          const user = window.SG.currentUser || (window.SG.auth && window.SG.auth.currentUser);
          const isOwner = !!(user && window.SG.isAdminEmail && window.SG.isAdminEmail(user.email));
          const reason = err.cause && window.SG.friendlyError
            ? " " + window.SG.friendlyError(err.cause)
            : " Please check your connection and try again.";
          setAlert(
            alertEl,
            msg + reason + (isOwner
              ? " Opening the admin console; your allowlisted account can use it now."
              : " Taking you to the verification page so you can retry."),
            "error"
          );
          const requestedPage = safeNext(isOwner ? "admin.html" : "dashboard.html");
          setTimeout(
            () => (location.href = isOwner ? requestedPage : verificationUrl(requestedPage, true)),
            2600
          );
        } else {
          setAlert(alertEl, msg, "error");
        }
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
     Email-verification gate. Private client pages send unverified accounts
     here, where they can resend the link and refresh the Firebase profile.
     -------------------------------------------------------------------------- */
  function initVerificationPage() {
    const root = $("[data-email-verification]");
    if (!root) return;

    const alertEl = $("[data-verification-alert]", root);
    const controls = $("[data-verification-controls]", root);
    const signedOut = $("[data-verification-signed-out]", root);
    const emailEl = $("[data-verification-email]", root);
    const resend = $("[data-verification-resend]", root);
    const recheck = $("[data-verification-recheck]", root);
    const params = new URLSearchParams(location.search);
    let currentUser = null;
    let refreshRevision = 0;

    function message(text, type) {
      if (!alertEl) return;
      alertEl.className = "alert show alert-" + (type || "info");
      alertEl.textContent = text;
    }

    function destinationFor(user) {
      if (isAdminUser(user)) return "admin.html";
      const requested = params.get("next");
      if (requested) {
        try {
          const target = new URL(requested, location.href);
          if (target.origin === location.origin && target.pathname.startsWith("/") &&
              !target.pathname.startsWith("//") && target.pathname !== "/verify-email.html") {
            return target.pathname.slice(1) + target.search + target.hash;
          }
        } catch (_) { /* use the safe default below */ }
      }
      return "dashboard.html";
    }

    function renderUser(user) {
      currentUser = user || null;
      if (!user) {
        if (controls) controls.classList.add("hide");
        if (signedOut) signedOut.classList.remove("hide");
        if (params.has("sendError")) {
          message("Your account was created, but its verification email could not be sent. Sign in to resend it.", "error");
        } else {
          message("Sign in with the account you created to check or resend its verification link.", "info");
        }
        return;
      }

      if (controls) controls.classList.remove("hide");
      if (signedOut) signedOut.classList.add("hide");
      if (emailEl) emailEl.textContent = user.email || "your account email";
      if (isAdminUser(user)) {
        location.replace("admin.html");
        return;
      }
      if (isVerifiedUser(user)) {
        location.replace(destinationFor(user));
      }
    }

    if (resend) {
      resend.addEventListener("click", async () => {
        if (!currentUser) return message("Sign in first to resend the verification email.", "error");
        buttonBusy(resend, true, "Sending…");
        try {
          await window.SG.sendVerificationEmail(currentUser);
          message("Verification email sent to " + (currentUser.email || "your address") + ". Check your inbox and spam folder.", "success");
        } catch (err) {
          const detail = window.SG.friendlyError ? window.SG.friendlyError(err) : "Please try again shortly.";
          message("We could not send the verification email. " + detail, "error");
        } finally {
          buttonBusy(resend, false);
        }
      });
    }

    if (recheck) {
      recheck.addEventListener("click", async () => {
        if (!currentUser) return message("Sign in first to check your verification status.", "error");
        const revision = ++refreshRevision;
        buttonBusy(recheck, true, "Checking…");
        try {
          const fresh = await window.SG.refreshUser();
          if (revision !== refreshRevision) return;
          if (fresh) {
            currentUser = fresh;
            renderUser(fresh);
          }
          if (currentUser && !isAdminUser(currentUser) && !isVerifiedUser(currentUser)) {
            message("Firebase still shows this email as unverified. Open the latest link in your inbox, then check access again.", "info");
          }
        } catch (_) {
          message("We could not check the account right now. Check your connection and try again.", "error");
        } finally {
          buttonBusy(recheck, false);
        }
      });
    }

    document.addEventListener("sg:error", () => {
      message("Firebase could not be reached. Check your connection and reload this page.", "error");
    });

    window.SGOnReady(() => {
      window.SG.onUser(async (user) => {
        const revision = ++refreshRevision;
        renderUser(user);
        if (user && !isAdminUser(user) && !isVerifiedUser(user) && window.SG.refreshUser) {
          message("Checking your account's verification status…", "info");
          try {
            const fresh = await window.SG.refreshUser();
            if (revision !== refreshRevision) return;
            if (fresh) renderUser(fresh);
          } catch (_) { /* the re-check button remains available */ }
          if (currentUser && !isVerifiedUser(currentUser)) {
            if (params.has("sendError")) {
              message("Your account was created, but Firebase could not send the verification email. Use Resend verification email below.", "error");
            } else {
              message("Verification is still required for this account. Open the link we emailed you, or resend it below.", "info");
            }
          }
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

    const preview = new URLSearchParams(location.search).get("preview") === "1";
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
          if (preview) {
            /* Layout preview: show the shell, load nothing. */
            if (gate) gate.classList.add("hide");
            if (content) content.classList.remove("hide");
            if (greeting) greeting.textContent = "Dashboard preview";
            showNote("Preview mode — sign in to see your own wallet, orders and briefs.");
            if (activity) {
              activity.innerHTML =
                '<div class="task-row"><span class="task-dot wait"></span>' +
                '<span>Your briefs appear here once you are signed in.</span></div>';
            }
            return;
          }
          if (gate) gate.classList.remove("hide");
          if (content) content.classList.add("hide");
          return;
        }

        if (!isVerifiedUser(user)) {
          if (isAdminUser(user)) {
            location.replace("admin.html");
          } else {
            const next = location.pathname + location.search + location.hash;
            location.replace(verificationUrl(next));
          }
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

  async function encodeWalletProof(file) {
    if (!file) throw new Error("Choose a screenshot or photo of your transfer receipt.");
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!acceptedTypes.includes(String(file.type || "").toLowerCase())) {
      throw new Error("Use a JPG, PNG or WebP image for your payment receipt.");
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("That image is too large to process. Choose an image under 15 MB.");
    }

    const maxChars = (window.SG && window.SG.MAX_TOPUP_PROOF_DATA_URL_CHARS) || 700000;
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("This receipt image could not be opened. Try a different image."));
        image.src = objectUrl;
      });

      if (!image.naturalWidth || !image.naturalHeight || Math.max(image.naturalWidth, image.naturalHeight) > 12000) {
        throw new Error("This image has unsupported dimensions. Choose a normal screenshot or photo.");
      }
      const maxDimension = 1600;
      let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser. Try another browser.");

      for (let resize = 0; resize < 7; resize++) {
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of [0.82, 0.72, 0.62, 0.52]) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (dataUrl.length <= maxChars) return dataUrl;
        }
        scale *= 0.8;
      }
      throw new Error("This receipt image is still too large after compression. Choose a smaller screenshot.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /* --------------------------------------------------------------------------
     Wallet panel — top-ups remain pending until an admin reviews the receipt.
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
          title: "Top-up request · " + window.SG.money(topup.amount) + (topup.reference ? " · " + topup.reference : ""),
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
      const proofFile = $('[name="proof"]', form).files && $('[name="proof"]', form).files[0];
      if (!Number.isFinite(amount) || amount < 100) return setWalletAlert("Enter at least ₦100.", "error");
      if (!proofFile) return setWalletAlert("Upload an image of your transfer receipt before submitting.", "error");
      button.disabled = true;
      button.textContent = "Preparing receipt…";
      try {
        const proofDataUrl = await encodeWalletProof(proofFile);
        button.textContent = "Submitting request…";
        await window.SG.requestWalletTopup(amount, reference, proofDataUrl);
        form.reset();
        setWalletAlert("Your request is pending. An admin will review the receipt; your available balance will change only if it is approved.", "success");
        await refresh();
      } catch (err) {
        setWalletAlert((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || err.message || "Could not submit the request.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Submit top-up request";
      }
    });

    const walletPreview = new URLSearchParams(location.search).get("preview") === "1";
    window.SGOnReady(() => window.SG.onUser((user) => {
      if (user) return refresh();
      if (walletPreview) {
        if (root) root.textContent = window.SG.money(0);
        const list = $("[data-wallet-activity]");
        if (list) list.innerHTML = '<p class="small muted">Wallet activity appears here once you are signed in.</p>';
      }
    }));
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
    initVerificationPage();
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
