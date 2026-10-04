/* ==========================================================================
   SONICGIOS EMPIRE — Orders (client side)
   • order.html  : the SMM-style boost panel lives in assets/js/panel.js
   • this file   : shared order renderers + the dashboard order list
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

  /* All money on this site is Nigerian Naira, formatted by the shared helper. */
  const money = (n) =>
    window.SG && SG.money ? SG.money(n) : "\u20A6" + (Number(n) || 0).toLocaleString("en-NG");

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
        <div><span class="of-label">Amount</span><strong>${money(o.amount)}</strong></div>
        ${o.ratePer1000 ? `<div><span class="of-label">Rate</span><strong>${money(o.ratePer1000)} / 1,000</strong></div>` : ""}
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
          <a class="btn btn-gold mt-2" href="order.html">Open the boost panel</a>
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
  /* Dashboard order list                                                */
  /* ------------------------------------------------------------------ */
  function initDashboardOrders() {
    const container = $("[data-dashboard-orders]");
    if (!container) return;

    async function load() {
      if (!window.SG.currentUser) return;
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
    }

    const preview = new URLSearchParams(location.search).get("preview") === "1";

    window.SGOnReady(() => {
      window.SG.onUser((user) => {
        if (!user) {
          /* Layout preview — show the real empty state instead of "loading". */
          if (preview) renderList(container, []);
          return;
        }
        load();
      });
    });

    /* Fired by the boost panel (via auth.js) right after an order is placed. */
    document.addEventListener("sg:refresh-orders", () => setTimeout(load, 600));
  }

  function boot() {
    initDashboardOrders();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
