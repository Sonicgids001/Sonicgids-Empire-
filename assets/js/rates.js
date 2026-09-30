/* ==========================================================================
   SONICGIOS EMPIRE — Public rate card
   • pricing.html : full searchable naira rate table ([data-rate-table])
   • index.html   : six-service teaser grid ([data-rate-teaser])
   Read-only — no sign-in needed. Ordering happens on order.html / dashboard.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);

  const esc = (str) =>
    String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const num = (n) => (Number(n) || 0).toLocaleString("en-US");
  const money = (n) => (window.SG && SG.money ? SG.money(n) : "\u20A6" + num(n));

  const ICON = {
    Instagram: "📸", TikTok: "🎵", YouTube: "▶️", Facebook: "👍",
    "X (Twitter)": "🐦", Telegram: "✈️", WhatsApp: "💬", Music: "🎧",
    Web: "🌐", "Multi-platform": "✨"
  };

  let services = [];
  let category = "";
  let search = "";

  function visible() {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (category && s.category !== category) return false;
      if (!q) return true;
      return (
        String(s.name).toLowerCase().indexOf(q) > -1 ||
        String(s.platform || "").toLowerCase().indexOf(q) > -1 ||
        String(s.category || "").toLowerCase().indexOf(q) > -1 ||
        String(s.type || "").toLowerCase().indexOf(q) > -1
      );
    });
  }

  function renderCategories() {
    const sel = $("[data-rate-category]");
    if (!sel) return;
    const cats = [];
    services.forEach((s) => {
      const c = s.category || "Other";
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    cats.sort();
    sel.innerHTML =
      '<option value="">— All categories —</option>' +
      cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  }

  function render() {
    const wrap = $("[data-rate-table]");
    const countEl = $("[data-rate-count]");
    if (!wrap) return;

    const items = visible();
    if (countEl) {
      countEl.textContent = items.length
        ? items.length + " service" + (items.length === 1 ? "" : "s") + " listed · rates in naira per 1,000"
        : "No service matches that search.";
    }

    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔎</div>
        <h3>Nothing found</h3>
        <p>Try a different keyword, or clear the category filter. Need a service we don't list? Message us on WhatsApp.</p></div>`;
      return;
    }

    const rows = items
      .map((s, i) => {
        const rate = window.SG.rateOf(s);
        const min = window.SG.serviceMin(s);
        const max = window.SG.serviceMax(s);
        const paused = s.active === false;
        const icon = ICON[s.platform] || ICON[s.category] || "🚀";
        const buy = paused
          ? '<span class="rt-chip rt-chip-paused">Paused</span>'
          : `<a class="btn btn-ghost btn-sm" href="login.html?next=${encodeURIComponent(
              "order.html?service=" + encodeURIComponent(s.name)
            )}">Order</a>`;
        return `<tr>
          <td class="rt-id">${String(i + 1).padStart(2, "0")}</td>
          <td>
            <span class="rt-name">${icon} ${esc(s.name)}</span>
            <span class="rt-sub">${esc(s.description || "")}</span>
          </td>
          <td><span class="rt-chip">${esc(s.platform || "—")}</span></td>
          <td>${s.type ? `<span class="rt-chip rt-chip-gold">${esc(s.type)}</span>` : '<span class="rt-chip">Standard</span>'}</td>
          <td class="rt-rate">${money(rate)}</td>
          <td class="rt-num">${num(min)}</td>
          <td class="rt-num">${num(max)}</td>
          <td class="rt-num">${esc(s.turnaround || "—")}</td>
          <td class="rt-buy">${buy}</td>
        </tr>`;
      })
      .join("");

    wrap.innerHTML = `<table class="rate-table">
      <thead>
        <tr>
          <th>ID</th><th>Service</th><th>Platform</th><th>Quality / Type</th>
          <th>Rate per 1,000</th><th>Min</th><th>Max</th><th>Start time</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }


  /* ------------------------------------------------------------------ */
  /* Homepage teaser — six services with their live rate per 1,000       */
  /* ------------------------------------------------------------------ */
  function renderTeaser() {
    const grid = $("[data-rate-teaser]");
    if (!grid) return;

    const items = services
      .filter((s) => s.active !== false)
      .sort((a, b) => {
        const rank = (x) => (window.SG.priorityRank ? window.SG.priorityRank(x.priority) : 3);
        return rank(a) - rank(b);
      })
      .slice(0, 6);

    if (!items.length) {
      grid.innerHTML = `<p class="muted small">The rate card is being updated. <a href="pricing.html">Open the full list</a>.</p>`;
      return;
    }

    grid.innerHTML = items
      .map((s) => {
        const icon = ICON[s.platform] || ICON[s.category] || "🚀";
        const min = window.SG.serviceMin(s);
        const max = window.SG.serviceMax(s);
        return `<a class="rate-teaser-card" href="pricing.html">
          <span class="rtc-top">
            <span class="rtc-icon">${icon}</span>
            <span class="rtc-platform">${esc(s.platform || s.category || "Boost")}</span>
          </span>
          <span class="rtc-name">${esc(s.name)}</span>
          <span class="rtc-rate">${money(window.SG.rateOf(s))}<em>per 1,000 ${esc(s.unit || "units")}</em></span>
          <span class="rtc-foot">min ${num(min)} · max ${num(max)} · ${esc(s.turnaround || "start on request")}</span>
        </a>`;
      })
      .join("");
  }

  function bind() {
    const searchEl = $("[data-rate-search]");
    const catEl = $("[data-rate-category]");
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        search = searchEl.value;
        render();
      });
    }
    if (catEl) {
      catEl.addEventListener("change", () => {
        category = catEl.value;
        render();
      });
    }
  }

  function boot() {
    const hasTable = !!$("[data-rate-table]");
    const hasTeaser = !!$("[data-rate-teaser]");
    if (!hasTable && !hasTeaser) return;
    if (hasTable) bind();

    window.SGOnReady(async () => {
      try {
        /* Public page: show every service, including paused ones (marked). */
        services = await window.SG.listBoostServices(false);
      } catch (err) {
        if (hasTable) {
          $("[data-rate-table]").innerHTML =
            '<div class="alert show alert-error">Rates could not be loaded right now. Please refresh the page.</div>';
        }
        if (hasTeaser) $("[data-rate-teaser]").innerHTML = "";
        return;
      }
      if (hasTeaser) renderTeaser();
      if (!hasTable) return;
      renderCategories();

      /* Deep link: pricing.html?cat=TikTok */
      const wantedCat = new URLSearchParams(location.search).get("cat");
      if (wantedCat && catValueExists(wantedCat)) {
        category = wantedCat;
        const catEl = $("[data-rate-category]");
        if (catEl) catEl.value = wantedCat;
      }
      render();
    });
  }

  function catValueExists(value) {
    return services.some((s) => (s.category || "Other") === value);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
