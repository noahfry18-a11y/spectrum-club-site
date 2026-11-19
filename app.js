(() => {
  const CFG = window.SITE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- storage / submission ---------- */
  const store = {
    read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    add(key, rec) { try { const all = store.read(key); all.push(rec); localStorage.setItem(key, JSON.stringify(all)); } catch {} },
  };

  async function submit(type, storeKey, data) {
    const rec = { ...data, submittedAt: new Date().toISOString() };
    if (!CFG.API_URL) { store.add(storeKey, rec); return; } // demo mode
    // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin
    const res = await fetch(CFG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type, ...rec }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || "Request failed");
  }

  /* ---------- nav ---------- */
  const nav = $(".nav");
  const menuBtn = $(".menu-btn");
  const links = $("#nav-links");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  menuBtn.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });
  $$("a", links).forEach(a => a.addEventListener("click", () => {
    links.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false);
  }));

  // active section highlight
  const navMap = new Map($$(".nav-links a:not(.btn)").map(a => [a.getAttribute("href").slice(1), a]));
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navMap.forEach(a => a.classList.remove("active"));
        navMap.get(e.target.id)?.classList.add("active");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navMap.forEach((_, id) => { const s = document.getElementById(id); if (s) secObs.observe(s); });

  /* ---------- reveal on scroll ---------- */
  const revealTargets = $$(".section-head, .about-text, .v, .member, .member-pitch, .form-card, .contact-grid > *");
  revealTargets.forEach((el, i) => { el.classList.add("reveal"); el.style.transitionDelay = `${(i % 4) * 70}ms`; });
  const revObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealTargets.forEach(el => revObs.observe(el));

  /* ---------- validation helpers ---------- */
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const phoneOk = v => v.replace(/\D/g, "").length >= 10;
  function check(input) {
    let ok = input.type === "checkbox" ? input.checked : input.value.trim() !== "";
    if (ok && input.type === "email") ok = emailOk(input.value.trim());
    if (ok && input.type === "tel") ok = phoneOk(input.value);
    input.classList.toggle("invalid", !ok && input.type !== "checkbox");
    return ok;
  }
  $$("input, textarea").forEach(i => i.addEventListener("input", () => i.classList.remove("invalid")));

  /* ---------- membership form ---------- */
  const form = $("#join-form");
  const err = $(".form-error", form);
  const bar = $(".progress .bar", form);
  const steps = $$(".step", form);
  const goTo = n => {
    steps.forEach(s => s.classList.toggle("is-active", +s.dataset.step === n));
    bar.style.width = `${(n / 3) * 100}%`;
    bar.style.backgroundPosition = `${(n - 1) * 50}% 0`;
    err.textContent = "";
    const first = $(`.step[data-step="${n}"] input, .step[data-step="${n}"] button`, form);
    if (n > 1 && first) first.focus({ preventScroll: true });
  };

  const forSel = $("#j-for");
  forSel.addEventListener("change", () => {
    $("#participant-field").classList.toggle("hidden", forSel.value === "Myself");
  });

  // phone formatting (US)
  const phone = $("#j-phone");
  phone.addEventListener("input", () => {
    const d = phone.value.replace(/\D/g, "").slice(0, 10);
    if (d.length > 6) phone.value = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length > 3) phone.value = `(${d.slice(0, 3)}) ${d.slice(3)}`;
  });

  $("[data-next]", form).addEventListener("click", () => {
    const fields = [$("#j-name"), $("#j-email"), $("#j-phone")];
    const results = fields.map(check);
    if (results.every(Boolean)) {
      $("#j-sign").placeholder = $("#j-name").value.trim();
      goTo(2);
    } else {
      err.textContent = !results[1] ? "Please enter a valid email address." : !results[2] ? "Please enter a 10-digit phone number." : "Please fill in your name.";
      fields[results.indexOf(false)].focus();
    }
  });
  $("[data-back]", form).addEventListener("click", () => goTo(1));
  $("[data-reset]", form).addEventListener("click", () => { form.reset(); $("#participant-field").classList.add("hidden"); goTo(1); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const agree = $("#j-agree"), sign = $("#j-sign");
    if (!check(agree)) { err.textContent = "Please check the box to agree to the waiver."; return; }
    if (!check(sign)) { err.textContent = "Please type your full name to sign."; sign.focus(); return; }
    const btn = $("button[type=submit]", form);
    btn.disabled = true; btn.textContent = "Signing you up…";
    const data = Object.fromEntries(new FormData(form));
    data.agreed = true;
    data.waiverSignedAt = new Date().toISOString();
    try {
      await submit("member", "spectrum_members", data);
      $("#done-name").textContent = data.name.split(" ")[0] || "friend";
      goTo(3);
    } catch {
      err.textContent = "Something went wrong sending your sign-up. Please try again, or contact us below.";
    } finally {
      btn.disabled = false; btn.textContent = "Complete sign-up";
    }
  });

  /* ---------- contact form ---------- */
  const cform = $("#contact-form");
  const ok = $(".form-ok", cform);
  cform.addEventListener("submit", async e => {
    e.preventDefault();
    ok.textContent = "";
    const fields = $$("input:not(.hp), textarea", cform);
    const results = fields.map(check);
    if (!results.every(Boolean)) { fields[results.indexOf(false)].focus(); return; }
    const btn = $("button", cform);
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await submit("message", "spectrum_messages", Object.fromEntries(new FormData(cform)));
      cform.reset();
      ok.style.color = ""; ok.textContent = "Thanks! Your message is on its way — we'll be in touch soon.";
    } catch {
      ok.style.color = "var(--red)"; ok.textContent = "Sorry, that didn't go through. Please email us directly.";
    } finally {
      btn.disabled = false; btn.textContent = "Send message";
    }
  });

  $("#year").textContent = new Date().getFullYear();

  /* ---------- preview notice (disappears once a real endpoint is set) ---------- */
  if (!CFG.API_URL) {
    const note = document.createElement("div");
    note.className = "preview-note";
    note.innerHTML = "<b>Design preview</b> · Not live yet. Sign-ups on this page are only saved in your browser.";
    document.body.prepend(note);
  }
})();
