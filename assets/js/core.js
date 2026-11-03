// Общая логика обоих вариантов: языки, плавный скролл, курсор, магнитные кнопки, форма.
(function () {
  const LANGS = ["ru", "en", "ar"];
  // ?motion=1 принудительно включает анимации (для демонстрации и проверки)
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches && !new URLSearchParams(location.search).has("motion");
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function getLang() {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
    const s = storeGet("sc-lang");
    if (LANGS.includes(s)) return s;
    return "ru";
  }

  const lang = getLang();
  const dict = window.SC_I18N[lang];
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";

  function applyI18n(root) {
    document.title = dict["meta.title"];
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const v = dict[el.dataset.i18nPh];
      if (v != null) el.setAttribute("placeholder", v);
    });
    root.querySelectorAll("[data-i18n-label]").forEach((el) => {
      const v = dict[el.dataset.i18nLabel];
      if (v != null) el.setAttribute("data-label", v);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const v = dict[el.dataset.i18nAria];
      if (v != null) el.setAttribute("aria-label", v);
    });
    root.querySelectorAll("[data-lang]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.lang === lang);
      b.addEventListener("click", () => {
        if (b.dataset.lang === lang) return;
        storeSet("sc-lang", b.dataset.lang);
        const u = new URL(location.href);
        u.searchParams.set("lang", b.dataset.lang);
        document.body.classList.add("is-leaving");
        setTimeout(() => (location.href = u.toString()), reduced ? 0 : 450);
      });
    });
    // Ссылки между вариантами сохраняют язык
    root.querySelectorAll("a[data-keep-lang]").forEach((a) => {
      const u = new URL(a.getAttribute("href"), location.href);
      u.searchParams.set("lang", lang);
      a.href = u.toString();
    });
  }

  // Разбивка на слова в масках. Арабский не режем по буквам — ломаются лигатуры.
  function splitWords(el) {
    if (el.dataset.splitDone) return el.querySelectorAll(".wi");
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const wi = document.createElement("span");
            wi.className = "wi";
            wi.textContent = p;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".wi");
  }

  applyI18n(document);

  // Плавный скролл
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    if (window.gsap && window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function setMenu(open) {
    const menu = document.getElementById("mMenu");
    const was = document.body.classList.contains("menu-open");
    if (!menu || open === was) return;
    document.body.classList.toggle("menu-open", open);
    html.classList.toggle("menu-lock", open);
    menu.hidden = !open;
    const b = document.querySelector(".burger");
    if (b) b.setAttribute("aria-expanded", String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open && !reduced && window.gsap) {
      gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: .35, ease: "power2.out" });
      gsap.fromTo(menu.querySelectorAll(".m-links a, .m-foot > *"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .06, ease: "power3.out", clearProps: "transform,opacity" });
    }
  }

  // Кнопки с data-open-lead открывают окно заявки (initModal), а не прокручивают к разделу
  document.querySelectorAll('a[href^="#"]:not([data-open-lead])').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#" || id === "#top" ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      setMenu(false);
      if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else if (target === 0) window.scrollTo({ top: 0 });
      else target.scrollIntoView();
    });
  });

  // Кастомный курсор
  function initCursor() {
    const ring = document.querySelector(".cursor");
    const dot = document.querySelector(".cursor-dot");
    if (!ring || !dot || isTouch || !window.gsap) return;
    document.body.classList.add("has-cursor");
    const label = ring.querySelector(".cursor-label");
    const rx = gsap.quickTo(ring, "x", { duration: 0.55, ease: "power3" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.55, ease: "power3" });
    const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
    const dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    window.addEventListener("pointermove", (e) => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); });
    document.addEventListener("pointerover", (e) => {
      const v = e.target.closest("[data-cursor]");
      const h = e.target.closest("a, button, input, textarea, select, label");
      ring.classList.toggle("is-view", !!v);
      ring.classList.toggle("is-hover", !v && !!h);
      if (v && label) label.textContent = dict[v.dataset.cursor] || "";
    });
    document.addEventListener("pointerleave", () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 }));
    document.addEventListener("pointerenter", () => gsap.to([ring, dot], { opacity: 1, duration: 0.3 }));
  }

  // Магнитные кнопки
  function initMagnetic() {
    if (isTouch || reduced || !window.gsap) return;
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      const inner = el.querySelector(".btn-inner") || el;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        gsap.to(el, { x: x * strength, y: y * strength, duration: 0.6, ease: "power3.out" });
        if (inner !== el) gsap.to(inner, { x: x * strength * 0.5, y: y * strength * 0.5, duration: 0.6, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", () => {
        gsap.to([el, inner], { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.35)" });
      });
    });
  }

  // Контакты из config.js
  const cfg = window.SC_CONFIG || {};
  function initContacts() {
    const set = (key, href, text) => document.querySelectorAll(`[data-contact="${key}"]`).forEach((a) => { a.href = href; a.textContent = text; });
    if (cfg.email) set("email", "mailto:" + cfg.email, cfg.email);
    if (cfg.telegram) set("telegram", "https://t.me/" + cfg.telegram, "Telegram — @" + cfg.telegram);
    if (cfg.phone) set("phone", "tel:" + cfg.phone.replace(/[^\d+]/g, ""), cfg.phone);
  }

  // Форма: отправка на сервер (functions/api/lead.js). Работает и в разделе «Контакты», и в окне заявки.
  function initForm() {
    document.querySelectorAll("form.contact-form").forEach(bindForm);
  }
  function bindForm(form) {
    const openedAt = Date.now();
    const label = form.querySelector(".send-label");
    const ok = form.querySelector(".form-ok");
    const err = form.querySelector(".form-err");
    const fallback = cfg.telegram ? `<a href="https://t.me/${cfg.telegram}" target="_blank" rel="noopener">@${cfg.telegram}</a>` : cfg.email ? `<a href="mailto:${cfg.email}">${cfg.email}</a>` : "";

    // Телефон и Telegram — отдельные поля, но хотя бы одно должно быть заполнено
    const phone = form.elements.phone, tg = form.elements.telegram;
    [phone, tg].forEach((f) => f.addEventListener("input", () => phone.setCustomValidity("")));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.classList.contains("is-sending")) return;
      err.classList.remove("is-on");
      phone.setCustomValidity(!phone.value.trim() && !tg.value.trim() ? dict["form.needContact"] : "");
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      Object.assign(data, { lang, page: location.pathname, t: openedAt });

      form.classList.add("is-sending");
      label.textContent = dict["form.sending"];
      try {
        const r = await fetch(cfg.formEndpoint || "/api/lead", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data)
        });
        const res = await r.json().catch(() => ({}));
        if (!r.ok || !res.ok) throw new Error(res.error || r.status);
        form.classList.add("is-sent");
        if (window.gsap) gsap.fromTo(ok, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" });
        form.reset();
        form.dispatchEvent(new CustomEvent("sc:sent", { bubbles: true }));
      } catch (ex) {
        console.error("form:", ex);
        err.innerHTML = dict["form.err"] + (fallback ? " " + fallback : "");
        err.classList.add("is-on");
      } finally {
        form.classList.remove("is-sending");
        label.textContent = dict["form.send"];
      }
    });
  }

  // ---------- Окно заявки ----------
  const modal = document.getElementById("leadModal");
  // Форма в окне — копия формы из раздела «Контакты»: поля и тексты всегда совпадают
  function cloneLeadForm() {
    const src = document.querySelector("#contact form.contact-form");
    if (!modal || !src) return;
    modal.querySelector(".modal-body").append(src.cloneNode(true));
  }

  function initModal() {
    // Без окна заявки (версия для показа) — ведём в Telegram
    if (!modal) return { open() { if (cfg.telegram) window.open("https://t.me/" + cfg.telegram, "_blank", "noopener"); } };
    const panel = modal.querySelector(".modal-panel");
    const form = modal.querySelector("form");
    const mobile = () => window.matchMedia("(max-width: 640px)").matches;
    let lastFocus = null, closeTimer = null, isOpen = false;
    const focusables = () => [...panel.querySelectorAll("a[href], button:not([disabled]), input:not([tabindex='-1']), select, textarea")].filter((el) => el.offsetParent !== null);

    function open(opts = {}) {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      clearTimeout(closeTimer);
      form.classList.remove("is-sent");
      form.querySelector(".form-err").classList.remove("is-on");
      if (opts.message) form.msg.value = opts.message;
      // Клик по услуге открывает окно с этой услугой в поле «Тип проекта»
      if (opts.type) { const sel = form.elements.type; if ([...sel.options].some((o) => o.value === opts.type)) sel.value = opts.type; }
      modal.hidden = false;
      html.classList.add("modal-open");
      if (lenis) lenis.stop();
      document.dispatchEvent(new CustomEvent("sc:modal", { detail: true }));
      const first = () => form.querySelector("input[name=name]").focus({ preventScroll: true });
      if (reduced || !window.gsap) { first(); return; }
      gsap.killTweensOf([modal, panel]);
      gsap.timeline({ onComplete: first })
        .fromTo(modal, { "--veil": 0 }, { "--veil": 1, duration: .6, ease: "power2.out" }, 0)
        .fromTo(panel, mobile() ? { yPercent: 100 } : { y: 70, opacity: 0, scale: .97 },
          mobile() ? { yPercent: 0, duration: .8, ease: "expo.out" } : { y: 0, opacity: 1, scale: 1, duration: 1, ease: "expo.out" }, .05)
        .from(panel.querySelectorAll(".modal-head > *, .modal-body .field, .modal-body .btn, .modal-alt"), { y: 24, opacity: 0, duration: .8, stagger: .05, ease: "power3.out" }, .2);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      clearTimeout(closeTimer);
      const done = () => {
        modal.hidden = true;
        html.classList.remove("modal-open");
        if (lenis) lenis.start();
        document.dispatchEvent(new CustomEvent("sc:modal", { detail: false }));
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      };
      if (reduced || !window.gsap) { done(); return; }
      gsap.timeline({ onComplete: done })
        .to(panel, mobile() ? { yPercent: 100, duration: .5, ease: "power3.in" } : { y: 40, opacity: 0, scale: .98, duration: .45, ease: "power3.in" }, 0)
        .to(modal, { "--veil": 0, duration: .5, ease: "power2.in" }, .1);
    }

    document.querySelectorAll("[data-open-lead]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); setMenu(false); open(); }));
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      // Фокус клавиатуры не уходит за пределы окна
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // После успешной отправки окно закроется само
    form.addEventListener("sc:sent", () => { closeTimer = setTimeout(close, 3800); });

    // Переход с демо-страницы «Хочу такой сайт»: ?brief=Aurum → окно с подставленным концептом
    const brief = new URLSearchParams(location.search).get("brief");
    if (brief) {
      const name = brief.replace(/[^\p{L}\p{N} .'&-]/gu, "").slice(0, 40);
      const u = new URL(location.href); u.searchParams.delete("brief"); history.replaceState(null, "", u);
      const go = () => open({ message: dict["form.brief"].replace("{name}", name) });
      if (!document.body.classList.contains("is-loading")) setTimeout(go, 300);
      else new MutationObserver((_, ob) => { if (!document.body.classList.contains("is-loading")) { ob.disconnect(); setTimeout(go, 700); } }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    return { open, close };
  }

  // Мобильное меню: на весь экран, прокрутка страницы под ним заблокирована, Esc закрывает
  const burger = document.querySelector(".burger");
  if (burger) {
    burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); burger.focus(); } });
    // Меню рассчитано на узкий экран — при расширении окна закрываем
    window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  cloneLeadForm();
  initContacts();
  initCursor();
  initMagnetic();
  initForm();
  const leadModal = initModal();

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

  window.SC = { lang, dict, rtl: lang === "ar", reduced, isTouch, lenis, splitWords, fontsReady, openLead: leadModal.open };
})();
