// Общий каркас концепт-страниц: панель «назад в ShaleCode», плавный скролл, появления по скроллу.
(function () {
  const params = new URLSearchParams(location.search);
  const LANGS = ["ru", "en", "ar"];
  let lang = params.get("lang");
  if (!LANGS.includes(lang)) { try { lang = localStorage.getItem("sc-lang"); } catch (e) { lang = null; } }
  if (!LANGS.includes(lang)) lang = "ru";

  const T = {
    ru: { back: "ShaleCode", note: "Концепт-проект студии", cta: "Хочу такой сайт" },
    en: { back: "ShaleCode", note: "Studio concept project", cta: "I want a site like this" },
    ar: { back: "ShaleCode", note: "مشروع مفاهيمي من الاستوديو", cta: "أريد موقعًا مثل هذا" }
  }[lang];

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches && !params.has("motion");
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const home = "../../index.html?lang=" + lang;
  // В версии для показа нет формы заявки — кнопка ведёт в Telegram студии
  const leadUrl = "https://t.me/shalecode";
  // Панель студии
  const bar = document.createElement("div");
  bar.className = "sc-bar";
  bar.dir = lang === "ar" ? "rtl" : "ltr";
  bar.innerHTML = `
    <a class="sc-back" href="${home}#work"><svg class="sc-arrow" viewBox="0 0 24 24" style="width:14px;fill:none;stroke:currentColor;stroke-width:2"><path d="M19 12H5M11 6l-6 6 6 6" style="fill:none"/></svg>
      <svg viewBox="0 0 246 208"><path d="M0 208 L32 24 L92 0 L88 108 L137 128 L152 151 L239 180 L246 208 Z"/><path d="M91 0 L158 38 L173 66 L215 89 L227 123 L153 98 L139 75 L87 53 Z"/><path d="M87 64 L132 84 L146 107 L231 136 L242 170 L159 142 L144 119 L85 98 Z"/></svg>${T.back}</a>
    <span class="sc-note">${T.note}</span>
    <a class="sc-cta" href="${leadUrl}" target="_blank" rel="noopener">${T.cta}</a>`;
  document.body.appendChild(bar);

  // Разбивка: по словам (по умолчанию) или по буквам (только для латиницы)
  function split(el, mode) {
    if (el.dataset.splitDone) return el.querySelectorAll(".wi");
    const text = el.textContent.trim();
    el.textContent = "";
    text.split(/\s+/).forEach((word, i, arr) => {
      const w = document.createElement("span");
      w.className = "w";
      if (mode === "chars") {
        [...word].forEach((ch) => { const c = document.createElement("span"); c.className = "wi"; c.textContent = ch; w.appendChild(c); });
      } else {
        const wi = document.createElement("span"); wi.className = "wi"; wi.textContent = word; w.appendChild(wi);
      }
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".wi");
  }

  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: .09 });
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const t = id.length > 1 ? document.querySelector(id) : 0;
    if (t === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { duration: 1.4 }); else if (t) t.scrollIntoView(); else scrollTo(0, 0);
  }));

  // Панель прячется при скролле вниз
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    bar.classList.toggle("is-hidden", y > lastY && y > 300);
    lastY = y;
  }, { passive: true });

  // Типовые появления: [data-reveal] и [data-split-up]
  function reveals() {
    if (reduced || !window.gsap) return;
    document.querySelectorAll("[data-split-up]").forEach((el) => {
      const parts = split(el, el.dataset.splitUp === "chars" ? "chars" : "words");
      gsap.from(parts, { yPercent: 110, duration: 1.2, stagger: el.dataset.splitUp === "chars" ? .03 : .06, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1.1, delay: parseFloat(el.dataset.reveal) || 0, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });
  }

  window.DEMO = { lang, reduced, isTouch, lenis, split, reveals };
})();
