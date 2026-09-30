/* ==========================================================================
   SONICGIOS EMPIRE — Contact / brief form
   Validates, stores the brief in Firestore (collection: "leads"),
   logs a generate_lead event, then redirects to thank-you.html
   ========================================================================== */

(function () {
  "use strict";

  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const alertEl = document.querySelector("[data-contact-alert]");
  const submit = form.querySelector('button[type="submit"]');
  const countEl = document.querySelector("[data-char-count]");
  const messageEl = form.querySelector('textarea[name="message"]');

  function setAlert(message, type) {
    if (!alertEl) {
      window.sgToast && window.sgToast(message, type === "success" ? "ok" : "error");
      return;
    }
    alertEl.className = "alert show alert-" + (type || "error");
    alertEl.textContent = message;
    alertEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (messageEl && countEl) {
    const update = () => { countEl.textContent = messageEl.value.length + " / 1200"; };
    messageEl.addEventListener("input", update);
    update();
  }

  /* Pre-select the service when the page is opened as contact.html?service=seo */
  const wanted = new URLSearchParams(location.search).get("service");
  if (wanted) {
    const select = form.querySelector('select[name="service"]');
    if (select) {
      const match = Array.from(select.options).find(
        (o) => o.value.toLowerCase() === wanted.toLowerCase()
      );
      if (match) select.value = match.value;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const message = (data.message || "").trim();

    if (name.length < 2) return setAlert("Please tell us your name.", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return setAlert("Please enter a valid email address.", "error");
    if (message.length < 20)
      return setAlert("Please add a little more detail (at least 20 characters).", "error");
    if (data.consent !== "on")
      return setAlert("Please tick the consent box so we can reply.", "error");

    if (!window.SG || typeof window.SG.saveLead !== "function") {
      setAlert("Our form service is starting up. Please try again in a moment, or message us on WhatsApp.", "error");
      return;
    }

    const original = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Sending your brief…";

    try {
      const id = await window.SG.saveLead({
        name,
        email,
        company: (data.company || "").trim(),
        phone: (data.phone || "").trim(),
        service: data.service || "Not specified",
        budget: data.budget || "Not specified",
        message,
        source: data.source || "contact-page"
      });
      try {
        sessionStorage.setItem("sg_last_lead", JSON.stringify({ id, name, service: data.service }));
        sessionStorage.setItem("sg_last_lead_name", name);
        sessionStorage.setItem("sg_last_lead_service", data.service || "your project");
      } catch (err) { /* storage may be blocked — fine */ }
      location.href = "thank-you.html";
    } catch (err) {
      const msg =
        (window.SG.friendlyDbError && window.SG.friendlyDbError(err)) ||
        (err && err.message) ||
        "We couldn't send your brief. Please try again or use WhatsApp.";
      setAlert(msg + " You can also email okogbagideon28@gmail.com.", "error");
      submit.disabled = false;
      submit.textContent = original;
    }
  });
})();
