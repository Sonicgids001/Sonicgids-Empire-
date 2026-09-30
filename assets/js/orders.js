/* ==========================================================================
   SONICGIOS EMPIRE — Orders (client side)
   • order.html  : boost-service catalogue + order form (saved as "pending")
   • dashboard   : the signed-in client's order list with live status
   Shared status helpers are exposed on window.SGOrders for reuse.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const STATUS = {
    pending: { label: "Pending review", cls: "status-pending", step: 0, icon: "⏳" },
    approved: { label: "Approved", cls: "status-approved", step: 1, icon: "✅" },
    ongoing: { label: "In progress", cls: "status-ongoing", step: 2, icon: "⚙️" },
    completed: { label: "Completed", cls: "status-completed", step: 3, icon: "🏁" },
    rejected: { label: "Rejected", cls: "status-rejected", step: -1, icon: "⛔" }
  };

  const money = (n) =>
    "$" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

  const dateStr = (value) => {
    if (!value) return "—";
    const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const esc = (str) =>
    String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /* ------------------------------------------------------------------ */
  /* Shared renderers                                                    */
  /* ------------------------------------------------------------------ */
  function statusBadge(status) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="status-badge ${s.cls}"><span class="sb-dot"></span>${s.label}</span>`;
  }

  function priorityPill(priority) {
    const key = priority || "normal";
    const label = (window.SG && SG.priorityLabel && SG.priorityLabel(key)) || key;
    return `<span class="priority-pill priority-${key}">${label} priority</span>`;
  }

  function statusTrack(status) {
    if (status === "rejected") {
      return `<div class="status-track rejected">
        <span class="st-step done">Submitted</span>
        <span class="st-step current">Rejected</span>
      </div>`;
    }
    const step = (STATUS[status] || STATUS.pending).step;
    const labels = ["Submitted", "Approved", "In progress", "Completed"];
    return `<div class="status-track">
      ${labels
        .map((l, i) => {
          const cls = i < step ? "done" : i === step ? "current" : "";
          return `<span class="st-step ${cls}">${l}</span>`;
        })
        .join("")}
    </div>`;
  }

  function orderCard(o, opts) {
    const admin = opts && opts.admin;
    return `
    <article class="order-card ${admin ? "order-card-admin" : ""}" data-order-id="${o.id}">
      <div class="order-head">
        <div>
          <div class="order-ref">${esc(o.ref || "—")}</div>
          <h3>${esc(o.serviceName || "Boost service")}</h3>
          <div class="order-meta">
            <span>${esc(o.platform || "—")}</span>
            <span class="dot-sep"></span>
            <span>${esc(o.packageLabel || "Standard package")}</span>
            <span class="dot-sep"></span>
            <span>${esc(o.quantity || "1")} × ${esc(o.unit || "unit")}</span>
          </div>
        </div>
        <div class="order-flags">
          ${statusBadge(o.status)}
          ${priorityPill(o.priority)}
        </div>
      </div>

      <div class="order-facts">
        <div><span class="of-label">Estimated value</span><strong>${money(o.amount)}</strong></div>
        <div><span class="of-label">Placed</span><strong>${dateStr(o.createdAt)}</strong></div>
        <div><span class="of-label">Target</span><strong class="of-link">${esc(o.targetLink || "—")}</strong></div>
        ${admin ? `<div><span class="of-label">Client</span><strong>${esc(o.contactName || "—")}${o.contactPhone ? " · " + esc(o.contactPhone) : ""}</strong></div>` : ""}
        ${admin ? `<div><span class="of-label">Account</span><strong>${esc(o.email || "—")}</strong></div>` : ""}
      </div>

      ${o.notes ? `<p class="order-notes"><strong>Client notes:</strong> ${esc(o.notes)}</p>` : ""}
      ${o.adminNote ? `<p class="order-notes admin-note"><strong>Admin note:</strong> ${esc(o.adminNote)}</p>` : ""}

      ${admin ? "" : statusTrack(o.status)}

      ${admin ? `<div class="order-actions" data-order-actions></div>` : ""}
    </article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Client status board (dashboard)                                     */
  /* ------------------------------------------------------------------ */
  function renderList(container, orders) {
    if (!container) return;
    if (!orders || !orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Place your first boost order and track it here — from pending review through to completed.</p>
          <a class="btn btn-gold mt-2" href="order.html">Browse boost services</a>
        </div>`;
      return;
    }
    container.innerHTML = orders.map((o) => orderCard(o)).join("");
  }

  function summarise(orders) {
    const counts = { total: orders.length, pending: 0, approved: 0, ongoing: 0, completed: 0, rejected: 0 };
    orders.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status]++; });
    counts.value = orders
      .filter((o) => o.status === "approved" || o.status === "ongoing" || o.status === "completed")
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    return counts;
  }

  window.SGOrders = {
    STATUS, statusBadge, priorityPill, statusTrack, orderCard, renderList, summarise, money, dateStr, esc
  };

  /* ------------------------------------------------------------------ */
  /* Order form page                                                     */
  /* ------------------------------------------------------------------ */
  function initOrderPage() {
    const form = $("[data-order-form]");
    if (!form) return;

    const grid = $("[data-order-service-grid]");
    const alertEl = $("[data-order-alert]");
    const gate = $("[data-order-gate]");
    const panel = $("[data-order-panel]");
    const success = $("[data-order-success]");
    const summary = $("[data-order-summary]");
    const submit = $('button[type="submit"]', form);

    let services = [];
    let selected = null;

    const setAlert = (msg, type) => {
      if (!alertEl) return;
      alertEl.className = "alert show alert-" + (type || "error");
      alertEl.textContent = msg;
      alertEl.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const clearAlert = () => { if (alertEl) alertEl.className = "alert"; };

    function renderServices() {
      if (!grid) return;
      grid.innerHTML = services
        .map(
          (s, i) => `
        <button type="button" class="service-pick reveal" data-service-id="${esc(s.id)}" data-index="${i}">
          <span class="sp-top">
            <span class="sp-platform">${esc(s.platform || s.category || "Boost")}</span>
            ${s.priority === "urgent" || s.priority === "high"
              ? '<span class="sp-fast">Priority queue</span>'
              : ""}
          </span>
          <span class="sp-name">${esc(s.name)}</span>
          <span class="sp-desc">${esc(s.description || "")}</span>
          <span class="sp-foot">
            <span class="sp-price">from ${money(s.priceFrom)}</span>
            <span class="sp-unit">${esc(s.unit || "")}</span>
          </span>
          <span class="sp-time">⏱ ${esc(s.turnaround || "Turnaround on request")}</span>
        </button>`
        )
        .join("");
    }

    function selectService(id) {
      selected = services.find((s) => String(s.id) === String(id)) || null;
      $$(".service-pick", grid).forEach((el) =>
        el.classList.toggle("selected", el.dataset.serviceId === String(id))
      );
      updateSummary();
    }

    function updateSummary() {
      if (!summary) return;
      if (!selected) {
        summary.innerHTML = `<p class="muted small">Choose a boost service to see your order summary.</p>`;
        return;
      }
      const qty = Math.max(1, parseInt($('input[name="quantity"]', form).value, 10) || 1);
      const total = (Number(selected.priceFrom) || 0) * qty;
      summary.innerHTML = `
        <div class="summary-row"><span>Service</span><strong>${esc(selected.name)}</strong></div>
        <div class="summary-row"><span>Platform</span><strong>${esc(selected.platform || "—")}</strong></div>
        <div class="summary-row"><span>Package</span><strong>${esc($('select[name="packageLabel"]', form).value)}</strong></div>
        <div class="summary-row"><span>Volume</span><strong>${qty.toLocaleString("en-US")} × ${esc(selected.unit || "unit")}</strong></div>
        <div class="summary-row total"><span>Estimated total</span><strong>${money(total)}</strong></div>
        <p class="small muted mt-1">Processing priority is set by our team when the order is reviewed. Final pricing is confirmed on approval.</p>`;
    }

    if (grid) {
      grid.addEventListener("click", (e) => {
        const btn = e.target.closest(".service-pick");
        if (btn) {
          selectService(btn.dataset.serviceId);
          const details = $("[data-order-details]");
          if (details) details.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    form.addEventListener("input", (e) => {
      if (e.target.name === "quantity" || e.target.name === "packageLabel") updateSummary();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      if (!selected) return setAlert("Please choose a boost service first.", "error");

      const data = Object.fromEntries(new FormData(form).entries());
      const targetLink = (data.targetLink || "").trim();
      const contactName = (data.contactName || "").trim();
      const quantity = Math.max(1, parseInt(data.quantity, 10) || 1);

      if (contactName.length < 2) return setAlert("Please add the name we should contact.", "error");
      if (!/^[\d+\s()-]{7,20}$/.test((data.contactPhone || "").trim()))
        return setAlert("Please add a phone or WhatsApp number we can reach you on.", "error");
      if (targetLink.length < 4) return setAlert("Add the link or @handle we should boost.", "error");
      if (data.agree !== "on") return setAlert("Please confirm the order terms to continue.", "error");

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Placing your order…";

      try {
        const res = await window.SG.createOrder({
          serviceId: selected.id,
          serviceName: selected.name,
          platform: selected.platform,
          category: selected.category,
          unit: selected.unit,
          priority: selected.priority || "normal",
          packageLabel: data.packageLabel || "Standard package",
          quantity: quantity + " × " + (selected.unit || "unit"),
          amount: (Number(selected.priceFrom) || 0) * quantity,
          targetLink,
          contactName,
          contactPhone: data.contactPhone,
          brand: data.brand || "",
          notes: data.notes || ""
        });

        form.classList.add("hide");
        if (summary && summary.closest(".order-summary-card")) {
          summary.closest(".order-summary-card").classList.add("hide");
        }
        if (success) {
          success.classList.remove("hide");
          const refEl = $("[data-order-ref]", success);
          if (refEl) refEl.textContent = res.ref;
          success.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        window.sgToast && window.sgToast("Order placed — status: pending review.");
      } catch (err) {
        const msg =
          (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
          (err && err.message) || "We couldn't place your order. Please try again.";
        setAlert(msg, "error");
        submit.disabled = false;
        submit.textContent = original;
      }
    });

    window.SGOnReady(() => {
      window.SG.onUser(async (user) => {
        if (!user) {
          if (gate) gate.classList.remove("hide");
          if (panel) panel.classList.add("hide");
          return;
        }
        if (gate) gate.classList.add("hide");
        if (panel) panel.classList.remove("hide");

        const nameField = $('input[name="contactName"]', form);
        if (nameField && !nameField.value) {
          nameField.value = user.displayName || (user.email || "").split("@")[0];
        }

        try {
          services = await window.SG.listBoostServices(true);
          renderServices();
          if (services.length) {
            const wanted = new URLSearchParams(location.search).get("service");
            const match = wanted
              ? services.find((s) => s.name.toLowerCase() === wanted.toLowerCase())
              : null;
            selectService(match ? match.id : services[0].id);
          }
        } catch (err) {
          setAlert("Boost services could not be loaded. Please refresh the page.", "error");
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard order list                                                */
  /* ------------------------------------------------------------------ */
  function initDashboardOrders() {
    const container = $("[data-dashboard-orders]");
    if (!container) return;

    window.SGOnReady(() => {
      window.SG.onUser(async (user) => {
        if (!user) return;
        try {
          const orders = await window.SG.myOrders();
          renderList(container, orders);
          const s = summarise(orders);
          $$("[data-order-stat]").forEach((el) => {
            const key = el.dataset.orderStat;
            el.textContent = key === "value" ? money(s.value) : String(s[key] || 0);
          });
        } catch (err) {
          container.innerHTML = `<div class="alert show alert-error">${
            (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
            "Orders could not be loaded right now."
          }</div>`;
        }
      });
    });
  }

  function boot() {
    initOrderPage();
    initDashboardOrders();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
