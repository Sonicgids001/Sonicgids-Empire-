/* ==========================================================================
   SONICGIOS EMPIRE — Boost panel (SMM style buy page)
   --------------------------------------------------------------------------
   Renders the "buy a boost" panel into any element marked [data-boost-panel].
   Used on order.html (full page) and inside dashboard.html (Boost tab).

   Flow, exactly like an SMM panel buy page:
     1. Search plans / pick a category / pick a service (rates per 1,000)
     2. Read the service description, min & max and start time
     3. Paste the link, enter the quantity, watch the amount (₦) calculate
     4. Continue → the order is saved with status "pending" for the admin

   All rates come from the admin-managed boostServices collection
   (assets/js/firebase.js → SG.rateOf / SG.orderTotal / SG.money).
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const money = (n) => (window.SG && SG.money ? SG.money(n) : "\u20A6" + (Number(n) || 0));
  const esc = (str) =>
    String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const PLATFORM_ICON = {
    instagram: "📸",
    tiktok: "🎵",
    youtube: "▶️",
    facebook: "👍",
    x: "🐦",
    twitter: "🐦",
    telegram: "✈️",
    whatsapp: "💬",
    music: "🎧",
    web: "🌐",
    "multi-platform": "✨"
  };

  function iconFor(service) {
    const key = String(service.platform || service.category || "").toLowerCase();
    const hit = Object.keys(PLATFORM_ICON).find((k) => key.indexOf(k) === 0 || key.indexOf(k) > -1);
    return hit ? PLATFORM_ICON[hit] : "🚀";
  }

  function rateLabel(service) {
    return money(window.SG.rateOf(service)) + " / 1,000";
  }

  /* ------------------------------------------------------------------ */
  /* Panel markup                                                        */
  /* ------------------------------------------------------------------ */
  const PANEL_HTML = `
  <div class="bp" data-bp-root>

    <div class="bp-alert" data-bp-alert role="alert"></div>

    <div class="bp-success hide" data-bp-success>
      <div class="bp-success-inner">
        <div class="bp-success-mark">✓</div>
        <h3>Order placed</h3>
        <p>Reference <strong data-bp-ref>—</strong>. Status: <strong>pending</strong> — your wallet was charged. Rejected orders are refunded to your wallet.</p>
        <div class="bp-success-actions">
          <button class="btn btn-gold" type="button" data-bp-again>Place another order</button>
          <a class="btn btn-ghost" href="dashboard.html?tab=orders">Track my orders</a>
        </div>
      </div>
    </div>

    <div class="bp-body" data-bp-body>
      <div class="bp-selectors">
        <div class="bp-field">
          <label for="bp-search">Search plans</label>
          <input id="bp-search" type="search" data-bp-search placeholder="Search services, platforms or categories…" autocomplete="off">
        </div>

        <div class="bp-field">
          <label for="bp-category">Category</label>
          <select id="bp-category" data-bp-category>
            <option value="">— All categories —</option>
          </select>
        </div>

        <div class="bp-field">
          <label for="bp-service">Service <span class="bp-req">*</span></label>
          <select id="bp-service" data-bp-service size="10" class="bp-service-list">
            <option value="">Loading services…</option>
          </select>
          <p class="bp-hint"><span data-bp-count>0</span> services listed · rates are per 1,000 and set by our team</p>
        </div>
      </div>

      <form class="bp-form" data-bp-form novalidate>
        <div class="bp-card" data-bp-details>
          <div class="bp-card-head">
            <span class="bp-icon" data-bp-icon>🚀</span>
            <div>
              <h3 data-bp-name>Pick a service</h3>
              <div class="bp-tags">
                <span class="bp-tag" data-bp-platform>—</span>
                <span class="bp-tag bp-tag-gold" data-bp-rate>₦0 / 1,000</span>
                <span class="bp-tag" data-bp-type>—</span>
              </div>
            </div>
          </div>
          <p class="bp-desc" data-bp-desc>Select a service from the list to see its description, minimum and maximum quantity.</p>
          <div class="bp-facts">
            <div><span>Rate per 1,000</span><strong data-bp-fact-rate>—</strong></div>
            <div><span>Min / Max</span><strong data-bp-fact-limits>—</strong></div>
            <div><span>Start time</span><strong data-bp-fact-time>—</strong></div>
            <div><span>Queue priority</span><strong data-bp-fact-priority>—</strong></div>
          </div>
        </div>

        <div class="bp-field">
          <label for="bp-link">Link <span class="bp-req">*</span></label>
          <input id="bp-link" name="targetLink" type="text" data-bp-link placeholder="https://instagram.com/yourpage" autocomplete="off">
          <p class="bp-hint" data-bp-link-hint>The exact post, profile, channel or URL to boost.</p>
        </div>

        <div class="bp-field">
          <label for="bp-qty">Quantity <span class="bp-req">*</span></label>
          <input id="bp-qty" name="quantity" type="number" data-bp-qty min="1" step="1" value="1000" inputmode="numeric" autocomplete="off">
          <div class="bp-quick" data-bp-quick>
            <button type="button" data-qty-set="min">Min</button>
            <button type="button" data-qty-mult="1">×1</button>
            <button type="button" data-qty-mult="5">×5</button>
            <button type="button" data-qty-mult="10">×10</button>
            <button type="button" data-qty-mult="50">×50</button>
            <button type="button" data-qty-set="max">Max</button>
          </div>
          <p class="bp-hint" data-bp-qty-hint>Min 1,000 · Max 1,000,000</p>
        </div>

        <div class="bp-field">
          <label for="bp-amount">Amount (₦)</label>
          <div class="bp-amount" data-bp-amount>₦0.00</div>
          <p class="bp-hint">Quantity ÷ 1,000 × rate. The amount is deducted from your wallet when you place the order. Rejected orders are refunded.</p>
        </div>

        <div class="bp-field bp-field-optional">
          <label for="bp-phone">WhatsApp number <span class="bp-opt">(optional)</span></label>
          <input id="bp-phone" name="contactPhone" type="tel" data-bp-phone placeholder="+234 700 000 0000" autocomplete="off">
        </div>

        <div class="bp-field bp-field-optional">
          <label for="bp-notes">Notes <span class="bp-opt">(optional)</span></label>
          <textarea id="bp-notes" name="notes" data-bp-notes placeholder="Custom comments, live stream start time, country targeting, referrer…" rows="3"></textarea>
        </div>

        <div class="bp-wallet-summary">Wallet balance: <strong data-bp-wallet-balance>Loading…</strong> <a href="dashboard.html">Add funds</a></div>
        <button class="btn btn-gold btn-block btn-lg" type="submit" data-bp-submit>Continue</button>
        <p class="bp-foot">The amount is deducted when you order. Rejected orders are refunded to your wallet.</p>
      </form>
    </div>
  </div>`;

  /* ------------------------------------------------------------------ */
  /* One panel instance                                                  */
  /* ------------------------------------------------------------------ */
  function BoostPanel(mount) {
    const $ = (sel) => mount.querySelector(sel);

    this.mount = mount;
    this.services = [];
    this.selected = null;
    this.user = null;
    this.category = "";
    this.search = "";

    mount.innerHTML = PANEL_HTML;

    this.el = {
      alert: $("[data-bp-alert]"),
      success: $("[data-bp-success]"),
      ref: $("[data-bp-ref]"),
      body: $("[data-bp-body]"),
      search: $("[data-bp-search]"),
      category: $("[data-bp-category]"),
      serviceList: $("[data-bp-service]"),
      count: $("[data-bp-count]"),
      form: $("[data-bp-form]"),
      icon: $("[data-bp-icon]"),
      name: $("[data-bp-name]"),
      platform: $("[data-bp-platform]"),
      rateTag: $("[data-bp-rate]"),
      typeTag: $("[data-bp-type]"),
      desc: $("[data-bp-desc]"),
      factRate: $("[data-bp-fact-rate]"),
      factLimits: $("[data-bp-fact-limits]"),
      factTime: $("[data-bp-fact-time]"),
      factPriority: $("[data-bp-fact-priority]"),
      link: $("[data-bp-link]"),
      linkHint: $("[data-bp-link-hint]"),
      qty: $("[data-bp-qty]"),
      qtyHint: $("[data-bp-qty-hint]"),
      quick: $("[data-bp-quick]"),
      amount: $("[data-bp-amount]"),
      phone: $("[data-bp-phone]"),
      notes: $("[data-bp-notes]"),
      submit: $("[data-bp-submit]")
    };

    this.bind();
  }

  BoostPanel.prototype.notify = function (msg, type) {
    const el = this.el.alert;
    if (!el) return;
    el.className = "bp-alert show bp-alert-" + (type || "error");
    el.textContent = msg;
  };

  BoostPanel.prototype.clearNotify = function () {
    if (this.el.alert) this.el.alert.className = "bp-alert";
  };

  /* ------------------------------------------------------------------ */
  /* Service list                                                        */
  /* ------------------------------------------------------------------ */
  BoostPanel.prototype.filtered = function () {
    const q = this.search.trim().toLowerCase();
    const cat = this.category;
    return this.services.filter((s) => {
      if (cat && s.category !== cat) return false;
      if (!q) return true;
      return (
        String(s.name || "").toLowerCase().indexOf(q) > -1 ||
        String(s.platform || "").toLowerCase().indexOf(q) > -1 ||
        String(s.category || "").toLowerCase().indexOf(q) > -1 ||
        String(s.type || "").toLowerCase().indexOf(q) > -1
      );
    });
  };

  BoostPanel.prototype.renderCategories = function () {
    const sel = this.el.category;
    if (!sel) return;
    const cats = [];
    this.services.forEach((s) => {
      const c = s.category || "Other";
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    cats.sort();
    sel.innerHTML =
      '<option value="">— All categories —</option>' +
      cats.map((c) => `<option value="${esc(c)}"${c === this.category ? " selected" : ""}>${esc(c)}</option>`).join("");
  };

  BoostPanel.prototype.renderServices = function () {
    const list = this.el.serviceList;
    if (!list) return;

    const items = this.filtered();
    this.el.count.textContent = String(items.length);

    if (!items.length) {
      list.innerHTML = '<option value="">No service matches that search</option>';
      return;
    }

    /* Group by platform inside the current category, like a panel buy page. */
    const groups = [];
    items.forEach((s) => {
      const key = s.platform || "Other";
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key: key, items: [] };
        groups.push(g);
      }
      g.items.push(s);
    });

    list.innerHTML = groups
      .map(
        (g) =>
          `<optgroup label="${esc(g.key)}">` +
          g.items
            .map(
              (s) =>
                `<option value="${esc(s.id)}"${
                  this.selected && String(this.selected.id) === String(s.id) ? " selected" : ""
                }>${iconFor(s)} ${esc(s.name)} — ${rateLabel(s)}</option>`
            )
            .join("") +
          `</optgroup>`
      )
      .join("");
  };

  BoostPanel.prototype.select = function (id) {
    const found = this.services.find((s) => String(s.id) === String(id));
    if (!found) return;
    this.selected = found;

    const min = window.SG.serviceMin(found);
    const max = window.SG.serviceMax(found);
    const rate = window.SG.rateOf(found);

    this.el.icon.textContent = iconFor(found);
    this.el.name.textContent = found.name;
    this.el.platform.textContent = found.platform || found.category || "Boost";
    this.el.rateTag.textContent = rateLabel(found);
    this.el.typeTag.textContent = found.type || "Standard quality";
    this.el.desc.textContent = found.description || "No description added for this service yet.";

    this.el.factRate.textContent = money(rate) + " per 1,000 " + (found.unit || "units");
    this.el.factLimits.textContent = min.toLocaleString("en-US") + " / " + max.toLocaleString("en-US");
    this.el.factTime.textContent = found.turnaround || "On request";
    this.el.factPriority.textContent =
      (window.SG.priorityLabel && window.SG.priorityLabel(found.priority)) || "Normal";

    this.el.qty.min = String(min);
    this.el.qty.max = String(max);
    this.el.qtyHint.textContent =
      "Min " + min.toLocaleString("en-US") + " · Max " + max.toLocaleString("en-US");
    this.el.linkHint.textContent = linkHintFor(found);

    const current = parseInt(this.el.qty.value, 10);
    if (isNaN(current) || current < min || current > max) {
      this.el.qty.value = String(min < 1000 ? min : Math.min(1000, max));
    }

    this.updateAmount();
    this.mount.classList.add("bp-ready");
  };

  function linkHintFor(service) {
    const key = String(service.platform || "").toLowerCase();
    if (key.indexOf("instagram") > -1) return "Post, reel or profile link — the account must be public.";
    if (key.indexOf("tiktok") > -1) return "Video share link or @username.";
    if (key.indexOf("youtube") > -1) return "Video or channel link.";
    if (key.indexOf("facebook") > -1) return "Public post or page link.";
    if (key.indexOf("x") > -1 || key.indexOf("twitter") > -1) return "Tweet link or profile URL.";
    if (key.indexOf("telegram") > -1) return "Public channel/post link, e.g. t.me/yourchannel.";
    if (key.indexOf("whatsapp") > -1) return "Channel invite link.";
    if (key.indexOf("web") > -1) return "Full URL including https://";
    if (key.indexOf("music") > -1) return "Track, album or playlist link.";
    return "The exact link to boost.";
  }

  BoostPanel.prototype.updateAmount = function () {
    const qty = Math.max(0, parseInt(this.el.qty.value, 10) || 0);
    const rate = this.selected ? window.SG.rateOf(this.selected) : 0;
    const total = window.SG.orderTotal(rate, qty);
    this.el.amount.textContent = money(total);
    this.el.amount.classList.toggle("bp-amount-live", total > 0);
  };

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  BoostPanel.prototype.bind = function () {
    const self = this;
    const el = this.el;

    el.search.addEventListener("input", function () {
      self.search = el.search.value;
      self.renderServices();
    });
    /* the search box sits outside the form, but guard Enter anyway */
    el.search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") e.preventDefault();
    });

    el.category.addEventListener("change", function () {
      self.category = el.category.value;
      self.renderServices();
    });

    el.serviceList.addEventListener("change", function () {
      self.clearNotify();
      self.select(el.serviceList.value);
    });
    /* size>1 lists also fire on click in some browsers */
    el.serviceList.addEventListener("click", function () {
      if (el.serviceList.value && (!self.selected || String(self.selected.id) !== el.serviceList.value)) {
        self.clearNotify();
        self.select(el.serviceList.value);
      }
    });

    el.qty.addEventListener("input", function () {
      self.updateAmount();
    });

    el.quick.addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn || !self.selected) return;
      const min = window.SG.serviceMin(self.selected);
      const max = window.SG.serviceMax(self.selected);
      if (btn.dataset.qtySet === "min") el.qty.value = String(min);
      else if (btn.dataset.qtySet === "max") el.qty.value = String(max);
      else {
        const base = parseInt(el.qty.value, 10) || min;
        const mult = Number(btn.dataset.qtyMult) || 1;
        el.qty.value = String(Math.min(max, Math.max(min, base * mult)));
      }
      self.updateAmount();
    });

    const again = $("[data-bp-again]", this.mount);
    if (again) again.addEventListener("click", function () {
      el.success.classList.add("hide");
      el.body.classList.remove("hide");
      el.form.reset();
      el.qty.value = "1000";
      self.clearNotify();
      if (self.selected) self.select(self.selected.id);
      el.search.focus();
    });

    el.form.addEventListener("submit", function (e) {
      e.preventDefault();
      self.submit();
    });
  };

  BoostPanel.prototype.submit = async function () {
    const self = this;
    const el = this.el;
    this.clearNotify();

    if (!this.user || this.user._preview)
      return this.notify("Sign in with your account to place a real boost order.", "error");
    if (!this.selected) return this.notify("Choose a service first.", "error");

    const link = (el.link.value || "").trim();
    const qty = parseInt(el.qty.value, 10) || 0;
    const min = window.SG.serviceMin(this.selected);
    const max = window.SG.serviceMax(this.selected);
    const rate = window.SG.rateOf(this.selected);

    if (link.length < 4) return this.notify("Add the link or @handle we should boost.", "error");
    if (qty < min)
      return this.notify("Minimum quantity for this service is " + min.toLocaleString("en-US") + ".", "error");
    if (qty > max)
      return this.notify("Maximum quantity for this service is " + max.toLocaleString("en-US") + ".", "error");

    const amount = window.SG.orderTotal(rate, qty);
    const name = this.user.displayName || (this.user.email || "").split("@")[0] || "Client";

    el.submit.disabled = true;
    el.submit.textContent = "Placing your order…";

    try {
      const res = await window.SG.createOrder({
        serviceId: this.selected.id,
        serviceName: this.selected.name,
        platform: this.selected.platform,
        category: this.selected.category,
        unit: this.selected.unit,
        unitLabel: this.selected.unit,
        priority: this.selected.priority || "normal",
        packageLabel: (this.selected.type || "Standard") + " · " + qty.toLocaleString("en-US") + " " + (this.selected.unit || "units"),
        quantity: qty.toLocaleString("en-US") + " " + (this.selected.unit || "units"),
        quantityNum: qty,
        ratePer1000: rate,
        amount: amount,
        targetLink: link,
        contactName: name,
        contactPhone: (el.phone.value || "").trim(),
        brand: "",
        notes: (el.notes.value || "").trim()
      });

      el.body.classList.add("hide");
      el.success.classList.remove("hide");
      el.ref.textContent = res.ref;
      const balanceEl = this.mount.querySelector("[data-bp-wallet-balance]");
      if (balanceEl) balanceEl.textContent = money(res.balance);
      el.success.scrollIntoView({ behavior: "smooth", block: "center" });
      window.sgToast && window.sgToast("Order placed — status: pending.");
      this.mount.dispatchEvent(new CustomEvent("sg:order-placed", { detail: res, bubbles: true }));
    } catch (err) {
      this.notify(
        (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
          (err && err.message) ||
          "We couldn't place your order. Please try again.",
        "error"
      );
    } finally {
      el.submit.disabled = false;
      el.submit.textContent = "Continue";
    }
    return self;
  };

  /* ------------------------------------------------------------------ */
  /* Load data + auth gate                                               */
  /* ------------------------------------------------------------------ */
  BoostPanel.prototype.start = function () {
    const self = this;

    /* ?preview=1 renders the signed-in panel with the starter catalogue so the
       layout can be reviewed without a Firebase session. Submitting still
       requires a real account. */
    const preview = new URLSearchParams(location.search).get("preview") === "1";

    window.SGOnReady(function () {
      window.SG.onUser(async function (user) {
        self.user = user || (preview
          ? { uid: "preview", email: "preview@sonicgids.local", displayName: "Preview", _preview: true }
          : null);

        if (!self.user) {
          self.mount.classList.add("bp-locked");
          self.mount.querySelector("[data-bp-root]").innerHTML = `
            <div class="bp-gate" data-bp-gate>
              <div class="bp-gate-lock">🔒</div>
              <h3>Sign in to boost your accounts</h3>
              <p>Create a free account, pick a service, paste your link and submit. Every order is tracked in your dashboard.</p>
              <div class="bp-gate-actions">
                <a class="btn btn-gold" href="login.html?next=${encodeURIComponent(currentPath())}">Sign in</a>
                <a class="btn btn-ghost" href="signup.html">Create free account</a>
              </div>
            </div>`;
          return;
        }

        self.mount.classList.remove("bp-locked");
        try {
          const walletBalance = await window.SG.walletBalance();
          const balanceEl = self.mount.querySelector("[data-bp-wallet-balance]");
          if (balanceEl) balanceEl.textContent = money(walletBalance);
        } catch (err) {
          const balanceEl = self.mount.querySelector("[data-bp-wallet-balance]");
          if (balanceEl) balanceEl.textContent = "Unavailable";
        }
        try {
          self.services = await window.SG.listBoostServices(true);
        } catch (err) {
          self.notify("Boost services could not be loaded. Please refresh the page.", "error");
          return;
        }

        self.renderCategories();
        self.renderServices();

        /* Deep link: ?service=Instagram%20Followers or ?cat=TikTok */
        const params = new URLSearchParams(location.search);
        const wanted = (params.get("service") || "").toLowerCase();
        const wantedCat = params.get("cat") || "";
        if (wantedCat) {
          self.category = wantedCat;
          self.el.category.value = wantedCat;
          self.renderServices();
        }
        const first =
          (wanted && self.services.find((s) => String(s.name).toLowerCase() === wanted)) ||
          self.filtered()[0];
        if (first) {
          self.el.serviceList.value = String(first.id);
          self.select(first.id);
        }

        if (preview && !user) {
          self.notify(
            "Preview mode — you are seeing the panel with the starter rate card. Sign in with a real account to place an order.",
            "info"
          );
        }
      });
    });
  };

  function currentPath() {
    return location.pathname.split("/").pop() || "order.html";
  }

  /* ------------------------------------------------------------------ */
  /* Boot every panel on the page                                        */
  /* ------------------------------------------------------------------ */
  function boot() {
    const mounts = Array.from(document.querySelectorAll("[data-boost-panel]"));
    if (!mounts.length) return;
    mounts.forEach((mount) => {
      if (mount.dataset.bpInit) return;
      mount.dataset.bpInit = "1";
      const panel = new BoostPanel(mount);
      mount._boostPanel = panel;
      panel.start();
    });
  }

  window.SGBoostPanel = BoostPanel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
