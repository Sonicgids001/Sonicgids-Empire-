/* ==========================================================================
   SONICGIOS EMPIRE — Site behaviour (no dependencies)
   Nav, scroll effects, reveal animations, accordions, filters, counters,
   form UX, toast notifications, footer year, back-to-top.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Toast ---------- */
  let toastEl = null;
  let toastTimer = null;
  function toast(message, type) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("role", "status");
      toastEl.style.cssText = [
        "position:fixed", "left:50%", "bottom:28px", "transform:translate(-50%,20px)",
        "z-index:2000", "max-width:min(92vw,460px)", "padding:14px 20px",
        "border-radius:14px", "font-size:.89rem", "font-weight:500",
        "box-shadow:0 24px 60px -20px rgba(0,0,0,.9)",
        "border:1px solid rgba(212,175,55,.35)", "background:rgba(16,16,23,.97)",
        "color:#ececf1", "backdrop-filter:blur(12px)", "opacity:0",
        "transition:opacity .3s, transform .3s", "line-height:1.5"
      ].join(";");
      document.body.appendChild(toastEl);
    }
    if (type === "error") {
      toastEl.style.borderColor = "rgba(248,113,113,.5)";
      toastEl.style.color = "#fca5a5";
    } else {
      toastEl.style.borderColor = "rgba(212,175,55,.4)";
      toastEl.style.color = "#f7e08a";
    }
    toastEl.textContent = message;
    requestAnimationFrame(() => {
      toastEl.style.opacity = "1";
      toastEl.style.transform = "translate(-50%,0)";
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translate(-50%,20px)";
    }, 4200);
  }
  window.sgToast = toast;

  /* ---------- Header / scroll progress / back-to-top ---------- */
  function initScroll() {
    const header = document.querySelector(".site-header");
    const bar = document.querySelector(".scroll-progress");
    const top = document.querySelector(".to-top");

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (header) header.classList.toggle("scrolled", y > 14);
      if (bar) bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
      if (top) top.classList.toggle("show", y > 620);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (top) {
      top.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  }

  /* ---------- Mobile navigation ---------- */
  function initMobileNav() {
    const burger = document.querySelector(".burger");
    const drawer = document.querySelector(".mobile-nav");
    if (!burger || !drawer) return;

    const close = () => {
      burger.classList.remove("open");
      drawer.classList.remove("open");
      document.body.classList.remove("nav-open");
      burger.setAttribute("aria-expanded", "false");
    };

    burger.addEventListener("click", () => {
      const open = !drawer.classList.contains("open");
      burger.classList.toggle("open", open);
      drawer.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", String(open));
    });

    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 1080) close(); });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Animated counters ---------- */
  function initCounters() {
    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.decimals | 0);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      const duration = 1500;
      const start = performance.now();

      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const value = target * eased;
        el.textContent =
          prefix +
          value.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }) +
          suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      counters.forEach(run);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            run(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => io.observe(el));
  }

  /* ---------- Accordion ---------- */
  function initAccordions() {
    document.querySelectorAll(".accordion").forEach((group) => {
      group.querySelectorAll(".acc-item").forEach((item) => {
        const q = item.querySelector(".acc-q");
        const a = item.querySelector(".acc-a");
        if (!q || !a) return;
        q.setAttribute("aria-expanded", "false");

        q.addEventListener("click", () => {
          const isOpen = item.classList.contains("open");
          if (group.dataset.single !== "false") {
            group.querySelectorAll(".acc-item.open").forEach((other) => {
              other.classList.remove("open");
              const oa = other.querySelector(".acc-a");
              if (oa) oa.style.maxHeight = "0px";
              const oq = other.querySelector(".acc-q");
              if (oq) oq.setAttribute("aria-expanded", "false");
            });
          }
          if (!isOpen) {
            item.classList.add("open");
            a.style.maxHeight = a.scrollHeight + 40 + "px";
            q.setAttribute("aria-expanded", "true");
          }
        });
      });
    });
  }

  /* ---------- Filtering (case studies / blog) ---------- */
  function initFilters() {
    document.querySelectorAll("[data-filter-bar]").forEach((bar) => {
      const targetSel = bar.dataset.filterBar;
      const items = document.querySelectorAll(targetSel + " [data-cat]");
      const countEl = document.querySelector(bar.dataset.countTarget || "");

      const apply = (value) => {
        let shown = 0;
        items.forEach((item) => {
          const cats = (item.dataset.cat || "").split(/\s+/);
          const match = value === "all" || cats.includes(value);
          item.classList.toggle("hide", !match);
          if (match) shown++;
        });
        if (countEl) countEl.textContent = shown;
      };

      bar.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          apply(btn.dataset.filter || "all");
        });
      });
    });
  }

  /* ---------- Password visibility toggles ---------- */
  function initPasswordToggles() {
    document.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.querySelector(btn.dataset.pwToggle);
        if (!input) return;
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.textContent = showing ? "Show" : "Hide";
        btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
    });
  }

  /* ---------- Tabs / segmented controls ---------- */
  function initToggles() {
    document.querySelectorAll("[data-toggle-group]").forEach((group) => {
      const targetSel = group.dataset.toggleGroup;
      group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          group.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          document.querySelectorAll(targetSel).forEach((panel) => {
            panel.classList.toggle("hide", panel.dataset.togglePanel !== btn.dataset.toggle);
          });
        });
      });
    });
  }

  /* ---------- Newsletter (footer) ---------- */
  function initNewsletter() {
    document.querySelectorAll("[data-newsletter]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const btn = form.querySelector("button");
        const email = (input.value || "").trim();
        if (!email) return;
        if (!window.SG || typeof window.SG.saveSubscriber !== "function") {
          toast("Subscriptions are temporarily unavailable. Please try again shortly.", "error");
          return;
        }
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Sending…";
        try {
          await window.SG.saveSubscriber(email);
          toast("You're on the list. Welcome to the Empire.");
          form.reset();
        } catch (err) {
          const msg =
            window.SG && window.SG.friendlyDbError
              ? window.SG.friendlyDbError(err)
              : "Could not subscribe right now.";
          toast(msg, "error");
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    });
  }

  /* ---------- Footer year ---------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------- Active nav highlighting ---------- */
  function initActiveNav() {
    const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav-link, .mobile-nav a").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
      if (!href || href.startsWith("#")) return;
      if (href === here) link.classList.add("active");
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initScroll();
    initMobileNav();
    initReveal();
    initCounters();
    initAccordions();
    initFilters();
    initPasswordToggles();
    initToggles();
    initNewsletter();
    initYear();
    initActiveNav();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
