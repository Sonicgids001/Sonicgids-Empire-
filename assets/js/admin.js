/* ==========================================================================
   SONICGIOS EMPIRE — Admin console
   Restricted to SG.ADMIN_EMAILS. Firestore rules enforce the same restriction
   server-side, so this file only controls what the UI shows.

   What the admin can do here:
     • process orders through pending → approved / rejected → ongoing → completed
     • review Base64 payment receipts and approve or reject wallet top-ups
     • set service priorities and manage the boosting catalogue
     • read contact-form leads and newsletter subscribers
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const U = window.SGOrders || {};
  /* Everything is in naira now — SG.money is the single formatter. */
  const money = (n) =>
    window.SG && SG.money ? SG.money(n) : (U.money ? U.money(n) : "\u20A6" + (Number(n) || 0));
  const dateStr = U.dateStr || ((v) => String(v || "—"));

  const state = {
    orders: [],
    services: [],
    leads: [],
    subscribers: [],
    filter: "pending",
    search: "",
    editingServiceId: null,
    loaded: { orders: false, services: false, leads: false, subscribers: false, walletTopups: false }
  };

  const $gate = () => $("[data-admin-gate]");
  const $panel = () => $("[data-admin-panel]");
  const $noAccess = () => $("[data-admin-noaccess]");
  const $signinWrap = () => $("[data-admin-signin]");
  const $identity = () => $("[data-admin-identity]");

  function toast(msg, type) {
    if (window.sgToast) window.sgToast(msg, type);
  }

  /* ------------------------------------------------------------------ */
  /* Tabs                                                                */
  /* ------------------------------------------------------------------ */
  function initTabs() {
    $$("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.adminTab;
        $$("[data-admin-tab]").forEach((b) => b.classList.toggle("active", b === btn));
        $$("[data-admin-view]").forEach((v) =>
          v.classList.toggle("hide", v.dataset.adminView !== tab)
        );
        loadTab(tab);
      });
    });
  }

  function loadTab(tab) {
    if (tab === "orders" && !state.loaded.orders) loadOrders();
    if (tab === "wallet" && !state.loaded.walletTopups) loadWalletTopups();
    if (tab === "services" && !state.loaded.services) loadServices();
    if (tab === "leads" && !state.loaded.leads) loadLeads();
    if (tab === "subscribers" && !state.loaded.subscribers) loadSubscribers();
    if (tab === "overview") loadOverview();
  }

  /* ------------------------------------------------------------------ */
  /* Overview                                                            */
  /* ------------------------------------------------------------------ */
  async function loadOverview() {
    const statsEl = $("[data-admin-stats]");
    const queueEl = $("[data-admin-queue]");
    const activityEl = $("[data-admin-activity]");
    if (!state.loaded.orders) {
      if (statsEl) statsEl.innerHTML = `<p class="muted small">Loading live figures…</p>`;
      await loadOrders();
    }

    const s = U.summarise ? U.summarise(state.orders) : { total: 0 };
    const pipeline = state.orders
      .filter((o) => ["pending", "approved", "ongoing"].includes(o.status))
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const urgent = state.orders.filter(
      (o) => o.priority === "urgent" && ["pending", "approved", "ongoing"].includes(o.status)
    ).length;

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="dash-stat"><div class="label">Awaiting approval</div><div class="value">${s.pending || 0}</div><div class="delta warn">Needs your decision</div></div>
        <div class="dash-stat"><div class="label">In progress</div><div class="value">${(s.approved || 0) + (s.ongoing || 0)}</div><div class="delta">Approved + ongoing</div></div>
        <div class="dash-stat"><div class="label">Completed</div><div class="value">${s.completed || 0}</div><div class="delta">Delivered orders</div></div>
        <div class="dash-stat"><div class="label">Pipeline value</div><div class="value">${money(pipeline)}</div><div class="delta ${urgent ? "warn" : ""}">${urgent} urgent order${urgent === 1 ? "" : "s"}</div></div>`;
    }

    if (queueEl) {
      const queue = state.orders
        .filter((o) => ["pending", "approved", "ongoing"].includes(o.status))
        .slice(0, 5);
      queueEl.innerHTML = queue.length
        ? queue
            .map(
              (o) => `<div class="queue-row">
            <span class="priority-dot priority-${esc(o.priority || "normal")}"></span>
            <span class="qr-main"><strong>${esc(o.serviceName)}</strong><span class="muted small"> · ${esc(o.contactName || o.email || "client")}</span></span>
            <span class="qr-ref">${esc(o.ref || "")}</span>
            ${U.statusBadge ? U.statusBadge(o.status) : ""}
          </div>`
            )
            .join("")
        : `<div class="empty-state small"><p>No open orders in the queue. 🎉</p></div>`;
    }

    if (activityEl) {
      const events = [];
      state.orders.forEach((o) => {
        (o.history || []).forEach((h) => events.push({ ...h, ref: o.ref, service: o.serviceName }));
      });
      events.sort((a, b) => new Date(b.at) - new Date(a.at));
      activityEl.innerHTML = events.length
        ? events
            .slice(0, 8)
            .map(
              (e) => `<div class="task-row">
            <span class="task-dot ${e.status === "completed" ? "done" : e.status === "rejected" ? "wait" : ""}"></span>
            <span><strong>${esc(e.service)}</strong> — ${esc(e.status)}${e.note ? `<span class="muted small"> · ${esc(e.note)}</span>` : ""}</span>
            <span class="task-when">${dateStr(e.at)}</span>
          </div>`
            )
            .join("")
        : `<div class="task-row"><span class="task-dot wait"></span><span>No order activity yet.</span></div>`;
    }

    renderTabCounts();
  }

  /* ------------------------------------------------------------------ */
  /* Orders                                                              */
  /* ------------------------------------------------------------------ */
  async function loadOrders() {
    const listEl = $("[data-admin-orders]");
    if (listEl) listEl.innerHTML = `<p class="muted small">Loading orders…</p>`;
    try {
      state.orders = await window.SG.adminListOrders();
      state.loaded.orders = true;
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `<div class="alert show alert-error">${
          (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
          "Orders could not be loaded."
        }</div>`;
      }
      return;
    }
    renderOrders();
    renderTabCounts();
    loadOverview();
  }

  function filteredOrders() {
    const q = state.search.trim().toLowerCase();
    return state.orders.filter((o) => {
      const matchStatus = state.filter === "all" || o.status === state.filter;
      if (!matchStatus) return false;
      if (!q) return true;
      return [o.ref, o.serviceName, o.contactName, o.email, o.contactPhone, o.targetLink]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }

  function renderOrders() {
    const listEl = $("[data-admin-orders]");
    const countEl = $("[data-admin-order-count]");
    if (!listEl) return;

    const orders = filteredOrders();
    if (countEl) countEl.textContent = String(orders.length);

    if (!orders.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🗂</div>
        <h3>Nothing here</h3>
        <p>No orders match this view yet.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = orders
      .map((o) => (U.orderCard ? U.orderCard(o, { admin: true }) : ""))
      .join("");

    /* fill in the action bars */
    $$(".order-card", listEl).forEach((card) => {
      const order = state.orders.find((o) => o.id === card.dataset.orderId);
      const bar = $("[data-order-actions]", card);
      if (!order || !bar) return;
      bar.innerHTML = actionButtons(order);
    });
  }

  function actionButtons(order) {
    const next = (window.SG.NEXT_STATUSES || {})[order.status] || [];
    const labels = {
      approved: ["Approve order", "btn-gold"],
      rejected: ["Reject", "btn-danger"],
      ongoing: ["Start work", "btn-gold"],
      completed: ["Mark completed", "btn-ghost"]
    };
    const buttons = next
      .map((s) => {
        const [label, cls] = labels[s] || [s, "btn-ghost"];
        return `<button class="btn btn-sm ${cls}" data-order-action="${s}" data-id="${order.id}">${label}</button>`;
      })
      .join("");

    return `
      <div class="order-action-row">
        ${buttons}
        <label class="priority-select">
          <span>Priority</span>
          <select data-order-priority data-id="${order.id}">
            ${(window.SG.PRIORITIES || [])
              .map(
                (p) =>
                  `<option value="${p.key}" ${order.priority === p.key ? "selected" : ""}>${p.label}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      <div class="order-note-row">
        <input type="text" data-order-note data-id="${order.id}" placeholder="Note to the client (optional, saved with the status change)" maxlength="240">
        <button class="btn btn-ghost btn-sm" data-order-save-note data-id="${order.id}">Save note</button>
      </div>`;
  }

  function initOrderActions() {
    const listEl = $("[data-admin-orders]");
    if (!listEl) return;

    listEl.addEventListener("click", async (e) => {
      const statusBtn = e.target.closest("[data-order-action]");
      const noteBtn = e.target.closest("[data-order-save-note]");

      if (statusBtn) {
        const id = statusBtn.dataset.orderId || statusBtn.dataset.id;
        const status = statusBtn.dataset.orderAction;
        const noteInput = $(`[data-order-note][data-id="${id}"]`);
        const note = noteInput ? noteInput.value.trim() : "";
        const verb = {
          approved: "approve", rejected: "reject", ongoing: "start",
          completed: "complete", pending: "reopen"
        }[status] || status;
        if (!confirm(`Are you sure you want to ${verb} order ${idShort(id)}?`)) return;
        await applyStatus(id, status, note, statusBtn);
        return;
      }

      if (noteBtn) {
        const id = noteBtn.dataset.id;
        const noteInput = $(`[data-order-note][data-id="${id}"]`);
        const note = noteInput ? noteInput.value.trim() : "";
        if (!note) return toast("Type a note first.", "error");
        await applyStatus(id, null, note, noteBtn);
      }
    });

    listEl.addEventListener("change", async (e) => {
      const sel = e.target.closest("[data-order-priority]");
      if (!sel) return;
      const id = sel.dataset.id;
      try {
        await window.SG.adminUpdateOrder(
          id,
          { priority: sel.value, priorityRank: window.SG.priorityRank(sel.value) },
          `Priority set to ${window.SG.priorityLabel(sel.value)}`
        );
        const order = state.orders.find((o) => o.id === id);
        if (order) {
          order.priority = sel.value;
          order.priorityRank = window.SG.priorityRank(sel.value);
        }
        toast("Priority updated.");
        renderOrders();
      } catch (err) {
        toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Could not update priority.", "error");
      }
    });
  }

  function idShort(id) {
    const o = state.orders.find((x) => x.id === id);
    return o && o.ref ? o.ref : String(id).slice(0, 6);
  }

  async function applyStatus(id, status, note, btn) {
    const original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    try {
      const changes = {};
      if (status) changes.status = status;
      if (note) changes.adminNote = note;
      await window.SG.adminUpdateOrder(id, changes, note);
      const order = state.orders.find((o) => o.id === id);
      if (order) {
        if (status) {
          order.status = status;
          order.history = (order.history || []).concat([{
            status, at: new Date().toISOString(),
            by: (window.SG.currentUser && window.SG.currentUser.email) || "admin",
            note
          }]);
        }
        if (note) order.adminNote = note;
      }
      toast(status ? `Order ${idShort(id)} marked ${status}.` : "Note saved.");
      renderOrders();
      loadOverview();
    } catch (err) {
      toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Update failed.", "error");
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  }

  function renderTabCounts() {
    const pending = state.orders.filter((o) => o.status === "pending").length;
    const el = $("[data-count-pending]");
    if (el) {
      el.textContent = String(pending);
      el.classList.toggle("hide", pending === 0);
    }
  }

  function initOrderFilters() {
    const bar = $("[data-order-filters]");
    if (bar) {
      bar.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-filter]");
        if (!btn) return;
        state.filter = btn.dataset.filter;
        $$("button", bar).forEach((b) => b.classList.toggle("active", b === btn));
        renderOrders();
      });
    }
    const search = $("[data-order-search]");
    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        renderOrders();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wallet top-ups                                                     */
  /* ------------------------------------------------------------------ */
  async function loadWalletTopups() {
    const el = $("[data-admin-wallet-topups]");
    if (el) el.innerHTML = '<p class="muted small">Loading requests…</p>';
    try {
      const requests = await window.SG.adminListWalletTopups();
      state.loaded.walletTopups = true;
      if (!el) return;
      if (!requests.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div><h3>No pending top-ups</h3><p>New payment requests will appear here.</p></div>';
        return;
      }
      el.innerHTML = requests.map((item) => `
        <article class="lead-row wallet-review" data-wallet-request="${esc(item.id)}">
          <div class="lead-top"><strong>${esc(item.email || item.uid)}</strong><span>${money(item.amount)}</span><span class="task-when">${dateStr(item.createdAt)}</span></div>
          <p class="small muted">Transfer reference: <strong>${esc(item.reference || "Not provided")}</strong></p>
          <div class="wallet-proof-tools">
            <button class="btn btn-white btn-sm" type="button" data-wallet-proof-toggle data-id="${esc(item.id)}">View payment receipt</button>
            <span class="small muted">Base64 image · visible to admin only</span>
          </div>
          <div class="wallet-proof-display hide" data-wallet-proof-display aria-live="polite"></div>
          <div class="lead-actions">
            <button class="btn btn-gold btn-sm" type="button" data-wallet-review="approve" data-id="${esc(item.id)}">Verify &amp; approve</button>
            <button class="btn btn-ghost btn-sm" type="button" data-wallet-review="reject" data-id="${esc(item.id)}">Reject request</button>
          </div>
        </article>`).join("");
    } catch (err) {
      if (el) el.innerHTML = `<div class="alert show alert-error">${esc((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Top-up requests could not be loaded.")}</div>`;
    }
  }

  async function showWalletTopupProof(button) {
    const card = button.closest("[data-wallet-request]");
    const display = card && $("[data-wallet-proof-display]", card);
    if (!card || !display) return;

    if (display.dataset.loaded === "true") {
      display.classList.toggle("hide");
      button.textContent = display.classList.contains("hide") ? "View payment receipt" : "Hide receipt";
      return;
    }

    button.disabled = true;
    button.textContent = "Loading receipt…";
    try {
      const proof = await window.SG.adminGetWalletTopupProof(card.dataset.walletRequest);
      if (typeof proof !== "string" || proof.length > 700000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(proof)) {
        throw new Error("No valid receipt image was found for this request.");
      }
      display.innerHTML = `<img src="${esc(proof)}" alt="Uploaded transfer receipt" loading="lazy">`;
      display.classList.remove("hide");
      display.dataset.loaded = "true";
      button.textContent = "Hide receipt";
    } catch (err) {
      display.classList.remove("hide");
      display.textContent = (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || err.message || "Could not load the receipt.";
      button.textContent = "Try loading receipt again";
    } finally {
      button.disabled = false;
    }
  }

  function initWalletTopups() {
    const el = $("[data-admin-wallet-topups]");
    if (!el) return;
    el.addEventListener("click", async (event) => {
      const proofButton = event.target.closest("[data-wallet-proof-toggle]");
      if (proofButton) {
        await showWalletTopupProof(proofButton);
        return;
      }

      const button = event.target.closest("[data-wallet-review]");
      if (!button) return;
      const approve = button.dataset.walletReview === "approve";
      if (approve) {
        const card = button.closest("[data-wallet-request]");
        const proofDisplay = card && $("[data-wallet-proof-display]", card);
        if (!proofDisplay || proofDisplay.dataset.loaded !== "true") {
          toast("Open and review the payment receipt before approving this top-up.", "error");
          return;
        }
        if (!confirm("Confirm you checked the receipt and received this payment in the company account? This will credit the client's wallet.")) return;
      }
      button.disabled = true;
      try {
        await window.SG.adminReviewWalletTopup(button.dataset.id, approve);
        toast(approve ? "Top-up verified and wallet credited." : "Top-up request rejected.");
        state.loaded.walletTopups = false;
        await loadWalletTopups();
      } catch (err) {
        toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || err.message || "Could not review top-up.", "error");
        button.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boost services                                                      */
  /* ------------------------------------------------------------------ */
  async function loadServices() {
    const listEl = $("[data-service-list]");
    if (listEl) listEl.innerHTML = `<p class="muted small">Loading services…</p>`;
    try {
      state.services = await window.SG.listBoostServices(false);
      state.loaded.services = true;
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="alert show alert-error">Service catalogue could not be loaded.</div>`;
      return;
    }
    renderServices();
  }

  function renderServices() {
    const listEl = $("[data-service-list]");
    if (!listEl) return;

    if (!state.services.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon">✨</div>
        <h3>No boosting services yet</h3>
        <p>Import the starter catalogue of boost services with naira rates per 1,000, then adjust rates, limits and priorities.</p>
        <button class="btn btn-gold mt-2" data-seed-services>Import starter catalogue</button>
      </div>`;
      return;
    }

    const ranks = window.SG.PRIORITIES || [];
    listEl.innerHTML = state.services
      .map(
        (s) => `
      <div class="service-row ${s.active === false ? "paused" : ""}">
        <div class="sr-main">
          <div class="sr-name">${esc(s.name)} ${s.type ? `<span class="chip chip-soft">${esc(s.type)}</span>` : ""} ${s.active === false ? '<span class="chip chip-soft">Paused</span>' : ""}</div>
          <div class="sr-meta">
            <span>${esc(s.platform || "—")}</span><span class="dot-sep"></span>
            <span>${esc(s.category || "—")}</span><span class="dot-sep"></span>
            <span>${money(window.SG.rateOf(s))} / 1,000 ${esc(s.unit || "units")}</span><span class="dot-sep"></span>
            <span>min ${Number(window.SG.serviceMin(s)).toLocaleString("en-US")} · max ${Number(window.SG.serviceMax(s)).toLocaleString("en-US")}</span><span class="dot-sep"></span>
            <span>⏱ ${esc(s.turnaround || "—")}</span>
          </div>
        </div>
        <label class="priority-select">
          <span>Processing priority</span>
          <select data-service-priority data-id="${esc(s.id)}">
            ${ranks
              .map(
                (p) =>
                  `<option value="${p.key}" ${s.priority === p.key ? "selected" : ""}>${p.label}</option>`
              )
              .join("")}
          </select>
        </label>
        <div class="sr-actions">
          <button class="btn btn-ghost btn-sm" data-service-toggle data-id="${esc(s.id)}">${s.active === false ? "Activate" : "Pause"}</button>
          <button class="btn btn-ghost btn-sm" data-service-edit data-id="${esc(s.id)}">Edit</button>
          <button class="btn btn-danger btn-sm" data-service-delete data-id="${esc(s.id)}">Delete</button>
        </div>
      </div>`
      )
      .join("");
  }

  function initServiceAdmin() {
    const listEl = $("[data-service-list]");
    const form = $("[data-service-form]");

    if (listEl) {
      listEl.addEventListener("change", async (e) => {
        const sel = e.target.closest("[data-service-priority]");
        if (!sel) return;
        try {
          await window.SG.adminSaveService(sel.dataset.id, { ...findService(sel.dataset.id), priority: sel.value });
          const svc = state.services.find((s) => String(s.id) === sel.dataset.id);
          if (svc) svc.priority = sel.value;
          toast("Service priority updated — new orders will queue accordingly.");
          loadServices();
        } catch (err) {
          toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Could not save.", "error");
        }
      });

      listEl.addEventListener("click", async (e) => {
        const seed = e.target.closest("[data-seed-services]");
        const toggle = e.target.closest("[data-service-toggle]");
        const edit = e.target.closest("[data-service-edit]");
        const del = e.target.closest("[data-service-delete]");

        if (seed) {
          if (!confirm("Import the starter boost catalogue with its naira rates?")) return;
          try {
            const n = await window.SG.adminSeedServices();
            toast(`${n} services imported.`);
            loadServices();
          } catch (err) {
            toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Import failed.", "error");
          }
          return;
        }

        if (toggle) {
          const svc = findService(toggle.dataset.id);
          if (!svc) return;
          try {
            await window.SG.adminSaveService(svc.id, { ...svc, active: svc.active === false });
            toast(svc.active === false ? "Service activated." : "Service paused.");
            loadServices();
          } catch (err) {
            toast("Could not update the service.", "error");
          }
          return;
        }

        if (edit) {
          const svc = findService(edit.dataset.id);
          if (!svc || !form) return;
          state.editingServiceId = svc.id;
          form.classList.remove("hide");
          $("[data-service-form-title]").textContent = "Edit service";
          Object.entries({
            name: svc.name, platform: svc.platform, category: svc.category, unit: svc.unit,
            ratePer1000: window.SG.rateOf(svc), priceFrom: window.SG.rateOf(svc),
            min: window.SG.serviceMin(svc), max: window.SG.serviceMax(svc),
            type: svc.type, turnaround: svc.turnaround, priority: svc.priority,
            description: svc.description
          }).forEach(([k, v]) => {
            const field = $(`[name="${k}"]`, form);
            if (field) field.value = v == null ? "" : v;
          });
          const active = $('[name="active"]', form);
          if (active) active.checked = svc.active !== false;
          form.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        if (del) {
          const svc = findService(del.dataset.id);
          if (!svc) return;
          if (!confirm(`Delete "${svc.name}"? Existing orders keep their history.`)) return;
          try {
            if (String(svc.id).startsWith("default-")) {
              toast("That item is part of the starter catalogue — import the catalogue first, then delete.", "error");
              return;
            }
            await window.SG.adminDeleteService(svc.id);
            toast("Service deleted.");
            loadServices();
          } catch (err) {
            toast("Could not delete the service.", "error");
          }
        }
      });
    }

    if (form) {
      $("[data-service-cancel]", form)?.addEventListener("click", () => resetServiceForm());

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const btn = $('button[type="submit"]', form);
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          const rate = Number(data.ratePer1000) || 0;
          await window.SG.adminSaveService(state.editingServiceId, {
            ...data,
            ratePer1000: rate,
            priceFrom: rate,
            min: Math.max(1, parseInt(data.min, 10) || 1),
            max: Math.max(1, parseInt(data.max, 10) || 1000000),
            type: (data.type || "").trim(),
            active: data.active === "on"
          });
          toast(state.editingServiceId ? "Service updated." : "Service added.");
          resetServiceForm();
          loadServices();
        } catch (err) {
          toast((window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Could not save the service.", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    }
  }

  function findService(id) {
    return state.services.find((s) => String(s.id) === String(id));
  }

  function resetServiceForm() {
    const form = $("[data-service-form]");
    if (!form) return;
    form.reset();
    state.editingServiceId = null;
    form.classList.add("hide");
    const title = $("[data-service-form-title]");
    if (title) title.textContent = "Add a boosting service";
  }

  function initAddServiceButton() {
    const btn = $("[data-service-add]");
    const form = $("[data-service-form]");
    if (!btn || !form) return;
    btn.addEventListener("click", () => {
      resetServiceForm();
      form.classList.remove("hide");
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Leads + subscribers                                                 */
  /* ------------------------------------------------------------------ */
  async function loadLeads() {
    const el = $("[data-admin-leads]");
    if (el) el.innerHTML = `<p class="muted small">Loading leads…</p>`;
    try {
      state.leads = await window.SG.adminListLeads();
      state.loaded.leads = true;
    } catch (err) {
      if (el) el.innerHTML = `<div class="alert show alert-error">${
        (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Leads could not be loaded."
      }</div>`;
      return;
    }
    renderLeads();
  }

  function renderLeads() {
    const el = $("[data-admin-leads]");
    if (!el) return;
    if (!state.leads.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>No leads yet</h3><p>Briefs submitted through the contact form will appear here.</p></div>`;
      return;
    }
    el.innerHTML = state.leads
      .map(
        (l) => `
      <div class="lead-row">
        <div class="lead-top">
          <strong>${esc(l.name || "—")}</strong>
          <span class="muted small">${esc(l.email || "")}${l.phone ? " · " + esc(l.phone) : ""}</span>
          <span class="task-when">${dateStr(l.createdAt)}</span>
        </div>
        <div class="lead-tags">
          ${l.company ? `<span class="chip chip-soft">${esc(l.company)}</span>` : ""}
          ${l.service ? `<span class="chip">${esc(l.service)}</span>` : ""}
          ${l.budget ? `<span class="chip chip-soft">${esc(l.budget)}</span>` : ""}
        </div>
        <p class="lead-msg">${esc(l.message || "")}</p>
        <div class="lead-actions">
          <a class="btn btn-ghost btn-sm" href="mailto:${esc(l.email)}?subject=Re:%20your%20Sonicgids%20Empire%20enquiry">Reply by email</a>
          ${l.phone ? `<a class="btn btn-ghost btn-sm" href="https://wa.me/${esc(String(l.phone).replace(/[^\d]/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        </div>
      </div>`
      )
      .join("");
  }

  async function loadSubscribers() {
    const el = $("[data-admin-subscribers]");
    if (el) el.innerHTML = `<p class="muted small">Loading subscribers…</p>`;
    try {
      state.subscribers = await window.SG.adminListSubscribers();
      state.loaded.subscribers = true;
    } catch (err) {
      if (el) el.innerHTML = `<div class="alert show alert-error">${
        (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) || "Subscribers could not be loaded."
      }</div>`;
      return;
    }
    renderSubscribers();
  }

  function renderSubscribers() {
    const el = $("[data-admin-subscribers]");
    if (!el) return;
    if (!state.subscribers.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">✉️</div><h3>No subscribers yet</h3><p>Newsletter sign-ups from the footer and blog will appear here.</p></div>`;
      return;
    }
    el.innerHTML = `
      <div class="subs-head">
        <strong>${state.subscribers.length}</strong> subscriber${state.subscribers.length === 1 ? "" : "s"}
        <button class="btn btn-ghost btn-sm" data-copy-subs>Copy all emails</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Source page</th><th>Joined</th></tr></thead>
          <tbody>
            ${state.subscribers
              .map(
                (s) => `<tr><td>${esc(s.email)}</td><td class="muted">${esc(s.page || "—")}</td><td class="muted">${dateStr(s.createdAt)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    $("[data-copy-subs]")?.addEventListener("click", async (e) => {
      const emails = state.subscribers.map((s) => s.email).filter(Boolean).join(", ");
      try {
        await navigator.clipboard.writeText(emails);
        toast("Subscriber emails copied.");
      } catch (err) {
        toast("Copy failed — select the table manually.", "error");
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Gate / access                                                       */
  /* ------------------------------------------------------------------ */
  function showGate(mode) {
    if ($gate()) $gate().classList.remove("hide");
    if ($panel()) $panel().classList.add("hide");
    if ($signinWrap()) $signinWrap().classList.toggle("hide", mode !== "signed-out");
    if ($noAccess()) $noAccess().classList.toggle("hide", mode !== "not-admin");
  }

  /* Names the account the browser is holding, so signing in with the wrong
     Google profile is obvious at a glance instead of looking like a broken
     console. */
  function renderIdentity(user) {
    const wrap = $identity();
    if (!wrap) return;
    const emailEl = $("[data-admin-signed-in]");
    const initial = $("[data-admin-initial]");
    if (!user || !user.email) return wrap.classList.add("hide");
    wrap.classList.remove("hide");
    if (emailEl) emailEl.textContent = user.email;
    if (initial) initial.textContent = user.email.trim().charAt(0).toUpperCase();
  }

  function showPanel(user) {
    if ($gate()) $gate().classList.add("hide");
    if ($panel()) $panel().classList.remove("hide");
    renderIdentity(user);
    const emailEl = $("[data-admin-email]");
    if (emailEl) emailEl.textContent = user.email || "";
    const verify = $("[data-admin-verify]");
    if (verify) {
      const needsVerify = !user.emailVerified && !window.SG.signedInWithGoogle(user);
      verify.classList.toggle("hide", !needsVerify);
    }
    loadOverview();
    loadOrders();
  }

  function evaluateAccess(user) {
    if (!user) {
      renderIdentity(null);
      return showGate("signed-out");
    }
    renderIdentity(user);
    const status = window.SG.adminStatus
      ? window.SG.adminStatus(user)
      : (window.SG.isAdminUser(user) ? "owner" : "not-admin");

    if (status === "owner") return showPanel(user);
    return showGate("not-admin");
  }

  function initGate() {
    const googleBtn = $("[data-admin-google]");
    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        const alertEl = $("[data-admin-gate-alert]");
        googleBtn.disabled = true;
        const original = googleBtn.textContent;
        googleBtn.textContent = "Opening Google…";
        try {
          const user = await window.SG.signInWithGoogle();
          await evaluateAccess(user);
        } catch (err) {
          if (alertEl) {
            alertEl.className = "alert show alert-error";
            alertEl.textContent =
              (window.SG.friendlyError && window.SG.friendlyError(err)) ||
              "Google sign-in failed. Use the email form below instead.";
          }
        } finally {
          googleBtn.disabled = false;
          googleBtn.textContent = original;
        }
      });
    }

    const verifyBtn = $("[data-admin-send-verify]");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", async () => {
        const original = verifyBtn.textContent;
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Sending…";
        try {
          await window.SG.sendVerificationEmail();
          toast("Verification email sent. You can keep using the admin console while you verify the address.");
          verifyBtn.textContent = "Email sent — check your inbox";
          return;
        } catch (err) {
          toast("Could not send the verification email. Try again in a minute.", "error");
        }
        verifyBtn.disabled = false;
        verifyBtn.textContent = original;
      });
    }

    const refresh = $("[data-admin-refresh]");
    if (refresh) {
      refresh.addEventListener("click", async () => {
        state.loaded = { orders: false, services: false, leads: false, subscribers: false, walletTopups: false };
        toast("Refreshing…");
        await loadOrders();
        await loadServices();
        await loadWalletTopups();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function boot() {
    initTabs();
    initOrderFilters();
    initOrderActions();
    initWalletTopups();
    initServiceAdmin();
    initAddServiceButton();
    initGate();

    window.SGOnReady(() => {
      /* Keep the address list shown on the gate in step with the allowlist. */
      const hint = document.getElementById("adminEmailHint");
      if (hint && window.SG.ADMIN_EMAILS) {
        const emails = window.SG.ADMIN_EMAILS;
        hint.textContent = emails.length > 2
          ? emails.slice(0, -1).join(", ") + " and " + emails[emails.length - 1]
          : emails.join(" and ");
      }
      window.SG.onUser((user) => { evaluateAccess(user); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
